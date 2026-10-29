import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import tailwindConfig from "../../tailwind.config";

const { ink, accent } = tailwindConfig.theme.extend.colors;
const css = readFileSync(new URL("../styles/globals.css", import.meta.url), "utf8");

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

describe("charcoal dark design tokens", () => {
  it("keeps the global palette aligned with Tailwind tokens", () => {
    expect(css).toContain(`--app-bg: ${ink[950]};`);
    expect(css).toContain(`--surface-1: ${ink[900]};`);
    expect(css).toContain(`--surface-2: ${ink[850]};`);
    expect(css).toContain(`--accent: ${accent[500]};`);
    expect(css).not.toContain("#2563eb");
  });

  it("meets WCAG AA contrast for the main and muted text", () => {
    expect(contrast(ink[100], ink[950])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ink[500], ink[900])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ink[600], ink[900])).toBeGreaterThanOrEqual(4.5);
  });

  it("uses dark foreground text on the light sage primary action", () => {
    expect(contrast(ink[950], accent[500])).toBeGreaterThanOrEqual(4.5);
    expect(css).toContain("@apply btn bg-accent-500 text-ink-950");
  });

  it("respects reduced motion preferences", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
