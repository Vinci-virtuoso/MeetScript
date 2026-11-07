---
name: app-shell
version: 1
needs: [scaffold, frontend, auth]
secrets: []
bindings: []
screens: [landing=default, about=default, terms=default, privacy=default, not-found=default, home=default+first-run+empty+loading+error, account=default+loading+error]
tickets: [012-app-shell, 013-marketing-pages, 014-home-account]
---

> **Historical reference only — not an active MeetScript task.** The top-level PRD, architecture, DESIGN and CODEX-HANDOFF plus platform-kit/README.md override this recipe. Do not implement inherited billing/paid-plan behavior, meeting scheduling or factory-only dependencies. Adapt useful contracts; this snapshot is not a runnable application.

# Platform skill: app-shell

The complete application around the product's working screens: the marketing pages, the shell (nav, header, footer, layout), the signed-in start page, the account page, and what every page needs to be found and shared.

## Decision

- Every product with a UI is a complete application, not a set of working screens. The design draws the pages below, the plan routes them, the build ships them. A product that does not want one of them raises a `needs-decision` with the reason.
- Marketing pages, public: `landing` at `/` (a hero with the product's one idea, how it works in three steps, a pricing teaser when the payments skill is selected, a FAQ, a final call to action), `about` at `/about` (who makes it and how to reach them: a mail link or a form; a product that wants a separate contact page adds it as a product screen), `terms` at `/terms`, `privacy` at `/privacy`, `not-found` (`src/pages/404.astro`, served for every unknown path), and `pricing` at `/pricing` when payments is selected (the payments skill fixes that screen).
- The shell, on every page: `nav` with the wordmark, the page links, and the account control (signed out: Sign in and Sign up; signed in: the app links and the account menu), `header` (the page title area), `footer` (the page links, the legal links, the theme switch). The theme switch is a proper control (a shadcn `ToggleGroup` with Light, Dark, System, or a `DropdownMenu`), never a native `<select>`. Layouts hold at 390, 768 and 1280 px, in light and dark.
- App pages, behind sign-in: `home` at `/app` (the signed-in start page: `first-run` on the first visit, `empty` when the user has no data, `default` with data, `loading`, `error`), the product's own screens, `account` at `/account` (the profile, the sessions list, Sign out everywhere), and `manage-plan` at `/account/plan` and `billing-history` at `/account/billing` when payments is selected (the payments skill fixes those screens).
- Auth pages come from the auth skill: `sign-in` at `/sign-in` (the same page in its `sign-up` state when the visitor comes from Sign up), `code`, `signed-in`, `signed-out`.
- Every page has a stable route, a `<title>`, a meta description, a canonical URL, the Open Graph tags with one image per product (`/og.png`, generated from the design tokens at build time), a row in `/sitemap.xml` when it is public, and `/robots.txt` names the sitemap and disallows `/app`, `/account`, `/api` and `/auth`.
- One registry drives the shell: `src/site.ts` exports `SITE` (name, tagline, description, origin) and `PAGES` (path, title, description, auth, nav group, sitemap flag). The nav, the footer, the sitemap and the architecture's Routes table all read from it, so a page cannot exist in one and be missing in another.
- Shell components are shadcn, as project files under `src/components/ui/` (frontend skill): `button`, `input`, `field`, `card`, `dialog`, `dropdown-menu`, `toggle-group`, `toast`, `skeleton`, `empty`, `separator`, `badge`. The nav, footer and layout are Astro components in `src/components/shell/`.

## Recipe

1. `src/layouts/Base.astro` from `reference/` is the head of every page. Add to it: `<meta name="description">` from the page, `<link rel="canonical">`, the Open Graph tags (`og:title`, `og:description`, `og:image` = `${SITE.origin}/og.png`, `og:url`, `og:type`) and `twitter:card`. The page passes `title` and `description`; `Base` falls back to `SITE` values.
2. `src/layouts/App.astro` from `reference/` becomes the shell for every page: the skip link, `<header>` with the wordmark, `<nav aria-label="Pages">` from `PAGES`, the account control (`AccountMenu` from `reference/`, through the auth skill), `<main id="main">`, and `<footer>` with the page links, the legal links (Terms, Privacy, About) and the theme switch. Replace the reference's native `<select id="theme">` with the shadcn `ToggleGroup` (Light, Dark, System) wired to the same `data-theme` behaviour; the native select is forbidden in app markup.
3. `src/site.ts`: `SITE` and `PAGES`, with one row per route of the architecture's Routes table. `src/components/shell/Nav.astro`, `Footer.astro` and `ThemeSwitch.tsx` read it.
4. Marketing pages, as the mockup draws them: `src/pages/index.astro` (landing), `about.astro`, `terms.astro`, `privacy.astro`, `404.astro`. The landing hero holds the `<h1>` with the product's one idea and the one primary action. Terms and privacy are real documents for this product (what data is stored, where, for how long, who the processor is: Cloudflare, Bachs and Mailysend when selected), not placeholders. The kit has no reference file for these pages; the mockup is the reference.
5. `src/pages/sitemap.xml.ts`: an Astro endpoint that lists every `PAGES` row with `sitemap: true` as `<url><loc>`. `public/robots.txt`: `User-agent: *`, `Disallow: /app`, `/account`, `/api`, `/auth`, and `Sitemap: <origin>/sitemap.xml`. No reference file; the shapes above are the contract.
6. `scripts/og-image.mjs`: reads `{{tokens_path}}` and `src/site.ts`, writes `public/og.png` (1200 by 630) by rendering one HTML page with the product's background, accent and font tokens and the name and tagline, with Playwright's Chromium (already a dev dependency). Run it from the `build` script before `astro build`. Commit the generated file so a deploy without Playwright still serves it. No reference file.
7. App pages: `src/pages/app/index.astro` (home) and `src/pages/account/index.astro` (account), each a React island under the `App` layout, loaded through `apiFetch` (auth skill). Home reads the product's own list endpoint for its data; `first-run` shows when `GET /api/me` has `isNewUser` or the user has no data and has not dismissed the welcome; `empty` after that. Account shows the email, the joined date, the sessions from `GET /api/me/sessions`, and Sign out everywhere (`POST /auth/web/logout-all`).
8. Server side for the account page (auth skill version 2): `src/db/sessions.ts` reads loginbase's `sessions` table (`id`, `created_at`, `last_used_at`, `user_agent`, `revoked_at` where `user_id = ?` and `revoked_at IS NULL`; read only, loginbase owns the writes), `GET /api/me/sessions` behind `requireUser()`, and `POST /auth/web/logout-all` in `src/server/auth/web.ts` that calls loginbase's `DELETE /auth/sessions/all` in-process and clears the cookie. Mark the sessions lookup with `// @system loginbase table` for the authz check.
9. Tests: `tests/e2e/shell.spec.ts` (frontend skill, extended): every public page at 390, 768 and 1280 px, light and dark, axe, `<title>` and the description present, no `<select` in the rendered HTML, exactly one `<h1>`, the skip link, the theme switch changes `data-theme`. `tests/worker/seo.test.ts`: `/sitemap.xml` lists every public `PAGES` row and nothing else, `/robots.txt` names the sitemap, `/og.png` answers 200 `image/png`, an unknown path answers 404 with the not-found page.

## Contract

- `SITE: { name, tagline, description, origin }` and `PAGES: Array<{ path, title, description, auth: "public" | "user" | "pro", nav: "marketing" | "app" | "legal" | "none", sitemap: boolean }>` in `src/site.ts`. Every route in the architecture's Routes table has a row.
- `Base.astro` props: `title`, `description`, optional `canonical`, optional `noindex`. It renders the `<title>` as `<page title> | <SITE.name>` (the landing: `<SITE.name>: <SITE.tagline>`), the description, the canonical link and the Open Graph and Twitter tags on every page.
- `App.astro` props: `title`, `description`, `current` (the `PAGES` path), optional `wide`. It renders the shell around `<slot />`.
- `GET /sitemap.xml` answers `application/xml` with one `<url>` per public page. `GET /robots.txt` answers `text/plain`. `GET /og.png` answers `image/png`, 1200 by 630.
- `GET /api/me/sessions` answers `{ sessions: [{ id, createdAt, lastUsedAt, userAgent, current }] }` for the signed-in user. `POST /auth/web/logout-all` revokes every session of the user and clears the cookie, 204.
- An unknown path answers 404 with the not-found page; `/api/*` unknown paths answer the JSON error envelope `not_found`.
- The theme switch sets `data-theme` on `<html>` to `light`, `dark` or removes it for `system`, and remembers the choice in `localStorage` under `theme`.

## Platform FRs

- **FR-SHELL-1 Landing.** Given a visitor opens `/`, when the page renders, then they see the hero with the product's one idea and one primary action, how it works, the pricing teaser when payments is selected, the FAQ and the final call to action, with the nav in its signed-out state and the footer.
- **FR-SHELL-2 Legal and about pages.** Given a visitor opens `/about`, `/terms` or `/privacy`, when the page renders, then it carries real content for this product, a `<title>`, a description and the shell.
- **FR-SHELL-3 Not found.** Given a visitor opens an unknown path, when the Worker answers, then the status is 404 and the not-found page offers the way to the landing and to sign in.
- **FR-SHELL-4 Found and shared.** Given any page, when a crawler or a link preview reads it, then it finds the title, the description, the canonical URL and the Open Graph image; `/sitemap.xml` lists every public page and `/robots.txt` names the sitemap and disallows the app, account, API and auth paths.
- **FR-SHELL-5 Home.** Given a signed-in user opens `/app`, when they have no data on their first visit, then they see the first-run state with the one next step; when they have no data later, the empty state; when they have data, the default state; a slow load shows the skeleton and a failed load the error state with a retry.
- **FR-SHELL-6 Account.** Given a signed-in user opens `/account`, when the page renders, then they see their email, the sessions list with the current one marked, and Sign out everywhere; when they choose it, every session is revoked and the shell shows the signed-out state.
- **FR-SHELL-7 Theme.** Given any page, when the user picks Light, Dark or System in the footer control, then the page recolors from the tokens of that theme at once and the choice holds on the next page.

## Pitfalls

- Replace the reference's native `<select>` theme control with the shadcn `ToggleGroup`, because a native select cannot be styled from the tokens and Vinci rejects it on sight; the design lint and this skill's check both refuse `<select` in app markup.
- Put no helper sentence under a field unless the field is in error, because a permanent hint under every field is noise; the label and the placeholder carry the meaning.
- Show the account menu with the user's name or initials and the email on the account page only, because a raw email string in the nav reads as a debug view.
- Generate `public/og.png` at build time and commit it, because the Worker has no image renderer and a link preview without an image is the first thing a user sees of the product.
- List only public pages in the sitemap and disallow `/app`, `/account`, `/api` and `/auth` in `robots.txt`, because an indexed app page is a 401 for the crawler and a leak of route names.
- Give the landing one `<h1>` and one primary action, because two filled primary actions in one view split the user's attention and the interface review marks it HIGH.
- Read `PAGES` for the nav and the footer instead of writing the links by hand, because a page added in one place and missing in the other is a broken application.
- Keep the account control a `<div role="group" aria-label="Account">` on a page whose tests forbid a second `<nav>`, because axe counts landmark duplicates.
