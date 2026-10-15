# @madgagarin/pi-agentrouter

[![npm version](https://img.shields.io/npm/v/@madgagarin/pi-agentrouter.svg?color=blue)](https://www.npmjs.com/package/@madgagarin/pi-agentrouter)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Pi Plugin](https://img.shields.io/badge/Pi-Extension-purple.svg)](https://pi.dev)

Pi Coding Agent extension for [AgentRouter](https://agentrouter.org). Adds support for Claude Opus 5.5, GPT-6.1 Sol, GPT-6 Astra, and DeepSeek V4 Flash with in-flight WAF recovery, prompt caching optimization, and live quota monitoring.

---

## Why this extension exists

If you configure AgentRouter as a generic OpenAI or Anthropic endpoint in Pi, you will run into several recurring issues:

1. **Gateway content filters lock up sessions:** AgentRouter's upstream gateway blocks requests containing binary output (such as reading a `.so` or compiled file) or certain keywords with `400 content-blocked` or `500 sensitive words detected`. Because Pi sends previous conversation turns with each request, that error stays in context and every subsequent retry fails. **This extension catches the error, redacts the problematic output from in-memory history, and retries cleanly.**
2. **Prompt caching errors & extra costs:** Standard Anthropic caching headers (`cache_control`) trigger `400 Bad Request` on non-Anthropic endpoints, and changing prompt prefixes invalidates DeepSeek caches. **This extension enforces prefix stability so DeepSeek and Claude hit ~95% cache rates, cutting token costs by ~90% without throwing 400s.**
3. **Reasoning mode mismatches:** DeepSeek and Claude Opus use different schemas for thinking traces. Sending raw thinking payloads through the proxy causes `400` or `422` validation errors. **This extension normalizes thinking parameters per-model automatically.**
4. **Sudden 402 quota errors:** Claude Opus 5.5 and GPT-6 quotas are released in daily batches (10:00 & 19:00 Beijing time). When a batch runs out, the API returns `402`. **Run `/agentrouter check` to see which models are ready before starting a long task, or switch to unlimited DeepSeek V4 Flash.**
5. **Subagent rate limits (429):** Running concurrent subagents easily trips AgentRouter's per-minute limits. **This extension includes file-based request pacing that only throttles AgentRouter calls, leaving direct providers (Gemini, local Ollama) unaffected.**

---

## Free credits & referral bonus

AgentRouter is completely free to use and does not accept paid top-ups. Compute is distributed via signup bonuses and daily logins:

- **$50 signup credit:** If you register through [this referral link](https://agentrouter.org/register?aff=34dc), you get $50 in free credit instead of starting at $0. (It also gives me test credits to maintain this plugin).
- **$25 daily login bonus:** You get an extra $25 credit automatically every day upon logging in. If you stay logged in from yesterday, just log out and back in once to collect it.
- **Quota refresh times:** Batch quotas for Claude Opus 5.5 and GPT-6.1 Sol refill daily at 10:00 and 19:00 Beijing time (05:00 and 14:00 MSK / 02:00 and 11:00 UTC). DeepSeek V4 Flash has unlimited availability.

👉 **[Register on AgentRouter (with $50 bonus)](https://agentrouter.org/register?aff=34dc)**  
*(Referral code `34dc` is attached automatically, whether registering directly or via GitHub OAuth).*

---

## Quick Start

### 1. Get an API key (Free $50 on Registration)

Create an account at [agentrouter.org/register?aff=34dc](https://agentrouter.org/register?aff=34dc) to claim your instant $50 welcome credits, and copy your `sk-...` key from the dashboard.

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
| `gpt-6.1-sol` | `agentrouter-openai` | 1.05M | 128K | Yes | $4.00 | $20.00 | - | Daily batch drops |
| `gpt-6-astra` | `agentrouter-openai` | 1M | 128K | Yes | $8.00 | $40.00 | - | Daily batch drops |
| `claude-opus-5-5` | `agentrouter-clode` | 1M | 128K | Yes (Adaptive) | $12.00 | $12.00 | - | Daily batch drops |

Claude and GPT quotas are released in batches throughout the day. When a batch is consumed (HTTP 402), check availability with `/agentrouter check` or switch to unlimited `deepseek-v4-flash`.

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
| `Ctrl + P` | Cycle to next model (`deepseek-v4-flash` ➔ `gpt-6-astra` ➔ `gpt-6.1-sol` ➔ `claude-opus-5-5`) |
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
    "agentrouter-openai/gpt-6.1-sol",
    "agentrouter-clode/claude-opus-5-5"
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
AgentRouter releases daily quotas for premium models (Claude Opus 5.5, GPT-6.1 Sol, GPT-6 Astra) in periodic batch drops. When a batch is fully consumed, the API returns HTTP 402. Running `/agentrouter check` sends lightweight live health probes to all models in parallel, immediately displaying which models are Ready (🟢 200 OK) or Exhausted (⏳ 402), along with your current monthly spend in USD. If a premium batch is empty, switch to `deepseek-v4-flash` which has unlimited capacity.

#### How do free credits and daily check-ins work?
AgentRouter is completely free and does not accept paid top-ups. Compute is distributed via welcome bonuses and daily rewards:
- **Registration Bonus:** You receive **$50.00** in free balance upon registration when using the [community referral link](https://agentrouter.org/register?aff=34dc) (versus $0 on plain direct signup).
- **Daily Login Check-In:** The platform uses automatic login check-in (`登录签到`). You receive **$25.00** every day upon logging in (no manual button required). If you remain logged in from the previous day, simply log out and back in to trigger the daily check-in (*"签到成功，新增额度已到账"*).
- **Quota Drops:** Quotas for flagship models (Claude Opus 5.5, GPT-6.1 Sol) refresh daily in batches at **10:00** and **19:00 Beijing time** (05:00 and 14:00 MSK / 02:00 and 11:00 UTC). Between batch drops, `deepseek-v4-flash` remains available around the clock.

#### Does pacing slow down other providers?
No. Request pacing is isolated per provider via dedicated lock files and applied exclusively to requests routed to `agentrouter.org`. Direct provider connections (Google Gemini, Anthropic, local Ollama) run without pacing delays.

#### Using custom subagents (`pi-subagents`)
AgentRouter validates requests against the `pi-code` signature. If you define custom subagents in `~/.pi/agent/agents/*.md`, set `systemPromptMode: append` in their frontmatter.

---

## License

MIT © [madgagarin](https://github.com/madgagarin)
