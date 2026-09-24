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
  "gpt-6-astra": {
    id: "gpt-6-astra",
    name: "gpt-6-astra",
    providerType: "openai",
    contextWindow: 1048576,
    maxTokens: 131072,
    reasoning: true,
    compat: { sendSessionAffinityHeaders: true },
    cost: { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000, cacheRead: 0, cacheWrite: 0 },
  },
  "deepseek-v4-flash": {
    id: "deepseek-v4-flash",
    name: "deepseek-v4-flash",
    providerType: "openai",
    contextWindow: 1048576,
    maxTokens: 65536,
    reasoning: true,
    compat: { sendSessionAffinityHeaders: true },
    cost: { input: 4.0 / 1_000_000, output: 12.0 / 1_000_000, cacheRead: 2.0 / 1_000_000, cacheWrite: 0 },
  },
  "deepseek-v4f": {
    id: "deepseek-v4f",
    name: "deepseek-v4f",
    providerType: "openai",
    contextWindow: 1048576,
    maxTokens: 65536,
    reasoning: true,
    compat: { sendSessionAffinityHeaders: true },
    cost: { input: 4.0 / 1_000_000, output: 12.0 / 1_000_000, cacheRead: 2.0 / 1_000_000, cacheWrite: 0 },
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
    cost: { input: 6.0 / 1_000_000, output: 30.0 / 1_000_000, cacheRead: 0, cacheWrite: 0 },
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

export const FLAGSHIP_MODELS: string[] = [
  "agentrouter-openai/deepseek-v4-flash",
  "agentrouter-openai/gpt-6-astra",
  "agentrouter-openai/gpt-5.6-sol",
  "agentrouter-clode/claude-opus-5",
  "agentrouter-clode/claude-opus-4-8",
];

export function syncEnabledModelsInSettings(): { added: string[]; count: number } {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return { added: [], count: 0 };
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    if (!Array.isArray(settings.enabledModels)) return { added: [], count: 0 };

    const added: string[] = [];
    for (const m of FLAGSHIP_MODELS) {
      if (!settings.enabledModels.includes(m)) {
        settings.enabledModels.push(m);
        added.push(m);
      }
    }
    if (added.length > 0) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
    }
    return { added, count: settings.enabledModels.length };
  } catch {
    return { added: [], count: 0 };
  }
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

export function isDeepSeekRequest(event: any, ctx: any): boolean {
  const modelId = (
    (event as any)?.model?.id ||
    (ctx as any)?.model?.id ||
    (event as any)?.payload?.model ||
    ""
  ).toLowerCase();
  return modelId.includes("deepseek");
}
export const WAF_BLOCK_RE = /sensitive[_ ]words?[_ ]detected|content-blocked/i;
export const SENSITIVE_WORDS_RE = /sensitive[_ ]words?[_ ]detected/i;
export const REDACTED_NOTE = "[Message withheld by local policy]";

export function cleanJsonSchemaObject(schema: any): void {
  if (!schema || typeof schema !== "object") return;

  if (schema.type === "object" || schema.properties) {
    if (schema.required === null || schema.required === undefined || !Array.isArray(schema.required)) {
      schema.required = [];
    }
  }

  if (schema.properties && typeof schema.properties === "object") {
    for (const [propName, propDef] of Object.entries(schema.properties)) {
      if (propDef && typeof propDef === "object") {
        cleanJsonSchemaObject(propDef);
      }
    }
  }

  if (schema.items) {
    if (typeof schema.items === "object") {
      cleanJsonSchemaObject(schema.items);
    } else if (schema.items === null) {
      delete schema.items;
    }
  }
}

