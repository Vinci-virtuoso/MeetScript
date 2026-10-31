---
name: authz
version: 1
needs: [auth, db]
secrets: []
bindings: []
screens: []
tickets: [007-authz]
---

> **Historical reference only — not an active MeetScript task.** The top-level PRD, architecture, DESIGN and CODEX-HANDOFF plus platform-kit/README.md override this recipe. Do not implement inherited billing/paid-plan behavior, meeting scheduling or factory-only dependencies. Adapt useful contracts; this snapshot is not a runnable application.

# Platform skill: authz

Authorization per action, decided in one place and enforced twice.

## Decision

- `can(user, action, resource)` policy functions in `src/policy/can.ts`. `action` is a string union like `"split.read" | "split.write" | "split.delete" | "pro.use"`. Each policy is a pure function of the user and the resource; no I/O.
- Called at the route boundary, after `requireUser()`, before any write. A false answer is 403 `forbidden`, or 404 `not_found` when the resource must not be revealed (a row another user owns).
- Enforced again in the repository layer: every query on a user-owned table filters by `owner_id`, so a wrong policy answer still cannot reach another owner's rows.
- One test per policy in `src/policy/can.test.ts` (the `unit` vitest project).
- Plan gates (`pro.use`) come from the payments skill; without it `can` has owner checks only.

## Recipe

1. `src/policy/can.ts` from `reference/`: keep the shape (`Action` union, resource types, overloads), replace the split actions with the product's resources. Keep `pro.use` and `FREE_SPLIT_LIMIT` only with the payments skill.
2. `src/policy/can.test.ts`: one `it` per action and outcome (owner, not owner, signed out, at the free limit).
3. In every route that touches a user-owned row: load the row through the repository with `user.id`, then `can(user, "<resource>.<verb>", { ownerId: row.ownerId })`, then act.

## Contract

- `can(user: Actor, action: Action, resource?: Resource): boolean`. `Actor` is `Pick<User, "id" | "plan" | "proUntil"> | null | undefined`; a missing user is always false.
- Every user-owned repository function takes `ownerId` and puts `owner_id = ?` in the SQL. A lookup that runs with no user in context (a webhook handler finding a row by the provider's id) carries `// @system <reason>` on the statement line; nothing else is exempt.
- A route answers 404 `not_found` for a row the user does not own, 403 `forbidden` for an action the user may not take on their own row, 403 `plan_required` for a plan gate.

## Platform FRs

- **FR-AUTHZ-1 Policy at the boundary.** Given a signed-in user and a resource another user owns, when they read, change or delete it through the API, then the answer is 404 with the error envelope and the row is unchanged.
- **FR-AUTHZ-2 Policies are tested.** Given the policy module, when the unit tests run, then every action has a test for the allowed case and the refused case.

## Pitfalls

- Keep `can()` pure and take the row from the repository first, because a policy that queries D1 cannot be unit tested and hides the owner filter.
- Return 404, not 403, for a row another user owns, because 403 confirms the id exists.
- Keep every SQL statement on a user-owned table on one line with `owner_id = ?`, because the platform check reads statements line by line.
