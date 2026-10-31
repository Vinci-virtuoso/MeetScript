#!/usr/bin/env bash
# platform/deploy/check.sh <product-repo> <ticket-file>
# scripts/deploy.sh exists, applies remote migrations before wrangler deploy, puts secrets with
# printf (never echo) and carries no secret-shaped value; wrangler.jsonc has both envs with
# different names and no main/assets. Exit 0 = ok, else reasons on stdout and exit 1.
set -uo pipefail
r="$1"; cd "$r" || { echo "no repo $r"; exit 1; }
bad=""
add() { bad+="$1"$'\n'; }

if [ ! -f scripts/deploy.sh ]; then
  add "deploy: scripts/deploy.sh is missing"
else
  mig=$(grep -nE 'd1 migrations apply DB --remote' scripts/deploy.sh | head -1 | cut -d: -f1)
  dep=$(grep -nE 'wrangler deploy' scripts/deploy.sh | head -1 | cut -d: -f1)
  [ -n "$mig" ] || add "deploy: scripts/deploy.sh does not apply the remote migrations (wrangler d1 migrations apply DB --remote)"
  [ -n "$dep" ] || add "deploy: scripts/deploy.sh does not run wrangler deploy"
  if [ -n "$mig" ] && [ -n "$dep" ] && [ "$mig" -gt "$dep" ]; then add "deploy: scripts/deploy.sh deploys before it applies the migrations (line $dep before line $mig)"; fi
  grep -qE 'secret put' scripts/deploy.sh || add "deploy: scripts/deploy.sh never puts a secret"
  grep -nE 'echo .*\|.*secret put' scripts/deploy.sh | head -1 | grep -q . && add "deploy: scripts/deploy.sh pipes echo into secret put; use printf '%s' (echo adds a newline)"
  grep -qE 'healthz' scripts/deploy.sh || add "deploy: scripts/deploy.sh does not check /healthz after the deploy"
  grep -nE '(sk-[A-Za-z0-9_-]{20,}|whsec_[A-Za-z0-9]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY|[A-Za-z0-9+/]{40,}=)' scripts/deploy.sh | head -1 | grep -q . && add "deploy: scripts/deploy.sh carries a secret-shaped value"
fi
if [ -f wrangler.jsonc ]; then
  grep -qE '"preview"[[:space:]]*:' wrangler.jsonc || add "deploy: wrangler.jsonc has no env.preview"
  grep -qE '"production"[[:space:]]*:' wrangler.jsonc || add "deploy: wrangler.jsonc has no env.production"
  names=$(node -e '
    const fs = require("fs");
    const text = fs.readFileSync(process.argv[1], "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1");
    let cfg = {}; try { cfg = JSON.parse(text); } catch (e) { process.stdout.write("unparsable"); process.exit(0); }
    const names = Object.values(cfg.env || {}).map((e) => e && e.name).filter(Boolean);
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    process.stdout.write(dup.join(" "));' wrangler.jsonc 2>/dev/null)
  if [ "$names" = unparsable ]; then add "deploy: wrangler.jsonc does not parse as JSON with comments"
  elif [ -n "$names" ]; then add "deploy: two envs share a Worker name: $names"; fi
  grep -qE '(^|[{,])[[:space:]]*"(main|assets)"[[:space:]]*:' wrangler.jsonc && add "deploy: wrangler.jsonc sets main or assets; the adapter writes them"
else
  add "deploy: no wrangler.jsonc"
fi
[ -z "$bad" ] && exit 0
printf '%s' "$bad"; exit 1