export function sanitizeOpenAiTools(tools: any[]): void {
  if (!Array.isArray(tools)) return;
  for (const tool of tools) {
    if (!tool || typeof tool !== "object") continue;
    const fn = tool.function || tool;
    if (fn.parameters && typeof fn.parameters === "object") {
      cleanJsonSchemaObject(fn.parameters);
    }
  }
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export const redactSet = new Set<string>();
export let escalatePending = false;
export let isSensitiveBlock = false;
export let exhausted = false;
export let sessionAnchor: string | null = null;
export let wafNotified = false;

export function resetPoisonRedactionState(): void {
  redactSet.clear();
  escalatePending = false;
  isSensitiveBlock = false;
  exhausted = false;
  sessionAnchor = null;
  wafNotified = false;
}

export function triggerEscalation(sensitive: boolean = false): void {
  escalatePending = true;
  isSensitiveBlock = sensitive;
}


export function fingerprintOf(msg: Record<string, unknown>): string {
  const tc = Array.isArray(msg.tool_calls) ? JSON.stringify(msg.tool_calls).slice(0, 80) : "";
  if (msg.type === "function_call" || msg.type === "function_call_output") {
    return `${msg.type}:${(msg as any).call_id}:${JSON.stringify((msg as any).arguments ?? (msg as any).output ?? "").slice(0, 160)}`;
  }
  return `${msg.role ?? msg.type}:${JSON.stringify(msg.content ?? "").slice(0, 160)}:${tc}`;
}

export function firstUserAnchor(messages: unknown[]): string {
  for (const m of messages) {
    if (isRecord(m) && isHumanUserMessage(m as Record<string, unknown>)) return fingerprintOf(m);
  }
  return String(messages.length);
}

export function isTextBlock(block: Record<string, unknown>): boolean {
  return block.type === "text" || block.type === "input_text" || block.type === "output_text";
}

export function isHumanUserMessage(msg: Record<string, unknown>): boolean {
  if (msg.role !== "user") return false;
  if (typeof msg.content === "string") return true;
  if (Array.isArray(msg.content)) {
    const hasToolResult = msg.content.some((b) => isRecord(b) && b.type === "tool_result");
    const hasHumanText = msg.content.some(
      (b) =>
        isRecord(b) &&
        (b.type === "text" || b.type === "input_text") &&
        typeof b.text === "string" &&
        b.text.trim().length > 0 &&
        b.text !== REDACTED_NOTE
    );
    if (hasToolResult && !hasHumanText) return false;
    return true;
  }
  return false;
}

export function lastHumanUserIndex(messages: unknown[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isRecord(messages[i]) && isHumanUserMessage(messages[i] as Record<string, unknown>)) {
      return i;
    }
  }
  return -1;
}

export function hasRedactableText(content: unknown, msg?: Record<string, unknown>): boolean {
  if (msg) {
    if (msg.details && (typeof msg.details === "string" || Object.keys(msg.details).length > 0)) return true;
    if (typeof (msg as any).reasoning_content === "string" && (msg as any).reasoning_content.length > 0) return true;
    if (typeof (msg as any).thinking === "string" && (msg as any).thinking.length > 0) return true;
  }
  if (msg?.type === "function_call") return typeof (msg as any).arguments === "string" && (msg as any).arguments !== "{}";
  if (msg?.type === "function_call_output") return hasRedactableText((msg as any).output);
  if (typeof content === "string") return content.length > 0 && content !== REDACTED_NOTE;
  if (Array.isArray(content)) {
    for (const b of content) {
      if (!isRecord(b)) continue;
      if (b.type === "thinking" || b.type === "reasoning") return true;
      if (isTextBlock(b) && typeof b.text === "string" && b.text.length > 0 && b.text !== REDACTED_NOTE) return true;
      if (b.type === "tool_result") {
        if (typeof b.content === "string" && b.content.length > 0 && b.content !== REDACTED_NOTE) return true;
        if (Array.isArray(b.content)) {
          for (const c of b.content) {
            if (isRecord(c) && isTextBlock(c) && typeof c.text === "string" && c.text.length > 0 && c.text !== REDACTED_NOTE) {
              return true;
            }
          }
        }
      }
      if (b.type === "tool_use" && isRecord(b.input) && Object.keys(b.input).length > 0) {
        return true;
      }
      if (b.type === "toolCall" && isRecord(b.arguments) && Object.keys(b.arguments).length > 0) {
        return true;
      }
    }
  }
  if (msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
    for (const tc of msg.tool_calls) {
      if (isRecord(tc) && isRecord(tc.function) && typeof tc.function.arguments === "string" && tc.function.arguments !== "{}") {
        return true;
      }
    }
  }
  return false;
}

