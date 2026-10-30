export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "dark-todo-planner:theme";
const QUERY = "(prefers-color-scheme: dark)";

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "dark" || value === "light" || value === "system" ? value : "dark";
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  return preference === "system" ? (prefersDark ? "dark" : "light") : preference;
}

export function readThemePreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "dark";
  }
}

export function applyThemePreference(preference: ThemePreference): ResolvedTheme {
  const prefersDark = window.matchMedia?.(QUERY).matches ?? true;
  const resolved = resolveTheme(preference, prefersDark);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
  root.style.colorScheme = resolved;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#101011" : "#F7F7F8");
  return resolved;
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Private browsing/storage failures must never block theme changes.
  }
  applyThemePreference(preference);
  window.dispatchEvent(new Event("planner-theme-change"));
}

export function initializeTheme(): () => void {
  applyThemePreference(readThemePreference());
  const query = window.matchMedia?.(QUERY);
  if (!query) return () => undefined;
  const onSystemThemeChange = () => {
    if (readThemePreference() === "system") applyThemePreference("system");
  };
  query.addEventListener("change", onSystemThemeChange);
  return () => query.removeEventListener("change", onSystemThemeChange);
}
