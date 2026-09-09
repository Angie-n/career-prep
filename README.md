# Career Studio

A personal interview-practice app built around deliberate practice: sit down, start a timed session, retrieve a real story, and speak under a clock.

This is not a task manager. The home screen answers four questions:

- What should I practice right now?
- How long will it take?
- What have I been neglecting?
- Am I actually showing up?

## Practice loops

- **Interview drill (50 min)** — 20 min draft (bullets, not a script) → 10 min deliver with the draft hidden → 20 min of unexpected cold questions (think, then speak).
- **Cold questions (20 min)** — no notes.
- **Story retrieval (15 min)** — one experience, several angles.
- **Quick drill (15 min)** — a shorter version of the same loop.

Speaking phases can record audio. If the browser supports speech recognition, a live transcript is captured so you can paste it into another tool for feedback.

## Stories

Experiences split into situation, what you noticed, constraints, options, decision, implementation, result, and what you learned. Questions can bind to a matching story. Cues during draft are traces of the decision — not lines to memorize.

## Data

Everything stays in this browser (`localStorage` + `IndexedDB` for audio). There is no account.

## Run

```bash
npm install
npm run dev
```
