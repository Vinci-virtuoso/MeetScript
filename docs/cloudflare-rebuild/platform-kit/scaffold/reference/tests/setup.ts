// Applies every migration in migrations/ to the isolated per-test D1 before the worker tests run.
import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";

const migrations = (env as unknown as { TEST_MIGRATIONS: D1Migration[] }).TEST_MIGRATIONS;
await applyD1Migrations(env.DB, migrations);
