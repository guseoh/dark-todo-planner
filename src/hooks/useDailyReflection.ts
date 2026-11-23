import { useCallback, useEffect, useState } from "react";
import { api, jsonBody } from "../lib/api/client";

/** One short end-of-day note per planner date. */
export function useDailyReflection(date: string) {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let live = true;
    setLoaded(false);
    setError("");
    void api<{ reflections: Array<{ date: string; content: string }> }>(`/api/reflections?from=${date}&to=${date}`)
      .then((result) => { if (live) { setContent(result.reflections.find((item) => item.date === date)?.content ?? ""); setLoaded(true); } })
      .catch(() => { if (live) setError("기존 회고를 불러오지 못했습니다. 편집 전에 다시 조회해 주세요."); });
    return () => { live = false; };
  }, [date, retryKey]);

  const save = useCallback(async (next: string) => {
    const result = await api<{ reflection: { content: string } }>(`/api/reflections/daily/${date}`, { method: "PUT", ...jsonBody({ content: next }) });
    setContent(result.reflection.content);
  }, [date]);

  const retry = useCallback(() => setRetryKey((value) => value + 1), []);

  return { content, loaded, error, save, retry };
}
