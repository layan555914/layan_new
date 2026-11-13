#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG_FILE="$ROOT_DIR/supabase/config.toml"
STORAGE_BASELINE_FILE="$ROOT_DIR/supabase/bootstrap/storage-baseline.sql"
ASSERTIONS_FILE="$ROOT_DIR/tests/db/current-state-schema.assertions.sql"
STORAGE_API_TEST="$ROOT_DIR/tests/db/storage-api-baseline.mjs"
CRM_API_TEST="$ROOT_DIR/tests/db/admin-crm-api.mjs"
APPROVAL_GATE_TEST="$ROOT_DIR/tests/ui/admin-approval-gate.mjs"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/asyut-aqar-current-state.XXXXXX")"
STACK_STARTED=0

cleanup() {
  if [[ "$STACK_STARTED" == "1" ]]; then
    (cd "$TEST_DIR" && supabase stop --no-backup) >/dev/null 2>&1 || true
  fi
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

node --check "$ROOT_DIR/admin-crm.js"
node --check "$ROOT_DIR/admin-approval.js"
node --check "$CRM_API_TEST"
node --check "$APPROVAL_GATE_TEST"
node "$APPROVAL_GATE_TEST"

if ! grep -Fq 'id="adminCrm"' "$ROOT_DIR/admin.html" \
  || ! grep -Fq './admin-crm.js?v=20261114-1' "$ROOT_DIR/admin.html" \
  || ! grep -Fq './admin-crm.js?v=20261114-1' "$ROOT_DIR/sw.js" \
  || ! grep -Fq './admin-approval.js?v=20261114-1' "$ROOT_DIR/admin.html" \
  || ! grep -Fq './admin-approval.js?v=20261114-1' "$ROOT_DIR/sw.js"; then
  echo "The CRM admin workspace is not fully wired into the admin page and PWA shell." >&2
  exit 1
fi

# Phase 2 service-company categories must stay out of the phase 1 admin UI.
if grep -Eq 'option value="(supplier_factory|finishing_furniture|service_provider)"' "$ROOT_DIR/admin.html" \
  || grep -Eq 'supplier_factory:|finishing_furniture:|service_provider:' "$ROOT_DIR/admin-crm.js"; then
  echo "Phase 2 service-company categories are exposed in the phase 1 CRM UI." >&2
  exit 1
fi

for required_file in "$CONFIG_FILE" "$STORAGE_BASELINE_FILE" "$ASSERTIONS_FILE" "$STORAGE_API_TEST" "$CRM_API_TEST" "$APPROVAL_GATE_TEST"; do
  if [[ ! -s "$required_file" ]]; then
    echo "Required current-state rehearsal file is missing or empty: $required_file" >&2
    exit 1
  fi
done

# Never inherit credentials capable of linking this rehearsal to hosted Supabase.
unset SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

supabase init
cp "$CONFIG_FILE" "$TEST_DIR/supabase/config.toml"
python3 - "$TEST_DIR/supabase/config.toml" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
lines = path.read_text(encoding="utf-8").splitlines()
for index, line in enumerate(lines):
    if re.match(r"^\s*project_id\s*=", line):
        lines[index] = 'project_id = "asyut-aqar-current-state-ci"'
        break
else:
    lines.insert(0, 'project_id = "asyut-aqar-current-state-ci"')

db_index = next((i for i, line in enumerate(lines) if line.strip() == "[db]"), None)
if db_index is None:
    lines.extend(["", "[db]", "major_version = 17"])
else:
    db_end = next((i for i in range(db_index + 1, len(lines)) if re.match(r"^\s*\[.+\]\s*$", lines[i])), len(lines))
    major_index = next((i for i in range(db_index + 1, db_end) if re.match(r"^\s*#?\s*major_version\s*=", lines[i])), None)
    if major_index is None:
        lines.insert(db_index + 1, "major_version = 17")
    else:
        lines[major_index] = "major_version = 17"

path.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY

mkdir -p "$TEST_DIR/supabase/migrations"
# Copy the reviewed Nov 3 schema baseline, its stable marketplace seed, the
# current main-branch incremental migrations, and the company-claim feature
# migrations. No production data or no-op historical ledger markers are copied.
cp "$ROOT_DIR"/supabase/migrations/*.sql "$TEST_DIR/supabase/migrations/"

echo "Starting a disposable local Supabase stack; no hosted project is linked."
supabase start -x "studio,edge-runtime,logflare,vector,postgres-meta,imgproxy"
STACK_STARTED=1
supabase db reset --local --no-seed
supabase migration list --local

if ! command -v psql >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y postgresql-client
fi

STATUS_ENV="$(supabase status -o env)"
DB_URL="$(echo "$STATUS_ENV" | sed -n 's/^DB_URL=//p' | head -n 1 | tr -d '"')"
if [[ -z "$DB_URL" ]]; then
  echo "Supabase CLI did not return a local DB_URL." >&2
  exit 1
fi
DB_PASSWORD="$(python3 - "$DB_URL" <<'PY'
from urllib.parse import urlparse
import sys
password = urlparse(sys.argv[1]).password
if not password:
    raise SystemExit("Local database URL has no password component")
print(password)
PY
)"

DB_CONTAINER="$(docker ps --format '{{.Names}}' | grep -E '^supabase_db_' | head -n 1 || true)"
if [[ -z "$DB_CONTAINER" ]]; then
  echo "Could not locate the disposable local Supabase Postgres container." >&2
  exit 1
fi

# Storage-managed tables are configured separately and only inside this local stack.
docker exec -e "PGPASSWORD=$DB_PASSWORD" -i "$DB_CONTAINER" psql -h 127.0.0.1 -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 < "$STORAGE_BASELINE_FILE"
unset DB_PASSWORD

pg_isready --dbname "$DB_URL"
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f "$ASSERTIONS_FILE"

status_value() {
  local key="$1"
  printf '%s\n' "$STATUS_ENV" | sed -n "s/^$key=//p" | head -n 1 | sed 's/^"//; s/"$//'
}
API_URL="$(status_value API_URL)"
ANON_KEY="$(status_value ANON_KEY)"
SERVICE_ROLE_KEY="$(status_value SERVICE_ROLE_KEY)"
if [[ -z "$API_URL" || -z "$ANON_KEY" || -z "$SERVICE_ROLE_KEY" ]]; then
  echo "Supabase CLI status is missing local API_URL/ANON_KEY/SERVICE_ROLE_KEY." >&2
  exit 1
fi

export API_URL ANON_KEY SERVICE_ROLE_KEY
export DATABASE_URL="$DB_URL"
export MAILPIT_URL="http://127.0.0.1:54324"
node "$STORAGE_API_TEST"
node "$CRM_API_TEST"
unset MAILPIT_URL DATABASE_URL SERVICE_ROLE_KEY ANON_KEY

echo "PASS: clean current-state schema build from baseline + post-baseline migrations, claim RLS/lock assertions, private admin isolation, and local Storage/Auth/CRM API checks."
