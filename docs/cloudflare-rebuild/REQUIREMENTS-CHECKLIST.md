# Requirements and acceptance evidence checklist

This is a specification coverage checklist for external Codex. All implementation boxes start unchecked: the bundle supplies requirements, not a working/deployed app. Fill each row with actual test paths, commands/output, environment/version and redacted evidence references. Use pass/failed/blocked/not-run explicitly; never mark an implementation gate passed just because its spec exists. Core acceptance does not include mailbox work.

| ID | Requirement / specification source | Required verification (external implementation) | Accepted |
|---|---|---|---|
| G0 | Actual Cloudflare audio feasibility — PRD §2, architecture §3 | Admitted consented Meet, visible bot, real received speech, private playable R2 audio listened to, image/version/resource evidence, stop/cleanup; no local-caption substitute | [ ] |
| G0-R | Lifetime and recovery — architecture §3 | No-UI-traffic active capture, process-vs-port readiness, hard kill/SIGTERM, DO eviction, partial upload recovery, drain rollout; no silent rejoin | [ ] |
| SCOPE | Custom code, Cloudflare-only runtime — PRD §1 | Dependency/resource audit: no Goshen, managed capture, VM or alternate provider fallback | [ ] |
| JOIN | Paste URL/immediate only — FR-02 | URL allowlist/SSRF tests, no Calendar scopes or scheduled/invitation join routes; duplicate join link to existing session | [ ] |
| AUTH | Verified member join authority — FR-01 | Unverified/nonmember/revoked session rejected; membership rechecked at dispatch and capture revoked/stopped; OAuth verified-email behavior | [ ] |
| CONSENT | Visible audio-only bot — FR-02/03 | Disclosure acknowledgment/version audit, host admission, mic/camera off, no video/screen artifacts; denial/auth-required/CAPTCHA fail explicitly | [ ] |
| TENANT | Workspace and meeting permissions — architecture §4/5 | Two-workspace IDOR matrix across list/detail/search/audio/ranges/exports/actions/chat/sources; private/admin boundaries and no title/count leakage | [ ] |
| SAFETY | Auth/input/transport hardening — architecture §4 | CSRF, OAuth state/nonce/PKCE/claims, OTP replay/rate limits, private control, scoped short-lived upload credentials, XSS/size limits, no deployed dev-mail | [ ] |
| LIFE | Durable capture orchestration — architecture §3/5 | Lost start acknowledgment, stale epoch/event, duplicate/out-of-order commands, stop/cancel race, timeout, orphan cleanup; no duplicate bot | [ ] |
| AUDIO | Durable audio/playback — FR-03, architecture §6 | Checksum/sequence conflicts, upload-before-manifest recovery, gap marking, browser seek/range auth, bounded spool and media limits | [ ] |
| STT | Workers AI real transcription — FR-03 | Pinned supported model/config, real audio and timestamps, unknown speaker, chunk overlap/gap handling, model failure/retry, immutable corrections | [ ] |
| MINUTES | Summary/decisions/questions/actions — FR-04 | JSON schema, segment/time citations validated, no-evidence sections, null unknown dates/owners, regeneration preserves reviewed edits | [ ] |
| ACTIONS | Editable persistent actions — FR-04/06 | Assign/complete/edit, refresh persistence, tenant owner validation, expected-version conflict and rollback, source navigation | [ ] |
| RAG | Vectorize and cited chat — FR-05 | Namespace/filter + D1 reauthorization, revoked/deleted/stale-version sources, valid exact citations, prompt injection, no-evidence abstention, streaming cancel | [ ] |
| SEARCH | Index consistency and pagination — FR-05/06 | Pending indexing displayed, reindex version/dimension isolation, filtered lists/cursors, selected-meeting scope, safe cache/history revocation | [ ] |
| PRIVACY | Retention/delete/export — FR-07 | Tombstone immediately denies, capture stops, in-flight jobs cannot resurrect, R2/D1/vectors/derived chats removed, retry/deletion status read-back | [ ] |
| QUOTA | Operational budgets, no billing — FR-08 | Atomic concurrent reservations, global/workspace caps, exact-once settlement, lost session reconciliation, no plan/checkout/pricing routes or entitlements | [ ] |
| UI | Full polished routes/states — DESIGN.md | Route/state screenshots at 390/768/1280 light/dark; honest empty/error/partial/permission states and no misleading live fixtures | [ ] |
| A11Y | Responsive accessible controls — DESIGN.md | axe, contrast, keyboard/focus/dialog/player, screen reader spot checks, 320px and 200%/400% zoom, reduced motion | [ ] |
| OPS | Jobs/monitoring/recovery — architecture §8 | Outbox lost enqueue, bounded retries/DLQ/replay, stale heartbeats, deletion alerts, redacted logs, restore honors tombstones | [ ] |
| CI | Reproducible clean checkout — CODEX-HANDOFF | Pinned install/image, types/lint/unit/workerd/migration/build/browser/security suite, names-only config, no secret/environment files in published bundle | [ ] |
| PREVIEW | Actual isolated preview validation — PRD §4 | Authorized deploy, exact resource/binding read-back, real audio→STT→minutes→Vectorize chat→action edit→cross-tenant rejection→deletion; URL/version/output | [ ] |
| PROD | Approved production validation — architecture §8 | Explicit owner approval, separate resources/secrets, actual smoke/read-back, drained deployment and rollback/restore checks; otherwise blocked/not deployed | [ ] |

## Deferred and excluded scope audit
- Mailbox is optional deferred / not core acceptance; recommendation is not explicit user cancellation. Auth transactional email references remain.
- No meeting invitation ingestion/scheduling, Calendar OAuth or recurring joins. Workspace membership enrollment is not a calendar feature.
- No active billing, Recall/managed-capture, Goshen or VM requirements. Mentions in scope exclusions and historical-source warnings are not requirements.
- The kit payments subtree is removed from this bundle only. Historical cross-module plan/pricing imports in retained references are inactive; never restore them to make a copied kit compile. Adapt useful contracts into a new MeetScript implementation.
- This packaging task performs no product-repository modification, remote push or deployment. All runtime implementation gates above remain unverified until external Codex supplies real evidence.

## Evidence report template
For each ID record: status; test file/command; exact output summary; environment and code/image version; private evidence path; limitations/blocker; next owner action. Keep participant audio private and redact secrets/Meet URLs. Separate deterministic fixture tests from real consented integration results. Check current official platform/model limits during G0 and capture them in the implementation report.
