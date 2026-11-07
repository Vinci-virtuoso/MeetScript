---
id: 006
title: Sign-in screens for {{product}}: email, code, signed in, signed out
status: draft
deps: [004, 005]
verify: "npm run dev:vars && npm run build && npm run db:migrate && npx playwright test tests/e2e/auth-screens.spec.ts"
budget: 8
scope_out: [".spec/design/*", "{{tokens_path}}", "migrations/*", "src/db/*", "src/server/*"]
realizes: [FR-AUTH-1, FR-AUTH-2, FR-AUTH-3, FR-AUTH-5, FR-AUTH-6]
screens: [sign-in, code, signed-in, signed-out]
skills: [auth, frontend]
---

> **Historical reference only — not an active MeetScript task.** The top-level PRD, architecture, DESIGN and CODEX-HANDOFF plus platform-kit/README.md override this recipe. Do not implement inherited billing/paid-plan behavior, meeting scheduling or factory-only dependencies. Adapt useful contracts; this snapshot is not a runnable application.

# 006 - Sign-in screens for {{product}}: email, code, signed in, signed out

## Context
The sign-in screens of {{product}}, built to the approved mockup: the email step (`sign-in`: default, sign-up, error, loading), the code step (`code`: default, wrong-code, expired, too-many-attempts, loading), and the app shell's account control in its `signed-in` and `signed-out` states. The screens are named in the auth skill's `screens:` list; the factory maps them to the design's screen ids. Follow the auth and frontend skills (Platform section of your prompt) and the Design section. Realizes FR-AUTH-1, FR-AUTH-2, FR-AUTH-3, FR-AUTH-5 and FR-AUTH-6 on the screen; architecture section Front end and design system.

## Acceptance criteria (Gherkin)
- **Given** the visitor arrives from the Sign up link (`/sign-in?intent=signup`) **when** the page renders **then** it shows the sign-up state (the heading and copy of creating an account) with the same email form.
- **Given** the sign-in screen **when** the visitor submits a valid email **then** the code screen shows the address and the cooldown; an invalid email shows the error state next to the field and the submit stays enabled.
- **Given** the code screen **when** the visitor enters the right code **then** they land on `next`; a wrong code shows the wrong-code state; an expired code shows the expired state with a way to send a new code; the fifth wrong code shows the too-many-attempts state.
- **Given** the code screen **when** the visitor waits for the cooldown **then** the resend control becomes active and sends a new code.
- **Given** a signed-in user **when** any page loads **then** the shell shows the signed-in state (email, sign out) and after Sign out it shows the signed-out state with the sign-in link.
- **Given** GitHub is configured **when** the sign-in screen renders **then** Continue with GitHub is shown; when it is not, it is hidden.
- **Given** Google is configured **when** the sign-in screen renders **then** Continue with Google is shown and links to `/auth/web/google/start` with the `next` path; when it is not, it is hidden.
- **Given** a failed Google or GitHub sign-in **when** the visitor lands on `/sign-in?provider=<provider>&error=<code>` **then** the error state names the provider and offers the email code.
- **Given** every state above at 390 px and 1280 px **when** axe runs **then** there is no serious violation, and the rendered pages carry no inline `style=` attribute.

## Implementation notes
- Copy `src/components/SignIn.tsx`, `src/components/AccountMenu.tsx`, `src/pages/sign-in.astro` and `src/scripts/account.ts` from the reference, then match them to the mockup markup and copy. Add the version 3 Google button as the auth skill's recipe says: the page passes `githubEnabled` and `googleEnabled`. The code input is one `<input inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}">`.
- Islands set `data-ready="true"` after hydration; the tests wait for it.
- `tests/e2e/auth-screens.spec.ts` uses the reference helpers (`signIn`, `lastCode`, `useDevIp`), forces each state with mocked responses, runs axe at both viewports and saves a screenshot per state.
- Run the `better-interface` skill on the four screens before the screenshot step and fix every HIGH finding.

## Evidence
One screenshot per screen, state and viewport under the evidence folder of this ticket, named by the factory rule (screen id, state, mobile or desktop). The Playwright output in the ticket log is the proof for axe.
