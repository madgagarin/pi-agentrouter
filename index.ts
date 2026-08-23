import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";
import * as fs from "fs";
import * as path from "path";

const CONFIG_FILE = path.join(process.env.HOME || "", ".pi/agent/agentrouter.json");
const SETTINGS_FILE = path.join(process.env.HOME || "", ".pi/agent/settings.json");

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

export interface PackageOrderState {
  agentRouterIndex: number;
  cacheOptimizerIndex: number;
  needsFix: boolean;
}

export function getPackageOrderState(): PackageOrderState {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      return { agentRouterIndex: -1, cacheOptimizerIndex: -1, needsFix: false };
    }
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    if (!Array.isArray(settings.packages)) {
      return { agentRouterIndex: -1, cacheOptimizerIndex: -1, needsFix: false };
    }
    const arIdx = settings.packages.findIndex((p: string) =>
      typeof p === "string" && (p.includes("@madgagarin/pi-agentrouter") || p.includes("pi-agentrouter"))
    );
    const cacheIdx = settings.packages.findIndex((p: string) =>
      typeof p === "string" && p.includes("pi-cache-optimizer")
    );
    const needsFix = cacheIdx !== -1 && arIdx !== -1 && arIdx > cacheIdx;
    return { agentRouterIndex: arIdx, cacheOptimizerIndex: cacheIdx, needsFix };
  } catch {
    return { agentRouterIndex: -1, cacheOptimizerIndex: -1, needsFix: false };
  }
}

export function fixPackagePriorityInSettings(): boolean {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return false;
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    if (!Array.isArray(settings.packages)) return false;
    const arIdx = settings.packages.findIndex((p: string) =>
      typeof p === "string" && (p.includes("@madgagarin/pi-agentrouter") || p.includes("pi-agentrouter"))
    );
    const cacheIdx = settings.packages.findIndex((p: string) =>
      typeof p === "string" && p.includes("pi-cache-optimizer")
    );
    if (cacheIdx !== -1 && arIdx !== -1 && arIdx > cacheIdx) {
      const pkg = settings.packages.splice(arIdx, 1)[0];
      const targetCacheIdx = settings.packages.findIndex((p: string) =>
        typeof p === "string" && p.includes("pi-cache-optimizer")
      );
      settings.packages.splice(targetCacheIdx, 0, pkg);
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
      return true;
    }
  } catch {}
  return false;
}

const initialConfig = loadConfig();
let currentApiKey = normalizeApiKey(process.env.AGENTROUTER_API_KEY || initialConfig.apiKey || "");
let minIntervalMs = initialConfig.minIntervalMs ?? 2500;
let lastRequestEndTime = 0;

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
    lastRequestEndTime = Date.now();

    const order = getPackageOrderState();
    if (order.needsFix && ctx.hasUI && typeof (ctx.ui as any).confirm === "function") {
      try {
        const confirmed = await (ctx.ui as any).confirm(
          "Pi AgentRouter Package Priority",
          "@madgagarin/pi-agentrouter is listed AFTER pi-cache-optimizer in settings.json packages.\n\n" +
          "It must be placed before pi-cache-optimizer so prompt cache bypass takes effect before cache-optimizer transforms the prompt.\n\n" +
          "Move @madgagarin/pi-agentrouter directly above pi-cache-optimizer in settings.json?"
        );
        if (confirmed) {
          const success = fixPackagePriorityInSettings();
          if (success) {
            ctx.ui.notify("@madgagarin/pi-agentrouter moved above pi-cache-optimizer in settings.json. Please restart Pi for changes to take full effect.", "info");
          }
        }
      } catch {}
    }
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
    const elapsed = now - lastRequestEndTime;

    if (lastRequestEndTime > 0 && elapsed < minIntervalMs) {
      const waitMs = minIntervalMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  });

  pi.on("turn_end", async (_event, ctx) => {
    const model = ctx.model;
    if (isAgentRouter(model?.provider, (model as any)?.baseUrl)) {
      lastRequestEndTime = Date.now();
    }
  });

  pi.on("agent_end", async (_event, ctx) => {
    const model = ctx.model;
    if (isAgentRouter(model?.provider, (model as any)?.baseUrl)) {
      lastRequestEndTime = Date.now();
    }
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

      if (action === "fix-order" || action === "order") {
        const order = getPackageOrderState();
        if (!order.needsFix) {
          if (order.cacheOptimizerIndex === -1) {
            ctx.ui.notify("pi-cache-optimizer is not installed in settings.json. Package order is optimal.", "info");
          } else if (order.agentRouterIndex !== -1 && order.agentRouterIndex < order.cacheOptimizerIndex) {
            ctx.ui.notify("@madgagarin/pi-agentrouter is already placed before pi-cache-optimizer (Optimal).", "info");
          } else {
            ctx.ui.notify("@madgagarin/pi-agentrouter was not found in settings.json packages.", "warning");
          }
          return;
        }
        const success = fixPackagePriorityInSettings();
        if (success) {
          ctx.ui.notify("@madgagarin/pi-agentrouter moved directly above pi-cache-optimizer in settings.json. Please restart Pi for changes to take full effect.", "info");
        } else {
          ctx.ui.notify("Failed to update settings.json.", "error");
        }
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
      const order = getPackageOrderState();
      let priorityStatus = "Optimal";
      if (order.needsFix) {
        priorityStatus = "Listed AFTER pi-cache-optimizer (Run: /agentrouter fix-order)";
      } else if (order.cacheOptimizerIndex !== -1 && order.agentRouterIndex < order.cacheOptimizerIndex) {
        priorityStatus = "Before pi-cache-optimizer (Optimal)";
      } else if (order.agentRouterIndex !== -1) {
        priorityStatus = "Active (Optimal)";
      } else {
        priorityStatus = "Not in packages";
      }

      ctx.ui.notify(
        `[AgentRouter Plugin]\n` +
        `- Active model: ${activeModel?.id || "none"} (${isAR ? "AgentRouter [yes]" : "Other Provider"})\n` +
        `- Package Priority: ${priorityStatus}\n` +
        `- API Key: ${maskedKey}\n` +
        `- Caching: Enabled (Prompt Cache + Session Affinity + Adaptive Thinking)\n` +
        `- Pacing Interval: ${minIntervalMs} ms (Measured from turn completion)\n` +
        `- Commands:\n` +
        `   /agentrouter key <key>   (update API key)\n` +
        `   /agentrouter pacing <ms> (set request delay after completion)\n` +
        `   /agentrouter fix-order   (move plugin above pi-cache-optimizer in settings.json)`,
        "info"
      );
    },
  });
}
