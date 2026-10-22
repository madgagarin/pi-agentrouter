import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

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
  api?: string;
  headers?: Record<string, string>;
  input?: ("text" | "image")[];
  contextWindow: number;
  maxTokens: number;
  reasoning: boolean;
  thinkingLevelMap?: Record<string, string | null>;
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
    api: "openai-responses",
    input: ["text", "image"],
    contextWindow: 1048576,
    maxTokens: 131072,
    reasoning: true,
    compat: { sendSessionAffinityHeaders: false },
    cost: { input: 8.0 / 1_000_000, output: 40.0 / 1_000_000, cacheRead: 0, cacheWrite: 0 },
  },
  "gpt-6.1-sol": {
    id: "gpt-6.1-sol",
    name: "gpt-6.1-sol",
    providerType: "openai",
    api: "openai-responses",
    input: ["text", "image"],
    contextWindow: 1050000,
    maxTokens: 128000,
    reasoning: true,
    compat: { sendSessionAffinityHeaders: false },
    cost: { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000, cacheRead: 0, cacheWrite: 0 },
  },
  "gpt-5.6-sol": {
    id: "gpt-5.6-sol",
    name: "gpt-5.6-sol",
    providerType: "openai",
    api: "openai-responses",
    input: ["text", "image"],
    contextWindow: 1048576,
    maxTokens: 131072,
    reasoning: true,
    compat: { sendSessionAffinityHeaders: false },
    cost: { input: 8.0 / 1_000_000, output: 40.0 / 1_000_000, cacheRead: 0, cacheWrite: 0 },
  },
  "deepseek-v4-flash": {
    id: "deepseek-v4-flash",
    name: "deepseek-v4-flash",
    providerType: "openai",
    contextWindow: 1048576,
    maxTokens: 65536,
    reasoning: true,
    compat: {
      sendSessionAffinityHeaders: false,
    },
    cost: { input: 4.0 / 1_000_000, output: 12.0 / 1_000_000, cacheRead: 2.0 / 1_000_000, cacheWrite: 0 },
  },
  "deepseek-v4f": {
    id: "deepseek-v4f",
    name: "deepseek-v4f",
    providerType: "openai",
    contextWindow: 1048576,
    maxTokens: 65536,
    reasoning: true,
    compat: {
      sendSessionAffinityHeaders: false,
    },
    cost: { input: 4.0 / 1_000_000, output: 12.0 / 1_000_000, cacheRead: 2.0 / 1_000_000, cacheWrite: 0 },
  },
  "glm-5.3": {
    id: "glm-5.3",
    name: "glm-5.3",
    providerType: "openai",
    contextWindow: 1048576,
    maxTokens: 131072,
    reasoning: true,
    compat: { sendSessionAffinityHeaders: false },
    cost: { input: 3.0 / 1_000_000, output: 12.0 / 1_000_000, cacheRead: 0, cacheWrite: 0 },
  },
  "glm-5.2": {
    id: "glm-5.2",
    name: "glm-5.2",
    providerType: "openai",
    contextWindow: 1048576,
    maxTokens: 131072,
    reasoning: true,
    compat: { sendSessionAffinityHeaders: false },
    cost: { input: 3.0 / 1_000_000, output: 12.0 / 1_000_000, cacheRead: 0, cacheWrite: 0 },
  },
  "gpt-5.5": {
    id: "gpt-5.5",
    name: "gpt-5.5",
    providerType: "openai",
    contextWindow: 1048576,
    maxTokens: 131072,
    reasoning: true,
    compat: { sendSessionAffinityHeaders: false },
    cost: { input: 4.0 / 1_000_000, output: 8.0 / 1_000_000, cacheRead: 0, cacheWrite: 0 },
  },
  "claude-opus-4-8": {
    id: "claude-opus-4-8",
    name: "claude-opus-4-8",
    providerType: "anthropic",
    input: ["text", "image"],
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
  "claude-opus-5-5": {
    id: "claude-opus-5-5",
    name: "claude-opus-5-5",
    providerType: "anthropic",
    input: ["text", "image"],
    contextWindow: 1000000,
    maxTokens: 128000,
    reasoning: true,
    compat: {
      forceAdaptiveThinking: true,
      allowEmptySignature: true,
      sendSessionAffinityHeaders: true,
      supportsEagerToolInputStreaming: false,
    },
    cost: { input: 12.0 / 1_000_000, output: 12.0 / 1_000_000, cacheRead: 0, cacheWrite: 0 },
  },
  "claude-opus-5": {
    id: "claude-opus-5",
    name: "claude-opus-5",
    providerType: "anthropic",
    input: ["text", "image"],
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
    input: ["text", "image"],
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
    input: ["text", "image"],
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
  "agentrouter-openai/gpt-6.1-sol",
  "agentrouter-openai/gpt-5.6-sol",
  "agentrouter-clode/claude-opus-5-5",
];

export const DECOMMISSIONED_MODELS: string[] = [
  "agentrouter-clode/claude-opus-5",
  "agentrouter-clode/claude-opus-4-8",
  "agentrouter-clode/claude-opus-4-7",
  "agentrouter-clode/claude-opus-4-6",
  "agentrouter-openai/glm-5.3",
  "agentrouter-openai/glm-5.2",
  "agentrouter-openai/gpt-5.5",
];

export const DECOMMISSIONED_MODEL_IDS = new Set<string>([
  "claude-opus-5",
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-opus-4-6",
  "glm-5.3",
  "glm-5.2",
  "gpt-5.5",
]);

export function syncEnabledModelsInSettings(): { added: string[]; removed: string[]; count: number } {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return { added: [], removed: [], count: 0 };
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    if (!Array.isArray(settings.enabledModels)) return { added: [], removed: [], count: 0 };

    const added: string[] = [];
    for (const m of FLAGSHIP_MODELS) {
      if (!settings.enabledModels.includes(m)) {
        settings.enabledModels.push(m);
        added.push(m);
      }
    }

    const removed: string[] = [];
    for (const decomm of DECOMMISSIONED_MODELS) {
      const decommIndex = settings.enabledModels.indexOf(decomm);
      if (decommIndex !== -1) {
        settings.enabledModels.splice(decommIndex, 1);
        removed.push(decomm);
      }
    }

    if (added.length > 0 || removed.length > 0) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
    }
    return { added, removed, count: settings.enabledModels.length };
  } catch {
    return { added: [], removed: [], count: 0 };
  }
}

export function getLastRequestEndTime(target: string = "agentrouter"): number {
  try {
    const file = target === "agentrouter"
      ? PACING_FILE
      : path.join(process.env.HOME || "", `.pi/agent/.pacing-${target.replace(/[^a-z0-9_-]/gi, "_")}`);
    if (fs.existsSync(file)) {
      const val = parseInt(fs.readFileSync(file, "utf-8").trim(), 10);
      if (!isNaN(val)) return val;
    }
  } catch {}
  return 0;
}

export function setLastRequestEndTime(ts: number, target: string = "agentrouter"): void {
  try {
    const file = target === "agentrouter"
      ? PACING_FILE
      : path.join(process.env.HOME || "", `.pi/agent/.pacing-${target.replace(/[^a-z0-9_-]/gi, "_")}`);
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(file, String(ts), "utf-8");
  } catch {}
}

export function isAgentRouterUrl(urlStr?: string): boolean {
  if (!urlStr || typeof urlStr !== "string") return false;
  const lower = urlStr.toLowerCase();
  return lower.includes("agentrouter.org") || lower.includes("air-outer.com");
}

export function isAgentRouter(providerName?: string, baseUrl?: string): boolean {
  if (providerName && providerName.toLowerCase().includes("agentrouter")) return true;
  if (baseUrl && isAgentRouterUrl(baseUrl)) return true;
  return false;
}

export const CANONICAL_PI_HEADER =
  "You are an expert coding assistant operating inside pi, a coding agent harness. You help users by reading files, executing commands, editing code, and writing new files.";

export const LANGUAGE_PREAMBLE =
  "[Instruction: You are an expert coding assistant operating inside pi. Please carefully analyze the technical context, understand the user request, follow all project instructions and coding standards, and respond thoroughly in the requested language.]";

export function getPiUserAgent(): string {
  try {
    return `pi (${os.platform()} ${os.release()}; ${os.arch()})`;
  } catch {
    return "pi (browser)";
  }
}

