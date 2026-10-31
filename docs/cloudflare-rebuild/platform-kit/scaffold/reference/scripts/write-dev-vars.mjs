// Writes .dev.vars (gitignored) for astro dev, wrangler dev and the Playwright run. Values come from
// the shell environment when present; otherwise safe local placeholders. Never commit the output.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const path = new URL("../.dev.vars", import.meta.url);
const current = existsSync(path) ? readFileSync(path, "utf8") : "";
const existing = Object.fromEntries(
  current
    .split("\n")
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);
const pick = (name, fallback) => process.env[name] || existing[name] || fallback;
const vars = {
  JWT_SECRET: pick("JWT_SECRET", randomBytes(32).toString("base64url")),
  BACHS_API_KEY: pick("BACHS_API_KEY", "sk_sandbox_local_placeholder"),
  BACHS_WEBHOOK_SECRET: pick("BACHS_WEBHOOK_SECRET", "whsec_local_placeholder"),
  GITHUB_OAUTH_CLIENT_ID: pick("GITHUB_OAUTH_CLIENT_ID", "local-github-client-id"),
  GITHUB_OAUTH_CLIENT_SECRET: pick("GITHUB_OAUTH_CLIENT_SECRET", "local-github-client-secret"),
  MAILYSEND_API_KEY: pick("MAILYSEND_API_KEY", ""),
};
writeFileSync(path, Object.entries(vars).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
console.log(`.dev.vars written (${Object.keys(vars).length} names)`);
