# @madgagarin/pi-agentrouter

[![npm version](https://img.shields.io/npm/v/@madgagarin/pi-agentrouter.svg?color=blue)](https://www.npmjs.com/package/@madgagarin/pi-agentrouter)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Pi Plugin](https://img.shields.io/badge/Pi-Extension-purple.svg)](https://pi.dev)
[![AgentRouter Gateway](https://img.shields.io/badge/Gateway-agentrouter.org-orange.svg)](https://agentrouter.org)

Use **GPT-6 Astra**, **GPT-5.6 Sol**, **Claude Opus 5**, **Claude Opus 4.8**, and **DeepSeek V4 Flash** in your [Pi Coding Agent](https://pi.dev) using a single API key from [AgentRouter](https://agentrouter.org).

> 🎁 **Free Trial Credits:** New to AgentRouter? Get up to **$175 in free credits** (including a **+$50 bonus**) to test GPT-6 Astra, Claude Opus 5, and DeepSeek V4 — no credit card needed. That's enough for **millions of tokens** on DeepSeek V4!  
> 👉 **[Claim your free trial credits on AgentRouter.org →](https://agentrouter.org/register?aff=34dc)**

---

## Quick Start

### 1. Get your API key

Create an account on [agentrouter.org](https://agentrouter.org/register?aff=34dc) to get your free trial credits and copy your `sk-...` key from the dashboard.

### 2. Install the extension

```bash
pi install npm:@madgagarin/pi-agentrouter
```

### 3. Activate in Pi chat

```text
/agentrouter key sk-your-agentrouter-key
```

*(Or set `export AGENTROUTER_API_KEY="sk-..."` in your shell).*

---

## Features

- **Model Synchronization:** Automatically registers and adds active models to `enabledModels` in `settings.json` for quick selection via `Ctrl+P`.
- **DeepSeek Multi-Turn Tool Calling:** Preserves `reasoning_content` and handles thinking blocks across multi-step tool execution, avoiding API 400 errors.
- **Schema Sanitization:** Automatically normalizes tool definitions (e.g. converting `required: null` to empty arrays) for strict OpenAI schema validation compatibility.
- **WAF Diagnostics:** Intercepts upstream `content-blocked` responses and displays a clear notification in the terminal and UI.
- **Dual Endpoint Protocols:** Supports both OpenAI (`agentrouter-openai`) and Anthropic Messages API (`agentrouter-clode`) routes for models like `deepseek-v4-flash`.
- **Isolated Credential Storage:** Manages API keys exclusively within `agentrouter-*` provider namespaces in `auth.json` without modifying default third-party provider keys.
- **Live Pricing & Quota Probing:** Fetches current rates from the gateway API on startup and provides `/agentrouter check` to probe model availability and track usage.
- **Subagent Rate Pacing:** Uses a file-based lock (`~/.pi/agent/.agentrouter-pacing`) across concurrent subagents to prevent 429 rate limit errors.
- **Prompt Caching Compatibility:** Preserves affinity headers and formatting required for upstream prompt cache reuse.

---

## Models & Pricing

Rates are fetched from the [agentrouter.org](https://agentrouter.org) gateway API ($2.00 / 1M tokens base unit):

| Model | Provider | Context | Output | Reasoning | Input / 1M | Output / 1M | Quota Policy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `deepseek-v4-flash` | `agentrouter-openai` / `agentrouter-clode` | 1M | 64K | Yes | $4.00 | $12.00 | Unlimited |
| `glm-5.3` | `agentrouter-openai` | 1M | 128K | Yes | $3.00 | $12.00 | Unlimited |
| `gpt-6-astra` | `agentrouter-openai` | 1M | 128K | Yes | $3.00 | $15.00 | Daily batch drops |
| `gpt-5.6-sol` | `agentrouter-openai` | 1M | 128K | Yes | $3.00 | $15.00 | Daily batch drops |
| `claude-opus-5` | `agentrouter-clode` | 1M | 64K | Yes (Adaptive) | $6.00 | $30.00 | Daily batch drops |
| `claude-opus-4-8` | `agentrouter-clode` | 1M | 64K | Yes (Adaptive) | $8.00 | $40.00 | Daily batch drops |

*Note: Claude and GPT models are released in daily batches on AgentRouter. When a batch is exhausted (HTTP 402), use `/agentrouter check` to monitor status or switch to `deepseek-v4-flash` / `glm-5.3` for unrestricted usage.*

---

## In-Chat Commands

| Command | Description |
| :--- | :--- |
| `/agentrouter` | Show active model, current monthly spend, extension ordering, and pacing delay. |
| `/agentrouter check` | Probe model availability (200 OK vs 402) and display monthly usage. |
| `/agentrouter pricing` | Display current pricing table from [agentrouter.org](https://agentrouter.org). |
| `/agentrouter sync` | Sync active flagship models into `enabledModels` in `settings.json`. |
| `/agentrouter key <key>` | Set API key and store it in `agentrouter.json` and `auth.json`. |
| `/agentrouter pacing <ms>` | Configure delay between requests (default: `3500` ms). |
| `/agentrouter fix-order` | Reorder extension before `pi-cache-optimizer` in `settings.json` if necessary. |
| `/compact` | Compact conversation history while preserving required gateway headers. |

---

## Keybindings

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + P` | Cycle to next model (`deepseek-v4-flash` ➔ `gpt-6-astra` ➔ `gpt-5.6-sol` ➔ `claude-opus-5` ➔ `claude-opus-4-8`) |
| `Shift + Ctrl + P` | Cycle to previous model |
| `Shift + Tab` | Toggle reasoning depth (`off` ➔ `minimal` ➔ `low` ➔ `medium` ➔ `high`) |
| `Ctrl + T` | Toggle reasoning block visibility |
| `Ctrl + L` | Fuzzy-search model picker |

---

## Recommended `settings.json`

Add this to `~/.pi/agent/settings.json` for model switching:

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

## Notes & FAQ

#### How does quota batching work on Claude / GPT?
AgentRouter releases daily quotas for Claude Opus and GPT-5.6 in batches throughout the day. When a batch is fully consumed, the API returns `402`. Run `/agentrouter check` to see if a batch is active, or use `deepseek-v4-flash` / `glm-5.3` which have unlimited capacity.

#### Does pacing affect other models?
No. Request pacing only applies when talking to `agentrouter.org` endpoints. Local models or direct OpenAI/Google providers run at full speed.

#### Using custom subagents (`pi-subagents`)
AgentRouter requires the base `pi-code` prompt signature for authentication. If you create custom subagents in `~/.pi/agent/agents/*.md`, make sure their frontmatter uses `systemPromptMode: append`.

---

## License

MIT © [madgagarin](https://github.com/madgagarin)

