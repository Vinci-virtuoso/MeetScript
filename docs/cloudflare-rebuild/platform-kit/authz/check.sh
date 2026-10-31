#!/usr/bin/env bash
# platform/authz/check.sh <product-repo> <ticket-file>
# src/policy/can.ts and its test exist; every statement in src/db/ on a table with an owner_id
# column (from migrations/) filters by owner_id, unless the line carries // @system (a lookup with no
# user in context, for example a webhook handler); can() is called in the routes.
# Exit 0 = ok, else reasons on stdout and exit 1.
set -uo pipefail
r="$1"; cd "$r" || { echo "no repo $r"; exit 1; }
bad=""
add() { bad+="$1"$'\n'; }

[ -f src/policy/can.ts ] || add "authz: src/policy/can.ts is missing"
{ [ -f src/policy/can.test.ts ] || compgen -G "tests/unit/can.test.*" >/dev/null; } || add "authz: no test for the policies (src/policy/can.test.ts)"
if [ -f src/policy/can.ts ]; then
  grep -rqE '\bcan\(' src/server 2>/dev/null || add "authz: no route calls can(); policies are decided at the route boundary"
fi
# Tables with an owner_id column.
tables=""
if [ -d migrations ]; then
  tables=$(awk 'BEGIN{IGNORECASE=1} /CREATE TABLE/{t=$0; sub(/.*CREATE TABLE (IF NOT EXISTS )?/,"",t); sub(/[ (].*/,"",t); cur=t} /owner_id/{if(cur!="") print cur}' migrations/*.sql 2>/dev/null | sort -u)
fi
for t in $tables; do
  hits=$(grep -rnE "\b(FROM|UPDATE|INTO) $t\b" src/db --include='*.ts' 2>/dev/null | grep -vE '\.(test|spec)\.' | grep -vE 'INSERT INTO' | grep -vE 'owner_id' | grep -v '@system' | head -3)
  [ -z "$hits" ] || add "authz: statement on user-owned table $t without an owner_id filter (keep each statement on one line):"$'\n'"$hits"
done
[ -z "$bad" ] && exit 0
printf '%s' "$bad"; exit 1
