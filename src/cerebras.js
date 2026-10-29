// Qwen on Cerebras Cloud — fast structured extraction for matching, and the chat reply (src/reply.js).
// Uses the official Cerebras SDK.
import Cerebras from "@cerebras/cerebras_cloud_sdk";

export const cerebras = new Cerebras({ apiKey: process.env.CEREBRAS_API_KEY });
export const MODEL = process.env.CEREBRAS_MODEL;

// Qwen 3 may wrap output in <think> tags; strip them.
export const stripThink = (text) => (text || "").replace(/<think>[\s\S]*?<\/think>/g, "");

const EXTRACT_PROMPT = `Extract the technical skills the user wants to learn from their message.
Reply with ONLY a JSON object like {"skills": ["aws", "terraform"]}, lowercase, no other text.
If nothing technical is mentioned, reply {"skills": []}. /no_think`;

export async function extractSkills(message) {
  const started = Date.now();
  const res = await cerebras.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: EXTRACT_PROMPT },
      { role: "user", content: message },
    ],
    temperature: 0,
  });
  const latencyMs = Date.now() - started;

  // Strip <think> tags, then grab the JSON object.
  const text = stripThink(res.choices[0].message.content);
  const match = text.match(/\{[\s\S]*\}/);
  let skills = [];
  try {
    skills = match ? JSON.parse(match[0]).skills || [] : [];
  } catch {
    skills = [];
  }
  return { skills, latencyMs };
}
