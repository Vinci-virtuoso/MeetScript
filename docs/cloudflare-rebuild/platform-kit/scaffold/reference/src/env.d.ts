/// <reference types="astro/client" />
// Secrets are set with `wrangler secret put` (deploy) or .dev.vars (local). `wrangler types` writes
// the bindings and vars into worker-configuration.d.ts; the secrets are declared here because they
// never appear in wrangler.jsonc.
interface Env {
  JWT_SECRET?: string;
  BACHS_API_KEY?: string;
  BACHS_WEBHOOK_SECRET?: string;
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  MAILYSEND_API_KEY?: string;
  MAILYSEND?: Fetcher;
}

// nodejs_compat gives Workers node:async_hooks; the workers types do not declare the module.
declare module "node:async_hooks" {
  export class AsyncLocalStorage<T> {
    run<R>(store: T, fn: () => R): R;
    getStore(): T | undefined;
  }
}
