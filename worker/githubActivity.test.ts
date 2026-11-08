import { describe, expect, it, vi } from "vitest";
import { fetchGithubActivity, parseGithubGraphqlCalendar, parseGithubPublicCalendar } from "./githubActivity";

const allDays = (count: number) => Array.from({ length: count }, (_, i) => {
  const date = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);
  const level = i === 0 ? 2 : 0;
  return '<td class="ContributionCalendar-day" data-date="' + date + '" data-level="' + level +
    '" id="day-' + i + '"></td>';
}).join("");

describe("GitHub public calendar parsing", () => {
  it("preserves exact tooltip counts and never guesses missing active-day counts", () => {
    const html = allDays(365).replace('day-0', 'day-active') +
      '<tool-tip for="day-active">12 contributions on January 1.</tool-tip>';
    const result = parseGithubPublicCalendar(html);
    expect(result.days).toHaveLength(365);
    expect(result.days[0]).toMatchObject({ date: "2025-01-01", count: 12, level: 2 });
    expect(result.total).toBe(12);
    const partial = parseGithubPublicCalendar(allDays(365));
    expect(partial.days[0].count).toBeNull();
    expect(partial.total).toBeNull();
  });

  it("rejects unavailable or unrelated GitHub markup", () => {
    expect(() => parseGithubPublicCalendar("<html>Login needed</html>")).toThrow();
  });

  it("rejects impossible dates", () => {
    const html = allDays(365).replace("2025-01-01", "2025-02-30");
    expect(parseGithubPublicCalendar(html).days).toHaveLength(364);
  });

  it("recognizes official GraphQL contribution data without a browser token", () => {
    const days = Array.from({ length: 365 }, (_, i) => ({
      date: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10),
      contributionCount: i === 0 ? 4 : 0,
      contributionLevel: i === 0 ? "SECOND_QUARTILE" : "NONE",
    }));
    const result = parseGithubGraphqlCalendar({ data: { user: { contributionsCollection:
      { contributionCalendar: { weeks: [{ contributionDays: days }] } } } } });
    expect(result.days[0]).toEqual({ date: "2025-01-01", count: 4, level: 2 });
    expect(result.total).toBe(4);
  });

  it("can use the GitHub public page without credentials", async () => {
    const mock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(allDays(365), { status: 200 }));
    try {
      const result = await fetchGithubActivity(undefined);
      expect(result.source).toBe("github-public");
      expect(mock).toHaveBeenCalledOnce();
      expect(String(mock.mock.calls[0][0])).toBe("https://github.com/users/guseoh/contributions");
    } finally { mock.mockRestore(); }
  });
});
