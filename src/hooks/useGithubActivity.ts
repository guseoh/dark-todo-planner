import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api/client";
import { normalizeActivityDays, type ActivityDay } from "../lib/activity";

export type GithubActivity = {
  username: string;
  source: "github-public" | "github-graphql";
  days: ActivityDay[];
  total: number | null;
  fetchedAt: string;
  stale?: boolean;
};

const CLIENT_CACHE_MS = 10 * 60 * 1000;
let cached: { data: GithubActivity; at: number } | null = null;

/** The Worker already caches for an hour; this only avoids refetching on every Today visit. */
export function useGithubActivity(enabled = true) {
  const [data, setData] = useState<GithubActivity | null>(cached?.data ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (options?: { force?: boolean; signal?: AbortSignal }) => {
    if (!options?.force && cached && Date.now() - cached.at < CLIENT_CACHE_MS) {
      setData(cached.data);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await api<GithubActivity>("/api/activity/github", { signal: options?.signal });
      if (!Array.isArray(response.days) || response.days.length < 200) throw new Error("GitHub 활동 데이터가 불완전합니다.");
      const next = { ...response, days: normalizeActivityDays(response.days) };
      cached = { data: next, at: Date.now() };
      if (!options?.signal?.aborted) setData(next);
    } catch (err) {
      if (!options?.signal?.aborted) setError(err instanceof Error ? err.message : "GitHub 활동을 가져오지 못했습니다.");
    } finally {
      if (!options?.signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void load({ signal: controller.signal });
    return () => controller.abort();
  }, [enabled, load]);

  return { data, loading, error, reload: () => load({ force: true }) };
}
