export interface ScalpsChangePayload {
  delta: number;
  newBalance: number;
}

export function emitScalpsChange(payload: ScalpsChangePayload) {
  window.dispatchEvent(new CustomEvent("scalps-change", { detail: payload }));
}

export function onScalpsChange(cb: (p: ScalpsChangePayload) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<ScalpsChangePayload>).detail);
  window.addEventListener("scalps-change", handler);
  return () => window.removeEventListener("scalps-change", handler);
}
