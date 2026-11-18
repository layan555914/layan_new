#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATION="$ROOT_DIR/supabase/migrations/20261118000300_project_units_and_offer_associations.sql"

: "${PGHOST:=127.0.0.1}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGPASSWORD:=postgres}"
: "${PGDATABASE:=asyut_aqar_migration_test}"
export PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE

OWNER_ID="11111111-1111-4111-8111-111111111111"
MANAGER_ID="22222222-2222-4222-8222-222222222222"
ADMIN_ID="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
EDITOR_ID="33333333-3333-4333-8333-333333333333"
ENTITY_ID="eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01"
PROJECT_ID="55555555-5555-4555-8555-555555555555"
OLD_OFFER_ID="7001"
LINK_OFFER_ID="7002"
UNIT_ID=""
HIDDEN_UNIT_ID="77777777-7777-4777-8777-777777777777"

echo "Preparing an isolated property-offer baseline on top of the Phase 3 company/project schema..."
psql -X -v ON_ERROR_STOP=1 <<SQL
DO \$baseline\$
BEGIN
  IF to_regprocedure('private.company_entity_manager_access(uuid)') IS NULL
     OR to_regprocedure('private.layan_is_admin()') IS NULL
     OR to_regclass('public.directory_projects') IS NULL
     OR to_regclass('public.directory_project_entities') IS NULL
     OR to_regclass('public.company_entity_manager_members') IS NULL THEN
    RAISE EXCEPTION 'Run the Phase 3 project-management smoke test before this Phase 4 test';
  END IF;
END
\$baseline\$;

