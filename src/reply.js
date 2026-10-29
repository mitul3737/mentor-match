// Chat reply — the conversational front door, written by Qwen on Cerebras.
// Reuses the Cerebras client and model from src/cerebras.js.
import { cerebras, MODEL, stripThink } from "./cerebras.js";

const SYSTEM_PROMPT = `You are MentorMatch, a friendly assistant that helps developers in Bangladesh
find a mentor. Keep replies short (2-4 sentences). When mentors are provided to you,
introduce them briefly and invite the user to book one. Never invent mentors.`;

export async function writeReply(history, mentors = []) {
  const context = mentors.length
    ? `Matched mentors (from our database):\n${mentors
        .map((m) => `- ${m.name}, ${m.title}, $${m.priceUsd}/session: ${m.bio}`)
        .join("\n")}`
    : "No mentors matched yet. Ask what the user wants to learn.";

  // Qwen's chat template allows only one system message, at the start.
  const res = await cerebras.chat.completions.create({
    model: MODEL,
    messages: [{ role: "system", content: `${SYSTEM_PROMPT}\n\n${context}` }, ...history],
  });
  return stripThink(res.choices[0].message.content).trim();
}
