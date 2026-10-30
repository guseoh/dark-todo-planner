import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseThemePreference, resolveTheme } from "./theme";

const css = readFileSync(new URL("../styles/globals.css", import.meta.url), "utf8");
const tailwind = readFileSync(new URL("../../tailwind.config.ts", import.meta.url), "utf8");

const luminance = (hex: string) => {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
};

const contrast = (a: string, b: string) => {
  const one = luminance(a);
  const two = luminance(b);
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
};

describe("light/dark neutral design tokens", () => {
  it("resolves preference and retains the previous default dark mode", () => {
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("system")).toBe("system");
    expect(parseThemePreference("invalid")).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("shares RGB compatibility tokens and semantic roles across themes", () => {
    expect(css).toContain(':root[data-theme="light"]');
    expect(css).toContain("--ink-950: 16 16 17;");
    expect(css).toContain("--surface-2: #252529;");
    expect(css).toContain("--ink-950: 247 247 248;");
    expect(css).toContain("--accent-500: 212 212 216;");
    expect(css).toContain("--accent-500: 38 38 42;");
    expect(css).toContain("--ui-canvas: var(--app-bg)");
    expect(css).toContain("--ui-control-border: #8A8A90;");
    expect(tailwind).toContain('themedShade("ink-950")');
    expect(tailwind).toContain('themedShade("accent-500")');
    expect(tailwind).toContain('"var(--ui-canvas)"');
    expect(tailwind).toContain('themedShade("semantic-danger")');
    expect(css).toContain("--semantic-danger: 190 18 60;");
    expect(css).toContain("--semantic-info: 147 180 255;");
    expect(tailwind).toContain('themedShade("semantic-info")');
    expect(css).toContain("--success: #4ade80;");
    expect(css).toContain("--success: #15803d;");
    expect(css).not.toContain("#8fb9a3");
    expect(css).toContain(".today-header__status");
    expect(css).toContain(".today-page.page-shell");
    expect(css).not.toContain(".today-overview__stat");
    expect(css).toContain(".today-composer");
    expect(css).toContain(".today-sidebar");
    expect(css).not.toContain("#2563eb");
    expect(css).toContain("@apply rounded-none border-0 border-b");
  });

  it("meets AA text contrast in both palettes", () => {
    expect(contrast("#EFEFF0", "#101011")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#99999F", "#161617")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#1B1B1E", "#F7F7F8")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#66666C", "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#101011", "#D4D4D8")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#F7F7F8", "#26262A")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#4ADE80", "#101011")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#FB7185", "#101011")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#FBBF24", "#101011")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#93B4FF", "#101011")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#15803D", "#F7F7F8")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#BE123C", "#F7F7F8")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#92400E", "#F7F7F8")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#1D4ED8", "#F7F7F8")).toBeGreaterThanOrEqual(4.5);
  });

  it("provides visible focus, OS theme support, and reduced motion", () => {
    expect(css).toContain("focus-visible");
    expect(css).toContain("color-scheme: light");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
