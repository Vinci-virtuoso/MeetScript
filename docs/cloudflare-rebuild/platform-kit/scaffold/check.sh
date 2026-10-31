#!/usr/bin/env bash
# platform/scaffold/check.sh <product-repo> <ticket-file>
# Deterministic check of the scaffold skill's rules on the product repo.
# Exit 0 = ok. Otherwise print one plain reason per line and exit 1.
set -uo pipefail
r="$1"; cd "$r" || { echo "no repo $r"; exit 1; }
bad=""
add() { bad+="$1"$'\n'; }

[ -f package.json ] || { echo "scaffold: no package.json"; exit 1; }
jq -e '.scripts.verify' package.json >/dev/null 2>&1 || add "scaffold: package.json has no verify script (npm run verify is the one gate)"
loose=$(jq -r '((.dependencies // {}) + (.devDependencies // {})) | to_entries[] | select(.value | test("^[\\^~]|^[*]$|^latest$")) | .key' package.json 2>/dev/null | tr '\n' ' ')
[ -z "$loose" ] || add "scaffold: dependencies not pinned to an exact version: $loose"
[ -f wrangler.jsonc ] || [ -f wrangler.toml ] || [ -f wrangler.json ] || add "scaffold: no wrangler config"
if [ -f wrangler.jsonc ]; then
  grep -qE '(^|[{,])[[:space:]]*"(main|assets)"[[:space:]]*:' wrangler.jsonc && add "scaffold: wrangler.jsonc sets main or assets; the Astro adapter writes them into dist/server/wrangler.json"
  grep -qE '"preview"[[:space:]]*:' wrangler.jsonc || add "scaffold: wrangler.jsonc has no env.preview"
  grep -qE '"production"[[:space:]]*:' wrangler.jsonc || add "scaffold: wrangler.jsonc has no env.production"
fi
grep -rqE '"/healthz"' src 2>/dev/null || add "scaffold: no /healthz route in src/"
for f in src/server/http.ts src/server/log.ts src/server/middleware/request.ts; do
  [ -f "$f" ] || add "scaffold: $f is missing (the error envelope, the log line and the request middleware are the contract)"
done
git ls-files --error-unmatch .dev.vars >/dev/null 2>&1 && add "scaffold: .dev.vars is tracked by git; it holds local secrets"
git ls-files --error-unmatch worker-configuration.d.ts >/dev/null 2>&1 && add "scaffold: worker-configuration.d.ts is tracked; wrangler types regenerates it"
for s in shadcn migrate-radix-to-base better-ui better-typography better-colors better-accessibility better-layout better-writing better-interface interface-review state-machine break; do
  [ -f ".claude/skills/$s/SKILL.md" ] || add "scaffold: agent skill .claude/skills/$s/SKILL.md is missing (copy it from the vendored folder)"
done
[ -z "$bad" ] && exit 0
printf '%s' "$bad"; exit 1
