#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(git rev-parse --show-toplevel)"
MIGRATION="$ROOT_DIR/supabase/migrations/20261120190000_supplier_ads_placement_targets.sql"
ORDER_MIGRATION="$ROOT_DIR/supabase/migrations/20261120223000_supplier_ads_manual_placement_order.sql"
COMPANY_PLACEMENT_MIGRATION="$ROOT_DIR/supabase/migrations/20261128085517_supplier_ads_company_directory_placement.sql"
: "${PGHOST:=127.0.0.1}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGPASSWORD:=postgres}"
: "${PGDATABASE:=asyut_aqar_migration_test}"
export PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE

OWNER_ID="11111111-1111-4111-8111-111111111111"
ADMIN_ID="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
OWNER_AD_ID="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01"
ADMIN_AD_ID="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02"

echo "Preparing isolated supplier_ads baseline..."
psql -X -v ON_ERROR_STOP=1 <<SQL
DO \$roles\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END
\$roles\$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS \$f\$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
\$f\$;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE OR REPLACE FUNCTION private.layan_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS \$f\$ SELECT COALESCE(auth.uid() = '$ADMIN_ID'::uuid, false); \$f\$;
GRANT EXECUTE ON FUNCTION private.layan_is_admin() TO authenticated;
INSERT INTO auth.users(id) VALUES ('$OWNER_ID'),('$ADMIN_ID') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.supplier_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL,
  business_name text NOT NULL, category text NOT NULL, title text NOT NULL,
  description text NOT NULL, image_url text, target_url text, contact_phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending', ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_ads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_ads FROM PUBLIC;
GRANT SELECT ON public.supplier_ads TO anon, authenticated;
GRANT INSERT, UPDATE ON public.supplier_ads TO authenticated;
CREATE OR REPLACE VIEW public.public_active_supplier_ads
WITH (security_invoker = true)
AS SELECT id, business_name, category, title, description, image_url,
          target_url, contact_phone, created_at
     FROM public.supplier_ads
    WHERE status='active' AND (ends_at IS NULL OR ends_at > now());
GRANT SELECT ON public.public_active_supplier_ads TO anon, authenticated;
DROP POLICY IF EXISTS supplier_ads_test_public_read ON public.supplier_ads;
CREATE POLICY supplier_ads_test_public_read ON public.supplier_ads FOR SELECT TO anon USING(status='active');
DROP POLICY IF EXISTS supplier_ads_test_auth_read ON public.supplier_ads;
CREATE POLICY supplier_ads_test_auth_read ON public.supplier_ads FOR SELECT TO authenticated
USING(status='active' OR owner_id=auth.uid() OR private.layan_is_admin());
DROP POLICY IF EXISTS supplier_ads_test_owner_insert ON public.supplier_ads;
CREATE POLICY supplier_ads_test_owner_insert ON public.supplier_ads FOR INSERT TO authenticated
WITH CHECK(owner_id=auth.uid() AND status='pending');
DROP POLICY IF EXISTS supplier_ads_test_admin_insert ON public.supplier_ads;
CREATE POLICY supplier_ads_test_admin_insert ON public.supplier_ads FOR INSERT TO authenticated
WITH CHECK(private.layan_is_admin() AND owner_id IS NOT NULL AND status='pending');
DROP POLICY IF EXISTS supplier_ads_test_owner_update ON public.supplier_ads;
CREATE POLICY supplier_ads_test_owner_update ON public.supplier_ads FOR UPDATE TO authenticated
USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
DROP POLICY IF EXISTS supplier_ads_test_admin_update ON public.supplier_ads;
CREATE POLICY supplier_ads_test_admin_update ON public.supplier_ads FOR UPDATE TO authenticated
USING(private.layan_is_admin()) WITH CHECK(private.layan_is_admin());
SQL

echo "Apply migration twice to check fresh-install and idempotent-upgrade behavior..."
psql -X -v ON_ERROR_STOP=1 -f "$MIGRATION"
psql -X -v ON_ERROR_STOP=1 -f "$MIGRATION"
psql -X -v ON_ERROR_STOP=1 -f "$ORDER_MIGRATION"
psql -X -v ON_ERROR_STOP=1 -f "$ORDER_MIGRATION"
psql -X -v ON_ERROR_STOP=1 -f "$COMPANY_PLACEMENT_MIGRATION"
psql -X -v ON_ERROR_STOP=1 -f "$COMPANY_PLACEMENT_MIGRATION"

echo "Verify placement column, invoker view and internal trigger boundary..."
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='supplier_ads'
      AND column_name='placement_keys' AND is_nullable='NO') THEN
    RAISE EXCEPTION 'placement_keys must be a required column';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='supplier_ads'
      AND column_name='placement_order' AND is_nullable='NO') THEN
    RAISE EXCEPTION 'placement_order must be a required column';
  END IF;
  IF has_function_privilege('anon','private.layan_guard_supplier_ad_placements()','EXECUTE')
     OR has_function_privilege('authenticated','private.layan_guard_supplier_ad_placements()','EXECUTE') THEN
    RAISE EXCEPTION 'Placement guard function must not be API-callable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='public_active_supplier_ads'
      AND c.reloptions @> ARRAY['security_invoker=true']) THEN
    RAISE EXCEPTION 'Public active ads view must remain SECURITY INVOKER';
  END IF;
END
$check$;
SQL

