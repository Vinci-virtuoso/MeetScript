#!/usr/bin/env bash
# platform/auth/check.sh <product-repo> <ticket-file>
# No Set-Cookie without HttpOnly; no /api/ route without requireUser() or an @public marker; the
# access token never in localStorage, sessionStorage or document.cookie; a Google route verifies the
# ID token (jwtVerify against Google's keys with issuer, audience and the nonce, email_verified
# required) and never only decodes it.
# Exit 0 = ok, else reasons on stdout and exit 1.
set -uo pipefail
r="$1"; cd "$r" || { echo "no repo $r"; exit 1; }
bad=""
add() { bad+="$1"$'\n'; }
[ -d src ] || { echo "auth: no src/ folder"; exit 1; }

# 1. Cookies: every file that sets a cookie must set it HttpOnly.
while IFS= read -r f; do
  [ -n "$f" ] || continue
  grep -qE 'httpOnly:[[:space:]]*true|HttpOnly' "$f" || add "auth: $f sets a cookie without HttpOnly"
done < <(grep -rlE 'setCookie\(|[Ss]et-[Cc]ookie' src --include='*.ts' --include='*.tsx' --include='*.astro' --include='*.js' 2>/dev/null | grep -vE '\.(test|spec)\.' || true)

# 2. Every /api/ route is behind requireUser()/requirePlan() or marked // @public on the line above.
#    A `.use("<prefix>", requireUser())` covers the routes under that prefix. The /api/* catch-all is exempt.
while IFS= read -r f; do
  [ -n "$f" ] || continue
  out=$(awk -v file="$f" '
    function strip(p) { sub(/\/\*$/, "", p); sub(/\*$/, "", p); sub(/\/$/, "", p); return p }
    {
      line = $0
      if (match(line, /\.use\([[:space:]]*"\/api[^"]*"[^)]*requireUser\(/) || match(line, /\.use\([[:space:]]*"\/api[^"]*"[^)]*requirePlan\(/)) {
        p = line; sub(/^[^"]*"/, "", p); sub(/".*$/, "", p); prefixes[++np] = strip(p)
      }
      if (match(line, /\.(get|post|put|patch|delete|all|on)\(/) && match(line, /"\/api\/[^"]*"/)) {
        path = substr(line, RSTART + 1, RLENGTH - 2)
        if (path == "/api/*") { prev = line; next }
        ok = 0
        if (line ~ /requireUser\(|requirePlan\(/) ok = 1
        if (line ~ /@public/ || prev ~ /@public/) ok = 1
        for (i = 1; i <= np; i++) { pre = prefixes[i]; if (path == pre || index(path, pre "/") == 1) ok = 1 }
        if (!ok) printf "auth: %s:%d route %s has no requireUser() and no // @public marker\n", file, NR, path
      }
      if (line !~ /^[[:space:]]*$/) prev = line
    }' "$f")
  [ -z "$out" ] || add "$out"
done < <(grep -rlE '"/api/' src --include='*.ts' --include='*.js' 2>/dev/null | grep -vE '\.(test|spec)\.|^src/(lib|components|pages|scripts)/' || true)

# 3. The access token lives in memory only.
store=$(grep -rnE '(localStorage|sessionStorage)\.(setItem|getItem)|document\.cookie[[:space:]]*=' src --include='*.ts' --include='*.tsx' --include='*.js' --include='*.astro' 2>/dev/null | grep -vE '\.(test|spec)\.' | head -3)
[ -z "$store" ] || add "auth: web storage or document.cookie used; the access token lives in memory and the refresh token in the HttpOnly cookie:"$'\n'"$store"

# 4. Google sign-in: a file that handles Google's ID token verifies it. Decoding (decodeJwt, jwt-decode,
#    atob or Buffer on the token parts) without jwtVerify / verifyGoogleIdToken next to it fails, and the
#    Google route files together check the issuer, the audience, the nonce and email_verified.
gfiles=$(grep -rlE 'id_token|accounts\.google\.com|oauth2\.googleapis\.com|googleapis\.com/oauth2' src --include='*.ts' --include='*.tsx' --include='*.js' --include='*.astro' 2>/dev/null | grep -vE '\.(test|spec)\.' || true)
if [ -n "$gfiles" ]; then
  verify_re='jwtVerify\(|verifyGoogleIdToken\(|crypto\.subtle\.verify\('
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    grep -q 'id_token' "$f" || continue
    dec=$(grep -nE 'decodeJwt\(|jwtDecode\(|jwt_decode\(|from ["'"'"']jwt-decode["'"'"']|atob\([^)]*split\(|Buffer\.from\([^)]*split\(|\.split\(["'"'"']\.["'"'"']\)' "$f" | head -2)
    if [ -n "$dec" ] && ! grep -qE "$verify_re" "$f"; then
      add "auth: $f decodes the Google ID token without verifying it (call jwtVerify with Google's JWKS, or verifyGoogleIdToken):"$'\n'"$dec"
    elif ! grep -qE "$verify_re" "$f"; then
      add "auth: $f reads a Google id_token and never verifies it (jwtVerify against https://www.googleapis.com/oauth2/v3/certs, or verifyGoogleIdToken)"
    fi
  done <<< "$gfiles"
  all=$(cat $gfiles 2>/dev/null)
  if printf '%s' "$all" | grep -q 'jwtVerify('; then
    for k in issuer audience nonce email_verified; do
      printf '%s' "$all" | grep -q "$k" || add "auth: the Google ID token check has no $k check (iss in accounts.google.com forms, aud = the client id, the flow nonce, email_verified)"
    done
  fi
fi

[ -z "$bad" ] && exit 0
printf '%s' "$bad"; exit 1
