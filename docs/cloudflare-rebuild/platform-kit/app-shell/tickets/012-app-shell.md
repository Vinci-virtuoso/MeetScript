---
id: 012
title: App shell for {{product}}: nav, footer, theme switch, SEO head, OG image, sitemap, robots, 404
status: draft
deps: [004, 006]
verify: "npm run dev:vars && npm run build && npm run db:migrate && npx vitest run tests/worker/seo.test.ts && npx playwright test tests/e2e/shell.spec.ts"
budget: 8
scope_out: [".spec/design/*", "{{tokens_path}}", "migrations/*", "src/db/*", "src/server/*", "src/payments/*"]
realizes: [FR-SHELL-3, FR-SHELL-4, FR-SHELL-7]
screens: [not-found]
skills: [app-shell, frontend]
---

> **Historical reference only — not an active MeetScript task.** The top-level PRD, architecture, DESIGN and CODEX-HANDOFF plus platform-kit/README.md override this recipe. Do not implement inherited billing/paid-plan behavior, meeting scheduling or factory-only dependencies. Adapt useful contracts; this snapshot is not a runnable application.

# 012 - App shell for {{product}}: nav, footer, theme switch, SEO head, OG image, sitemap, robots, 404

## Context
The shell every page of {{product}} renders inside: `src/site.ts` (the `SITE` and `PAGES` registry), `src/layouts/Base.astro` with the title, description, canonical and Open Graph head, `src/layouts/App.astro` with the skip link, the nav (signed-out and signed-in states, through the auth skill's `AccountMenu`), the header and the footer with the legal links and the theme switch as a shadcn `ToggleGroup`; the not-found page; `/sitemap.xml`, `/robots.txt` and the generated `/og.png`. Follow the app-shell and frontend skills (Platform section of your prompt) and the Design section. Realizes FR-SHELL-3, FR-SHELL-4 and FR-SHELL-7; architecture section Routes.

## Acceptance criteria (Gherkin)
- **Given** any page **when** Playwright reads its head **then** it has one `<title>`, a `<meta name="description">`, a canonical link and the `og:title`, `og:description`, `og:image` and `og:url` tags.
- **Given** the shell at 390, 768 and 1280 px in light and dark **when** axe runs **then** there is no serious violation, the skip link reaches `#main`, the nav shows Sign in and Sign up when signed out and the app links and the account menu when signed in, and the rendered HTML has no `<select` element.
- **Given** the footer theme switch **when** the user picks Dark **then** `data-theme="dark"` is on the root at once and holds on the next page; System removes it.
- **Given** an unknown path **when** the Worker answers **then** the status is 404 and the not-found page shows the way to the landing and to sign in; an unknown `/api/*` path answers the JSON `not_found` envelope.
- **Given** `/sitemap.xml` **when** a client requests it **then** every `PAGES` row with `sitemap: true` is listed and no other; `/robots.txt` names the sitemap and disallows `/app`, `/account`, `/api` and `/auth`; `/og.png` answers 200 `image/png`.

## Implementation notes
- Copy `src/layouts/Base.astro`, `src/layouts/App.astro`, `src/components/AccountMenu.tsx` and `src/scripts/account.ts` from the reference, then match them to the mockup's shell artboards. Replace the native theme select with `src/components/shell/ThemeSwitch.tsx` (shadcn `ToggleGroup`, three items, `aria-label="Theme"`).
- `src/components/shell/Nav.astro` and `Footer.astro` read `PAGES`; no link is written by hand.
- `scripts/og-image.mjs` renders `public/og.png` from `{{tokens_path}}` and `src/site.ts` with Playwright's Chromium; call it from the `build` script before `astro build` and commit the file.
- `src/pages/sitemap.xml.ts`, `public/robots.txt`, `src/pages/404.astro`.
- `tests/worker/seo.test.ts` and `tests/e2e/shell.spec.ts` (replace the frontend ticket's shell test) are the tests of this ticket.
- Run the `better-interface` skill on the shell before the screenshot step and fix every HIGH finding.

## Evidence
Screenshots of the not-found screen and of the shell on the landing at 390 px and 1280 px, light and dark, under the evidence folder of this ticket, named by the factory rule (screen id, state, mobile or desktop). The Playwright output in the ticket log is the proof for axe.
