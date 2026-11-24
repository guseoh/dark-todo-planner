import { describe, expect, it } from "vitest";
import { githubListUrl, normalizeGithubItems, normalizeReviewStates } from "./githubRepository";
describe("GitHub repository reader", () => {
  it("restricts upstream host, route and query", () => {
    expect(githubListUrl("owner", "repo", "pulls", "all")?.hostname).toBe("api.github.com");
    for (const repo of ["..", "../secret", "x/y", "https://evil.test", "%2f"]) expect(githubListUrl("owner", repo, "issues", "open")).toBeNull();
    expect(githubListUrl("owner", "repo", "actions", "all")).toBeNull();
    expect(githubListUrl("owner", "repo", "issues", "anything")).toBeNull();
  });
  it("excludes PRs from issue list and derives safe links and PR states", () => {
    const base = { number: 1, title: "example", state: "open", html_url: "https://evil.test" };
    expect(normalizeGithubItems([{ ...base, pull_request: {} }], "owner", "repo", "issues")).toEqual([]);
    expect(normalizeGithubItems([base], "owner", "repo", "issues")[0].url).toBe("https://github.com/owner/repo/issues/1");
    expect(normalizeGithubItems([{ ...base, state: "closed", merged_at: "2026-01-01" }], "owner", "repo", "pulls")[0].state).toBe("MERGED");
    expect(normalizeGithubItems([{ ...base, draft: true }], "owner", "repo", "pulls")[0].state).toBe("DRAFT");
  });
});

describe("PR review state", () => {
  it("keeps latest substantive review per reviewer, ignoring comments", () => {
    expect(normalizeReviewStates([
      { id: 1, user: { login: "a" }, state: "CHANGES_REQUESTED" },
      { id: 2, user: { login: "b" }, state: "APPROVED" },
      { id: 3, user: { login: "a" }, state: "APPROVED" },
      { id: 4, user: { login: "a" }, state: "COMMENTED" },
    ])).toEqual([{ user: "a", state: "APPROVED" }, { user: "b", state: "APPROVED" }]);
  });
  it("bounds pagination", () => {
    expect(githubListUrl("owner", "repo", "pulls", "all", 2)?.searchParams.get("page")).toBe("2");
    expect(githubListUrl("owner", "repo", "pulls", "all", 21)).toBeNull();
  });
});
