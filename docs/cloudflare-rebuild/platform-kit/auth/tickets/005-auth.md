---
id: 005
title: Sign-in for {{product}}: loginbase at /auth with the web cookie layer and Google
status: draft
deps: [002, 003]
verify: "npx vitest run --project worker tests/worker/auth.test.ts tests/worker/google.test.ts"
budget: 8
scope_out: [".spec/design/*", "{{tokens_path}}", "migrations/*", "src/components/*", "src/pages/*"]
realizes: [FR-AUTH-1, FR-AUTH-2, FR-AUTH-3, FR-AUTH-4, FR-AUTH-5, FR-AUTH-6]
screens: []
skills: [auth]
---

> **Historical reference only — not an active MeetScript task.** The top-level PRD, architecture, DESIGN and CODEX-HANDOFF plus platform-kit/README.md override this recipe. Do not implement inherited billing/paid-plan behavior, meeting scheduling or factory-only dependencies. Adapt useful contracts; this snapshot is not a runnable application.

# 005 - Sign-in for {{product}}: loginbase at /auth with the web cookie layer and Google

## Context
The server side of sign-in for {{product}}: loginbase 3.x mounted at `/auth` (email code, GitHub, access JWT, rotating refresh token, `verifiedUser` creating the `users` row), Google sign-in at `/auth/web/google/*` (the OpenID Connect code flow with PKCE, the ID token verified against Google's keys, then loginbase's `createSession` and `signAccessToken`), the web cookie layer `/auth/web/*` (HttpOnly Secure SameSite=Lax cookie scoped to `/auth/web`, access token in page memory), `requireUser()`, the auth rate limit, `GET /api/me`, and the browser client `src/lib/auth-client.ts`. Follow the auth skill (Platform section of your prompt). The screens come in the next ticket. Realizes FR-AUTH-1 to FR-AUTH-6 on the API; architecture section Security.

## Acceptance criteria (Gherkin)
- **Given** a valid email **when** `POST /auth/web/code/send` is called **then** the answer is 200 with `cooldownSeconds`, a code is handed to the email provider, and an invalid email answers 400 `invalid_email`.
- **Given** a sent code **when** `POST /auth/web/code/verify` is called with it **then** the answer is 200 with `accessToken` and `user`, `Set-Cookie` carries `HttpOnly; Secure; SameSite=Lax; Path=/auth/web`, and the body has no refresh token.
- **Given** the session cookie **when** `POST /auth/web/refresh` is called **then** the answer is 200 with a new access token and a rotated cookie; with no cookie the answer is 204; a replayed old token after its successor was used revokes the session family.
- **Given** a signed-in session **when** `POST /auth/web/logout` is called **then** the answer is 204, the cookie is cleared and the next refresh answers 204.
- **Given** `GET /api/me` **when** called without a Bearer token **then** the answer is 401 with the error envelope; with a valid token it returns the public user.
- **Given** the GitHub client id and secret are not set **when** `GET /auth/web/github/start` is called **then** the answer is 404 `not_configured`; when they are set it redirects to loginbase's GitHub start with the app's `done` URL.
- **Given** the Google client id and secret are set **when** `GET /auth/web/google/start` is called **then** the answer is 302 to Google's authorization endpoint with `code_challenge_method=S256`, a `state`, a `nonce` and `redirect_uri` = `<origin>/auth/web/google/done`, and an HttpOnly, Secure, SameSite=Lax flow cookie is set; without them the answer is 404 `not_configured`.
- **Given** a started Google flow **when** `GET /auth/web/google/done` returns with the right state and Google's token endpoint answers an ID token signed by a key in the JWKS with the right issuer, audience, expiry and nonce and `email_verified: true` **then** the session cookie is set like after an email code and the answer redirects to `next`; an existing user with the same verified email is signed in, not created again.
- **Given** a Google ID token with a wrong nonce, audience, issuer or key, an expired one, or `email_verified: false`, or a forged state or a missing flow cookie **when** `done` is called **then** it redirects to `/sign-in?provider=google&error=<code>` and no session is made.

## Implementation notes
- `npm install loginbase@3.1.0 @whlong/eventbase@0.15.0 jose@6.2.13` (exact). The migrations are already in `migrations/` from ticket 002.
- Copy `src/server/auth/login.ts`, `web.ts`, `require-user.ts`, `rate-limit.ts`, `src/server/client-ip.ts`, `src/schemas/auth.ts`, `src/lib/auth-client.ts` and `src/server/routes/me.ts` from the reference, and `src/server/auth/google.ts` from the additions, with the two version 3 changes the recipe names (`verifiedUser` in `login.ts`, `setSessionCookie` exported from `web.ts`). Cookie names `{{product}}_session` and `__Host-{{product}}_google`. Brand and `EMAIL_FROM` fallback: {{product}}.
- Mount in `src/server/app.ts` as the skill says (`authGoogleRoutes` after `authWebRoutes`). Add `JWT_SECRET`, `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` to `scripts/write-dev-vars.mjs` and `src/env.d.ts` if ticket 001 did not.
- Until the email skill is selected, `createEmailProvider` is the dev transport that logs the code.
- `tests/worker/auth.test.ts` from the reference, each test with its own email and `CF-Connecting-IP`.
- `tests/worker/google.test.ts` from the additions: a key pair made in the test and a `fetch` stub for Google's token and key endpoints, so no test calls Google.

## Evidence
The vitest output in the ticket log is the proof. No screenshots: this ticket has no screens.
