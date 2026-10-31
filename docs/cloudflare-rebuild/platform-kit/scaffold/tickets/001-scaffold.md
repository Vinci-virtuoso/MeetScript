---
id: 001
title: Scaffold {{product}} on Astro 7 SSR and Hono on Workers
status: draft
deps: []
verify: "npm run verify"
budget: 8
scope_out: [".spec/design/*"]
realizes: [FR-SCAF-1, FR-SCAF-2, FR-SCAF-3]
screens: []
skills: [scaffold]
---

> **Historical reference only — not an active MeetScript task.** The top-level PRD, architecture, DESIGN and CODEX-HANDOFF plus platform-kit/README.md override this recipe. Do not implement inherited billing/paid-plan behavior, meeting scheduling or factory-only dependencies. Adapt useful contracts; this snapshot is not a runnable application.

# 001 - Scaffold {{product}} on Astro 7 SSR and Hono on Workers

## Context
The platform skeleton for {{product}}: Astro 7 SSR with the Cloudflare adapter, Hono in front of the pages through `src/fetch.ts`, wrangler 4 with the local config and the `preview` and `production` envs, the verify harness (Vitest with the Cloudflare plugin, Playwright with axe), one JSON log line per request, `/healthz` with a D1 round trip, and the vendored agent skills copied into `.claude/skills/`. Follow the scaffold skill (Platform section of your prompt): copy its reference files, rename `rent-split` and `rent-split-kit` to {{product}}, and keep every pinned version. Realizes FR-SCAF-1, FR-SCAF-2 and FR-SCAF-3; architecture section Stack and Verify harness.

## Acceptance criteria (Gherkin)
- **Given** a clean checkout with Node 22 **when** `npm run verify` runs **then** types, the unit and worker tests, the build, the local migrations, the Playwright suite and `npm audit --omit=dev` pass.
- **Given** the Worker runs locally **when** a client requests `GET /healthz` **then** the status is 200 and the body has `status: ok` and `checks.db: ok`.
- **Given** any request **when** the Worker answers **then** the response carries `X-Request-Id` and the log has one JSON line with `rid`, `method`, `path`, `status` and `ms`.
- **Given** `package.json` **when** the factory reads it **then** every dependency is an exact version and the `verify` script exists.
- **Given** the repo **when** the factory lists `.claude/skills/` **then** `shadcn`, `migrate-radix-to-base`, `better-ui`, `better-typography`, `better-colors`, `better-accessibility`, `better-layout`, `better-writing`, `better-interface`, `interface-review`, `state-machine` and `break` are there, copied from the vendored folders.
- **Given** the approved design **when** the ticket is done **then** `{{tokens_path}}` is a byte copy of `.spec/design/tokens.css` and `src/layouts/Base.astro` loads it first on every page.

## Implementation notes
- Worker names: `{{product}}` for production, `{{product}}-preview` for preview. Create the D1 databases and KV namespaces with wrangler and put the ids in `wrangler.jsonc`. Analytics Engine dataset `{{product}}_events` with underscores. Pick Rate Limiting namespace ids no other Worker on the account uses.
- Remove the `MAILYSEND` service binding and the `BACHS_*` and `DEV_MAIL_PEEK` vars unless the email or payments skill is selected.
- `.dev.vars` is written by `scripts/write-dev-vars.mjs` and is never committed.
- Tests for this ticket: `tests/worker/health.test.js` and `tests/worker/log.test.js` from the reference.

## Evidence
The verify output in the ticket log is the proof. No screenshots: this ticket has no screens.
