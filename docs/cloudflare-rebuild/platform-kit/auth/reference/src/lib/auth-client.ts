// The browser half of the auth web layer. The access JWT lives in this module's memory only (never
// localStorage, never a cookie the page can read); the refresh token is the HttpOnly cookie that
// /auth/web/refresh rotates. Refresh is single-flight: concurrent callers share one request.
import { WebTokenSchema, type PublicUser } from "../schemas/auth.js";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const SKEW_MS = 30_000;
let accessToken: string | null = null;
let expiresAt = 0;
let refreshing: Promise<string | null> | null = null;

export type SessionState = { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; user: PublicUser };
let session: SessionState = { status: "loading" };
const listeners = new Set<(s: SessionState) => void>();

function publish(next: SessionState): void {
  session = next;
  for (const fn of listeners) fn(next);
}

export function subscribeSession(fn: (s: SessionState) => void): () => void {
  listeners.add(fn);
  fn(session);
  return () => listeners.delete(fn);
}

export function currentSession(): SessionState {
  return session;
}

/** Read an error envelope `{ error, message, ...fields }` into an ApiClientError. */
export async function errorFrom(response: Response): Promise<ApiClientError> {
  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // no JSON body
  }
  const { error, message, ...fields } = body;
  return new ApiClientError(response.status, typeof error === "string" ? error : "http_error", typeof message === "string" ? message : `Request failed (${response.status}).`, fields);
}

function setToken(token: string, expiresIn: number): void {
  accessToken = token;
  expiresAt = Date.now() + expiresIn * 1000;
}

async function refresh(): Promise<string | null> {
  const response = await fetch("/auth/web/refresh", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" } });
  if (!response.ok || response.status === 204) {
    accessToken = null;
    expiresAt = 0;
    return null;
  }
  const data = WebTokenSchema.parse(await response.json());
  setToken(data.accessToken, data.expiresIn);
  return accessToken;
}

/** The current access token, refreshed through the cookie when missing or about to expire. */
export function getAccessToken(force = false): Promise<string | null> {
  if (!force && accessToken && Date.now() < expiresAt - SKEW_MS) return Promise.resolve(accessToken);
  if (!refreshing) {
    refreshing = refresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/** fetch with the Bearer token; one retry after a forced refresh on 401. Throws ApiClientError. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let token = await getAccessToken();
  if (!token) throw new ApiClientError(401, "unauthorized", "You are signed out.");
  const send = (t: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${t}`);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    headers.set("X-Client-Platform", "web");
    return fetch(path, { ...init, headers, credentials: "same-origin" });
  };
  let response = await send(token);
  if (response.status === 401) {
    token = await getAccessToken(true);
    if (!token) {
      publish({ status: "signed-out" });
      throw new ApiClientError(401, "unauthorized", "You are signed out.");
    }
    response = await send(token);
  }
  if (!response.ok) throw await errorFrom(response);
  return response;
}

/** POST without a session (sign-in endpoints). Throws ApiClientError on a non-2xx. */
export async function postPublic<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Client-Platform": "web" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as T;
}

export async function sendCode(email: string, locale?: string): Promise<{ cooldownSeconds: number }> {
  return postPublic("/auth/web/code/send", { email, ...(locale ? { locale } : {}) });
}

export async function verifyCode(email: string, code: string): Promise<PublicUser | null> {
  const data = WebTokenSchema.parse(await postPublic("/auth/web/code/verify", { email, code }));
  setToken(data.accessToken, data.expiresIn);
  const user = data.user ?? (await fetchMe());
  if (user) publish({ status: "signed-in", user });
  return user ?? null;
}

async function fetchMe(): Promise<PublicUser | null> {
  try {
    const response = await apiFetch("/api/me");
    return ((await response.json()) as { user: PublicUser }).user;
  } catch {
    return null;
  }
}

let loading: Promise<SessionState> | null = null;

/** Resolve the session once per page: cookie refresh, then /api/me. Safe to call from every island. */
export function loadSession(): Promise<SessionState> {
  if (session.status !== "loading") return Promise.resolve(session);
  if (!loading) {
    loading = (async () => {
      const token = await getAccessToken().catch(() => null);
      if (!token) {
        publish({ status: "signed-out" });
        return session;
      }
      const user = await fetchMe();
      publish(user ? { status: "signed-in", user } : { status: "signed-out" });
      return session;
    })().finally(() => {
      loading = null;
    });
  }
  return loading;
}

/** Re-read the user (after a plan change). */
export async function reloadUser(): Promise<void> {
  const user = await fetchMe();
  publish(user ? { status: "signed-in", user } : { status: "signed-out" });
}

export async function signOut(): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  await fetch("/auth/web/logout", { method: "POST", credentials: "same-origin", headers }).catch(() => undefined);
  accessToken = null;
  expiresAt = 0;
  publish({ status: "signed-out" });
}

/** Where to send a signed-out visitor so they come back to `next`. */
export function signInUrl(next: string): string {
  return `/sign-in?next=${encodeURIComponent(next)}`;
}
