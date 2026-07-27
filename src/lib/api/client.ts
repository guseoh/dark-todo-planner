export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const resolveApiPath = (path: string) => /^https?:\/\//.test(path) ? path : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(resolveApiPath(path), { ...options, credentials: "include", headers: { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...options.headers } });
  const text = await response.text(); const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    if (response.status === 401 && path !== "/api/auth/session" && path !== "/api/auth/login") window.dispatchEvent(new Event("auth:unauthorized"));
    throw new ApiError(data.message || "API 요청에 실패했습니다.", response.status);
  }
  return data as T;
}

export async function apiAllPages<T>(path: string, collectionKey: string): Promise<T[]> {
  const values: T[] = []; let cursor: string | undefined;
  for (let page = 0; page < 1000; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const result = await api<Record<string, unknown> & { nextCursor?: string }>(`${path}${separator}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    const items = result[collectionKey]; if (!Array.isArray(items)) throw new ApiError("목록 응답 형식이 올바르지 않습니다.", 500);
    values.push(...items as T[]); cursor = result.nextCursor; if (!cursor) return values;
  }
  throw new ApiError("목록 페이지 수가 안전 한도를 초과했습니다.", 500);
}

export const jsonBody = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });
