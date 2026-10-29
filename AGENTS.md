# MentorMatch — instructions for AI coding agents

Shared by Claude Code, GitHub Copilot and any other agent that reads AGENTS.md.

AI mentor marketplace, v1 runs locally on Windows.

## Stack
- Node.js 20+, Express, ES modules (`"type": "module"`)
- Qwen on Cerebras for both skill extraction and chat replies — official SDK `@cerebras/cerebras_cloud_sdk`, `CEREBRAS_API_KEY`, `CEREBRAS_MODEL`
  - `src/cerebras.js` — the shared client, plus fast skill extraction
  - `src/reply.js` — writes the chat reply with the same client and model (strips `<think>` tags)
  - Grok is used as a coding assistant in Cursor, not inside the app. Don't add xAI or the `openai` package back.
- Matching — `src/match.js` over `src/mentors.json`
- Stripe Connect (Express accounts, destination charges, application fee) — `src/stripe.js`, TEST MODE ONLY
- Frontend — plain HTML/CSS/JS in `public/`

## Rules
- Never commit `.env` or print API keys.
- Stripe must stay in test mode; the server exits on `sk_live_` keys.
- Keep model IDs in `.env` (`CEREBRAS_MODEL`), never hard-code them.
- Commands: `npm install`, `npm run check`, `npm run dev`.
- The user is on Windows (PowerShell). Give PowerShell commands, not bash.

## Planned next steps
1. Replace `public/` UI with the Figma design (via the Figma MCP server).
2. Move to AWS: Lambda + API Gateway, DynamoDB for mentors and Stripe account IDs, secrets in AWS Secrets Manager.
