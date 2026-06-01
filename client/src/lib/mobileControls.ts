import { useEffect, useState } from "react";

export interface MobileControlsConfig {
  hand: "right" | "left";
  size: number;
  opacity: number;
  haptic: boolean;
}

const STORAGE_KEY = "jango-mobile-controls";

const DEFAULTS: MobileControlsConfig = {
  hand: "right",
  size: 56,
  opacity: 0.9,
  haptic: true,
};

function load(): MobileControlsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      hand: parsed.hand === "left" ? "left" : "right",
      size: clamp(Number(parsed.size) || DEFAULTS.size, 40, 88),
      opacity: clamp(Number(parsed.opacity) || DEFAULTS.opacity, 0.3, 1),
      haptic: typeof parsed.haptic === "boolean" ? parsed.haptic : DEFAULTS.haptic,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function save(cfg: MobileControlsConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch {}
  window.dispatchEvent(new CustomEvent("mobile-controls-changed"));
}

export function getMobileControls(): MobileControlsConfig {
  return load();
}

export function setMobileControls(cfg: Partial<MobileControlsConfig>) {
  const next = { ...load(), ...cfg };
  save(next);
}

export function useMobileControls(): MobileControlsConfig {
  const [cfg, setCfg] = useState<MobileControlsConfig>(load);
  useEffect(() => {
    const handler = () => setCfg(load());
    window.addEventListener("mobile-controls-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("mobile-controls-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return cfg;
}
