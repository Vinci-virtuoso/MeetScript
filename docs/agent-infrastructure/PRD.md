# Product requirements — personal meeting agents

Version 1 · 7 November 2026. Normative product scope: [README.md](README.md). Technical pilot defaults below are proposals to validate, not measured platform capabilities.

## Product and first journey

A verified user owns one meeting agent with a stable email address and visible recording identity. The user has an inbox in MeetScript, chooses the workspace in which a meeting belongs, and authorizes which organizers may request attendance and which recipients may receive recaps. An authorized email invitation or pasted Meet link starts the attendance workflow. Scheduled meetings are persisted and dispatched at the correct time. After capture, real audio becomes a transcript, cited minutes and actions; a recap is sent automatically to approved recipients. Users can search and ask cited questions over meetings they may access.

The core first-release journey is:

`invite or paste → authorize → schedule/join → admit and consent → record → transcribe → cited minutes → automatic recap → authorized meeting memory`.

The product is a meeting assistant with an inbox. It does not need an IMAP server, a general-purpose email client, or autonomous web/email tools. No Zoom/Teams, video, billing or connected Google Calendar synchronization is included in this release.

## FR-A01 User-owned agent and workspace routing

- One active agent address per verified user, independent of the number of workspace memberships. Use an owner-controlled domain and opaque local part; example addresses in mockups are illustrative, not configured DNS.
- The agent has a display name, status, default workspace, organizer policy and delivery policy. Preserve the visibly disclosed suffix `— recording` during attendance.
- A received invitation is bound to an explicit workspace before approval. The default workspace is a routing convenience; changing it never moves already accepted events, recordings or recipient permissions.
- Each event and meeting remains tenant-scoped. Membership is rechecked before dispatch and throughout capture. Owner suspension/revocation stops or cancels affected capture; it never transfers ownership to another user automatically.
- Agent address knowledge is not join authority. Addresses are not reused after deletion. Independent users' private meetings are not silently combined because their Meet URLs match.

## FR-A02 Application-managed inbox and invitation authorization

- Receive email at the agent address, store bounded normalized invitation metadata and private source data only where necessary, and show received/needs-approval/accepted/rejected/invalid/cancelled states.
- Support Google Meet links in ordinary email and standard MIME calendar invitations (`text/calendar`/`.ics`). Parsing is deterministic; a language model cannot authorize a join, select recipients or run instructions embedded in mail.
- Match organizers to the owner's explicit approved organizer policy. Email authentication contributes evidence but a sender string, attendee address or DMARC result alone does not grant workspace authority. Unknown/ambiguous sources remain held for owner confirmation through an authenticated session.
- The approval records organizer identity, workspace, event revision, consent policy, recipient-list version and who approved it. A standing policy may approve a known organizer's events within explicit limits.
- Accept exactly one unambiguous, server-validated Google Meet target. Multiple conflicting links, unsupported recurrence/timezones, forwarded organizer ambiguity, malformed calendars or unsafe attachments enter needs-review/invalid without joining.
- Invitation acknowledgements may report accepted-for-scheduling or rejected; they must never report admitted/recording before that is observed. Standards-compliant calendar RSVP behavior requires client interoperability evidence before release.
- Do not auto-reply to bulk mail, delivery reports, auto-generated replies, other agent aliases or the agent's own messages. Bound parsing, storage, per-sender/agent load and replies.

## FR-A03 Immediate and scheduled meetings

- Pasted links support Join now or a chosen start date/time/timezone. Email invitations use their event start/end and timezone. All paths converge on the same authorized event/occurrence model.
- Handle calendar UID, organizer, sequence, recurrence ID, update and cancellation semantics; a raw email Message-ID is not the scheduling identity.
- Handle all-day/floating/ambiguous/nonexistent local times explicitly; do not guess an attendance time. Store original timezone and normalized UTC occurrence times. An all-day event needs a confirmed timed start before attendance.
- Expand supported recurrence rules within a bounded horizon; support cancellation of one occurrence and a whole series, plus detached rescheduled occurrences. Unsupported rules are held, not approximately interpreted.
- Dispatch survives Worker/DO restart and does not depend on an open browser or a long-running request. Recheck the latest event revision, membership, organizer approval, consent policy and quotas immediately before start.
- Duplicate deliveries, stale updates, retries and alarms must not create another bot. Cancel/reschedule wins over stale dispatch. Cancellation during a session requests an actual stop; delayed events cannot restore recording.
- Proposed pilot policy: one active session per agent, two per workspace and two globally; 120-minute maximum recording; 10-minute admission timeout. Maximum scheduling horizon 90 days and maximum 100 materialized future occurrences per agent. Require real capacity validation before enabling. Conflicts are visible; no silent late attendance or automatic rejoin after recorder loss.

## FR-A04 Admission, recording and consent

- Run the custom Cloudflare Container audio stack under durable coordination; preserve G0 as mandatory. No managed capture provider or external VM fallback is introduced by this revision.
- The agent appears as a clearly named recording participant. Camera and microphone stay off. Host admission alone is not proof of participant consent.
- The workspace owner approves a disclosure/affirmative-consent/withdrawal procedure. Approval to receive calendar mail or to email a recap is not recording consent. Capture starts only when that procedure's required evidence is established.
- Joining an agent's email address to an invite does not provision a Google identity. Guest joining must be tested. If a meeting requires authentication, fail as `authentication_required`; any future authenticated attendance needs a separately supported identity design. No copied profiles, passwords in chat, CAPTCHA bypass or forced admission.
- Display actual lifecycle: scheduled, blocked, queued, joining, waiting for admission, recording, stopping, processing, ready, partial, denied, cancelled, failed. Distinguish requested stop from confirmed recorder exit.
- Upload independently playable bounded chunks continuously to private R2 with checksums, manifest and gaps. Show incomplete capture honestly. Provide authorized timestamp navigation, playback and transcript/minutes export.