CREATE TABLE IF NOT EXISTS public.property_offers (
  id bigint PRIMARY KEY,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  project_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','available','reserved','sold')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.property_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.property_offers FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.property_offers TO anon,authenticated;
DROP POLICY IF EXISTS property_offers_test_public_read ON public.property_offers;
CREATE POLICY property_offers_test_public_read ON public.property_offers
FOR SELECT TO anon,authenticated USING (status='available');

INSERT INTO public.directory_project_entities(project_id,entity_id,relation_type)
VALUES ('$PROJECT_ID','$ENTITY_ID','developer')
ON CONFLICT DO NOTHING;

INSERT INTO public.property_offers(id,owner_id,title,project_name,status)
VALUES
  ('$OLD_OFFER_ID','$OWNER_ID','إعلان قديم يحمل اسم المشروع','مشروع اختبار الوحدة','available'),
  ('$LINK_OFFER_ID','$OWNER_ID','إعلان آخر لطلب الربط','اسم مشروع غير موثوق كنص','available')
ON CONFLICT (id) DO NOTHING;
SQL

echo "Applying the Phase 4 project-unit and ad-association migration to isolated PostgreSQL..."
psql -X -v ON_ERROR_STOP=1 -f "$MIGRATION"

echo "Checking RLS, direct grants, explicit association column and RPC security boundaries..."
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $check$
DECLARE
  v_private_definer boolean;
  v_public_invoker boolean;
BEGIN
  IF to_regclass('public.directory_project_units') IS NULL
     OR to_regclass('private.company_project_unit_requests') IS NULL
     OR to_regclass('private.property_offer_project_unit_requests') IS NULL THEN
    RAISE EXCEPTION 'Phase 4 unit/request tables were not created';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.directory_project_units'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private.company_project_unit_requests'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private.property_offer_project_unit_requests'::regclass) THEN
    RAISE EXCEPTION 'RLS must be enabled on public units and both private request tables';
  END IF;

  IF has_table_privilege('anon','public.directory_project_units','INSERT')
     OR has_table_privilege('authenticated','public.directory_project_units','INSERT')
     OR has_table_privilege('authenticated','public.directory_project_units','UPDATE')
     OR has_table_privilege('authenticated','public.directory_project_units','DELETE') THEN
    RAISE EXCEPTION 'Regular users must not write directly to the public unit inventory';
  END IF;

  IF has_table_privilege('anon','private.company_project_unit_requests','SELECT')
     OR has_table_privilege('authenticated','private.company_project_unit_requests','SELECT')
     OR has_table_privilege('authenticated','private.company_project_unit_requests','INSERT')
     OR has_table_privilege('authenticated','private.company_project_unit_requests','UPDATE')
     OR has_table_privilege('anon','private.property_offer_project_unit_requests','SELECT')
     OR has_table_privilege('authenticated','private.property_offer_project_unit_requests','SELECT')
     OR has_table_privilege('authenticated','private.property_offer_project_unit_requests','INSERT')
     OR has_table_privilege('authenticated','private.property_offer_project_unit_requests','UPDATE') THEN
    RAISE EXCEPTION 'Private unit request tables must not be directly accessible through table grants';
  END IF;

  IF has_table_privilege('authenticated','public.property_offers','UPDATE') THEN
    RAISE EXCEPTION 'Property owners must not be able to attach a project unit by direct table update';
  END IF;

  IF NOT has_function_privilege('authenticated','public.company_project_unit_request_submit(uuid,jsonb,text,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.property_offer_project_unit_request_submit(bigint,uuid,text,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.company_project_unit_request_admin_review(uuid,text,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.property_offer_project_unit_request_admin_review(uuid,text,text)','EXECUTE')
     OR has_function_privilege('anon','public.company_project_unit_request_submit(uuid,jsonb,text,text)','EXECUTE')
     OR has_function_privilege('anon','public.property_offer_project_unit_request_submit(bigint,uuid,text,text)','EXECUTE')
     OR has_function_privilege('anon','public.company_project_unit_request_admin_review(uuid,text,text)','EXECUTE')
     OR has_function_privilege('anon','public.property_offer_project_unit_request_admin_review(uuid,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Phase 4 RPC execute grants do not match the least-privilege contract';
  END IF;

  SELECT prosecdef INTO v_private_definer
  FROM pg_proc WHERE oid='private.property_offer_project_unit_request_admin_review(uuid,text,text)'::regprocedure;
  SELECT NOT prosecdef INTO v_public_invoker
  FROM pg_proc WHERE oid='public.property_offer_project_unit_request_admin_review(uuid,text,text)'::regprocedure;
  IF NOT coalesce(v_private_definer,false) OR NOT coalesce(v_public_invoker,false) THEN
    RAISE EXCEPTION 'Ad-link admin review must use a private SECURITY DEFINER function and public SECURITY INVOKER wrapper';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='property_offers' AND column_name='project_unit_id'
  ) THEN RAISE EXCEPTION 'Property offers did not receive the nullable unit association field'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.property_offers WHERE project_unit_id IS NOT NULL
  ) THEN RAISE EXCEPTION 'Legacy offers must not be backfilled or automatically linked'; END IF;
END
$check$;
SQL

echo "Owner submits a unit request; the unit must remain absent from the public inventory until administrator approval."
psql -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$OWNER_ID',true);
SELECT public.company_project_unit_request_submit(
  '$PROJECT_ID',
  '{"unit_ref":"A-12","unit_type":"apartment","building_label":"عمارة أ","floor_label":"الثالث","unit_number":"12","area_m2":145,"bedrooms":3,"bathrooms":2,"finishing":"نصف تشطيب","description":"وحدة اختبار من الشركة"}'::jsonb,
  'https://example.invalid/unit-evidence',
  'وصف دليل بيانات الوحدة من ملف المشروع'
);
DO \$owner_read\$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.company_project_unit_requests_mine();
  IF v_count <> 1 THEN RAISE EXCEPTION 'Verified owner should see exactly one unit request, got %',v_count; END IF;
END
\$owner_read\$;
COMMIT;
SQL

