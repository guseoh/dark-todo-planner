export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const resolveApiPath = (path: string) => {
  if (/^https?:\/\//.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(resolveApiPath(path), {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new ApiError(data.message || "API 요청에 실패했습니다.", response.status);
  }
  return data as T;
}

export const jsonBody = (body: unknown): RequestInit => ({
  body: JSON.stringify(body),
});