export function isBinaryDump(text: string): boolean {
  if (typeof text !== "string" || text.length === 0) return false;
  if (text.includes("\x7fELF") || text.includes("ELF\x02\x01")) return true;
  if (text.includes("\x00\x00")) return true;

  const sampleLen = Math.min(text.length, 2000);
  let nonPrintable = 0;
  for (let i = 0; i < sampleLen; i++) {
    const code = text.charCodeAt(i);
    if (code === 0 || code === 0xfffd || (code < 32 && code !== 9 && code !== 10 && code !== 13)) {
      nonPrintable++;
    }
  }
  if (nonPrintable > 15) return true;

  // Unbroken string tokens (minified binary dumps, strings binary dumps without whitespace)
  if (text.length > 600) {
    const tokens = text.split(/(?:\\n|\\r|[\s\r\n\t])+/);
    for (const t of tokens) {
      if (t.length > 600) return true;
    }
  }

  // Large strings (>8KB) with extremely low whitespace density (< 1.5%)
  if (text.length > 8000) {
    let ws = 0;
    const checkLen = Math.min(text.length, 20000);
    for (let i = 0; i < checkLen; i++) {
      const code = text.charCodeAt(i);
      if (code === 32 || code === 10 || code === 13 || code === 9) ws++;
      else if (code === 92 && i + 1 < checkLen && (text.charCodeAt(i + 1) === 110 || text.charCodeAt(i + 1) === 114)) {
        ws++;
      }
    }
    if (ws / checkLen < 0.015) return true;
  }

  return false;
}

export function sanitizeToolCallArguments(args: string): string {
  if (typeof args !== "string") {
    return JSON.stringify(args ?? {});
  }
  // Homophone / false-positive Russian WAF replacements
  let sanitized = args.replace(/Ключевое/g, "Главное").replace(/ключевое/g, "главное");
  // Tool call arguments MUST be valid JSON (never replace with REDACTED_NOTE)
  try {
    JSON.parse(sanitized);
    return sanitized;
  } catch {
    return JSON.stringify({ raw: sanitized });
  }
}

export function enforceToolCallPairing(messages: any[]): void {
  if (!Array.isArray(messages)) return;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") continue;

    // Case 1: OpenAI tool result message (role === "tool")
    if (msg.role === "tool") {
      const toolCallId = msg.tool_call_id;
      let prevAssistant: any = null;
      for (let j = i - 1; j >= 0; j--) {
        if (messages[j]?.role === "tool") continue;
        if (messages[j]?.role === "assistant") {
          prevAssistant = messages[j];
        }
        break;
      }

      if (prevAssistant) {
        if (!Array.isArray(prevAssistant.tool_calls)) {
          prevAssistant.tool_calls = [];
        }
        for (const tc of prevAssistant.tool_calls) {
          if (tc?.function && typeof tc.function.arguments === "string") {
            tc.function.arguments = sanitizeToolCallArguments(tc.function.arguments);
          }
        }
        const hasMatchingToolCall = prevAssistant.tool_calls.some(
          (tc: any) => tc && (tc.id === toolCallId || (!toolCallId && tc.id))
        );
        const hasContentToolCalls =
          Array.isArray(prevAssistant.content) &&
          prevAssistant.content.some(
            (b: any) =>
              b &&
              typeof b === "object" &&
              (b.type === "toolCall" || b.type === "tool_use" || b.type === "function_call") &&
              (b.id === toolCallId || b.tool_call_id === toolCallId || (!toolCallId && (b.id || b.tool_call_id)))
          );
        if (!hasMatchingToolCall && !hasContentToolCalls && toolCallId) {
          prevAssistant.tool_calls.push({
            id: toolCallId,
            type: "function",
            function: {
              name: msg.name || "tool",
              arguments: "{}",
            },
          });
        }
      } else {
        // Orphaned tool message with no preceding assistant turn: convert to safe plain user message
        msg.role = "user";
        if (msg.content === REDACTED_NOTE) {
          msg.content = REDACTED_NOTE;
        } else {
          const contentStr = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content ?? "");
          msg.content = `[Tool Result ${toolCallId || ""}]: ${contentStr}`;
        }
        delete msg.tool_call_id;
        delete msg.name;
      }
    }

    // Case 2: Anthropic tool result blocks inside user message ({ type: "tool_result" })
    if (msg.role === "user" && Array.isArray(msg.content)) {
      const hasToolResult = msg.content.some((b: any) => b && typeof b === "object" && b.type === "tool_result");
      if (hasToolResult) {
        let prevAssistant: any = null;
        for (let j = i - 1; j >= 0; j--) {
          if (messages[j]?.role === "assistant") {
            prevAssistant = messages[j];
          }
          break;
        }

        for (let bIdx = 0; bIdx < msg.content.length; bIdx++) {
          const block = msg.content[bIdx];
          if (block && typeof block === "object" && block.type === "tool_result") {
            const toolUseId = block.tool_use_id;
            if (prevAssistant) {
              const inContent =
                Array.isArray(prevAssistant.content) &&
                prevAssistant.content.some(
                  (b: any) => b && typeof b === "object" && (b.type === "tool_use" || b.type === "toolCall") && b.id === toolUseId
                );
              const inToolCalls =
                Array.isArray(prevAssistant.tool_calls) &&
                prevAssistant.tool_calls.some((tc: any) => tc && tc.id === toolUseId);

              if (!inContent && !inToolCalls && toolUseId) {
                if (!Array.isArray(prevAssistant.content)) {
                  prevAssistant.content = prevAssistant.content ? [{ type: "text", text: String(prevAssistant.content) }] : [];
                }
                prevAssistant.content.push({
                  type: "tool_use",
                  id: toolUseId,
                  name: "tool",
                  input: {},
                });
                if (!Array.isArray(prevAssistant.tool_calls)) {
                  prevAssistant.tool_calls = [];
                }
                prevAssistant.tool_calls.push({
                  id: toolUseId,
                  type: "function",
                  function: { name: "tool", arguments: "{}" },
                });
              }
            } else {
              // Orphaned tool_result block with no preceding assistant turn: convert to plain text block
              if (block.content === REDACTED_NOTE || (Array.isArray(block.content) && block.content[0]?.text === REDACTED_NOTE)) {
                msg.content[bIdx] = {
                  type: "text",
                  text: REDACTED_NOTE,
                };
              } else {
                const contentStr = typeof block.content === "string" ? block.content : JSON.stringify(block.content ?? "");
                msg.content[bIdx] = {
                  type: "text",
                  text: `[Tool Result ${toolUseId || ""}]: ${contentStr}`,
                };
              }
            }
          }
        }
      }
    }
  }
}

export function sanitizeDeepSeekText(text: string): string {
  if (typeof text !== "string") return text;
  if (isBinaryDump(text)) return REDACTED_NOTE;
  // Replace false-positive blocked Russian word in AgentRouter upstream WAF
  return text.replace(/Ключевое/g, "Главное").replace(/ключевое/g, "главное");
}

export function cleanContent(text: string): string {
  if (typeof text !== "string") return text;
  if (isBinaryDump(text)) return "[Binary output omitted]";
  return text
    .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

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
    (event as any)?.payload?.model ||
    (event as any)?.model?.id ||
    (ctx as any)?.model?.id ||
    ""
  ).toLowerCase();
  return modelId.includes("deepseek");
}
export const WAF_BLOCK_RE = /sensitive[_ ]words?[_ ]detected|content-blocked/i;
export const SENSITIVE_WORDS_RE = /sensitive[_ ]words?[_ ]detected|content-blocked/i;
export const REDACTED_NOTE = "[Output omitted]";

export function frameUserTurnsForDeepSeek(messages: any[]): void {
  if (!Array.isArray(messages)) return;
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    if (msg.role !== "user") continue;

    if (typeof msg.content === "string") {
      const cleaned = sanitizeDeepSeekText(cleanContent(msg.content));
      if (cleaned === REDACTED_NOTE) {
        msg.content = REDACTED_NOTE;
        continue;
      }
      if (!cleaned.startsWith(LANGUAGE_PREAMBLE)) {
        msg.content = cleaned ? `${LANGUAGE_PREAMBLE}\n\n${cleaned}` : LANGUAGE_PREAMBLE;
      } else {
        msg.content = cleaned;
      }
    } else if (Array.isArray(msg.content)) {
      if (msg.content.length === 0) {
        msg.content.push({ type: "text", text: LANGUAGE_PREAMBLE });
      } else {
        const first = msg.content[0];
        if (first && typeof first === "object" && first.type === "tool_result") {
          continue;
        }
        let added = false;
        for (const block of msg.content) {
          if (block && typeof block === "object" && (block.type === "text" || block.type === "input_text")) {
            if (typeof block.text === "string") {
              const cleaned = sanitizeDeepSeekText(cleanContent(block.text));
              if (cleaned === REDACTED_NOTE) {
                block.text = REDACTED_NOTE;
                added = true;
                break;
              }
              if (!cleaned.startsWith(LANGUAGE_PREAMBLE)) {
                block.text = `${LANGUAGE_PREAMBLE}\n\n${cleaned}`;
              } else {
                block.text = cleaned;
              }
              added = true;
              break;
            }
          }
        }
        if (!added && msg.content.length > 0 && msg.content[0].type !== "tool_result") {
          msg.content.unshift({ type: "text", text: LANGUAGE_PREAMBLE });
        }
      }
    }
  }
}


