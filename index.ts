import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";
import * as fs from "fs";
import * as path from "path";

const CONFIG_FILE = path.join(process.env.HOME || "", ".pi/agent/agentrouter.json");
const SETTINGS_FILE = path.join(process.env.HOME || "", ".pi/agent/settings.json");
const PACING_FILE = path.join(process.env.HOME || "", ".pi/agent/.agentrouter-pacing");
const MODELS_CACHE_FILE = path.join(process.env.HOME || "", ".pi/agent/.agentrouter-models-cache.json");

export interface AgentRouterConfig {
  apiKey?: string;
  minIntervalMs?: number;
}

export interface ModelSpec {
  id: string;
  name: string;
  providerType: "openai" | "anthropic";
  contextWindow: number;
  maxTokens: number;
  reasoning: boolean;
  compat?: Record<string, any>;
  cost?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
}

export interface ApiPricingModel {
  model_name: string;
  quota_type: number;
  model_ratio: number;
  model_price: number;
  owner_by?: string;
  completion_ratio: number;
  enable_groups: string[];
  supported_endpoint_types: string[];
}

export const KNOWN_MODEL_SPECS: Record<string, ModelSpec> = {
  "deepseek-v4-flash": {
    id: "deepseek-v4-flash",
    name: "deepseek-v4-flash",
    providerType: "openai",
    contextWindow: 1048576,
    maxTokens: 65536,
    reasoning: true,
    compat: { sendSessionAffinityHeaders: true },
    cost: { input: 2.0 / 1_000_000, output: 6.0 / 1_000_000, cacheRead: 0, cacheWrite: 0 },
  },
  "deepseek-v4f": {
    id: "deepseek-v4f",
    name: "deepseek-v4f",
    providerType: "openai",
    contextWindow: 1048576,
    maxTokens: 65536,
    reasoning: true,
    compat: { sendSessionAffinityHeaders: true },
    cost: { input: 2.0 / 1_000_000, output: 6.0 / 1_000_000, cacheRead: 0, cacheWrite: 0 },
  },
  "glm-5.3": {
    id: "glm-5.3",
    name: "glm-5.3",
    providerType: "openai",
    contextWindow: 1048576,
    maxTokens: 131072,
    reasoning: true,
    compat: { sendSessionAffinityHeaders: true },
    cost: { input: 3.0 / 1_000_000, output: 12.0 / 1_000_000, cacheRead: 0, cacheWrite: 0 },
  },
  "glm-5.2": {
    id: "glm-5.2",
    name: "glm-5.2",
    providerType: "openai",
    contextWindow: 1048576,
    maxTokens: 131072,
    reasoning: true,
    compat: { sendSessionAffinityHeaders: true },
    cost: { input: 3.0 / 1_000_000, output: 12.0 / 1_000_000, cacheRead: 0, cacheWrite: 0 },
  },
  "gpt-5.6-sol": {
    id: "gpt-5.6-sol",
    name: "gpt-5.6-sol",
    providerType: "openai",
    contextWindow: 1048576,
    maxTokens: 131072,
    reasoning: true,
    compat: { sendSessionAffinityHeaders: true },
    cost: { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000, cacheRead: 0, cacheWrite: 0 },
  },
  "gpt-5.5": {
    id: "gpt-5.5",
    name: "gpt-5.5",
    providerType: "openai",
    contextWindow: 1048576,
    maxTokens: 131072,
    reasoning: true,
    compat: { sendSessionAffinityHeaders: true },
    cost: { input: 4.0 / 1_000_000, output: 8.0 / 1_000_000, cacheRead: 0, cacheWrite: 0 },
  },
  "claude-opus-4-8": {
    id: "claude-opus-4-8",
    name: "claude-opus-4-8",
    providerType: "anthropic",
    contextWindow: 1048576,
    maxTokens: 65536,
    reasoning: true,
    compat: {
      forceAdaptiveThinking: true,
      allowEmptySignature: true,
      sendSessionAffinityHeaders: true,
      supportsEagerToolInputStreaming: false,
    },
    cost: { input: 8.0 / 1_000_000, output: 40.0 / 1_000_000, cacheRead: 0, cacheWrite: 0 },
  },
  "claude-opus-5": {
    id: "claude-opus-5",
    name: "claude-opus-5",
    providerType: "anthropic",
    contextWindow: 1048576,
    maxTokens: 65536,
    reasoning: true,
    compat: {
      forceAdaptiveThinking: true,
      allowEmptySignature: true,
      sendSessionAffinityHeaders: true,
      supportsEagerToolInputStreaming: false,
    },
    cost: { input: 8.0 / 1_000_000, output: 40.0 / 1_000_000, cacheRead: 0, cacheWrite: 0 },
  },
  "claude-opus-4-7": {
    id: "claude-opus-4-7",
    name: "claude-opus-4-7",
    providerType: "anthropic",
    contextWindow: 1048576,
    maxTokens: 65536,
    reasoning: true,
    compat: {
      forceAdaptiveThinking: true,
      allowEmptySignature: true,
      sendSessionAffinityHeaders: true,
      supportsEagerToolInputStreaming: false,
    },
    cost: { input: 8.0 / 1_000_000, output: 40.0 / 1_000_000, cacheRead: 0, cacheWrite: 0 },
  },
  "claude-opus-4-6": {
    id: "claude-opus-4-6",
    name: "claude-opus-4-6",
    providerType: "anthropic",
    contextWindow: 1048576,
    maxTokens: 65536,
    reasoning: true,
    compat: {
      forceAdaptiveThinking: true,
      allowEmptySignature: true,
      sendSessionAffinityHeaders: true,
      supportsEagerToolInputStreaming: false,
    },
    cost: { input: 2.0 / 1_000_000, output: 10.0 / 1_000_000, cacheRead: 0, cacheWrite: 0 },
  },
};

