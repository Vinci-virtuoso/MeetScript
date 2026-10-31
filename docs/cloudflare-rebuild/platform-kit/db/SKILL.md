---
name: db
version: 1
needs: [scaffold]
secrets: []
bindings: [DB]
screens: []
tickets: [002-db]
---

> **Historical reference only — not an active MeetScript task.** The top-level PRD, architecture, DESIGN and CODEX-HANDOFF plus platform-kit/README.md override this recipe. Do not implement inherited billing/paid-plan behavior, meeting scheduling or factory-only dependencies. Adapt useful contracts; this snapshot is not a runnable application.

# Platform skill: db

Relational data on D1 with plain SQL migrations and a repository layer. No ORM.

## Decision

- Cloudflare D1, one database per env, binding `DB`.
- Plain SQL migrations in `migrations/NNNN_name.sql` (four digits, one numbering for the whole project), applied with `wrangler d1 migrations apply DB`. Migrations are append only; a change is a new file.
- `src/db/` is the only place with SQL. One module per table (`src/db/<table>.ts`) with typed row and domain shapes, re-exported from `src/db/index.ts`. Routes and hooks call these functions and never `env.DB` directly.
- Ids are text ULIDs (`src/db/ids.ts`). `created_at` and `updated_at` are integer milliseconds since the epoch, UTC.
- Every user-owned table has `owner_id TEXT NOT NULL REFERENCES users(id)` and every query on it filters by `owner_id` (see the authz skill).
- Index names follow `idx_<table>_<cols>`. A UNIQUE constraint is written as `CREATE UNIQUE INDEX idx_<table>_<col>`.
- Tests: the `worker` vitest project applies every migration to an isolated D1 before each test file (`tests/setup.ts`), so repository tests run against the real schema.
- Backups: D1 Time Travel (30 days of point in time restore). No export job in milestone 1.

## Recipe

1. `migrations/0001_users.sql` from `reference/`: the users table every product with accounts needs (`id`, `email`, `plan`, `pro_until`, `github_id`, `created_at`, `updated_at`). Drop `plan` and `pro_until` only when the payments skill is not selected and the PRD has no plan.
2. The loginbase and eventbase migrations from `reference/migrations/` (`00NN_loginbase_*.sql`, `00NN_eventbase_*.sql`): copy them with the project numbering and keep the one-line header that names the source and version. The auth skill needs them.
3. `src/db/ids.ts`, `src/db/users.ts`, `src/db/index.ts`. `src/db/splits.ts` is the example of a user-owned repository: copy its shape for each product table (`list`, `count`, `find`, `create`, `update`, `delete`, all taking `ownerId`).
4. A product table: one migration, one `src/db/<table>.ts`, one test block in `tests/worker/db.test.ts`.
5. `npm run db:migrate` applies the migrations locally with `--persist-to .wrangler/state`; `npm run verify` runs it before Playwright.

## Contract

- `src/db/ids.ts`: `newId(): string` (ULID), `nowMs(): number`.
- `src/db/users.ts`: `findUserById`, `findUserByEmail`, `findOrCreateUser(db, email, { githubId? })` returning `{ user, created }`, `setUserPlan`, `deleteUserCascade`, `hasActivePro`, `normalizeEmail`. The `User` type has camelCase fields; the `UserRow` type has the column names.
- A repository function takes `db: D1Database` first, then `ownerId` for a user-owned table, then the input. It returns domain objects, never rows.
- `delete` returns a boolean from `meta.changes`, so a route can answer 404 for a row that is not the caller's.
- Lists order by `updated_at DESC, id DESC` and take a `limit`.
- SQL strings are one line each, so a reviewer and the platform check can read them.

## Platform FRs

- **FR-DB-1 Schema from migrations.** Given a fresh D1 database, when `wrangler d1 migrations apply DB` runs, then every table and index the code reads exists, and running it again changes nothing.
- **FR-DB-2 Owner scoped data.** Given two users with rows in a user-owned table, when the first user lists, reads, updates or deletes, then only the first user's rows are touched and a row of the second user answers as not found.

## Pitfalls

- Copy loginbase's three migrations and eventbase's nine into `migrations/` with the project numbering, because `migrations_dir` can point at one folder only and a database with its own migrations cannot use `node_modules/...`.
- Under the vitest plugin apply the migrations yourself: `readD1Migrations("./migrations")` into a `TEST_MIGRATIONS` binding in `vitest.config.ts`, then `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)` in `tests/setup.ts`, because the plugin does not run them. Cast the binding in the setup file; it is not in `Env`.
- Give `wrangler dev -c dist/server/wrangler.json` and `wrangler d1 migrations apply DB --local` the same `--persist-to .wrangler/state`, because the sqlite file is keyed by `database_id` and the two must share it.
- Declare `CREATE UNIQUE INDEX idx_<table>_<col>` instead of a UNIQUE column, because a UNIQUE column creates an unnamed autoindex that breaks the index naming rule.
- Use `meta.changes` from a DELETE to tell "deleted" from "not yours", because both end with no row and the second must answer 404.
- Order lists by `updated_at DESC, id DESC`, because two inserts in the same millisecond are common in tests and the ULID id keeps creation order.
