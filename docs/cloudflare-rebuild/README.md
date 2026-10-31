# MeetScript — ready-to-transfer specification bundle

## Start here
Unpack this folder beside your external Codex checkout of https://github.com/Vinci-virtuoso/MeetScript. Give Codex CODEX-HANDOFF.md as its task brief and make the complete folder available. This folder is documentation and reference code, not an implemented application.

Read order:
1. SCOPE-UPDATE.md — consolidated scope, not an obsolete patch.
2. PRD.md — functional requirements and acceptance criteria.
3. architecture.md — custom Cloudflare Containers capture and Cloudflare application architecture.
4. DESIGN.md — exact design tokens, routes, responsive layouts and UI states.
5. REQUIREMENTS-CHECKLIST.md — implementation evidence gates, initially unchecked.
6. platform-kit/README.md — boundaries for using historical platform reference source.

## Final core
Paste Google Meet URL → verified workspace member authorizes visible bot → custom Cloudflare Container captures audio → private R2 → Workers AI transcript/minutes → Vectorize-backed cited chat and editable actions.

No payments, billing, Google Calendar integration, managed meeting-bot provider, external VM or Goshen dependency. Mailbox is deferred and not required for the core demonstration; do not silently add it. Retain transactional auth email.

## Important limitation
Actual Google Meet admission and audio capture on Cloudflare Containers must be demonstrated first (G0). The package does not prove runtime feasibility or deployment. If G0 fails, report the blocker rather than switching infrastructure or presenting fixtures as live recording.

## Contents and integrity
- theme.css and tokens.json are generated from DESIGN.md. They expose named light/dark palette tokens; the implementation must map semantic theme variables to those tokens according to DESIGN.md, not assume the export implements theme switching.
- platform-kit/manifest.json hashes the included reference files.
- HANDOFF-MANIFEST.json hashes every file in this folder except itself.
- HANDOFF-VALIDATION.md reports documentation/package checks only.

Use the rebuilt MeetScript-handoff.zip, not an earlier archive. No secrets or environment files should be copied into the implementation. Never reuse historical deployment IDs or product-specific code from the reference snapshot. No production deployment or DNS changes are authorized by this bundle.
