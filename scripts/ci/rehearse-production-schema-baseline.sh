#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATION_FILE="$ROOT_DIR/supabase/migrations/20261103140155_asyut_aqar_production_schema_baseline.sql"
DIRECTORY_ADMIN_MIGRATION_FILE="$ROOT_DIR/supabase/migrations/20261103141537_directory_admin_mutate_with_audit.sql"
CONFIG_FILE="$ROOT_DIR/supabase/config.toml"
STORAGE_BASELINE_FILE="$ROOT_DIR/supabase/bootstrap/storage-baseline.sql"
ASSERTIONS_FILE="$ROOT_DIR/tests/db/production-schema-baseline.assertions.sql"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/asyut-aqar-baseline.XXXXXX")"
STACK_STARTED=0

cleanup() {
  if [[ "$STACK_STARTED" == "1" ]]; then
    (cd "$TEST_DIR" && supabase stop --no-backup) >/dev/null 2>&1 || true
  fi
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

for required_file in "$MIGRATION_FILE" "$DIRECTORY_ADMIN_MIGRATION_FILE" "$CONFIG_FILE" "$STORAGE_BASELINE_FILE" "$ASSERTIONS_FILE"; do
  if [[ ! -s "$required_file" ]]; then
    echo "Required rehearsal file is missing or empty: $required_file" >&2
    exit 1
  fi
done

# This rehearsal must never inherit credentials that could link it to a hosted project.
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
        lines[index] = 'project_id = "asyut-aqar-baseline-ci"'
        break
else:
    lines.insert(0, 'project_id = "asyut-aqar-baseline-ci"')

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
# Ask the pinned Supabase CLI to create the timestamped migration path, then
# populate that path with the reviewed, catalog-derived production baseline.
supabase migration new asyut_aqar_production_schema_baseline >/dev/null
GENERATED_MIGRATION="$(find "$TEST_DIR/supabase/migrations" -maxdepth 1 -type f -name '*_asyut_aqar_production_schema_baseline.sql' -print -quit)"
if [[ -z "$GENERATED_MIGRATION" ]]; then
  echo "Supabase CLI did not create the expected baseline migration." >&2
  exit 1
fi
cp "$MIGRATION_FILE" "$GENERATED_MIGRATION"
# Keep the generated CLI migration timestamps strictly ordered.
sleep 1

# The directory administration RPC is a distinct incremental migration and
# must follow the catalog-derived application baseline in replay order.
supabase migration new directory_admin_mutate_with_audit >/dev/null
GENERATED_DIRECTORY_ADMIN_MIGRATION="$(find "$TEST_DIR/supabase/migrations" -maxdepth 1 -type f -name '*_directory_admin_mutate_with_audit.sql' -print -quit)"
if [[ -z "$GENERATED_DIRECTORY_ADMIN_MIGRATION" ]]; then
  echo "Supabase CLI did not create the expected directory-admin migration." >&2
  exit 1
fi
cp "$DIRECTORY_ADMIN_MIGRATION_FILE" "$GENERATED_DIRECTORY_ADMIN_MIGRATION"

echo "Starting an isolated local Supabase stack (no hosted project is linked)."
supabase start -x "studio,edge-runtime,logflare,vector,postgres-meta,imgproxy"
STACK_STARTED=1

# Explicit --local: this resets only the disposable local database created above.
supabase db reset --local --no-seed
supabase migration list --local

if ! command -v psql >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y postgresql-client
fi

# Resolve credentials created for this disposable local stack only.
# The password is extracted in memory from the local CLI URL and never logged or committed.
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

# Supabase-managed Storage relations are owned by supabase_storage_admin.
# Apply only that managed-schema fragment as the local stack's superuser, inside
# the disposable Docker database. App tables/functions above remain owned by postgres.
DB_CONTAINER="$(docker ps --format '{{.Names}}' | grep -E '^supabase_db_' | head -n 1 || true)"
if [[ -z "$DB_CONTAINER" ]]; then
  echo "Could not locate the disposable local Supabase Postgres container." >&2
  exit 1
fi

docker exec -e "PGPASSWORD=$DB_PASSWORD" -i "$DB_CONTAINER" psql -h 127.0.0.1 -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 < "$STORAGE_BASELINE_FILE"
unset DB_PASSWORD

pg_isready --dbname "$DB_URL"
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f "$ASSERTIONS_FILE"

# Exercise Storage owner policies through the Storage HTTP API, never by deleting
# rows directly from storage.objects (Supabase protects that table from SQL DELETE).
status_value() {
  local key="$1"
  printf '%s\\n' "$STATUS_ENV" | sed -n "s/^${key}=//p" | head -n 1 | sed 's/^"//; s/"$//'
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
node "$ROOT_DIR/tests/db/storage-api-baseline.mjs"
unset MAILPIT_URL DATABASE_URL SERVICE_ROLE_KEY ANON_KEY

echo "PASS: full Supabase CLI baseline rehearsal, catalog assertions, directory RLS and Storage API RLS."