export function redactBlocks(content: unknown): void {
  if (!Array.isArray(content)) return;
  for (let idx = content.length - 1; idx >= 0; idx--) {
    const block = content[idx];
    if (!isRecord(block)) continue;

    // For thinking / reasoning blocks, keep a harmless placeholder rather than deleting,
    // because thinking models (like DeepSeek) strictly require thinking blocks to be present in multi-turn history
    if (block.type === "thinking" || block.type === "reasoning") {
      if (typeof (block as any).thinking === "string") {
        (block as any).thinking = "Thinking...";
      }
      if (typeof (block as any).text === "string") {
        (block as any).text = "Thinking...";
      }
      continue;
    }

    if (isTextBlock(block) && typeof block.text === "string") {
      block.text = REDACTED_NOTE;
    } else if (block.type === "tool_result") {
      if (typeof block.content === "string") {
        block.content = REDACTED_NOTE;
      } else if (Array.isArray(block.content)) {
        for (const b of block.content) {
          if (isRecord(b) && isTextBlock(b) && typeof b.text === "string") {
            b.text = REDACTED_NOTE;
          }
        }
      }
    } else if (block.type === "tool_use") {
      block.input = {};
    } else if (block.type === "toolCall") {
      block.arguments = {};
    }
  }
}

export function isHideable(msg: Record<string, unknown>): boolean {
  return (
    msg.role === "user" ||
    msg.role === "assistant" ||
    msg.role === "tool" ||
    msg.role === "toolResult" ||
    msg.type === "function_call" ||
    msg.type === "function_call_output"
  );
}

export function redactMessageAt(messages: unknown[], i: number): void {
  const msg = messages[i];
  if (!isRecord(msg)) return;

  // Clear tool result details / raw diffs / attachments
  if ("details" in msg) delete msg.details;
  // DeepSeek and reasoning models require reasoning_content/thinking to exist in thinking mode.
  // Never delete them completely; keep a sanitized minimal placeholder.
  if ("reasoning_content" in msg) {
    (msg as any).reasoning_content = "Thinking...";
  }
  if ("thinking" in msg) {
    (msg as any).thinking = "Thinking...";
  }

  if (msg.type === "function_call") {
    (msg as any).arguments = "{}";
    return;
  }
  if (msg.type === "function_call_output") {
    if (typeof (msg as any).output === "string") (msg as any).output = REDACTED_NOTE;
    else redactBlocks((msg as any).output);
    return;
  }
  if (typeof msg.content === "string") {
    msg.content = REDACTED_NOTE;
  } else if (Array.isArray(msg.content)) {
    redactBlocks(msg.content);
    if (msg.content.length === 0 && !Array.isArray(msg.tool_calls)) {
      msg.content = [{ type: "text", text: REDACTED_NOTE }];
    }
  } else if (msg.role === "tool" || msg.role === "toolResult" || msg.role === "assistant") {
    msg.content = REDACTED_NOTE;
  }
  if (Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      if (isRecord(tc) && isRecord(tc.function) && typeof tc.function.arguments === "string") {
        tc.function.arguments = "{}";
      }
    }
  }
}

