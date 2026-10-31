// Google sign-in for the web (auth skill version 3; a factory addition, not yet proven in a kit run).
// loginbase 3.1 has no Google provider, so these two routes do the OpenID Connect part themselves:
// the authorization code flow with PKCE, a state value and a nonce in a short-lived HttpOnly
// cookie, the code exchanged on the server, and the ID token verified against Google's keys
// (signature, iss, aud, exp, nonce) with email_verified required. Then the user is signed in
// exactly like an email code: `verifiedUser` (the onVerified logic, linking by verified email),
// loginbase's createSession and signAccessToken, and the session cookie from web.ts (the same one
// the GitHub `done` route sets).
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { createSession, signAccessToken } from "loginbase";
import { clientIp } from "../client-ip.js";
import { ApiError } from "../http.js";
import { log } from "../log.js";
// Two one-line changes in the kit files go with it (auth skill recipe): `verifiedUser` exported from
// login.ts with the body of onVerified, and `setSessionCookie` exported from web.ts.
import { ACCESS_TTL_SECONDS, REFRESH_TTL_MS, appOrigin, verifiedUser } from "./login.js";
import { setSessionCookie } from "./web.js";

export const WEB_GOOGLE_START_PATH = "/auth/web/google/start";
export const WEB_GOOGLE_DONE_PATH = "/auth/web/google/done";
const GOOGLE_AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
/** Google signs ID tokens with either form of the issuer. */
export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
// __Host-: Secure, Path=/ and no Domain, so a sibling *.workers.dev Worker cannot plant the value.
const FLOW_COOKIE = "__Host-rs_google";
const FLOW_TTL_SECONDS = 600;
const ERROR_CODE = /^[a-z_]{1,64}$/;

/** The exact redirect URI the Google OAuth client must list: https://<origin>/auth/web/google/done. */
export function googleRedirectUri(env: Env): string {
  return `${appOrigin(env)}${WEB_GOOGLE_DONE_PATH}`;
}

export function googleConfigured(env: Env): boolean {
  return Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);
}

// Module scope: the key set is fetched once per isolate and refreshed by jose when Google rotates keys.
const googleKeys = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

