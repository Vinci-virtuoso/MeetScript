---
name: scaffold
version: 1
needs: []
secrets: [JWT_SECRET]
bindings: [DB, AUTH_KV, EVENTS, RATE_LIMITER, AUTH_RATE_LIMITER]
screens: []
tickets: [001-scaffold]
---

> **Historical reference only — not an active MeetScript task.** The top-level PRD, architecture, DESIGN and CODEX-HANDOFF plus platform-kit/README.md override this recipe. Do not implement inherited billing/paid-plan behavior, meeting scheduling or factory-only dependencies. Adapt useful contracts; this snapshot is not a runnable application.

# Platform skill: scaffold

The project skeleton every product with users starts from. One stack, no menu. A product that needs another stack raises a `needs-decision` with the reason.

## Decision

- Astro 7 SSR on Cloudflare Workers with the `@astrojs/cloudflare` adapter. Pages are Astro files; interactive parts are React islands.
- Hono answers every `/api/*`, `/auth/*` and `/healthz` request in front of the Astro pages, through Astro's `fetchFile` entry (`src/fetch.ts`).
- Tailwind v4 through its Vite plugin. The design tokens stay in the byte copy of `.spec/design/tokens.css`; Tailwind maps onto them (see the frontend skill).
- TypeScript strict. Node 22. wrangler 4. Every dependency pinned to an exact version (no `^`, no `~`).
- Tests: Vitest with `@cloudflare/vitest-plugin` (a `unit` project under Node and a `worker` project inside workerd), Playwright with axe at 390 px and 1280 px against the production build served by `wrangler dev`.
- `npm run verify` is the one gate: `.dev.vars` written, types, vitest, build, local migrations, Playwright, `npm audit --omit=dev`.
- One JSON log line per request, a request id on every response, `/healthz` with a D1 round trip.
- Two wrangler envs, `preview` and `production`, next to the top level local config. The deploy skill uses them.

## Recipe

Copy from `reference/` (the paths are the same inside the product repo). Replace the product name `rent-split` and the Worker name `rent-split-kit` with `{{product}}` everywhere a reference file names them. Remove the product's own code (the v1 calculator imports from `public/js/`, the splits and billing routes) where a reference file carries it; the platform parts stay.

1. `package.json`: keep the scripts, the pinned versions and the `allowScripts` block. Set `name` to the product. Run `npm install`, then `npm rebuild esbuild workerd`.
2. `astro.config.mjs`, `tsconfig.json`, `tsconfig.web.json`, `vitest.config.ts`, `tests/setup.ts`, `playwright.config.js`, `scripts/write-dev-vars.mjs`, `.gitignore`.
3. `wrangler.jsonc`: top level is the local config (dev and vitest); `env.preview` and `env.production` repeat every non-inheritable key. Set `name` to the product (`<product>` for production, `<product>-preview` for preview). Create the D1 databases and KV namespaces with `wrangler d1 create` and `wrangler kv namespace create` and put the ids in; name the Analytics Engine dataset `<product>_events` with underscores; pick Rate Limiting `namespace_id` values that no other Worker on the account uses. Remove the `MAILYSEND` service binding and the `BACHS_*` and `DEV_MAIL_PEEK` vars unless the email or payments skill is selected (they add them back).
4. `src/fetch.ts`, `src/server/app.ts`, `src/server/http.ts`, `src/server/log.ts`, `src/server/context.ts`, `src/server/middleware/request.ts`, `src/server/routes/health.ts`, `src/env.d.ts`. In `app.ts` keep only the routes this product has; the api and auth skills add theirs.
5. `src/layouts/Base.astro`: loads `/tokens.css` first on every page. Copy `.spec/design/tokens.css` to `{{tokens_path}}` byte for byte and load the fonts the design names.
6. Agent skills: copy the vendored skill folders into `.claude/skills/` so the build agent loads them from the repo. From `vendor/jakubkrehel-skills/skills/`: `better-ui`, `better-typography`, `better-colors`, `better-accessibility`, `better-layout`, `better-writing`, `better-interface`, `interface-review`, `state-machine`, `break`. From `vendor/shadcn-ui-skills/skills/`: `shadcn`, `migrate-radix-to-base`. The absolute paths of the vendored folders are given in the "Platform (binding)" section of the build prompt. Do not run `npx skills add`; the build is offline.
7. `npm run verify` passes with the health and log tests.

Secrets: `JWT_SECRET` (one per env, 32 random bytes base64url). Local values live in `.dev.vars`, written by `scripts/write-dev-vars.mjs`, never committed.

## Contract

