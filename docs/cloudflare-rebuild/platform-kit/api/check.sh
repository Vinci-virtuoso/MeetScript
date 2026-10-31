#!/usr/bin/env bash
# platform/api/check.sh <product-repo> <ticket-file>
# Every write route under /api/ parses its body with a zod schema (parseBody or a *Schema), every
# /api/ route is in the ROUTES registry of src/server/openapi.ts (local-only /api/dev/ routes and the
# catch-all excepted), and no route writes SQL. Exit 0 = ok, else reasons on stdout and exit 1.
set -uo pipefail
r="$1"; cd "$r" || { echo "no repo $r"; exit 1; }
bad=""
add() { bad+="$1"$'\n'; }
[ -d src/server ] || { echo "api: no src/server/ folder"; exit 1; }
[ -f src/server/openapi.ts ] || add "api: src/server/openapi.ts is missing (the ROUTES registry and the OpenAPI document)"
[ -f src/server/validate.ts ] || add "api: src/server/validate.ts is missing (parseBody)"
grep -rqE '"/api/openapi.json"' src/server 2>/dev/null || add "api: no GET /api/openapi.json route"

files=$(grep -rlE '"/api/' src/server --include='*.ts' 2>/dev/null | grep -vE '\.(test|spec)\.|openapi\.ts$' || true)
for f in $files; do
  # Write routes: the block from the route line to the next route line must parse a body with zod.
  out=$(awk -v file="$f" '
    function flush() { if (path != "" && block !~ /parseBody\(|Schema\.(safeParse|parse)\(|parse\([A-Za-z]+Schema/) printf "api: %s:%d write route %s parses no zod schema (use parseBody)\n", file, start, path }
    /\.(get|post|put|patch|delete|all|on)\(/ && /"\/api\// {
      flush(); path = ""; block = ""
      if ($0 ~ /\.(post|put|patch)\(/) { p = $0; sub(/^[^"]*"/, "", p); sub(/".*$/, "", p); path = p; start = NR }
    }
    { block = block "\n" $0 }
    END { flush() }' "$f")
  [ -z "$out" ] || add "$out"
  # Every route path is documented in ROUTES.
  if [ -f src/server/openapi.ts ]; then
    while IFS= read -r p; do
      [ -n "$p" ] || continue
      case "$p" in "/api/*"|/api/dev/*|/api/openapi.json) continue ;; esac
      doc=$(printf '%s' "$p" | sed -E 's#:([A-Za-z_]+)#{\1}#g')
      grep -qF "path: \"$doc\"" src/server/openapi.ts || add "api: route $p is not in the ROUTES registry of src/server/openapi.ts"
    done < <(grep -oE '\.(get|post|put|patch|delete)\([[:space:]]*"/api/[^"]*"' "$f" | sed -E 's/^[^"]*"//; s/"$//' | sort -u)
  fi
done
sql=$(grep -rnE '\b(SELECT|INSERT INTO|DELETE FROM|UPDATE [a-zA-Z_]+ SET)\b' src/server/routes 2>/dev/null | grep -vE '\.(test|spec)\.' | grep -vE 'SELECT 1\b' | head -3)
[ -z "$sql" ] || add "api: SQL in a route; routes call src/db/:"$'\n'"$sql"
[ -z "$bad" ] && exit 0
printf '%s' "$bad"; exit 1
