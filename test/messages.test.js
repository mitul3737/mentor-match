import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { createMessageStore, MAX_TEXT } from "../src/messages.js";

// The Cerebras SDK throws on import when this is empty. Message tests never call it.
process.env.CEREBRAS_API_KEY ||= "unused-test-key";
const { createApp } = await import("../server.js");

const dirs = [];

after(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempStore(options) {
  const dir = await mkdtemp(join(tmpdir(), "mm-chat-"));
  dirs.push(dir);
  const file = join(dir, "nested", "conversations.json");
  return createMessageStore(file, options);
}

function listen(app) {
  const server = createServer(app);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

async function withApi(fn, storeOptions) {
  const store = await tempStore(storeOptions);
  const { server, base } = await listen(createApp({ store }));
  try {
    await fn(base, store);
  } finally {
    await close(server);
  }
}

async function postJson(url, body) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("creates the data directory and keeps mentee threads apart", async () => {
  const store = await tempStore({ maxMessages: 2 });
  const first = await store.postMenteeMessage({
    mentorId: "m4",
    menteeId: "mentee-aaa",
    menteeName: "  রাফি  ",
    text: "  Hi there  ",
  });
  assert.equal(first.status, 201);
  assert.equal(first.body.message.from, "mentee");
  assert.equal(first.body.message.text, "Hi there");
  assert.equal(first.body.menteeName, "রাফি");
  assert.equal(existsSync(store.filePath), true);

  await store.postMenteeMessage({
    mentorId: "m4",
    menteeId: "mentee-bbb",
    menteeName: "Sam",
    text: "Other thread",
  });
  await store.postMentorReply({ mentorId: "m4", menteeId: "mentee-bbb", text: "Welcome" });

  const own = await store.getThread("m4", "mentee-aaa");
  assert.equal(own.status, 200);
  assert.equal(own.body.messages.length, 1);
  assert.equal(own.body.menteeName, "রাফি");
  assert.equal(own.body.mentor.name, "Rafi Chowdhury");

  const inbox = await store.listInbox("m4");
  assert.deepEqual(
    inbox.body.conversations.map((item) => item.menteeId),
    ["mentee-bbb", "mentee-aaa"]
  );
  assert.equal(inbox.body.conversations[0].preview, "Welcome");
  assert.equal(inbox.body.conversations[0].lastFrom, "mentor");
  assert.equal(inbox.body.conversations[0].messageCount, 2);

  const unrelated = await store.listInbox("m1");
  assert.deepEqual(unrelated.body.conversations, []);

  await store.postMenteeMessage({
    mentorId: "m4",
    menteeId: "mentee-aaa",
    menteeName: "রাফি",
    text: "Second",
  });
  const full = await store.postMenteeMessage({
    mentorId: "m4",
    menteeId: "mentee-aaa",
    menteeName: "রাফি",
    text: "Third",
  });
  assert.equal(full.status, 400);
  assert.equal(full.error, "This conversation is full");
  const capped = await store.getThread("m4", "mentee-aaa");
  assert.equal(capped.body.messages.length, 2);
});

test("mentor replies require an existing thread and cannot be spoofed by the mentee route", async () => {
  const store = await tempStore();
  const missing = await store.postMentorReply({
    mentorId: "m1",
    menteeId: "mentee-aaa",
    text: "Hello",
  });
  assert.equal(missing.status, 404);

  const posted = await store.postMenteeMessage({
    mentorId: "m1",
    menteeId: "mentee-aaa",
    menteeName: "Alex",
    text: "<script>alert(1)</script>",
  });
  assert.equal(posted.body.message.text, "<script>alert(1)</script>");
  assert.equal(posted.body.message.from, "mentee");

  const renamed = await store.postMenteeMessage({
    mentorId: "m1",
    menteeId: "mentee-aaa",
    menteeName: "Alex Rahman",
    text: "Name change",
  });
  assert.equal(renamed.body.menteeName, "Alex Rahman");

  const thread = await store.getThread("m1", "mentee-aaa");
  assert.deepEqual(
    thread.body.messages.map((message) => message.text),
    ["<script>alert(1)</script>", "Name change"]
  );
});

test("concurrent posts do not drop messages", async () => {
  const store = await tempStore();
  await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      store.postMenteeMessage({
        mentorId: "m2",
        menteeId: "mentee-ccc",
        menteeName: "Alex",
        text: `message ${index}`,
      })
    )
  );
  const thread = await store.getThread("m2", "mentee-ccc");
  assert.equal(thread.body.messages.length, 20);
  assert.equal(new Set(thread.body.messages.map((message) => message.text)).size, 20);
});

test("preview is capped and unknown mentors 404", async () => {
  const store = await tempStore();
  const text = "x".repeat(180);
  await store.postMenteeMessage({
    mentorId: "m6",
    menteeId: "mentee-ddd",
    menteeName: "Alex",
    text,
  });
  const inbox = await store.listInbox("m6");
  assert.equal(inbox.body.conversations[0].preview.length, 140);
  assert.equal((await store.getThread("m6", "mentee-ddd")).body.messages[0].text.length, 180);

  assert.equal((await store.getThread("missing", "mentee-ddd")).status, 404);
  assert.equal((await store.listInbox("missing")).status, 404);
  assert.equal(
    (await store.postMenteeMessage({ mentorId: "missing", menteeId: "mentee-ddd", menteeName: "Alex", text: "Hi" }))
      .status,
    404
  );
});

