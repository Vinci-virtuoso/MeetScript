# MeetScript

A quiet meeting notebook with precise evidence and visible recording controls.

This is the recovery rebuild of [Vinci-virtuoso/MeetScript](https://github.com/Vinci-virtuoso/MeetScript). The previous cloud session reported an unpushed implementation; that source was not present in the surviving repository. This branch rebuilds from the checked-in specifications in `docs/cloudflare-rebuild`.

**Status: foundation and sample notebook implemented; live capture and AI integration unavailable. Nothing deployed.** The earlier session's test results are historical and are not evidence for this source tree.

## Run locally

Use Node 22.12+ and npm. Dependencies are pinned in `package-lock.json`.

```sh
npm ci
npm run db:migrate
npm run dev
```

Open `http://localhost:4321` or `/sample`. Sample actions persist under sample-only browser storage keys. Private routes use the API and never substitute sample data on errors.

In restricted cloud environments, use writable cache/config directories and disable optional telemetry:

```sh
export npm_config_cache=/tmp/meetscript-npm
export XDG_CONFIG_HOME=/tmp/meetscript-config
export ASTRO_TELEMETRY_DISABLED=1
npm ci
npm run verify
```

`npm run verify` runs type checks, formatting checks, a targeted secret/file scan, 49 domain/Worker/D1/Durable Object tests, production build, and Playwright/axe checks. Browser tests use the **built Worker** through local Wrangler, with `/usr/bin/chromium` by default. Set `CHROMIUM_PATH` to another installed Chromium executable. Tests save reproducible route screenshots under `docs/implementation/screenshots`. Stop an existing dev server before verification so port 4321 is free (`npx astro dev stop`). These tests use fixture data and do not pass live acceptance.

## Implemented in this recovery

- Astro/React interface with self-hosted Inter, light/dark/system themes, responsive navigation, native dialogs, and keyboard tabs.
- Labelled, isolated sample overview, meetings, minutes, transcripts, cited answers, action edits, and settings; honest audio-unavailable states.
- Hono API, D1 migration, verified email OTP contracts, rotating access/refresh sessions, active membership checks, creator-private meeting ACLs, revision-checked actions, and workspace settings.
- Same-origin mutation checks, rate limits, bounded JSON bodies, generic private-resource failures, and private no-store responses.
- Strict Meet URL validation and affirmative disclosure schema; join always fails closed until capture is implemented and G0 is passed.
- Durable Object prototypes for serialized workspace quota reservations and fenced session/stop events. These are tested in workerd, but not connected to a live Container.
- Immediate meeting tombstones and bounded, retryable cleanup for the locally implemented content. Cleanup refuses to claim success for unverified live sessions or Vectorize integration.

## Still required

Actual Cloudflare Container capture, global quota coordination, ingestion, real Workers AI transcription/minutes, Vectorize retrieval, complete exports/range playback, membership enrollment/revocation UI, account/workspace deletion, automatic retention, operational recovery/drain/restore, and live preview acceptance remain unfinished. See `docs/implementation/REPORT.md` and the original acceptance checklist. Do not enable capture by changing flags.

Email OTP needs an owner-approved `MAILER` service binding. There is no development endpoint that exposes codes. Deployed authentication also requires configured Turnstile. The UI integration for the Turnstile challenge remains pending, so deployed sign-in is not release-ready.

## Configuration and authorization

`wrangler.local.jsonc` contains local-only names and a placeholder D1 ID; **do not deploy it**. No production or preview resource IDs are inherited. Cloudflare credentials belong in environment secret settings, never source files or chat. Names: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; app bindings are documented in `docs/implementation/RUNBOOK.md`.

The current environment does not contain the previous environment's saved draft credentials. A real consented test meeting and approved disclosure/stop procedure are required for G0. No production DNS, purchases, or deployment have been performed.

## Legacy and specifications

The original Next.js/Python prototype is preserved under `legacy/` for historical inspection and is not part of the runtime. Tracked environment and bytecode files were removed from the future tree; history was not rewritten. Rotate any credentials previously committed to the public repository.

The specification/reference bundle remains untouched and both SHA-256 manifests were verified (146 handoff files; 135 platform reference files). Bundled historical kit recipes are inactive reference material. No billing, Calendar, managed capture provider, or external VM is included in the rebuilt runtime.
