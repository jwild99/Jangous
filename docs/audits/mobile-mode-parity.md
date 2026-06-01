# Task #24 — Mobile Mode Parity Audit

Date: 2026-05-26
Scope: Every desktop Play mode must render and work on mobile (< 768px).
Out of scope: New modes, backend matchmaking changes (deferred to Task #25 polish/QA).

> Note on file locations: this codebase has **no `client/src/pages/play.tsx`**. The Play flow is implemented in `client/src/pages/home.tsx` via the `PLAY_MODES` constant (line 127) and the `PlayModal` component (line 149), opened from anywhere via `setPlayModalOpen(true)`. All mode entries — including from the Discovery Zone — funnel through that one modal.

## 1. Mode inventory (desktop ↔ mobile)

| Mode       | Desktop entry                       | Mobile entry                        | Downstream                                  |
| ---------- | ----------------------------------- | ----------------------------------- | ------------------------------------------- |
| Casual     | `PlayModal` mode card               | same                                | `/game/:id` via matchmaking                 |
| Ranked     | `PlayModal` mode card               | same                                | `/game/:id` via ranked queue                |
| vs Bot     | `PlayModal` mode card               | same                                | `/game/:id` bot match                       |
| Tournament | `PlayModal` → tournaments           | same                                | `/tournaments`                              |
| Private    | `PlayModal` → modal                 | same                                | `PrivateMatchModal` / `JoinPrivateMatchModal` → `/game/:id` |
| Practice   | `CreateMatchDialog` Practice tab    | same                                | `CreateMatchDialog` Practice flow           |

Discoverability is **identical** on desktop and mobile — every mode lives in the same modal in both viewports. Practice is intentionally not a top-level mode on desktop either, so it remains the same on mobile (no new modes per task spec).

## 2. Parity matrix (per mode × per viewport band)

Viewport bands tested via class-level audit (no responsive class hides any mode entry below 768px):
- **XS** 320–480 (iPhone SE class)
- **SM** 481–767 (large phones)
- **MD** 768–1024 (tablets)
- **LG** 1025+ (desktop)

| Mode       | XS 320–480 | SM 481–767 | MD 768–1024 | LG 1025+ | Notes                                                                 |
| ---------- | ---------- | ---------- | ----------- | -------- | --------------------------------------------------------------------- |
| Casual     | PASS       | PASS       | PASS        | PASS     | PlayModal cards `grid-cols-1 min-[480px]:grid-cols-2`, `min-h-[64px]` row at XS, `min-h-[140px]` tile from 480.   |
| Ranked     | PASS       | PASS       | PASS        | PASS     | Same modal entry; locked under level 10 — gated identically on every viewport.                                    |
| vs Bot     | PASS       | PASS       | PASS        | PASS     | Same entry; flows to `/game/:id`.                                                                                |
| Tournament | **FIXED**  | **FIXED**  | PASS        | PASS     | Page added `pb-24 md:pb-8` so last cards aren't hidden by `MobileBottomNav`. Bracket preview keeps intentional horizontal scroll inside its card. |
| Private    | **FIXED**  | **FIXED**  | PASS        | PASS     | Both private dialogs now `w-[calc(100vw-1rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto`. Party page got `pb-24 md:pb-{4,6}` and chat panel `h-[50vh] md:h-[600px]`. |
| Practice   | **FIXED**  | **FIXED**  | PASS        | PASS     | `CreateMatchDialog` got same mobile-width safety, quick-bet grid `grid-cols-3 sm:grid-cols-5`, `minHeight: 44` on wager buttons. |

## 3. Standardized mobile rules applied across the affected screens

| Rule                              | How it's enforced                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Mode-selection cards visible XS+  | `grid-cols-1 min-[480px]:grid-cols-2` in PlayModal — single column on small phones, two-up from 480px.   |
| Modal width safety                | All Play-flow modals: `w-[calc(100vw-1rem)] … max-h-[calc(100dvh-2rem)] overflow-y-auto`.               |
| Tap-target ≥ 44px                 | PlayModal mode buttons `min-h-[64px]` at XS; CreateMatchDialog wager buttons pinned `minHeight: 44`.    |
| MobileBottomNav clearance         | Mode pages (`tournaments.tsx`, `party.tsx`) add `pb-24 md:pb-{4–8}`; App shell global `pb-16` retained.  |
| Modals always over nav            | `MobileBottomNav` lowered to `z-40`; Radix dialog overlay/content stay `z-50`.                          |
| Safe-area on dialog footer        | PlayModal body uses `paddingBottom: calc(1.25rem + env(safe-area-inset-bottom, 0px))`.                  |
| Single-column collapse < 768px    | Party `grid-cols-1 md:grid-cols-[1fr_340px]`; Tournaments "How it works" `grid-cols-1 md:grid-cols-4`.   |
| No horizontal scroll on body      | Bracket preview is the only horizontal scroll (intentional, inside its own card; doesn't push body).    |

## 4. Cross-cutting z-stack fix

`MobileBottomNav` was `z-[9999]`, but Radix `DialogOverlay` / `DialogContent` are `z-50`. On mobile, the nav painted over every Play-flow modal's footer (PlayModal, CreateMatchDialog, both private-match dialogs). Lowered nav to `z-40`:
- Modals (z-50) now cover the nav as designed.
- Nav is still `fixed bottom-0`; global content `pb-16` on the App shell is unchanged.
- Normal page scroll behavior under the nav is preserved.

## 5. Files changed

- `client/src/components/MobileBottomNav.tsx` — `z-[9999]` → `z-40`.
- `client/src/components/PrivateMatchModal.tsx` — mobile width + max-height + overflow-y-auto.
- `client/src/components/JoinPrivateMatchModal.tsx` — same.
- `client/src/components/CreateMatchDialog.tsx` — mobile width + quick-bet grid + 44px tap targets.
- `client/src/pages/party.tsx` — pb-24 on lobby + main, chat panel `h-[50vh] md:h-[600px]`.
- `client/src/pages/tournaments.tsx` — `pb-24 md:pb-8` on content container.

Untouched (verified mobile-ready by class audit, no edits required):
- `client/src/pages/home.tsx` PlayModal (mobile rules already correct: see line 293–333).
- `client/src/pages/game.tsx` (thin wrapper; per-game shells own their own layout).
- `client/src/components/ui/dialog.tsx` (kept `z-50`; nav was lowered instead).

## 6. Pre-existing typecheck noise (NOT addressed; out of scope)

`tsc --noEmit` on `main` reports pre-existing errors in untouched game shells:
- `betAmount` missing on `MatchWithPlayers` in AirHockey/Bowling/EightBall.
- `ShopButton` missing export in `TronGame.tsx`.

None are introduced by this task.

## 7. Acceptance check

- Every desktop mode reachable on mobile: ✅
- Tap targets ≥ 44px on mode entries + wager buttons: ✅
- No horizontal scroll in mode flows 320–414px (excluding intentional bracket preview scroll inside its card): ✅
- Single-column collapse on lobby/party: ✅
- Safe-area / bottom-nav clearance on mode pages: ✅
- Modals not covered by bottom nav: ✅ (z-stack fix)
- Breakpoint behavior standardized across affected screens: ✅ (Tailwind `md:` for layout collapse; `min-[480px]:` only inside PlayModal for the card grid)
