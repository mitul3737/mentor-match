import express from "express";
import { grokReply } from "./src/grok.js";
import { extractSkills } from "./src/cerebras.js";
import { matchMentors, allMentors, findMentor } from "./src/match.js";
import {
  stripeEnabled,
  onboardMentor,
  accountStatus,
  connectedAccountFor,
  createBookingCheckout,
} from "./src/stripe.js";

const app = express();
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

if (process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")) {
  console.error("Refusing to start: use a Stripe TEST key (sk_test_...) for this project.");
  process.exit(1);
}

app.get("/api/mentors", (_req, res) => res.json(allMentors()));

// Chat: Qwen on Cerebras extracts skills fast -> match -> Grok writes the reply.
app.post("/api/chat", async (req, res) => {
  try {
    const history = (req.body.history || []).slice(-10);
    const last = history.filter((m) => m.role === "user").at(-1)?.content || "";
    const { skills, latencyMs } = await extractSkills(last);
    const mentors = matchMentors(skills);
    const reply = await grokReply(history, mentors);
    res.json({ reply, skills, mentors, cerebrasLatencyMs: latencyMs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Stripe Connect — kept last in the build order.
app.post("/api/connect/onboard/:mentorId", async (req, res) => {
  if (!stripeEnabled) return res.status(400).json({ error: "Add a Stripe test key to .env" });
  const mentor = findMentor(req.params.mentorId);
  if (!mentor) return res.status(404).json({ error: "Mentor not found" });
  try {
    res.json({ url: await onboardMentor(mentor, APP_URL) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/connect/status/:mentorId", async (req, res) => {
  const accountId = connectedAccountFor(req.params.mentorId);
  if (!stripeEnabled || !accountId) return res.json({ connected: false });
  res.json({ connected: true, accountId, ...(await accountStatus(accountId)) });
});

app.post("/api/book/:mentorId", async (req, res) => {
  if (!stripeEnabled) return res.status(400).json({ error: "Add a Stripe test key to .env" });
  const mentor = findMentor(req.params.mentorId);
  const accountId = mentor && connectedAccountFor(mentor.id);
  if (!accountId) return res.status(400).json({ error: "This mentor has not onboarded to Stripe yet" });
  try {
    res.json({ url: await createBookingCheckout(mentor, accountId, APP_URL) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`MentorMatch running at ${APP_URL}`));
