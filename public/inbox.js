// Mentor inbox. Message text and names are untrusted: textContent only.
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

const MENTOR_KEY = "mentormatch.inboxMentor";
const params = new URLSearchParams(location.search);

let mentorId = "";
let menteeId = "";
let menteeName = "";
let renderedKey = "";
let stickToBottom = true;

function setError(message) {
  const node = $("form-error");
  node.textContent = message || "";
  node.hidden = !message;
}

function setReplyEnabled(enabled) {
  $("reply-text").disabled = !enabled;
  $("send-reply").disabled = !enabled;
}

function renderEmptyList(text) {
  $("conversation-list").replaceChildren(el("p", "inbox-empty", text));
}

function renderConversationList(conversations) {
  const list = $("conversation-list");
  if (!conversations.length) {
    renderEmptyList("No messages yet. When a mentee writes to you, the conversation shows up here.");
    return;
  }
  list.replaceChildren();
  for (const conversation of conversations) {
    const button = el("button", "conversation-item");
    button.type = "button";
    button.setAttribute("role", "listitem");
    if (conversation.menteeId === menteeId) button.classList.add("active");
    button.setAttribute("aria-current", conversation.menteeId === menteeId ? "true" : "false");
    const preview =
      conversation.lastFrom === "mentor" ? `You: ${conversation.preview}` : conversation.preview;
    button.append(el("strong", "", conversation.menteeName), el("span", "", preview));
    button.onclick = () => openConversation(conversation.menteeId, conversation.menteeName);
    list.appendChild(button);
  }
}

function renderMessages(messages) {
  const key = JSON.stringify(messages);
  if (key === renderedKey) return;
  renderedKey = key;
  const log = $("thread");
  const previous = log.scrollTop;
  log.replaceChildren();
  if (!messages.length) {
    log.appendChild(el("p", "empty-thread", "No messages in this conversation yet."));
    return;
  }
  for (const message of messages) {
    const mine = message.from === "mentor";
    const row = el("div", `message-row ${mine ? "user" : "assistant"}`);
    if (!mine) {
      const avatar = el("span", "assistant-avatar", getInitials(menteeName || "Mentee"));
      avatar.setAttribute("aria-hidden", "true");
      row.appendChild(avatar);
    }
    row.appendChild(el("p", "message-bubble", message.text));
    log.appendChild(row);
  }
  log.scrollTop = stickToBottom ? log.scrollHeight : previous;
}

async function loadInbox() {
  const res = await fetch(`/api/inbox/${encodeURIComponent(mentorId)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    renderEmptyList(data.error || "Could not load the inbox");
    return;
  }
  const conversations = data.conversations || [];
  if (menteeId && !conversations.some((item) => item.menteeId === menteeId)) {
    menteeId = "";
    menteeName = "";
    setReplyEnabled(false);
    $("inbox-thread-heading").textContent = "Select a mentee";
    $("inbox-thread-meta").textContent = "";
    $("thread").replaceChildren();
    renderedKey = "";
  }
  renderConversationList(conversations);
  const open = conversations.find((item) => item.menteeId === menteeId);
  if (open) menteeName = open.menteeName;
}

async function loadThread() {
  if (!menteeId) return;
  const res = await fetch(
    `/api/conversations/${encodeURIComponent(mentorId)}?menteeId=${encodeURIComponent(menteeId)}`
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    setError(data.error || "Could not load messages");
    return;
  }
  if (data.menteeName) menteeName = data.menteeName;
  $("inbox-thread-heading").textContent = menteeName || "Mentee";
  $("inbox-thread-meta").textContent = `${data.messages?.length || 0} messages`;
  renderMessages(data.messages || []);
}

async function openConversation(nextMenteeId, nextName) {
  menteeId = nextMenteeId;
  menteeName = nextName || "";
  renderedKey = "";
  stickToBottom = true;
  setError("");
  setReplyEnabled(true);
  $("inbox-thread-heading").textContent = menteeName || "Mentee";
  await loadInbox();
  await loadThread();
  $("reply-text").focus();
}

async function loadMentors() {
  const res = await fetch("/api/mentors");
  const mentors = await res.json();
  const select = $("mentor-select");
  select.replaceChildren();
  for (const mentor of mentors) {
    const option = document.createElement("option");
    option.value = mentor.id;
    option.textContent = `${mentor.name} · ${mentor.title}`;
    select.appendChild(option);
  }
  const requested = params.get("mentor") || localStorage.getItem(MENTOR_KEY);
  if (requested && mentors.some((mentor) => mentor.id === requested)) {
    select.value = requested;
  }
  mentorId = select.value;
  localStorage.setItem(MENTOR_KEY, mentorId);
  await loadInbox();
}

$("mentor-select").onchange = async () => {
  mentorId = $("mentor-select").value;
  localStorage.setItem(MENTOR_KEY, mentorId);
  menteeId = "";
  menteeName = "";
  renderedKey = "";
  setError("");
  setReplyEnabled(false);
  $("reply-text").value = "";
  $("inbox-thread-heading").textContent = "Select a mentee";
  $("inbox-thread-meta").textContent = "";
  $("thread").replaceChildren(el("p", "empty-thread", "Select a mentee to read the thread."));
  await loadInbox();
};

$("reply-form").onsubmit = async (event) => {
  event.preventDefault();
  const text = $("reply-text").value;
  setError("");
  if (!menteeId) return;
  if (!text.trim()) {
    setError("Message text is required");
    return;
  }
  const button = $("send-reply");
  button.disabled = true;
  try {
    const res = await fetch(`/api/inbox/${encodeURIComponent(mentorId)}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menteeId, text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not send reply");
      return;
    }
    $("reply-text").value = "";
    stickToBottom = true;
    renderedKey = "";
    await loadThread();
    await loadInbox();
  } catch {
    setError("Could not send reply. Please try again.");
  } finally {
    button.disabled = !menteeId;
    $("reply-text").focus();
  }
};

$("reply-text").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    $("reply-form").requestSubmit();
  }
});

$("thread").addEventListener("scroll", () => {
  const log = $("thread");
  stickToBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 96;
});

loadMentors().catch(() => renderEmptyList("Could not load mentors. Refresh the page."));

setInterval(() => {
  if (document.hidden || !mentorId) return;
  loadInbox().catch(() => {});
  if (menteeId) loadThread().catch(() => {});
}, 4000);