echo "A verified manager can submit a second unit; an editor cannot submit a unit request."
psql -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$MANAGER_ID',true);
SELECT public.company_project_unit_request_submit(
  '$PROJECT_ID',
  '{"unit_ref":"B-07","unit_type":"shop","building_label":"مبنى تجاري","floor_label":"الأرضي","unit_number":"7","area_m2":60}'::jsonb,
  NULL,
  'بيانات الوحدة مقدمة من مدير ملف الشركة المفوض'
);
COMMIT;
SQL

set +e
psql -X -v ON_ERROR_STOP=1 >/tmp/project-unit-editor-denied.log 2>&1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$EDITOR_ID',true);
SELECT public.company_project_unit_request_submit(
  '$PROJECT_ID',
  '{"unit_ref":"EDITOR-1","unit_type":"apartment"}'::jsonb,
  NULL,
  'محاولة غير مصرح بها من محرر الشركة'
);
COMMIT;
SQL
editor_status=$?
set -e
if [[ "$editor_status" -eq 0 ]]; then
  echo "FAIL: a company editor was allowed to submit a unit request." >&2
  exit 1
fi
if ! grep -Eqi 'إضافة الوحدات متاحة|permission denied|insufficient privilege|42501' /tmp/project-unit-editor-denied.log; then
  cat /tmp/project-unit-editor-denied.log >&2
  echo "FAIL: editor denial failed for an unexpected reason." >&2
  exit 1
fi

echo "Administrator approves the first unit; approval must publish exactly that unit under the chosen project."
psql -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$ADMIN_ID',true);
DO \$approve_unit\$
DECLARE v_request uuid; v_unit uuid;
BEGIN
  SELECT request_id INTO v_request
  FROM public.company_project_unit_request_admin_list()
  WHERE unit_payload->>'unit_ref'='A-12' AND status='pending';
  IF v_request IS NULL THEN RAISE EXCEPTION 'Unit request not available to administrator'; END IF;
  v_unit:=public.company_project_unit_request_admin_review(v_request,'approve',NULL);
  IF v_unit IS NULL THEN RAISE EXCEPTION 'Admin approval did not return a unit id'; END IF;
  PERFORM set_config('test.phase4_unit_id',v_unit::text,false);
END
\$approve_unit\$;
COMMIT;

DO \$unit_published\$
DECLARE v_unit uuid:=nullif(current_setting('test.phase4_unit_id',true),'')::uuid;
BEGIN
  IF v_unit IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.directory_project_units
    WHERE id=v_unit AND project_id='$PROJECT_ID'
      AND unit_ref='A-12' AND verification_status='published' AND public_visible=true
  ) THEN RAISE EXCEPTION 'Approved company unit was not published under the selected project'; END IF;
  IF (SELECT count(*) FROM public.directory_project_units WHERE project_id='$PROJECT_ID' AND public_visible AND verification_status='published')<>1 THEN
    RAISE EXCEPTION 'Only the approved unit should be publicly visible';
  END IF;
END
\$unit_published\$;
SQL

UNIT_ID="$(psql -X -Atqc "SELECT resulting_unit_id::text FROM private.company_project_unit_requests WHERE project_id='$PROJECT_ID' AND unit_payload->>'unit_ref'='A-12' AND status='approved' ORDER BY reviewed_at DESC LIMIT 1")"
if [[ -z "$UNIT_ID" ]]; then
  echo "FAIL: the approved unit identifier could not be retrieved from the review record." >&2
  exit 1
fi

echo "The owner requests an explicit link from an existing available ad to the approved unit."
psql -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$OWNER_ID',true);
SELECT public.property_offer_project_unit_request_submit(
  '$LINK_OFFER_ID',
  '$UNIT_ID',
  'https://example.invalid/ad-unit-evidence',
  'المعلن يؤكد أن الإعلان يخص الوحدة A-12 داخل المشروع المحدد'
);
DO \$owner_link_read\$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.property_offer_project_unit_requests_mine();
  IF v_count <> 1 THEN RAISE EXCEPTION 'Owner should see exactly one ad-unit association request, got %',v_count; END IF;
END
\$owner_link_read\$;
COMMIT;
SQL

