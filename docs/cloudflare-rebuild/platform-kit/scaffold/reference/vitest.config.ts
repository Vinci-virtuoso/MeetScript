import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";

// Two projects. `unit` runs pure modules under Node. `worker` runs inside workerd (Miniflare) with
// the bindings from wrangler.jsonc; every D1 migration in migrations/ is applied in tests/setup.ts.
export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  return {
    test: {
      projects: [
        {
          test: {
            name: "unit",
            environment: "node",
            include: ["tests/unit/**/*.test.{js,ts}", "tests/contract/link-*.test.js", "src/**/*.test.ts"],
          },
        },
        {
          plugins: [
            cloudflareTest({
              wrangler: { configPath: "./wrangler.jsonc" },
              miniflare: {
                bindings: {
                  TEST_MIGRATIONS: migrations,
                  JWT_SECRET: "test-jwt-secret",
                  BACHS_API_KEY: "sk_sandbox_test",
                  BACHS_WEBHOOK_SECRET: "whsec_test_secret",
                  GITHUB_OAUTH_CLIENT_ID: "test-client-id",
                  GITHUB_OAUTH_CLIENT_SECRET: "test-client-secret",
                },
              },
            }),
          ],
          test: {
            name: "worker",
            setupFiles: ["./tests/setup.ts"],
            include: ["tests/worker/**/*.test.{js,ts}", "tests/contract/events-*.test.js"],
          },
        },
      ],
    },
  };
});
