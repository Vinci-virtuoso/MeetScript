# Implementation sequence and reviewable milestones

Version 1 · 7 November 2026. Product requirements: [PRD.md](PRD.md). Acceptance evidence: [ACCEPTANCE.md](ACCEPTANCE.md). The owner confirmed email/ICS plus pasted links, one agent per user and automatic organizer-approved recap recipients. The old handoff's immediate-only/mailbox-deferred scope is superseded for future work.

## Baseline and first change

Keep the tested recovery foundation and existing draft PR. This revision adds specifications and updates entry-point documentation only; it creates no runtime tables, domain routes, invitations, Google accounts, recordings or outbound messages. Existing foundation verification remains historical to that code version. Expanded-product acceptance starts unchecked.

Use small, reviewable implementation commits with an updated requirement-to-test report. Do not deploy the local Wrangler placeholders. Preserve `docs/cloudflare-rebuild/` and its manifests as an immutable historical reference, and point implementation agents to this revision first.

## Phase 1 — real attendance/audio feasibility (G0)

**Work:** prepare a minimal custom Cloudflare Container/DO preview runner; verify current browser/audio/runtime APIs and actual account limits; model explicit admission and consent states; implement scoped bounded chunk upload and private playback sufficient for the test. Record image and browser/FFmpeg versions. No mailbox/scheduler work is a substitute for this proof.

**External inputs:** authorized Cloudflare preview access/capacity/budget, a consenting test meeting and approved disclosure/withdrawal procedure. Guest admission is the first supported approach; authentication-required meetings must fail explicitly until a separately supported identity solution is proven.

**Exit:** G0-01/02/03, CONSENT-01 and enough MEDIA-01/02 to demonstrate real audible speech, confirmed stop, no-UI lifetime and partial recovery. If infeasible, report the exact blocker and revisit the architecture with the owner. Do not silently switch hosting/provider or advertise working attendance.

Offline implementation/design may proceed while external inputs are unavailable, with G0 recorded as blocked and capture kept unavailable.

## Phase 2 — one real pasted-link recap

**Work:** evolve the foundation with per-user agent identity and explicit workspace binding; adapt quota keys/indexes for privacy ownership and global/agent caps. Configure approved transactional/recap mail transport. Complete real chunk STT, versioned transcripts, cited minutes/actions, immutable recap artifacts, recipient approval and recipient-specific delivery outbox. Add verified-email per-meeting guest grants. Implement the simple immediate-join journey and delivery status first.

Do the production auth mail/Turnstile UI work and complete missing session/ownership protections before exposing privileged real use. An organizer-approved recipient list permits automatic sending; processing success and current authorization still gate each send.

**Exit:** one approved pasted Meet → actual recording → real transcript/cited minutes → automatic individual recap emails → authorized source links; owner/second workspace/guest access matrix; delete/read-back. Validate provider acceptance versus actual delivery and an uncertain-send path. Source/index readiness are separate; full cross-meeting indexing can follow in phase 5.

**Required evidence:** real journey plus AUTH/TENANT foundation coverage, QUOTA-01, MEDIA, AI, RECIP and SEND gates relevant to that journey. The phase is not complete after sending fixture text or a health email alone.

## Phase 3 — personal agent inbox and invitation ingress

**Work:** provision approved isolated agent-domain routing, add unique user-owned address/inbox metadata and private bounded payload handling, deterministic MIME/ICS parsing, organizer policy/approval and inbox UI. Add source fingerprinting, replay/loop suppression and acknowledgements. A user's address is independent of workspace membership; each event is pinned to a selected workspace.

Parse and normalize future invitations in this phase, but do not claim unattended scheduling until phase 4's durable execution passes. Unknown/ambiguous organizers or unsupported calendar data remain held for owner approval/review.

**Exit:** a real eligible organizer's invitation reaches the correct user's private inbox and normalizes to an authorized event; wrong-user access/spoofed approval/malformed payloads fail; replies do not loop. Calendar acknowledgement/RSVP behavior tested with supported real clients.

**Required evidence:** SCOPE, MAIL and event identity/revision scenarios. Domain configuration and mail handling are isolated from production; no public raw mail artifacts.

## Phase 4 — durable scheduled attendance

**Work:** create event revisions/occurrences, durable alarms/outbox/reconciliation, Now/Scheduled UI, recurrence expansion within supported bounds, timezone/DST handling, cancellation/rescheduling fences and admission deadlines. Integrate agent/workspace/global reservations and dispatch-time authority rechecks.

Use proposed pilot limits as configurable safety budgets only after actual capacity validation. Conflicts, missed starts and uncertain recorder state require visible resolution; retries never become a silent new meeting attendance.

**Exit:** real scheduled invitation joins at the correct time while the UI is closed; reschedule and cancellation are honored; restart, stale/duplicate alarm and cancellation/start races create no duplicate bot. Test single occurrence, series cancellation and detached reschedule. Unsupported recurrence rules are visibly held.

**Required evidence:** all SCHED gates plus quota, consent and capture lifecycle regression. No connected Google Calendar integration is required for this release.

## Phase 5 — authorized meeting memory

**Work:** finish transcript chunking/embeddings/Vectorize, full-text meeting search, scoped conversations, grounded chat, citations and streaming/cancel. Include guest grants and per-user private content in the authorization design. Keep model text read-only with no scheduling, recipient or sending tools.

**Exit:** indexed real meeting answers with exact source citations, explicit no-evidence abstention and honest indexing lag; no leaked titles/snippets/counts across agents/workspaces/guests; revocation/deletion takes effect even with stale vectors. Regeneration preserves reviewed actions and does not resend a recap automatically.

**Required evidence:** RAG-01/02 and full AI/ACTIONS/citation/authorization matrix.

## Phase 6 — operational and release completion

**Work:** complete automatic retention, agent/account/workspace deletion, in-flight send/stop/deletion handling, queue/DLQ repair, service limits/cost observability, drain/rollback and restore rehearsals. Fill out all new UI states and route screenshots, keyboard/screen reader/zoom checks, bounded security/parser/model/delivery tests and hosted CI.

**Exit:** every core row in ACCEPTANCE.md has explicit actual evidence or a clearly scoped release blocker. Run the complete isolated preview flow with two agent owners/two workspaces/an external guest, then deletion/forbidden access and restoration replay. Production requires its own explicit approval, separate resources and measured real smoke/read-back.

## Workstreams and dependencies

Email parser fixtures, proposed schema, inbox UI and schedule-domain tests can be developed offline alongside G0. Live bot integration depends on G0. Real recap completion depends on valid capture/transcription and a verified sender. Scheduled delivery depends on the same central capture/recap path, not a separate bot implementation. RAG cannot replace the transcript or create facts for failed capture.

There are no elapsed-time promises before Container feasibility, mail service eligibility and test-account capacity are known. Record measured performance and service costs when testing rather than assigning unsupported delivery dates.

## Remaining setup decisions, not blockers for drafting code

- Approve actual agent email domain/subdomain and outbound sender, with account-specific routing/service capability checks before any DNS changes.
- Approve final disclosure/consent/withdrawal, retention, guest sharing and legal/contact copy before live data use.
- Validate supported Google Meet guest conditions and any future authenticated identity requirement; an email address itself supplies neither.
- Review pilot quotas, overlap/late-start policy and supported calendar/recurrence profiles against real tests.
- Keep calendar synchronization, additional meeting platforms, general mailbox functions and autonomous outbound task actions outside this first release unless separately requested.
