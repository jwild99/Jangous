export interface XPGainedPayload {
  xp: number;
  oldLevel: number;
  newLevel: number;
}

export function emitXPGained(payload: XPGainedPayload) {
  window.dispatchEvent(new CustomEvent("xp-gained", { detail: payload }));
}

export function onXPGained(cb: (p: XPGainedPayload) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<XPGainedPayload>).detail);
  window.addEventListener("xp-gained", handler);
  return () => window.removeEventListener("xp-gained", handler);
}
