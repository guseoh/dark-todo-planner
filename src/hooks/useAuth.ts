import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../lib/api/client";
import { authApi, type AuthUser } from "../lib/api/auth";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await authApi.me();
      setUser(result.user);
      setError("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setUser(null);
      else setError(err instanceof Error ? err.message : "사용자 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (input: { email: string; password: string }) => {
    const result = await authApi.login(input);
    setUser(result.user);
  }, []);

  const register = useCallback(async (input: { email: string; password: string; nickname?: string }) => {
    const result = await authApi.register(input);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return { user, loading, error, login, register, logout, refresh };
}