export function applyPoisonRedaction(payload: Record<string, unknown>): void {
  const messages = Array.isArray(payload.messages) ? payload.messages : (payload as any).input;
  if (!Array.isArray(messages) || messages.length === 0) return;

  // Prune failed assistant messages carrying error status/text in-place so dead error turns do not linger
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!isRecord(m)) continue;
    if (m.role === "assistant") {
      if (m.stopReason === "error") {
        messages.splice(i, 1);
      } else if (typeof m.content === "string" && WAF_BLOCK_RE.test(m.content)) {
        messages.splice(i, 1);
      }
    }
  }

  const fps = messages.map((m) => (isRecord(m) ? fingerprintOf(m) : ""));

  const anchor = firstUserAnchor(messages);
  if (anchor !== sessionAnchor) {
    const firstContact = sessionAnchor === null;
    sessionAnchor = anchor;
    if (!firstContact) {
      redactSet.clear();
      escalatePending = false;
      isSensitiveBlock = false;
      exhausted = false;
      wafNotified = false;
    }
  }

  if (redactSet.size > 0 && !fps.some((fp) => fp && redactSet.has(fp))) {
    redactSet.clear();
  }

  const lastHumanUser = lastHumanUserIndex(messages);

  for (let i = 0; i < messages.length; i++) {
    if (i === lastHumanUser) continue;
    if (!isRecord(messages[i]) || !isHideable(messages[i] as Record<string, unknown>)) continue;
    if (redactSet.has(fps[i])) redactMessageAt(messages, i);
  }

  if (escalatePending) {
    escalatePending = false;
    const sensitive = isSensitiveBlock;
    isSensitiveBlock = false;

    if (sensitive) {
      // Sensitive words detected: neutralize ALL turns (older user, tool, assistant, active tool results) except active human user
      for (let i = 0; i < messages.length; i++) {
        if (i === lastHumanUser) continue;
        if (!isRecord(messages[i])) continue;
        const m = messages[i] as Record<string, unknown>;
        if (!isHideable(m)) continue;
        redactSet.add(fps[i]);
        if (hasRedactableText(m.content, m)) {
          redactMessageAt(messages, i);
        }
      }
    } else {
      // Language ratio block: Stage 1 older user turns, Stage 2 assistant & tool
      let anyRedacted = false;
      for (let i = 0; i < messages.length; i++) {
        if (i === lastHumanUser) continue;
        if (!isRecord(messages[i])) continue;
        const m = messages[i] as Record<string, unknown>;
        if (m.role !== "user") continue;
        if (redactSet.has(fps[i])) continue;
        redactSet.add(fps[i]);
        if (hasRedactableText(m.content, m)) {
          redactMessageAt(messages, i);
          anyRedacted = true;
        }
      }
      if (!anyRedacted) {
        for (let i = 0; i < messages.length; i++) {
          if (i === lastHumanUser) continue;
          if (!isRecord(messages[i])) continue;
          const m = messages[i] as Record<string, unknown>;
          if (!isHideable(m) || m.role === "user") continue;
          if (redactSet.has(fps[i])) continue;
          redactSet.add(fps[i]);
          if (hasRedactableText(m.content, m)) {
            redactMessageAt(messages, i);
            anyRedacted = true;
          }
        }
      }
    }
  }

  // Exhausted if there are no more hideable messages left to redact other than lastHumanUser
  exhausted = true;
  for (let i = 0; i < messages.length; i++) {
    if (i === lastHumanUser) continue;
    if (!isRecord(messages[i]) || !isHideable(messages[i] as Record<string, unknown>)) continue;
    if (!redactSet.has(fps[i])) {
      exhausted = false;
      break;
    }
  }
}

