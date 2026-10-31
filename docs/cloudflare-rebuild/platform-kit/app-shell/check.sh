#!/usr/bin/env bash
# platform/app-shell/check.sh <product-repo> <ticket-file>
# The complete application is in place: the site registry, the marketing and not-found pages, the
# sitemap endpoint, robots.txt, the OG image, the SEO head in the base layout; no native <select>
# and no permanent field helper text in app markup. Exit 0 = ok, else reasons and exit 1.
set -uo pipefail
r="$1"; cd "$r" || { echo "no repo $r"; exit 1; }
bad=""
add() { bad+="$1"$'\n'; }
[ -d src ] || { echo "app-shell: no src/ folder"; exit 1; }

[ -f src/site.ts ] || add "app-shell: src/site.ts is missing (SITE and PAGES drive the nav, the footer and the sitemap)"
if [ -f src/site.ts ]; then
  grep -qE 'export const SITE\b' src/site.ts || add "app-shell: src/site.ts does not export SITE"
  grep -qE 'export const PAGES\b' src/site.ts || add "app-shell: src/site.ts does not export PAGES"
fi
for p in src/pages/index.astro src/pages/about.astro src/pages/terms.astro src/pages/privacy.astro src/pages/404.astro; do
  [ -f "$p" ] || add "app-shell: $p is missing"
done
[ -f src/pages/sitemap.xml.ts ] || [ -f src/pages/sitemap.xml.js ] || add "app-shell: src/pages/sitemap.xml.ts is missing"
[ -f public/robots.txt ] || add "app-shell: public/robots.txt is missing"
if [ -f public/robots.txt ]; then
  grep -qi '^Sitemap:' public/robots.txt || add "app-shell: public/robots.txt does not name the sitemap"
  for d in /app /account /api /auth; do grep -qE "^Disallow:[[:space:]]*$d" public/robots.txt || add "app-shell: public/robots.txt does not disallow $d"; done
fi
[ -f public/og.png ] || add "app-shell: public/og.png is missing (scripts/og-image.mjs generates it from the tokens; commit it)"
if [ -f src/layouts/Base.astro ]; then
  grep -q 'name="description"' src/layouts/Base.astro || add "app-shell: src/layouts/Base.astro has no meta description"
  grep -q 'og:image' src/layouts/Base.astro || add "app-shell: src/layouts/Base.astro has no og:image tag"
  grep -q 'rel="canonical"' src/layouts/Base.astro || add "app-shell: src/layouts/Base.astro has no canonical link"
else
  add "app-shell: src/layouts/Base.astro is missing"
fi
# No native select in app markup (shadcn components under src/components/ui/ are the only exception).
sel=$(grep -rnE '<select\b' src/pages src/layouts src/components src/scripts 2>/dev/null | grep -v '^src/components/ui/' | head -3)
[ -z "$sel" ] || add "app-shell: native <select> in app markup (use the shadcn Select, DropdownMenu or ToggleGroup):"$'\n'"$sel"
# No permanent helper text under a field: FieldDescription is the shadcn helper slot.
hint=$(grep -rnE '<FieldDescription\b|data-slot="field-description"' src/pages src/layouts src/components 2>/dev/null | grep -v '^src/components/ui/' | head -3)
[ -z "$hint" ] || add "app-shell: helper text under a field (FieldDescription); a field carries a sentence only in its error state (FieldError):"$'\n'"$hint"
[ -z "$bad" ] && exit 0
printf '%s' "$bad"; exit 1
