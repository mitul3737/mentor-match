// Qwen on Cerebras Cloud — fast structured extraction for matching.
// Cerebras is OpenAI-compatible too.
import OpenAI from "openai";

const cerebras = new OpenAI({
  apiKey: process.env.CEREBRAS_API_KEY,
  baseURL: "https://api.cerebras.ai/v1",
});

const EXTRACT_PROMPT = `Extract the technical skills the user wants to learn from their message.
Reply with ONLY a JSON object like {"skills": ["aws", "terraform"]}, lowercase, no other text.
If nothing technical is mentioned, reply {"skills": []}. /no_think`;

export async function extractSkills(message) {
  const started = Date.now();
  const res = await cerebras.chat.completions.create({
    model: process.env.CEREBRAS_MODEL,
    messages: [
      { role: "system", content: EXTRACT_PROMPT },
      { role: "user", content: message },
    ],
    temperature: 0,
  });
  const latencyMs = Date.now() - started;

  let text = res.choices[0].message.content || "";
  // Qwen 3 may wrap output in <think> tags; strip them, then grab the JSON object.
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const match = text.match(/\{[\s\S]*\}/);
  let skills = [];
  try {
    skills = match ? JSON.parse(match[0]).skills || [] : [];
  } catch {
    skills = [];
  }
  return { skills, latencyMs };
}
