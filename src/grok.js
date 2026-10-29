// Grok (xAI) — the conversational front door.
// xAI's API is OpenAI-compatible, so we use the openai SDK with a different baseURL.
// If XAI_API_KEY is missing or empty, fall back to Qwen on Cerebras (also OpenAI-compatible).
import OpenAI from "openai";

const useXai = Boolean(process.env.XAI_API_KEY?.trim());

const grok = useXai
  ? new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: "https://api.x.ai/v1" })
  : new OpenAI({ apiKey: process.env.CEREBRAS_API_KEY, baseURL: "https://api.cerebras.ai/v1" });
const MODEL = useXai ? process.env.GROK_MODEL : process.env.CEREBRAS_MODEL;

const SYSTEM_PROMPT = `You are MentorMatch, a friendly assistant that helps developers in Bangladesh
find a mentor. Keep replies short (2-4 sentences). When mentors are provided to you,
introduce them briefly and invite the user to book one. Never invent mentors.`;

export async function grokReply(history, mentors = []) {
  const context = mentors.length
    ? `Matched mentors (from our database):\n${mentors
        .map((m) => `- ${m.name}, ${m.title}, $${m.priceUsd}/session: ${m.bio}`)
        .join("\n")}`
    : "No mentors matched yet. Ask what the user wants to learn.";

  const res = await grok.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: context },
      ...history,
    ],
  });
  // Qwen 3 (Cerebras fallback) may wrap reasoning in <think> tags; strip them.
  return (res.choices[0].message.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
