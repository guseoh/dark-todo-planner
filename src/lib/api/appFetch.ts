import { invoke, isTauri } from "@tauri-apps/api/core";
import { startNativeWrite } from "../desktopSafety";

type NativeResponse = { status: number; body: string; contentType: string };

// IPC cannot cancel the Rust HTTP request yet. Stop waiting for aborted reads
// without pretending a submitted mutation has been cancelled server-side.
export function waitForNativeRead<T>(request: Promise<T>, signal?: AbortSignal | null): Promise<T> {
  if (!signal) return request;
  return new Promise<T>((resolve, reject) => {
    const abort = () => { cleanup(); reject(signal.reason ?? new DOMException("요청이 취소되었습니다.", "AbortError")); };
    const cleanup = () => signal.removeEventListener("abort", abort);
    request.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

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
  const method = (init?.method || "GET").toUpperCase();
  const done = method === "GET" ? () => {} : startNativeWrite();
  try {
  const request = invoke<NativeResponse>("desktop_api_request", {
    path: input,
    method,
    body: (init?.body as string | undefined) ?? null,
  });
  const result = await (method === "GET" ? waitForNativeRead(request, init?.signal) : request);
  return new Response([204, 205, 304].includes(result.status) ? null : result.body, {
    status: result.status,
    headers: { "Content-Type": result.contentType },
  });
  } finally { done(); }
};
