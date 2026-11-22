#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

DB_NAME="marketplace_provider_links_test_${GITHUB_RUN_ID:-local}_$$"
export PGDATABASE="$DB_NAME"

cleanup() {
  dropdb --if-exists --maintenance-db=postgres "$DB_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

createdb --maintenance-db=postgres "$DB_NAME"

psql -v ON_ERROR_STOP=1 <<'SQL'
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$roles$;

CREATE SCHEMA auth;
CREATE SCHEMA private;

CREATE TABLE auth.users (id uuid PRIMARY KEY);

CREATE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
AS $function$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$function$;

CREATE FUNCTION private.layan_is_admin()
RETURNS boolean
LANGUAGE sql STABLE
AS $function$
  SELECT false;
$function$;

CREATE TABLE public.marketplace_listings (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  status text NOT NULL
);

CREATE TABLE public.directory_entities (
  id uuid PRIMARY KEY,
  verification_status text NOT NULL,
  public_visible boolean NOT NULL
);

CREATE TABLE public.company_entity_managers (
  directory_entity_id uuid NOT NULL REFERENCES public.directory_entities(id),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id),
  verified_at timestamptz
);

CREATE TABLE public.company_entity_manager_members (
  directory_entity_id uuid NOT NULL REFERENCES public.directory_entities(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  member_role text NOT NULL,
  revoked_at timestamptz
);

GRANT USAGE ON SCHEMA public, auth, private TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.layan_is_admin() TO anon, authenticated;
GRANT SELECT ON public.marketplace_listings, public.directory_entities,
  public.company_entity_managers, public.company_entity_manager_members TO anon, authenticated;
SQL

psql -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/20261121093017_marketplace_listing_provider_profile_links.sql"
psql -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/20261121093133_secure_marketplace_provider_link_membership.sql"
psql -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/20261121101500_allow_owner_linking_published_service_listings.sql"

psql -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO auth.users(id) VALUES
 ('b0000000-0000-4000-8000-000000000001'),
 ('b0000000-0000-4000-8000-000000000002'),
 ('b0000000-0000-4000-8000-000000000003'),
 ('b0000000-0000-4000-8000-000000000004'),
 ('b0000000-0000-4000-8000-000000000005'),
 ('b0000000-0000-4000-8000-000000000006');

INSERT INTO public.directory_entities(id, verification_status, public_visible) VALUES
 ('c0000000-0000-4000-8000-000000000001', 'published', true),
 ('c0000000-0000-4000-8000-000000000002', 'published', true),
 ('c0000000-0000-4000-8000-000000000003', 'published', false),
 ('c0000000-0000-4000-8000-000000000004', 'published', true),
 ('c0000000-0000-4000-8000-000000000005', 'published', true);

INSERT INTO public.company_entity_managers(directory_entity_id, owner_user_id, verified_at) VALUES
 ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', now()),
 ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', now()),
 ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', now()),
 ('c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000004', NULL),
 ('c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', now());

INSERT INTO public.company_entity_manager_members(directory_entity_id, user_id, member_role, revoked_at) VALUES
 ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'editor', NULL),
 ('c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000005', 'manager', now());

