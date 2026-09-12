# Career Studio

A personal interview-practice app built around deliberate practice: sit down, start a timed session, retrieve a real story, and speak under a clock.

This is not a task manager. The home screen answers four questions:

- What should I practice right now?
- How long will it take?
- What have I been neglecting?
- Am I actually showing up?

> **Status:**  Actively used and iterated on as a personal prototype. Product direction and workflows are still evolving based on hands-on use, so the implementation is intentionally optimized for rapid experimentation at this stage. Use at your own risk!

## Practice loops

- **Interview drill (50 min)** — 20 min draft (bullets, not a script) → 10 min deliver with the draft hidden → 20 min of rapid-fire unexpected prompts (think, then speak).
- **Rapid Fire (20 min)** — no notes.
- **Story retrieval (15 min)** — one experience, several angles.
- **Quick drill (15 min)** — a shorter version of the same loop.

Speaking phases can record audio. If the browser supports speech recognition, a live transcript is captured so you can paste it into another tool for feedback.

## Stories

Experiences split into situation, what you noticed, constraints, options, decision, implementation, result, and what you learned. Questions can bind to a matching story. Cues during draft are traces of the decision — not lines to memorize.

## Data

App state still lives in this browser (`localStorage` + `IndexedDB` for audio). When you **sign in**
(Account), the full app JSON (except audio blobs) syncs to Cloudflare D1
(last-write-wins). Infra notes: [docs/infra-design-exploration.md](docs/infra-design-exploration.md). Data layout & sync: [docs/data-model.md](docs/data-model.md).

## Run

```bash
npm install
npm run dev
```

API locally (optional, second terminal):

```bash
npm run dev:api
```

Vite proxies `/api` → `http://127.0.0.1:8787`.

Dev OAuth origin: **`http://localhost:<DEV_SERVER_PORT>`** (see committed [`.env`](.env); default `5188`). Set the same origin in Google Cloud Console → Credentials → Web client → Authorized JavaScript origins. After deploy, add your `*.workers.dev` origin too.

## Deploy

Pushes to `main` run [.github/workflows/deploy-workers.yml](.github/workflows/deploy-workers.yml). Repo secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `VITE_GOOGLE_CLIENT_ID`.
