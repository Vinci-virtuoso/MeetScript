# MeetScript personal meeting agents — revised specification

Version 1 · 7 November 2026 · product scope confirmed; technical proposals await implementation and live verification.

MeetScript gives each user an email-addressed meeting agent. Invite the agent by email/calendar invitation, or paste a Google Meet link. The agent attends an authorized meeting visibly, captures audio with consent, and automatically emails evidence-grounded minutes to an organizer-approved recipient list. A private notebook and authorized RAG retrieval retain the meeting's context.

## Confirmed decisions

| Decision            | First-release requirement                                              |
| ------------------- | ---------------------------------------------------------------------- |
| Agent ownership     | One agent address per user, with an application-managed inbox          |
| Invitation channels | Email with `.ics` calendar attachments, plus pasted Meet links         |
| Scheduling          | Immediate and scheduled joins; process event updates and cancellations |
| Recap delivery      | Automatic to an organizer-approved recipient list                      |
| Source of truth     | Actual audio → versioned transcript → cited minutes/actions            |
| Memory              | Authorized, cited questions within and across meetings                 |

The owner confirmed these decisions in this build conversation. No additional architecture attachment was available when this revision was authored. This folder records the confirmed decisions and explicit implementation proposals; it does not invent the contents of a missing document.

## Read order and precedence

1. [PRD.md](PRD.md) — product behavior and first-release boundaries.
2. [ARCHITECTURE.md](ARCHITECTURE.md) — identities, ingestion, scheduling, capture, processing and delivery.
3. [ACCEPTANCE.md](ACCEPTANCE.md) — requirement-to-evidence gates; nothing new is marked implemented.
4. [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) — phased work and release dependencies.

These files supersede the previous handoff's **mailbox deferral, immediate-only joining, ban on scheduling/meeting invitations, and auth-only outbound email restriction**. They also replace the proposed workspace-owned agent with the confirmed user-owned agent. Inherited implementation instructions must follow this revision for those topics.

`../cloudflare-rebuild/` remains an intact historical bundle with verified manifests. Its other requirements remain in force: Cloudflare application/capture runtime, explicit disclosure and consent, visible audio-only bot, private media, tenant isolation, no billing, no external capture fallback, no security bypass and no automatic production deployment. Its design tokens remain applicable; new routes/states are specified here. No Google Calendar OAuth connection is needed for the first release; users may send calendar invitations to the agent from their normal calendar.

## Current implementation boundary

Draft PR #4 contains a tested foundation and sample notebook. At the start of this revision, the real agent inbox, scheduler, Container capture, AI processing, retrieval and recap transport were not implemented. Existing tests (49 Worker/domain and 10 browser tests) verify the foundation, not this expanded product.

Specification changes do not enable capture, send invitations or recaps, provision mail routing, create Google identities, change DNS or deploy anything. `CAPTURE_ENABLED` stays false. See the acceptance gates for evidence required before claiming those features work.

## Revision validation

This documentation-only revision passed relative Markdown link checks, Markdown formatting, the targeted secret/file scan and `git diff --check`. Both original bundles still match all 146 handoff and 135 platform-kit hashes. Runtime suites were not rerun for Markdown-only changes; their existing passes remain foundation evidence only.
