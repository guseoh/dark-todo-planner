import { describe, expect, it } from "vitest";
import { appViewIds } from "../components/layout/Sidebar";
import { calendarModeFromHash, viewFromHash, viewHash } from "./viewNavigation";

describe("history-aware view navigation", () => {
  it("round-trips every active view to a shareable URL fragment", () => {
    for (const view of appViewIds) expect(viewFromHash(viewHash(view))).toBe(view);
  });

  it("maps both calendar modes to one sidebar screen", () => {
    for (const mode of ["month", "week"] as const) {
      const hash = viewHash("calendar", mode);
      expect(hash).toBe(`#/calendar/${mode}`);
      expect(viewFromHash(hash)).toBe("calendar");
      expect(calendarModeFromHash(hash)).toBe(mode);
    }
    expect(viewFromHash("#/calendar")).toBe("calendar");
    expect(calendarModeFromHash("#/calendar")).toBe("month");
  });

  it("keeps pre-upgrade week/month deep links functional", () => {
    expect(viewFromHash("#/week")).toBe("calendar");
    expect(calendarModeFromHash("#/week")).toBe("week");
    expect(viewFromHash("#/month")).toBe("calendar");
    expect(calendarModeFromHash("#/month")).toBe("month");
  });

  it("redirects legacy Inbox bookmarks to all Todo", () => {
    expect(viewFromHash("#/inbox")).toBe("all");
  });

  it("defaults unknown, dormant or malformed routes to Today", () => {
    for (const hash of ["", "#", "#/insights", "#/planning", "#/projects/unknown", "#/today?x=1", "#/", "#/calendar/day"]) {
      expect(viewFromHash(hash)).toBe("today");
    }
  });
});
