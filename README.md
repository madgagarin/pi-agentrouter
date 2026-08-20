# @madgagarin/pi-agentrouter

[![npm version](https://img.shields.io/npm/v/@madgagarin/pi-agentrouter.svg?color=blue)](https://www.npmjs.com/package/@madgagarin/pi-agentrouter)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Pi Plugin](https://img.shields.io/badge/Pi-Extension-purple.svg)](https://pi.dev)

A native, zero-config extension for the [Pi Coding Agent](https://pi.dev) that connects and optimizes [AgentRouter](https://agentrouter.org) models (GPT-5.6 Sol, Claude Opus 4.8 / 5) with built-in WAF rate-limit pacing, client fingerprint preservation, prompt caching, and seamless compaction.

---

## 🎁 Free Credits & Author Referral Bonus

AgentRouter is a non-profit AI API gateway providing unified access to cutting-edge models:

* **Increased Trial Credits:** By signing up through the referral link below, you unlock **increased trial credits (up to $175 / extra +$50 bonus)** to explore GPT-5.6 Sol and Claude Opus models.
* **Support the Author:** Using this link directly supports the author and the ongoing maintenance of this open-source plugin!

👉 **[Sign up on AgentRouter (Referral Link with Bonus)](https://agentrouter.org/register?aff=34dc)** 👈

*(If you already have an account, you can obtain your API key directly from your [AgentRouter Dashboard](https://agentrouter.org/dashboard)).*

---

## ✨ Features

- 🔑 **Unified API Key**: Use a single `sk-...` (or custom token) for all models—both OpenAI GPT and Anthropic Claude endpoints are authenticated seamlessly.
- 🚀 **Zero-Config Model Auto-Registration**: Automatically registers:
  - `agentrouter-openai/gpt-5.6-sol` (1M Context Window, Native Reasoning, Session Affinity).
  - `agentrouter-clode/claude-opus-4-8` (512K Context Window, Adaptive Thinking).
  - `agentrouter-clode/claude-opus-5` (1M Context Window, Adaptive Thinking).
- ⚡ **Optimized Prompt Caching**: Bundles and configures session affinity headers and thinking structures, achieving **>80% cache hit rates** on consecutive turns.
- 🛡️ **WAF & Rate-Limit Pacing**: Smart 2.5s throttling applied specifically to AgentRouter calls to avoid cloud WAF / 405 rate-limit blocks.
- 📦 **Seamless Compaction (Fixes 401)**: Solves the `401 unauthorized client` error during `/compact` by ensuring valid Pi client fingerprint headers are passed during summarization.
- ⌨️ **Interactive Terminal Controls**: Change API keys, adjust throttle pacing, and cycle through models or thinking depths directly in the TUI.

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
    "agentrouter-clode/claude-opus-4-8",
    "agentrouter-clode/claude-opus-5"
  ]
}
```

---

## ⌨️ Hotkeys & Shortcuts

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Ctrl + P` | 🔄 **Next Model** | Cycles to the next model (`gpt-5.6-sol` ➔ `claude-opus-4-8` ➔ `claude-opus-5`). |
| `Shift + Ctrl + P` | 🔄 **Previous Model** | Cycles to the previous model. |
| `Shift + Tab` | 🧠 **Cycle Thinking Level** | Toggles reasoning depth: `off` ➔ `minimal` ➔ `low` ➔ `medium` ➔ `high`. |
| `Ctrl + T` | 👁 **Toggle Thinking Visibility** | Collapses or expands thinking/reasoning blocks on screen. |
| `Ctrl + L` | 📋 **Model Selector** | Opens interactive fuzzy-search model picker. |

---

## 🛠️ In-Chat Commands

* `/agentrouter` — View current plugin status, active model, masked key, and pacing interval.
* `/agentrouter key <your-key>` — Update API key for all AgentRouter models on the fly.
* `/agentrouter pacing <ms>` — Adjust the minimum delay between consecutive requests (default: `2500` ms).
* `/compact` — Compress conversation history safely without 401 authorization errors.

---

## ❓ FAQ & Troubleshooting

#### Q: Why does `/compact` fail on raw proxy configurations?
AgentRouter performs client fingerprint verification. Raw summarization requests without Pi's standard prompt signatures get rejected with `401 unauthorized client`. This plugin intercepts the `session_before_compact` event and automatically injects proper authentication signatures.

#### Q: Does the 2.5s pacing delay affect local or other cloud models?
No. The pacing logic specifically filters for AgentRouter endpoints (`isAgentRouter`). Native OpenAI, Anthropic, Gemini, or local models run at full speed without delay.

---

## 📄 License

MIT © [madgagarin](https://github.com/madgagarin)
