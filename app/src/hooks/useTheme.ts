import { useCallback, useState } from "react";
import { applyTheme, loadTheme, type ThemePreference } from "@/lib/theme";

export function useTheme(): {
  theme: ThemePreference;
  setTheme: (next: ThemePreference) => void;
} {
  const [theme, setThemeState] = useState<ThemePreference>(() => loadTheme());

  const setTheme = useCallback((next: ThemePreference) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  return { theme, setTheme };
}