INSERT INTO public.marketplace_listings(id, owner_id, status) VALUES
 ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'approved'),
 ('a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'approved'),
 ('a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'pending'),
 ('a0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'approved'),
 ('a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000004', 'approved'),
 ('a0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000005', 'approved'),
 ('a0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000006', 'approved');
SQL

# An authenticated verified profile owner may link their own already-approved service listing.
psql -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
INSERT INTO public.marketplace_listing_provider_links(listing_id, directory_entity_id, linked_by)
VALUES ('a0000000-0000-4000-8000-000000000001',
        'c0000000-0000-4000-8000-000000000001',
        'b0000000-0000-4000-8000-000000000001');
COMMIT;
SQL

# An active manager/editor member may link their own approved listing to that verified profile.
psql -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000002', true);
INSERT INTO public.marketplace_listing_provider_links(listing_id, directory_entity_id, linked_by)
VALUES ('a0000000-0000-4000-8000-000000000002',
        'c0000000-0000-4000-8000-000000000002',
        'b0000000-0000-4000-8000-000000000002');
COMMIT;
SQL

# Existing pending submissions remain linkable to a verified profile by their owner.
psql -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
INSERT INTO public.marketplace_listing_provider_links(listing_id, directory_entity_id, linked_by)
VALUES ('a0000000-0000-4000-8000-000000000003',
        'c0000000-0000-4000-8000-000000000001',
        'b0000000-0000-4000-8000-000000000001');
COMMIT;
SQL


# Every negative case below must be rejected by RLS.
expect_denied() {
  local user_id="$1"
  local listing_id="$2"
  local entity_id="$3"
  local output
  output="$(mktemp)"
  if psql -v ON_ERROR_STOP=1 >"$output" 2>&1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$user_id', true);
INSERT INTO public.marketplace_listing_provider_links(listing_id, directory_entity_id, linked_by)
VALUES ('$listing_id', '$entity_id', '$user_id');
COMMIT;
SQL
  then
    rm -f "$output"
    echo "ERROR: unauthorized provider-link insert unexpectedly succeeded for $user_id" >&2
    exit 1
  fi
  if ! grep -q 'new row violates row-level security policy for table "marketplace_listing_provider_links"' "$output"; then
    cat "$output" >&2
    rm -f "$output"
    echo "ERROR: provider-link write failed for a reason other than the expected RLS rejection" >&2
    exit 1
  fi
  rm -f "$output"
}

# A profile manager cannot link a listing owned by a different user.
expect_denied \
  b0000000-0000-4000-8000-000000000001 \
  a0000000-0000-4000-8000-000000000007 \
  c0000000-0000-4000-8000-000000000001

# A listing owner cannot attach an arbitrary profile they do not manage.
expect_denied \
  b0000000-0000-4000-8000-000000000006 \
  a0000000-0000-4000-8000-000000000007 \
  c0000000-0000-4000-8000-000000000001

# An unverified profile owner must not be allowed to link.
expect_denied \
  b0000000-0000-4000-8000-000000000004 \
  a0000000-0000-4000-8000-000000000005 \
  c0000000-0000-4000-8000-000000000004

# A revoked member must not retain linking permission.
expect_denied \
  b0000000-0000-4000-8000-000000000005 \
  a0000000-0000-4000-8000-000000000006 \
  c0000000-0000-4000-8000-000000000005

# A hidden provider profile cannot receive a new user-managed link.
expect_denied \
  b0000000-0000-4000-8000-000000000001 \
  a0000000-0000-4000-8000-000000000004 \
  c0000000-0000-4000-8000-000000000003

# Simulate a pre-existing/legacy hidden link and ensure anonymous reads still suppress it.
psql -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO public.marketplace_listing_provider_links(listing_id, directory_entity_id, linked_by)
VALUES ('a0000000-0000-4000-8000-000000000004',
        'c0000000-0000-4000-8000-000000000003',
        'b0000000-0000-4000-8000-000000000001');
SQL

# A user cannot supply a linked_by value for another account.
if psql -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
INSERT INTO public.marketplace_listing_provider_links(listing_id, directory_entity_id, linked_by)
VALUES ('a0000000-0000-4000-8000-000000000001',
        'c0000000-0000-4000-8000-000000000001',
        'b0000000-0000-4000-8000-000000000002');
COMMIT;
SQL
then
  echo "ERROR: a user changed linked_by to another account" >&2
  exit 1
fi

# No direct UPDATE grant exists; links are added/deleted through narrow policies only.
psql -v ON_ERROR_STOP=1 -At <<'SQL' | grep -qx 'f'
SELECT has_table_privilege('authenticated',
  'public.marketplace_listing_provider_links', 'UPDATE');
SQL
psql -v ON_ERROR_STOP=1 -At <<'SQL' | grep -qx 'f'
SELECT has_table_privilege('anon',
  'public.marketplace_listing_provider_links', 'INSERT');
SQL

# Anonymous reads include only approved listings attached to published, visible provider profiles.
psql -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL ROLE anon;
DO $test$
DECLARE
  visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count
  FROM public.marketplace_listing_provider_links;
  IF visible_count <> 2 THEN
    RAISE EXCEPTION 'Expected 2 public provider links (approved + published + visible), got %', visible_count;
  END IF;
END
$test$;
COMMIT;
SQL

echo "Marketplace provider-link RLS smoke test passed."
