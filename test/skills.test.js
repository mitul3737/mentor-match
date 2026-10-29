import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSkills, skillOverlaps, stripThink } from "../src/skills.js";

test("stripThink removes closed think blocks and leaves the reply", () => {
  assert.equal(stripThink("<think>secret</think>Hello"), "Hello");
  assert.equal(stripThink("<THINK>secret</THINK>Hi"), "Hi");
  assert.equal(stripThink("Hello"), "Hello");
  assert.equal(stripThink(null), "");
  assert.equal(stripThink("<think>still open"), "<think>still open");
});

test("skillOverlaps is case-insensitive and uses whole tokens", () => {
  assert.equal(skillOverlaps("AWS", "aws"), true);
  assert.equal(skillOverlaps("node.js", "node"), true);
  assert.equal(skillOverlaps("react.js", "react"), true);
  assert.equal(skillOverlaps("python3", "python"), true);
  assert.equal(skillOverlaps("web", "web development"), true);
  assert.equal(skillOverlaps("ai", "generative ai"), true);
  assert.equal(skillOverlaps("c", "c"), true);

  assert.equal(skillOverlaps("java", "javascript"), false);
  assert.equal(skillOverlaps("c", "react"), false);
  assert.equal(skillOverlaps("c", "docker"), false);
  assert.equal(skillOverlaps("ml", "mlops"), false);
  assert.equal(skillOverlaps("go", "golang"), false);
  assert.equal(skillOverlaps("js", "javascript"), false);
  assert.equal(skillOverlaps("ui design", "design systems"), false);
  assert.equal(skillOverlaps("", "aws"), false);
  assert.equal(skillOverlaps("aws", null), false);
});

test("parseSkills reads the first JSON object and normalizes the list", () => {
  assert.deepEqual(parseSkills('{"skills": ["Terraform", "AWS", " aws "]}'), ["terraform", "aws"]);
  assert.deepEqual(
    parseSkills('<think>{"skills":["java"]}</think>\n{"skills":["Terraform", "AWS"]}'),
    ["terraform", "aws"]
  );
  assert.deepEqual(
    parseSkills('Sure {"skills": ["aws"]} trailing {"skills": ["java"]}'),
    ["aws"]
  );
  assert.deepEqual(parseSkills('```json\n{"skills": ["Figma"]}\n```'), ["figma"]);
  assert.deepEqual(parseSkills('{"skills": "Node.js"}'), ["node.js"]);
  assert.deepEqual(parseSkills('{"skills": ["aws", 1, "", null]}'), ["aws"]);
  assert.deepEqual(parseSkills('{"skills": null}'), []);
  assert.deepEqual(parseSkills('{"skills": [}'), []);
  assert.deepEqual(parseSkills("no json here"), []);
  assert.deepEqual(parseSkills("<think>{\"skills\":[\"aws\"]}</think>"), []);
});
