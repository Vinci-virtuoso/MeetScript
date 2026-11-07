// Sign-in end to end inside workerd: loginbase under the vitest plugin, the dev mail transport, the
// cookie web layer, requireUser on /api/me, the guards (origin, rate limit) and GitHub start/done.
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../../src/server/app.js";
import { clearDevOutbox } from "../../src/email/dev.js";

const ORIGIN = "http://127.0.0.1:8787";
// A fresh email per test too: loginbase keeps a 60 s send cooldown per email in KV.
let EMAIL = "ana1@example.com";

// A fresh client IP per test: loginbase's KV counters and the edge limiter are both keyed by IP.
let ip = "203.0.113.1";
let ipCounter = 0;

beforeEach(() => {
  ipCounter += 1;
  ip = `203.0.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
  EMAIL = `ana${ipCounter}@example.com`;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  clearDevOutbox();
});

type Bindings = Partial<Record<string, unknown>>;

async function call(path: string, init: RequestInit = {}, bindings: Bindings = {}): Promise<Response> {
  const ctx = createExecutionContext();
  const headers = new Headers(init.headers);
  if (init.method && init.method !== "GET" && !headers.has("Origin")) headers.set("Origin", ORIGIN);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!headers.has("CF-Connecting-IP")) headers.set("CF-Connecting-IP", ip);
  const response = await worker.fetch(new Request(`${ORIGIN}${path}`, { ...init, headers }), { ...env, ...bindings } as never, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

const post = (path: string, body: unknown, init: RequestInit = {}, bindings: Bindings = {}) =>
  call(path, { ...init, method: "POST", body: JSON.stringify(body) }, bindings);

async function lastCode(to = EMAIL): Promise<string> {
  const response = await call(`/api/dev/mail?to=${encodeURIComponent(to)}`);
  expect(response.status).toBe(200);
  const { messages } = (await response.json()) as { messages: { text: string }[] };
  expect(messages.length).toBeGreaterThan(0);
  const match = /\b(\d{6})\b/.exec(messages[0]!.text);
  if (!match) throw new Error("no code in the mail");
  return match[1]!;
}

function cookieOf(response: Response): string | null {
  const header = response.headers.get("Set-Cookie");
  if (!header) return null;
  return header.split(";")[0] ?? null;
}

async function signIn(email = EMAIL) {
  const sent = await post("/auth/web/code/send", { email });
  expect(sent.status).toBe(200);
  expect(await sent.json()).toEqual({ cooldownSeconds: 60 });
  const code = await lastCode(email);
  const verified = await post("/auth/web/code/verify", { email, code });
  expect(verified.status).toBe(200);
  const body = (await verified.json()) as { accessToken: string; expiresIn: number; isNewUser: boolean; user: { email: string } };
  return { body, cookie: cookieOf(verified)!, setCookie: verified.headers.get("Set-Cookie")! };
}

describe("email code sign-in through /auth/web", () => {
  it("sends a code, verifies it, sets the HttpOnly cookie and keeps the refresh token out of the body", async () => {
    const { body, setCookie } = await signIn();
    expect(body.accessToken.split(".")).toHaveLength(3);
    expect(body.expiresIn).toBe(900);
    expect(body.isNewUser).toBe(true);
    expect(body.user.email).toBe(EMAIL);
    expect(JSON.stringify(body)).not.toContain("refreshToken");
    expect(setCookie).toMatch(/^rs_session=[A-Za-z0-9_-]{43};/);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/auth/web");
  });

  it("rejects a bad email, a wrong code, an expired code and too many attempts with loginbase's codes", async () => {
    expect(((await (await post("/auth/web/code/send", { email: "nope" })).json()) as { error: string }).error).toBe("invalid_email");
    const expired = await post("/auth/web/code/verify", { email: EMAIL, code: "123456" });
    expect(expired.status).toBe(400);
    expect(((await expired.json()) as { error: string }).error).toBe("code_expired");

    await post("/auth/web/code/send", { email: EMAIL });
    const code = await lastCode();
    const wrong = String((Number(code) + 1) % 1000000).padStart(6, "0");
    for (let i = 0; i < 4; i += 1) {
      const r = await post("/auth/web/code/verify", { email: EMAIL, code: wrong });
      expect(r.status).toBe(400);
      expect(((await r.json()) as { error: string }).error).toBe("invalid_code");
    }
    const fifth = await post("/auth/web/code/verify", { email: EMAIL, code: wrong });
    expect(fifth.status).toBe(429);
    expect(((await fifth.json()) as { error: string }).error).toBe("too_many_attempts");
    const burnt = await post("/auth/web/code/verify", { email: EMAIL, code });
    expect(((await burnt.json()) as { error: string }).error).toBe("code_expired");
  });

  it("validates the code shape before loginbase sees it", async () => {
    const r = await post("/auth/web/code/verify", { email: EMAIL, code: "12" });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe("invalid_code");
  });

  it("refreshes with the cookie only, rotates it, and clears it after logout", async () => {
    const { body, cookie } = await signIn();
    const noCookie = await post("/auth/web/refresh", {});
    expect(noCookie.status).toBe(204);

    const refreshed = await call("/auth/web/refresh", { method: "POST", headers: { Cookie: cookie } });
    expect(refreshed.status).toBe(200);
    const next = (await refreshed.json()) as { accessToken: string; expiresIn: number };
    expect(next.accessToken.split(".")).toHaveLength(3);
    expect(next.accessToken).not.toBe(body.accessToken);
    const rotated = cookieOf(refreshed)!;
    expect(rotated).toMatch(/^rs_session=/);
    expect(rotated).not.toBe(cookie);

    const me = await call("/api/me", { headers: { Authorization: `Bearer ${next.accessToken}` } });
    expect(me.status).toBe(200);
    expect(((await me.json()) as { user: { email: string; plan: string } }).user).toMatchObject({ email: EMAIL, plan: "free" });

    const out = await call("/auth/web/logout", { method: "POST", headers: { Cookie: rotated, Authorization: `Bearer ${next.accessToken}` } });
    expect(out.status).toBe(204);
    expect(out.headers.get("Set-Cookie")).toMatch(/^rs_session=;.*Max-Age=0/);
    const after = await call("/auth/web/refresh", { method: "POST", headers: { Cookie: rotated } });
    expect(after.status).toBe(401);
    expect(((await after.json()) as { error: string }).error).toBe("invalid_refresh_token");
  });
});

describe("refresh token reuse (loginbase rotation)", () => {
  it("rescues a lost-response retry once, then revokes the family on a true reuse", async () => {
    const { cookie: a } = await signIn();
    const r1 = await call("/auth/web/refresh", { method: "POST", headers: { Cookie: a } });
    expect(r1.status).toBe(200);
    const b = cookieOf(r1)!;
    const r2 = await call("/auth/web/refresh", { method: "POST", headers: { Cookie: b } });
    expect(r2.status).toBe(200);
    const c = cookieOf(r2)!;
    // a's successor b has been used: this is theft, the whole family dies.
    const reuse = await call("/auth/web/refresh", { method: "POST", headers: { Cookie: a } });
    expect(reuse.status).toBe(401);
    expect(await reuse.json()).toMatchObject({ error: "invalid_refresh_token", reason: "session_revoked" });
    expect(reuse.headers.get("Set-Cookie")).toMatch(/^rs_session=;/);
    const dead = await call("/auth/web/refresh", { method: "POST", headers: { Cookie: c } });
    expect(dead.status).toBe(401);
  });

  it("rescues an honest retry whose successor was never used", async () => {
    const { cookie: a } = await signIn();
    const r1 = await call("/auth/web/refresh", { method: "POST", headers: { Cookie: a } });
    expect(r1.status).toBe(200);
    const retry = await call("/auth/web/refresh", { method: "POST", headers: { Cookie: a } });
    expect(retry.status).toBe(200);
    expect(cookieOf(retry)).not.toBe(cookieOf(r1));
  });
});

describe("requireUser on /api/me", () => {
  it("401 unauthorized without a token and invalid_token for a bad one", async () => {
    const none = await call("/api/me");
    expect(none.status).toBe(401);
    expect(((await none.json()) as { error: string }).error).toBe("unauthorized");
    const bad = await call("/api/me", { headers: { Authorization: "Bearer x.y.z" } });
    expect(bad.status).toBe(401);
    expect(((await bad.json()) as { error: string }).error).toBe("invalid_token");
  });

  it("the raw loginbase Bearer endpoints keep working beside the web layer", async () => {
    const { body } = await signIn();
    const revoked = await call("/auth/sessions", { method: "DELETE", headers: { Authorization: `Bearer ${body.accessToken}` } });
    expect(revoked.status).toBe(204);
  });
});

describe("guards", () => {
  it("rejects a cookie route without an Origin and with a foreign Origin", async () => {
    const missing = await call("/auth/web/code/send", { method: "POST", body: JSON.stringify({ email: EMAIL }), headers: { "Content-Type": "application/json", Origin: "" } });
    expect(missing.status).toBe(403);
    const foreign = await post("/auth/web/code/send", { email: EMAIL }, { headers: { Origin: "https://evil.example" } });
    expect(foreign.status).toBe(403);
    expect(((await foreign.json()) as { error: string }).error).toBe("forbidden_origin");
    const api = await post("/api/me", {}, { headers: { Origin: "https://evil.example" } });
    expect(api.status).toBe(403);
  });

  it("answers 429 too_many_requests when the edge limiter denies", async () => {
    const deny = { limit: async () => ({ success: false }) };
    const r = await post("/auth/web/code/send", { email: EMAIL }, {}, { AUTH_RATE_LIMITER: deny });
    expect(r.status).toBe(429);
    expect(r.headers.get("Retry-After")).toBe("60");
    expect(await r.json()).toMatchObject({ error: "too_many_requests", retryAfterSeconds: 60 });
    const direct = await post("/auth/code/send", { email: EMAIL }, {}, { AUTH_RATE_LIMITER: deny });
    expect(direct.status).toBe(429);
  });

  it("CORS: only the app origin gets Access-Control headers", async () => {
    const ok = await call("/api/health", { headers: { Origin: ORIGIN } });
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    const other = await call("/api/health", { headers: { Origin: "https://evil.example" } });
    expect(other.headers.get("Access-Control-Allow-Origin")).toBeNull();
    const preflight = await call("/api/me", { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("every response carries a request id, the security headers and no-store", async () => {
    const r = await call("/api/me");
    expect(r.headers.get("X-Request-Id")).toMatch(/.+/);
    expect(r.headers.get("Strict-Transport-Security")).toContain("max-age=");
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("GitHub OAuth web wrapper", () => {
  it("start redirects through loginbase to GitHub with the web done URL", async () => {
    const start = await call("/auth/web/github/start", { redirect: "manual" });
    expect(start.status).toBe(302);
    const inner = start.headers.get("Location")!;
    expect(inner).toContain("/auth/oauth/github/start?redirect=");
    const hop = await call(new URL(inner).pathname + new URL(inner).search, { redirect: "manual" });
    expect(hop.status).toBe(302);
    const github = new URL(hop.headers.get("Location")!);
    expect(github.origin).toBe("https://github.com");
    expect(github.searchParams.get("client_id")).toBe("test-client-id");
    expect(github.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/auth/oauth/github/callback`);
  });

  it("done without a valid otc goes back to sign-in with the error code", async () => {
    const denied = await call("/auth/web/github/done?error=access_denied", { redirect: "manual" });
    expect(denied.headers.get("Location")).toBe("/sign-in?error=access_denied");
    const bad = await call("/auth/web/github/done?otc=nope", { redirect: "manual" });
    expect(bad.headers.get("Location")).toBe("/sign-in?error=invalid_otc");
  });

  it("is a 404 not_configured without the GitHub secrets", async () => {
    const r = await call("/auth/web/github/start", { redirect: "manual" }, { GITHUB_OAUTH_CLIENT_ID: "", GITHUB_OAUTH_CLIENT_SECRET: "" });
    expect(r.status).toBe(404);
    expect(((await r.json()) as { error: string }).error).toBe("not_configured");
  });
});
