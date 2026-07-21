# MeterAI

**Pay-per-call USDC monetization for the agent economy — no API keys, no subscriptions, no invoices.**

MeterAI is an x402-style metering and settlement layer that turns any HTTP endpoint into something
an autonomous AI agent can discover, price-check, pay for in USDC on Arc, and consume — with zero
human in the loop.

Built for **Build on Arc** (Agentic Economy track).

## Quick start

```bash
npm install
npm run dev:services   # starts the two demo services + dashboard on :4021
npm run dev:agent      # in a second terminal: runs the autonomous consumer agent
```

Then open **http://localhost:4021/dashboard** to watch live earnings update.

## What's here (Checkpoint 2)

| Path | What it is |
|---|---|
| `middleware/meterai.js` | The core middleware: gates any Express route behind a USDC price, returns HTTP 402 with payment instructions, verifies payment proofs, logs settled calls. |
| `middleware/store.js` | SQLite-backed call log / earnings store powering the dashboard. |
| `middleware/demo-services.js` | Two live demo services metered with MeterAI: a mock inference endpoint and a mock data feed. |
| `demo-agent/wallet.js` | Mock Circle Wallet / Agent Stack / Paymaster wrapper — same interface the real SDK will fill in Checkpoint 3. |
| `demo-agent/agent.js` | Autonomous consumer agent: discovers price via 402, evaluates it against its own budget policy, pays, retries, consumes. |
| `dashboard/index.html` | Provider dashboard — earnings by service, spend by consumer agent, recent call log. |

See `docs/PROGRESS.md` for the full Checkpoint 2 write-up and what's planned for Checkpoint 3.
