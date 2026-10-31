# MeetScript architecture — custom Cloudflare runtime

Companions: PRD.md (scope), DESIGN.md (UI), CODEX-HANDOFF.md (external execution). This is a proposed architecture with a mandatory live feasibility gate, not proof of deployed capture.

## 1. Baseline and migration boundary
Historical inspection recorded `Vinci-virtuoso/MeetScript`, default branch `new_test_branch`, commit `e41b417`: Next.js/FastAPI, Selenium/Edge/Xvfb/PulseAudio, Deepgram, hard-coded GroundX and OpenAI; shared local files and user credentials were unsafe for production. This is historical context, not a fresh inspection. External Codex must discover the current default branch and changes before creating a non-destructive rebuild branch. Preserve source history; document migration/replacement. Remove tracked environment files/bytecode from future trees, scan secrets and ask owner to rotate any exposed credentials without printing values. History rewrite needs separate approval. No product repository edits or remote pushes are part of preparing this handoff.

Use custom MeetScript code; no Goshen code/service. No managed capture, external VM, Calendar integration, billing or invitation scheduler. Optional deferred mailbox has no core runtime resources. Runtime stays on Cloudflare; identity and auth transactional delivery are integration boundaries, not a reason to host capture elsewhere.

## 2. Components and ownership
```text
Browser → web Worker (Astro SSR + React islands + Hono API)
                  ├─ auth KV/session D1, workspace/meeting ACL D1
                  ├─ WorkspaceUsage DO (serialized quota reservation)
                  └─ MeetingSession DO → Cloudflare Container
                                           Playwright + Chromium
                                           virtual audio sink + FFmpeg
Container → scoped internal ingestion Worker → private R2 + D1 chunk manifest
D1 outbox → Queue → Workflow → Workers AI STT/minutes/embeddings → Vectorize
Browser → authorized playback / transcript / actions / cited-chat SSE
```
Prefer one web Worker and one jobs/control Worker initially, with service bindings; split further only for a measured reason. The jobs/control Worker owns queue consumers, workflows, DO classes, bounded ingestion and scheduled reconciliation/deletion. D1 is durable product metadata/content; DO storage is durable session/lease coordination; ephemeral container disk is never the only copy. KV may serve auth ephemeral/cache needs, never authoritative membership or recording locks. No multi-hour HTTP request or `waitUntil` job.

Stack: strict TypeScript, Astro SSR, React islands, Hono, Zod, Tailwind/shadcn or accessible kit equivalents. Pin tested compatible packages and lockfile; do not assume snapshot versions are current. One production frontend, not parallel Next.js and Astro. Kit scaffold/auth/authz/db/api/frontend/app-shell/email/deploy are references, not a runnable combined project. Email is auth transactional only; adapters need separately configured sender/transport. Prefer owner-approved Cloudflare-hosted delivery integration when available; do not assume access to a shared Mailysend Worker. Resend source is a legacy adapter reference, not a required runtime service. App OAuth requests identity scopes only and supplies no bot Google session.

## 3. Feasibility gate and container lifecycle
G0 must run on actual Cloudflare Containers: validate instance resource suitability, outbound Meet/WebRTC connectivity, required codecs/audio devices, image architecture, browser sandbox behavior, instance availability, startup/readiness, documented lifetime/idle semantics and current quotas. Consult current official Container DO API; do not invent method names or assume the process running means the control port is ready. Pin the image digest and browser/FFmpeg versions. Container runs least privilege where supported, camera/mic off, visible `MeetScript — recording`, virtual audio monitor captured by FFmpeg, no screen/video stream. Never weaken admission or Google security to make the test pass. Authentication-required/CAPTCHA/denied outcomes fail explicitly. Record actual admitted received speech into playable R2 objects; captions, generated tones and local successes do not prove this path.

Session lifecycle: `queued → starting → joining → waiting_for_admission → recording → stopping → processing → ready`. Terminal alternatives: `cancelled`, `denied`, `failed`; partial media has `completeness=partial` with explicit gaps and can finish processing without claiming complete capture. Persist stage, reason code, monotonic revision, attempt/epoch, deadlines, heartbeat time and finalization status. `authentication_required`, `admission_timeout`, `container_lost`, `upload_failed`, `transcription_failed` remain distinct error codes.

