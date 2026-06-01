export interface RankUpPayload {
  oldRank: string;
  newRank: string;
  oldRating: number;
  newRating: number;
  oldColor: string;
  newColor: string;
}

export function emitRankUp(payload: RankUpPayload) {
  window.dispatchEvent(new CustomEvent("rank-up", { detail: payload }));
}

export function onRankUp(cb: (p: RankUpPayload) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<RankUpPayload>).detail);
  window.addEventListener("rank-up", handler);
  return () => window.removeEventListener("rank-up", handler);
}
