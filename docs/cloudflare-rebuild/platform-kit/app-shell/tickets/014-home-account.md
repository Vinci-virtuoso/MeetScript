---
id: 014
title: Home and account pages for {{product}}: first run, empty, sessions, sign out everywhere
status: draft
deps: [012]
verify: "npm run dev:vars && npm run build && npm run db:migrate && npx vitest run tests/worker/sessions.test.ts && npx playwright test tests/e2e/home-account.spec.ts"
budget: 8
scope_out: [".spec/design/*", "{{tokens_path}}", "migrations/*", "src/payments/*", "src/layouts/*", "src/site.ts"]
realizes: [FR-SHELL-5, FR-SHELL-6]
screens: [home, account]
skills: [app-shell, auth, frontend]
---

> **Historical reference only — not an active MeetScript task.** The top-level PRD, architecture, DESIGN and CODEX-HANDOFF plus platform-kit/README.md override this recipe. Do not implement inherited billing/paid-plan behavior, meeting scheduling or factory-only dependencies. Adapt useful contracts; this snapshot is not a runnable application.

# 014 - Home and account pages for {{product}}: first run, empty, sessions, sign out everywhere

## Context
The signed-in start page of {{product}} at `/app` (`home`: default, first-run, empty, loading, error) and the account page at `/account` (`account`: default, loading, error) with the profile, the sessions list and Sign out everywhere, built to the approved mockup. Server side: `GET /api/me/sessions` from loginbase's `sessions` table and `POST /auth/web/logout-all`. The screens are named in the app-shell skill's `screens:` list; the factory maps them to the design's screen ids. Follow the app-shell, auth and frontend skills (Platform section of your prompt) and the Design section. Realizes FR-SHELL-5 and FR-SHELL-6; architecture section Routes.

## Acceptance criteria (Gherkin)
- **Given** a signed-out visitor opens `/app` or `/account` **when** the page loads **then** they are sent to `/sign-in?next=<path>`.
- **Given** a signed-in user with no data on their first visit **when** `/app` renders **then** the first-run state shows the one next step; on a later visit with no data the empty state; with data the default state; a slow load the skeleton; a failed load the error state with a retry that works.
- **Given** a signed-in user opens `/account` **when** the page renders **then** it shows the email, the joined date and the sessions list with the current session marked; a failed load shows the error state.
- **Given** the user chooses Sign out everywhere **when** the request completes **then** `POST /auth/web/logout-all` answered 204, every session row of the user is revoked, the cookie is cleared and the shell shows the signed-out state.
- **Given** `GET /api/me/sessions` **when** called with a valid Bearer token **then** it answers the user's live sessions and nothing of another user; without a token it answers 401.
- **Given** every state above at 390 px and 1280 px **when** axe runs **then** there is no serious violation and the rendered pages carry no inline `style=` attribute and no `<select` element.

## Implementation notes
- `src/db/sessions.ts` (read only on loginbase's `sessions` table, marked `// @system loginbase table`), `GET /api/me/sessions` in `src/server/routes/me.ts` behind `requireUser()`, `POST /auth/web/logout-all` in `src/server/auth/web.ts` calling loginbase's `DELETE /auth/sessions/all` in-process, then `clearSessionCookie`. List both routes in `ROUTES`.
- `src/pages/app/index.astro` and `src/pages/account/index.astro` under the `App` layout, with `src/components/Home.tsx` and `src/components/Account.tsx` as islands (`apiFetch`, `data-ready`, `ErrorBoundary`). The kit has no reference file for these pages; the mockup is the reference.
- `tests/worker/sessions.test.ts`: the sessions list per user, 401 without a token, logout-all revokes every row. `tests/e2e/home-account.spec.ts` forces each state with mocked responses, runs axe at both viewports and saves a screenshot per state.
- Run the `better-interface` skill on the two pages before the screenshot step and fix every HIGH finding.

## Evidence
One screenshot per screen, state and viewport under the evidence folder of this ticket, named by the factory rule (screen id, state, mobile or desktop). The Playwright output in the ticket log is the proof for axe.
