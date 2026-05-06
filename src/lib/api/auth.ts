import { api, jsonBody } from "./client";

export type AuthUser = {
  id: string;
  email: string;
  nickname?: string;
  createdAt: string;
  updatedAt: string;
};

export const authApi = {
  me: () => api<{ user: AuthUser }>("/api/auth/me"),
  login: (input: { email: string; password: string }) =>
    api<{ user: AuthUser }>("/api/auth/login", { method: "POST", ...jsonBody(input) }),
  register: (input: { email: string; password: string; nickname?: string }) =>
    api<{ user: AuthUser }>("/api/auth/register", { method: "POST", ...jsonBody(input) }),
  logout: () => api<{ ok: true }>("/api/auth/logout", { method: "POST" }),
};
