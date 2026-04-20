export type ThemePreference = "system" | "light" | "dark";

const KEY = "theme-preference";

export function loadTheme(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

/**
 * Apply preference to <html data-theme> and persist to localStorage.
 * `system` → remove attribute, letting the `prefers-color-scheme` media query
 * drive tokens.css (default behavior).
 */
export function applyTheme(pref: ThemePreference): void {
  const html = document.documentElement;
  if (pref === "system") {
    html.removeAttribute("data-theme");
  } else {
    html.setAttribute("data-theme", pref);
  }
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* ignore — non-critical */
  }
}