export function normalizeMessagesForAgentRouter(messages: any[], isDeepSeek: boolean = false): void {
  if (!Array.isArray(messages)) return;

  // Prune poisoned/failed assistant turns globally across all models (e.g. prior 402 quota failure, network errors, empty turns)
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") continue;
    if (msg.role === "assistant") {
      const hasToolCalls = Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;
      const hasToolUseBlocks =
        Array.isArray(msg.content) &&
        msg.content.some((b: any) => b && typeof b === "object" && (b.type === "tool_use" || b.type === "tool_call"));
      const hasTools = hasToolCalls || hasToolUseBlocks;
      const isEmptyContent =
        !msg.content ||
        msg.content === "" ||
        (Array.isArray(msg.content) && (
          msg.content.length === 0 ||
          msg.content.every((b: any) => b && typeof b === "object" && (b.type === "text" || b.type === "input_text") && (!b.text || b.text.trim() === ""))
        ));

      if (
        msg.stopReason === "error" ||
        (msg.stopReason === "aborted" && isEmptyContent) ||
        (typeof msg.content === "string" && WAF_BLOCK_RE.test(msg.content)) ||
        (isEmptyContent && !hasTools && !msg.reasoning_content)
      ) {
        messages.splice(i, 1);
      }
    }
  }


  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    if (msg.role === "developer") {
      msg.role = "system";
    }
    if (msg.role === "assistant") {
      let extractedThinking: string | undefined;

      if (Array.isArray(msg.content)) {
        const thinkingParts: string[] = [];
        const nonThinkingParts: any[] = [];

        for (const part of msg.content) {
          if (part && typeof part === "object" && (part.type === "thinking" || part.type === "reasoning")) {
            const text = part.thinking || part.text;
            if (text) thinkingParts.push(text);
          } else {
            nonThinkingParts.push(part);
          }
        }

        if (thinkingParts.length > 0) {
          extractedThinking = thinkingParts.join("\n");
        }

        if (nonThinkingParts.length === 0) {
          msg.content = "";
        } else if (nonThinkingParts.length === 1 && nonThinkingParts[0].type === "text") {
          msg.content = nonThinkingParts[0].text;
        } else {
          msg.content = nonThinkingParts;
        }
      }

      if (extractedThinking && !msg.reasoning_content) {
        msg.reasoning_content = extractedThinking;
      }

      // If assistant executed tool calls, AgentRouter DeepSeek proxy strictly requires reasoning_content
      if (
        Array.isArray(msg.tool_calls) &&
        msg.tool_calls.length > 0 &&
        (!msg.reasoning_content || (typeof msg.reasoning_content === "string" && !msg.reasoning_content.trim()))
      ) {
        msg.reasoning_content = "Executing tools...";
      }

      // If DeepSeek model and content is still empty without tool calls, provide fallback text
      if (isDeepSeek && (!msg.content || msg.content === "") && (!Array.isArray(msg.tool_calls) || msg.tool_calls.length === 0)) {
        msg.content = "[Interrupted]";
        if (!msg.reasoning_content) {
          msg.reasoning_content = "Interrupted response";
        }
      }
    }

    if (isDeepSeek) {
      // Flatten past assistant tool_calls into text and convert tool roles into user turns.
      // This prevents AgentRouter's upstream Anthropic gateway from rejecting the request with:
      // "400: The `content[].thinking` in the thinking mode must be passed back to the API."
      if (msg.role === "assistant" && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
        let contentStr = typeof msg.content === "string" ? msg.content : "";
        for (const tc of msg.tool_calls) {
          const fnName = tc?.function?.name || tc?.name || "tool";
          const fnArgs = tc?.function?.arguments || "{}";
          contentStr += (contentStr ? "\n" : "") + `[Tool Call]: ${fnName}(${fnArgs})`;
        }
        msg.content = contentStr;
        delete msg.tool_calls;
        if (!msg.reasoning_content || (typeof msg.reasoning_content === "string" && !msg.reasoning_content.trim())) {
          msg.reasoning_content = "Executing tools...";
        }
      }

      if (msg.role === "tool" || msg.role === "toolResult") {
        const text = typeof msg.content === "string" ? msg.content : "";
        const toolName = (msg as any).toolName || (msg as any).name || "tool";
        msg.role = "user";
        msg.content = `[Tool Result for ${toolName}]:\n${text}`;
        delete msg.tool_call_id;
        delete (msg as any).toolCallId;
      }

    }
  }
}