echo "Owner insert must ignore forged placement targets and apply compatibility defaults..."
psql -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$OWNER_ID',true);
INSERT INTO public.supplier_ads(id,owner_id,business_name,category,title,description,contact_phone,status,placement_keys)
VALUES ('$OWNER_AD_ID','$OWNER_ID','Owner test','Ceramics','Owner ad test','Placement security test.','01012345678','pending',ARRAY['company_directory']);
DO \$owner_check\$
DECLARE v text[]; v_order jsonb;
BEGIN
  SELECT placement_keys, placement_order INTO v, v_order FROM public.supplier_ads WHERE id='$OWNER_AD_ID';
  IF v IS DISTINCT FROM ARRAY['home','offers','marketplace','featured']::text[] THEN
    RAISE EXCEPTION 'Owner-supplied placement was not replaced: %',v;
  END IF;
  IF v_order IS DISTINCT FROM '{}'::jsonb THEN
    RAISE EXCEPTION 'Owner-supplied ordering metadata was not reset: %',v_order;
  END IF;
END
\$owner_check\$;
UPDATE public.supplier_ads SET title='Owner can still edit ad content' WHERE id='$OWNER_AD_ID';
COMMIT;
SQL

echo "Owner placement update must be denied..."
set +e
psql -X -v ON_ERROR_STOP=1 >/tmp/supplier-ad-owner-placement-denied.log 2>&1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$OWNER_ID',true);
UPDATE public.supplier_ads SET placement_keys=ARRAY['company_directory'] WHERE id='$OWNER_AD_ID';
COMMIT;
SQL
OWNER_STATUS=$?
set -e
if [[ "$OWNER_STATUS" -eq 0 ]]; then
  echo "FAIL: owner changed sponsored-ad placements." >&2
  exit 1
fi

echo "Owner placement order update must also be denied..."
set +e
psql -X -v ON_ERROR_STOP=1 >/tmp/supplier-ad-owner-order-denied.log 2>&1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$OWNER_ID',true);
UPDATE public.supplier_ads SET placement_order='{"home":0}'::jsonb WHERE id='$OWNER_AD_ID';
COMMIT;
SQL
OWNER_ORDER_STATUS=$?
set -e
if [[ "$OWNER_ORDER_STATUS" -eq 0 ]]; then
  echo "FAIL: owner changed sponsored-ad placement order." >&2
  exit 1
fi

echo "Administrator may set a selected placement; unsupported keys must be rejected..."
psql -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$ADMIN_ID',true);
INSERT INTO public.supplier_ads(id,owner_id,business_name,category,title,description,contact_phone,status,placement_keys)
VALUES ('$ADMIN_AD_ID','$OWNER_ID','Admin test','Furniture','Admin ad test','Placement selection test.','01098765432','pending',ARRAY['company_directory']);
UPDATE public.supplier_ads SET status='active' WHERE id='$ADMIN_AD_ID';
DO \$admin_check\$
DECLARE v text[];
BEGIN
  SELECT placement_keys INTO v FROM public.supplier_ads WHERE id='$ADMIN_AD_ID';
  IF v IS DISTINCT FROM ARRAY['company_directory']::text[] THEN RAISE EXCEPTION 'Admin selection lost: %',v; END IF;
END
\$admin_check\$;
UPDATE public.supplier_ads SET placement_keys=ARRAY['company_directory','home'] WHERE id='$ADMIN_AD_ID';
SELECT public.layan_reorder_supplier_ads('company_directory', ARRAY['$ADMIN_AD_ID']::uuid[]);
DO \$order_check\$
DECLARE v jsonb;
BEGIN
  SELECT placement_order INTO v FROM public.supplier_ads WHERE id='$ADMIN_AD_ID';
  IF v ->> 'company_directory' <> '0' THEN
    RAISE EXCEPTION 'Expected company_directory position 0, got %',v;
  END IF;
END
\$order_check\$;
COMMIT;
SQL

set +e
psql -X -v ON_ERROR_STOP=1 >/tmp/supplier-ad-invalid-placement.log 2>&1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$ADMIN_ID',true);
UPDATE public.supplier_ads SET placement_keys=ARRAY['unsupported'] WHERE id='$ADMIN_AD_ID';
COMMIT;
SQL
INVALID_STATUS=$?
set -e
if [[ "$INVALID_STATUS" -eq 0 ]]; then
  echo "FAIL: unsupported placement key was accepted." >&2
  exit 1
fi

echo "Anonymous visitors see only active ads and their public placement metadata..."
psql -X -v ON_ERROR_STOP=1 <<SQL
GRANT SELECT ON public.public_active_supplier_ads TO anon, authenticated;
BEGIN;
SET LOCAL ROLE anon;
DO \$public_check\$
DECLARE v_count integer; v text[]; v_order jsonb;
BEGIN
  SELECT count(*) INTO v_count FROM public.public_active_supplier_ads;
  IF v_count<>1 THEN RAISE EXCEPTION 'Expected one active public ad, got %',v_count; END IF;
  SELECT placement_keys, placement_order INTO v, v_order FROM public.public_active_supplier_ads WHERE id='$ADMIN_AD_ID';
  IF v IS DISTINCT FROM ARRAY['company_directory','home']::text[] THEN RAISE EXCEPTION 'Wrong public placement metadata: %',v; END IF;
  IF v_order ->> 'company_directory' <> '0' THEN RAISE EXCEPTION 'Wrong public placement order metadata: %',v_order; END IF;
  IF has_table_privilege('anon','public.supplier_ads','UPDATE') THEN RAISE EXCEPTION 'Anon unexpectedly has update rights'; END IF;
  IF NOT has_column_privilege('anon','public.supplier_ads','placement_order','SELECT') THEN RAISE EXCEPTION 'Anon cannot read public placement order'; END IF;
END
\$public_check\$;
ROLLBACK;
SQL

echo "PASS: all supplier-ad placement migrations are idempotent; owners retain legacy defaults and cannot forge or update placements; admins can target and reorder company-directory ads; public SECURITY INVOKER visibility remains intact."
