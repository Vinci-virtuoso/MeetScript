#!/usr/bin/env bash
# platform/email/check.sh <product-repo> <ticket-file>
# One seam: mail keys and mail APIs only in src/email/; the dev peek is gated by DEV_MAIL_PEEK and
# the var is set in the local config only; the MAILYSEND binding is in the envs only.
# Exit 0 = ok, else reasons on stdout and exit 1.
set -uo pipefail
r="$1"; cd "$r" || { echo "no repo $r"; exit 1; }
bad=""
add() { bad+="$1"$'\n'; }
[ -d src ] || { echo "email: no src/ folder"; exit 1; }

[ -f src/email/provider.ts ] || add "email: src/email/provider.ts (the EmailProvider port) is missing"
[ -f src/email/index.ts ] || add "email: src/email/index.ts (createEmailProvider) is missing"
leak=$(grep -rnE 'MAILYSEND_API_KEY|RESEND_API_KEY|api\.resend\.com|createMailysendEmail\(|createResendEmail\(' src --include='*.ts' --include='*.tsx' --include='*.astro' --include='*.mjs' 2>/dev/null \
  | grep -vE '^src/email/|^src/env\.d\.ts|\.(test|spec)\.' | head -3)
[ -z "$leak" ] || add "email: a mail key or mail API used outside src/email/ (send through createEmailProvider):"$'\n'"$leak"
for f in $(grep -rlE '"/api/dev/' src --include='*.ts' 2>/dev/null | grep -vE '\.(test|spec)\.'); do
  grep -q 'DEV_MAIL_PEEK' "$f" || add "email: $f serves /api/dev/ without the DEV_MAIL_PEEK gate"
done
if [ -f wrangler.jsonc ]; then
  # Everything after the "env" key belongs to the deploy envs.
  envpart=$(awk '/^[[:space:]]*"env"[[:space:]]*:/{e=1} e' wrangler.jsonc)
  printf '%s' "$envpart" | grep -q 'DEV_MAIL_PEEK' && add "email: DEV_MAIL_PEEK is set in a deploy env; only the top level (local) config may set it"
  top=$(awk '/^[[:space:]]*"env"[[:space:]]*:/{exit} {print}' wrangler.jsonc)
  printf '%s' "$top" | grep -q '"MAILYSEND"' && add "email: the MAILYSEND service binding is in the top level config; wrangler dev would answer 503, put it in the envs only"
fi
[ -z "$bad" ] && exit 0
printf '%s' "$bad"; exit 1