- `src/server/app.ts` exports `createApp(options)` and the `AppEnv` type. Every route module exports a `Hono` instance mounted with `app.route("/", routes)`.
- `src/server/http.ts`: `ApiError(status, code, message, fields, headers)`, `jsonResponse`, `errorResponse`, `emptyResponse`, `SECURITY_HEADERS`, `STRICT_CSP`. Every error body is `{ "error": "<snake_case code>", "message": "<one sentence>", ...fields }`.
- `src/server/log.ts`: `log(level, msg, fields)` writes one JSON object per line with `ts`, `level`, `msg` first. Never log bodies, IPs, emails, tokens or amounts.
- `src/server/middleware/request.ts`: sets `X-Request-Id`, the security headers, `Cache-Control: no-store` on JSON routes, and writes the request log line. `c.get("rid")` and `c.get("waitUntil")` are available to every route.
- `src/server/context.ts`: `currentRequest()` and `deferred(promise)` for code with no Hono context (hooks).
- `GET /healthz` answers `{ "status": "ok", "version", "checks": { "db": "ok" } }` with 200, or `degraded` with 503.
- Tests call `app.fetch(request, env, ctx)`; `app.ts` imports nothing from `astro/*`.
- `npm run verify` from the repo root is the verify harness every ticket builds on.

## Platform FRs

Copy these into the PRD's "Platform" FR group when this skill is selected.

- **FR-SCAF-1 Health endpoint.** Given the Worker is deployed, when a client requests `GET /healthz`, then the response is 200 with `status: ok` and `checks.db: ok`, and it is 503 with `degraded` when D1 does not answer.
- **FR-SCAF-2 Request id and log line.** Given any request, when the Worker answers, then the response carries `X-Request-Id` and exactly one JSON log line with `rid`, `method`, `path`, `status` and `ms` is written.
- **FR-SCAF-3 One verify gate.** Given a clean checkout, when `npm run verify` runs, then types, unit and worker tests, the build, the local migrations, the Playwright suite with axe and `npm audit --omit=dev` all pass, or the command fails.

## Pitfalls

- Keep an `allowScripts` block in `package.json` with the exact `esbuild@x` and `workerd@x` versions, and run `npm rebuild esbuild workerd` after a version bump, because npm 11.19 does not run postinstall scripts until they are approved and `wrangler` and `astro build` then fail with a missing binary.
- Use `@cloudflare/vitest-plugin`, not `@cloudflare/vitest-pool-workers`, because the pool is deprecated and frozen at 0.23.0 with an alpha miniflare. Pin vitest to a 4.1.x, because Astro's tooling is tested against it.
- Mount Hono through Astro's `fetchFile` entry (`src/fetch.ts`): your routes first, then `trailingSlash(), redirects(), notFound(), actions(), middleware(), pages()` from `astro/hono`. Do not write Astro middleware for cross-cutting concerns; a Hono middleware before the routes covers pages too.
- Do not put `main` or `assets` in `wrangler.jsonc`, because the adapter writes them into the generated `dist/server/wrangler.json` and the two conflict.
- Repeat every non-inheritable key (`vars`, `d1_databases`, `kv_namespaces`, `analytics_engine_datasets`, `ratelimits`, `services`) inside each env, because wrangler does not merge arrays from the top level into an env.
- Build for an env with `CLOUDFLARE_ENV=production astro build` and deploy with `wrangler deploy -c dist/server/wrangler.json`, because `--env` on `wrangler deploy` has no effect on the generated file.
- Never commit `.dev.vars`; `scripts/write-dev-vars.mjs` writes it from the shell env with placeholders, because astro dev and the Vite plugin read it and wrangler dev reads the copy in `dist/server/`.
- Read bindings from `import { env } from "cloudflare:workers"` and take `waitUntil` from `getFetchState(c).renderOptions.waitUntil`, because Astro calls the fetch entry as `fetch(request)` with no env and no ExecutionContext. The first middleware copies the env into `c.env` when absent, so tests can pass their own.
- Do not use `cf()` from `@astrojs/cloudflare/hono` in `src/fetch.ts`, because the adapter already served static assets and a second lookup with an undefined env throws on every request.
- Set `session: false` in `astro.config.mjs` when the app does not use Astro sessions, because the adapter otherwise injects a `SESSION` KV binding that needs a namespace at deploy time.
- Answer a bare `OPTIONS` with 405 and treat a request as a preflight only when `Access-Control-Request-Method` is present, because a CORS layer that answers every OPTIONS with 204 breaks the method contract.
- Do not commit `worker-configuration.d.ts`; `npm run typecheck` regenerates it with `wrangler types`, because the generated file carries Cloudflare's own comment text with dashes and would drift from `wrangler.jsonc`.
- Keep `@astrojs/cloudflare`, `astro`, `@astrojs/react` and `shadcn` in `devDependencies`, because `npm audit --omit=dev` must cover what the Worker bundle ships and the dev toolchain's undici advisory would otherwise fail the gate.
- Static assets never reach the Worker, so they are not logged; one request log line comes from the Hono middleware for every page and JSON route, because the Hono app wraps the whole pipeline.