test("a corrupt conversations file surfaces as an error", async () => {
  const store = await tempStore();
  const { mkdir } = await import("node:fs/promises");
  await mkdir(dirname(store.filePath), { recursive: true });
  await writeFile(store.filePath, "{", "utf8");
  await assert.rejects(() => store.getThread("m1", "mentee-aaa"));
});

test("chat pages insert message text with textContent", () => {
  for (const file of ["public/chat.js", "public/inbox.js"]) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(src, /textContent/);
    assert.equal(src.includes("innerHTML"), false, file);
    assert.equal(src.includes("insertAdjacentHTML"), false, file);
  }
  const cards = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(cards, /Message mentor/);
  assert.match(cards, /chat\.html\?mentor=/);
  const chatPage = readFileSync(new URL("../public/chat.html", import.meta.url), "utf8");
  assert.match(chatPage, /Book a slot/);
});

test("routes list and post messages, and booking stays a separate route", async () => {
  await withApi(async (base) => {
    const menteeId = "mentee-one1";
    const created = await postJson(`${base}/api/conversations/m1/messages`, {
      menteeId,
      menteeName: "  Alex  ",
      text: "  Can we talk about Terraform? <b>no html</b>  ",
      from: "mentor",
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json();
    assert.equal(createdBody.message.from, "mentee");
    assert.equal(createdBody.message.text, "Can we talk about Terraform? <b>no html</b>");
    assert.equal(createdBody.menteeName, "Alex");
    assert.equal(createdBody.message.text.length < MAX_TEXT, true);

    const listed = await fetch(`${base}/api/conversations/m1?menteeId=${menteeId}`);
    assert.equal(listed.status, 200);
    const thread = await listed.json();
    assert.equal(thread.mentor.name, "Nadia Rahman");
    assert.equal(thread.messages.length, 1);
    assert.equal(thread.messages[0].id, createdBody.message.id);

    const exact = await postJson(`${base}/api/conversations/m1/messages`, {
      menteeId,
      menteeName: "Alex",
      text: "y".repeat(MAX_TEXT),
    });
    assert.equal(exact.status, 201);

    const reply = await postJson(`${base}/api/inbox/m1/reply`, {
      menteeId,
      text: "Yes, happy to chat first.",
    });
    assert.equal(reply.status, 201);
    assert.equal((await reply.json()).message.from, "mentor");

    const inbox = await fetch(`${base}/api/inbox/m1`);
    assert.equal(inbox.status, 200);
    const inboxBody = await inbox.json();
    assert.equal(inboxBody.conversations.length, 1);
    assert.equal(inboxBody.conversations[0].preview, "Yes, happy to chat first.");
    assert.equal(inboxBody.conversations[0].messageCount, 3);

    const empty = await fetch(`${base}/api/conversations/m5?menteeId=${menteeId}`);
    assert.equal(empty.status, 200);
    assert.deepEqual((await empty.json()).messages, []);

    const book = await fetch(`${base}/api/book/m1`, { method: "POST" });
    assert.equal(book.status, 400);
    const bookBody = await book.json();
    assert.equal(typeof bookBody.error, "string");
    assert.equal(bookBody.url, undefined);
  });
});

test("routes reject invalid messages and unknown threads", async () => {
  await withApi(async (base) => {
    const cases = [
      [{}, 400],
      [{ menteeId: "mentee-one1", menteeName: "Alex", text: "   " }, 400],
      [{ menteeId: "mentee-one1", menteeName: "Alex", text: "bad\0text" }, 400],
      [{ menteeId: "short", menteeName: "Alex", text: "Hi" }, 400],
      [{ menteeId: "bad id!!", menteeName: "Alex", text: "Hi" }, 400],
      [{ menteeId: "mentee-one1", menteeName: "", text: "Hi" }, 400],
      [{ menteeId: "mentee-one1", menteeName: "   ", text: "Hi" }, 400],
      [{ menteeId: "mentee-one1", menteeName: "A".repeat(81), text: "Hi" }, 400],
      [{ menteeId: "mentee-one1", menteeName: "Alex", text: "x".repeat(MAX_TEXT + 1) }, 400],
      [{ menteeId: "mentee-one1", text: "Hi" }, 400],
    ];
    for (const [body, status] of cases) {
      const res = await postJson(`${base}/api/conversations/m1/messages`, body);
      assert.equal(res.status, status, JSON.stringify(body));
      const payload = await res.json();
      assert.equal(typeof payload.error, "string");
    }

    const unknownMentor = await postJson(`${base}/api/conversations/no-such/messages`, {
      menteeId: "mentee-one1",
      menteeName: "Alex",
      text: "Hi",
    });
    assert.equal(unknownMentor.status, 404);

    const missingId = await fetch(`${base}/api/conversations/m1`);
    assert.equal(missingId.status, 400);

    const unknownThread = await fetch(`${base}/api/conversations/no-such?menteeId=mentee-one1`);
    assert.equal(unknownThread.status, 404);

    const reply = await postJson(`${base}/api/inbox/m1/reply`, {
      menteeId: "mentee-one1",
      text: "Hello",
    });
    assert.equal(reply.status, 404);

    const badReply = await postJson(`${base}/api/inbox/m1/reply`, { menteeId: "mentee-one1", text: "" });
    assert.equal(badReply.status, 400);

    const badJson = await fetch(`${base}/api/conversations/m1/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(badJson.status, 400);
    assert.equal((await badJson.json()).error, "Invalid JSON");
  });
});
