---
id: 007
title: Authorization policies for {{product}}
status: draft
deps: [005]
verify: "npx vitest run --project unit src/policy/can.test.ts"
budget: 8
scope_out: [".spec/design/*", "{{tokens_path}}", "migrations/*", "src/components/*", "src/pages/*"]
realizes: [FR-AUTHZ-1, FR-AUTHZ-2]
screens: []
skills: [authz]
---

> **Historical reference only — not an active MeetScript task.** The top-level PRD, architecture, DESIGN and CODEX-HANDOFF plus platform-kit/README.md override this recipe. Do not implement inherited billing/paid-plan behavior, meeting scheduling or factory-only dependencies. Adapt useful contracts; this snapshot is not a runnable application.

# 007 - Authorization policies for {{product}}

## Context
The policy layer of {{product}}: `can(user, action, resource)` in `src/policy/can.ts`, one pure function per action, called at every route boundary after `requireUser()` and backed by the `owner_id` filter in `src/db/`. Follow the authz skill (Platform section of your prompt) and the actions the PRD names. Realizes FR-AUTHZ-1 and FR-AUTHZ-2; architecture section Security.

## Acceptance criteria (Gherkin)
- **Given** the policy module **when** the unit tests run **then** every action in the `Action` union has a test for the allowed case and the refused case, and a missing user is refused for every action.
- **Given** a signed-in user and a row another user owns **when** they read, change or delete it through the API **then** the answer is 404 `not_found` and the row is unchanged.
- **Given** a route on a user-owned resource **when** the factory reads it **then** it calls `can()` before the write and the repository statement filters by `owner_id`.

## Implementation notes
- Copy `src/policy/can.ts` and `src/policy/can.test.ts` from the reference and replace the split actions with the product's resources. Keep `pro.use` only with the payments skill.
- Wire `can()` into every route that touches a user-owned row; the route tests in `tests/worker/api.test.ts` gain the not-owner case.

## Evidence
The vitest output in the ticket log is the proof. No screenshots: this ticket has no screens.
