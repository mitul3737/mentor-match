// Mentee-mentor messages before a booking. Stored in one JSON file (v1; DynamoDB later).
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findMentor } from "./match.js";

export const MAX_TEXT = 2000;
export const MAX_NAME = 80;
export const MAX_MESSAGES = 500;
const MENTEE_ID = /^[A-Za-z0-9_-]{8,64}$/;

export const DEFAULT_STORE_PATH = fileURLToPath(
  new URL("../data/conversations.json", import.meta.url)
);

export function cleanMenteeId(menteeId) {
  if (typeof menteeId !== "string" || !MENTEE_ID.test(menteeId)) {
    return { error: "menteeId must be 8-64 letters, numbers, _ or -" };
  }
  return { value: menteeId };
}

export function cleanText(text) {
  if (typeof text !== "string") return { error: "Message text is required" };
  const value = text.trim();
  if (!value) return { error: "Message text is required" };
  if (value.length > MAX_TEXT) return { error: `Message must be ${MAX_TEXT} characters or fewer` };
  if (value.includes("\0")) return { error: "Message text is invalid" };
  return { value };
}

export function cleanName(name, { required }) {
  if (typeof name !== "string") {
    return { error: required ? "Your name is required" : "Name is invalid" };
  }
  const value = name.trim();
  if (!value) return { error: required ? "Your name is required" : "Name is invalid" };
  if (value.length > MAX_NAME) return { error: `Name must be ${MAX_NAME} characters or fewer` };
  if (value.includes("\0")) return { error: "Name is invalid" };
  return { value };
}

function publicMessage(message) {
  return {
    id: message.id,
    from: message.from,
    text: message.text,
    createdAt: message.createdAt,
  };
}

function publicMentor(mentor) {
  return {
    id: mentor.id,
    name: mentor.name,
    title: mentor.title,
    priceUsd: mentor.priceUsd,
  };
}

export function createMessageStore(filePath = DEFAULT_STORE_PATH, { maxMessages = MAX_MESSAGES } = {}) {
  let chain = Promise.resolve();
  const lock = (fn) => {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => {},
      () => {}
    );
    return run;
  };

  async function load() {
    try {
      const data = JSON.parse(await readFile(filePath, "utf8"));
      if (!data || !Array.isArray(data.conversations)) return { conversations: [] };
      return data;
    } catch (err) {
      if (err.code === "ENOENT") return { conversations: [] };
      throw err;
    }
  }

  async function save(data) {
    await mkdir(dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    try {
      await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
      try {
        await rename(tmp, filePath);
      } catch (err) {
        // Windows refuses to rename over a file that already exists.
        if (err.code !== "EEXIST" && err.code !== "EPERM") throw err;
        await rm(filePath, { force: true });
        await rename(tmp, filePath);
      }
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
  }

  const findThread = (data, mentorId, menteeId) =>
    data.conversations.find((item) => item.mentorId === mentorId && item.menteeId === menteeId);

  return {
    filePath,

    async getThread(mentorId, menteeId) {
      const mentor = findMentor(mentorId);
      if (!mentor) return { error: "Mentor not found", status: 404 };
      const id = cleanMenteeId(menteeId);
      if (id.error) return { error: id.error, status: 400 };
      const thread = findThread(await load(), mentorId, id.value);
      return {
        status: 200,
        body: {
          mentor: publicMentor(mentor),
          menteeId: id.value,
          menteeName: thread?.menteeName ?? null,
          messages: (thread?.messages ?? []).map(publicMessage),
        },
      };
    },

    async postMenteeMessage({ mentorId, menteeId, menteeName, text }) {
      const mentor = findMentor(mentorId);
      if (!mentor) return { error: "Mentor not found", status: 404 };
      const id = cleanMenteeId(menteeId);
      if (id.error) return { error: id.error, status: 400 };
      const name = cleanName(menteeName, { required: true });
      if (name.error) return { error: name.error, status: 400 };
      const body = cleanText(text);
      if (body.error) return { error: body.error, status: 400 };

      return lock(async () => {
        const data = await load();
        const now = new Date().toISOString();
        let thread = findThread(data, mentorId, id.value);
        if (!thread) {
          thread = {
            mentorId,
            menteeId: id.value,
            menteeName: name.value,
            updatedAt: now,
            messages: [],
          };
          data.conversations.push(thread);
        }
        if (thread.messages.length >= maxMessages) {
          return { error: "This conversation is full", status: 400 };
        }
        thread.menteeName = name.value;
        const message = { id: randomUUID(), from: "mentee", text: body.value, createdAt: now };
        thread.messages.push(message);
        thread.updatedAt = now;
        await save(data);
        return { status: 201, body: { message: publicMessage(message), menteeName: thread.menteeName } };
      });
    },

    async postMentorReply({ mentorId, menteeId, text }) {
      const mentor = findMentor(mentorId);
      if (!mentor) return { error: "Mentor not found", status: 404 };
      const id = cleanMenteeId(menteeId);
      if (id.error) return { error: id.error, status: 400 };
      const body = cleanText(text);
      if (body.error) return { error: body.error, status: 400 };

      return lock(async () => {
        const data = await load();
        const thread = findThread(data, mentorId, id.value);
        if (!thread) return { error: "No conversation with this mentee yet", status: 404 };
        if (thread.messages.length >= maxMessages) {
          return { error: "This conversation is full", status: 400 };
        }
        const now = new Date().toISOString();
        const message = { id: randomUUID(), from: "mentor", text: body.value, createdAt: now };
        thread.messages.push(message);
        thread.updatedAt = now;
        await save(data);
        return { status: 201, body: { message: publicMessage(message) } };
      });
    },

    async listInbox(mentorId) {
      const mentor = findMentor(mentorId);
      if (!mentor) return { error: "Mentor not found", status: 404 };
      const data = await load();
      const conversations = data.conversations
        .filter((item) => item.mentorId === mentorId)
        .map((item) => {
          const last = item.messages.at(-1);
          return {
            menteeId: item.menteeId,
            menteeName: item.menteeName,
            updatedAt: item.updatedAt,
            messageCount: item.messages.length,
            preview: last ? last.text.slice(0, 140) : "",
            lastFrom: last?.from ?? null,
          };
        })
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
      return {
        status: 200,
        body: { mentor: publicMentor(mentor), conversations },
      };
    },
  };
}
