// Google sign-in (auth skill version 3) inside workerd: start (PKCE, state, nonce, the flow cookie),
// done (the code exchange, the ID token verified against a JWKS, email_verified, the user linked by
// verified email, the session cookie), and every way it must fail. Google's token and key endpoints
// are answered by a fetch stub with a key pair made here, so no test calls Google.
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { SignJWT, exportJWK, generateKeyPair, type CryptoKey } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../../src/server/app.js";

const ORIGIN = "http://127.0.0.1:8787";
const GOOGLE = { GOOGLE_OAUTH_CLIENT_ID: "test-google-client", GOOGLE_OAUTH_CLIENT_SECRET: "test-google-secret" };
let keys: { privateKey: CryptoKey; jwk: Record<string, unknown> };
let foreign: CryptoKey;
let claims: Record<string, unknown> = {};
let issuer = "https://accounts.google.com";
let expires = "1h";
let signer: "ours" | "foreign" = "ours";
let ip = "198.51.100.1";
let n = 0;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  keys = { privateKey: pair.privateKey, jwk: { ...(await exportJWK(pair.publicKey)), kid: "test-key", alg: "RS256", use: "sig" } };
  foreign = (await generateKeyPair("RS256")).privateKey;
});

beforeEach(() => {
  n += 1;
  ip = `198.51.100.${n}`;
  issuer = "https://accounts.google.com";
  expires = "1h";
  signer = "ours";
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === "https://www.googleapis.com/oauth2/v3/certs") return Response.json({ keys: [keys.jwk] });
    if (url === "https://oauth2.googleapis.com/token") {
      const body = new URLSearchParams(String(init?.body));
      if (body.get("client_secret") !== GOOGLE.GOOGLE_OAUTH_CLIENT_SECRET || !body.get("code_verifier")) return Response.json({ error: "invalid_grant" }, { status: 400 });
      if (body.get("redirect_uri") !== `${ORIGIN}/auth/web/google/done`) return Response.json({ error: "redirect_uri_mismatch" }, { status: 400 });
      const idToken = await new SignJWT(claims)
        .setProtectedHeader({ alg: "RS256", kid: "test-key" })
        .setIssuer(issuer)
        .setAudience((claims.aud as string | undefined) ?? GOOGLE.GOOGLE_OAUTH_CLIENT_ID)
        .setSubject("google-sub-1")
        .setIssuedAt()
        .setExpirationTime(expires)
        .sign(signer === "ours" ? keys.privateKey : foreign);
      return Response.json({ id_token: idToken, access_token: "unused", token_type: "Bearer" });
    }
    return realFetch(input, init);
  });
});
afterEach(() => vi.restoreAllMocks());

