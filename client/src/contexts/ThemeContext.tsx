import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isLoading: boolean;
  phoneMode: boolean;
  setPhoneMode: (on: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [theme, setThemeState] = useState<Theme>("dark");
  const [initialized, setInitialized] = useState(false);
  const [phoneMode, setPhoneModeState] = useState(false);

  // Load theme and phoneMode from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") {
      setThemeState(stored);
    }
    const pm = localStorage.getItem("phoneMode");
    if (pm === "true") setPhoneModeState(true);
    setInitialized(true);
  }, []);

  // Only fetch user theme if authenticated and auth is done loading
  const { data: userTheme, isLoading: themeLoading } = useQuery<{ themePreference: Theme }>({
    queryKey: ["/api/user/theme"],
    enabled: !authLoading && isAuthenticated && !!user,
  });

  const updateThemeMutation = useMutation({
    mutationFn: async (newTheme: Theme) => {
      return apiRequest("PATCH", "/api/user/theme", { themePreference: newTheme });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/theme"] });
    },
  });

  // Apply user's saved theme preference when it loads
  useEffect(() => {
    if (userTheme?.themePreference && initialized) {
      setThemeState(userTheme.themePreference);
    }
  }, [userTheme, initialized]);

  // Apply theme to DOM and localStorage
  useEffect(() => {
    if (initialized) {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(theme);
      localStorage.setItem("theme", theme);
    }
  }, [theme, initialized]);

  // Persist phoneMode to localStorage
  useEffect(() => {
    if (initialized) {
      localStorage.setItem("phoneMode", String(phoneMode));
    }
  }, [phoneMode, initialized]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (!authLoading && isAuthenticated && user) {
      updateThemeMutation.mutate(newTheme);
    }
  };

  const setPhoneMode = (on: boolean) => {
    setPhoneModeState(on);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isLoading: themeLoading, phoneMode, setPhoneMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
