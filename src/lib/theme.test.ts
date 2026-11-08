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

describe("V4 light/dark neutral black design tokens", () => {
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
    expect(css).toContain("--ink-950: 9 9 11;");
    expect(css).toContain("--surface-2: #222225;");
    expect(css).toContain("--ink-950: 250 250 250;");
    expect(css).toContain("--accent-500: 121 167 247;");
    expect(css).toContain("--accent-500: 36 95 191;");
    expect(css).toContain("--ui-canvas: var(--app-bg)");
    expect(css).toContain("--ui-control-border: var(--border-strong);");
    expect(tailwind).toContain('themedShade("ink-950")');
    expect(tailwind).toContain('themedShade("accent-500")');
    expect(tailwind).toContain('"var(--ui-canvas)"');
    expect(tailwind).toContain('themedShade("semantic-danger")');
    expect(css).toContain("--semantic-danger: 177 64 80;");
    expect(css).toContain("--semantic-info: 121 167 247;");
    expect(css).toContain("--workflow-planned: #A1A1AA;");
    expect(css).toContain("--workflow-active: #79A7F7;");
    expect(css).toContain("--workflow-blocked: #DE858E;");
    expect(css).toContain("--workflow-done: #67BE9B;");
    expect(css).toContain('data-status="IN_PROGRESS"');
    expect(css).toContain('data-status="BLOCKED"');
    expect(css).toContain('data-status="DONE"');
    expect(tailwind).toContain('themedShade("semantic-info")');
    expect(css).toContain("--success: #67BE9B;");
    expect(css).toContain("--success: #147553;");
    expect(css).not.toContain("#8fb9a3");
    expect(css).toContain(".today-header__status");
    expect(css).toContain(".today-page.page-shell");
    expect(css).not.toContain(".today-overview__stat");
    expect(css).toContain(".today-composer");
    expect(css).toContain(".todo-composer-form__chips");
    expect(css).toContain(".todo-composer-form__submit--quiet");
    expect(css).toContain(".todo-composer-form__meta-row");
    expect(css).toContain("max-width: 760px;");
    expect(css).toContain(".todo-composer-chip-menu__panel");
    expect(css).toContain(".todo-composer-form__footer--inline");
    expect(css).toContain(".today-digest");
    expect(css).toContain(".ui-button--info");
    expect(css).toContain(".ui-icon-button--danger");
    expect(css).toContain('.app-nav-button[aria-current="page"]');
    expect(css).toContain("--button-primary-bg");
    expect(css).toContain(".overdue-review__date-header");
    expect(css).toContain(".overdue-review__bulk-delete");
    expect(css).toContain(".overdue-review__footer");
    expect(css).toContain(".memo-note::before");
    expect(css).toContain(".memo-actions__panel");
    expect(css).toContain(".memo-page .memo-action-button.ui-button");
    expect(css).toContain(".app-topbar .ui-button");
    expect(css).toContain("border-radius: 0; background: transparent; box-shadow: none;");
    expect(css).not.toContain(".today-sidebar");
    expect(css).toContain(".todo-row__menu-action");
    expect(css).not.toContain("#2563eb");
    expect(css).toContain("@apply rounded-none border-0 border-b");
  });

  it("meets AA text contrast in both palettes", () => {
    for (const [foreground, background] of [
      ["#F2F2F4", "#09090B"], ["#B3B3BE", "#18181B"],
      ["#18181B", "#FAFAFA"], ["#52525B", "#FFFFFF"],
      ["#09090B", "#79A7F7"], ["#FFFFFF", "#245FBF"],
      ["#67BE9B", "#09090B"], ["#DE858E", "#09090B"],
      ["#E5B66D", "#09090B"], ["#79A7F7", "#09090B"],
      ["#147553", "#FFFFFF"], ["#B14050", "#FFFFFF"],
      ["#8D5B20", "#FFFFFF"], ["#245FBF", "#FFFFFF"],
      ["#A1A1AA", "#18181B"], ["#60606A", "#FFFFFF"],
    ]) {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
    for (const role of ["#A1A1AA", "#79A7F7", "#DE858E", "#67BE9B"]) {
      expect(contrast(role, "#18181B")).toBeGreaterThanOrEqual(4.5);
    }
    for (const role of ["#60606A", "#245FBF", "#B14050", "#147553"]) {
      expect(contrast(role, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("provides visible focus, OS theme support, and reduced motion", () => {
    expect(css).toContain("focus-visible");
    expect(css).toContain("color-scheme: light");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
