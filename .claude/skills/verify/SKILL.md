---
name: verify
description: How to launch this CRM and drive it in a real browser to verify a change, including bypassing Google OAuth locally.
---

# Verifying changes in omnius.team CRM

## 1. Get the stack running

```bash
docker info >/dev/null 2>&1 || open -a Docker   # Docker Desktop is often not running; start it and poll `docker info` until it succeeds
docker compose up -d --build                     # builds+starts postgres, backend, frontend (nginx serving the built SPA on :80)
```

If you only changed `server/**`, `docker compose up -d --build backend` is enough — the backend image is NOT bind-mounted, so code changes never reach the running container without a rebuild (this has caused a real "works in code, not in browser" incident before — see project memory).

If you only changed `client/src/**`, you must rebuild the `frontend` service too — it's a static `vite build` baked into an nginx image at build time, not a dev server:

```bash
docker compose up -d --build frontend
```

Apply any new migration with `npm run migrate` from the repo root (bare — the npm script already ends in `up`; passing an extra `up` arg makes node-pg-migrate silently no-op, matching nothing).

The app is then reachable at `http://localhost` (frontend/nginx) and the API directly at `http://localhost:3000/api/v1/...`.

## 2. Auth: bypass Google OAuth for local verification

There's no dev-login bypass in the app itself (real Google OAuth only). Fastest way to get an authenticated session without real Google credentials: forge a valid `express-session` row directly in Postgres, since sessions are stored via `connect-pg-simple` in the `session` table and signed with `SESSION_SECRET` from `.env`.

```bash
cd /path/to/repo
node -e "
const crypto = require('crypto');
const secret = '<SESSION_SECRET from .env>';
const sid = crypto.randomBytes(24).toString('hex');
const sig = crypto.createHmac('sha256', secret).update(sid).digest('base64').replace(/\=+\$/, '');
console.log('SID=' + sid);
console.log('COOKIE=' + encodeURIComponent('s:' + sid + '.' + sig));
"
```

Pick a real user id (`SELECT id, email, role FROM users;` in the `omnius_crm_db` container — admin/bdm to test write paths, or a role without google_id set is fine, doesn't matter for session auth). Insert the session:

```sql
INSERT INTO session (sid, sess, expire) VALUES (
  '<SID from above>',
  '{"cookie":{"originalMaxAge":604800000,"expires":"2026-08-02T00:00:00.000Z","httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"<user_id>"}}',
  '2026-08-02 00:00:00'
);
```

Then either `curl -H "Cookie: connect.sid=<COOKIE>" http://localhost:3000/api/v1/users` to sanity check, or set that cookie in a Playwright browser context (`domain: 'localhost', path: '/'`) to drive the actual UI logged in.

**Clean up afterwards**: `DELETE FROM session WHERE sid = '<SID>';` — don't leave forged sessions lying around in the dev DB.

## 3. Driving the UI

No Playwright installed in the repo. Install it ad hoc in the scratchpad dir (not the project — don't add it as a project dependency unless asked):

```bash
mkdir -p /path/to/scratchpad/verify && cd /path/to/scratchpad/verify
npm init -y && npm install playwright@latest && npx playwright install chromium
```

Then a plain Node script with `require('playwright')`, `chromium.launch()`, `context.addCookies([...])` with the forged session cookie, `page.goto('http://localhost/...')`.

## Gotchas hit during real verification

- **Element with `absolute inset-0` intercepts clicks regardless of visual opacity.** A `group-hover:opacity-100` overlay is still fully clickable/click-intercepting even at `opacity-0` — CSS opacity does not disable pointer events. If a real bug is suspected (a sibling handler never firing), Playwright's actionability check will refuse the click and print "X intercepts pointer events" — that's usually correct browser behavior being surfaced, not a Playwright quirk. Use `{ force: true }` to confirm what actually receives the click, and check whether that's really the intended target.
- Sample data for manual link-through testing: query `deals`/`accounts`/`contacts` directly — most demo records don't have url-type fields (Website, Storage URL) pre-filled, and photo-upload contacts are rare. Check before assuming a scenario has fixture data ready.
