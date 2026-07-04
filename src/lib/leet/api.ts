// API client — axios-like wrapper using fetch, with refresh-on-401 interceptor (single-flight)
// All API paths are RELATIVE to satisfy the gateway constraint.

import type { User, Sheet, SheetStats, Question, QuestionsResponse } from "./types";

let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

export function setAccessToken(t: string | null) {
  accessToken = t;
}

export function getAccessToken() {
  return accessToken;
}

interface FetchOpts {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  // skipAuthRetry — used by the refresh call itself to avoid infinite loops
  skipAuthRetry?: boolean;
  // rawBody — pass FormData as-is (no JSON serialize)
  rawBody?: BodyInit;
}

async function doFetch(path: string, opts: FetchOpts = {}): Promise<Response> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.body !== undefined && !opts.rawBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(path, {
    method: opts.method ?? "GET",
    headers,
    body: opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    signal: opts.signal,
    credentials: "include",
  });

  if (res.status === 401 && !opts.skipAuthRetry && !path.includes("/api/auth/")) {
    // Try refresh once
    try {
      if (!refreshPromise) {
        refreshPromise = (async () => {
          const r = await fetch("/api/auth/refresh", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });
          if (!r.ok) throw new Error("refresh failed");
          const data = await r.json();
          return data.access_token as string;
        })();
      }
      const newToken = await refreshPromise;
      refreshPromise = null;
      setAccessToken(newToken);
      headers["Authorization"] = `Bearer ${newToken}`;
      return fetch(path, {
        method: opts.method ?? "GET",
        headers,
        body: opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
        signal: opts.signal,
        credentials: "include",
      });
    } catch (e) {
      refreshPromise = null;
      setAccessToken(null);
      throw e;
    }
  }

  return res;
}

export async function apiJson<T = unknown>(path: string, opts: FetchOpts = {}): Promise<T> {
  const res = await doFetch(path, opts);
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg = (data && typeof data === "object" && "detail" in data && typeof (data as { detail: unknown }).detail === "string")
      ? (data as { detail: string }).detail
      : `Request failed (${res.status})`;
    const err = new Error(msg) as Error & { status: number; data: unknown };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

// Specific API functions

export const authApi = {
  register: (body: { email: string; password: string; name: string }) =>
    apiJson<{ user: User; access_token: string }>("/api/auth/register", { method: "POST", body }),
  login: (body: { email: string; password: string }) =>
    apiJson<{ user: User; access_token: string }>("/api/auth/login", { method: "POST", body }),
  refresh: () =>
    apiJson<{ access_token: string }>("/api/auth/refresh", { method: "POST", skipAuthRetry: true }),
  logout: () => apiJson<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  me: () => apiJson<User>("/api/auth/me", { skipAuthRetry: true }),
};

export const sheetsApi = {
  list: () => apiJson<{ sheets: Sheet[] }>("/api/sheets"),
  create: (name: string) => apiJson<{ sheet: Sheet }>("/api/sheets", { method: "POST", body: { name } }),
  get: (id: string) => apiJson<{ sheet: Sheet; stats: SheetStats }>(`/api/sheets/${id}`),
  rename: (id: string, name: string) =>
    apiJson<{ sheet: Sheet }>(`/api/sheets/${id}`, { method: "PATCH", body: { name } }),
  remove: (id: string) => apiJson<{ ok: true }>(`/api/sheets/${id}`, { method: "DELETE" }),
  questions: (sheetId: string, query: Record<string, string>) =>
    apiJson<QuestionsResponse>(`/api/sheets/${sheetId}/questions?${new URLSearchParams(query)}`),
  upload: (sheetId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiJson<{ sheet: Sheet; imported: number; skipped: number; preserved_solved: number }>(
      `/api/sheets/${sheetId}/upload`,
      { method: "POST", rawBody: fd },
    );
  },
  toggleSolved: (sheetId: string, questionId: string, solved: boolean) =>
    apiJson<{ question: Question }>(`/api/sheets/${sheetId}/questions/${questionId}`, {
      method: "PATCH",
      body: { solved },
    }),
};

// Re-export types so consumers can import from a single module
export type { User, Sheet, SheetStats, Question, QuestionsResponse } from "./types";
