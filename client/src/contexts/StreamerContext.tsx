import { createContext, useContext, useState, useCallback } from "react";

interface StreamerContextValue {
  streamerMode: boolean;
  toggleStreamerMode: () => void;
  maskValue: (value: string, replacement?: string) => string;
  maskUsername: (name: string | null | undefined) => string;
}

const StreamerContext = createContext<StreamerContextValue>({
  streamerMode: false,
  toggleStreamerMode: () => {},
  maskValue: (v) => v,
  maskUsername: (n) => n ?? "Player",
});

export function StreamerProvider({ children }: { children: React.ReactNode }) {
  const [streamerMode, setStreamerMode] = useState(() => {
    try { return localStorage.getItem("streamerMode") === "true"; } catch { return false; }
  });

  const toggleStreamerMode = useCallback(() => {
    setStreamerMode(prev => {
      const next = !prev;
      try { localStorage.setItem("streamerMode", String(next)); } catch {}
      return next;
    });
  }, []);

  const maskValue = useCallback((value: string, replacement = "••••") => {
    return streamerMode ? replacement : value;
  }, [streamerMode]);

  const maskUsername = useCallback((name: string | null | undefined) => {
    if (streamerMode) return "Player";
    return name ?? "Player";
  }, [streamerMode]);

  return (
    <StreamerContext.Provider value={{ streamerMode, toggleStreamerMode, maskValue, maskUsername }}>
      {children}
    </StreamerContext.Provider>
  );
}

export function useStreamerMode() {
  return useContext(StreamerContext);
}
