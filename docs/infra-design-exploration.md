# Infrastructure design exploration

**Status:** Decision recorded — implement GitHub → Cloudflare Workers (static assets) → D1, with Google identity for users.  
**Constraints:** Solo / very low traffic; stay on **$0** free tiers; **one shared Worker + one D1**; rows scoped by user (no per-user servers).

## App shape

Career Studio is a **Vite + React SPA** with client-side routes (`BrowserRouter`). Different URLs do not mean server-rendered pages: the host serves `index.html`, then React Router picks the view.

**Today:** GitHub Pages; state in `localStorage` / IndexedDB; optional Google Sheets via GIS **access tokens**.  
**Target:** Same SPA on Workers static assets; **Google ID tokens** identify users; app data in **D1** keyed by Google `sub`.

## GitHub Pages vs Cloudflare Pages vs Workers

| | GitHub Pages | Cloudflare Pages | Workers + static assets |
|---|---|---|---|
| Cost (solo) | Free | Free | Free (static unlimited; Worker invokes limited) |
| Backend / DB | No | Functions + D1 possible | First-class Worker + D1 |
| SPA routing | `404.html` copy hack | `_redirects` / Functions | `not_found_handling = "single-page-application"` |
| Deploy | Actions → Pages | CF Git integration or Wrangler | Wrangler / Actions |
| Product direction | Stable static host | Supported; less new investment | Cloudflare’s full-stack focus |

**GitHub Pages** is enough while data stays in the browser. It **cannot** host an API or D1.

**Cloudflare Pages** can do Functions + D1, but for a new full-stack app Cloudflare steers toward **Workers with static assets** (one deploy unit). That is the chosen host.

**Moving static-only to Pages** without an API would be optional churn; skip it.

### Free-tier notes (adequate for one user)

- **GitHub Pages:** ~1 GB site, soft ~100 GB/mo bandwidth.
- **Workers Free:** 100k **Worker** requests/day; **static asset** requests free/unlimited; 10 ms CPU/invocation.
- **D1 Free:** 5M rows read/day, 100k rows written/day, 500 MB/DB, 5 GB account; daily limits enforced (queries fail until UTC reset).

## Chosen stack

```text
GitHub (main) → Actions + Wrangler → Cloudflare Worker
                                      ├─ static assets (SPA)
                                      ├─ /api/* (auth + data)
                                      └─ D1 `career-prep` (shared DB, per-user rows)
```

- **Auth:** Google Identity Services **ID token** (JWT). Worker verifies `aud` + signature (or tokeninfo); upsert `users` by `sub`.
- **Secrets in CI:** repository secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; deploy only on `push` to `main`. Prefer scoped Account API token (Workers Scripts Edit, Account Settings Read, D1 Edit). Do **not** use Client IP allowlists for GitHub-hosted runners (IPs rotate). OIDC for Wrangler is not available yet.

## Alternatives considered (brief)

| Option | Why not default |
|--------|-----------------|
| GH Pages + separate API host | Extra moving parts for little gain |
| Vercel/Netlify + Neon/Supabase | Fine free tiers; splits vendors; Postgres heavier than needed |
| Turso | Strong free SQLite option if leaving Cloudflare |
| Keep local-only | No cross-device sync / backup |

## Data placement

| Data | Store |
|------|--------|
| Sessions, stories, goals, prefs | D1, `user_id` = Google `sub` |
| Interview audio blobs | Stay IndexedDB (or R2 later); avoid D1 |

## Cutover checklist (ops)

1. D1 created (`career-prep`) — done.
2. GitHub repo secrets for Cloudflare — done.
3. First Worker deploy → note `*.workers.dev` URL.
4. Google Cloud OAuth Web client: add that origin (keep `http://localhost:<DEV_SERVER_PORT>` from `.env`).
5. Set `VITE_GOOGLE_CLIENT_ID` for CI builds + Worker `GOOGLE_CLIENT_ID` var (same public client id).
6. Retire or stop relying on GitHub Pages once Workers is canonical.
