# Portable platform references — MeetScript adaptation boundary

This snapshot is reference source, NOT an integrated runnable MeetScript application. PRD.md, architecture.md, DESIGN.md and CODEX-HANDOFF.md in the parent folder are authoritative. All nested SKILL.md recipes, tickets, checks and code are historical examples, not active product acceptance. They may refer to Rent Split, single-user ownership, factory paths, old resource IDs, unavailable screenshots, paid plans and removed modules. Never deploy/copy the tree wholesale or execute every ticket blindly.

## Retained and required adaptation
| Folder | Reuse | MeetScript delta |
|---|---|---|
| scaffold | Worker structure, errors, logging, test/build patterns | Fresh pinned config/bindings; no inherited deployment IDs or product routes |
| auth | OTP/session protections, Google OIDC additions | Verified identity plus active workspace membership; identity OAuth only, no Calendar scopes or bot credentials |
| authz | Central policy and policy tests | Workspace/meeting ACL; immediate revocation; no paid-plan gate |
| db | D1 repositories, IDs, migrations/tests | Tenant-scoped schema; discard splits/analytics/product/payment fields not needed |
| api | Zod validation, same-origin protections, error/OpenAPI patterns | MeetScript endpoints from architecture.md, no checkout or provider webhooks |
| frontend | Accessible components, error boundaries, style/test patterns | DESIGN.md tokens and complete states; no historical pricing/plan screens |
| app-shell | Layout/account/navigation patterns | Overview, Meetings, Chat, Actions, Settings; no Inbox or pricing navigation |
| email | Provider seam, transactional delivery tests | Auth transactional email only; no meeting mailbox/scheduler or action mail automation |
| deploy | Cloudflare config and verification patterns | Isolated preview/prod Containers/DO/Workers/data resources; real read-back and consented capture tests |

The payments directory has been removed from the handoff bundle only. No source kit or product repository was modified. Billing, Bachs checkout, subscriptions, pricing and paid entitlements are not MeetScript scope. Operational resource limits must not reuse paid-plan gates.

## Legacy code is inactive, including cross-module references
Some retained examples intentionally preserve source context, including imports of removed payment modules, plan fields, pricing links, payment tests and factory verification expectations in scaffold/api/authz/db/frontend/app-shell/deploy. These references are legacy, inactive and MUST NOT be restored or interpreted as requirements. The snapshot is not expected to compile as a combined app. Use the useful authentication/database/API/frontend patterns; author standalone MeetScript code and tests that omit those dependencies. Do not “fix” unresolved legacy imports by reinstating payments. Likewise, Rent Split migrations and account behavior are examples, not the MeetScript data model.

Review each module before adaptation; this warning applies to every nested file, even a ticket worded as an imperative. Product docs override all nested recipes. Retain the auth security invariants while replacing single-user/plan policy with tenant/meeting permissions. Do not copy hard-coded deployment origins, resource IDs or old secrets assumptions.

## Auth email and external dependencies
Email references preserve Mailysend/Resend/dev adapters for inspection, not an assumed available service. Configure an owner-approved transactional sender in the external environment; prefer a Cloudflare-hosted integration where available. Never assume a shared Worker exists. Dev mail inspection must be absent in deployed preview/prod. No runtime or capture workload may move to an external VM/managed capture service. Google/GitHub login are optional app identity integrations, not Calendar consent or Meet bot authentication.

## Portability and integrity
No factory CLI, local credentials, vendored external design skills or absolute host paths are required. Recreate standalone commands and tests using the top-level specs. Inspect package compatibility and licenses before reuse. The file `manifest.json` is a sorted array of `{path,sha256}`, relative to platform-kit, covering every kit file including this README except the manifest itself. A top-level HANDOFF-MANIFEST.json covers the complete folder except itself. Environment files, secrets, node_modules and Git metadata must not enter the bundle; `env.d.ts`, `.gitignore` and scripts that document configuration are source references, not environment files. Secret scanning of the future implementation is still required.
