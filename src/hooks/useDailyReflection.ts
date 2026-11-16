import { useCallback, useEffect, useState } from "react";
import { api, jsonBody } from "../lib/api/client";

/** One short end-of-day note per planner date. */
export function useDailyReflection(date: string) {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    setLoaded(false);
    void api<{ reflections: Array<{ date: string; content: string }> }>(`/api/reflections?from=${date}&to=${date}`)
      .then((result) => { if (live) { setContent(result.reflections.find((item) => item.date === date)?.content ?? ""); setLoaded(true); } })
      .catch(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, [date]);

  const save = useCallback(async (next: string) => {
    const result = await api<{ reflection: { content: string } }>(`/api/reflections/daily/${date}`, { method: "PUT", ...jsonBody({ content: next }) });
    setContent(result.reflection.content);
  }, [date]);

  return { content, loaded, save };
}
