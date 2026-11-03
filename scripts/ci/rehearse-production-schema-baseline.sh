#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASELINE_FILE="$ROOT_DIR/_review/PRODUCTION_BASELINE_COMPLETE_20261103.sql"
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

for required_file in "$BASELINE_FILE" "$ASSERTIONS_FILE"; do
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
cp "$BASELINE_FILE" "$TEST_DIR/supabase/migrations/20261103000000_asyut_aqar_current_state_baseline.sql"

echo "Starting an isolated local Supabase stack (no hosted project is linked)."
supabase start -x "studio,edge-runtime,logflare,vector,postgres-meta,imgproxy,mailpit"
STACK_STARTED=1

# Explicit --local: this resets only the disposable local database created above.
supabase db reset --local --no-seed
supabase migration list --local

if ! command -v psql >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y postgresql-client
fi

STATUS_ENV="$(supabase status -o env)"
DB_URL="$(printf '%s\n' "$STATUS_ENV" | awk -F= '$1 == "DB_URL" { print substr($0, index($0, "=") + 1); exit }')"
DB_URL="${DB_URL#\"}"
DB_URL="${DB_URL%\"}"
if [[ -z "$DB_URL" ]]; then
  echo "Supabase CLI did not return a local DB_URL." >&2
  exit 1
fi

pg_isready --dbname "$DB_URL"
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f "$ASSERTIONS_FILE"

echo "PASS: full Supabase CLI baseline rehearsal, catalog assertions, directory RLS and Storage RLS."