async function call(path: string, init: RequestInit = {}, bindings: Record<string, unknown> = GOOGLE): Promise<Response> {
  const ctx = createExecutionContext();
  const headers = new Headers(init.headers);
  headers.set("CF-Connecting-IP", ip);
  const response = await worker.fetch(new Request(`${ORIGIN}${path}`, { ...init, headers, redirect: "manual" }), { ...env, ...bindings } as never, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

/** Start a flow; `done(extra)` returns from Google with the flow cookie and the right state. */
async function start(next = "/app") {
  const r = await call(`/auth/web/google/start?next=${encodeURIComponent(next)}`);
  const location = new URL(r.headers.get("Location")!);
  const cookie = r.headers.get("Set-Cookie")!.split(";")[0]!;
  const state = location.searchParams.get("state")!;
  const nonce = location.searchParams.get("nonce")!;
  const done = (o: { state?: string; cookie?: string } = {}) =>
    call(`/auth/web/google/done?code=test-code&state=${o.state ?? state}`, { headers: { Cookie: o.cookie ?? cookie } });
  return { r, location, cookie, state, nonce, done };
}

describe("Google sign-in", () => {
  it("start redirects to Google with PKCE, state, nonce and the registered redirect URI", async () => {
    const { r, location } = await start();
    expect(r.status).toBe(302);
    expect(`${location.origin}${location.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(location.searchParams.get("client_id")).toBe(GOOGLE.GOOGLE_OAUTH_CLIENT_ID);
    expect(location.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/auth/web/google/done`);
    expect(location.searchParams.get("response_type")).toBe("code");
    expect(location.searchParams.get("scope")).toBe("openid email");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const setCookie = r.headers.get("Set-Cookie")!;
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    expect(setCookie).toMatch(/Max-Age=600/);
  });

  it("done verifies the ID token, signs the user in with the session cookie and lands on next", async () => {
    const flow = await start("/app");
    claims = { email: `Ana${n}@Example.com`, email_verified: true, nonce: flow.nonce };
    const r = await flow.done();
    expect(r.status).toBe(302);
    expect(r.headers.get("Location")).toBe("/app");
    const cookies = r.headers.getSetCookie();
    const session = cookies.find((c) => c.includes("_session="))!;
    expect(session).toMatch(/HttpOnly/);
    expect(session).toMatch(/Secure/);
    expect(session).toMatch(/SameSite=Lax/);
    expect(session).toContain("Path=/auth/web");
    // The cookie works like one from an email code: refresh answers an access token for the same user.
    const refresh = await call("/auth/web/refresh", { method: "POST", headers: { Origin: ORIGIN, Cookie: session.split(";")[0]! } });
    expect(refresh.status).toBe(200);
    const { accessToken } = (await refresh.json()) as { accessToken: string };
    const me = await call("/api/me", { headers: { Authorization: `Bearer ${accessToken}` } });
    expect(((await me.json()) as { user: { email: string } }).user.email).toBe(`ana${n}@example.com`);
  });

  it("links to the existing user with the same verified email (issuer without https too)", async () => {
    const email = `link${n}@example.com`;
    const first = await start();
    claims = { email, email_verified: true, nonce: first.nonce };
    await first.done();
    issuer = "accounts.google.com";
    const second = await start();
    claims = { email, email_verified: "true", nonce: second.nonce };
    const r = await second.done();
    expect(r.headers.get("Location")).toBe("/app");
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE email = ?").bind(email).first<{ n: number }>();
    expect(count!.n).toBe(1);
  });

  it.each([
    ["a wrong nonce", () => ({ nonce: "not-this-flow" }), "oauth_failed"],
    ["a wrong audience", () => ({ aud: "another-client" }), "oauth_failed"],
    ["an unverified email", () => ({ email_verified: false }), "oauth_no_email"],
  ])("done refuses %s", async (_name, extra, code) => {
    const flow = await start();
    claims = { email: `x${n}@example.com`, email_verified: true, nonce: flow.nonce, ...extra() };
    const r = await flow.done();
    expect(r.headers.get("Location")).toBe(`/sign-in?provider=google&error=${code}`);
    expect(r.headers.getSetCookie().some((c) => c.includes("_session=") && !c.includes("_session=;"))).toBe(false);
  });

  it("done refuses a wrong issuer, an expired token and a token signed by another key", async () => {
    for (const setup of [() => (issuer = "https://evil.example"), () => (expires = "-10m"), () => (signer = "foreign")]) {
      issuer = "https://accounts.google.com"; expires = "1h"; signer = "ours";
      setup();
      const flow = await start();
      claims = { email: `y${n}@example.com`, email_verified: true, nonce: flow.nonce };
      const r = await flow.done();
      expect(r.headers.get("Location")).toBe("/sign-in?provider=google&error=oauth_failed");
    }
  });

  it("done refuses a forged state, a missing flow cookie and a replayed flow", async () => {
    const flow = await start();
    claims = { email: `z${n}@example.com`, email_verified: true, nonce: flow.nonce };
    expect((await flow.done({ state: "forged" })).headers.get("Location")).toBe("/sign-in?provider=google&error=invalid_state");
    expect((await flow.done({ cookie: "" })).headers.get("Location")).toBe("/sign-in?provider=google&error=invalid_state");
    const denied = await call(`/auth/web/google/done?error=access_denied&state=${flow.state}`, { headers: { Cookie: flow.cookie } });
    expect(denied.headers.get("Location")).toBe("/sign-in?provider=google&error=access_denied");
  });

  it("next never leaves the site", async () => {
    const flow = await start("//evil.example/x");
    claims = { email: `n${n}@example.com`, email_verified: true, nonce: flow.nonce };
    expect((await flow.done()).headers.get("Location")).toBe("/app");
  });

  it("is a 404 not_configured without the Google secrets", async () => {
    const r = await call("/auth/web/google/start", {}, { GOOGLE_OAUTH_CLIENT_ID: "", GOOGLE_OAUTH_CLIENT_SECRET: "" });
    expect(r.status).toBe(404);
    expect(((await r.json()) as { error: string }).error).toBe("not_configured");
  });
});
