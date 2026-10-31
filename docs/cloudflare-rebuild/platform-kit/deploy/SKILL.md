---
name: deploy
version: 1
needs: [scaffold]
secrets: []
bindings: []
screens: []
tickets: [011-deploy]
---

> **Historical reference only — not an active MeetScript task.** The top-level PRD, architecture, DESIGN and CODEX-HANDOFF plus platform-kit/README.md override this recipe. Do not implement inherited billing/paid-plan behavior, meeting scheduling or factory-only dependencies. Adapt useful contracts; this snapshot is not a runnable application.

# Platform skill: deploy

Two Worker envs, migrations before the deploy, secrets checked before the agent runs, a report Vinci can act on.

## Decision

- Two wrangler envs in `wrangler.jsonc`: `preview` (`<product>-preview`) and `production` (`<product>`). Every non-inheritable key is repeated in each env. The top level is the local config.
- Build per env with `CLOUDFLARE_ENV=<env> astro build`; the adapter writes the flattened `dist/server/wrangler.json`; `wrangler deploy -c dist/server/wrangler.json` deploys it. `--env` on `wrangler deploy` has no effect on the generated file.
- Remote migrations first: `wrangler d1 migrations apply DB --remote -c dist/server/wrangler.json`, then the deploy.
- Secrets live only in the Worker, set with `printf '%s' "$VALUE" | wrangler secret put NAME --name <worker>` from the shell env, never from a file in the repo. One `JWT_SECRET` per env, generated once.
- Before the deploy agent runs, the factory assembles the `secrets:` lists of the selected platform skills and runs `wrangler secret list --name <worker>` against the target; a missing secret stops the stage with one plain line naming it. The agent never guesses a secret.
- `scripts/deploy.sh <env>` is the one sequence: required secrets in the shell, build, remote migrations, secret put, deploy, HTTP checks (`/healthz` and the main routes answer 200).
- Rollback: `wrangler rollback` to the previous version id, recorded in the deploy ledger.
- Custom domains only with `register_approved` in `.spec/deploy.md`; otherwise the free `<worker>.<account>.workers.dev` address.
- Optional later: GitHub Actions `verify.yml` (minshop has one).

## Recipe

1. `scripts/deploy.sh` from `reference/`: replace the product name, set `REQUIRED_SECRETS` to the union of the selected skills' `secrets:` lists and `OPTIONAL_SECRETS` to their `optional_secrets:`, and the HTTP check paths to this product's main routes.
2. `wrangler.jsonc` (scaffold reference): both envs present, each with its own `name`, `vars.APP_ORIGIN`, D1 database id and KV namespace id.
3. Create the resources once per env: `wrangler d1 create <product>` and `<product>-preview`, `wrangler kv namespace create <product>-auth` and `<product>-preview-auth`; put the ids into the envs.
4. Secrets per env, from the shell: `JWT_SECRET` and every name the selected skills list. Verify with `wrangler secret list --name <worker>`.
5. Deploy `preview` first, run the HTTP checks, then `production`.
6. The deploy report (`.lavish/deploy.html`, `.spec/summary-deploy.txt`) names the URL, the Worker version id, the migrations applied, the secrets found (names only), and, when the payments skill is selected, the webhook destination URL `https://<origin>/api/webhooks/bachs` Vinci must register in the Bachs dashboard, and, when the email skill is selected and `MAILYSEND_API_KEY` is absent, that the Worker runs the dev transport and sends no real mail.

## Contract

- `scripts/deploy.sh preview|production` exits non-zero on the first failure and prints `== done: <origin>` on success.
- `GET /healthz` answers 200 with `checks.db: ok` on the deployed Worker.
- The deploy ledger in `.spec/deploy.md` gets one row per deploy: date, Worker version, commit, verify result, notes.

## Platform FRs

- **FR-DEP-1 Secrets before deploy.** Given the selected skills' secret names, when the deploy stage starts, then every name is present on the target Worker, or the stage stops with a line naming the missing one and nothing is deployed.
- **FR-DEP-2 Migrations before deploy.** Given pending migrations, when the deploy runs, then they are applied to the remote database before the new version serves traffic.
- **FR-DEP-3 Live check.** Given the deployed URL, when `/healthz` is requested, then it answers 200 with `checks.db: ok`, and the URL is recorded in `.spec/deploy-url.txt`.

## Pitfalls

- Build for an env with `CLOUDFLARE_ENV=<env> astro build` and deploy `dist/server/wrangler.json`, because `--env` on `wrangler deploy` does not change the generated file.
- Apply remote migrations with `-c dist/server/wrangler.json`, because the generated config rewrites `migrations_dir` to `../../migrations`.
- Put secrets with `printf '%s'`, never `echo`, because `echo` adds a newline to the stored value.
- Never `wrangler secret put` from a variable you have not checked is non-empty, because an empty value is stored and breaks the Worker until the old value is re-put.
- Keep one JWT secret per env outside the repo and know that a new one signs every user out.
- Register one GitHub OAuth app per env, because an app takes one callback URL.
- The account's `workers.dev` subdomain is `tropos`; the URLs are `https://<worker>.tropos.workers.dev`.
- Add the Bachs webhook destination for each deployed URL and set that destination's secret on that Worker, because the shared secret in the env belongs to another endpoint.
