# Local verification and next live gate

Current product scope: [personal-agent revision](../agent-infrastructure/README.md). This recovery runbook describes the foundation and G0 setup; use the revised architecture/plan for agent inboxes, scheduling, recipients and recap delivery. Those new integrations remain unimplemented.

## Local

1. Use Node 22.12+ and run `npm ci` from the root.
2. `npm run db:migrate` applies `migrations/0001_foundation.sql` to the local-only D1 database.
3. `npm run dev` opens the Astro notebook at localhost:4321. The local config intentionally has no remote AI or mail transport. Sign-in reports delivery unavailable.
4. Stop the dev server (`npx astro dev stop`) before `npm run verify`, whose browser server uses the built Worker on port 4321. Tests create disposable D1/R2/DO resources under Miniflare and use no real Meet.
5. Review source, `REPORT.md`, and screenshots before continuing. The test count is local foundation evidence, not product acceptance.

## Names-only configuration

Web local bindings: `DB`, `RECORDINGS`, `APP_ORIGIN`, `ENVIRONMENT`, `CONSENT_VERSION`, `CAPTURE_ENABLED=false`, `G0_PASSED=false`. These values do not enable a capture implementation.

Auth service contract: `MAILER.fetch('https://auth-mailer.internal/send')` receives JSON `{to, template: 'meetscript-otp', code, expiresMinutes}` over a private service binding. Implement an owner-approved transactional sender. Do not log the request. Fail delivery if the configured transport fails. Production needs `TURNSTILE_SECRET` and `TURNSTILE_SITE_KEY`, verified hostname/action, and a completed UI challenge integration.

Future jobs/control resources: separate D1 and private R2 by preview/prod, `MEETING_SESSION`, `WORKSPACE_USAGE`, a global capacity coordinator, ingestion queue/DLQ, bounded workflow, Workers AI models and Vectorize with verified dimensions. `wrangler.test.jsonc` is a test harness; `wrangler.local.jsonc` and generated local Wrangler output are not deployment configurations.

No Cloudflare secrets are configured in this environment. Securely configure `CLOUDFLARE_API_TOKEN` scoped to the authorized preview account and `CLOUDFLARE_ACCOUNT_ID` through environment settings. Do not paste them into chat or commit environment files. Start with a read-only verification of the token and account; saved draft settings do not prove runtime availability.

## G0 (blocked, not run)

G0 requires implementation of a minimal Cloudflare Container/DO runner plus authorized preview account capacity, exact resource budget, an approved recording disclosure/stop procedure, and an explicitly consenting test Meet. No real meeting has been joined by this recovery.

Official sources fetched successfully on 7 November 2026:

- https://developers.cloudflare.com/containers/get-started/
- https://developers.cloudflare.com/containers/api/durable-object-container/
- https://developers.cloudflare.com/containers/platform-details/

The current API docs distinguish `default` and `durable_object` scheduling policies. `container.start()` validates options and returns before port readiness; monitor startup and explicitly test readiness. With application-controlled scheduling, image and instance selection differ from older example code. Do not assume an old container library API is current. No image, size, lifetime, WebRTC network, or audio device behavior has been verified here.

For an authorized isolated preview, pin actual image digest and browser/FFmpeg versions; run visible `MeetScript — recording`, camera/mic off; fail closed for login/CAPTCHA/denial; admit only under the approved consent procedure; capture actual received speech; persist independently playable chunks to private R2 and listen back; prove stop/cleanup and partial upload recovery. Test hard loss, idle-without-UI lifetime and drained rollout. Store only redacted evidence pointers and exact environment/version/resource IDs in the acceptance report. Local tones, captions, silent media, mock audio, and health endpoints do not pass.

## Before release

Finish the missing integrations and security/tenant matrix, then real audio → transcript → cited minutes → authorized Vectorize chat → action edit → second-workspace denial → deletion/read-back. Include actual stop confirmation, audio range seeking, retention expiry, DLQ recovery and tombstone-aware restore. Complete screen reader/zoom/contrast checks and all UI states.

Deploy isolated preview only with owner authorization. Production requires separate approval and resources, real smoke/read-back, backward-compatible migrations, drain/rollback and restore evidence. No deployment command is provided while resource configuration and capture are incomplete, to avoid accidentally deploying local placeholders.
