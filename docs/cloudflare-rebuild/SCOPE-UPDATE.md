# Consolidated final scope decisions

The PRD, architecture, DESIGN and external Codex handoff now use the same scope. This file records decisions, not a temporary patch instructing readers to execute obsolete drafts. Product docs take precedence over the retained historical platform references.

## Approved core
- Custom MeetScript portfolio code; no Goshen repository, code or services.
- Google Meet pasted URL and immediate join only. No Google Calendar OAuth/connection or meeting invitation scheduling. Only verified active workspace members authorize joins; a URL or sender address alone cannot.
- Clearly named `MeetScript — recording`; explicit recording disclosure and consent procedure, host admission, microphone/camera off. Audio-only recording and transcription.
- Minutes: summary, decisions, unresolved questions and action items, each factual claim grounded in transcript evidence. Authorized search, Vectorize retrieval and cited chat remain core.
- Cloudflare-only runtime: custom Playwright/Chromium + virtual audio + FFmpeg in Cloudflare Containers, controlled by Durable Objects, with Workers/D1/R2/Queues/Workflows/Workers AI/Vectorize. No managed capture or external VM fallback.
- No billing, checkout, SaaS plans or subscriptions. Quotas/concurrency/storage/model budgets are operational safeguards only.
- Build in an external Codex environment, not this box or the Tropos factory. This packaging task changes no product repository and pushes nothing remotely.

## Optional deferred, not user-cancelled
Mailbox deferral was recommended but not explicitly approved by the user. An application-managed inbox remains optional deferred work, outside core acceptance and not required for URL capture. Do not claim the user cancelled it, build it silently, or add mandatory Email Routing/DNS/invitation dependencies. Workspace enrollment is distinct from meeting invitations. Retain kit email references for auth transactional delivery only.

## Feasibility gate remains unpassed by this handoff
The proposed media stack must first demonstrate actual consented Meet admission and playable received audio on Cloudflare Containers, with private R2 persistence, stop/cleanup and partial recovery evidence. A local run or Alook PR35/41 caption scraping is not audio proof. Confirm current Container lifetime/readiness/network/resource APIs. Persist chunks off ephemeral disk, use fenced sessions/heartbeats/deadlines and drain active sessions on rollout.

No stealth, CAPTCHA/2FA/security bypass, stolen/copy-pasted profiles or forced admission. Authentication-required/denied joins fail explicitly; no Google password input. If infeasible, report a blocker instead of substituting another hosting/provider model or claiming success.

## Superseded and removed
Earlier Recall.ai managed-capture, billing/Bachs, mandatory mailbox/invitation scheduling and external-hosting requirements are superseded, not alternatives. The `platform-kit/payments` subtree was removed from this bundle only; the source kit/product repositories were not changed. Remaining historical kit references are non-normative and must not reintroduce paid-plan routes or gates.

Sources retained: https://developers.cloudflare.com/containers/platform-details ; https://developers.cloudflare.com/containers/api/durable-object-container/ ; https://github.com/alookai/alook/pull/35 ; https://github.com/alookai/alook/pull/41 . Current platform feasibility must be verified during external implementation; no deployment is claimed here.
