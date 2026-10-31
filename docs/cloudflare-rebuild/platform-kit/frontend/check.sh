#!/usr/bin/env bash
# platform/frontend/check.sh <product-repo> <ticket-file>
# shadcn components only under src/components/ui/, the Tailwind entry maps onto the tokens with no
# color literal and no font import, no inline scripts without src, no input-otp, components.json
# exists. The color-literal diff check of post-ticket.sh stays. Exit 0 = ok, else reasons and exit 1.
set -uo pipefail
r="$1"; cd "$r" || { echo "no repo $r"; exit 1; }
bad=""
add() { bad+="$1"$'\n'; }
[ -d src ] || { echo "frontend: no src/ folder"; exit 1; }

[ -f components.json ] || add "frontend: components.json is missing (shadcn init)"
prim=$(grep -rlE 'from "(@base-ui/react|class-variance-authority)' src --include='*.tsx' --include='*.ts' --include='*.astro' 2>/dev/null | grep -v '^src/components/ui/' | grep -vE '\.(test|spec)\.' | tr '\n' ' ')
[ -z "$prim" ] || add "frontend: components built from @base-ui/react or class-variance-authority outside src/components/ui/: $prim"
other=$(find src -type d -path '*components/ui' 2>/dev/null | grep -v '^src/components/ui$' | tr '\n' ' ')
[ -z "$other" ] || add "frontend: a second components/ui folder: $other(shadcn components live in src/components/ui/ only)"
entries=$(grep -rlE '@import "tailwindcss"' src --include='*.css' 2>/dev/null || true)
[ -n "$entries" ] || add "frontend: no Tailwind entry (a CSS file with @import \"tailwindcss\")"
for f in $entries; do
  grep -qE '@theme inline reference' "$f" || add "frontend: $f has no @theme inline reference block mapping shadcn names onto the design tokens"
  lit=$(sed 's#/\*.*\*/##g' "$f" | grep -nE '#[0-9a-fA-F]{3,8}\b|\b(oklch|oklab|rgba?|hsla?|lab|lch)\(' | head -3)
  [ -z "$lit" ] || add "frontend: color literal in $f (colors come from the tokens file):"$'\n'"$lit"
  grep -qE '@import "@fontsource' "$f" && add "frontend: $f imports a font package; the design names the fonts and the layout loads them"
done
inl=$(grep -rnE '<script[^>]*is:inline' src --include='*.astro' 2>/dev/null | grep -vE 'src=' | head -3)
[ -z "$inl" ] || add "frontend: inline script without src; the CSP hash covers only Astro's own hydration scripts:"$'\n'"$inl"
[ -f package.json ] && jq -e '(.dependencies // {}) | has("input-otp")' package.json >/dev/null 2>&1 && add "frontend: input-otp is installed; it needs inline styles the CSP blocks"
[ -z "$bad" ] && exit 0
printf '%s' "$bad"; exit 1
