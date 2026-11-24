import { describe, expect, it } from "vitest";
import { closeWorkspaceTab, emptyWorkspaceTabs, openWorkspaceTab, parseWorkspaceTabs, reopenWorkspaceTab, replaceWorkspaceTab } from "./workspaceTabs";
describe("workspace tabs", () => {
  it("opens once and preserves tab order when switching", () => {
    const a = openWorkspaceTab(emptyWorkspaceTabs(), "a");
    const b = openWorkspaceTab(a, "b");
    expect(openWorkspaceTab(b, "a")).toEqual({ opened: ["a", "b"], activeId: "a", closed: [] });
  });
  it("selects a neighbour and restores the last available closed tab", () => {
    const a = openWorkspaceTab(emptyWorkspaceTabs(), "a");
    const b = openWorkspaceTab(a, "b");
    const closed = closeWorkspaceTab(b, "b");
    expect(closed).toEqual({ opened: ["a"], activeId: "a", closed: ["b"] });
    expect(reopenWorkspaceTab(closed, ["a"])).toBe(closed);
    expect(reopenWorkspaceTab(closed, ["a", "b"])).toEqual(b);
  });
  it("keeps active selection when an inactive tab closes", () => {
    const a = openWorkspaceTab(emptyWorkspaceTabs(), "a");
    const b = openWorkspaceTab(a, "b");
    expect(closeWorkspaceTab(b, "a").activeId).toBe("b");
    expect(closeWorkspaceTab(a, "a").activeId).toBeNull();
  });
  it("replaces a saved draft without switching away from another document", () => {
    const a = openWorkspaceTab(emptyWorkspaceTabs(), "new");
    const b = openWorkspaceTab(a, "other");
    expect(replaceWorkspaceTab(b, "new", "saved")).toEqual({ opened: ["saved", "other"], activeId: "other", closed: [] });
  });
  it("recovers invalid storage and rejects unknown active tabs", () => {
    expect(parseWorkspaceTabs("{bad")).toEqual(emptyWorkspaceTabs());
    expect(parseWorkspaceTabs(JSON.stringify({ opened: ["a", "a", 1], activeId: "b", closed: ["a", "c"] })))
      .toEqual({ opened: ["a"], activeId: null, closed: ["c"] });
  });
});
