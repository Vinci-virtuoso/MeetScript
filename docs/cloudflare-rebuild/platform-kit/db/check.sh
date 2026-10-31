#!/usr/bin/env bash
# platform/db/check.sh <product-repo> <ticket-file>
# No SQL outside src/db/ (the SELECT 1 health probe excepted; migrations/ and node_modules are not
# scanned, so loginbase's and eventbase's own code is exempt), migration names NNNN_name.sql,
# index names idx_<table>_<cols>. Exit 0 = ok, else reasons on stdout and exit 1.
set -uo pipefail
r="$1"; cd "$r" || { echo "no repo $r"; exit 1; }
bad=""
add() { bad+="$1"$'\n'; }

if [ -d src ]; then
  sql=$(grep -rnE '\b(SELECT|INSERT INTO|UPDATE [a-zA-Z_]+ SET|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE)\b' src \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' --include='*.astro' 2>/dev/null \
    | grep -vE '^src/db/' | grep -vE '\.(test|spec)\.' | grep -vE 'SELECT 1\b' | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' | head -5)
  [ -z "$sql" ] || add "db: SQL outside src/db/ (routes and hooks call the repository functions):"$'\n'"$sql"
fi
if [ -d migrations ]; then
  for f in migrations/*.sql; do
    [ -f "$f" ] || continue
    n=$(basename "$f")
    [[ "$n" =~ ^[0-9]{4}_[a-z0-9_]+\.sql$ ]] || add "db: migration $n is not named NNNN_name.sql"
  done
  idx=$(grep -hoiE 'CREATE (UNIQUE )?INDEX (IF NOT EXISTS )?[A-Za-z0-9_]+' migrations/*.sql 2>/dev/null | awk '{print $NF}' | grep -v '^idx_' | sort -u | tr '\n' ' ')
  [ -z "$idx" ] || add "db: index names must start with idx_<table>_: $idx"
  uniq_col=$(grep -lE '^\s*[a-z_]+\s+[A-Z]+.*\bUNIQUE\b' migrations/*.sql 2>/dev/null | grep -vE 'loginbase|eventbase' | tr '\n' ' ')
  [ -z "$uniq_col" ] || add "db: UNIQUE column constraint (unnamed autoindex) in: ${uniq_col}write CREATE UNIQUE INDEX idx_<table>_<col> instead"
else
  add "db: no migrations/ folder"
fi
[ -d src/db ] || add "db: no src/db/ folder (the only place with SQL)"
[ -z "$bad" ] && exit 0
printf '%s' "$bad"; exit 1
