import { Hono } from "hono";
import type { Bindings, Variables } from "../types";

export type GithubItem = { number: number; title: string; url: string; state: "OPEN" | "CLOSED" | "DRAFT" | "MERGED"; author: string; updatedAt: string };
const ownerPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const repoPattern = /^[A-Za-z0-9_.-]{1,100}$/;
export function githubListUrl(owner: string, repo: string, kind: string, state: string, page = 1): URL | null {
  if (!ownerPattern.test(owner) || !repoPattern.test(repo) || repo === "." || repo === ".."
      || !["issues", "pulls"].includes(kind) || !["open", "closed", "all"].includes(state)) return null;
  if (!Number.isSafeInteger(page) || page < 1 || page > 20) return null;
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/${kind}`);
  url.searchParams.set("state", state);
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", String(page));
  return url;
}

export function normalizeGithubItems(value: unknown, owner: string, repo: string, kind: "issues" | "pulls"): GithubItem[] {
  if (!Array.isArray(value)) throw new Error("Invalid GitHub response");
  return value.flatMap((item): GithubItem[] => {
    if (!item || typeof item !== "object" || !Number.isSafeInteger(item.number) || item.number <= 0 || typeof item.title !== "string") return [];
    if (kind === "issues" && item.pull_request) return [];
    const state = item.state === "closed" ? (kind === "pulls" && item.merged_at ? "MERGED" : "CLOSED")
      : item.state === "open" ? (kind === "pulls" && item.draft ? "DRAFT" : "OPEN") : null;
    if (!state) return [];
    return [{ number: item.number, title: item.title.slice(0, 300), state,
      url: `https://github.com/${owner}/${repo}/${kind === "pulls" ? "pull" : "issues"}/${item.number}`,
      author: typeof item.user?.login === "string" ? item.user.login : "",
      updatedAt: typeof item.updated_at === "string" ? item.updated_at : "" }];
  }).slice(0, 100);
}

type Result = { items: GithubItem[]; fetchedAt: string; limited: boolean };
const cache = new Map<string, { expires: number; data: Result }>();
const inFlight = new Map<string, Promise<Result>>();
const TTL = 90_000;
export const githubRepositoryRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();
githubRepositoryRoutes.get("/github/repositories/:owner/:repo/:kind", async (c) => {
  const { owner, repo, kind } = c.req.param();
  const url = githubListUrl(owner, repo, kind, c.req.query("state") ?? "open", Number(c.req.query("page") ?? 1));
  if (!url) return c.json({ message: "저장소 또는 조회 조건이 올바르지 않습니다." }, 400);
  const key = url.toString();
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return c.json(hit.data);
  try {
    let request = inFlight.get(key);
    if (!request) {
      if (inFlight.size >= 8) return c.json({ message: "GitHub 조회가 많습니다. 잠시 후 다시 시도하세요." }, 429);
      request = (async () => {
        // Public-only first slice. No user or activity token is sent, and redirects are blocked.
        const response = await fetch(url, { headers: { Accept: "application/vnd.github+json", "User-Agent": "Tern-Repository-Reader", "X-GitHub-Api-Version": "2022-11-28" }, redirect: "error", signal: AbortSignal.timeout(10_000) });
        if (!response.ok) throw new Error(String(response.status));
        const data: Result = { items: normalizeGithubItems(await response.json(), owner, repo, kind as "issues" | "pulls"), fetchedAt: new Date().toISOString(), limited: Boolean(response.headers.get("Link")?.includes('rel="next"')) };
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(key, { expires: Date.now() + TTL, data });
        return data;
      })().finally(() => { inFlight.delete(key); });
      inFlight.set(key, request);
    }
    return c.json(await request);
  } catch {
    return c.json({ message: "공개 GitHub 저장소를 조회하지 못했습니다. 저장소 주소 또는 요청 한도를 확인해 주세요." }, 503);
  }
});

