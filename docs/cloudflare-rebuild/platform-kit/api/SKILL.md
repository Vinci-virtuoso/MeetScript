---
name: api
version: 1
needs: [scaffold]
secrets: []
bindings: [RATE_LIMITER]
screens: []
tickets: [003-api]
---

> **Historical reference only — not an active MeetScript task.** The top-level PRD, architecture, DESIGN and CODEX-HANDOFF plus platform-kit/README.md override this recipe. Do not implement inherited billing/paid-plan behavior, meeting scheduling or factory-only dependencies. Adapt useful contracts; this snapshot is not a runnable application.

# Platform skill: api

The JSON surface under `/api/*`: one error envelope, zod at every boundary, one route registry that also produces the OpenAPI document.

## Decision

- Hono routes under `/api/*`, one module per resource in `src/server/routes/<resource>.ts`, mounted in `src/server/app.ts`.
- zod 4 schemas in `src/schemas/<resource>.ts`, shared by the server (`parseBody`) and the browser (`src/lib/api.ts` parses every response with the same schema). `src/schemas/index.ts` re-exports them.
- Error envelope on every route, auth included: `{ "error": "<snake_case code>", "message": "<one sentence>", ...fields }`. Routes throw `ApiError`; the app's `onError` writes the envelope.
- Request id header `X-Request-Id` on every response (scaffold). `Cache-Control: no-store` on every JSON route.
- CORS allowlist (the app origin only) and an origin check on every state-changing request (`src/server/middleware/cors.ts`, `origin.ts`). Signed webhooks and anonymous beacons are the only exemptions.
- Workers Rate Limiting binding `RATE_LIMITER` (60 a minute per IP) for anonymous write routes.
- `GET /api/openapi.json`: OpenAPI 3.0 from the zod schemas through the `ROUTES` registry in `src/server/openapi.ts`. Every `/api/*` route is in the registry.
- `POST /api/client-errors`: the browser error boundary reports here (frontend skill).

## Recipe

1. `src/server/validate.ts`, `src/server/openapi.ts`, `src/server/middleware/origin.ts`, `src/server/middleware/cors.ts`, `src/schemas/index.ts`, `src/schemas/client-error.ts`, `src/server/routes/system.ts` from `reference/`. In `openapi.ts` keep the `ROUTES` shape and list this product's routes; set the title to the product.
2. `src/server/routes/splits.ts` and `src/schemas/split.ts` are the example of a resource: zod schema for create and update, `parseBody` at the top of each write handler, `requireUser()` with `.use()` on the resource prefix, `can()` before each action, a `toDto` that never leaks a row.
3. `src/server/routes/me.ts`: `GET /api/me` (needs the auth skill).
4. `src/lib/api.ts`: typed browser calls; each parses the response with the schema.
5. Mount in `app.ts`: `corsAllowlist()` and `originCheck({ exempt })` on `/api/*`, the route modules, then the `/api/*` 404.
6. Tests in `tests/worker/api.test.ts`: the envelope on 400, 401 and 404; a validation error lists `issues`; `openapi.json` lists every route; a cross-site POST answers 403.

## Contract

- A route module exports `const <name>Routes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()`.
- `parseBody(request, Schema)` returns the parsed body or throws 400 `validation_error` with `issues: [{ path, message }]`.
- `ROUTES: RouteDoc[]` in `src/server/openapi.ts` has one entry per route with `method`, `path` (OpenAPI style `{id}`), `summary`, `tag`, `auth` (`bearer`, `cookie`, `signature` or none), `request` schema and `responses`.
- Status codes: 200 read, 201 create, 204 delete or empty, 400 validation, 401 unauthorized or invalid_token, 403 forbidden or plan_required, 404 not_found, 405 method_not_allowed, 429 too_many_requests, 500 internal.
- A `/api/*` route is either behind `requireUser()` or carries a `// @public` comment on the line above its definition with the reason.
- SQL never appears in a route; routes call `src/db/`.

## Platform FRs

- **FR-API-1 One error shape.** Given any `/api/*` or `/auth/*` route, when it fails, then the body is `{ error, message }` with an optional field list and the status is the one the contract names.
- **FR-API-2 Validated input.** Given a write route, when the body does not match its zod schema, then the answer is 400 `validation_error` with the failing field paths and nothing is written.
- **FR-API-3 Documented routes.** Given the deployed Worker, when a client requests `GET /api/openapi.json`, then every `/api/*` route appears with its request and response schemas.
- **FR-API-4 Same-site writes.** Given a state-changing request with a foreign `Origin` header, when it reaches `/api/*`, then the answer is 403 `forbidden_origin`.

## Pitfalls

- Adopt loginbase's `{ "error": "<code>", ...fields }` shape for the product routes and add `message`, because one envelope must cover auth and product routes and the browser client parses one shape.
- Treat a request as a preflight only when `Access-Control-Request-Method` is present, because a bare `OPTIONS` must still reach the route's 405.
- Check the origin in Hono for every state-changing `/api` and `/auth` request, because Astro's `security.checkOrigin` covers only form posts to Astro routes. Cookie routes require the header; Bearer routes reject a foreign one and accept its absence (curl sends none).
- Keep the `/api/*` and `/auth/*` 404 handlers after every route module, because Hono matches in order.
- Rate limiters keyed by `CF-Connecting-IP` count `unknown` for every request without the header, because local requests carry none; a local test seam header is gated by a var that no deploy env sets.