One deterministic DO ID per workspace/meeting; one active container session/epoch. Create durable intent before start. The DO serializes commands and uses fenced epochs so a stale runner cannot upload or overwrite newer state. Lost start response: inspect/reconcile existing state before retry; never create a second bot blindly. Stop/cancel wins over delayed start/status events. Out-of-order events cannot regress terminal state. Consent and membership checked again before join; revoke ingestion credentials at stop/deletion/revocation.

Configure explicit active-session lifetime and supported keep-alive policy after G0: a healthy recorder must not die solely because the UI has no HTTP traffic. DO alarms check persisted heartbeats/deadlines and global/workspace limits; they must not rely on a permanently resident JavaScript timer. Initial heartbeat target 15 seconds; after 60 seconds without progress, reconcile and stop/fence a lost session rather than automatically rejoin. These are app policies, not claims about Cloudflare guarantees. On SIGTERM, stop capture, finalize/upload bounded last chunk if time permits, commit terminal status and exit. Persist completed chunks continuously, not only at graceful shutdown. Abrupt loss leaves a recoverable manifest; mark missing tail/gaps. Recovery processes available audio; no unattended rejoin. Manual fresh join requires renewed authorization and disclosure, linked as a new session.

Rollouts drain: stop accepting new sessions on old image, let admitted sessions finish within max duration or explicitly stop them, deploy new sessions to new image and record interrupted ones. Test hard kill, restart, DO eviction, upload loss and rollout during recording. Reconcile orphaned containers and expired reservations; do not bill or hide lost time. Prove stop actually removes bot and releases resources, not merely changes the UI label.

## 4. Authorization, transport and input security
Every public API uses authenticated verified identity + active workspace membership + per-meeting permission. Repository methods require actor/workspace, composite keys and tenant predicates. Recheck D1 membership/session revocation on each request, not JWT role alone. Return 404 for inaccessible content, 401 for unauthenticated and 403 for known workspace action denial. Admin emergency stop never implicitly grants private transcript access. Prevent self-escalation, cross-workspace action owners and grant edits; audit role/access changes.

Strict URL parsing permits only Meet HTTPS meeting codes, rejects username/password, non-default ports, arbitrary paths/redirect targets and untrusted navigation. Restrict initial navigation and stop on identity/login challenge; required Google subresources must be verified during G0, not blanket bypassed. Never accept arbitrary file paths/URLs to ingestion. Browser and audio processes receive no account-wide Cloudflare secrets. Internal control via service bindings where possible; runner uses short-lived meeting/epoch-scoped credentials with endpoint/audience, expiry, replay constraints and body/size validation. Scope to upload/status only, no reading other recordings. Rotate/revoke on session close. Validate MIME, codec, chunk sequence, checksum and quota server-side. No public bucket or anonymous privileged control endpoint.

Cookie mutations require CSRF/origin protections; exact OAuth callbacks use state/nonce/PKCE and verified JWT issuer/audience/signature. Prevent open redirects, rate-limit OTP/join/chat and disable dev-mail routes/transports in deployed environments. CSP, safe Markdown rendering and output escaping guard transcript/model HTML injection. Never log tokens, full Meet URLs, transcript text or raw email. Prompt content cannot invoke tools, modify permissions or change retrieval filters.

## 5. Data model and concurrency
Opaque IDs, UTC timestamps plus meeting timezone, integer milliseconds for media offsets and integer seconds for quota. All content tables carry workspace_id and composite references; define indexes and migration tests rather than trusting conventions.

- users, verified identities, auth sessions; workspaces; memberships(workspace,user,role,status); hashed expiring membership tokens.
- meetings(workspace,id,creator,normalized_meet_code,visibility,title,timezone,state,reason,consent_version,consent_at,revision,deleted_at); meeting_grants(workspace,meeting,user,permission).
- capture_sessions(workspace,meeting,session_id,epoch,image_digest,started_at,deadline,heartbeat_at,state,completeness); recording_chunks(workspace,meeting,session,sequence,r2_key,checksum,bytes,codec,start_ms,end_ms,status). Unique session/sequence and key/checksum equality on replay.
- recordings(manifest,assembled_object_optional,duration,retention_expires_at); transcripts(workspace,meeting,version,model,source_manifest,status); transcript_segments(workspace,meeting,version,id,start_ms,end_ms,speaker_nullable,text). Corrections produce new versions; original preserved within retention.
- minutes(workspace,meeting,version,transcript_version,model,prompt_version,schema_version,json,status); action_items(workspace,meeting,id,title,owner_nullable,due_nullable,status,citations,reviewed_at,revision).
- chunks(workspace,meeting,transcript_version,id,segment_ids,start_ms,end_ms,text,embedding_version,vector_id,index_status).
- conversations(workspace,user,scope); messages(workspace,conversation,role,body,citations,status,model). Private to their owner unless an explicit future sharing feature is approved.
- usage_reservations(workspace,meeting,dispatch_key,reserved_seconds,settled_seconds,state); usage_ledger(unique_event_key,workspace,captured_seconds,reason); outbox; job_attempts; deletion_jobs; minimal audit_events.

