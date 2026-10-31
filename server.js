import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeReply } from "./src/reply.js";
import { extractSkills } from "./src/cerebras.js";
import { matchMentors, allMentors, findMentor } from "./src/match.js";
import {
  stripeEnabled,
  onboardMentor,
  accountStatus,
  connectedAccountFor,
  createBookingCheckout,
} from "./src/stripe.js";
import { createMessageStore } from "./src/messages.js";

const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

if (process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")) {
  console.error("Refusing to start: use a Stripe TEST key (sk_test_...) for this project.");
  process.exit(1);
}

function sendResult(res, result) {
  if (result.error) return res.status(result.status).json({ error: result.error });
  return res.status(result.status).json(result.body);
}

export function createApp({ store = createMessageStore() } = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.static("public"));

  app.get("/api/mentors", (_req, res) => res.json(allMentors()));

  // Chat: Qwen on Cerebras extracts skills fast -> match -> Qwen on Cerebras writes the reply.
  app.post("/api/chat", async (req, res) => {
    try {
      const history = (req.body.history || []).slice(-10);
      const last = history.filter((m) => m.role === "user").at(-1)?.content || "";
      const { skills, latencyMs } = await extractSkills(last);
      const mentors = matchMentors(skills);
      const reply = await writeReply(history, mentors);
      res.json({ reply, skills, mentors, cerebrasLatencyMs: latencyMs });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/conversations/:mentorId", async (req, res) => {
    try {
      sendResult(res, await store.getThread(req.params.mentorId, req.query.menteeId));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load messages" });
    }
  });

  app.post("/api/conversations/:mentorId/messages", async (req, res) => {
    try {
      const body = req.body || {};
      sendResult(
        res,
        await store.postMenteeMessage({
          mentorId: req.params.mentorId,
          menteeId: body.menteeId,
          menteeName: body.menteeName,
          text: body.text,
        })
      );
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not send message" });
    }
  });

  app.get("/api/inbox/:mentorId", async (req, res) => {
    try {
      sendResult(res, await store.listInbox(req.params.mentorId));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load inbox" });
    }
  });

  app.post("/api/inbox/:mentorId/reply", async (req, res) => {
    try {
      const body = req.body || {};
      sendResult(
        res,
        await store.postMentorReply({
          mentorId: req.params.mentorId,
          menteeId: body.menteeId,
          text: body.text,
        })
      );
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not send reply" });
    }
  });

  // Stripe Connect — kept last in the build order. Booking itself is unchanged.
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

  app.use((err, _req, res, next) => {
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON" });
    }
    next(err);
  });

  return app;
}

const entry = process.argv[1];
const self = fileURLToPath(import.meta.url);
const isDirectRun =
  entry &&
  (process.platform === "win32"
    ? path.resolve(entry).toLowerCase() === path.resolve(self).toLowerCase()
    : path.resolve(entry) === path.resolve(self));

if (isDirectRun) {
  const app = createApp();
  app.listen(PORT, () => console.log(`MentorMatch running at ${APP_URL}`));
}
