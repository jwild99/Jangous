# Deploying Jango.us off Replit

This app was originally built on Replit. It now runs on any standard Node.js +
PostgreSQL host (Railway, Render, Fly.io, a VPS, etc.). Two things made it
Replit-specific and have been replaced:

1. **Auth** — Replit OIDC login has been replaced with **email + password** auth.
2. **Database driver** — it now supports both the Neon serverless driver (Replit's
   default) and the standard PostgreSQL driver via the `DATABASE_DRIVER` flag.

---

## Prerequisites

- Node.js 20+
- A PostgreSQL database

---

## Environment variables

Copy `.env.example` and fill in the values. The essentials for an off-Replit host:

| Variable          | Required | Notes                                                                 |
| ----------------- | -------- | --------------------------------------------------------------------- |
| `DATABASE_URL`    | yes      | PostgreSQL connection string.                                         |
| `DATABASE_DRIVER` | yes\*    | Set to `pg` when **not** on Replit. Leave unset on Replit.            |
| `SESSION_SECRET`  | yes      | Long random string (`openssl rand -hex 32`). Signs session cookies.   |
| `NODE_ENV`        | yes      | `production` in deployment (enables secure cookies).                  |
| `PORT`            | no       | Set automatically by most hosts; defaults to `5000`.                  |
| `DATABASE_SSL`    | no       | Set to `false` only for a local Postgres without SSL.                 |

\* `DATABASE_DRIVER=pg` is required on any host that is not Replit, so the app
uses the standard `pg` driver instead of the Neon serverless driver.

Payments are optional. Leave the Stripe / NOWPayments variables unset to run
without deposit/withdrawal features.

---

## Deploy to Railway

1. Push this repo to GitHub (already mirrored to `jwild99/Jangous`).
2. In Railway: **New Project → Deploy from GitHub repo** and pick the repo.
3. Add a **PostgreSQL** plugin (Railway provisions a database and exposes its
   connection string).
4. Under the service **Variables**, set:
   - `DATABASE_URL` → reference the Postgres plugin's connection string
   - `DATABASE_DRIVER` → `pg`
   - `SESSION_SECRET` → output of `openssl rand -hex 32`
   - `NODE_ENV` → `production`
5. Set the commands (Railway usually detects these from `package.json`):
   - **Build:** `npm install && npm run build`
   - **Start:** `npm start`
6. Initialize the schema once the database is reachable (see below).

Railway sets `PORT` automatically; the server already listens on `process.env.PORT`.

---

## Initialize the database schema

Drizzle manages the schema. After `DATABASE_URL` and `DATABASE_DRIVER=pg` are set,
run from a machine that can reach the database:

```bash
npm run db:push
```

This creates all tables (including the `users.password_hash` column used by
email/password auth and the `sessions` table used for login sessions).

> The `sessions` table must exist before users can log in — `db:push` creates it.

---

## Build and run locally (off Replit)

```bash
cp .env.example .env      # then edit values
npm install
npm run db:push           # one-time schema setup
npm run build
npm start                 # serves API + built frontend on $PORT (default 5000)
```

For development with hot reload: `npm run dev`.

---

## How the auth works

- `POST /api/register` — `{ email, password }` (password min 8 chars). Creates the
  account, starts a session, and returns the user.
- `POST /api/login` — `{ email, password }`. Starts a session.
- `GET` or `POST /api/logout` — ends the session.
- `GET /api/auth/user` — returns the currently logged-in user (password hash is
  never sent to the client).

Passwords are hashed with `scrypt` and a per-user salt. Sessions are stored in
PostgreSQL (`connect-pg-simple`) and signed with `SESSION_SECRET`.