export function cleanupDeepSeekDuplicates(): {
  cleanedSettings: boolean;
  cleanedCache: boolean;
  cleanedModelsJson: boolean;
} {
  let cleanedSettings = false;
  let cleanedCache = false;
  let cleanedModelsJson = false;

  // 1. Clean settings.json
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
      let modified = false;

      if (Array.isArray(settings.enabledModels)) {
        const clodeIdx = settings.enabledModels.indexOf("agentrouter-clode/deepseek-v4-flash");
        if (clodeIdx !== -1) {
          settings.enabledModels.splice(clodeIdx, 1);
          modified = true;
        }
        // Deduplicate enabledModels
        const seen = new Set<string>();
        const deduped: string[] = [];
        for (const m of settings.enabledModels) {
          if (!seen.has(m)) {
            seen.add(m);
            deduped.push(m);
          } else {
            modified = true;
          }
        }
        settings.enabledModels = deduped;
      }

      if (settings.subagents && typeof settings.subagents === "object" && settings.subagents.agentOverrides) {
        for (const override of Object.values(settings.subagents.agentOverrides)) {
          if ((override as any)?.model === "agentrouter-clode/deepseek-v4-flash") {
            (override as any).model = "agentrouter-openai/deepseek-v4-flash";
            modified = true;
          }
        }
      }

      if (settings.defaultProvider === "agentrouter-clode" && settings.defaultModel === "deepseek-v4-flash") {
        settings.defaultProvider = "agentrouter-openai";
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
        cleanedSettings = true;
      }
    }
  } catch {}

  // 2. Clean MODELS_CACHE_FILE (.agentrouter-models-cache.json)
  try {
    if (fs.existsSync(MODELS_CACHE_FILE)) {
      const cacheData = JSON.parse(fs.readFileSync(MODELS_CACHE_FILE, "utf-8"));
      if (Array.isArray(cacheData)) {
        let modified = false;
        for (const item of cacheData) {
          if (item && item.model_name === "deepseek-v4-flash") {
            if (Array.isArray(item.supported_endpoint_types) && item.supported_endpoint_types.includes("anthropic")) {
              item.supported_endpoint_types = item.supported_endpoint_types.filter((t: string) => t !== "anthropic");
              modified = true;
            }
          }
        }
        if (modified) {
          fs.writeFileSync(MODELS_CACHE_FILE, JSON.stringify(cacheData, null, 2), "utf-8");
          cleanedCache = true;
        }
      }
    }
  } catch {}

  // 3. Clean models.json (if present)
  try {
    const modelsJsonPath = path.join(process.env.HOME || "", ".pi/agent/models.json");
    if (fs.existsSync(modelsJsonPath)) {
      const modelsJson = JSON.parse(fs.readFileSync(modelsJsonPath, "utf-8"));
      let modified = false;
      if (modelsJson?.providers?.["agentrouter-clode"]?.models) {
        const origLen = modelsJson.providers["agentrouter-clode"].models.length;
        modelsJson.providers["agentrouter-clode"].models = modelsJson.providers["agentrouter-clode"].models.filter(
          (m: any) => (typeof m === "string" ? m !== "deepseek-v4-flash" : m?.id !== "deepseek-v4-flash")
        );
        if (modelsJson.providers["agentrouter-clode"].models.length !== origLen) {
          modified = true;
        }
      }
      if (modified) {
        fs.writeFileSync(modelsJsonPath, JSON.stringify(modelsJson, null, 2), "utf-8");
        cleanedModelsJson = true;
      }
    }
  } catch {}

  return { cleanedSettings, cleanedCache, cleanedModelsJson };
}

let lastWarnedErrorTimestamp = 0;
export function checkAndNotifyContentBlocked(errMessage: string | undefined, ctx: any): void {
  if (!errMessage) return;
  const now = Date.now();
  if (now - lastWarnedErrorTimestamp < 2000) return;
  if (errMessage.includes("content-blocked")) {
    lastWarnedErrorTimestamp = now;
    const tip = "[AgentRouter] Request was blocked by upstream gateway content filter (content-blocked).";
    if (ctx?.hasUI) {
      ctx.ui.notify(tip, "warning");
    } else {
      console.warn(`\n⚠️  ${tip}\n`);
    }
  }
}