interface Flow {
  state: string;
  verifier: string;
  nonce: string;
  next: string;
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomValue(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function pkceChallenge(verifier: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
}

function sameValue(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Only a same-site path: `/x`, never `//host` or `/\host`. */
export function safeNext(value: string | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/app";
}

function readFlow(raw: string | undefined): Flow | null {
  if (!raw) return null;
  try {
    const flow = JSON.parse(atob(raw.replace(/-/g, "+").replace(/_/g, "/"))) as Partial<Flow>;
    if (typeof flow.state !== "string" || typeof flow.verifier !== "string" || typeof flow.nonce !== "string") return null;
    return { state: flow.state, verifier: flow.verifier, nonce: flow.nonce, next: safeNext(flow.next) };
  } catch {
    return null;
  }
}

function clearFlow(c: Context): void {
  deleteCookie(c, FLOW_COOKIE, { path: "/", secure: true, httpOnly: true, sameSite: "Lax" });
}

/**
 * Verify a Google ID token: the RS256 signature against Google's JWKS, `iss` in either Google form,
 * `aud` = the client id, `exp` (and `iat`) with jose's clock check, the `nonce` of this flow, and
 * `email_verified`. Throws ApiError with `oauth_failed` or `oauth_no_email`.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  opts: { clientId: string; nonce: string; keys?: JWTVerifyGetKey },
): Promise<{ sub: string; email: string }> {
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(idToken, opts.keys ?? googleKeys, {
      issuer: GOOGLE_ISSUERS,
      audience: opts.clientId,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "exp", "iat", "nonce"],
    }));
  } catch {
    throw new ApiError(400, "oauth_failed", "The Google sign-in could not be verified.");
  }
  if (typeof payload.nonce !== "string" || !sameValue(payload.nonce, opts.nonce)) {
    throw new ApiError(400, "oauth_failed", "The Google sign-in could not be verified.");
  }
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email || !(payload.email_verified === true || payload.email_verified === "true")) {
    throw new ApiError(400, "oauth_no_email", "Google shared no verified email.");
  }
  return { sub: String(payload.sub), email };
}

/** createSession + signAccessToken for a user, as loginbase's own OAuth callback issues them. */
export async function issueSession(env: Env, userId: string, meta: { userAgent?: string; ip?: string }) {
  if (!env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
  const { sessionId, refreshToken } = await createSession(env.DB, {
    userId,
    userAgent: meta.userAgent,
    ip: meta.ip,
    expiresAt: Date.now() + REFRESH_TTL_MS,
  });
  const accessToken = await signAccessToken(env.JWT_SECRET, userId, sessionId, ACCESS_TTL_SECONDS);
  return { sessionId, refreshToken, accessToken };
}

export const authGoogleRoutes = new Hono<{ Bindings: Env }>();

authGoogleRoutes.get(WEB_GOOGLE_START_PATH, async (c) => {
  if (!googleConfigured(c.env)) throw new ApiError(404, "not_configured", "Google sign-in is not set up.");
  const flow: Flow = { state: randomValue(), verifier: randomValue(48), nonce: randomValue(), next: safeNext(c.req.query("next")) };
  setCookie(c, FLOW_COOKIE, base64url(new TextEncoder().encode(JSON.stringify(flow))), {
    httpOnly: true,
    secure: true,
    // Lax, not Strict: the cookie must come back on the top-level redirect from accounts.google.com.
    sameSite: "Lax",
    path: "/",
    maxAge: FLOW_TTL_SECONDS,
  });
  const url = new URL(GOOGLE_AUTHORIZE);
  url.searchParams.set("client_id", c.env.GOOGLE_OAUTH_CLIENT_ID!);
  url.searchParams.set("redirect_uri", googleRedirectUri(c.env));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("state", flow.state);
  url.searchParams.set("nonce", flow.nonce);
  url.searchParams.set("code_challenge", await pkceChallenge(flow.verifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return c.redirect(url.toString(), 302);
});

authGoogleRoutes.get(WEB_GOOGLE_DONE_PATH, async (c) => {
  const failed = (code: string) =>
    c.redirect(`/sign-in?provider=google&error=${ERROR_CODE.test(code) ? code : "oauth_failed"}`, 302);
  const flow = readFlow(getCookie(c, FLOW_COOKIE));
  clearFlow(c); // single use, whatever happens next
  if (!googleConfigured(c.env)) return failed("not_configured");
  const state = c.req.query("state") ?? "";
  if (!flow || !state || !sameValue(state, flow.state)) return failed("invalid_state");
  const code = c.req.query("code");
  const error = c.req.query("error");
  if (!code) return failed(error === "access_denied" ? "access_denied" : "oauth_failed");

  // The code exchange is server to server: the client secret and the PKCE verifier never reach the page.
  const tokenResponse = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: c.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(c.env),
      grant_type: "authorization_code",
      code_verifier: flow.verifier,
    }),
  }).catch(() => null);
  const tokens = tokenResponse?.ok ? ((await tokenResponse.json().catch(() => null)) as { id_token?: string } | null) : null;
  if (!tokens?.id_token) return failed("oauth_failed");

  let identity: { sub: string; email: string };
  try {
    identity = await verifyGoogleIdToken(tokens.id_token, { clientId: c.env.GOOGLE_OAUTH_CLIENT_ID!, nonce: flow.nonce });
  } catch (err) {
    const reason = err instanceof ApiError ? err.code : "oauth_failed";
    log("warn", "auth_event", { event: "oauth_callback", provider: "google", outcome: reason });
    return failed(reason);
  }

  const verified = await verifiedUser(c.env, { email: identity.email, provider: "google", providerUserId: identity.sub });
  // The access token is not put in the redirect (never in a URL): the page gets its own from
  // POST /auth/web/refresh with the cookie, exactly as after the GitHub `done` route.
  const { refreshToken } = await issueSession(c.env, verified.userId, {
    userAgent: c.req.header("User-Agent") ?? undefined,
    ip: clientIp(c.req.raw, c.env),
  });
  setSessionCookie(c, refreshToken);
  log("info", "auth_event", { event: "login", provider: "google", outcome: "ok", isNewUser: verified.isNewUser });
  return c.redirect(flow.next, 302);
});
