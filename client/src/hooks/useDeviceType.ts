import { useState, useEffect } from "react";

export type DeviceType = "mobile" | "desktop";

function detectDeviceType(): DeviceType {
  const ua = navigator.userAgent;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(ua);
  const isMobileScreen = window.innerWidth < 768;
  return (isMobileUA || isMobileScreen) ? "mobile" : "desktop";
}

export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    if (typeof window === "undefined") return "desktop";
    return detectDeviceType();
  });

  useEffect(() => {
    const handler = () => setDeviceType(detectDeviceType());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return deviceType;
}
