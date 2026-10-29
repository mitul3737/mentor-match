# Figma design brief — MentorMatch v1

Create one Figma file named **MentorMatch** with these frames (desktop 1440 wide, plus a 390-wide mobile version of frame 1):

1. **Home / Chat** — header with logo and tagline; chat panel on the left (message bubbles, input, send button, a small "Cerebras: 120 ms" latency badge); matched mentor cards on the right.
2. **Mentor card** (component) — name, title, price per session, short bio, skill tags, "Book" button. Make it a component with variants for default and hover.
3. **Mentor payouts** — list of mentors with a status pill (Not connected / Onboarding incomplete / Ready) and a "Connect with Stripe" button.
4. **Payment result** — success and cancelled states.

Tips
- Use Auto Layout everywhere so Claude Code can map frames to flexbox cleanly.
- Name layers meaningfully (`ChatPanel`, `MentorCard`, `StatusPill`) — the names show up in the generated code.
- Define color and text styles (or variables) — they become CSS variables.
