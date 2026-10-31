// The web layer loginbase lacks: the refresh token lives in an HttpOnly, Secure, SameSite=Lax
// cookie scoped to /auth/web; the page only ever sees the short access JWT (memory, never storage).
// Every route here calls loginbase's own endpoints in-process, so the wire contract stays
// loginbase's (docs/protocol.md) and the cookie is the only addition.
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { clientIp } from "../client-ip.js";
import { ApiError, jsonResponse } from "../http.js";
import { CodeSendSchema, CodeVerifySchema } from "../../schemas/auth.js";
import { ACCESS_TTL_SECONDS, REFRESH_TTL_MS, WEB_GITHUB_DONE_PATH, appOrigin, githubConfigured, login } from "./login.js";

export const SESSION_COOKIE = "rs_session";
const COOKIE_PATH = "/auth/web";
const ERROR_CODE = /^[a-z_]{1,64}$/;

type Ctx = { env: Env; req: { raw: Request }; executionCtx?: { waitUntil(promise: Promise<unknown>): void } };

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  isNewUser?: boolean;
  user?: unknown;
}

/** Call a loginbase endpoint in-process with the caller's client headers. */
async function internal(c: Ctx, path: string, init: { method: string; body?: unknown; bearer?: string }): Promise<Response> {
  const headers = new Headers({ "Content-Type": "application/json", "X-Client-Platform": "web" });
  for (const name of ["User-Agent", "sec-ch-ua", "X-Client-Version"]) {
    const value = c.req.raw.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("CF-Connecting-IP", clientIp(c.req.raw, c.env));
  if (init.bearer) headers.set("Authorization", `Bearer ${init.bearer}`);
  const request = new Request(`${new URL(c.req.raw.url).origin}${path}`, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  let ctx: ExecutionContext | undefined;
  try {
    ctx = c.executionCtx as unknown as ExecutionContext;
  } catch {
    ctx = undefined;
  }
  return login.fetch(request, c.env, ctx);
}

function setSessionCookie(c: Parameters<typeof setCookie>[0], refreshToken: string): void {
  setCookie(c, SESSION_COOKIE, refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: COOKIE_PATH,
    maxAge: Math.floor(REFRESH_TTL_MS / 1000),
  });
}

function clearSessionCookie(c: Parameters<typeof deleteCookie>[0]): void {
  deleteCookie(c, SESSION_COOKIE, { path: COOKIE_PATH, secure: true, httpOnly: true, sameSite: "Lax" });
}

async function readJson(c: { req: { raw: Request } }): Promise<unknown> {
  try {
    return await c.req.raw.json();
  } catch {
    return {};
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown, code: string, message: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, code, message, { issues: result.error.issues.map((i) => i.path.join(".")) });
  return result.data;
}

/** Pass a loginbase error response through unchanged (status, body and headers). */
async function passThrough(response: Response): Promise<Response> {
  const body = await response.text();
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(body, { status: response.status, headers });
}

export const authWebRoutes = new Hono<{ Bindings: Env }>();

authWebRoutes.post("/auth/web/code/send", async (c) => {
  const body = parse(CodeSendSchema, await readJson(c), "invalid_email", "Enter a valid email address.");
  const response = await internal(c, "/auth/code/send", { method: "POST", body });
  return passThrough(response);
});

authWebRoutes.post("/auth/web/code/verify", async (c) => {
  const body = parse(CodeVerifySchema, await readJson(c), "invalid_code", "Enter the 6 digit code from the email.");
  const response = await internal(c, "/auth/code/verify", { method: "POST", body });
  if (!response.ok) return passThrough(response);
  const pair = (await response.json()) as TokenPair;
  setSessionCookie(c, pair.refreshToken);
  return jsonResponse(
    { accessToken: pair.accessToken, expiresIn: ACCESS_TTL_SECONDS, isNewUser: pair.isNewUser ?? false, user: pair.user ?? null },
    200,
    c.res.headers,
  );
});

authWebRoutes.post("/auth/web/refresh", async (c) => {
  const refreshToken = getCookie(c, SESSION_COOKIE);
  // No cookie = signed out. 204, not 401: a signed-out visitor is the normal case on every page load.
  if (!refreshToken) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  const response = await internal(c, "/auth/refresh", { method: "POST", body: { refreshToken } });
  if (!response.ok) {
    clearSessionCookie(c);
    const body = await response.text();
    return new Response(body, { status: response.status, headers: { ...Object.fromEntries(c.res.headers), "Content-Type": "application/json", "Cache-Control": "no-store" } });
  }
  const pair = (await response.json()) as TokenPair;
  setSessionCookie(c, pair.refreshToken);
  return jsonResponse({ accessToken: pair.accessToken, expiresIn: ACCESS_TTL_SECONDS }, 200, c.res.headers);
});

authWebRoutes.post("/auth/web/logout", async (c) => {
  const auth = c.req.raw.headers.get("Authorization");
  let bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
  const refreshToken = getCookie(c, SESSION_COOKIE);
  if (!bearer && refreshToken) {
    const refreshed = await internal(c, "/auth/refresh", { method: "POST", body: { refreshToken } });
    if (refreshed.ok) bearer = ((await refreshed.json()) as TokenPair).accessToken;
  }
  if (bearer) await internal(c, "/auth/sessions", { method: "DELETE", bearer });
  clearSessionCookie(c);
  return new Response(null, { status: 204, headers: { ...Object.fromEntries(c.res.headers), "Cache-Control": "no-store" } });
});

authWebRoutes.get("/auth/web/github/start", (c) => {
  if (!githubConfigured(c.env)) throw new ApiError(404, "not_configured", "GitHub sign-in is not set up.");
  const url = new URL(`${appOrigin(c.env)}/auth/oauth/github/start`);
  url.searchParams.set("redirect", `${appOrigin(c.env)}${WEB_GITHUB_DONE_PATH}`);
  url.searchParams.set("client_platform", "web");
  return c.redirect(url.toString(), 302);
});

authWebRoutes.get(WEB_GITHUB_DONE_PATH, async (c) => {
  const otc = c.req.query("otc");
  const error = c.req.query("error");
  const failed = (code: string) => c.redirect(`/sign-in?error=${ERROR_CODE.test(code) ? code : "oauth_failed"}`, 302);
  if (!otc) return failed(error || "oauth_failed");
  const response = await internal(c, "/auth/oauth/exchange", { method: "POST", body: { otc } });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    return failed(body.error || "oauth_failed");
  }
  const pair = (await response.json()) as TokenPair;
  setSessionCookie(c, pair.refreshToken);
  return c.redirect("/splits", 302);
});