## FR-A05 Transcript, minutes, actions and RAG

- Transcribe actual audio through validated Workers AI models; store immutable original segments and versioned corrections. Unknown speaker remains unknown unless supported evidence identifies them.
- Generate schema-validated summary, topics, decisions, unresolved questions and actions. Every factual item cites an exact transcript version, segment and interval. Unsupported sections say no evidence found; unknown owners/dates remain unset. Regeneration creates a new draft and preserves reviewed actions.
- Transcription produces the source text. Minutes use bounded transcript evidence covering the available meeting; a narrow semantic search must not stand in for complete meeting coverage. RAG supports grounded questions and relevant cross-meeting context.
- Retrieval derives authorized scope from D1, searches Vectorize, then reauthorizes candidates against current membership/grants, tombstones and transcript versions before generation and emission. Transcript/mail text cannot override retrieval scope or invoke tools.
- Separate processing from index readiness: a valid recap need not wait for full cross-meeting indexing. Search shows indexing/partial availability. Zero evidence causes abstention.

## FR-A06 Automatic approved recap delivery

- The organizer-approved recipient list is versioned and scoped to the meeting. It may include external guests. Invited attendees are not automatically approved recipients, nor evidence of actual attendance.
- The organizer must be authenticated/linked to an approved policy before a list is authoritative. The agent owner can approve a standing policy for lists from that organizer. New recipients outside that policy remain held for approval; mail/model text cannot add recipients implicitly.
- Before each send, recheck the exact recipient approval, membership/authority, meeting tombstone, consent policy and source availability. Recipient changes invalidate unsent jobs from the previous list revision.
- After successful processing, send automatically without a per-meeting review step. Include concise summary, decisions/actions and authorized source links. Label AI-generated/partial output; do not send an invented recap when audio/transcription fails. Failures notify the owner under a separate operational notification policy.
- Use one individually addressed message per approved recipient, preventing disclosure of other recipients' addresses. Links use verified-email access to that meeting; no public audio URLs, raw bearer credentials in logs, or workspace-wide membership grants.
- Persist content version, recipient/list approval version, idempotency identity and delivery state. Distinguish queued, sending, provider-accepted, delivered (only with verified evidence), failed, suppressed and unknown. A provider acceptance response does not establish inbox delivery.
- Use bounded retries, authenticated delivery events where available, bounce/complaint suppression and manual repair for uncertain sends. Do not promise exactly-once external email if the selected provider lacks idempotency/reconciliation.
- No automatic resend when minutes are regenerated. An explicit resend is separately tracked. Email already delivered cannot be recalled by source deletion; disclose that limitation before enabling delivery.

## FR-A07 Access, retention and deletion

- Creator-private remains the default. An agent inbox is owner-private; workspace admins may emergency-stop capture without reading private mail/transcripts.
- External recap recipients receive an explicit per-meeting guest grant only where approved, verified against their email identity. Invite or recap receipt alone never grants access to other meetings or a workspace. Removed grants block subsequent link access immediately.
- Proposed retained-source defaults remain audio 30 days and transcript/minutes/actions 90 days; owners may shorten them. Proposed raw invitation payload retention is seven days after event finalization, while normalized schedule metadata lasts only as needed. Final policies and contact/legal copy need owner approval before live use.
- Deletion first tombstones and fences dispatch/capture/send, then removes source mail where retained, audio, transcripts, vectors, derived answers and unsent recap artifacts. Persist minimal non-content cleanup/delivery audit only under the approved policy. Mail-provider and recipient copies have separately disclosed limits.
- Agent/account deletion suspends the address and cancels future occurrences and unsent recaps. Workspace deletion affects its events; a user's agent address may remain for other active workspaces. Restore replays tombstones before dispatch, send or read access resumes.

## FR-A08 Interface and operational visibility

Reuse existing light/dark tokens and accessibility rules. Add:

| Route                    | Purpose and required states                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `/app/agent`             | Address/name, active/suspended/setup-required state, default workspace, organizer policy                 |
| `/app/inbox`             | Invitation list/detail; received, untrusted/needs approval, invalid, accepted, rejected, loop-suppressed |
| `/app/scheduled`         | Timezone-aware occurrence list/detail; scheduled, rescheduled, cancelled, conflict, missed, blocked      |
| `/app/meetings/:id`      | Capture status, consent/stop, transcript, cited minutes/actions, recipients and recap status             |
| `/app/settings/delivery` | Approved recipient policy, sender setup, guest-link access, suppression and delivery history             |

Add Inbox and Scheduled navigation alongside Meetings, Chat and Actions. This is a change from the original design's exclusions, not connected Google Calendar navigation. Account shows the user's agent; workspace settings retain membership/privacy/budgets. Extend the join dialog with Now/Scheduled and approved recipient selection. Show unavailable infrastructure honestly on every entry path.

All routes need loading, populated, empty, network error/retry, expired session, revoked access and mutation-conflict states. Test 390/768/1280 light/dark, 320px reflow, keyboard dialogs, screen reader spot checks and zoom. Samples must be conspicuously labelled and isolated from real agent mail or delivery evidence.
