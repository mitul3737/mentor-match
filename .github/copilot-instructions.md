# Copilot instructions for MentorMatch

- Node.js 20+, Express, ES modules. Use `import`, not `require`.
- The only AI provider is Qwen on Cerebras, via the official `@cerebras/cerebras_cloud_sdk`. Don't add other AI SDKs (no `openai`, no xAI).
- Model IDs come from environment variables. Never hard-code keys or model IDs.
- Stripe code must stay in test mode. Flag any change that could accept a live key.
- When reviewing PRs, check for: unhandled promise rejections, missing input validation on `/api/*` routes, secrets in code, and XSS in `public/app.js` (mentor data is inserted with innerHTML).
