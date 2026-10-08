# @madgagarin/pi-agentrouter

[![npm version](https://img.shields.io/npm/v/@madgagarin/pi-agentrouter.svg?color=blue)](https://www.npmjs.com/package/@madgagarin/pi-agentrouter)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Pi Plugin](https://img.shields.io/badge/Pi-Extension-purple.svg)](https://pi.dev)

Pi Coding Agent extension for [AgentRouter](https://agentrouter.org). Adds support for DeepSeek V4 Flash, Claude Opus 5, GPT-6 Astra, and GLM 5.3 with in-flight WAF auto-recovery, automatic retry orchestration, prompt caching optimization, and live pricing.

> AgentRouter provides free trial credits on registration at [agentrouter.org](https://agentrouter.org/register?aff=34dc).

---

## Features

- **Multi-model access with one key:** Use DeepSeek V4 Flash, Claude Opus 5/4.8, GPT-6 Astra, and GPT-5.6 Sol through a single endpoint. No need to manage separate billing accounts across OpenAI, Anthropic, and DeepSeek. Switch models in Pi with `Ctrl+P`.
- **Automatic error recovery (no crashed runs):** Intercepts transient gateway errors (rate limits, 500/503, thinking-mode 400/422 validation issues) and retries up to 10 times with exponential backoff and unpinned session headers. Long autonomous tasks continue running instead of aborting midway.
- **Prompt caching optimization (~90% cost reduction):** Enforces strict prefix stability across requests so DeepSeek and Claude prompt caches hit ~95% in multi-turn sessions, significantly reducing input token costs.
- **Context compaction cleanup:** Automatically strips raw tool output dumps and internal thinking traces when running `/compact`, shrinking the payload by 80–90% without losing instructions.
- **Live batch quota probe (`/agentrouter check`):** Premium models (Claude Opus, GPT-6) use periodic batch quotas on AgentRouter. Instead of guessing or getting 402 errors mid-run, run `/agentrouter check` to test live availability across all models in parallel (🟢 Ready vs ⏳ Exhausted) and inspect your total monthly spend in USD.
- **In-flight WAF auto-recovery & false-positive bypass:** Transparently catches upstream content filter triggers (`400 content-blocked`, `500 sensitive words detected`, `405 challenge`), proactively sanitizes raw binary dumps (ELF executables, null-byte sequences), performs non-destructive tool result redaction while strictly preserving tool call arguments and assistant history, and frames prompts with language preambles without losing user instructions or breaking context.
- **Spend tracking & pricing sync:** Queries current rates from the gateway on startup, updates settings automatically, and keeps model catalogs in sync.
- **Granular provider rate pacing:** Coordinates requests across concurrent subagents via local lock files (`~/.pi/agent/.agentrouter-pacing`), isolated per provider so that non-AgentRouter models (Anthropic, Gemini, Ollama) are never throttled.
- **Isolated credentials:** Stores keys in `agentrouter-*` namespaces in `auth.json` without modifying default provider keys.

---

## Quick Start

### 1. Get an API key

Create an account at [agentrouter.org](https://agentrouter.org/register?aff=34dc) and copy your `sk-...` key from the dashboard.

### 2. Install the extension

```bash
pi install npm:@madgagarin/pi-agentrouter
```

### 3. Set your key in Pi chat

```text
/agentrouter key sk-your-agentrouter-key
```

Or export it in your shell profile:

```bash
export AGENTROUTER_API_KEY="sk-your-agentrouter-key"
```

---

## Models & Pricing

Rates are pulled dynamically from the gateway API ($2.00 / 1M tokens base unit):

| Model | Provider | Context | Output | Reasoning | Input / 1M | Output / 1M | Cache Read / 1M | Quota Policy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `deepseek-v4-flash` | `agentrouter-openai` | 1M | 64K | Yes | $4.00 | $12.00 | $2.00 | Unlimited |
| `glm-5.3` | `agentrouter-openai` | 1M | 128K | Yes | $3.00 | $12.00 | - | Unlimited |
| `gpt-6-astra` | `agentrouter-openai` | 1M | 128K | Yes | $3.00 | $15.00 | - | Daily batch drops |
| `gpt-5.6-sol` | `agentrouter-openai` | 1M | 128K | Yes | $3.00 | $15.00 | - | Daily batch drops |
| `claude-opus-5` | `agentrouter-clode` | 1M | 64K | Yes (Adaptive) | $6.00 | $30.00 | - | Daily batch drops |
| `claude-opus-4-8` | `agentrouter-clode` | 1M | 64K | Yes (Adaptive) | $8.00 | $40.00 | - | Daily batch drops |

Claude and GPT quotas are released in batches throughout the day. When a batch is consumed (HTTP 402), check availability with `/agentrouter check` or switch to unlimited models (`deepseek-v4-flash` / `glm-5.3`).

---

## In-Chat Commands

| Command | Description |
| :--- | :--- |
| `/agentrouter` | Show active model, monthly spend, extension ordering, and pacing delay. |
| `/agentrouter check` | Probe live batch quota status across all models (🟢 Ready vs ⏳ 402 Exhausted) and show monthly spend. |
| `/agentrouter pricing` | Display current pricing table from the gateway. |
| `/agentrouter sync` | Add active flagship models to `enabledModels` in `settings.json`. |
| `/agentrouter key <key>` | Save API key to configuration. |
| `/agentrouter pacing <ms>` | Set delay between requests (default: `3500` ms). |
| `/agentrouter fix-order` | Ensure extension loads before `pi-cache-optimizer` in `settings.json`. |
| `/compact` | Compact session history with stripped reasoning traces and file dumps. |

---

## Keybindings

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + P` | Cycle to next model (`deepseek-v4-flash` ➔ `gpt-6-astra` ➔ `gpt-5.6-sol` ➔ `claude-opus-5` ➔ `claude-opus-4-8`) |
| `Shift + Ctrl + P` | Cycle to previous model |
| `Shift + Tab` | Change reasoning depth (`off` ➔ `minimal` ➔ `low` ➔ `medium` ➔ `high`) |
| `Ctrl + T` | Toggle reasoning visibility |
| `Ctrl + L` | Fuzzy-search model picker |

---

## Recommended `settings.json`

Add this to `~/.pi/agent/settings.json` for quick model switching:

```json
{
  "defaultProvider": "agentrouter-openai",
  "defaultModel": "deepseek-v4-flash",
  "defaultThinkingLevel": "low",
  "enabledModels": [
    "agentrouter-openai/deepseek-v4-flash",
    "agentrouter-openai/gpt-6-astra",
    "agentrouter-openai/gpt-5.6-sol",
    "agentrouter-clode/claude-opus-5",
    "agentrouter-clode/claude-opus-4-8"
  ]
}
```

---

## FAQ

#### How does error recovery work?
The extension intercepts requests at the transport level. If the gateway returns a temporary error (such as a 429 rate limit, 405 WAF challenge, 500/503 service issue, thinking validation mismatch, or WAF content-blocked error), it strips sticky routing headers to failing nodes, proactively strips binary dumps, performs non-destructive in-flight poison redaction on tool results while preserving all tool arguments and assistant turns, waits with exponential backoff, and retries up to 10 times. Diagnostic events are logged to `~/.pi/agent/.agentrouter-debug.log`.

#### Why does prompt caching matter?
DeepSeek charges ~$0.014 per 1M cached input tokens versus ~$0.14 for uncached ones. Because this extension prevents dynamic prompt rewrites and ensures prefix determinism, multi-turn coding sessions routinely achieve 95%+ cache hit rates, saving substantial costs over long runs.

#### How do batch quotas and `/agentrouter check` work?
AgentRouter releases daily quotas for premium models (Claude Opus 5, GPT-6 Astra) in periodic batch drops. When a batch is fully consumed, the API returns HTTP 402. Running `/agentrouter check` sends lightweight live health probes to all models in parallel, immediately displaying which models are Ready (🟢 200 OK) or Exhausted (⏳ 402), along with your current monthly spend in USD. If a premium batch is empty, switch to `deepseek-v4-flash` or `glm-5.3` which have unlimited capacity.

#### Does pacing slow down other providers?
No. Request pacing is isolated per provider via dedicated lock files and applied exclusively to requests routed to `agentrouter.org`. Direct provider connections (Google Gemini, Anthropic, local Ollama) run without pacing delays.

#### Using custom subagents (`pi-subagents`)
AgentRouter validates requests against the `pi-code` signature. If you define custom subagents in `~/.pi/agent/agents/*.md`, set `systemPromptMode: append` in their frontmatter.

---

## License

MIT © [madgagarin](https://github.com/madgagarin)