export async function fetchLivePricing(): Promise<ApiPricingModel[] | null> {
  try {
    const res = await fetch("https://agentrouter.org/api/pricing", {
      
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
        "User-Agent": getPiUserAgent(),
      }
    : {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": getPiUserAgent(),
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

    if (
      res.status === 402 ||
      msg.toLowerCase().includes("quota") ||
      msg.toLowerCase().includes("exhausted") ||
      msg.toLowerCase().includes("budget pool")
    ) {
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

  cleanupDeepSeekDuplicates();
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
        const isDeepSeek = isDeepSeekRequest(event, ctx);

        if (payload.system !== undefined) {
          payload.system = enforceCanonicalRootPrompt(payload.system);
        }

        applyPoisonRedaction(payload);

        const messages = Array.isArray(payload.messages) ? payload.messages : payload.input;
        if (Array.isArray(messages) && messages.length > 0) {
          normalizeMessagesForAgentRouter(messages, isDeepSeek);

          const firstMsg = messages[0];
          if (firstMsg && (firstMsg.role === "system" || firstMsg.role === "developer")) {
            firstMsg.role = "system";
            if (typeof firstMsg.content === "string") {
              firstMsg.content = enforceCanonicalRootPrompt(firstMsg.content);
            } else if (Array.isArray(firstMsg.content)) {
              firstMsg.content = enforceCanonicalRootPrompt(firstMsg.content);
            }
          }
        }
        if (Array.isArray(payload.tools) && payload.tools.length > 0) {
          sanitizeOpenAiTools(payload.tools);
        }
      }
    }
    return undefined;
  });

  pi.on("message_end", async (event, ctx) => {
    const message = (event as any)?.message;
    if (!message) return;

    if (message.role === "assistant" && message.stopReason !== "error") {
      wafNotified = false;
      isSensitiveBlock = false;
    }

    const provider = message.provider ?? ctx?.model?.provider;
    const baseUrl = (message as any)?.baseUrl ?? (ctx?.model as any)?.baseUrl;
    if (isAgentRouter(provider, baseUrl)) {
      setLastRequestEndTime(Date.now());
    }

    if (message.role !== "assistant" || message.stopReason !== "error") return;
    if (!isAgentRouter(provider, baseUrl)) return;

    const errorMessage = message.errorMessage ?? "";
    if (!WAF_BLOCK_RE.test(errorMessage)) return;

    escalatePending = true;
    if (SENSITIVE_WORDS_RE.test(errorMessage)) {
      isSensitiveBlock = true;
    }

    if (exhausted) {
      if (!wafNotified) {
        wafNotified = true;
        const warning =
          "AgentRouter content filter keeps blocking even with earlier messages hidden. " +
          "Your latest message is likely the trigger — please rephrase or split it.";
        if (ctx?.hasUI) {
          ctx.ui.notify(warning, "warning");
        } else {
          console.warn(`\n⚠️  ${warning}\n`);
        }
      }
      return;
    }

    if (!wafNotified) {
      wafNotified = true;
      const note = isSensitiveBlock
        ? "Sensitive words detected in agent activity. Neutralizing previous leftovers so subsequent chats can proceed safely."
        : "AgentRouter content filter blocked the request. Retrying automatically with earlier messages hidden.";
      if (ctx?.hasUI) {
        ctx.ui.notify(note, "warning");
      } else {
        console.warn(`\n⚠️  ${note}\n`);
      }
    }

    return {
      message: {
        ...message,
        errorMessage: `${errorMessage} (provider returned error — retrying with earlier messages hidden)`,
      },
    };
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
    resetPoisonRedactionState();
    cleanupDeepSeekDuplicates();
    updatePromptRewriteEnvForModel(ctx.model);
    setLastRequestEndTime(Date.now());
    syncEnabledModelsInSettings();

    fetchLivePricing().then((livePricing) => {
      if (livePricing) {
        saveCachedPricing(livePricing);
        const newModels = registerAgentRouterProviders(currentApiKey, livePricing);
        cleanupDeepSeekDuplicates();
        syncEnabledModelsInSettings();
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
        syncEnabledModelsInSettings();
        ctx.ui.notify("AgentRouter API key updated successfully for all models.", "info");
        return;
      }

      if (action === "sync" || action === "enable-models") {
        const res = syncEnabledModelsInSettings();
        if (res.added.length > 0) {
          ctx.ui.notify(`[AgentRouter] Added to enabledModels: ${res.added.join(", ")} (total: ${res.count}).`, "info");
        } else {
          ctx.ui.notify(`[AgentRouter] All flagship models already enabled in settings.json (total: ${res.count}).`, "info");
        }
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
              { id: "gpt-6-astra", isAnthropic: false },
              { id: "gpt-5.6-sol", isAnthropic: false },
              { id: "claude-opus-5", isAnthropic: true },
              { id: "claude-opus-4-8", isAnthropic: true },
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
          `\nTip: Claude and GPT models use daily batch quotas. If exhausted, switch to DeepSeek V4 Flash which has unlimited availability.`;

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
        `[AgentRouter Plugin v2.1.2]\n` +
          `- Active model: ${activeModel?.id || "none"} (${isAR ? "AgentRouter [yes]" : "Other Provider"})\n` +
          `- Package Priority: ${priorityStatus}\n` +
          `- API Key: ${maskedKey}\n` +
          `- Caching & Pacing: Enabled (${minIntervalMs} ms delay)\n` +
          `- Commands:\n` +
          `   /agentrouter check        (probe live batch quotas & spending)\n` +
          `   /agentrouter pricing      (fetch live pricing table $/1M)\n` +
          `   /agentrouter sync         (sync enabledModels in settings.json)\n` +
          `   /agentrouter key <key>    (update API key)\n` +
          `   /agentrouter pacing <ms>  (adjust rate limit delay)\n` +
          `   /agentrouter fix-order    (move plugin above pi-cache-optimizer)`,
        "info"
      );
    },
  });
}
