// Pure skill-text helpers. No network and no mentor catalog.
// Matching is by whole token, not substring: "java" does not hit "javascript",
// but "node.js" still hits "node" and "web" still hits "web development".

export function stripThink(text) {
  return (typeof text === "string" ? text : "").replace(/<think>[\s\S]*?<\/think>/gi, "");
}

export function normalizeSkill(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokensOf(normalized) {
  const parts = normalized.match(/[a-z0-9+#]+/g) || [];
  const tokens = [];
  for (const part of parts) {
    // "python3" shares a token with "python"; keep short names like "s3" intact.
    const versioned = part.match(/^([a-z][a-z+#]{2,})(\d+)$/);
    if (versioned) tokens.push(versioned[1], versioned[2]);
    else tokens.push(part);
  }
  return tokens;
}

export function skillOverlaps(wanted, offered) {
  const a = normalizeSkill(wanted);
  const b = normalizeSkill(offered);
  if (!a || !b) return false;
  if (a === b) return true;

  const tokensA = tokensOf(a);
  const tokensB = tokensOf(b);
  const [shorter, longer] = tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];
  // One-letter skills only match exactly (handled above). "c" must not hit "react".
  if (!shorter.length || shorter.some((token) => token.length < 2)) return false;
  return shorter.every((token) => longer.includes(token));
}

function extractJsonObject(text) {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export function parseSkills(text) {
  const json = extractJsonObject(stripThink(text));
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    const raw = parsed?.skills;
    const list = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
    return [...new Set(list.map((item) => normalizeSkill(item)).filter(Boolean))];
  } catch {
    return [];
  }
}
