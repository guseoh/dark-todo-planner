import { describe, expect, it } from "vitest";
import { navigation } from "../common/CommandPalette";
import { appViewIds, navGroups, settingsItem } from "./Sidebar";

describe("active views", () => {
  const navIds = [...navGroups.flatMap((group) => group.items.map((item) => item.id)), settingsItem.id];

  it("lists every active screen once in the sidebar", () => {
    expect(navIds).toEqual([...appViewIds]);
    expect(new Set(navIds).size).toBe(navIds.length);
  });

  it("supports every active screen in the command palette", () => {
    const paletteIds = navigation.filter((item) => item.kind === "이동").map((item) => item.view);
    expect(paletteIds).toEqual([...appViewIds]);
  });

  it("exposes Inbox without reopening dormant Planning / Insights", () => {
    expect(appViewIds).toContain("inbox");
    expect(navIds.some((id) => ["planning", "insights", "time"].includes(id))).toBe(false);
  });
});
