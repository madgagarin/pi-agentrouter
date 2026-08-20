import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";
import * as fs from "fs";
import * as path from "path";

const CONFIG_FILE = path.join(process.env.HOME || "", ".pi/agent/agentrouter.json");

export interface AgentRouterConfig {
  apiKey?: string;
  minIntervalMs?: number;
}

export function loadConfig(): AgentRouterConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

export function saveConfig(cfg: AgentRouterConfig): void {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf-8");
  } catch {}
}

export function normalizeApiKey(key?: string): string {
  if (!key) return "";
  return key.trim().replace(/^["']|["']$/g, "").trim();
}

const initialConfig = loadConfig();
let currentApiKey = normalizeApiKey(process.env.AGENTROUTER_API_KEY || initialConfig.apiKey || "");
let minIntervalMs = initialConfig.minIntervalMs ?? 2500;
let lastRequestTime = 0;

export function isAgentRouter(providerName?: string, baseUrl?: string): boolean {
  if (providerName && providerName.toLowerCase().includes("agentrouter")) return true;
  if (baseUrl && baseUrl.toLowerCase().includes("agentrouter.org")) return true;
  return false;
}

export default function (pi: ExtensionAPI) {
  function registerAgentRouterProviders(apiKey: string): void {
    pi.registerProvider("agentrouter-openai", {
      name: "AgentRouter OpenAI",
      baseUrl: "https://agentrouter.org/v1",
      apiKey,
      api: "openai-completions",
      compat: {
        sendSessionAffinityHeaders: true,
      },
      models: [
        {
          id: "gpt-5.6-sol",
          name: "gpt-5.6-sol",
          reasoning: true,
          input: ["text"],
          contextWindow: 1048576,
          maxTokens: 131072,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          compat: {
            sendSessionAffinityHeaders: true,
          },
        },
      ],
    });

    pi.registerProvider("agentrouter-clode", {
      name: "AgentRouter Claude",
      baseUrl: "https://agentrouter.org",
      apiKey,
      api: "anthropic-messages",
      compat: {
        forceAdaptiveThinking: true,
      },
      models: [
        {
          id: "claude-opus-4-8",
          name: "claude-opus-4-8",
          reasoning: true,
          input: ["text"],
          contextWindow: 524288,
          maxTokens: 65536,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          compat: {
            forceAdaptiveThinking: true,
          },
        },
        {
          id: "claude-opus-5",
          name: "claude-opus-5",
          reasoning: true,
          input: ["text"],
          contextWindow: 1048576,
          maxTokens: 65536,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          compat: {
            forceAdaptiveThinking: true,
          },
        },
      ],
    });
  }

  registerAgentRouterProviders(currentApiKey);

  function updatePromptRewriteEnvForModel(model?: any): void {
    if (isAgentRouter(model?.provider, model?.baseUrl)) {
      process.env.PI_CACHE_OPTIMIZER_NO_PROMPT_REWRITE = "1";
    } else {
      delete process.env.PI_CACHE_OPTIMIZER_NO_PROMPT_REWRITE;
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    updatePromptRewriteEnvForModel(ctx.model);
    lastRequestTime = Date.now();
  });

  pi.on("model_select", async (event) => {
    updatePromptRewriteEnvForModel(event.model);
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    updatePromptRewriteEnvForModel(ctx.model);
  });

  pi.on("turn_start", async (_event, ctx) => {
    const model = ctx.model;
    updatePromptRewriteEnvForModel(model);
    if (!isAgentRouter(model?.provider, (model as any)?.baseUrl)) {
      return;
    }

    const now = Date.now();
    const elapsed = now - lastRequestTime;

    if (lastRequestTime > 0 && elapsed < minIntervalMs) {
      const waitMs = minIntervalMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    lastRequestTime = Date.now();
  });

  pi.on("session_before_compact", async (event, ctx) => {
    const model = ctx.model;
    if (!model || !isAgentRouter(model.provider, (model as any).baseUrl)) {
      return;
    }

    const { preparation, signal } = event;
    const { messagesToSummarize, turnPrefixMessages, tokensBefore, firstKeptEntryId, previousSummary } = preparation;

    const allMessages = [...messagesToSummarize, ...turnPrefixMessages];
    if (allMessages.length === 0) return;

    if (ctx.hasUI) {
      ctx.ui.notify(`Compacting AgentRouter context (${tokensBefore.toLocaleString()} tokens)...`, "info");
    }

    const conversationText = serializeConversation(convertToLlm(allMessages));
    const previousContext = previousSummary ? `\n\nPrevious session summary:\n${previousSummary}` : "";

    const summaryMessages = [
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: `You are a conversation summarizer. Create a comprehensive, structured summary of this conversation to preserve context:\n${previousContext}\n\n1. Goals and tasks\n2. Key decisions & code changes\n3. Next steps\n\n<conversation>\n${conversationText}\n</conversation>`,
          },
        ],
        timestamp: Date.now(),
      },
    ];

    try {
      const response = await ctx.modelRegistry.complete(
        model,
        {
          systemPrompt: ctx.getSystemPrompt(),
          messages: summaryMessages,
        },
        {
          maxTokens: 8192,
          signal,
        }
      );

      const summary = response.content
        .filter((c: any): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n");

      if (!summary || !summary.trim()) return;

      if (ctx.hasUI) {
        ctx.ui.notify("Context compaction completed successfully.", "info");
      }

      return {
        compaction: {
          summary,
          firstKeptEntryId,
          tokensBefore,
          usage: response.usage,
        },
      };
    } catch (err: any) {
      if (ctx.hasUI) {
        ctx.ui.notify(`Compaction failed: ${err.message}`, "error");
      }
      return;
    }
  });

  pi.registerCommand("agentrouter", {
    description: "Manage AgentRouter plugin settings (status, API key, pacing interval)",
    handler: async (args, ctx) => {
      const parts = (args || "").trim().split(/\s+/);
      const action = parts[0]?.toLowerCase();

      if (action === "key" || action === "set-key") {
        const rawKey = parts[1]?.trim();
        const cleanKey = normalizeApiKey(rawKey);
        if (!cleanKey || cleanKey.length < 5) {
          ctx.ui.notify("Please provide a valid API key: /agentrouter key <your-key>", "error");
          return;
        }
        currentApiKey = cleanKey;
        saveConfig({ apiKey: cleanKey, minIntervalMs });
        registerAgentRouterProviders(cleanKey);
        ctx.ui.notify("AgentRouter API key updated successfully for all models.", "info");
        return;
      }

      if (action === "pacing" || action === "throttle") {
        const val = parseInt(parts[1], 10);
        if (isNaN(val) || val < 0) {
          ctx.ui.notify(`Current interval: ${minIntervalMs} ms. Usage: /agentrouter pacing <ms>`, "info");
          return;
        }
        minIntervalMs = val;
        saveConfig({ apiKey: currentApiKey, minIntervalMs });
        ctx.ui.notify(`Pacing interval set to ${minIntervalMs} ms.`, "info");
        return;
      }

      const maskedKey = currentApiKey.length > 8 ? `${currentApiKey.slice(0, 7)}...${currentApiKey.slice(-4)}` : "not set";
      const activeModel = ctx.model;
      const isAR = isAgentRouter(activeModel?.provider, (activeModel as any)?.baseUrl);

      ctx.ui.notify(
        `[AgentRouter Plugin]\n` +
        `- Active model: ${activeModel?.id || "none"} (${isAR ? "AgentRouter [yes]" : "Other Provider"})\n` +
        `- API Key: ${maskedKey}\n` +
        `- Caching: Enabled (Prompt Cache + Session Affinity + Adaptive Thinking)\n` +
        `- Pacing Interval: ${minIntervalMs} ms\n` +
        `- Commands:\n` +
        `   /agentrouter key <key>   (update API key)\n` +
        `   /agentrouter pacing <ms> (set minimum request delay)`,
        "info"
      );
    },
  });
}