export function loadConfig(): AgentRouterConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      if (cfg.apiKey) return cfg;
    }
    const authPath = path.join(process.env.HOME || "", ".pi/agent/auth.json");
    if (fs.existsSync(authPath)) {
      const auth = JSON.parse(fs.readFileSync(authPath, "utf-8"));
      const key = auth["agentrouter-openai"]?.key || auth["agentrouter-clode"]?.key;
      if (key) return { apiKey: key };
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

    if (cfg.apiKey) {
      const authPath = path.join(process.env.HOME || "", ".pi/agent/auth.json");
      let auth: Record<string, any> = {};
      if (fs.existsSync(authPath)) {
        try {
          auth = JSON.parse(fs.readFileSync(authPath, "utf-8"));
        } catch {}
      }
      auth["agentrouter-openai"] = { type: "api_key", key: cfg.apiKey };
      auth["agentrouter-clode"] = { type: "api_key", key: cfg.apiKey };
      auth["anthropic"] = { type: "api_key", key: cfg.apiKey };
      fs.writeFileSync(authPath, JSON.stringify(auth, null, 2), "utf-8");
    }
  } catch {}
}

export function normalizeApiKey(key?: string): string {
  if (!key) return "";
  return key.trim().replace(/^["']|["']$/g, "").trim();
}

export function loadCachedPricing(): ApiPricingModel[] | null {
  try {
    if (fs.existsSync(MODELS_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(MODELS_CACHE_FILE, "utf-8"));
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch {}
  return null;
}

export function saveCachedPricing(models: ApiPricingModel[]): void {
  try {
    const dir = path.dirname(MODELS_CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(MODELS_CACHE_FILE, JSON.stringify(models, null, 2), "utf-8");
  } catch {}
}

export function getPackageOrderState(): { agentRouterIndex: number; cacheOptimizerIndex: number; needsFix: boolean } {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      return { agentRouterIndex: -1, cacheOptimizerIndex: -1, needsFix: false };
    }
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    if (!Array.isArray(settings.packages)) {
      return { agentRouterIndex: -1, cacheOptimizerIndex: -1, needsFix: false };
    }
    const arIdx = settings.packages.findIndex(
      (p: string) => typeof p === "string" && (p.includes("@madgagarin/pi-agentrouter") || p.includes("pi-agentrouter"))
    );
    const cacheIdx = settings.packages.findIndex((p: string) => typeof p === "string" && p.includes("pi-cache-optimizer"));
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
    const arIdx = settings.packages.findIndex(
      (p: string) => typeof p === "string" && (p.includes("@madgagarin/pi-agentrouter") || p.includes("pi-agentrouter"))
    );
    const cacheIdx = settings.packages.findIndex((p: string) => typeof p === "string" && p.includes("pi-cache-optimizer"));
    if (cacheIdx !== -1 && arIdx !== -1 && arIdx > cacheIdx) {
      const pkg = settings.packages.splice(arIdx, 1)[0];
      const targetCacheIdx = settings.packages.findIndex(
        (p: string) => typeof p === "string" && p.includes("pi-cache-optimizer")
      );
      settings.packages.splice(targetCacheIdx, 0, pkg);
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
      return true;
    }
  } catch {}
  return false;
}

export function getLastRequestEndTime(): number {
  try {
    if (fs.existsSync(PACING_FILE)) {
      const val = parseInt(fs.readFileSync(PACING_FILE, "utf-8").trim(), 10);
      if (!isNaN(val)) return val;
    }
  } catch {}
  return 0;
}

export function setLastRequestEndTime(ts: number): void {
  try {
    const dir = path.dirname(PACING_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PACING_FILE, String(ts), "utf-8");
  } catch {}
}

export function isAgentRouter(providerName?: string, baseUrl?: string): boolean {
  if (providerName && providerName.toLowerCase().includes("agentrouter")) return true;
  if (baseUrl && baseUrl.toLowerCase().includes("agentrouter.org")) return true;
  return false;
}

export const CANONICAL_PI_HEADER =
  "You are an expert coding assistant operating inside pi, a coding agent harness. You help users by reading files, executing commands, editing code, and writing new files.";

export function enforceCanonicalRootPrompt(systemPrompt: string | any[] | undefined): string | any[] {
  if (!systemPrompt) {
    return CANONICAL_PI_HEADER;
  }

  if (typeof systemPrompt === "string") {
    const text = systemPrompt.trim();
    const piHeaderRegex = /(?:You are [^\n\r]*operating inside pi[^\n\r]*\n?|You are (?:pi|Pi)[^\n\r]*\n?)/i;

    if (piHeaderRegex.test(text)) {
      const match = text.match(piHeaderRegex);
      if (match && match.index !== undefined && match.index > 0) {
        const header = match[0].trim();
        const prefix = text.slice(0, match.index).trim();
        const rest = text.slice(match.index + match[0].length).trim();
        return `${header}\n\n${prefix}${rest ? "\n\n" + rest : ""}`;
      }
      return text;
    } else {
      return `${CANONICAL_PI_HEADER}\n\n${text}`;
    }
  }

  if (Array.isArray(systemPrompt)) {
    if (systemPrompt.length === 0) {
      return [{ type: "text", text: CANONICAL_PI_HEADER }];
    }
    const firstBlock = systemPrompt[0];
    if (firstBlock && typeof firstBlock.text === "string") {
      firstBlock.text = enforceCanonicalRootPrompt(firstBlock.text) as string;
    }
    return systemPrompt;
  }

  return systemPrompt;
}

export async function fetchLivePricing(): Promise<ApiPricingModel[] | null> {
  try {
    const res = await fetch("https://agentrouter.org/api/pricing", {
      headers: { "User-Agent": "pi-code" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && Array.isArray(data.data) && data.data.length > 0) {
      return data.data;
    }
  } catch {}
  return null;
}

export async function fetchTokenUsage(apiKey: string): Promise<number | null> {
  if (!apiKey) return null;
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;
    const res = await fetch(
      `https://agentrouter.org/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "User-Agent": "pi-code",
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data && typeof data.total_usage === "number") {
      return data.total_usage;
    }
  } catch {}
  return null;
}

export interface ModelProbeResult {
  model: string;
  status: "READY" | "QUOTA_EXHAUSTED" | "FORBIDDEN" | "ERROR";
  code: number;
  message?: string;
}

export async function probeModelQuota(modelId: string, apiKey: string, isAnthropic: boolean): Promise<ModelProbeResult> {
  const url = isAnthropic ? "https://agentrouter.org/v1/messages" : "https://agentrouter.org/v1/chat/completions";
  const headers = isAnthropic
    ? {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "User-Agent": "pi-code",
      }
    : {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "pi-code",
      };

  const body = isAnthropic
    ? {
        model: modelId,
        system: CANONICAL_PI_HEADER,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }
    : {
        model: modelId,
        messages: [
          { role: "system", content: CANONICAL_PI_HEADER },
          { role: "user", content: "ping" },
        ],
        max_tokens: 1,
      };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (res.ok) {
      return { model: modelId, status: "READY", code: res.status };
    }

    const data = await res.json().catch(() => ({}));
    const msg = data.error?.message || data.message || "";

    if (res.status === 402 || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("exhausted")) {
      return { model: modelId, status: "QUOTA_EXHAUSTED", code: 402, message: msg };
    }
    if (res.status === 403) {
      return { model: modelId, status: "FORBIDDEN", code: 403, message: msg };
    }
    return { model: modelId, status: "ERROR", code: res.status, message: msg };
  } catch (err: any) {
    return { model: modelId, status: "ERROR", code: 0, message: err.message };
  }
}

export default function (pi: ExtensionAPI) {
  function getEffectiveApiKey(): string {
    const cfg = loadConfig();
    return normalizeApiKey(process.env.AGENTROUTER_API_KEY || process.env.AGENT_ROUTER_API_KEY || cfg.apiKey || "");
  }

  const initialConfig = loadConfig();
  let currentApiKey = getEffectiveApiKey();
  let minIntervalMs = initialConfig.minIntervalMs ?? 3500;

  function buildModelsFromPricing(apiPricing: ApiPricingModel[] | null): {
    openaiModels: any[];
    claudeModels: any[];
    newModels: string[];
  } {
    const openaiModels: any[] = [];
    const claudeModels: any[] = [];
    const newModels: string[] = [];
    const processed = new Set<string>();

    if (apiPricing && apiPricing.length > 0) {
      for (const item of apiPricing) {
        const id = item.model_name;
        processed.add(id);
        const spec = KNOWN_MODEL_SPECS[id];

        const inCost = (item.model_ratio * 2.0) / 1_000_000;
        const outCost = (item.model_ratio * item.completion_ratio * 2.0) / 1_000_000;

        if (spec) {
          const modelObj = {
            id: spec.id,
            name: spec.name,
            reasoning: spec.reasoning,
            input: ["text"],
            contextWindow: spec.contextWindow,
            maxTokens: spec.maxTokens,
            cost: { input: inCost, output: outCost, cacheRead: 0, cacheWrite: 0 },
            compat: spec.compat || { sendSessionAffinityHeaders: true },
          };
          if (spec.providerType === "anthropic") {
            claudeModels.push(modelObj);
          } else {
            openaiModels.push(modelObj);
          }
        } else {
          newModels.push(id);
          const isAnthropic =
            item.supported_endpoint_types.includes("anthropic") && !item.supported_endpoint_types.includes("openai");
          const modelObj = {
            id,
            name: id,
            reasoning: true,
            input: ["text"],
            contextWindow: 131072,
            maxTokens: 16384,
            cost: { input: inCost, output: outCost, cacheRead: 0, cacheWrite: 0 },
            compat: isAnthropic
              ? {
                  forceAdaptiveThinking: true,
                  allowEmptySignature: true,
                  sendSessionAffinityHeaders: true,
                }
              : {
                  sendSessionAffinityHeaders: true,
                },
          };
          if (isAnthropic) {
            claudeModels.push(modelObj);
          } else {
            openaiModels.push(modelObj);
          }
        }
      }
    }

    for (const [id, spec] of Object.entries(KNOWN_MODEL_SPECS)) {
      if (!processed.has(id)) {
        const modelObj = {
          id: spec.id,
          name: spec.name,
          reasoning: spec.reasoning,
          input: ["text"],
          contextWindow: spec.contextWindow,
          maxTokens: spec.maxTokens,
          cost: spec.cost || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          compat: spec.compat || { sendSessionAffinityHeaders: true },
        };
        if (spec.providerType === "anthropic") {
          claudeModels.push(modelObj);
        } else {
          openaiModels.push(modelObj);
        }
      }
    }

    return { openaiModels, claudeModels, newModels };
  }

  function registerAgentRouterProviders(apiKey: string, pricingData: ApiPricingModel[] | null): string[] {
    const { openaiModels, claudeModels, newModels } = buildModelsFromPricing(pricingData);

    pi.registerProvider("agentrouter-openai", {
      name: "AgentRouter OpenAI",
      baseUrl: "https://agentrouter.org/v1",
      apiKey,
      api: "openai-completions",
      compat: {
        sendSessionAffinityHeaders: true,
      },
      models: openaiModels,
    });

    pi.registerProvider("agentrouter-clode", {
      name: "AgentRouter Claude",
      baseUrl: "https://agentrouter.org",
      apiKey,
      api: "anthropic-messages",
      compat: {
        forceAdaptiveThinking: true,
        allowEmptySignature: true,
        sendSessionAffinityHeaders: true,
        supportsEagerToolInputStreaming: false,
      },
      models: claudeModels,
    });

    return newModels;
  }

  const cachedPricing = loadCachedPricing();
  registerAgentRouterProviders(currentApiKey, cachedPricing);

  function updatePromptRewriteEnvForModel(model?: any): void {
    if (isAgentRouter(model?.provider, model?.baseUrl)) {
      process.env.PI_CACHE_OPTIMIZER_NO_PROMPT_REWRITE = "1";
    } else {
      delete process.env.PI_CACHE_OPTIMIZER_NO_PROMPT_REWRITE;
    }
  }

  pi.on("before_provider_request", async (event, ctx) => {
    const provider = ((event as any)?.model?.provider || ctx?.model?.provider || "").toLowerCase();
    const baseUrl = (event as any)?.model?.baseUrl || (ctx?.model as any)?.baseUrl || "";

    if (isAgentRouter(provider, baseUrl)) {
      const lastEnd = getLastRequestEndTime();
      const now = Date.now();
      const elapsed = now - lastEnd;
      if (lastEnd > 0 && elapsed < minIntervalMs) {
        const waitMs = minIntervalMs - elapsed;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }

      const payload = event.payload;
      if (payload) {
        if (payload.system !== undefined) {
          payload.system = enforceCanonicalRootPrompt(payload.system);
        }
        if (Array.isArray(payload.messages) && payload.messages.length > 0) {
          for (const msg of payload.messages) {
            if (msg && msg.role === "developer") {
              msg.role = "system";
            }
          }
          const firstMsg = payload.messages[0];
          if (firstMsg && (firstMsg.role === "system" || firstMsg.role === "developer")) {
            firstMsg.role = "system";
            if (typeof firstMsg.content === "string") {
              firstMsg.content = enforceCanonicalRootPrompt(firstMsg.content);
            } else if (Array.isArray(firstMsg.content)) {
              firstMsg.content = enforceCanonicalRootPrompt(firstMsg.content);
            }
          }
        }
      }
    }
    return undefined;
  });

  pi.on("message_end", async (_event, ctx) => {
    const model = ctx?.model;
    if (isAgentRouter(model?.provider, (model as any)?.baseUrl)) {
      setLastRequestEndTime(Date.now());
    }
  });

  pi.on("turn_end", async (_event, ctx) => {
    const model = ctx?.model;
    if (isAgentRouter(model?.provider, (model as any)?.baseUrl)) {
      setLastRequestEndTime(Date.now());
    }
  });

  pi.on("agent_end", async (_event, ctx) => {
    const model = ctx?.model;
    if (isAgentRouter(model?.provider, (model as any)?.baseUrl)) {
      setLastRequestEndTime(Date.now());
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    currentApiKey = getEffectiveApiKey();
    updatePromptRewriteEnvForModel(ctx.model);
    setLastRequestEndTime(Date.now());

    fetchLivePricing().then((livePricing) => {
      if (livePricing) {
        saveCachedPricing(livePricing);
        const newModels = registerAgentRouterProviders(currentApiKey, livePricing);
        if (newModels.length > 0 && ctx.hasUI) {
          ctx.ui.notify(
            `[AgentRouter] Discovered new models on gateway: ${newModels.join(", ")}.\n` +
              `Auto-registered with safe default limits (128K context). Check settings.json or await plugin update for optimized specs.`,
            "info"
          );
        }
      }
    });

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
            ctx.ui.notify(
              "@madgagarin/pi-agentrouter moved above pi-cache-optimizer in settings.json. Please restart Pi for changes to take full effect.",
              "info"
            );
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

    const lastEnd = getLastRequestEndTime();
    const now = Date.now();
    const elapsed = now - lastEnd;

    if (lastEnd > 0 && elapsed < minIntervalMs) {
      const waitMs = minIntervalMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
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
      setLastRequestEndTime(Date.now());

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
    description: "Manage AgentRouter plugin settings, live quotas, and pricing (/agentrouter check, /agentrouter pricing)",
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
        registerAgentRouterProviders(cleanKey, loadCachedPricing());
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
          ctx.ui.notify(
            "@madgagarin/pi-agentrouter moved directly above pi-cache-optimizer in settings.json. Please restart Pi for changes to take full effect.",
            "info"
          );
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

      if (action === "pricing" || action === "price" || action === "models") {
        ctx.ui.notify("Fetching live pricing from AgentRouter API...", "info");
        const live = await fetchLivePricing();
        if (live) {
          saveCachedPricing(live);
          registerAgentRouterProviders(currentApiKey, live);
        }
        const pricing = live || loadCachedPricing() || [];
        if (pricing.length === 0) {
          ctx.ui.notify("Unable to fetch pricing from AgentRouter API. Check internet connection.", "error");
          return;
        }

        let tableText =
          `[AgentRouter Official Pricing]\n` +
          `Live rates calculated from AgentRouter gateway API (1.0x ratio = $2.00/1M tokens):\n\n` +
          `Model                 Input / 1M   Output / 1M   Ratio (In/Out)   Protocol\n` +
          `------------------------------------------------------------------------\n`;

        for (const item of pricing) {
          const inPrice = `$${(item.model_ratio * 2.0).toFixed(2)}`;
          const outPrice = `$${(item.model_ratio * item.completion_ratio * 2.0).toFixed(2)}`;
          const ratio = `${item.model_ratio.toFixed(1)}x / ${item.completion_ratio.toFixed(1)}x`;
          const proto = item.supported_endpoint_types.join(", ");
          tableText += `${item.model_name.padEnd(21)} ${inPrice.padEnd(12)} ${outPrice.padEnd(13)} ${ratio.padEnd(16)} ${proto}\n`;
        }

        tableText +=
          `------------------------------------------------------------------------\n` +
          `* Output cost = Input ratio × completion ratio × $2.00. Zero hidden fees.`;

        ctx.ui.notify(tableText, "info");
        return;
      }

      if (action === "check" || action === "quota" || action === "status-live") {
        currentApiKey = getEffectiveApiKey();
        if (!currentApiKey) {
          ctx.ui.notify("No API key configured. Set one with /agentrouter key <your-key>", "error");
          return;
        }

        ctx.ui.notify("Probing live model quotas and balance from AgentRouter...", "info");
        const [usageUsd, pricingList] = await Promise.all([fetchTokenUsage(currentApiKey), fetchLivePricing()]);
        if (pricingList) {
          saveCachedPricing(pricingList);
        }

        const modelsToProbe = pricingList
          ? pricingList.map((p) => ({
              id: p.model_name,
              isAnthropic: p.supported_endpoint_types.includes("anthropic") && !p.supported_endpoint_types.includes("openai"),
            }))
          : [
              { id: "deepseek-v4-flash", isAnthropic: false },
              { id: "glm-5.3", isAnthropic: false },
              { id: "gpt-5.6-sol", isAnthropic: false },
              { id: "claude-opus-4-8", isAnthropic: true },
              { id: "claude-opus-5", isAnthropic: true },
            ];

        const probeResults = await Promise.all(
          modelsToProbe.map((m) => probeModelQuota(m.id, currentApiKey, m.isAnthropic))
        );

        let report = `[AgentRouter Live Quota & Health]\n`;
        if (usageUsd !== null) {
          report += `- Total Spent (Current Month): $${usageUsd.toFixed(4)} USD\n\n`;
        } else {
          report += `- Token status: Active\n\n`;
        }

        report += `Model Status:\n`;
        for (const res of probeResults) {
          if (res.status === "READY") {
            report += `  🟢 ${res.model.padEnd(20)}: Ready (200 OK - Quota available)\n`;
          } else if (res.status === "QUOTA_EXHAUSTED") {
            report += `  ⏳ ${res.model.padEnd(20)}: Batch Quota Exhausted (402) - Next batch drop soon\n`;
          } else if (res.status === "FORBIDDEN") {
            report += `  🔴 ${res.model.padEnd(20)}: Forbidden (403) - Token has no permissions\n`;
          } else {
            report += `  ⚠️ ${res.model.padEnd(20)}: Error (${res.code}) ${res.message ? "- " + res.message : ""}\n`;
          }
        }

        report +=
          `\nTip: Claude and GPT models use daily batch quotas. If exhausted, switch to DeepSeek V4 or GLM 5.3 which have unlimited availability.`;

        ctx.ui.notify(report, "info");
        return;
      }

      currentApiKey = getEffectiveApiKey();
      const maskedKey =
        currentApiKey.length > 8 ? `${currentApiKey.slice(0, 7)}...${currentApiKey.slice(-4)}` : "not set";
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
        `[AgentRouter Plugin v2.0.0]\n` +
          `- Active model: ${activeModel?.id || "none"} (${isAR ? "AgentRouter [yes]" : "Other Provider"})\n` +
          `- Package Priority: ${priorityStatus}\n` +
          `- API Key: ${maskedKey}\n` +
          `- Caching & Pacing: Enabled (${minIntervalMs} ms delay)\n` +
          `- Commands:\n` +
          `   /agentrouter check        (probe live batch quotas & spending)\n` +
          `   /agentrouter pricing      (fetch live pricing table $/1M)\n` +
          `   /agentrouter key <key>    (update API key)\n` +
          `   /agentrouter pacing <ms>  (adjust rate limit delay)\n` +
          `   /agentrouter fix-order    (move plugin above pi-cache-optimizer)`,
        "info"
      );
    },
  });
}