echo "A direct owner update of project_unit_id must be blocked; only the admin review RPC can set it."
set +e
psql -X -v ON_ERROR_STOP=1 >/tmp/project-unit-direct-link-denied.log 2>&1 <<SQL
BEGIN;
SELECT set_config('request.jwt.claim.sub','$OWNER_ID',true);
UPDATE public.property_offers
SET project_unit_id='$UNIT_ID'::uuid
WHERE id='$LINK_OFFER_ID';
COMMIT;
SQL
direct_link_status=$?
set -e
if [[ "$direct_link_status" -eq 0 ]]; then
  echo "FAIL: direct property-offer unit association was accepted." >&2
  exit 1
fi
if ! grep -Eqi 'permission denied|ربط الإعلان بوحدة مشروع يحتاج إلى مراجعة' /tmp/project-unit-direct-link-denied.log; then
  cat /tmp/project-unit-direct-link-denied.log >&2
  echo "FAIL: direct ad-link denial failed for an unexpected reason." >&2
  exit 1
fi

echo "Administrator approves the explicit association; the FK is attached and the request is closed."
psql -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$ADMIN_ID',true);
DO \$approve_link\$
DECLARE v_request uuid; v_unit uuid;
BEGIN
  SELECT request_id INTO v_request
  FROM public.property_offer_project_unit_request_admin_list()
  WHERE offer_id='$LINK_OFFER_ID' AND status='pending';
  IF v_request IS NULL THEN RAISE EXCEPTION 'Ad-unit link request not available to administrator'; END IF;
  v_unit:=public.property_offer_project_unit_request_admin_review(v_request,'approve',NULL);
  IF v_unit IS NULL OR v_unit<>'$UNIT_ID'::uuid THEN
    RAISE EXCEPTION 'Admin approved the wrong unit link';
  END IF;
END
\$approve_link\$;
COMMIT;
SQL

echo "Checking linked offer, legacy no-match behavior, anonymous read rules and archived-unit visibility."
psql -X -v ON_ERROR_STOP=1 <<SQL
DO \$final_admin_check\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.property_offers
    WHERE id='$LINK_OFFER_ID'
      AND project_unit_id=nullif(current_setting('test.phase4_unit_id',true),'')::uuid
      AND status='available'
  ) THEN RAISE EXCEPTION 'Approved project unit association was not saved to the ad'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.property_offers
    WHERE id='$OLD_OFFER_ID' AND project_name='مشروع اختبار الوحدة' AND project_unit_id IS NULL
  ) THEN RAISE EXCEPTION 'Legacy ad with a matching project_name must remain unlinked'; END IF;
END
\$final_admin_check\$;

INSERT INTO public.directory_project_units (
  id,project_id,unit_ref,unit_type,verification_status,public_visible
) VALUES (
  '$HIDDEN_UNIT_ID','$PROJECT_ID','HIDDEN-1','apartment','archived',false
);

BEGIN;
SET LOCAL ROLE anon;
DO \$anon_read\$
DECLARE v_count integer; v_link_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.directory_project_units;
  IF v_count<>1 THEN RAISE EXCEPTION 'Anonymous visitors should see exactly one published unit, got %',v_count; END IF;
  SELECT count(*) INTO v_link_count FROM public.property_offers WHERE id='$LINK_OFFER_ID';
  IF v_link_count<>1 THEN RAISE EXCEPTION 'Anonymous visitors should see the public available associated ad'; END IF;
  IF has_table_privilege('anon','public.directory_project_units','INSERT')
     OR has_table_privilege('anon','public.property_offers','UPDATE') THEN
    RAISE EXCEPTION 'Anonymous direct writes must remain denied';
  END IF;
END
\$anon_read\$;
ROLLBACK;
SQL

echo "PASS: unit request authorization, private request storage, admin-only unit publishing, explicit owner ad-link request, admin-only FK association, no name-based legacy backfill, and public visibility boundaries."
