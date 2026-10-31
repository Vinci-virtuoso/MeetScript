---
id: 013
title: Marketing pages for {{product}}: landing, about, terms, privacy
status: draft
deps: [012]
verify: "npm run dev:vars && npm run build && npm run db:migrate && npx playwright test tests/e2e/marketing.spec.ts"
budget: 8
scope_out: [".spec/design/*", "{{tokens_path}}", "migrations/*", "src/db/*", "src/server/*", "src/payments/*", "src/layouts/*", "src/site.ts"]
realizes: [FR-SHELL-1, FR-SHELL-2]
screens: [landing, about, terms, privacy]
skills: [app-shell, frontend]
---

> **Historical reference only — not an active MeetScript task.** The top-level PRD, architecture, DESIGN and CODEX-HANDOFF plus platform-kit/README.md override this recipe. Do not implement inherited billing/paid-plan behavior, meeting scheduling or factory-only dependencies. Adapt useful contracts; this snapshot is not a runnable application.

# 013 - Marketing pages for {{product}}: landing, about, terms, privacy

## Context
The public pages of {{product}}, built to the approved mockup: the landing at `/` (the hero with the product's one idea and one primary action, how it works, the pricing teaser when payments is selected, the FAQ, the final call to action), `/about`, `/terms` and `/privacy`. The screens are named in the app-shell skill's `screens:` list; the factory maps them to the design's screen ids. Follow the app-shell and frontend skills (Platform section of your prompt) and the Design section. Realizes FR-SHELL-1 and FR-SHELL-2; architecture section Routes.

## Acceptance criteria (Gherkin)
- **Given** a visitor opens `/` **when** the page renders **then** the hero is visible above the fold at 390 px and 1280 px with one `<h1>` and one primary action, followed by how it works, the pricing teaser when payments is selected, the FAQ and the final call to action, and the copy is the mockup's copy.
- **Given** a visitor opens `/about`, `/terms` or `/privacy` **when** the page renders **then** it carries the mockup's content for this product (the terms and the privacy text name the data stored, the processors and the retention), a `<title>` and a description, inside the shell.
- **Given** every page above at 390, 768 and 1280 px in light and dark **when** axe runs **then** there is no serious violation and the rendered HTML has no `<select` element and no inline `style=` attribute.

## Implementation notes
- `src/pages/index.astro`, `about.astro`, `terms.astro`, `privacy.astro` under the `App` layout. The kit has no reference file for these pages; the mockup artboards are the reference. The pricing teaser links to `/pricing` only when the payments skill is selected; otherwise the section is not rendered.
- Add the four rows to `PAGES` only if ticket 012 did not; do not change `src/site.ts` otherwise (it is out of scope).
- `tests/e2e/marketing.spec.ts` opens each page at the three widths and both themes, runs axe, checks the `<h1>` text and the primary action from the mockup, and saves a screenshot per page and viewport.
- Run the `better-interface` skill on the four pages before the screenshot step and fix every HIGH finding.

## Evidence
One screenshot per screen and viewport under the evidence folder of this ticket, named by the factory rule (screen id, state, mobile or desktop). The Playwright output in the ticket log is the proof for axe.