Unique dispatch key and workspace+active Meet-code lock prevent duplicate joins. WorkspaceUsage DO serializes capacity reservation, max concurrency and rolling-window duration checks. Global coordinator enforces global concurrency if required; do not pretend per-workspace locks enforce it. Saga: persist intent → reserve → start session → settle measured capture once → release unused reservation. Durable reconciliation repairs failed intermediate steps and conservatively holds uncertain reservations until stopped. All retryable writes have deterministic idempotency keys. D1 transactions/batches only where supported; R2/Vectorize/Queue/DO are not one atomic transaction. Outbox covers commit/enqueue loss. Stable cursor pagination and indexes on workspace/date, meeting/version/time, actions/status/due and outbox/retry time.

## 6. Media, AI and retrieval
Start with approximately 30-second independently decodable audio chunks; validate actual format and model limits at G0, tune without changing timestamp semantics. Each chunk records monotonic offsets aligned to session start; manifest records gaps, ordering and checksums. Acknowledge only after R2 persistence and durable manifest update; retries use same sequence/checksum. Orphan object reconciliation repairs upload-before-manifest crashes; conflicting duplicate checksum fails. Bounded local spool and upload backlog limit stop capture before disk exhaustion. Do not buffer multi-hour files in Worker memory. Playback uses an authenticated range-capable endpoint and composed/manifest playback validated in browsers; optional final assembly occurs in a bounded Cloudflare container job. D1/R2 content types and ranges validated. Never persist shareable public media URLs; cache headers prevent private content leaking across users. Expired audio leaves transcript sources available only until their own retention ends, with clear unavailable-audio messaging.

Queue messages and Workflow results carry IDs, not media/text blobs. Workflow steps: finalize manifest → Workers AI STT per bounded chunk → timestamp-normalize/deduplicate overlap → store versioned segments → schema-validated minutes/actions draft → embed chunks → Vectorize upsert → mark stages ready. Pin currently supported Workers AI STT/generation/embedding model IDs, input limits and index dimension/metric in deployment config. Model selection must be validated on actual audio; unsupported diarization stays unknown. Long minutes use bounded section batches and a merge pass preserving segment IDs. Parse JSON schema and validate every cited ID/time range; bounded retries, then needs-review/failure, not invented facts. Processing retry never rejoins Meet.

Chunk target 400–800 tokens with modest overlap and source mapping. Retrieve only after deriving actor's authorized scope from D1: workspace Vectorize namespace + meeting filters → oversampled candidates → D1 membership/meeting/deletion/current-version recheck → load authorized text → bounded generation. Metadata alone is not authorization. Validate returned citations against the exact supplied evidence before emitting. Do not expose inaccessible candidate titles/counts. Re-authorize before final persistence/emission if ACL changes; abort streams on revocation/deletion and invalidate dependent cached history. Zero evidence abstains. Index writes are eventually consistent: show indexing/partial search and retry; tombstones deny access immediately even with stale vectors. Keep model/dimension versions separate; reindex and switch only after validation.

Chat SSE: token, citation, completed, error events; authorize first, apply scope per turn, cancel upstream when possible and mark incomplete messages. No autonomous tools/mutations. Retention/deletion removes dependent generated answers as well as citations to avoid residual content leakage.

