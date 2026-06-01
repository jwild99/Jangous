import { useState, useEffect } from "react";
import { Smartphone, Monitor, Zap } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "jango_device_chosen";

export function DevicePrompt() {
  const { setPhoneMode } = useTheme();
  const { isAuthenticated } = useAuth();
  const [visible, setVisible] = useState(false);
  const [chosen, setChosen] = useState<"mobile" | "desktop" | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    const already = localStorage.getItem(STORAGE_KEY);
    if (!already) setVisible(true);
  }, [isAuthenticated]);

  if (!visible) return null;

  const handleChoose = (device: "mobile" | "desktop") => {
    setChosen(device);
    localStorage.setItem(STORAGE_KEY, device);

    if (device === "mobile") {
      setPhoneMode(false);
    } else {
      setPhoneMode(false);
    }

    setTimeout(() => setVisible(false), 380);
  };

  return (
    <div
      className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 transition-opacity duration-300 ${
        chosen ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ background: "rgba(1,2,8,0.88)", backdropFilter: "blur(12px)" }}
      data-testid="device-prompt-overlay"
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(99,102,241,0.12) 0%, transparent 65%)",
        }}
      />

      <div className="relative w-full max-w-sm" data-testid="device-prompt-modal">
        {/* Logo / brand mark */}
        <div className="flex justify-center mb-6">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              boxShadow: "0 0 24px rgba(99,102,241,0.5)",
            }}
          >
            <Zap className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
            Welcome to Jango
          </h2>
          <p className="text-sm text-white/50">
            What device are you playing on? We'll optimise your experience.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Mobile option */}
          <button
            onClick={() => handleChoose("mobile")}
            className="group relative flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all duration-200 text-left"
            style={{
              background: "rgba(255,255,255,0.04)",
              borderColor: "rgba(255,255,255,0.10)",
            }}
            data-testid="device-choice-mobile"
          >
            {/* Hover glow */}
            <div
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
              style={{
                background: "rgba(99,102,241,0.08)",
                boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.35)",
              }}
            />

            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(99,102,241,0.15)" }}
            >
              <Smartphone className="w-6 h-6 text-indigo-400" />
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-white mb-0.5">Mobile</p>
              <p className="text-[11px] text-white/40 leading-snug">
                Phone or tablet
              </p>
            </div>
          </button>

          {/* Desktop option */}
          <button
            onClick={() => handleChoose("desktop")}
            className="group relative flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all duration-200 text-left"
            style={{
              background: "rgba(255,255,255,0.04)",
              borderColor: "rgba(255,255,255,0.10)",
            }}
            data-testid="device-choice-desktop"
          >
            <div
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
              style={{
                background: "rgba(99,102,241,0.08)",
                boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.35)",
              }}
            />

            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(99,102,241,0.15)" }}
            >
              <Monitor className="w-6 h-6 text-indigo-400" />
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-white mb-0.5">Desktop</p>
              <p className="text-[11px] text-white/40 leading-snug">
                Laptop or PC
              </p>
            </div>
          </button>
        </div>

        <p className="text-center text-[11px] text-white/25 mt-5">
          You can change this any time in Settings
        </p>
      </div>
    </div>
  );
}
