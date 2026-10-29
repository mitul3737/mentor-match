# MentorMatch — v1 (Windows)

An AI mentor marketplace that ties six tools together:

| Layer | Tool | Where in the code |
|---|---|---|
| Design | Figma | `design/figma-brief.md` |
| Chat bot | Grok (xAI API) | `src/grok.js` |
| Fast matching | Qwen on Cerebras Cloud | `src/cerebras.js` |
| Build + extend | Claude Code on Amazon Bedrock | `AGENTS.md` |
| Review | GitHub Copilot | `.github/copilot-instructions.md` |
| Payments (last) | Stripe Connect, test mode | `src/stripe.js` |

How a message flows: **you type → Qwen on Cerebras extracts skills (fast JSON) → match against `src/mentors.json` → Grok writes the reply → book → Stripe Checkout pays the mentor's connected account, platform keeps a fee.**

All commands below are for **PowerShell**. Open it from the Start menu (Windows Terminal is fine).

---

## Step 0 — Install the basics (10 min)

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
winget install Amazon.AWSCLI
winget install Microsoft.VisualStudioCode
```

Close and reopen PowerShell, then check:

```powershell
node -v      # must be v20.6 or newer
git --version
aws --version
```

## Step 1 — Get the project running (5 min)

1. Unzip `mentor-match.zip` to `C:\dev\mentor-match` (any folder without spaces works).
2. In PowerShell:

```powershell
cd C:\dev\mentor-match
npm install
Copy-Item .env.example .env
code .
```

3. Initialise Git now, so Copilot and Claude Code can work with diffs later:

```powershell
git init
git add .
git commit -m "MentorMatch v1 starter"
```

## Step 2 — Figma: design first (30 min)

1. Open Figma and follow `design/figma-brief.md` to create the 4 frames.
2. Use Auto Layout and name your layers — this makes the code generation in Step 5 much cleaner.
3. Copy the link to your Figma file; you'll paste it into Claude Code later.

You don't need the design to run the app — `public/` has a placeholder UI.

## Step 3 — Grok API key (5 min)

1. Go to https://console.x.ai → **API Keys** → create a key.
2. Open `.env` and paste it into `XAI_API_KEY=`.
3. In the console's model list, copy a current Grok model ID into `GROK_MODEL=`.

## Step 4 — Qwen on Cerebras key (5 min)

1. Go to https://cloud.cerebras.ai → create an API key (free tier is fine).
2. Paste it into `CEREBRAS_API_KEY=` in `.env`.
3. Check https://inference-docs.cerebras.ai/models and set `CEREBRAS_MODEL=` to the current Qwen model ID (Cerebras rotates models, so confirm it).

**Test both keys:**

```powershell
npm run check
```

You want `[OK]` for Grok and Qwen. Stripe will show `[FAIL]` until Step 8 — that's expected.

**Run the app:**

```powershell
npm run dev
```

Open http://localhost:3000 and type: *"I want to learn Terraform on AWS"*. You should see a Grok reply, matched mentor cards, and the Cerebras latency under the chat. 🎉

## Step 5 — Claude Code on Amazon Bedrock (45 min)

### 5a. AWS side
1. Sign in to the AWS console, region **us-east-1** (N. Virginia).
2. Open **Amazon Bedrock → Model catalog**, pick an Anthropic Claude model, and submit the one-time use-case form. Access is granted right away.
3. Create an IAM user (or use IAM Identity Center) with permission for `bedrock:InvokeModel`, `bedrock:InvokeModelWithResponseStream` and `bedrock:ListInferenceProfiles`. Create an access key for it.
4. Configure the CLI and confirm it works:

```powershell
aws configure            # paste access key, secret, region us-east-1
aws sts get-caller-identity
```

### 5b. Install Claude Code

```powershell
irm https://claude.ai/install.ps1 | iex
```

### 5c. Point Claude Code at Bedrock
Set these once (they persist for new PowerShell windows):

```powershell
setx CLAUDE_CODE_USE_BEDROCK 1
setx AWS_REGION us-east-1
```

`AWS_REGION` is required — Claude Code doesn't read the region from `aws configure`.
Optionally pin a model: in the Bedrock console, copy a Claude **inference profile ID** (looks like `us.anthropic.claude-...`) and run `setx ANTHROPIC_MODEL "<that id>"`.

Close and reopen PowerShell, then:

```powershell
cd C:\dev\mentor-match
claude
```

Inside Claude Code, run `/status` and confirm the provider shows **Amazon Bedrock**. It loads `CLAUDE.md`, which imports `AGENTS.md`, so it already knows the project. (On Bedrock, Claude Code doesn't read `AGENTS.md` by itself — that one-line `CLAUDE.md` is the bridge, so keep it.)

### 5d. Connect Figma and turn your design into code
Exit Claude Code (`/exit`), then add Figma's MCP server:

```powershell
claude mcp add --transport http figma https://mcp.figma.com/mcp
claude
```

Run `/mcp`, choose **figma**, and sign in. Then prompt:

> Here is my Figma file: <paste link>. Rebuild public/index.html, public/onboard.html and public/styles.css to match the Home/Chat and Mentor payouts frames. Keep the element IDs that public/app.js uses. Use the Figma color and text styles as CSS variables.

Refresh http://localhost:3000 — your design is now live. Commit:

```powershell
git add . ; git commit -m "UI from Figma"
```

(If the Figma MCP command has changed, check Figma's Dev Mode MCP docs; MCP access depends on your Figma plan.)

## Step 6 — Push to GitHub (5 min)

Create an empty repo on GitHub named `mentor-match`, then:

```powershell
git branch -M main
git remote add origin https://github.com/<your-username>/mentor-match.git
git push -u origin main
```

`.env` is in `.gitignore`, so your keys stay local. Double-check with `git status` before pushing.

## Step 7 — GitHub Copilot: review and improve (25 min)

1. In VS Code, install the **GitHub Copilot** extension and sign in.
2. Copilot reads `.github/copilot-instructions.md` automatically.
3. Make a branch and an improvement with Copilot Chat, for example:

```powershell
git checkout -b fix-xss
```

> Copilot Chat: "public/app.js inserts mentor data with innerHTML. Rewrite renderMentors to use textContent so it's XSS-safe."

4. Commit, push, open a PR on GitHub, and request **Copilot** as a reviewer. Discuss its comments, then merge.

## Step 8 — Stripe Connect, last (30 min)

1. Sign in at https://dashboard.stripe.com and make sure **Test mode** is on. Test mode works without activating the account.
2. Go to **Connect** and complete the platform setup (choose Express accounts).
3. **Developers → API keys** → copy the **secret test key** (`sk_test_...`) into `STRIPE_SECRET_KEY=` in `.env`.
4. Restart the app (`Ctrl+C`, then `npm run dev`) and run `npm run check` — Stripe should now be `[OK]`.
5. Open http://localhost:3000/onboard.html → **Connect with Stripe** for a mentor. Fill Stripe's onboarding with test data (use the test values Stripe suggests on each screen).
6. Back on the chat page, ask for that mentor's skill, click **Book (test payment)**, and pay with card `4242 4242 4242 4242`, any future date, any CVC.
7. In the Stripe dashboard, open **Payments** to see the charge, the transfer to the connected account, and your application fee (10% by default, set in `PLATFORM_FEE_PERCENT`).

> Note: Stripe doesn't currently support platform accounts registered in Bangladesh for live payments. Everything here is test mode, which is fine for v1 and for a workshop. Going live needs a platform entity in a Stripe-supported country.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `node: bad option: --env-file` | Node is older than 20.6 — reinstall the LTS. |
| `npm` "running scripts is disabled" | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once. |
| Grok/Cerebras `404 model not found` | The model ID in `.env` is outdated — copy a current one from the provider's console. |
| Claude Code `/status` doesn't show Bedrock | You didn't reopen PowerShell after `setx`, or `AWS_REGION` is missing. |
| Bedrock `AccessDeniedException` | Model access form not submitted, or IAM policy missing — see Step 5a. |
| Port 3000 in use | Set `PORT=3001` and `APP_URL=http://localhost:3001` in `.env`. |

## What v2 looks like
Ask Claude Code (on Bedrock) to: move `server.js` to AWS Lambda + API Gateway, store mentors and Stripe account IDs in DynamoDB, keep keys in Secrets Manager, and deploy the frontend to S3 + CloudFront. `AGENTS.md` already lists this plan.
