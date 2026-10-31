---
id: 011
title: Deploy sequence for {{product}}: two envs, migrations, secrets, checks
status: draft
deps: [001]
verify: "test -x scripts/deploy.sh && bash -n scripts/deploy.sh && grep -q 'd1 migrations apply DB --remote' scripts/deploy.sh && grep -q 'secret put' scripts/deploy.sh"
budget: 8
scope_out: [".spec/design/*", "{{tokens_path}}", "migrations/*", "src/*"]
realizes: [FR-DEP-1, FR-DEP-2, FR-DEP-3]
screens: []
skills: [deploy]
---

> **Historical reference only — not an active MeetScript task.** The top-level PRD, architecture, DESIGN and CODEX-HANDOFF plus platform-kit/README.md override this recipe. Do not implement inherited billing/paid-plan behavior, meeting scheduling or factory-only dependencies. Adapt useful contracts; this snapshot is not a runnable application.

# 011 - Deploy sequence for {{product}}: two envs, migrations, secrets, checks

## Context
The deploy sequence of {{product}}: `scripts/deploy.sh <env>` builds for the env, applies the remote migrations, puts the required secrets from the shell, deploys `dist/server/wrangler.json` and checks the main routes answer 200. Both envs in `wrangler.jsonc` carry their own name, origin, database and namespace ids. Follow the deploy skill (Platform section of your prompt). Nothing is deployed in this ticket; the deploy stage runs the script. Realizes FR-DEP-1 to FR-DEP-3; architecture sections Stack and Failure handling.

## Acceptance criteria (Gherkin)
- **Given** the repo **when** `bash -n scripts/deploy.sh` runs **then** it parses, and the script applies the remote migrations before `wrangler deploy`, puts every required secret with `printf '%s'`, and checks `/healthz` after the deploy.
- **Given** a missing required secret in the shell **when** `scripts/deploy.sh production` starts **then** it stops before the build with a line naming the secret.
- **Given** `wrangler.jsonc` **when** the factory reads it **then** `env.preview` and `env.production` exist with different `name` values and no `main` or `assets` key.

## Implementation notes
- Copy `scripts/deploy.sh` from the reference. `REQUIRED_SECRETS` is the union of the selected skills' `secrets:` lists (at least `JWT_SECRET`); `OPTIONAL_SECRETS` their `optional_secrets:`. The HTTP check paths are this product's main routes from the screen map.
- Record the resource ids (D1, KV) the scaffold created in both envs. Do not create a custom domain.

## Evidence
The verify output in the ticket log is the proof. No screenshots: this ticket has no screens.
