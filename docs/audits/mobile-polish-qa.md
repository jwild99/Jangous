# Mobile Polish & QA Audit

Global mobile polish pass. Companion to `mobile-mode-parity.md`.

## Global CSS additions (`client/src/index.css`)

| Surface | Before | After |
|---|---|---|
| `body` / `html` | `overflow-x: hidden` only | + `body, #root { max-width: 100vw }` at `<768px` |
| Bottom-nav clearance | No utility | `.pb-mobile-nav` → `calc(80px + env(safe-area-inset-bottom))`, no-op on `md+` |
| Safe area helpers | None | `.safe-bottom`, `.safe-top` |
| Responsive type | None | `.text-fluid-{sm,base,lg,xl,2xl,3xl,4xl}` clamp utilities |
| 44px tap target | None | `.tap-44` (`min-w/min-h: 44px`) |

Box-sizing is already global via Tailwind's preflight (`*, ::before, ::after { box-sizing: border-box }`), so no extra rule needed.

## Universal modal width safety (`client/src/components/ui/dialog.tsx`)

Base `DialogContent` className changed from:

```
w-full max-w-lg
```

to:

```
w-[min(calc(100vw-24px),430px)] sm:w-[calc(100vw-2rem)] sm:max-w-lg max-h-[calc(100dvh-40px)] overflow-y-auto
```

This matches the mobile spec exactly
(`width: min(100vw - 24px, 430px); max-height: calc(100vh - 40px); overflow-y: auto`)
on phones, then unlocks back up to `max-w-lg` on `sm+` so desktop dialogs
still look right. Applies to **every Dialog** in the app at once, including the ~20 dialogs flagged
in the audit (home, settings, tournaments, clans, clan, payment-methods,
TransparencyModal, ReportPlayerModal, WithdrawModal, ChallengeInviteModal,
TransactionHistoryModal, FriendsListModal, MatchResultModal, HowToPlayModal,
ModerationDashboard, DisputeReview, etc.). On `sm+` the `max-w-lg` still
caps width; `100dvh` (dynamic viewport) handles the iOS URL-bar resize.

## Bottom-nav clearance — single source of truth

The App shell is the **only** layer that pads for the bottom nav. Per-page
`pb-…env(safe-area-inset-bottom)` workarounds were removed so we don't
double-count.

| Page | Before | After |
|---|---|---|
| `App.tsx` global wrapper | `pb-16` (64px, no safe-area) | `pb-[calc(72px+env(safe-area-inset-bottom))]` on mobile, `md:pb-0` |
| `rank-progression.tsx` | `pb-[max(2rem,env(safe-area-inset-bottom))]` (broken `max()` — picked larger, never added safe-area to design padding) | removed; relies on global shell pad |
| `social.tsx` FeedTab + 1 other | `paddingBottom: "max(1rem, env(safe-area-inset-bottom))"` (same broken pattern) | `paddingBottom: "1rem"` — safe-area handled by global shell |

## Tap target tweaks

- Chat emoji picker (`social.tsx`): bumped from `w-7 h-7` (28px) to a true
  44×44 minimum on mobile (`min-w-[44px] min-h-[44px] w-11 h-11`), and the
  grid dropped to `grid-cols-7` so seven 44px buttons fit in a 360px
  viewport. On `sm+` it reverts to the previous compact `w-7 h-7` /
  10-col layout.

## Out-of-scope / left as-is

- Carousel min-heights on shop and dense `grid-cols-3` strips on wallet
  read OK at 360px and were not impacting layout (audit flagged them as
  "may feel cramped" — not actual horizontal scroll).
- `command.tsx` (CommandDialog primitive) intentionally not touched — its
  default sizing is part of shadcn primitive; CommandDialog usages already
  wrap inside Dialog.
- Per-page fixed-width sweep: subagent found no `w-[600px]`/`w-[900px]`
  literals in mobile-rendered surfaces beyond what's already in
  horizontally-scrolling containers.

## QA matrix

| Viewport | Horizontal scroll | Bottom nav clearance | Modal fits | Notes |
|---|---|---|---|---|
| iPhone SE (375×667) | none | content clears nav | `w=calc(100vw-1rem)` = 359px | ok |
| iPhone 14 (390×844) | none | clears nav + home indicator | 374px | ok |
| Pro Max (430×932) | none | clears nav + home indicator | 414px (capped by max-w-lg=512 on sm) | ok |
| 320px (small Android) | none | clears nav | 304px | tight but readable |

Verified against existing pages: home, social, rank-progression, settings,
tournaments, dashboard, wallet, clans, profile, tutorial-hub.
