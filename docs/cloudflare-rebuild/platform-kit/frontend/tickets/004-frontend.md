---
id: 004
title: Frontend foundation for {{product}}: Tailwind on tokens, shadcn, app shell
status: draft
deps: [001]
verify: "npm run dev:vars && npm run build && npm run db:migrate && npx playwright test tests/e2e/shell.spec.ts"
budget: 8
scope_out: [".spec/design/*", "{{tokens_path}}", "migrations/*", "src/db/*", "src/server/*"]
realizes: [FR-FE-1, FR-FE-2, FR-FE-3]
screens: []
skills: [frontend]
---

> **Historical reference only — not an active MeetScript task.** The top-level PRD, architecture, DESIGN and CODEX-HANDOFF plus platform-kit/README.md override this recipe. Do not implement inherited billing/paid-plan behavior, meeting scheduling or factory-only dependencies. Adapt useful contracts; this snapshot is not a runnable application.

# 004 - Frontend foundation for {{product}}: Tailwind on tokens, shadcn, app shell

## Context
The UI foundation of {{product}}: Tailwind v4 mapped onto the design tokens in `{{tokens_path}}` through `@theme inline reference`, the shadcn components under `src/components/ui/` with 44 px controls and the solid focus outline, the app shell `src/layouts/App.astro` with the skip link and the theme switch, the error boundary that reports to `POST /api/client-errors`, and the Playwright pattern at 390 px and 1280 px with axe. Follow the frontend skill (Platform section of your prompt) and the approved design's component inventory. Realizes FR-FE-1 to FR-FE-3; architecture section Front end and design system.

## Acceptance criteria (Gherkin)
- **Given** `src/styles/global.css` **when** the factory reads it **then** it maps every shadcn semantic name onto a `var(--color-*)` or other token from `{{tokens_path}}` and has no color literal and no font import.
- **Given** the shell page **when** Playwright opens it at 390 px and 1280 px **then** axe reports no serious violation, every control is at least 44 px tall at 390 px, and the skip link reaches `#main`.
- **Given** the theme switch **when** the user picks Dark **then** `data-theme="dark"` is set on the root and the page recolors from the dark token values with no `dark:` class.
- **Given** an island that throws **when** the page renders **then** the error boundary shows the error state, one report reaches `POST /api/client-errors`, and the rest of the page works.
- **Given** `src/` **when** the factory greps it **then** every file that imports `@base-ui/react` or `class-variance-authority` is under `src/components/ui/`.

## Implementation notes
- Copy `components.json`, `src/lib/utils.ts`, `src/styles/global.css`, `src/styles/font.css`, `src/components/ui/*.tsx`, `src/layouts/App.astro`, `src/components/ErrorBoundary.tsx`, `src/lib/report-error.ts` and `src/lib/format.ts` from the reference. Replace the shell links with the screen map and the token names with this design's.
- Pin every dependency shadcn adds. Do not add `input-otp`.
- `tests/e2e/shell.spec.ts` opens the shell at both viewports, runs axe, checks the control heights, forces the error boundary with a throwing test island or a mocked response, and saves a screenshot per viewport.

## Evidence
Screenshots of the shell at 390 px and 1280 px, light and dark, saved under the evidence folder of this ticket. The Playwright output in the ticket log is the proof for axe.
