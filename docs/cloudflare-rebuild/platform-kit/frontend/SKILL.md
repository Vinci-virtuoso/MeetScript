---
name: frontend
version: 1
needs: [scaffold]
secrets: []
bindings: []
screens: []
tickets: [004-frontend]
---

> **Historical reference only — not an active MeetScript task.** The top-level PRD, architecture, DESIGN and CODEX-HANDOFF plus platform-kit/README.md override this recipe. Do not implement inherited billing/paid-plan behavior, meeting scheduling or factory-only dependencies. Adapt useful contracts; this snapshot is not a runnable application.

# Platform skill: frontend

shadcn components on Tailwind v4, mapped onto the approved design tokens, inside Astro pages with React islands.

## Decision

- Framework: Astro 7 SSR pages with React 19 islands (`client:load`) for interactive parts. Pages in `src/pages/`, layouts in `src/layouts/` (`Base.astro` from the scaffold, `App.astro` the app shell).
- Components: shadcn (base, nova preset) as project files under `src/components/ui/` only. Product components in `src/components/`. `cn` from `src/lib/utils.ts`.
- Styling: Tailwind v4 with `@theme inline reference` in `src/styles/global.css` that maps shadcn's semantic names onto the design tokens in `/tokens.css` (the byte copy at `tokens_path`). No color literal, no new font, no redeclared token. Dark mode through `[data-theme="dark"]`, never `dark:` classes.
- Controls are 44 px tall on phone layouts: the shadcn `Button` and `Input` default sizes are changed once in the component files.
- Agent skills: `shadcn`, `better-ui`, `better-typography`, `better-colors`, `better-accessibility`, `better-layout`, `better-writing`, `better-interface`, `interface-review`, `state-machine`, `break` live in `.claude/skills/` (scaffold). A UI ticket runs `better-interface` on its screens before the screenshot step and fixes every HIGH finding.
- Errors: `src/components/ErrorBoundary.tsx` around every island, reporting to `POST /api/client-errors` through `src/lib/report-error.ts`.
- Tests: Playwright at 390 px and 1280 px with axe (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`) on every state, screenshots as evidence.

## Recipe

1. `npx shadcn@latest init -b base -p nova --css-variables --no-pointer --no-rtl -y </dev/null`, then delete the `@theme inline` block, the `:root` and `.dark` color literals and the Geist import it appended; uninstall `@fontsource-variable/geist`; pin the dependencies it added to the installed versions. Or copy `components.json`, `src/lib/utils.ts` and `src/styles/global.css` from `reference/` and skip init.
2. `src/styles/global.css` from `reference/`: the `@theme inline reference` mapping. Change the right side of each line to the product's token names from `.spec/design/tokens.css`; keep every left side shadcn uses, plus `--radius-2xl..4xl` and `--font-heading`.
3. `npx shadcn@latest add button input label field card alert badge separator skeleton spinner empty -y -o </dev/null`, or copy `src/components/ui/*.tsx` from `reference/` (they already carry the 44 px sizes and the 2 px solid focus outline).
4. `src/layouts/App.astro` from `reference/`: the shell (wordmark, links, account control, theme switch, skip link). Replace the links with the product's screen map.
5. `src/components/ErrorBoundary.tsx`, `src/lib/report-error.ts`, `src/lib/format.ts`.
6. `tests/e2e/kit-screens.spec.ts` is the pattern for a screen test: both viewports, every state forced with mocked responses, axe, a screenshot per state.

## Contract

- `import { Button } from "@/components/ui/button"` and the same for `input`, `label`, `field`, `card`, `alert`, `badge`, `separator`, `skeleton`, `spinner`, `empty`. A component built from `@base-ui/react` or `class-variance-authority` lives under `src/components/ui/`.
- Colors in UI code are Tailwind utilities that resolve to tokens (`bg-background`, `text-text-muted`, `border-border`) or `var(--color-*)`. Never a hex, rgb, hsl or oklch value.
- A link styled as a button is `<Button render={<a href="..." />}>`, not `asChild`.
- Loading containers carry `role="status"`; skeletons are `aria-hidden`.
- Every island with controlled inputs sets `data-ready="true"` after hydration.
- Page scripts are `<script>import "../scripts/x.ts"</script>`, never `is:inline`, so the CSP hash covers them.

## Platform FRs

- **FR-FE-1 Tokens only.** Given any UI file, when the factory checks it, then it has no color literal and the app's tokens file equals `.spec/design/tokens.css`.
- **FR-FE-2 Accessible at both widths.** Given every screen and state, when the Playwright suite runs at 390 px and 1280 px, then axe reports no serious violation and every control is at least 44 px tall on the phone layout.
- **FR-FE-3 Errors are reported.** Given an island throws while rendering, when the user sees the error state, then one report reaches `POST /api/client-errors` and the rest of the page keeps working.

## Pitfalls

- Load `/tokens.css` with a `<link>` and map names in `@theme inline reference`, because importing the tokens into the Tailwind entry or redeclaring colors in `@theme` breaks `[data-theme="dark"]` and creates a `--color-border: var(--color-border)` cycle.
- Run `npx shadcn@latest init -b base -p nova --css-variables --no-pointer --no-rtl -y </dev/null`, because `init` prompts for a preset even with `-y` and hangs an unattended agent; `-d` picks the Next template and is wrong for Astro.
- Delete the `@theme inline` block, the `:root` and `.dark` oklch literals and the Geist import that `init` appends, because they are color literals and a new font the design forbids.
- Pin the dependencies `init` adds (`@base-ui/react`, `class-variance-authority`, `cn`, `lucide-react`, `shadcn`, `tw-animate-css`), because it writes them with `^`.
- Use `npx shadcn@latest add <names> -y -o </dev/null`, because `add` needs `components.json` and the flags keep it non-interactive.
- Write page scripts as `<script>import "../scripts/x.ts"</script>`, because Astro hashes its own hydration scripts for the CSP but not `is:inline` scripts.
- Do not add `input-otp`; the code screen is one `<input inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}">`, because `style-src 'self'` blocks the inline styles `input-otp` uses. Check `grep -c 'style="'` is 0 on every rendered page.
- Change the default size of `Button` and `Input` to `h-11` once in the component files, because the Nova preset sizes controls at 32 px and the design says 44 px; do not sprinkle `h-11` in pages.
- In DOM code use `appendChild` and `replaceChildren`, because `@cloudflare/workers-types` declares an HTMLRewriter `Element.append` that shadows the DOM one under `astro check`.
- Keep `@source "../"` in the Tailwind entry, because the Vite plugin scans only the files it imports and islands referenced from pages that do not import the CSS lose classes.
- Give loading containers `role="status"` instead of `aria-label` on a plain `div`, because axe reports `aria-prohibited-attr`.
- Wait for `data-ready="true"` in tests before typing into an island, because Playwright can type before React hydrates.
- Keep the focus ring a 2 px solid outline of `--color-focus` offset 2 px and never `outline-none`, because shadcn's 50% alpha ring does not reach 3:1.
- Validate on submit and keep the submit button enabled, because a button disabled until the form is valid gives no feedback on why.
- Keep `transition` to named properties and `transform` and `opacity`, because animating layout properties causes layout shift.
