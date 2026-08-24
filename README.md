# pi-agentrouter

[![npm version](https://img.shields.io/npm/v/@madgagarin/pi-agentrouter.svg?color=blue)](https://www.npmjs.com/package/@madgagarin/pi-agentrouter)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Pi Plugin](https://img.shields.io/badge/Pi-Extension-purple.svg)](https://pi.dev)
**`pi-agentrouter`** seamlessly connects 4 powerful flagship AI coding models (**GPT-5.6 Sol**, **Claude Opus 4.8**, **Claude Opus 5**, and **DeepSeek V4F**) to your [Pi Coding Agent](https://pi.dev) using a single, unified API key from [AgentRouter](https://agentrouter.org).

### 💡 Why use this plugin?
* 🔑 **All 4 Top Models in One Place:** Instantly switch between GPT-5.6 Sol, Claude Opus 4.8, Claude Opus 5, and DeepSeek V4F without managing separate subscriptions or multiple API keys.
* 💰 **Save up to 80% on Tokens:** Smart prompt caching and session affinity drastically cut token usage and speed up responses.
* ⚡ **Zero-Config Setup:** Installs in seconds — all models are automatically registered with native reasoning, tool calling, and thinking support.
* 🛡️ **Built-in Stability:** Automatic cross-process pacing and authentication guards eliminate 401 and 429 errors during long coding sessions and multi-agent tasks.

---

## 🎁 Free Credits & Author Referral Bonus

AgentRouter is a non-profit AI API gateway providing unified access to cutting-edge models:

* **Increased Trial Credits:** By signing up through the referral link below, you unlock **increased trial credits (up to $175 / extra +$50 bonus)** to explore GPT-5.6 Sol, Claude Opus, and DeepSeek models.
* **Support the Author:** Using this link directly supports the author and the ongoing maintenance of this open-source plugin!

👉 **[Sign up on AgentRouter (Referral Link with Bonus)](https://agentrouter.org/register?aff=34dc)** 👈

*(If you already have an account, you can obtain your API key directly from your [AgentRouter Dashboard](https://agentrouter.org/dashboard)).*

---

## ✨ Features

- 🔑 **Unified API Key**: Use a single `sk-...` (or custom token) for all models—both OpenAI GPT, DeepSeek, and Anthropic Claude endpoints are authenticated seamlessly.
- 🚀 **Zero-Config Model Auto-Registration**: Automatically registers:
  - `agentrouter-openai/gpt-5.6-sol` (1M Context Window, Native Reasoning, Session Affinity).
  - `agentrouter-openai/deepseek-v4f` (128K Context Window, Reasoning Support, Session Affinity).
  - `agentrouter-clode/claude-opus-4-8` (512K Context Window, Adaptive Thinking, Empty Signature Compat).
  - `agentrouter-clode/claude-opus-5` (1M Context Window, Adaptive Thinking, Empty Signature Compat).
- 🛡️ **Cross-Process Request Pacing**: Shared file-based rate limiter (`~/.pi/agent/.agentrouter-pacing`) synchronizing delays across concurrent subagents, background workers, and the main Pi process to prevent WAF burst blocks.
- 🔒 **Transport-Level Root Prompt Guard**: Enforces canonical `pi-code` harness header at `index: 0` on every outbound request (`before_provider_request`), preventing 401 unauthorized client errors across multi-turn tool executions.
- ⚡ **Optimized Prompt Caching & Dynamic Bypass**: Automatically disables aggressive prompt rewriting on AgentRouter routes (`PI_CACHE_OPTIMIZER_NO_PROMPT_REWRITE=1`) while preserving session affinity headers, achieving **>80% cache hit rates** on consecutive turns.
- 📋 **Package Priority Guard & Auto-Fix**: Automatically checks package order in `settings.json` on startup and offers interactive one-click placement directly above `pi-cache-optimizer`.
- 📦 **Seamless Compaction (Fixes 401)**: Solves the `401 unauthorized client` error during `/compact` by ensuring valid Pi client fingerprint headers are passed during summarization.
- ⌨️ **Interactive Terminal Controls**: Change API keys, adjust throttle pacing, fix package priority, and cycle through models or thinking depths directly in the TUI.

---

## 🚀 Installation

### Option 1: Install via npm (Recommended)
```bash
pi install npm:@madgagarin/pi-agentrouter
```

### Option 2: Install directly from GitHub
```bash
pi install git:github.com/madgagarin/pi-agentrouter
```

### Option 3: Local Installation
```bash
pi install /path/to/pi-agentrouter
```

---

## ⚙️ Configuration

### 1. Set Your API Key

**Option A: Inside Pi Chat (Easiest)**
Simply set it directly inside your interactive Pi chat session:
```text
/agentrouter key sk-your-agentrouter-key
```

**Option B: Environment Variable**
Alternatively, export the environment variable in your `~/.bashrc` or `~/.zshrc`:
```bash
export AGENTROUTER_API_KEY="sk-your-agentrouter-key"
```

---

### 2. Configure Model Cycling (`settings.json`)

To enable quick model cycling with `Ctrl+P` and set default thinking levels, add the following to `~/.pi/agent/settings.json`:

```json
{
  "defaultProvider": "agentrouter-openai",
  "defaultModel": "gpt-5.6-sol",
  "defaultThinkingLevel": "medium",
  "enabledModels": [
    "agentrouter-openai/gpt-5.6-sol",
    "agentrouter-openai/deepseek-v4f",
    "agentrouter-clode/claude-opus-4-8",
    "agentrouter-clode/claude-opus-5"
  ]
}
```

---

## ⌨️ Hotkeys & Shortcuts

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Ctrl + P` | 🔄 **Next Model** | Cycles to the next model (`gpt-5.6-sol` ➔ `deepseek-v4f` ➔ `claude-opus-4-8` ➔ `claude-opus-5`). |
| `Shift + Ctrl + P` | 🔄 **Previous Model** | Cycles to the previous model. |
| `Shift + Tab` | 🧠 **Cycle Thinking Level** | Toggles reasoning depth: `off` ➔ `minimal` ➔ `low` ➔ `medium` ➔ `high`. |
| `Ctrl + T` | 👁 **Toggle Thinking Visibility** | Collapses or expands thinking/reasoning blocks on screen. |
| `Ctrl + L` | 📋 **Model Selector** | Opens interactive fuzzy-search model picker. |

---

## 🛠️ In-Chat Commands

* `/agentrouter` — View current plugin status, active model, priority position, masked key, and pacing interval.
* `/agentrouter key <your-key>` — Update API key for all AgentRouter models on the fly.
* `/agentrouter pacing <ms>` — Adjust the minimum delay between consecutive requests (default: `3500` ms).
* `/agentrouter fix-order` — Automatically reorder `settings.json` packages to place this plugin directly before `pi-cache-optimizer`.
* `/compact` — Compress conversation history safely without 401 authorization errors.

---

## ❓ FAQ & Troubleshooting

#### Q: Why does `/compact` fail on raw proxy configurations?
AgentRouter performs client fingerprint verification. Raw summarization requests without Pi's standard prompt signatures get rejected with `401 unauthorized client`. This plugin intercepts the `session_before_compact` event and automatically injects proper authentication signatures.

#### Q: Does the 3.5s pacing delay affect local or other cloud models?
No. The pacing logic specifically filters for AgentRouter endpoints (`isAgentRouter`). Native OpenAI, Anthropic, Gemini, or local models run at full speed without delay.

#### Q: How to use custom subagents with AgentRouter?
AgentRouter strictly verifies client authenticity (`pi-code` / `claude-code` prompt signature). If you define custom subagents in extensions like `pi-subagents`, make sure to specify `systemPromptMode: append` in your agent definition frontmatter so the base Pi system prompt identity is preserved.

---

## 📄 License

MIT © [madgagarin](https://github.com/madgagarin)
