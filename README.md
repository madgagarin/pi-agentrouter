# @madgagarin/pi-agentrouter

[![npm version](https://img.shields.io/npm/v/@madgagarin/pi-agentrouter.svg?color=blue)](https://www.npmjs.com/package/@madgagarin/pi-agentrouter)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Pi Plugin](https://img.shields.io/badge/Pi-Extension-purple.svg)](https://pi.dev)

Pi Coding Agent extension for [AgentRouter](https://agentrouter.org). Adds support for Claude Opus 5.5, GPT-6.1 Sol, GPT-6 Astra, GPT-5.6 Sol, and DeepSeek V4 Flash with in-flight WAF recovery, prompt caching optimization, and live quota monitoring.

---

## Why this extension exists

If you configure AgentRouter as a generic OpenAI or Anthropic endpoint in Pi, you will run into several recurring issues:

1. **Gateway content filters lock up sessions:** AgentRouter's upstream gateway blocks requests containing binary output (such as reading a `.so` or compiled file) or certain keywords with `400 content-blocked` or `500 sensitive words detected`. Because Pi sends previous conversation turns with each request, that error stays in context and every subsequent retry fails. **This extension catches the error, redacts the problematic output from in-memory history, and retries cleanly.**
2. **Prompt caching errors & extra costs:** Standard Anthropic caching headers (`cache_control`) trigger `400 Bad Request` on non-Anthropic endpoints, and changing prompt prefixes invalidates DeepSeek caches. **This extension enforces prefix stability so DeepSeek and Claude hit ~95% cache rates, cutting token costs by ~90% without throwing 400s.**
3. **Reasoning mode mismatches & cluster errors:** DeepSeek, Claude, and OpenAI Responses API use fundamentally different schemas for thinking traces. Sending raw thinking payloads or re-sending Azure-encrypted reasoning items (`rs_...`) across AgentRouter's multi-node pool causes `400 Decryption Failure`, `400 Cross-Resource Access`, or `422` validation errors. **This extension normalizes thinking schemas and strips node-bound ciphertext so multi-turn chats run smoothly across any gateway node.**
4. **Sudden 402 quota errors:** Quotas for batch models are released on schedule (09:00 Beijing for Claude Opus 5.5, 03:00 & 15:00 for GPT-6 Astra). When a batch runs out, the API returns `402`. **Switch to `gpt-6.1-sol` which has all-day unlimited availability, or run `/agentrouter check` to test live status.**
5. **Subagent & TPM rate limits (429):** Running concurrent subagents or sending heavy multi-turn context can trip AgentRouter's per-minute token limits (TPM). **This extension combines file-based request pacing with in-flight progressive exponential backoff that spans Azure's rolling 60-second quota window.**

---

## Free credits & referral bonus

AgentRouter is completely free to use and does not accept paid top-ups. Compute is distributed via signup bonuses and daily logins:

- **Up to $250 in welcome credits:** New accounts receive a generous starting balance of up to **$200** from the platform, plus an extra **+$50.00** bonus when registering through [this referral link](https://agentrouter.org/register?aff=34dc) (or enter code `34dc`). Using the referral link also grants test credits to the plugin maintainer. You can also register directly at [agentrouter.org](https://agentrouter.org).
- **GitHub account requirement:** To prevent bot abuse, AgentRouter strictly requires a **GitHub account older than 1 year (365+ days)** for OAuth registration.
- **$25 daily login bonus:** You get an extra $25 credit automatically every day upon logging in. If you stay logged in from yesterday, just log out and back in once to collect it.
- **Quota refresh times:** `gpt-6.1-sol` has unlimited all-day availability. Batch quotas for Claude Opus 5.5 refresh daily at 09:00 Beijing time (04:00 MSK / 01:00 UTC), and GPT-6 Astra refreshes at 03:00 and 15:00 Beijing time (22:00 and 10:00 MSK / 19:00 and 07:00 UTC).

👉 **[Register directly](https://agentrouter.org)** or **[Register with +$50 bonus (supports plugin maintainer)](https://agentrouter.org/register?aff=34dc)**

---

## Quick Start

### 1. Get an API key

Sign in with an eligible GitHub account (> 1 year old) at [agentrouter.org](https://agentrouter.org) (or use [this link with +$50 bonus](https://agentrouter.org/register?aff=34dc) to support the maintainer). In the dashboard, go to **Tokens**, click **Add Token**, select your models, and copy your `sk-...` key.

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
| `gpt-6.1-sol` | `agentrouter-openai` | 1.05M | 128K | Yes | $3.00 | $15.00 | - | Unlimited (All-day) |
| `gpt-6-astra` | `agentrouter-openai` | 1M | 128K | Yes | $8.00 | $40.00 | - | Batch drops (03:00 / 15:00) |
| `gpt-5.6-sol` | `agentrouter-openai` | 1M | 128K | Yes | $8.00 | $40.00 | - | Daily batch drops |
| `claude-opus-5-5` | `agentrouter-clode` | 1M | 128K | Yes (Adaptive) | $12.00 | $12.00 | - | Daily batch drop (09:00) |
| `deepseek-v4-flash` | `agentrouter-openai` | 1M | 64K | Yes | $4.00 | $12.00 | $2.00 | Standard |

`gpt-6.1-sol` is available all day without batch quota limits. Claude Opus 5.5 and GPT-6 Astra quotas are released in daily batches (09:00 Beijing for Claude Opus 5.5, 03:00 & 15:00 for GPT-6 Astra). When a batch is consumed (HTTP 402), check availability with `/agentrouter check` or switch to `gpt-6.1-sol`.

---

## In-Chat Commands

| Command | Description |
| :--- | :--- |
| `/agentrouter` | Show active model, monthly spend, extension ordering, and pacing delay. |
| `/agentrouter check` | Probe live model status (🟢 Ready, ⏳ 402 Exhausted, 🔑 Not in token) and show monthly spend. |
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
| `Ctrl + P` | Cycle to next model (`gpt-6.1-sol` ➔ `gpt-6-astra` ➔ `gpt-5.6-sol` ➔ `claude-opus-5-5` ➔ `deepseek-v4-flash`) |
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
  "defaultModel": "gpt-6.1-sol",
  "defaultThinkingLevel": "low",
  "enabledModels": [
    "agentrouter-openai/gpt-6.1-sol",
    "agentrouter-openai/gpt-6-astra",
    "agentrouter-openai/gpt-5.6-sol",
    "agentrouter-clode/claude-opus-5-5",
    "agentrouter-openai/deepseek-v4-flash"
  ]
}
```

---

## FAQ

#### How does error recovery and rate limiting work?
The extension intercepts requests at the transport level. If the gateway returns a temporary error:
- **Rate limits & TPM backoff (429 / Token Rate Limit):** Uses progressive exponential backoff with full jitter (`4s * 1.6^attempt + jitter`). Spanning up to 60s+ across attempts ensures Azure's rolling 60-second token bucket has time to refill naturally.
- **Node affinity & prompt cache migration:** When a backend node fails or hits rate limits, sticky affinity is broken and cleanly versioned (`prompt_cache_key-vN`, `session_id-rlN`), smoothly migrating the session to a healthy node and keeping future turns pinned for 100% warm prompt caching.
- **Decryption & Cross-Resource errors:** Strips node-bound ciphertext, Azure internal IDs (`rs_...`, `msg_...`), and dead `previous_response_id` links, preventing multi-instance cluster errors.
- **SSE Stream Inspection:** Intercepts mid-stream failures (like `event: response.done status:failed`) before they can crash Pi's stream parser.
- **WAF content blocks & poison redaction:** Strips binary dumps and performs non-destructive in-flight redaction of blocked output while preserving tool arguments.
- Diagnostic events are logged to `~/.pi/agent/.agentrouter-debug.log`.

#### Why does prompt caching matter?
DeepSeek charges ~$0.014 per 1M cached input tokens versus ~$0.14 for uncached ones. Because this extension prevents dynamic prompt rewrites and ensures prefix determinism, multi-turn coding sessions routinely achieve 95%+ cache hit rates, saving substantial costs over long runs.

#### How do batch quotas and `/agentrouter check` work?
`gpt-6.1-sol` is unlimited and available all day. For other models (Claude Opus 5.5, GPT-6 Astra, GPT-5.6 Sol), AgentRouter releases quotas in periodic batch drops. When a batch is fully consumed, the API returns HTTP 402. Running `/agentrouter check` sends lightweight live health probes to all models in parallel, immediately displaying which models are Ready (🟢 200 OK) or Exhausted (⏳ 402), along with your current monthly spend in USD. It also automatically detects if any model is not enabled in your API token (🔑 Not in token), with a direct prompt to enable it in the AgentRouter dashboard.

#### How do free credits and daily check-ins work?
AgentRouter is completely free and does not accept paid top-ups. Compute is distributed via welcome bonuses and daily rewards:
- **Welcome Bonus (up to $250):** Eligible new accounts receive up to **$200** in base welcome balance. Using the [optional referral link](https://agentrouter.org/register?aff=34dc) adds an additional **+$50.00** starting bonus and grants test credits to the plugin maintainer. *(Note: Registration requires a **GitHub account older than 1 year** to prevent bot abuse).*
- **Daily Login Check-In:** The platform uses automatic login check-in (`登录签到`). You receive **$25.00** every day upon logging in (no manual button required). If you remain logged in from the previous day, simply log out and back in to trigger the daily check-in (*"签到成功，新增额度已到账"*).
- **Quota Drops:** `gpt-6.1-sol` is available all day. Quotas for Claude Opus 5.5 refresh daily in batches at **09:00 Beijing time** (04:00 MSK / 01:00 UTC), and GPT-6 Astra refreshes at **03:00** and **15:00 Beijing time** (22:00 and 10:00 MSK / 19:00 and 07:00 UTC).

#### Does pacing slow down other providers?
No. Request pacing is isolated per provider via dedicated lock files and applied exclusively to requests routed to `agentrouter.org`. Direct provider connections (Google Gemini, Anthropic, local Ollama) run without pacing delays.

#### Using custom subagents (`pi-subagents`)
AgentRouter validates requests against the `pi-code` signature. If you define custom subagents in `~/.pi/agent/agents/*.md`, set `systemPromptMode: append` in their frontmatter.

---

## License

MIT © [madgagarin](https://github.com/madgagarin)
