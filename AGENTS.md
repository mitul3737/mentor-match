# MentorMatch — instructions for AI coding agents

Shared by Claude Code, GitHub Copilot and any other agent that reads AGENTS.md.

AI mentor marketplace, v1 runs locally on Windows.

## Stack
- Node.js 20+, Express, ES modules (`"type": "module"`)
- Grok (xAI) for chat replies — `src/grok.js`, OpenAI SDK with baseURL `https://api.x.ai/v1`
  - Fallback: if `XAI_API_KEY` is missing or empty, `src/grok.js` uses Cerebras instead (baseURL `https://api.cerebras.ai/v1`, `CEREBRAS_API_KEY`, `CEREBRAS_MODEL`), and `npm run check` skips the Grok check.
- Qwen on Cerebras for fast skill extraction — `src/cerebras.js`, baseURL `https://api.cerebras.ai/v1`
- Matching — `src/match.js` over `src/mentors.json`
- Stripe Connect (Express accounts, destination charges, application fee) — `src/stripe.js`, TEST MODE ONLY
- Frontend — plain HTML/CSS/JS in `public/`

## Rules
- Never commit `.env` or print API keys.
- Stripe must stay in test mode; the server exits on `sk_live_` keys.
- Keep model IDs in `.env` (`GROK_MODEL`, `CEREBRAS_MODEL`), never hard-code them.
- Commands: `npm install`, `npm run check`, `npm run dev`.
- The user is on Windows (PowerShell). Give PowerShell commands, not bash.

## Planned next steps
1. Replace `public/` UI with the Figma design (via the Figma MCP server).
2. Move to AWS: Lambda + API Gateway, DynamoDB for mentors and Stripe account IDs, secrets in AWS Secrets Manager.
