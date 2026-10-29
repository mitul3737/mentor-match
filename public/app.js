// State management
const state = {
  history: [],
  query: '',
  detectedSkills: [],
  matchedMentors: [],
  allMentors: [],
  latencyMs: null
};

// Helper functions
const $ = (id) => document.getElementById(id);

function getInitials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('');
}

// Message rendering
function addMessage(role, text) {
  const messageRow = document.createElement('div');
  messageRow.className = `message-row ${role}`;

  if (role === 'assistant') {
    const avatar = document.createElement('span');
    avatar.className = 'assistant-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = 'M';
    messageRow.appendChild(avatar);
  }

  const bubble = document.createElement('p');
  bubble.className = 'message-bubble';
  bubble.textContent = text;
  messageRow.appendChild(bubble);

  $('messages').appendChild(messageRow);
  $('messages').scrollTop = $('messages').scrollHeight;
}

// Mentor card rendering
function renderMentorCard(mentor) {
  const card = document.createElement('article');
  card.className = 'mentor-card';

  const initials = getInitials(mentor.name);

  card.innerHTML = `
    <div class="mentor-top">
      <div class="mentor-identity">
        <span class="mentor-avatar" aria-hidden="true">${initials}</span>
        <div>
          <h3>${mentor.name}</h3>
          <p>${mentor.title}</p>
        </div>
      </div>
      <strong class="price">
        $${mentor.priceUsd}
        <span>/session</span>
      </strong>
    </div>
    <p class="mentor-bio">${mentor.bio}</p>
    <div class="skill-list">
      ${mentor.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
    </div>
    <button class="book-button" type="button" data-id="${mentor.id}">
      Book session <span aria-hidden="true">→</span>
    </button>
  `;

  card.querySelector('.book-button').onclick = () => bookMentor(mentor.id);

  return card;
}

function renderMentorList(mentors, isMatched = false) {
  const mentorList = $('mentor-list');
  const matchesContainer = $('matches-container');

  if (isMatched && mentors.length === 0) {
    // Show empty state
    matchesContainer.innerHTML = `
      <div class="matches-heading">
        <div>
          <span class="eyebrow">Personalized for you</span>
          <h2 id="matches-heading">Matched mentors</h2>
        </div>
        <span class="match-count">0 matches</span>
      </div>
      <div class="mentor-list">
        <div class="empty-state">
          <span aria-hidden="true">⌕</span>
          <h3>No exact matches yet</h3>
          <p>Try another skill or a broader topic to find your mentor.</p>
        </div>
      </div>
    `;
    return;
  }

  if (isMatched) {
    // Show matched mentors
    matchesContainer.innerHTML = `
      <div class="matches-heading">
        <div>
          <span class="eyebrow">Personalized for you</span>
          <h2 id="matches-heading">Matched mentors</h2>
        </div>
        <span class="match-count">${mentors.length} ${mentors.length === 1 ? 'match' : 'matches'}</span>
      </div>
      <div class="mentor-list" id="mentor-list"></div>
    `;
  } else {
    // Show initial state with browse section
    mentorList.innerHTML = '';
  }

  const listElement = $('mentor-list');
  mentors.forEach(mentor => {
    listElement.appendChild(renderMentorCard(mentor));
  });
}

// Booking
async function bookMentor(mentorId) {
  try {
    const res = await fetch(`/api/book/${mentorId}`, { method: 'POST' });
    const data = await res.json();
    if (data.url) {
      location.href = data.url;
    } else {
      alert(data.error || 'Failed to initiate booking');
    }
  } catch (error) {
    alert('Failed to book session. Please try again.');
  }
}

