"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi, setAccessToken } from "@/lib/leet/api";
import type { User } from "@/lib/leet/types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await authApi.refresh();
        setAccessToken(r.access_token);
        const me = await authApi.me();
        if (!cancelled) setUser(me);
      } catch {
        setAccessToken(null);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await authApi.login({ email, password });
    setAccessToken(r.access_token);
    setUser(r.user);
    qc.clear();
  }, [qc]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const r = await authApi.register({ email, password, name });
    setAccessToken(r.access_token);
    setUser(r.user);
    qc.clear();
  }, [qc]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch {}
    setAccessToken(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}
