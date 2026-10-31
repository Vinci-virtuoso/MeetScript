---
name: email
version: 1
needs: [scaffold, auth]
secrets: [MAILYSEND_API_KEY]
optional_secrets: [RESEND_API_KEY]
bindings: [MAILYSEND]
screens: []
tickets: [010-email]
---

> **Historical reference only — not an active MeetScript task.** The top-level PRD, architecture, DESIGN and CODEX-HANDOFF plus platform-kit/README.md override this recipe. Do not implement inherited billing/paid-plan behavior, meeting scheduling or factory-only dependencies. Adapt useful contracts; this snapshot is not a runnable application.

# Platform skill: email

Transactional email through one seam: the live `sei-mailysend` Worker first, Resend as the fallback, the log in dev.

## Decision

- `src/email/provider.ts` is the `EmailProvider` port (`send(message)`); app code never calls a mail API directly.
- Primary adapter: Mailysend (`src/email/mailysend.ts`), the Resend-compatible API of the account's live Worker `sei-mailysend` (`https://sei-mailysend.tropos.workers.dev`), reached through the `MAILYSEND` service binding (Worker to Worker) with an HTTPS fallback to `MAILYSEND_API_URL`. One `sending_access` key per product.
- Fallback adapter: Resend (`src/email/resend.ts`), same wire format (`POST /v1/emails`, Bearer key, `Idempotency-Key` honoured for 24 hours). Used when `RESEND_API_KEY` is set and Mailysend is not.
- Dev transport (`src/email/dev.ts`): writes one log line per message and keeps the last 20 in memory; `GET /api/dev/mail?to=` reads them back when the var `DEV_MAIL_PEEK` is `1`, which only the local config sets.
- `createEmailProvider(env)` picks the transport from the env: Mailysend when `MAILYSEND_API_KEY` and a valid https `MAILYSEND_API_URL` are set, else Resend when `RESEND_API_KEY` is set, else dev.
- Messages: the login code (loginbase's `email.send` hook, through this seam), receipts and plan changes (payments), each with a stable `idempotencyKey` where a retry must not send twice. The login code has none: a new code every time.
- `EMAIL_FROM` is a var per env (`Name <address>` on the sending domain of the Mailysend instance). Mailysend and Resend are approved external services.

## Recipe

1. `src/email/provider.ts`, `index.ts`, `mailysend.ts`, `resend.ts`, `dev.ts`, `index.test.ts`, `mailysend.test.ts` from `reference/`. Change the default from address in `parseFrom` to the product's.
2. `src/server/routes/dev.ts` (the dev mail peek) with `// @public local dev mail peek, gated by DEV_MAIL_PEEK` above the route; mount it in `app.ts`.
3. `wrangler.jsonc`: `EMAIL_FROM` and `MAILYSEND_API_URL` vars in each env, the `services: [{ binding: "MAILYSEND", service: "sei-mailysend" }]` binding in `env.preview` and `env.production` only, `DEV_MAIL_PEEK: "1"` in the top level config only.
4. `MAILYSEND_API_KEY` (and `RESEND_API_KEY` when used) in `scripts/write-dev-vars.mjs` and `src/env.d.ts`; `MAILYSEND?: Fetcher` in `Env`.
5. Wire loginbase: `email.send` in `src/server/auth/login.ts` calls `createEmailProvider(env).send(...)` (the auth reference already does).
6. Before the first deploy, ask Vinci for a `sending_access` key for the product on `sei-mailysend` and set it with `wrangler secret put MAILYSEND_API_KEY`. Until then the deployed Worker runs the dev transport and a visitor never receives a code; the deploy report must say so.

## Contract

- `createEmailProvider(env): EmailProvider`; `emailTransport(env): "mailysend" | "resend" | "dev"`; `parseFrom(value)`.
- `EmailProvider.send({ to, subject, html, text, idempotencyKey? })` resolves on success and throws on a non-2xx with the status and the first 500 characters of the body.
- Only `src/email/` reads `MAILYSEND_API_KEY`, `RESEND_API_KEY` and calls `api.resend.com` or the Mailysend endpoint.
- `GET /api/dev/mail?to=<email>` answers `{ messages: [{ to, subject, text, at }] }` locally and 404 `not_found` in every deploy env.

## Platform FRs

- **FR-MAIL-1 One seam.** Given any message the product sends, when the code sends it, then it goes through `createEmailProvider(env).send` and the transport is chosen from the env, never hard coded.
- **FR-MAIL-2 Idempotent notifications.** Given a notification with an idempotency key, when the send is retried within 24 hours, then the provider delivers it once.
- **FR-MAIL-3 Local mail peek.** Given the local config, when a code is sent, then `GET /api/dev/mail?to=` returns it; given a deploy env, when the same route is called, then the answer is 404.

## Pitfalls

- Put the `MAILYSEND` service binding in the deploy envs only, because a binding to a Worker that is not running locally makes `wrangler dev` answer 503 for every call to it; locally the adapter falls back to HTTPS or the dev transport.
- Gate `/api/dev/mail` with `DEV_MAIL_PEEK` set only in the top level config, because the deploy envs must never expose login codes.
- Normalize `MAILYSEND_API_URL` and refuse anything that is not plain https, because the API key is sent to that host.
- Send `Idempotency-Key` for receipts and plan changes and never for login codes, because a retried receipt must not arrive twice and a code must be new every time.
- Change `EMAIL_FROM` to an address on the Mailysend sending domain before the key is set, because a foreign from address is refused.
- Log the recipient, the subject and the first text line only, because a log line must never carry the html or the whole body.