// Chat submission
$('chat-form').onsubmit = async (e) => {
  e.preventDefault();

  const input = $('mentor-search');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  addMessage('user', text);
  state.history.push({ role: 'user', content: text });
  const requestId = ++chatRequest;

  // Update detected skills placeholder
  $('detected-skills-text').textContent = 'analyzing...';
  $('latency-text').textContent = 'Cerebras: ...';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: state.history }),
    });

    const data = await res.json();
    if (requestId !== chatRequest) return;

    if (data.error) {
      addMessage('assistant', `Error: ${data.error}`);
      $('detected-skills-text').textContent = 'error';
      $('latency-text').textContent = 'Cerebras: -- ms';
      return;
    }

    // Update state
    state.query = text;
    state.detectedSkills = data.skills || [];
    state.matchedMentors = data.mentors || [];
    state.latencyMs = data.cerebrasLatencyMs;

    // Add assistant response
    addMessage('assistant', data.reply);
    state.history.push({ role: 'assistant', content: data.reply });

    // Update UI
    $('detected-skills-text').textContent =
      state.detectedSkills.length ? state.detectedSkills.join(', ') : 'none detected';
    $('latency-text').textContent = `Cerebras: ${state.latencyMs || '--'} ms`;

    // Render matched mentors
    renderMentorList(state.matchedMentors, true);

  } catch (error) {
    if (requestId !== chatRequest) return;
    addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
    $('detected-skills-text').textContent = 'error';
    $('latency-text').textContent = 'Cerebras: -- ms';
  }
};

// Load all mentors on page load
async function loadAllMentors() {
  try {
    const res = await fetch('/api/mentors');
    const mentors = await res.json();
    state.allMentors = mentors;

    // Update total count
    $('total-mentors-count').textContent = `${mentors.length} mentors`;

    // Render all mentors initially
    renderMentorList(mentors, false);
  } catch (error) {
    $('total-mentors-count').textContent = 'Error loading';
    console.error('Failed to load mentors:', error);
  }
}

const GREETING = "Hi! Tell me a skill, tool, or topic you want to learn and I'll find the right mentor.";
let chatRequest = 0;

const browseMatchesHTML = `
  <div class="initial-matches">
    <span class="initial-matches-icon" aria-hidden="true">M</span>
    <h2 id="matches-heading">Your matches will appear here</h2>
    <p>Tell the assistant what you want to learn</p>
  </div>
  <div class="browse-heading">
    <div>
      <span class="eyebrow">Explore the marketplace</span>
      <h3>Browse all mentors</h3>
    </div>
    <span id="total-mentors-count"></span>
  </div>
  <div class="mentor-list" id="mentor-list"></div>
`;

function showAllMentors() {
  $('matches-container').innerHTML = browseMatchesHTML;
  $('total-mentors-count').textContent = state.allMentors.length
    ? `${state.allMentors.length} mentors`
    : 'Loading...';
  if (state.allMentors.length) renderMentorList(state.allMentors, false);
}

function clearChat() {
  chatRequest += 1;
  state.history = [];
  state.query = '';
  state.detectedSkills = [];
  state.matchedMentors = [];
  state.latencyMs = null;
  $('mentor-search').value = '';
  $('messages').replaceChildren();
  $('detected-skills-text').textContent = 'waiting for a skill';
  $('latency-text').textContent = 'Cerebras: -- ms';
  showAllMentors();
  addMessage('assistant', GREETING);
}

$('clear-chat').onclick = clearChat;

function showPaymentResult(success, mentorId) {
  document.documentElement.classList.add('show-payment');
  const icon = $('result-icon');
  icon.className = `result-icon ${success ? 'success' : 'cancelled'}`;
  icon.textContent = success ? '✓' : '✕';
  $('result-title').textContent = success ? 'Payment successful' : 'Payment cancelled';
  $('result-message').textContent = success
    ? 'Payment succeeded (test mode). Your session is confirmed!'
    : 'Payment cancelled. No charge was made.';

  const receipt = $('booking-receipt');
  receipt.hidden = true;
  if (!mentorId) return;

  fetch('/api/mentors')
    .then((res) => res.json())
    .then((mentors) => {
      const mentor = mentors.find((item) => item.id === mentorId);
      if (!mentor) return;
      $('receipt-mentor').textContent = `Session with ${mentor.name}`;
      $('receipt-price').textContent = `$${mentor.priceUsd}`;
      receipt.hidden = false;
    })
    .catch(() => {});
}

// Initialize
addMessage('assistant', GREETING);

// Payment page: ?paid=mentorId or ?cancelled=mentorId, no result switcher.
const params = new URLSearchParams(location.search);
if (params.has('paid') || params.has('cancelled')) {
  showPaymentResult(params.has('paid'), params.get('paid') || params.get('cancelled'));
}

// Load mentors
loadAllMentors();
