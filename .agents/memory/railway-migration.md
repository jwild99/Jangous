---
name: Railway / off-Replit deploy + email-password auth
description: How Jango.us was made deployable off Replit and the auth/DB driver decisions behind it.
---

# Off-Replit deploy + email/password auth

## DB driver selection (server/db.ts)
- Replit's built-in Postgres host (e.g. "helium") REQUIRES the `@neondatabase/serverless` driver — the plain `pg` driver fails against it. So Neon is the **default** driver.
- For Railway / Render / Fly / self-hosted Postgres, set `DATABASE_DRIVER=pg` to use `node-postgres`. SSL is on by default (`rejectUnauthorized:false`) unless host is localhost or `DATABASE_SSL=false`.
- Use **static imports of both drivers** and branch at runtime — NOT top-level await. `tsc --noEmit` rejects top-level await under this project's tsconfig (even though esbuild/tsx tolerate it). Both driver packages are installed, so importing both is cheap.

## Auth shape compatibility
- The codebase reads `req.user.claims.sub` everywhere (legacy from Replit OIDC). The passport-local session user MUST preserve that `{ claims: { sub, email, ... } }` shape (`toSessionUser` in server/auth.ts) or every authed route + websocket auth breaks.
- passwordHash is stripped from ALL JSON responses via a single `res.json` override middleware (recursive `stripSensitiveFields`). Add new user-returning endpoints freely — they're covered.

## SECURITY: never auto-claim existing accounts on register
- **Rule:** register must reject ANY email already in the users table (409), regardless of whether `password_hash` is null.
- **Why:** an earlier "legacy claim" design let register set a password on any existing passwordless account (migrated OIDC users) with no ownership proof — a trivial account-takeover vector, critical on a real-money platform. Flagged by code review.
- **How to apply:** migrating old null-password users to email/password needs a *verified* reset/migration flow (email OTP / magic link / admin token), not silent claim-on-register.

## Pushing to GitHub (jwild99/Jangous)
- `git push` is blocked in this environment. Mirror changes via the GitHub **Git Data API** (blobs → tree with `base_tree` → commit → PATCH ref). Token is in bash env `GITHUB_TOKEN` only; never print it (mask `gh[pous]_…`). Exclude `exports/`.

## Testing-against-live-DB hazard
- Running register/login curl tests hits the real dev DB and MUTATES seed users (the old claim path even changed a seed user's balance/streak and wrote transactions). Use throwaway emails that definitely don't exist, and clean up (delete transactions FK children before the user row). Streak column is `last_login_date`, not `last_login_at`; there is no `longest_login_streak` (it's `longest_streak`).