type PRDetails = {
  reviews: Array<{ user: string; state: string }>;
  requestedReviewers: string[];
  checks: Array<{ name: string; status: string; conclusion: string | null }>;
  commitStatus: string | null;
  headSha: string;
  mergeable: boolean | null;
  truncated: boolean;
  fetchedAt: string;
};
const detailsCache = new Map<string, { expires: number; data: PRDetails }>();
const detailsInFlight = new Map<string, Promise<PRDetails>>();
export function normalizeReviewStates(value: unknown): PRDetails["reviews"] {
  if (!Array.isArray(value)) throw new Error("Invalid reviews");
  const byUser = new Map<string, { user: string; state: string; order: number }>();
  for (const row of value) {
    if (typeof row?.user?.login !== "string" || !["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(row.state)) continue;
    const order = Number.isSafeInteger(row.id) ? row.id : 0;
    const existing = byUser.get(row.user.login);
    if (!existing || order >= existing.order) byUser.set(row.user.login, { user: row.user.login, state: row.state, order });
  }
  return [...byUser.values()].map(({ user, state }) => ({ user, state }));
}
async function publicGithubJson(url: URL) {
  const response = await fetch(url, { headers: { Accept: "application/vnd.github+json", "User-Agent": "Tern-Repository-Reader", "X-GitHub-Api-Version": "2022-11-28" }, redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("GitHub response error");
  return { body: await response.json() as any, limited: Boolean(response.headers.get("Link")?.includes('rel="next"')) };
}
githubRepositoryRoutes.get("/github/repositories/:owner/:repo/pulls/:number/details", async (c) => {
  const { owner, repo, number } = c.req.param();
  const root = githubListUrl(owner, repo, "pulls", "all");
  if (!root || !/^[1-9][0-9]{0,9}$/.test(number)) return c.json({ message: "잘못된 PR 번호입니다." }, 400);
  const url = new URL(root.pathname + "/" + number, root.origin);
  const key = url.toString();
  const hit = detailsCache.get(key);
  if (hit && hit.expires > Date.now()) return c.json(hit.data);
  try {
    let request = detailsInFlight.get(key);
    if (!request) {
      if (detailsInFlight.size >= 3) return c.json({ message: "GitHub 조회가 많습니다. 잠시 후 다시 시도하세요." }, 429);
      request = (async () => {
        const { body: pr } = await publicGithubJson(url);
        const headSha = pr?.head?.sha;
        if (typeof headSha !== "string" || !/^[0-9a-f]{40}$/i.test(headSha)) throw new Error("Invalid head SHA");
        const reviewsUrl = new URL(url.pathname + "/reviews?per_page=100", root.origin);
        const commitsPath = `/repos/${owner}/${repo}/commits/${headSha}`;
        const [reviews, checks, status] = await Promise.all([
          publicGithubJson(reviewsUrl),
          publicGithubJson(new URL(commitsPath + "/check-runs?per_page=100", root.origin)),
          publicGithubJson(new URL(commitsPath + "/status?per_page=100", root.origin)),
        ]);
        if (!Array.isArray(checks.body?.check_runs) || !Array.isArray(reviews.body)) throw new Error("Invalid details");
        const data: PRDetails = {
          reviews: normalizeReviewStates(reviews.body),
          requestedReviewers: Array.isArray(pr.requested_reviewers) ? pr.requested_reviewers.flatMap((item: any) => typeof item?.login === "string" ? [item.login] : []) : [],
          checks: checks.body.check_runs.flatMap((item: any) => typeof item?.name === "string" && typeof item?.status === "string" ? [{ name: item.name, status: item.status, conclusion: typeof item.conclusion === "string" ? item.conclusion : null }] : []),
          commitStatus: typeof status.body?.state === "string" ? status.body.state : null,
          headSha,
          mergeable: typeof pr.mergeable === "boolean" ? pr.mergeable : null,
          truncated: reviews.limited || checks.limited || status.limited,
          fetchedAt: new Date().toISOString(),
        };
        if (detailsCache.size >= 50) detailsCache.delete(detailsCache.keys().next().value!);
        detailsCache.set(key, { expires: Date.now() + TTL, data });
        return data;
      })().finally(() => { detailsInFlight.delete(key); });
      detailsInFlight.set(key, request);
    }
    return c.json(await request);
  } catch {
    return c.json({ message: "PR 리뷰 또는 CI 정보를 조회하지 못했습니다. GitHub 요청 한도나 공개 여부를 확인하세요." }, 503);
  }
});
