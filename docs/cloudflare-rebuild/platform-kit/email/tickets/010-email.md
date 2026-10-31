---
id: 010
title: Email seam for {{product}}: Mailysend, Resend fallback, dev transport
status: draft
deps: [005]
verify: "npx vitest run src/email/index.test.ts src/email/mailysend.test.ts"
budget: 8
scope_out: [".spec/design/*", "{{tokens_path}}", "migrations/*", "src/db/*", "src/components/*", "src/pages/*"]
realizes: [FR-MAIL-1, FR-MAIL-2, FR-MAIL-3]
screens: []
skills: [email]
---

> **Historical reference only — not an active MeetScript task.** The top-level PRD, architecture, DESIGN and CODEX-HANDOFF plus platform-kit/README.md override this recipe. Do not implement inherited billing/paid-plan behavior, meeting scheduling or factory-only dependencies. Adapt useful contracts; this snapshot is not a runnable application.

# 010 - Email seam for {{product}}: Mailysend, Resend fallback, dev transport

## Context
Transactional email for {{product}} through one seam: the `EmailProvider` port, the Mailysend adapter (the live `sei-mailysend` Worker through the `MAILYSEND` service binding, HTTPS fallback), the Resend adapter as the fallback, the dev transport with the local mail peek, and the transport choice from the env. loginbase's login code goes through it. Follow the email skill (Platform section of your prompt). Realizes FR-MAIL-1 to FR-MAIL-3; architecture sections Boundaries and contracts and Failure handling.

## Acceptance criteria (Gherkin)
- **Given** `MAILYSEND_API_KEY` and an https `MAILYSEND_API_URL` **when** `createEmailProvider(env)` runs **then** the Mailysend adapter is chosen and it posts to `<url>/v1/emails` with the Bearer key and the `Idempotency-Key` when the message has one; given only `RESEND_API_KEY` the Resend adapter is chosen; given neither, the dev transport.
- **Given** the dev transport **when** a login code is sent locally **then** `GET /api/dev/mail?to=<email>` returns it; given a deploy env, the same route answers 404.
- **Given** a non-2xx answer from the provider **when** `send` runs **then** it throws with the status and the first 500 characters of the body, and the caller's error path shows the code was not sent.
- **Given** `src/` **when** the factory greps it **then** only `src/email/` reads the mail keys and calls the mail APIs.

## Implementation notes
- Copy `src/email/*` and `src/server/routes/dev.ts` from the reference; default from address for {{product}}. Mount `devRoutes` with `// @public local dev mail peek, gated by DEV_MAIL_PEEK`.
- `wrangler.jsonc`: `EMAIL_FROM` and `MAILYSEND_API_URL` in every env, the `MAILYSEND` service binding in `env.preview` and `env.production` only, `DEV_MAIL_PEEK: "1"` at the top level only. `MAILYSEND_API_KEY` in `scripts/write-dev-vars.mjs` and `src/env.d.ts`.
- `src/server/auth/login.ts` sends the code through `createEmailProvider(env)`.

## Evidence
The vitest output in the ticket log is the proof. No screenshots: this ticket has no screens.
