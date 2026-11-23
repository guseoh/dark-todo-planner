import { invoke, isTauri } from "@tauri-apps/api/core";

type NativeResponse = { status: number; body: string; contentType: string };

/**
 * In the desktop app, route ONLY the fixed production API through native Rust.
 * This keeps strict same-origin browser cookies/CSRF policy unchanged on the Worker
 * and prevents the embedded WebView from making cross-origin credential requests.
 */
export const appFetch: typeof fetch = async (input, init) => {
  if (!isTauri() || typeof input !== "string" || !input.startsWith("/api/")) {
    return fetch(input, init);
  }
  if (init?.signal?.aborted) throw new DOMException("요청이 취소되었습니다.", "AbortError");
  if (init?.body !== undefined && init.body !== null && typeof init.body !== "string") {
    throw new TypeError("데스크톱 API에서는 JSON 문자열 요청 본문만 지원합니다.");
  }
  const result = await invoke<NativeResponse>("desktop_api_request", {
    path: input,
    method: init?.method || "GET",
    body: (init?.body as string | undefined) ?? null,
  });
  if (init?.signal?.aborted) throw new DOMException("요청이 취소되었습니다.", "AbortError");
  return new Response([204, 205, 304].includes(result.status) ? null : result.body, {
    status: result.status,
    headers: { "Content-Type": result.contentType },
  });
};
