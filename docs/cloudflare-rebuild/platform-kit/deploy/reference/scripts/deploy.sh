#!/usr/bin/env bash
# Deploy rent-split-kit to one wrangler env (preview or production).
#   set -a; . ~/.spec-pipeline/.env; set +a; scripts/deploy.sh production
# Steps: secrets present in the shell -> build for the env -> remote migrations -> wrangler secret
# put from the env (never from a file in the repo) -> deploy -> HTTP checks. Stops on the first error.
set -euo pipefail
ENV_NAME="${1:-preview}"
case "$ENV_NAME" in preview|production) ;; *) echo "usage: scripts/deploy.sh preview|production" >&2; exit 2;; esac
cd "$(dirname "$0")/.."

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is not set}"
: "${JWT_SECRET:?JWT_SECRET is not set (openssl rand -base64 32)}"
: "${BACHS_API_KEY:?BACHS_API_KEY is not set}"
: "${BACHS_WEBHOOK_SECRET:?BACHS_WEBHOOK_SECRET is not set}"
OPTIONAL_SECRETS=(GITHUB_OAUTH_CLIENT_ID GITHUB_OAUTH_CLIENT_SECRET MAILYSEND_API_KEY)
REQUIRED_SECRETS=(JWT_SECRET BACHS_API_KEY BACHS_WEBHOOK_SECRET)

echo "== build ($ENV_NAME)"
CLOUDFLARE_ENV="$ENV_NAME" npx astro build
CONFIG=dist/server/wrangler.json
NAME=$(node -p "require('./$CONFIG').name")
echo "== worker name: $NAME"

echo "== migrations (remote)"
npx wrangler d1 migrations apply DB --remote -c "$CONFIG"

echo "== secrets"
for name in "${REQUIRED_SECRETS[@]}"; do
  printf '%s' "${!name}" | npx wrangler secret put "$name" --name "$NAME" >/dev/null
  echo "   set $name"
done
for name in "${OPTIONAL_SECRETS[@]}"; do
  if [ -n "${!name:-}" ]; then
    printf '%s' "${!name}" | npx wrangler secret put "$name" --name "$NAME" >/dev/null
    echo "   set $name"
  else
    echo "   skipped $name (not in the environment)"
  fi
done

echo "== deploy"
npx wrangler deploy -c "$CONFIG"

ORIGIN=$(node -p "require('./$CONFIG').vars.APP_ORIGIN")
echo "== checks against $ORIGIN"
for path in /healthz / /sign-in /pricing /api/openapi.json; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$ORIGIN$path")
  echo "   $code $path"
  [ "$code" = "200" ] || { echo "deploy check failed for $path" >&2; exit 1; }
done
curl -s "$ORIGIN/healthz"; echo
echo "== done: $ORIGIN"
