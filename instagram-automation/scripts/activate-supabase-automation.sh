#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-abnfrtvuxnuslmebcbca}"
WORKER_SECRET_NAME="publish_worker_secret"

required() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

required SUPABASE_ACCESS_TOKEN
required SUPABASE_SERVICE_ROLE_KEY
required PUBLISH_WORKER_SECRET

echo "Activating Instagram automation for Supabase project ${PROJECT_REF}."
echo "Secrets are read from environment variables and will not be printed."

export SUPABASE_ACCESS_TOKEN

mkdir -p supabase/.temp
printf "%s" "${PROJECT_REF}" > supabase/.temp/project-ref

npx supabase secrets set \
  "META_GRAPH_BASE_URL=${META_GRAPH_BASE_URL:-https://graph.instagram.com}" \
  "META_GRAPH_VERSION=${META_GRAPH_VERSION:-v24.0}" \
  "PUBLISH_WORKER_SECRET=${PUBLISH_WORKER_SECRET}" \
  --project-ref "${PROJECT_REF}"

npx supabase functions deploy publish-due-reel \
  --project-ref "${PROJECT_REF}" \
  --no-verify-jwt \
  --use-api

secret_sql_file="$(mktemp)"
trap 'rm -f "${secret_sql_file}"' EXIT

WORKER_SECRET="${PUBLISH_WORKER_SECRET}" python3 - <<'PY' > "${secret_sql_file}"
import os

secret = os.environ["WORKER_SECRET"].replace("'", "''")
print(
    "create extension if not exists supabase_vault with schema vault;"
    "select vault.create_secret("
    f"'{secret}', "
    "'publish_worker_secret'"
    ") where not exists ("
    "select 1 from vault.decrypted_secrets where name = 'publish_worker_secret'"
    ");"
)
PY

npx supabase db query \
  --linked \
  --file "${secret_sql_file}"

for migration in \
  supabase/migrations/001_instagram_accounts.sql \
  supabase/migrations/002_scheduled_reels.sql \
  supabase/migrations/003_claim_due_reel.sql \
  supabase/migrations/005_recover_stuck_reels.sql \
  supabase/migrations/004_cron_publish_due_reels.sql
do
  npx supabase db query \
    --linked \
    --file "${migration}"
done

cat <<SQL

Automation activation commands finished.
Vault secret '${WORKER_SECRET_NAME}' is present.
Edge Function is deployed.
Migrations were applied through linked SQL queries.
SQL
