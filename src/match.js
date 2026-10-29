// Simple scoring: count overlapping skills (with partial matches), return top 3.
import { readFileSync } from "node:fs";

const mentors = JSON.parse(
  readFileSync(new URL("./mentors.json", import.meta.url), "utf8")
);

export function allMentors() {
  return mentors;
}

export function findMentor(id) {
  return mentors.find((m) => m.id === id);
}

export function matchMentors(skills) {
  if (!skills.length) return [];
  return mentors
    .map((m) => ({
      mentor: m,
      score: skills.filter((s) =>
        m.skills.some((ms) => ms.includes(s) || s.includes(ms))
      ).length,
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r) => r.mentor);
}
