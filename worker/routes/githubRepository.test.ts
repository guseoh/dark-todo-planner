import { describe, expect, it } from "vitest";
import { githubListUrl, normalizeGithubItems } from "./githubRepository";
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
