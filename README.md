# MentorMatch

An AI mentor marketplace for developers in Bangladesh. A learner types what they want to learn, AI finds matching mentors, and the learner books and pays a mentor through **Stripe Connect** (test mode) while the platform keeps a 10% fee.

Built as a live demo of seven tools working together, each with one clear job:

| # | Tool | Job in this project | Where |
|---|---|---|---|
| 1 | **Figma Make** | Generated the whole UI from one prompt | [Figma Make file](https://www.figma.com/make/wyWLVXzxjN0yt016P6ME7x/Build-MentorMatch-Marketplace) |
| 2 | **Claude Code** | Main builder: turned the Figma design into code, backend changes, fixes | Terminal; reads `AGENTS.md` via `CLAUDE.md` |
| 3 | **Amazon Bedrock** | Optional way to run Claude Code on AWS | `$env:` settings per PowerShell window |
| 4 | **Qwen on Cerebras** | Inside the app: extracts skills (~500 ms) and writes the chat replies | `src/cerebras.js`, `src/reply.js` |
| 5 | **Grok (Cursor + Grok Bot)** | Coding teammate: quick UI edits in Cursor, issues → pull requests with Grok Bot | Outside the app |
| 6 | **GitHub Copilot** | Reviews every pull request before it's merged | GitHub PRs |
| 7 | **Stripe Connect** | Mentor onboarding, payments, platform fee, payouts — **always last** | `src/stripe.js`, `public/onboard.html` |

```
Learner types "I want to learn Terraform on AWS"
  → Qwen on Cerebras extracts skills (terraform, aws)
  → match against src/mentors.json
  → Qwen on Cerebras writes the reply, Nadia's card appears
  → Book session → Stripe Checkout ($15)
  → Stripe splits it: $13.50 to Nadia's connected account, $1.50 platform fee
  → Stripe pays Nadia out to her bank
```

All commands are for **Windows PowerShell**.

---

## Quick start (15 min)

You need **Node.js 20.6+**, **Git**, a **Cerebras API key** (free tier at [cloud.cerebras.ai](https://cloud.cerebras.ai)), and later a **Stripe account in test mode**.

```powershell
git clone https://github.com/mitul3737/mentor-match.git
cd mentor-match
npm install
Copy-Item .env.example .env
New-Item -ItemType Directory -Force data | Out-Null   # Stripe saves connected account IDs here
```

Open `.env` and fill in (no quotes, no spaces around `=`):

```
PORT=3000
APP_URL=http://localhost:3000
CEREBRAS_API_KEY=csk-...
CEREBRAS_MODEL=your-qwen-model-id
STRIPE_SECRET_KEY=
PLATFORM_FEE_PERCENT=10
```

Get the current Qwen model ID from the Models page at cloud.cerebras.ai (Cerebras retires models often). Leave Stripe empty until the Stripe step.

```powershell
npm test        # 8 tests for skill matching, no API keys needed
npm run check   # want [OK] for Qwen (Cerebras)
npm run dev     # MentorMatch running at http://localhost:3000
```

Open http://localhost:3000 and type **"I want to learn Terraform on AWS"**. You should get a reply, the detected skills `terraform, aws`, a Cerebras latency badge, and **Nadia Rahman** as the top match. (`src/match.js` returns up to 3 mentors whose skills match the extracted skills by case-insensitive, whole-token comparison, so if Qwen also detects e.g. `devops`, Arif appears too.)

---

## What worked (and what didn't)

Lessons from building this, so the demo goes smoothly:

| Area | What worked | What didn't / watch out |
|---|---|---|
| Figma | **Figma Make** generated all screens from one prompt; Claude Code read it through the **Figma MCP server** | Building frames by hand was slow; Make's mock data and fake chat had to be swapped for real endpoints |
| Claude Code | Subscription login: works instantly. Figma MCP added with `--scope user` so it works in every folder | Start `claude` in the **inner** project folder (the one with `package.json`), not a parent folder |
| Bedrock | **Claude Sonnet 4.5** via inference profile `us.anthropic.claude-sonnet-4-5-20250929-v1:0` | **Sonnet 5.5 returned 403 "not available for this account"**. Plain model IDs fail; use the `us.` inference profile ID |
| Chat AI | **Qwen on Cerebras** for both skills and replies, official `@cerebras/cerebras_cloud_sdk` | We removed xAI and the `openai` package; Cursor credits can't be used as a Grok API key |
| Grok | **Grok 4.7 in Cursor Agent mode** for UI edits; **Grok Bot** (sign in with Cursor) audited the repo and pushed two fix branches | Grok Bot has no API for the app to call, so it works *on* the repo. It pushes as `cursor[bot]`, and GitHub refused its PRs ("must be a collaborator") because our Cursor team links several GitHub accounts; we opened the PRs by hand |
| Copilot | Requested as PR reviewer on all 4 PRs; approved the XSS fix with no issues; **Copilot Autofix** committed a footer focus-colour fix | Use PR review on GitHub, not the IDE extension (clashes with Cursor) |
| Git | Commit before letting any agent edit; one agent at a time | Running Grok and Claude Code on the same files at once can overwrite changes |
| Ports | One terminal for `npm run dev`, one for everything else | Starting another copy fails with `EADDRINUSE :::3000`; stop the existing copy before restarting |

## Pull request history

Every change after the first working version went through a branch → pull request → Copilot review → merge:

| PR | Branch | Written by | What changed | Copilot |
|---|---|---|---|---|
| #1 | `improve-chat` | Claude Code | Mentor cards built with `createElement`/`textContent` instead of `innerHTML` (XSS fix) | Approval recommended, no issues |
| #2 | `update-docs` | Claude (chat) + edits | README demo script, `AGENTS.md`, Copilot instructions | Reviewed, merged |
| #3 | `cursor/fix-skill-matching-f0df` | **Grok Bot** | Skill matching compares whole words (tokens), case-insensitive ("java" no longer matches JavaScript, "c" no longer matches everyone); new `src/skills.js`; 8 tests in `test/`; `npm test` | Reviewed, merged |
| #4 | `cursor/home-page-footer-72e9` | **Grok Bot** | Footer "MentorMatch · Built at Oct 31 Moar" with GitHub link, stacks on phones | **Copilot Autofix** changed the footer link focus outline to the accent colour |

### How the Grok Bot PRs were created
1. Grok Bot audited the repo, then pushed `cursor/fix-skill-matching-f0df` and `cursor/home-page-footer-72e9`.
2. Opening the PRs failed for the Bot (`cursor[bot]` lacked access through the linked GitHub account), so we opened them by hand from the compare pages:
   - `https://github.com/mitul3737/mentor-match/compare/main...cursor/home-page-footer-72e9`
   - `https://github.com/mitul3737/mentor-match/compare/main...cursor/fix-skill-matching-f0df`
3. Each PR: **Create pull request** → paste the Bot's description → **Reviewers → Copilot** → wait 1–2 min → apply useful suggestions (or **Commit suggestion** / Autofix) → **Merge** → **Delete branch**.
4. Locally: `git checkout main`, `git pull`, `npm install`, `npm test`, then restart `npm run dev`.

### Grok Bot's audit: open items
| # | Finding | Status |
|---|---|---|
| 1 | `/api/chat` accepts `system` messages from the browser | To do: allow only `user` / `assistant` roles |
| 2 | Stripe status route doesn't answer on a Stripe error; first onboarding fails if `data/` is missing | **To do before the Stripe demo** (workaround: create `data/` in Quick start) |
| 3 | Payouts page builds rows from raw HTML | To do: same `textContent` fix as PR #1 |
| 4 | No CI | Optional: GitHub Actions running `npm test` |
| 5 | Success screen trusts `?paid=` | Explain in the Stripe talk: the real fix is webhooks |
| 6 | Server needs API keys to start | Skip |
| 7 | Logo button does nothing | Optional |

---

## Demo script (about 60 min)

Run the steps in this order. **Grok Bot comes before Stripe; Stripe Connect is always last.**

### Before the event
- [ ] `npm test` and `npm run check` pass (Qwen and Stripe) on the demo laptop
- [ ] `data/` folder exists (or audit item #2 is fixed)
- [ ] No `npm run dev` is running; start it in Part 3
- [ ] One mentor (Nadia) already onboarded to Stripe in test mode (see Part 7)
- [ ] Grok Bot app signed in, Bot created, GitHub connected
- [ ] Branch protection on `main` (Settings → Branches → require a pull request)
- [ ] Screenshots of each step in the slides as a backup
- [ ] No `.env`, API keys or Bedrock keys visible on screen

### Part 1 — Design with Figma Make (5 min)
Show the [Figma Make file](https://www.figma.com/make/wyWLVXzxjN0yt016P6ME7x/Build-MentorMatch-Marketplace) and the prompt that generated it. Click through: chat, mentor cards (hover), payouts page, payment result.
> *"One prompt gave us a working, clickable design."*

### Part 2 — Claude Code turns the design into code (10 min)
In the terminal, inside the project folder:

```powershell
claude
```

Show `/status` (account and model) and `/mcp` (figma ✔). Then show the prompt that rebuilt `public/` from the Figma Make file, and the result in `public/styles.css` (colour tokens as CSS variables).

**Optional — Claude Code on Amazon Bedrock.** In a *new* PowerShell window (these settings last only for that window):

```powershell
$env:CLAUDE_CODE_USE_BEDROCK = "1"
$env:AWS_REGION = "us-east-1"
$env:AWS_BEARER_TOKEN_BEDROCK = [System.Net.NetworkCredential]::new("", (Read-Host "Bedrock API key" -AsSecureString)).Password
$env:ANTHROPIC_MODEL = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
$env:ANTHROPIC_SMALL_FAST_MODEL = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
claude
```

`/status` should show **Amazon Bedrock**. To go back to the subscription, open a new window and run `claude`.

### Part 3 — The app runs on Qwen + Cerebras (5 min)
```powershell
npm run dev
```
Type *"I want to learn Terraform on AWS"*. Point out the detected skills and the **Cerebras latency badge** (~400–500 ms; it times the skill-extraction call only, the reply is a second Cerebras call), then **Clear chat**.
> *"Qwen on Cerebras does two jobs: it pulls out the skills and writes the reply."*

### Part 4 — Grok in Cursor: quick edits (5 min)
Open the Agent panel (**Ctrl + I**), choose **Grok 4.7**, and give a small visible task, e.g.:
> *Add a "Back to top" link in the footer of public/index.html.*

Accept the diff, refresh the browser, commit.
(Already done this way: Clear chat button, larger text for projectors, payment result from `?paid=` / `?cancelled=`.)

### Part 5 — Grok Bot: a teammate that opens pull requests (10 min)
Show what the Bot already did (see **Pull request history**): it **audited the repo**, found 7 issues (including one that would have broken the Stripe demo), and pushed two branches: the skill-matching fix with 8 tests, and the footer.

Live, give the **MentorMatch Maintainer** Bot one of the open audit items:
> *Fix audit item #3: build the payouts page rows in public/onboard.html with createElement/textContent instead of innerHTML. Create a branch and push it. Don't push to main.*

If the Bot can't open the PR itself, open it from the compare page (`https://github.com/mitul3737/mentor-match/compare/main...<branch>`) and paste its description.
> *"Grok Bot works on its own cloud computer and keeps going even if I close my laptop. It found bugs we hadn't noticed."*

Bot setup (once): name **MentorMatch Maintainer**; description: *"You work on github.com/mitul3737/mentor-match. Read AGENTS.md first and follow it. Never push to main; always open a pull request. Stripe must stay in test mode. Never ask for or store API keys."* Connect GitHub with access to this repo only; require approval for pushing, opening PRs and deleting.

### Part 6 — Copilot reviews the pull request (5 min)
On the Grok Bot's PR: **Reviewers → Copilot**. Wait 1–2 minutes, then walk through its comments. Show PR #4, where **Copilot Autofix** committed a fix directly. Apply useful suggestions (**Commit suggestion**, or fix in Cursor / Claude Code), then **Merge** → **Delete branch**.
```powershell
git checkout main
git pull
npm install
npm test
```
Then stop and restart `npm run dev` (Ctrl + C, then `npm run dev`) so the app serves the new code.
> *"Two AIs write the code, a third reviews it, and a human merges it."*

### Part 7 — Stripe Connect (last, 15 min)
**This part is handed to the Stripe speaker.**

1. **Setup:** Stripe dashboard in **Test mode / Sandbox** → Connect → Get started → Platform or marketplace → Express. Copy the `sk_test_` secret key into `.env` as `STRIPE_SECRET_KEY`, then restart `npm run dev`. `npm run check` should show `[OK]` for Stripe.
2. **Map the money** (slide): learner pays $15 → platform keeps $1.50 → Nadia receives $13.50 → payout to her bank.
3. **Onboard a mentor:** "Mentor? Connect payouts →" → **Connect with Stripe** on Nadia → Stripe's hosted onboarding with test data (SMS code `000000`). Her pill turns **Ready to receive payments**.
4. **Show the code** in `src/stripe.js`:
   - `stripe.accounts.create({ type: "express" })` — the mentor's connected account
   - `stripe.accountLinks.create(...)` — the onboarding link
   - `stripe.checkout.sessions.create(...)` with `application_fee_amount` (platform fee) and `transfer_data.destination` (the mentor) — a **destination charge**
5. **Book and pay:** search again → **Book session** → card `4242 4242 4242 4242`, any future date, any CVC → **Payment successful**.
6. **Follow the money:** Dashboard → Payments → the $15 payment → the $1.50 application fee and the transfer to Nadia's account.

> *"Two fields make this a marketplace: who receives the money, and what the platform keeps."*

| Connect term | In MentorMatch | Code |
|---|---|---|
| Connected account | A mentor | `accounts.create` |
| Customer payment | A learner booking a session | `checkout.sessions.create` |
| Platform fee | 10% of each booking | `application_fee_amount` |
| Payout | Stripe pays the mentor's balance to their bank | Handled by Stripe |

| Route | What it does |
|---|---|
| `POST /api/connect/onboard/:mentorId` | Creates the Express account (first time) and returns an onboarding link |
| `GET /api/connect/status/:mentorId` | Returns `connected`, `chargesEnabled`, `detailsSubmitted`; `public/onboard.html` turns these into Not connected / Onboarding incomplete / Ready |
| `POST /api/book/:mentorId` | Creates the Checkout session for the destination charge |

Connected account IDs are stored in `data/accounts.json` (git-ignored), so each laptop onboards its own test mentors.

---

## Important notes

- **Test mode only.** The server refuses to start with an `sk_live_` key.
- **Bangladesh:** ordinary Stripe accounts aren't available for businesses registered in Bangladesh. Present Stripe as a test-mode, educational demo and don't promise attendees live accounts. See [Stripe global availability](https://stripe.com/global).
- **Secrets:** `.env` is git-ignored. Never show it on screen; blur keys in recordings. Give Bedrock API keys an expiry.
- **Agents:** `AGENTS.md` holds the rules for Claude Code, Cursor/Grok and Copilot. `CLAUDE.md` just imports it (needed because Claude Code on Bedrock doesn't read `AGENTS.md` by itself).

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm install`: Could not read package.json | You're in a parent folder. `cd mentor-match` until `ls package.json` finds it |
| `EADDRINUSE :::3000` | Another copy is running: `Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force`, or set `PORT=3001` and `APP_URL=http://localhost:3001` |
| Qwen `[FAIL]` model not found | Update `CEREBRAS_MODEL` from the Cerebras Models page |
| Stripe "Invalid API Key" | `.env` still has the `sk_test_...` placeholder; paste the real test secret key and restart |
| "This mentor has not onboarded to Stripe yet" | Onboard that mentor on `/onboard.html` first |
| Bedrock `403 ... not available for this account` | Your AWS account lacks that model; use Sonnet 4.5's `us.` profile ID |
| Bedrock "only through an inference profile" | Add the `us.` prefix to the model ID |
| Chat says "Sorry, I encountered an error" after `git pull` | Two `npm run dev` may be running and the old one serves stale code. Close the extra terminal, free port 3000, restart `npm run dev`. The real error is printed in the `npm run dev` terminal |
| "Connect with Stripe" fails with ENOENT on `data/accounts.json` | Create the folder: `New-Item -ItemType Directory -Force data` |
| Grok Bot: "must be a collaborator" when opening a PR | Open the PR yourself from the compare page; or give the Cursor GitHub app's installation on your account access to the repo and start a new Bot task |
| `npm` "running scripts is disabled" | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `git`: not a git repository | Run commands from the project folder, or `git init` if starting fresh |

## Project structure

```
mentor-match/
├─ server.js              Express server and API routes
├─ src/
│  ├─ cerebras.js         Cerebras client + skill extraction
│  ├─ reply.js            Chat reply (Qwen on Cerebras)
│  ├─ match.js            Skill matching (whole words, not substrings)
│  ├─ skills.js           Parses and normalises skills from Qwen's output
│  ├─ mentors.json        6 sample mentors
│  └─ stripe.js           Stripe Connect: accounts, onboarding, checkout
├─ public/                index.html, onboard.html, app.js, styles.css (from Figma Make)
├─ test/                 match.test.js, skills.test.js (npm test)
├─ scripts/check-keys.js  npm run check
├─ design/figma-brief.md  Original design brief
├─ AGENTS.md              Rules for every AI coding agent
├─ CLAUDE.md              Imports AGENTS.md for Claude Code
└─ .github/copilot-instructions.md
```

## Links

- [Stripe Connect overview](https://stripe.com/connect) · [How Connect works](https://docs.stripe.com/connect/how-connect-works) · [Connect docs](https://docs.stripe.com/connect) · [Design a Connect integration](https://docs.stripe.com/connect/design-an-integration)
- [Claude Code on Amazon Bedrock](https://docs.claude.com/en/docs/claude-code/amazon-bedrock)
- [Figma MCP server](https://help.figma.com/hc/en-us/articles/32132100833559)
- [Cerebras inference docs](https://inference-docs.cerebras.ai)
