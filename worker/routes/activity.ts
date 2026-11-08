import { Hono } from "hono";
import { fetchGithubActivity, type GithubActivity } from "../githubActivity";
import type { Bindings, Variables } from "../types";

export const activityRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// The only upstream username is the owner's public profile; no SSRF surface.
let cache: { data: GithubActivity; expires: number } | null = null;
let inFlight: Promise<GithubActivity> | null = null;
const TTL_MS = 60 * 60 * 1000;

activityRoutes.get("/activity/github", async (c) => {
  const now = Date.now();
  if (cache && cache.expires > now) return c.json(cache.data);
  try {
    if (!inFlight) {
      inFlight = fetchGithubActivity(c.env.GITHUB_ACTIVITY_TOKEN)
        .then((data) => {
          cache = { data, expires: Date.now() + TTL_MS };
          return data;
        }).finally(() => { inFlight = null; });
    }
    return c.json(await inFlight);
  } catch {
    if (cache) return c.json({ ...cache.data, stale: true });
    return c.json({ message: "GitHub 활동을 가져올 수 없습니다. 잠시 후 다시 시도해 주세요." }, 503);
  }
});
