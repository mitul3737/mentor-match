// Score mentors by overlapping skills (whole tokens, case-insensitive). Return the top 3.
import { readFileSync } from "node:fs";
import { normalizeSkill, skillOverlaps } from "./skills.js";

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
  const list = Array.isArray(skills) ? skills : typeof skills === "string" ? [skills] : [];
  const wanted = [...new Set(list.map((skill) => normalizeSkill(skill)).filter(Boolean))];
  if (!wanted.length) return [];
  return mentors
    .map((m) => ({
      mentor: m,
      score: wanted.filter((skill) =>
        m.skills.some((offered) => skillOverlaps(skill, offered))
      ).length,
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r) => r.mentor);
}
