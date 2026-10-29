// Run with: npm run check
// Pings each provider once so you know your keys and model IDs work.
import OpenAI from "openai";
import Stripe from "stripe";

const ok = (name, msg) => console.log(`  [OK]   ${name}: ${msg}`);
const bad = (name, msg) => console.log(`  [FAIL] ${name}: ${msg}`);

async function ping(name, baseURL, apiKey, model) {
  try {
    const client = new OpenAI({ apiKey, baseURL });
    const t = Date.now();
    const r = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Reply with the word ready. /no_think" }],
    });
    ok(name, `${model} replied in ${Date.now() - t} ms -> "${r.choices[0].message.content.trim().slice(0, 40)}"`);
  } catch (e) {
    bad(name, e.message);
  }
}

console.log("Checking keys...\n");
if (process.env.XAI_API_KEY?.trim()) {
  await ping("Grok (xAI)", "https://api.x.ai/v1", process.env.XAI_API_KEY, process.env.GROK_MODEL);
} else {
  console.log("  [SKIP] Grok (xAI): XAI_API_KEY is empty, chat will use Qwen on Cerebras");
}
await ping("Qwen (Cerebras)", "https://api.cerebras.ai/v1", process.env.CEREBRAS_API_KEY, process.env.CEREBRAS_MODEL);

const sk = process.env.STRIPE_SECRET_KEY || "";
if (!sk.startsWith("sk_test_")) {
  bad("Stripe", "not set or not a test key (skip this until the Stripe step)");
} else {
  try {
    const acct = await new Stripe(sk).accounts.retrieve();
    ok("Stripe", `test mode, platform account ${acct.id}`);
  } catch (e) {
    bad("Stripe", e.message);
  }
}
