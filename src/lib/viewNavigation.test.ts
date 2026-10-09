import { describe, expect, it } from "vitest";
import { appViewIds } from "../components/layout/Sidebar";
import { viewFromHash, viewHash } from "./viewNavigation";

describe("history-aware view navigation", () => {
  it("round-trips every active view to a shareable URL fragment", () => {
    for (const view of appViewIds) expect(viewFromHash(viewHash(view))).toBe(view);
  });
  it("defaults unknown, dormant or malformed routes to Today", () => {
    for (const hash of ["", "#", "#/insights", "#/planning", "#/projects/unknown", "#/today?x=1", "#/"]) {
      expect(viewFromHash(hash)).toBe("today");
    }
  });
});
