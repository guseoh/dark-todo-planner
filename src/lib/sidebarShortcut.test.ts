import { describe, expect, it } from "vitest";
import { isSidebarToggleShortcut } from "./sidebarShortcut";

const event = { key: "b", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, repeat: false, isComposing: false, defaultPrevented: false };
describe("sidebar shortcut", () => {
  it("toggles on Ctrl+B outside an editor", () => {
    expect(isSidebarToggleShortcut(event, false)).toBe(true);
    expect(isSidebarToggleShortcut({ ...event, key: "B" }, false)).toBe(true);
  });
  it("preserves editor formatting, IME composition and other shortcuts", () => {
    expect(isSidebarToggleShortcut(event, true)).toBe(false);
    for (const patch of [{ ctrlKey: false }, { shiftKey: true }, { altKey: true }, { metaKey: true }, { repeat: true }, { isComposing: true }, { defaultPrevented: true }, { key: "k" }]) {
      expect(isSidebarToggleShortcut({ ...event, ...patch }, false)).toBe(false);
    }
  });
});
