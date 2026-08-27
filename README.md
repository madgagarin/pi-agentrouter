# @madgagarin/pi-agentrouter

[![npm version](https://img.shields.io/npm/v/@madgagarin/pi-agentrouter.svg?color=blue)](https://www.npmjs.com/package/@madgagarin/pi-agentrouter)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Pi Plugin](https://img.shields.io/badge/Pi-Extension-purple.svg)](https://pi.dev)
[![AgentRouter Gateway](https://img.shields.io/badge/Gateway-agentrouter.org-orange.svg)](https://agentrouter.org)

Use **GPT-5.6 Sol**, **Claude Opus 5**, **Claude Opus 4.8**, **DeepSeek V4 Flash**, and **GLM 5.3** in your [Pi Coding Agent](https://pi.dev) using a single API key from [AgentRouter](https://agentrouter.org).

> 🎁 **Free Trial Credits:** New to AgentRouter? Get up to **$175 in free credits** (including a **+$50 bonus**) to test GPT-5.6, Claude Opus 5, and DeepSeek V4 — no credit card needed. That's enough for **over 80,000,000 tokens** on DeepSeek V4!  
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

## Why use this plugin?

[AgentRouter](https://agentrouter.org) ([agentrouter.org](https://agentrouter.org)) provides affordable unified access to frontier LLMs, but using raw OpenAI/Anthropic proxy configurations in Pi often runs into edge cases: Cloudflare WAF checks, rate-limit bursts from parallel subagents, prompt caching cache misses, and role naming conflicts.

This plugin fixes all of that automatically:

- **Live USD Pricing in Pi:** Pulls current rates from [agentrouter.org/api/pricing](https://agentrouter.org/api/pricing) on startup so Pi's built-in cost tracking shows your exact spend in dollars.
- **Live Quota Monitor (`/agentrouter check`):** Quick health check that pings all models to see if daily batch quotas are open, and displays your monthly usage in USD.
- **1M Context Windows:** All models are configured with their full 1,048,576 token context limits and native reasoning/adaptive thinking.
- **Cross-Process Rate Pacing:** Uses a shared lock file (`~/.pi/agent/.agentrouter-pacing`) so background subagents (`pi-subagents`) and the main chat won't trip 429 rate limits.
- **Zero 400 & 401 Errors:** Handles canonical `pi-code` prompt header placement for WAF authorization and automatically normalizes OpenAI `developer` roles to `system`.
- **High Cache Hit Rates (>80%):** Preserves session affinity headers and disables destructive prompt rewriting on AgentRouter routes.

---

## Models & Pricing

Rates are pulled directly from the [agentrouter.org](https://agentrouter.org) gateway API ($2.00 / 1M tokens base unit):

| Model | Provider | Context | Output | Reasoning | Input / 1M | Output / 1M | Quota Policy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `deepseek-v4-flash` | `agentrouter-openai` | 1M | 64K | Yes | $2.00 | $6.00 | Unlimited |
| `glm-5.3` | `agentrouter-openai` | 1M | 128K | Yes | $3.00 | $12.00 | Unlimited |
| `gpt-5.6-sol` | `agentrouter-openai` | 1M | 128K | Yes | $3.00 | $15.00 | Daily batch drops |
| `claude-opus-5` | `agentrouter-clode` | 1M | 64K | Yes (Adaptive) | $8.00 | $40.00 | Daily batch drops |
| `claude-opus-4-8` | `agentrouter-clode` | 1M | 64K | Yes (Adaptive) | $8.00 | $40.00 | Daily batch drops |

*Note: Claude and GPT models are released in daily batches on AgentRouter. If you hit a 402, run `/agentrouter check` to verify, and switch to `deepseek-v4-flash` or `glm-5.3` for unlimited coding.*

---

## In-Chat Commands

| Command | What it does |
| :--- | :--- |
| `/agentrouter` | Overview of active model, current monthly USD spend, package order, and pacing delay. |
| `/agentrouter check` | Live preflight probe of all model quotas (200 OK vs 402) and monthly usage. |
| `/agentrouter pricing` | Fetches and prints the latest official pricing table from [agentrouter.org](https://agentrouter.org). |
| `/agentrouter key <key>` | Sets API key and syncs it across `agentrouter.json` and Pi's `auth.json`. |
| `/agentrouter pacing <ms>` | Sets delay between consecutive requests (default: `3500` ms). |
| `/agentrouter fix-order` | Places this plugin above `pi-cache-optimizer` in `settings.json` if needed. |
| `/compact` | Compresses chat history safely without 401 authorization drops. |

---

## Keybindings

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + P` | Cycle to next model (`deepseek-v4-flash` ➔ `glm-5.3` ➔ `gpt-5.6-sol` ➔ `claude-opus-5` ➔ `claude-opus-4-8`) |
| `Shift + Ctrl + P` | Cycle to previous model |
| `Shift + Tab` | Toggle reasoning depth (`off` ➔ `minimal` ➔ `low` ➔ `medium` ➔ `high`) |
| `Ctrl + T` | Toggle reasoning block visibility |
| `Ctrl + L` | Fuzzy-search model picker |

---

## Recommended `settings.json`

Add this to `~/.pi/agent/settings.json` for convenient model switching:

```json
{
  "defaultProvider": "agentrouter-openai",
  "defaultModel": "deepseek-v4-flash",
  "defaultThinkingLevel": "low",
  "enabledModels": [
    "agentrouter-openai/deepseek-v4-flash",
    "agentrouter-openai/glm-5.3",
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
