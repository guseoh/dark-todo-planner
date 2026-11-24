import { Hono } from "hono";
import type { Bindings, Variables } from "../types";

export type GithubItem = { number: number; title: string; url: string; state: "OPEN" | "CLOSED" | "DRAFT" | "MERGED"; author: string; updatedAt: string };
const ownerPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const repoPattern = /^[A-Za-z0-9_.-]{1,100}$/;
export function githubListUrl(owner: string, repo: string, kind: string, state: string): URL | null {
  if (!ownerPattern.test(owner) || !repoPattern.test(repo) || repo === "." || repo === ".."
      || !["issues", "pulls"].includes(kind) || !["open", "closed", "all"].includes(state)) return null;
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/${kind}`);
  url.searchParams.set("state", state);
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");
  url.searchParams.set("per_page", "100");
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
  const url = githubListUrl(owner, repo, kind, c.req.query("state") ?? "open");
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
