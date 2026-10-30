import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const css = readFileSync(new URL("../styles/globals.css", import.meta.url), "utf8");
const tailwindSource = readFileSync(new URL("../../tailwind.config.ts", import.meta.url), "utf8");

// Keep the app's composite TypeScript project independent from root configuration files.
const token = (scale: "ink" | "accent", shade: number): string => {
  const start = tailwindSource.indexOf(`        ${scale}: {`);
  const end = tailwindSource.indexOf("        },", start);
  if (start < 0 || end < 0) throw new Error(`Missing color scale: ${scale}`);
  const prefix = `          ${shade}: "`;
  const row = tailwindSource.slice(start, end).split("\n").find((line) => line.trimStart().startsWith(prefix.trimStart()));
  const match = row?.match(/#[0-9a-f]{6}/i);
  if (!match) throw new Error(`Missing color token: ${scale}.${shade}`);
  return match[0];
};

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

describe("neutral minimal dark design tokens", () => {
  it("keeps the global palette aligned with Tailwind tokens", () => {
    expect(css).toContain(`--app-bg: ${token("ink", 950)};`);
    expect(css).toContain(`--surface-1: ${token("ink", 900)};`);
    expect(css).toContain(`--surface-2: ${token("ink", 850)};`);
    expect(css).toContain(`--accent: ${token("accent", 500)};`);
    expect(css).not.toContain("#2563eb");
    expect(token("accent", 500)).toBe("#d4d4d8");
    expect(css).toContain("@apply rounded-none border-0 border-b");
  });

  it("meets WCAG AA contrast for the main and muted text", () => {
    expect(contrast(token("ink", 100), token("ink", 950))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("ink", 500), token("ink", 900))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("ink", 600), token("ink", 900))).toBeGreaterThanOrEqual(4.5);
  });

  it("uses neutral contrast for the primary action", () => {
    expect(contrast(token("ink", 950), token("accent", 500))).toBeGreaterThanOrEqual(4.5);
    expect(css).toContain("@apply btn border-ink-200 bg-ink-200 text-ink-950");
    expect(contrast(token("ink", 950), token("ink", 200))).toBeGreaterThanOrEqual(4.5);
  });

  it("respects reduced motion preferences", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
