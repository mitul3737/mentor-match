// Chat with one mentor before booking. Message text is untrusted: textContent only.
const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function getInitials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

const MENTEE_KEY = "mentormatch.menteeId";
const NAME_KEY = "mentormatch.menteeName";
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

function menteeId() {
  let id = localStorage.getItem(MENTEE_KEY);
  if (!id || !ID_RE.test(id)) {
    id = crypto.randomUUID();
    localStorage.setItem(MENTEE_KEY, id);
  }
  return id;
}

const params = new URLSearchParams(location.search);
const mentorId = params.get("mentor") || "";
const visitorId = menteeId();

let mentor = null;
let ready = false;
let renderedKey = "";
let stickToBottom = true;

function setError(message) {
  const node = $("form-error");
  node.textContent = message || "";
  node.hidden = !message;
}

function showMissing(message) {
  $("thread-panel").hidden = true;
  $("missing-mentor").hidden = false;
  $("missing-text").textContent = message;
}

function renderHeading() {
  $("mentor-avatar").textContent = getInitials(mentor.name);
  $("mentor-name").textContent = mentor.name;
  $("mentor-meta").textContent = `${mentor.title} · $${mentor.priceUsd}/session`;
}

function renderMessages(messages) {
  const key = JSON.stringify(messages);
  if (key === renderedKey) return;
  renderedKey = key;
  const log = $("thread");
  const previous = log.scrollTop;
  log.replaceChildren();
  if (!messages.length) {
    const empty = el("p", "empty-thread");
    empty.append(
      el("strong", "", "No messages yet. "),
      document.createTextNode("Ask a question, then book a slot when you are ready.")
    );
    log.appendChild(empty);
    return;
  }
  for (const message of messages) {
    const mine = message.from === "mentee";
    const row = el("div", `message-row ${mine ? "user" : "assistant"}`);
    if (!mine) {
      const avatar = el("span", "assistant-avatar", getInitials(mentor.name));
      avatar.setAttribute("aria-hidden", "true");
      row.appendChild(avatar);
    }
    row.appendChild(el("p", "message-bubble", message.text));
    log.appendChild(row);
  }
  log.scrollTop = stickToBottom ? log.scrollHeight : previous;
}

async function loadThread() {
  const res = await fetch(
    `/api/conversations/${encodeURIComponent(mentorId)}?menteeId=${encodeURIComponent(visitorId)}`
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (!ready) showMissing(data.error || "Could not load this conversation");
    return;
  }
  ready = true;
  mentor = data.mentor;
  renderHeading();
  const nameInput = $("mentee-name");
  if (!nameInput.value && data.menteeName) nameInput.value = data.menteeName;
  renderMessages(data.messages || []);
}

async function bookSlot() {
  try {
    const res = await fetch(`/api/book/${encodeURIComponent(mentorId)}`, { method: "POST" });
    const data = await res.json();
    if (data.url) {
      location.href = data.url;
    } else {
      alert(data.error || "Failed to initiate booking");
    }
  } catch {
    alert("Failed to book session. Please try again.");
  }
}

$("chat-form").onsubmit = async (event) => {
  event.preventDefault();
  const name = $("mentee-name").value.trim();
  const text = $("message-text").value;
  setError("");
  if (!name) {
    setError("Your name is required");
    $("mentee-name").focus();
    return;
  }
  if (!text.trim()) {
    setError("Message text is required");
    return;
  }
  localStorage.setItem(NAME_KEY, name);
  const button = $("send-message");
  button.disabled = true;
  try {
    const res = await fetch(`/api/conversations/${encodeURIComponent(mentorId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menteeId: visitorId, menteeName: name, text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not send message");
      return;
    }
    $("message-text").value = "";
    stickToBottom = true;
    renderedKey = "";
    await loadThread();
  } catch {
    setError("Could not send message. Please try again.");
  } finally {
    button.disabled = false;
    $("message-text").focus();
  }
};

$("book-slot").onclick = bookSlot;
$("message-text").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    $("chat-form").requestSubmit();
  }
});
$("thread").addEventListener("scroll", () => {
  const log = $("thread");
  stickToBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 96;
});

const savedName = localStorage.getItem(NAME_KEY);
if (savedName) $("mentee-name").value = savedName;

if (!mentorId) {
  showMissing("Choose a mentor from the home page to start a conversation.");
} else {
  loadThread().catch(() => showMissing("Could not load this conversation"));
  setInterval(() => {
    if (!document.hidden && ready) loadThread().catch(() => {});
  }, 4000);
}
