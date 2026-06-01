import { flattenGameTiers } from "./gameTrainingPaths";

/**
 * Canonical ordered sequence of training IDs. Derived from the per-game tier
 * config in `gameTrainingPaths.ts` so adding a new game/tier requires only
 * editing that one file.
 *
 * Order: platform-basics → for each game in config: beginner, intermediate,
 * advanced, master.
 *
 * IMPORTANT: only IDs in `ACTIVE_TUTORIAL_IDS` are actually implemented and
 * can grant rewards. Trainings present in the canonical order but absent from
 * the active set render as "Coming soon" and break the unlock chain past them
 * (they have no completion event a user can trigger).
 */
const FLAT_TIERS = flattenGameTiers();

export const CANONICAL_TUTORIAL_ORDER: readonly string[] = [
  "platform-basics",
  ...FLAT_TIERS.map(t => t.id),
] as const;

export type CanonicalTutorialId = string;

/**
 * Tutorials whose backend flow is fully implemented (step progress + reward grant).
 * Every entry in the canonical order is active — beginner tiers use bespoke
 * components (RPS, Connect 4) or the generic `GameTierTutorial`; higher tiers
 * all use the generic component.
 */
export const ACTIVE_TUTORIAL_IDS: ReadonlySet<string> = new Set<string>(CANONICAL_TUTORIAL_ORDER);

export function isActiveTutorial(id: string): boolean {
  return ACTIVE_TUTORIAL_IDS.has(id);
}

/**
 * Index of `id` in the canonical order, or -1 if not part of the sequence.
 */
export function canonicalIndex(id: string): number {
  return CANONICAL_TUTORIAL_ORDER.indexOf(id);
}

/**
 * Pure unlock computation. Given the set of tutorial IDs the user has
 * completed, returns the unlock state for every canonical training.
 *
 * Rules:
 * - The first training in the canonical order is ALWAYS unlocked.
 * - For each subsequent ACTIVE (built) training, it is unlocked iff the
 *   previous active training in canonical order has been completed.
 * - Inactive ("Coming soon") trainings are skipped when looking for the
 *   "previous built training" — they never block or unblock the chain on
 *   their own, since they have no completion event.
 */
export function computeUnlockStateFromCompleted(completed: ReadonlySet<string>): {
  unlocked: string[];
  current: string | null;
} {
  const unlocked: string[] = [];
  let prevBuiltCompleted = true; // seeds first-active-unlocked
  for (const id of CANONICAL_TUTORIAL_ORDER) {
    if (!ACTIVE_TUTORIAL_IDS.has(id)) continue;
    if (prevBuiltCompleted) unlocked.push(id);
    prevBuiltCompleted = completed.has(id);
  }
  const current = unlocked.find(id => !completed.has(id)) ?? null;
  return { unlocked, current };
}