export function cleanJsonSchemaObject(schema: any): void {
  if (!schema || typeof schema !== "object") return;

  delete schema.$schema;

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

export function sanitizeResponsesInput(input: any[]): void {
  if (!Array.isArray(input)) return;
  for (let i = input.length - 1; i >= 0; i--) {
    const item = input[i];
    if (!item || typeof item !== "object") continue;

    // 1. Strip reasoning items (which contain encrypted_content and rs_ IDs tied to a specific Azure OpenAI backend node)
    if (
      item.type === "reasoning" ||
      "encrypted_content" in item ||
      (typeof item.id === "string" && item.id.startsWith("rs_"))
    ) {
      input.splice(i, 1);
      continue;
    }

    // 2. Strip failed assistant messages with errors
    if (item.type === "message" && item.role === "assistant" && item.status === "error") {
      input.splice(i, 1);
      continue;
    }

    // 3. Strip Azure OpenAI node-specific item IDs (fc_, ctc_, msg_, etc.) to prevent
    // 400 "The requested item was created under a different Azure OpenAI resource"
    // when load-balanced across multiple Azure OpenAI backend instances.
    // In Responses API, function calls correlate with outputs strictly via call_id, not item id.
    if ("id" in item) {
      delete item.id;
    }

    // 4. Strip nested reasoning blocks and nested IDs from message content
    if (Array.isArray(item.content)) {
      for (let c = item.content.length - 1; c >= 0; c--) {
        const block = item.content[c];
        if (block && typeof block === "object") {
          if (
            block.type === "reasoning" ||
            "encrypted_content" in block ||
            (typeof block.id === "string" && block.id.startsWith("rs_"))
          ) {
            item.content.splice(c, 1);
          } else if ("id" in block) {
            delete block.id;
          }
        }
      }
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
export let lastWafBlockTime = 0;
export let activeMinIntervalMs = 3500;
try {
  const cfg = loadConfig();
  if (typeof cfg.minIntervalMs === "number" && cfg.minIntervalMs >= 0) {
    activeMinIntervalMs = cfg.minIntervalMs;
  }
} catch {}

export function resetPoisonRedactionState(): void {
  redactSet.clear();
  escalatePending = false;
  isSensitiveBlock = false;
  exhausted = false;
  sessionAnchor = null;
  wafNotified = false;
  lastWafBlockTime = 0;
}

export function triggerEscalation(sensitive: boolean = false): void {
  escalatePending = true;
  isSensitiveBlock = sensitive;
  if (sensitive) {
    lastWafBlockTime = Date.now();
  }
}


export function fingerprintOf(msg: Record<string, unknown>): string {
  if (msg.tool_call_id && typeof msg.tool_call_id === "string") {
    return `tool:${msg.tool_call_id}`;
  }
  if (msg.type === "function_call" || msg.type === "function_call_output") {
    return `${msg.type}:${(msg as any).call_id}:${JSON.stringify((msg as any).arguments ?? (msg as any).output ?? "").slice(0, 160)}`;
  }
  if (msg.role === "user" && Array.isArray(msg.content)) {
    const tr = msg.content.find((b) => isRecord(b) && b.type === "tool_result" && typeof (b as any).tool_use_id === "string");
    if (tr) {
      return `tool_result:${(tr as any).tool_use_id}`;
    }
  }
  const tc = Array.isArray(msg.tool_calls) ? JSON.stringify(msg.tool_calls).slice(0, 80) : "";
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
    if (typeof (msg as any).reasoning_content === "string" && (msg as any).reasoning_content.trim().length > 0) return true;
    if (typeof (msg as any).thinking === "string" && (msg as any).thinking.trim().length > 0) return true;
  }
  if (msg?.type === "function_call") return false;
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
    }
  }
}

export function isHideable(msg: Record<string, unknown>): boolean {
  return (
    msg.role === "user" ||
    msg.role === "tool" ||
    msg.role === "toolResult" ||
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

  if (msg.type === "function_call_output") {
    if (typeof (msg as any).output === "string") (msg as any).output = REDACTED_NOTE;
    else redactBlocks((msg as any).output);
    return;
  }
  if (msg.role === "tool" || msg.role === "toolResult") {
    msg.content = REDACTED_NOTE;
    return;
  }
  if (msg.role === "user") {
    if (typeof msg.content === "string") {
      msg.content = REDACTED_NOTE;
    } else if (Array.isArray(msg.content)) {
      redactBlocks(msg.content);
      if (msg.content.length === 0) {
        msg.content = [{ type: "text", text: REDACTED_NOTE }];
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
    sessionAnchor = anchor;
    for (const fp of redactSet) {
      if (!fps.includes(fp)) {
        redactSet.delete(fp);
      }
    }
    exhausted = false;
    wafNotified = false;
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
      // Sensitive words / content-blocked detected:
      // 1. Immediately sweep and redact ANY binary dumps anywhere in history
      for (let i = 0; i < messages.length; i++) {
        if (!isRecord(messages[i])) continue;
        const m = messages[i] as Record<string, unknown>;
        let hasBinary = false;
        if (typeof m.content === "string" && isBinaryDump(m.content)) hasBinary = true;
        if (Array.isArray(m.content)) {
          for (const b of m.content) {
            if (isRecord(b)) {
              if (typeof b.text === "string" && isBinaryDump(b.text)) hasBinary = true;
              if (typeof b.content === "string" && isBinaryDump(b.content)) hasBinary = true;
            }
          }
        }
        if (hasBinary && isHideable(m)) {
          redactSet.add(fps[i]);
          redactMessageAt(messages, i);
        }
      }

      // 2. Neutralize the most recent tool result(s) searching backwards
      let toolsRedactedCount = 0;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (!isRecord(messages[i])) continue;
        const m = messages[i] as Record<string, unknown>;
        const isToolMsg =
          m.role === "tool" ||
          m.role === "toolResult" ||
          m.type === "function_call_output" ||
          (m.role === "user" && Array.isArray(m.content) && m.content.some((b) => isRecord(b) && b.type === "tool_result"));

        if (isToolMsg && !redactSet.has(fps[i]) && hasRedactableText(m.content, m)) {
          redactSet.add(fps[i]);
          redactMessageAt(messages, i);
          toolsRedactedCount++;
          if (toolsRedactedCount >= 4) break;
        }
      }
      // If no tool turns were left to redact, redact older user turns one by one (searching backwards, excluding lastHumanUser)
      if (toolsRedactedCount === 0) {
        for (let i = messages.length - 1; i >= 0; i--) {
          if (i === lastHumanUser) continue;
          if (!isRecord(messages[i])) continue;
          const m = messages[i] as Record<string, unknown>;
          if (m.role !== "user" || !isHideable(m)) continue;
          if (redactSet.has(fps[i])) continue;
          redactSet.add(fps[i]);
          if (hasRedactableText(m.content, m)) {
            redactMessageAt(messages, i);
            break;
          }
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

export function isCompactionPayload(payload: Record<string, unknown>): boolean {
  if (
    typeof payload.system === "string" &&
    (payload.system.includes("summarization assistant") || payload.system.includes("context summarization"))
  ) {
    return true;
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : (payload as any).input;
  if (!Array.isArray(messages)) return false;

  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    const role = (m as any).role;
    const content = (m as any).content;

    if (role === "system" || role === "developer") {
      const text =
        typeof content === "string"
          ? content
          : Array.isArray(content)
          ? content.map((b: any) => b?.text || "").join(" ")
          : "";
      if (text.includes("summarization assistant") || text.includes("context summarization")) {
        return true;
      }
    }

    if (typeof content === "string") {
      if (
        (content.includes("<conversation>") && content.includes("</conversation>")) ||
        (content.includes("# Conversation") && content.includes("# Instructions")) ||
        content.includes("The messages above are a conversation to summarize") ||
        content.includes("This is the PREFIX of a turn that was too large to keep")
      ) {
        return true;
      }
    } else if (Array.isArray(content)) {
      for (const b of content) {
        if (b && typeof b === "object" && typeof b.text === "string") {
          if (
            (b.text.includes("<conversation>") && b.text.includes("</conversation>")) ||
            (b.text.includes("# Conversation") && b.text.includes("# Instructions")) ||
            b.text.includes("The messages above are a conversation to summarize") ||
            b.text.includes("This is the PREFIX of a turn that was too large to keep")
          ) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

export function cleanSerializedConversation(inner: string): string {
  // Split on block boundaries: [User]:, [Assistant thinking]:, [Assistant]:, [Assistant tool calls]:, [Tool result]:
  const blockRegex = /(?:^|\n+)(?=\[(?:User|Assistant thinking|Assistant|Assistant tool calls|Tool result)\]:)/;
  const blocks = inner.split(blockRegex);
  const out: string[] = [];

  for (const rawBlock of blocks) {
    const block = rawBlock.trim();
    if (!block) continue;

    // 1. Drop thinking blocks completely — thinking is scratchpad, wastes tokens, and contains sensitive reasoning tokens
    if (block.startsWith("[Assistant thinking]:")) {
      continue;
    }

    // 2. Neutralize tool results — replace raw dumped files, scraped web pages, tokens, and diffs with clean placeholder
    if (block.startsWith("[Tool result]:")) {
      out.push("[Tool result]: [Content withheld by local policy]");
      continue;
    }

    // 3. Neutralize tool call arguments — keep tool name and signature clean without massive payload dumps
    if (block.startsWith("[Assistant tool calls]:")) {
      const stripped = block.replace(/\([\s\S]*?\)(?=;\s*|$)/g, "()");
      out.push(stripped);
      continue;
    }

    // 4. Drop assistant messages that were WAF error dumps
    if (block.startsWith("[Assistant]:")) {
      if (WAF_BLOCK_RE.test(block)) {
        continue;
      }
      out.push(block);
      continue;
    }

    out.push(block);
  }

  let res = out.join("\n\n");
  res = sanitizeDeepSeekText(res);
  return res;
}

export function sanitizeCompactionText(text: string): string {
  // Format 1: <conversation>...</conversation> (Standard compaction & branch summary)
  if (text.includes("<conversation>")) {
    text = text.replace(/<conversation>([\s\S]*?)<\/conversation>/g, (_m, inner) => {
      return `<conversation>\n${cleanSerializedConversation(inner)}\n</conversation>`;
    });
  }

  // Format 2: # Conversation ... # Instructions (Split-turn prefix summary)
  if (text.includes("# Conversation")) {
    text = text.replace(/# Conversation([\s\S]*?)(?=# Instructions|$)/g, (_m, inner) => {
      return `# Conversation\n${cleanSerializedConversation(inner)}\n\n`;
    });
  }

  // Format 3: Clean <previous-summary> if present
  if (text.includes("<previous-summary>")) {
    text = text.replace(/<previous-summary>([\s\S]*?)<\/previous-summary>/g, (_m, inner) => {
      let cleaned = inner.replace(/Error: 500: \{"message":"sensitive words detected[\s\S]*?}/gi, "");
      cleaned = cleaned.replace(/sensitive[_ ]words?[_ ]detected|content-blocked/gi, "");
      cleaned = sanitizeDeepSeekText(cleaned);
      return `<previous-summary>${cleaned}</previous-summary>`;
    });
  }

  return text;
}

export function sanitizeCompactionPayload(payload: Record<string, unknown>): boolean {
  const messages = Array.isArray(payload.messages) ? payload.messages : (payload as any).input;
  if (!Array.isArray(messages) || messages.length === 0) return false;

  let sanitized = false;
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;

    if (typeof msg.content === "string") {
      if (
        msg.content.includes("<conversation>") ||
        msg.content.includes("# Conversation") ||
        msg.content.includes("<previous-summary>")
      ) {
        msg.content = sanitizeCompactionText(msg.content);
        sanitized = true;
      }
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block && typeof block === "object" && typeof block.text === "string") {
          if (
            block.text.includes("<conversation>") ||
            block.text.includes("# Conversation") ||
            block.text.includes("<previous-summary>")
          ) {
            block.text = sanitizeCompactionText(block.text);
            sanitized = true;
          }
        }
      }
    }
  }

  return sanitized;
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

      const hasValidRc = typeof msg.reasoning_content === "string" && msg.reasoning_content.trim().length > 0;
      if (
        msg.stopReason === "error" ||
        (msg.stopReason === "aborted" && isEmptyContent) ||
        (typeof msg.content === "string" && WAF_BLOCK_RE.test(msg.content)) ||
        (isEmptyContent && !hasTools && !hasValidRc)
      ) {
        messages.splice(i, 1);
      }
    }
  }

  enforceToolCallPairing(messages);


  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    if (msg.role === "developer") {
      msg.role = "system";
    }
    if (msg.role === "assistant") {
      let extractedThinking: string | undefined;

      const hasToolCalls = Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;
      const hasContentToolCalls =
        Array.isArray(msg.content) &&
        msg.content.some(
          (b: any) => b && typeof b === "object" && (b.type === "toolCall" || b.type === "tool_use" || b.type === "function_call")
        );
      const isToolTurn = hasToolCalls || hasContentToolCalls;

      let textContent = "";

      if (Array.isArray(msg.content)) {
        const thinkingParts: string[] = [];
        const nonThinkingParts: any[] = [];
        const convertedToolCalls: any[] = [];

        for (const part of msg.content) {
          if (part && typeof part === "object") {
            if (part.type === "thinking" || part.type === "reasoning") {
              const text = typeof part.thinking === "string" ? part.thinking.trim() : typeof part.text === "string" ? part.text.trim() : "";
              if (text.length > 0) thinkingParts.push(text);
            } else if (part.type === "toolCall" || part.type === "tool_use" || part.type === "function_call") {
              convertedToolCalls.push({
                id: part.id || part.tool_call_id || `call_${Math.random().toString(36).slice(2, 9)}`,
                type: "function",
                function: {
                  name: part.name || part.function?.name || "tool",
                  arguments: typeof part.arguments === "string" ? part.arguments : JSON.stringify(part.arguments ?? {}),
                },
              });
            } else {
              nonThinkingParts.push(part);
            }
          } else {
            nonThinkingParts.push(part);
          }
        }

        if (convertedToolCalls.length > 0) {
          if (!Array.isArray(msg.tool_calls) || msg.tool_calls.length === 0) {
            msg.tool_calls = convertedToolCalls;
          }
        }

        if (thinkingParts.length > 0) {
          extractedThinking = thinkingParts.join("\n");
        }

        if (nonThinkingParts.length === 1 && nonThinkingParts[0].type === "text") {
          textContent = nonThinkingParts[0].text || "";
        } else if (nonThinkingParts.length > 0) {
          textContent = nonThinkingParts
            .map((p) => (typeof p === "string" ? p : p?.text || ""))
            .filter(Boolean)
            .join("\n");
        }
      } else if (typeof msg.content === "string") {
        textContent = msg.content;
      }

      const hadRc = typeof msg.reasoning_content === "string";
      const hasValidRc = hadRc && msg.reasoning_content.trim().length > 0;
      const validRc = hasValidRc ? msg.reasoning_content.trim() : undefined;
      const validExtracted = typeof extractedThinking === "string" && extractedThinking.trim().length > 0 ? extractedThinking.trim() : undefined;
      const fallbackReasoning = isToolTurn ? "Executing tools..." : (hadRc && isDeepSeek ? "Thinking..." : undefined);
      const reasoning = validRc || validExtracted || fallbackReasoning;

      if (reasoning) {
        msg.reasoning_content = reasoning;
      } else {
        delete msg.reasoning_content;
      }

      if (textContent && textContent.includes("[Tool Call]:")) {
        textContent = textContent.replace(/\[Tool Call\]:[^\n]+(\n|$)/g, "").trim();
      }

      msg.content = textContent;
      if (isDeepSeek && (!msg.content || msg.content.trim() === "") && !isToolTurn) {
        msg.content = "[Interrupted]";
      }
    }

    if (isDeepSeek) {
      if (typeof msg.content === "string") {
        msg.content = sanitizeDeepSeekText(msg.content);
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block && typeof block === "object") {
            if (typeof block.text === "string") {
              block.text = sanitizeDeepSeekText(block.text);
            }
            if (typeof block.content === "string") {
              block.content = sanitizeDeepSeekText(block.content);
            } else if (Array.isArray(block.content)) {
              for (const sub of block.content) {
                if (sub && typeof sub === "object" && typeof sub.text === "string") {
                  sub.text = sanitizeDeepSeekText(sub.text);
                }
              }
            }
            if (typeof block.thinking === "string") {
              block.thinking = sanitizeDeepSeekText(block.thinking);
            }
          }
        }
      }
      if (Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          if (tc?.function && typeof tc.function.arguments === "string") {
            tc.function.arguments = sanitizeToolCallArguments(tc.function.arguments);
          }
        }
      }
      if (msg.role === "assistant") {
        const hasTools = (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0);
        if (msg.reasoning_content && typeof msg.reasoning_content === "string") {
          msg.reasoning_content = sanitizeDeepSeekText(msg.reasoning_content).trim();
          if (msg.reasoning_content.length === 0) {
            if (hasTools) {
              msg.reasoning_content = "Executing tools...";
            } else {
              msg.reasoning_content = "Thinking...";
            }
          }
        } else if (hasTools) {
          msg.reasoning_content = "Executing tools...";
        } else {
          delete msg.reasoning_content;
        }
      }
    }
  }

  enforceToolCallPairing(messages);
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
      headers: { "User-Agent": getPiUserAgent() },
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
          "User-Agent": getPiUserAgent(),
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
  status: "READY" | "QUOTA_EXHAUSTED" | "NOT_IN_TOKEN" | "FORBIDDEN" | "ERROR";
  code: number;
  message?: string;
}

export async function probeModelQuota(
  modelId: string,
  apiKey: string,
  isAnthropic: boolean,
  isResponsesApi?: boolean
): Promise<ModelProbeResult> {
  const isResponses =
    isResponsesApi ??
    (KNOWN_MODEL_SPECS[modelId]?.api === "openai-responses" ||
      modelId.startsWith("gpt-6") ||
      modelId.includes("-sol"));

  let url = "https://agentrouter.org/v1/chat/completions";
  if (isAnthropic) {
    url = "https://agentrouter.org/v1/messages";
  } else if (isResponses) {
    url = "https://agentrouter.org/v1/responses";
  }

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

  let body: any;
  if (isAnthropic) {
    body = {
      model: modelId,
      system: CANONICAL_PI_HEADER,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 16,
    };
  } else if (isResponses) {
    body = {
      model: modelId,
      input: [{ role: "user", content: "ping" }],
      max_output_tokens: 16,
    };
  } else {
    body = {
      model: modelId,
      messages: [
        { role: "system", content: CANONICAL_PI_HEADER },
        { role: "user", content: "ping" },
      ],
      max_tokens: 16,
    };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (res.ok) {
      return { model: modelId, status: "READY", code: res.status };
    }

    const msg = await res.text().catch(() => "");
    if (
      res.status === 402 ||
      msg.toLowerCase().includes("quota") ||
      msg.toLowerCase().includes("exhausted") ||
      msg.toLowerCase().includes("budget pool")
    ) {
      return { model: modelId, status: "QUOTA_EXHAUSTED", code: 402, message: msg };
    }
    if (
      res.status === 403 ||
      msg.includes("无权访问模型") ||
      msg.toLowerCase().includes("no permission") ||
      msg.toLowerCase().includes("not allowed to access")
    ) {
      return {
        model: modelId,
        status: "NOT_IN_TOKEN",
        code: 403,
        message: "Model not enabled for this token in AgentRouter dashboard",
      };
    }
    if (res.status === 403) {
      return { model: modelId, status: "FORBIDDEN", code: 403, message: msg };
    }
    if (res.status === 503 || msg.includes("无可用渠道") || msg.includes("no available channel")) {
      return { model: modelId, status: "ERROR", code: 503, message: "Channel temporarily paused on gateway (503)" };
    }
    return { model: modelId, status: "ERROR", code: res.status, message: msg };
  } catch (err: any) {
    return { model: modelId, status: "ERROR", code: 0, message: err.message };
  }
}

function arDebugLog(msg: string): void {
  try {
    const logFile = path.join(process.env.HOME || "", ".pi/agent/.agentrouter-debug.log");
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`, "utf-8");
  } catch {}
}

export let lastAgentRouterCookie = "";
export let activeAgentRouterThinkingFormat: "openai" | "claude" = "openai";

export function getActiveAgentRouterThinkingFormat(): "openai" | "claude" {
  return "openai";
}

export function setActiveAgentRouterThinkingFormat(_format: "openai" | "claude"): void {
  activeAgentRouterThinkingFormat = "openai";
}

export function getLastAgentRouterCookie(): string {
  return lastAgentRouterCookie;
}

export function setLastAgentRouterCookie(cookie: string): void {
  lastAgentRouterCookie = cookie;
}

export function extractCookieFromResponse(res: Response): string | null {
  try {
    const rawSetCookie = res.headers.get("set-cookie");
    if (rawSetCookie) {
      const match = rawSetCookie.match(/(acw_tc=[^;]+)/i);
      if (match) {
        return match[1];
      }
    }
  } catch {}
  return null;
}

export function attachCookieToHeaders(headers: unknown, cookieStr: string): void {
  if (!headers || !cookieStr) return;
  if (headers instanceof Headers) {
    const existing = headers.get("cookie");
    if (!existing) {
      headers.set("cookie", cookieStr);
    } else if (!existing.includes(cookieStr.split("=")[0])) {
      headers.set("cookie", `${existing}; ${cookieStr}`);
    }
    return;
  }
  if (Array.isArray(headers)) {
    let found = false;
    for (const pair of headers) {
      if (typeof pair[0] === "string" && pair[0].toLowerCase() === "cookie") {
        found = true;
        if (!pair[1].includes(cookieStr.split("=")[0])) {
          pair[1] = `${pair[1]}; ${cookieStr}`;
        }
        break;
      }
    }
    if (!found) {
      headers.push(["Cookie", cookieStr]);
    }
    return;
  }
  if (typeof headers === "object") {
    let found = false;
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === "cookie") {
        found = true;
        if (typeof v === "string" && !v.includes(cookieStr.split("=")[0])) {
          (headers as any)[k] = `${v}; ${cookieStr}`;
        }
        break;
      }
    }
    if (!found) {
      (headers as any)["Cookie"] = cookieStr;
    }
  }
}

export function getHeader(headers: unknown, name: string): string | undefined {
  if (!headers) return undefined;
  const target = name.toLowerCase();
  if (headers instanceof Headers) {
    return headers.get(target) || undefined;
  }
  if (Array.isArray(headers)) {
    for (const [k, v] of headers) {
      if (typeof k === "string" && k.toLowerCase() === target) {
        return typeof v === "string" ? v : String(v);
      }
    }
    return undefined;
  }
  if (typeof headers === "object") {
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === target) {
        return typeof v === "string" ? v : String(v);
      }
    }
  }
  return undefined;
}

export function setHeader(headers: unknown, name: string, value: string): void {
  if (!headers) return;
  const target = name.toLowerCase();
  if (headers instanceof Headers) {
    headers.set(name, value);
    return;
  }
  if (Array.isArray(headers)) {
    for (let i = 0; i < headers.length; i++) {
      if (typeof headers[i][0] === "string" && headers[i][0].toLowerCase() === target) {
        headers[i][1] = value;
        return;
      }
    }
    headers.push([name, value]);
    return;
  }
  if (typeof headers === "object") {
    for (const k of Object.keys(headers)) {
      if (k.toLowerCase() === target) {
        (headers as Record<string, any>)[k] = value;
        return;
      }
    }
    (headers as Record<string, any>)[name] = value;
  }
}

export function removeHeader(headers: unknown, name: string): void {
  if (!headers) return;
  const target = name.toLowerCase();
  if (headers instanceof Headers) {
    headers.delete(name);
    return;
  }
  if (Array.isArray(headers)) {
    for (let i = headers.length - 1; i >= 0; i--) {
      if (typeof headers[i][0] === "string" && headers[i][0].toLowerCase() === target) {
        headers.splice(i, 1);
      }
    }
    return;
  }
  if (typeof headers === "object") {
    for (const k of Object.keys(headers)) {
      if (k.toLowerCase() === target) {
        delete (headers as Record<string, any>)[k];
      }
    }
  }
}

export function wrapStreamWithBuffer(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  buffered: Uint8Array[]
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (buffered.length > 0) {
        controller.enqueue(buffered.shift()!);
        return;
      }
      const { value, done } = await reader.read();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

export async function inspectStreamInitialChunks(
  response: Response
): Promise<{ response: Response; isError: boolean; errorText: string }> {
  if (!response.body) return { response, isError: false, errorText: "" };
  const reader = response.body.getReader();
  const buffered: Uint8Array[] = [];
  const decoder = new TextDecoder();
  let accumulated = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffered.push(value);
      accumulated += decoder.decode(value, { stream: true });
      const lower = accumulated.toLowerCase();

      // Check if normal model generation has begun (Responses API, Chat Completions, Anthropic)
      const isProgress =
        lower.includes("output_item.") ||
        lower.includes("content_part.") ||
        lower.includes("output_text.") ||
        lower.includes("reasoning_summary") ||
        lower.includes("function_call_arguments") ||
        lower.includes("custom_tool_call") ||
        lower.includes("response.completed") ||
        lower.includes("response.incomplete") ||
        lower.includes("choices") ||
        lower.includes("content_block") ||
        lower.includes("message_start") ||
        lower.includes("message_delta") ||
        lower.includes("[done]");

      if (isProgress) {
        const wrapped = wrapStreamWithBuffer(reader, buffered);
        return {
          response: new Response(wrapped, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          }),
          isError: false,
          errorText: "",
        };
      }

      // Check for upstream stream-level error signatures
      const hasFailedStatus = /"status"\s*:\s*"failed"/i.test(accumulated);
      const hasRateLimitSignature =
        lower.includes("token rate limit") ||
        lower.includes("exceeded token rate limit") ||
        lower.includes("rate_limit_exceeded") ||
        lower.includes("rate limit exceeded");
      const hasAzureCrossResourceSignature =
        lower.includes("different azure openai resource") ||
        lower.includes("different azure resource") ||
        lower.includes("use the same resource") ||
        lower.includes("could not be decrypted") ||
        lower.includes("decryption failure") ||
        lower.includes("decryption_failure");

      const isStreamError =
        lower.includes("response.failed") ||
        lower.includes("event: error") ||
        hasFailedStatus ||
        hasRateLimitSignature ||
        hasAzureCrossResourceSignature ||
        (lower.startsWith("data:") && /data:\s*\{\s*"error"\s*:\s*\{/i.test(accumulated)) ||
        (!lower.includes("event: response.created") &&
          (lower.includes("the operation was aborted") ||
            lower.includes("temporarily unavailable") ||
            (/"error"\s*:\s*\{[^}]+\}/i.test(accumulated))));

      if (isStreamError) {
        try {
          await reader.cancel("Upstream error detected in stream");
        } catch {}
        return { response, isError: true, errorText: accumulated };
      }
    }
  } catch (readErr: any) {
    try {
      await reader.cancel(readErr);
    } catch {}
    return { response, isError: true, errorText: readErr?.message || "Stream read failed" };
  }

  // End of stream reached without explicit error or generation
  const wrapped = wrapStreamWithBuffer(reader, buffered);
  return {
    response: new Response(wrapped, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }),
    isError: false,
    errorText: "",
  };
}

let fetchHookInstalled = false;
let lastRateLimitTime = 0;
let rateLimitSalt = 0;

export function installAgentRouterFetchHook(): void {
  if (fetchHookInstalled) return;
  fetchHookInstalled = true;
  arDebugLog("installAgentRouterFetchHook successfully registered on globalThis.fetch");

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request)?.url || "";

    if (isAgentRouterUrl(urlStr)) {
      const piUa = getPiUserAgent();
      if (!init) {
        init = { headers: { "User-Agent": piUa } };
      } else if (!init.headers) {
        init.headers = { "User-Agent": piUa };
      } else if (init.headers instanceof Headers) {
        const currentUa = init.headers.get("User-Agent") || "";
        if (!currentUa.startsWith("pi (") && !currentUa.startsWith("pi/")) {
          init.headers.set("User-Agent", piUa);
        }
      } else if (Array.isArray(init.headers)) {
        let found = false;
        for (const pair of init.headers) {
          if (pair[0].toLowerCase() === "user-agent") {
            found = true;
            if (!pair[1].startsWith("pi (") && !pair[1].startsWith("pi/")) {
              pair[1] = piUa;
            }
          }
        }
        if (!found) {
          init.headers.push(["User-Agent", piUa]);
        }
      } else if (typeof init.headers === "object") {
        let foundUa = false;
        for (const [k, v] of Object.entries(init.headers)) {
          if (k.toLowerCase() === "user-agent") {
            foundUa = true;
            if (typeof v !== "string" || (!v.startsWith("pi (") && !v.startsWith("pi/"))) {
              (init.headers as any)[k] = piUa;
            }
          }
        }
        if (!foundUa) {
          (init.headers as any)["User-Agent"] = piUa;
        }
      }

      if (Date.now() - lastRateLimitTime < 120000 && rateLimitSalt > 0) {
        lastAgentRouterCookie = "";
        if (init?.headers) {
          removeHeader(init.headers, "cookie");
          removeHeader(init.headers, "x-session-affinity");
          removeHeader(init.headers, "affinity");
          const origSessionId = getHeader(init.headers, "session_id");
          if (origSessionId) {
            const baseSessionId = origSessionId.replace(/-rl\d+$/, "").replace(/-r\d+$/, "");
            setHeader(init.headers, "session_id", `${baseSessionId}-rl${rateLimitSalt}`);
          }
          setHeader(init.headers, "x-client-request-id", crypto.randomUUID());
        }
      }

      if (init && typeof init.body === "string") {
        try {
          const body = JSON.parse(init.body);
          if (body && typeof body === "object") {
            const modelId = typeof body.model === "string" ? body.model.toLowerCase() : "";
            const isDeepSeek = modelId.includes("deepseek");
            const isResponsesEndpoint = urlStr.includes("/responses");
            const isCompaction = isCompactionPayload(body);
            const origLen = init.body.length;

            if (Date.now() - lastRateLimitTime < 120000 && rateLimitSalt > 0 && typeof body.prompt_cache_key === "string") {
              const baseKey = body.prompt_cache_key.replace(/-v\d+$/, "");
              body.prompt_cache_key = `${baseKey}-v${rateLimitSalt}`;
            }

            if (isDeepSeek && "thinking" in body) {
              delete body.thinking;
            }

            if (isCompaction) {
              sanitizeCompactionPayload(body);
              const messages = Array.isArray(body.messages) ? body.messages : body.input;
              if (Array.isArray(messages) && messages.length > 0) {
                normalizeMessagesForAgentRouter(messages, isDeepSeek);
                if (isDeepSeek) {
                  frameUserTurnsForDeepSeek(messages);
                }
              }
              init.body = JSON.stringify(body);
              arDebugLog(`[FetchHook] Compaction intercepted: model=${modelId} origLen=${origLen} newLen=${init.body.length}`);
            } else if (!isResponsesEndpoint) {
              applyPoisonRedaction(body);
              const messages = Array.isArray(body.messages) ? body.messages : body.input;
              if (Array.isArray(messages) && messages.length > 0) {
                normalizeMessagesForAgentRouter(messages, isDeepSeek);
                if (isDeepSeek) {
                  frameUserTurnsForDeepSeek(messages);
                }
              }
              init.body = JSON.stringify(body);
              if (isDeepSeek && (init.body.includes("Ключевое") || init.body.includes("ключевое"))) {
                init.body = init.body.replace(/Ключевое/g, "Главное").replace(/ключевое/g, "главное");
              }
              arDebugLog(`[FetchHook] Chat turn intercepted: model=${modelId} origLen=${origLen} newLen=${init.body.length}`);
            } else {
              if (Array.isArray(body.tools) && body.tools.length > 0) {
                sanitizeOpenAiTools(body.tools);
              }
              if (Array.isArray(body.input)) {
                sanitizeResponsesInput(body.input);
              }
              if ("previous_response_id" in body) {
                delete body.previous_response_id;
              }
              init.body = JSON.stringify(body);
              arDebugLog(`[FetchHook] Responses turn intercepted: model=${modelId} origLen=${origLen} newLen=${init.body.length}`);
            }
          }
        } catch (err: any) {
          arDebugLog(`[FetchHook] Error parsing body: ${err.message}`);
        }
      }
    }

    let response: Response;
    try {
      response = await originalFetch.call(this, input, init);
    } catch (networkErr: any) {
      if (isAgentRouterUrl(urlStr)) {
        arDebugLog(`[FetchHook] Initial fetch network error: ${networkErr.message}. Entering retry loop...`);
        response = new Response(
          JSON.stringify({ error: { message: networkErr.message || "Network connection dropped" } }),
          {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Content-Type": "application/json" },
          }
        );
      } else {
        throw networkErr;
      }
    }

    // If upstream returns a retryable error on AgentRouter (such as rate limits, thinking mode glitch, temporary unavailability, or SSE error stream), retry up to 10 times
    if (isAgentRouterUrl(urlStr)) {
      for (let attempt = 0; attempt <= 10; attempt++) {
        try {
          let isError = !response.ok;
          let errorText = "";
          let errorStatus = response.status;

          if (response.ok && response.headers.get("content-type")?.includes("text/event-stream")) {
            const check = await inspectStreamInitialChunks(response);
            if (check.isError) {
              isError = true;
              errorText = check.errorText;
              const lowerCheck = errorText.toLowerCase();
              errorStatus = (lowerCheck.includes("rate limit") || lowerCheck.includes("rate_limit") || lowerCheck.includes("token rate limit")) ? 429 : 400;
            } else {
              response = check.response;
            }
          } else if (!response.ok) {
            const cloned = response.clone();
            errorText = await cloned.text();
          }

          if (!isError) {
            const okCookie = extractCookieFromResponse(response);
            if (okCookie) {
              lastAgentRouterCookie = okCookie;
            }
            return response;
          }

          const lowerText = errorText.toLowerCase();

          const isRateLimit =
            errorStatus === 429 ||
            lowerText.includes("rate limit") ||
            lowerText.includes("rate_limit") ||
            lowerText.includes("exceeded token rate limit") ||
            lowerText.includes("rate limit reached") ||
            lowerText.includes("tokens per minute") ||
            lowerText.includes("tpm") ||
            lowerText.includes("rpm");

          const isThinking400 =
            errorStatus === 400 &&
            (errorText.includes("in the thinking mode must be passed back") ||
              errorText.includes("content[].thinking") ||
              errorText.includes("reasoning_content"));

          const isDeserialize422 =
            errorStatus === 422 ||
            lowerText.includes("failed to deserialize") ||
            lowerText.includes("unknown variant") ||
            lowerText.includes("expected one of `text`");

          const isWafBlock =
            (errorStatus === 500 && (errorText.includes("sensitive words detected") || errorText.includes("sensitive_words_detected"))) ||
            (errorStatus === 400 && (errorText.includes("content-blocked") || errorText.includes("sensitive words detected") || errorText.includes("sensitive_words_detected")));

          const isWafChallenge405 =
            errorStatus === 405 ||
            (errorStatus === 400 && lowerText.includes("blocked") && !isThinking400 && !isWafBlock);

          const isServiceUnavailable =
            (errorStatus === 500 && errorText.includes("temporarily unavailable")) ||
            errorStatus === 502 ||
            errorStatus === 503 ||
            errorStatus === 504;

          const isToolPairing400 =
            errorStatus === 400 &&
            (lowerText.includes("tool_result block must have a corresponding tool_use block") ||
              (lowerText.includes("unexpected") && lowerText.includes("tool_use_id")) ||
              (lowerText.includes("tool_result") && lowerText.includes("tool_use")));

          const isDecryptionOrCrossResourceError =
            (errorStatus === 500 || errorStatus === 502 || errorStatus === 400 || errorStatus === 503) &&
            (lowerText.includes("different azure openai resource") ||
              lowerText.includes("different azure resource") ||
              lowerText.includes("use the same resource") ||
              lowerText.includes("could not be decrypted") ||
              lowerText.includes("encrypted content") ||
              lowerText.includes("decryption failure") ||
              lowerText.includes("decryption_failure") ||
              lowerText.includes("cross-resource") ||
              lowerText.includes("cross resource") ||
              lowerText.includes("cross_resource") ||
              lowerText.includes("cross-origin"));

          const shouldRetry =
            isRateLimit ||
            isThinking400 ||
            isDeserialize422 ||
            isWafBlock ||
            isWafChallenge405 ||
            isServiceUnavailable ||
            isToolPairing400 ||
            isDecryptionOrCrossResourceError;

          if (!shouldRetry || attempt === 10) {
            if (response.ok && isError) {
              let cleanMsg = errorText || "Upstream stream error";
              try {
                const match = errorText.match(/\{[\s\S]*\}/);
                if (match) {
                  const parsed = JSON.parse(match[0]);
                  cleanMsg = parsed.error?.message || parsed.response?.error?.message || parsed.message || cleanMsg;
                }
              } catch {}
              response = new Response(
                JSON.stringify({
                  error: {
                    message: cleanMsg,
                    type: isRateLimit ? "rate_limit_error" : "invalid_request_error",
                    code: isRateLimit ? "rate_limit_exceeded" : null,
                  },
                }),
                {
                  status: isRateLimit ? 429 : 400,
                  headers: { "Content-Type": "application/json" },
                }
              );
            }
            break;
          }

          if (isRateLimit || isDecryptionOrCrossResourceError) {
            lastRateLimitTime = Date.now();
            rateLimitSalt++;
          }

          arDebugLog(`[FetchHook] Caught retryable upstream ${errorStatus} (attempt ${attempt + 1}/10): ${errorText.slice(0, 100)}. Retrying...`);

          lastAgentRouterCookie = "";
          if (init?.headers) {
            removeHeader(init.headers, "cookie");
            removeHeader(init.headers, "x-session-affinity");
            removeHeader(init.headers, "affinity");
            const origSessionId = getHeader(init.headers, "session_id");
            if (origSessionId) {
              const baseSessionId = origSessionId.replace(/-rl\d+$/, "").replace(/-r\d+$/, "");
              setHeader(init.headers, "session_id", `${baseSessionId}-r${attempt + 1}`);
            }
            setHeader(init.headers, "x-client-request-id", crypto.randomUUID());
          }

          // Clean payload if it contained problematic structures (e.g. body.thinking or WAF poison)
          if (init && typeof init.body === "string") {
            try {
              const bodyObj = JSON.parse(init.body);
              if (bodyObj && typeof bodyObj === "object") {
                const modelId = typeof bodyObj.model === "string" ? bodyObj.model.toLowerCase() : "";
                const isDeepSeekModel = modelId.includes("deepseek");
                if (isDeepSeekModel && "thinking" in bodyObj) {
                  delete bodyObj.thinking;
                }
                const isResponses = urlStr.includes("/responses") || (Array.isArray(bodyObj.input) && !Array.isArray(bodyObj.messages));
                if (isResponses || isDecryptionOrCrossResourceError || isRateLimit) {
                  if (Array.isArray(bodyObj.input)) {
                    sanitizeResponsesInput(bodyObj.input);
                  }
                  if ("previous_response_id" in bodyObj) {
                    delete bodyObj.previous_response_id;
                  }
                  if ("prompt_cache_key" in bodyObj) {
                    if (typeof bodyObj.prompt_cache_key === "string") {
                      const baseKey = bodyObj.prompt_cache_key.replace(/-v\d+$/, "");
                      bodyObj.prompt_cache_key = `${baseKey}-v${rateLimitSalt || attempt + 1}`;
                    } else {
                      delete bodyObj.prompt_cache_key;
                    }
                  }
                }
                const msgs = Array.isArray(bodyObj.messages) ? bodyObj.messages : bodyObj.input;
                if (Array.isArray(msgs)) {
                  if (isWafBlock) {
                    lastWafBlockTime = Date.now();
                    triggerEscalation(true);
                    applyPoisonRedaction(bodyObj);
                  }
                  if (!isResponses) {
                    normalizeMessagesForAgentRouter(msgs, isDeepSeekModel);
                    if (isDeepSeekModel) {
                      frameUserTurnsForDeepSeek(msgs);
                    }
                  }
                }
                init.body = JSON.stringify(bodyObj);
                if (isDeepSeekModel && (init.body.includes("Ключевое") || init.body.includes("ключевое"))) {
                  init.body = init.body.replace(/Ключевое/g, "Главное").replace(/ключевое/g, "главное");
                }
              }
            } catch {}
          }

          let waitMs: number;
          if (isRateLimit) {
            const retryAfterSec = parseInt(response.headers.get("retry-after") || "0", 10);
            const retryAfterMs = parseInt(response.headers.get("retry-after-ms") || "0", 10);
            const match = errorText.match(/retry after (\d+) seconds?/i) || errorText.match(/retry in (\d+) seconds?/i);
            const parsedMatchSec = match ? parseInt(match[1], 10) : 0;

            const baseRetrySec = retryAfterSec || parsedMatchSec;
            if (retryAfterMs > 0) {
              waitMs = Math.min(60000, Math.round(retryAfterMs * Math.pow(1.5, attempt)));
            } else if (baseRetrySec > 0) {
              waitMs = Math.min(60000, Math.round(baseRetrySec * 1000 * Math.pow(1.5, attempt)));
            } else {
              // Exponential backoff for TPM / Rate limits: ~5s -> ~8s -> ~12s -> ~18s -> ~28s -> ~44s (cap 60s)
              const baseWait = Math.max(activeMinIntervalMs, 4000);
              waitMs = Math.min(60000, Math.round(baseWait * Math.pow(1.6, attempt) + Math.floor(Math.random() * 2000)));
            }
          } else if (isWafChallenge405) {
            // WAF 405 challenge: progressive exponential backoff
            const baseWait = Math.max(activeMinIntervalMs, 3000);
            waitMs = Math.min(30000, Math.round(baseWait * Math.pow(1.5, attempt) + Math.floor(Math.random() * 1000)));
          } else {
            // General upstream errors (500, 502, 503, cross-resource, thinking mode 400, etc.)
            const baseWait = Math.max(activeMinIntervalMs, 2000);
            waitMs = Math.min(30000, Math.round(baseWait * Math.pow(1.4, attempt) + Math.floor(Math.random() * 800)));
          }

          arDebugLog(`[FetchHook] Waiting ${Math.round(waitMs / 1000)}s before retry attempt ${attempt + 1}...`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          setLastRequestEndTime(Date.now());
          try {
            response = await originalFetch.call(this, input, init);
          } catch (retryNetworkErr: any) {
            arDebugLog(`[FetchHook] Retry attempt ${attempt + 1} network error: ${retryNetworkErr.message}`);
            response = new Response(
              JSON.stringify({ error: { message: retryNetworkErr.message || "Network connection dropped" } }),
              {
                status: 503,
                statusText: "Service Unavailable",
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        } catch (err: any) {
          arDebugLog(`[FetchHook] Retry loop error: ${err?.message || err}`);
          break;
        }
      }
    }

    if (isAgentRouterUrl(urlStr)) {
      const okCookie = extractCookieFromResponse(response);
      if (okCookie) {
        lastAgentRouterCookie = okCookie;
      }
    }

    // Log and handle non-OK responses from upstream
    if (isAgentRouterUrl(urlStr) && !response.ok) {
      try {
        const cloned = response.clone();
        const text = await cloned.text();
        arDebugLog(`[FetchHook] Upstream ${response.status}: ${text.slice(0, 200)}`);
        if (WAF_BLOCK_RE.test(text)) {
          lastWafBlockTime = Date.now();
          escalatePending = true;
          if (SENSITIVE_WORDS_RE.test(text)) {
            isSensitiveBlock = true;
          }
        }
      } catch {}
    }

    return response;
  };
}

installAgentRouterFetchHook();

export default function (pi: ExtensionAPI) {
  installAgentRouterFetchHook();
  function getEffectiveApiKey(): string {
    const cfg = loadConfig();
    return normalizeApiKey(process.env.AGENTROUTER_API_KEY || process.env.AGENT_ROUTER_API_KEY || cfg.apiKey || "");
  }

  const initialConfig = loadConfig();
  let currentApiKey = getEffectiveApiKey();
  let minIntervalMs = initialConfig.minIntervalMs ?? 3500;
  activeMinIntervalMs = minIntervalMs;

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
          const modelObj: any = {
            id: spec.id,
            name: spec.name,
            reasoning: spec.reasoning,
            input: spec.input || ["text"],
            contextWindow: spec.contextWindow,
            maxTokens: spec.maxTokens,
            cost: { input: inCost, output: outCost, cacheRead: 0, cacheWrite: 0 },
            compat: spec.compat || { sendSessionAffinityHeaders: true },
          };
          if (spec.thinkingLevelMap) {
            modelObj.thinkingLevelMap = { ...spec.thinkingLevelMap };
          }
          if (spec.api) {
            modelObj.api = spec.api;
          }
          if (spec.headers) {
            modelObj.headers = { ...spec.headers };
          }
          if (spec.providerType === "anthropic") {
            claudeModels.push(modelObj);
          } else {
            openaiModels.push(modelObj);
          }
        } else {
          newModels.push(id);
          const isAnthropic =
            id.toLowerCase().startsWith("claude") ||
            (item.supported_endpoint_types.includes("anthropic") && !item.supported_endpoint_types.includes("openai"));
          const isVision =
            id.toLowerCase().includes("vision") ||
            id.toLowerCase().startsWith("claude") ||
            id.toLowerCase().startsWith("gpt-6");
          const modelObj = {
            id,
            name: id,
            reasoning: true,
            input: isVision ? ["text", "image"] : ["text"],
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

    // Register any known non-decommissioned models that were not in live pricing
    // (e.g. deepseek-v4-flash when temporarily unlisted on gateway) so that settings.json
    // and enabledModels do not trigger "No models match pattern" warnings.
    for (const [id, spec] of Object.entries(KNOWN_MODEL_SPECS)) {
      if (DECOMMISSIONED_MODEL_IDS.has(id)) continue;
      if (!processed.has(id)) {
        processed.add(id);
        const modelObj: any = {
          id: spec.id,
          name: spec.name,
          reasoning: spec.reasoning,
          input: spec.input || ["text"],
          contextWindow: spec.contextWindow,
          maxTokens: spec.maxTokens,
          cost: spec.cost || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          compat: spec.compat || { sendSessionAffinityHeaders: true },
        };
        if (spec.thinkingLevelMap) {
          modelObj.thinkingLevelMap = { ...spec.thinkingLevelMap };
        }
        if (spec.api) {
          modelObj.api = spec.api;
        }
        if (spec.headers) {
          modelObj.headers = { ...spec.headers };
        }
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
        sendSessionAffinityHeaders: false,
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
    const payload = event.payload;
    const provider = (
      (payload as any)?.provider ||
      (event as any)?.model?.provider ||
      ctx?.model?.provider ||
      ""
    ).toLowerCase();
    const baseUrl = (
      (payload as any)?.baseUrl ||
      (event as any)?.model?.baseUrl ||
      (ctx?.model as any)?.baseUrl ||
      ""
    );
    const modelId = (
      (payload as any)?.model ||
      (event as any)?.model?.id ||
      ctx?.model?.id ||
      ""
    ).toLowerCase();

    const isAR = isAgentRouter(provider, baseUrl);

    // Apply per-provider pacing only for AgentRouter requests
    if (isAR) {
      const lastEnd = getLastRequestEndTime("agentrouter");
      const now = Date.now();
      const elapsed = now - lastEnd;
      if (lastEnd > 0 && elapsed < minIntervalMs) {
        const waitMs = minIntervalMs - elapsed;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }

    if (payload) {
      if (Array.isArray(payload.messages)) payload.messages = structuredClone(payload.messages);
      if (Array.isArray(payload.input)) payload.input = structuredClone(payload.input);
      if (Array.isArray(payload.system)) payload.system = structuredClone(payload.system);
      const isDeepSeek = isDeepSeekRequest(event, ctx);

      if (isCompactionPayload(payload)) {
        sanitizeCompactionPayload(payload);
        const messages = Array.isArray(payload.messages) ? payload.messages : payload.input;
        if (Array.isArray(messages) && messages.length > 0) {
          if (isAR) {
            normalizeMessagesForAgentRouter(messages, isDeepSeek);
            if (isDeepSeek) {
              frameUserTurnsForDeepSeek(messages);
            }
          }
        }
      } else {
        if (isAR && payload.system !== undefined) {
          payload.system = enforceCanonicalRootPrompt(payload.system);
        }

        if (isAR) {
          applyPoisonRedaction(payload);
        }

        const isResponses = Array.isArray(payload.input) && !Array.isArray(payload.messages);
        if (isResponses) {
          if (isAR) {
            sanitizeResponsesInput(payload.input);
            if ("previous_response_id" in payload) {
              delete payload.previous_response_id;
            }
          }
        } else {
          const messages = Array.isArray(payload.messages) ? payload.messages : payload.input;
          if (Array.isArray(messages) && messages.length > 0) {
            if (isAR) {
              normalizeMessagesForAgentRouter(messages, isDeepSeek);

              if (isDeepSeek) {
                frameUserTurnsForDeepSeek(messages);
              }

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
          }
        }
      }
      if (isAR && Array.isArray(payload.tools) && payload.tools.length > 0) {
        sanitizeOpenAiTools(payload.tools);
      }
      if (isAR && Array.isArray(payload.input)) {
        sanitizeResponsesInput(payload.input);
      }
    }
    return payload;
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
    const isRecentWaf = Date.now() - lastWafBlockTime < 15000;
    if (!WAF_BLOCK_RE.test(errorMessage) && !isRecentWaf) return;

    escalatePending = true;
    if (SENSITIVE_WORDS_RE.test(errorMessage) || isRecentWaf) {
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
        activeMinIntervalMs = val;
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
              isAnthropic:
                KNOWN_MODEL_SPECS[p.model_name]?.providerType === "anthropic" ||
                p.model_name.toLowerCase().startsWith("claude") ||
                (p.supported_endpoint_types.includes("anthropic") && !p.supported_endpoint_types.includes("openai")),
            }))
          : [
              { id: "gpt-6.1-sol", isAnthropic: false },
              { id: "gpt-6-astra", isAnthropic: false },
              { id: "gpt-5.6-sol", isAnthropic: false },
              { id: "claude-opus-5-5", isAnthropic: true },
              { id: "deepseek-v4-flash", isAnthropic: false },
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

        let hasNotInToken = false;
        report += `Model Status:\n`;
        for (const res of probeResults) {
          if (res.status === "READY") {
            report += `  🟢 ${res.model.padEnd(20)}: Ready (200 OK - Quota available)\n`;
          } else if (res.status === "QUOTA_EXHAUSTED") {
            report += `  ⏳ ${res.model.padEnd(20)}: Batch Quota Exhausted (402) - Next batch drop soon\n`;
          } else if (res.status === "NOT_IN_TOKEN") {
            hasNotInToken = true;
            report += `  🔑 ${res.model.padEnd(20)}: Not Added to Token (403) - Enable in dashboard\n`;
          } else if (res.status === "FORBIDDEN") {
            report += `  🔴 ${res.model.padEnd(20)}: Forbidden (403) - Token has no permissions\n`;
          } else {
            report += `  ⚠️ ${res.model.padEnd(20)}: ${res.message || "Error (" + res.code + ")"}\n`;
          }
        }

        if (hasNotInToken) {
          report += `\n🔑 To enable missing models: go to agentrouter.org -> Tokens (令牌), edit your token and select them to grant access.\n`;
        }

        report +=
          `\nTip: gpt-6.1-sol has unlimited all-day availability. Quotas refresh daily for Claude Opus 5.5 (09:00 Beijing) and GPT-6 Astra (03:00 & 15:00 Beijing).`;

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
        `[AgentRouter Plugin v2.4.0]\n` +
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