## 7. HTTP contracts
JSON errors `{error, message, requestId, fields?}`; paginated `{items,nextCursor}`. Zod schemas, request limits, expected revisions for edits (409 conflict), idempotency key for creation and bounded retry response semantics.
- Auth `/auth/*`, `/auth/web/*`; `/api/me`, session revocation/account deletion.
- `/api/workspaces`, `/:w/members`, `/:w/membership-invites` (membership only).
- `/api/workspaces/:w/meetings`: GET list, POST immediate join with URL/disclosure/visibility/duration/idempotency key. No scheduled start field.
- `.../meetings/:m`: GET details, PATCH permitted metadata/access, DELETE tombstone; POST `stop`, `cancel`, `retry-processing`.
- `.../meetings/:m/transcript|minutes|recording|actions|exports`; POST minutes regeneration; PATCH action with expected revision.
- `.../conversations`, `.../conversations/:c/messages` SSE, authorized history/delete.
- `.../usage`, `.../settings/privacy`, `.../deletions/:id` status; non-billing limits.
- Internal scoped session status/chunk/finalize endpoints, not public provider webhooks.
- `/healthz` shallow health; protected deeper readiness/metrics without secrets.
No Calendar, capture-provider webhook, checkout or meeting mailbox endpoints.

## 8. Privacy, operations and deployment
Deletion saga first tombstones, stops/fences capture and prevents new jobs/reads; then purges media/exports, content, vectors, dependent conversations/messages and transient artifacts. Each stage is idempotent, durable and retried with DLQ/operator repair. A running STT/index job checks tombstone before writing, avoiding resurrection. Backup restoration replays deletion ledger. Publish honest backup expiry/deletion latency; no unverifiable instant physical-purge promise.

Bindings by environment: DB, AUTH_KV, RECORDINGS, DOCUMENTS, VECTORS, AI, INGEST_QUEUE, INGEST_DLQ, MEETING_WORKFLOW, MEETING_SESSION, WORKSPACE_USAGE, optional GLOBAL_USAGE, container image/config and auth mail service as configured. Separate preview/prod resource IDs, domains, auth keys, buckets, vector indices, queues and containers. Secrets in CI/Cloudflare secret storage, never bundle values. Example domain proposals are not approved DNS changes.

Log request/job/session IDs, transitions, aggregate latency/usage only. Alert on missed heartbeats, no-progress audio, failed uploads, queue age/DLQ, model error rate, quota ceiling, orphan sessions and deletion lag. Document cleanup/replay, session drain, incident response and tested D1/R2 recovery; distinguish measured RPO/RTO from aspirations. Cap retry count/backoff and model budgets; poison jobs go to DLQ without infinite spend.

External Codex CI: clean pinned install → types/lint/unit/Workers tests → disposable migrations → production build → browser/axe → dependency/secret scan. Provision preview with least privilege and owner authorization; deploy tested image/control/web versions, migrate with expand/contract, verify bindings/health via read-back, then real G0 and complete consented flow. Store redacted evidence and exact URLs. Production requires owner approval and repeat real smoke tests plus isolation/stop/deletion checks. Drain active sessions before risky rollout; retain prior Worker/image versions and backwards-compatible DB schema for rollback. Restore drills must honor deletion. Report blocked integrations rather than simulated success.

## 9. Sources and evidence boundary
Use these source links from the prior handoff; re-check current API details/limits during implementation. This document does not assert that these pages or platform capabilities were freshly validated in this packaging task.
- Existing code: https://github.com/Vinci-virtuoso/MeetScript
- Containers platform: https://developers.cloudflare.com/containers/platform-details
- Container Durable Object API: https://developers.cloudflare.com/containers/api/durable-object-container/
- Workflows: https://developers.cloudflare.com/workflows/ ; Vectorize: https://developers.cloudflare.com/vectorize/ ; Workers AI: https://developers.cloudflare.com/workers-ai/
- Alook historical findings: https://github.com/alookai/alook/pull/35 and https://github.com/alookai/alook/pull/41 — local captions, not Cloudflare audio evidence; no dependency or copied capture implementation is implied.
- Google Meet API release notes: https://developers.google.com/workspace/meet/release-notes — verify current restrictions; REST artifacts are not a universal live admission API.
- RealtimeKit: https://developers.cloudflare.com/realtime/realtimekit/ai/transcription/ — its own meeting transcription is not arbitrary Meet capture.
- Deferred mailbox background only: https://developers.cloudflare.com/email-routing/email-workers/ and https://developers.cloudflare.com/email-service/get-started/route-emails/ — routing alone is not a hosted IMAP inbox and creates no current scope requirement.
