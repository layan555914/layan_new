#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATIONS="$ROOT_DIR/supabase/migrations"

: "${PGHOST:=127.0.0.1}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGPASSWORD:=postgres}"
: "${PGDATABASE:=asyut_aqar_migration_test}"
export PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE

USER_ONE="11111111-1111-4111-8111-111111111111"
USER_TWO="22222222-2222-4222-8222-222222222222"
ADMIN_ID="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
ENTITY_ID="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
CLAIM_ONE="cccccccc-cccc-4ccc-8ccc-ccccccccccc1"
CLAIM_TWO="cccccccc-cccc-4ccc-8ccc-ccccccccccc2"

echo "Preparing an isolated PostgreSQL baseline for the company-claim feature..."
psql -X -v ON_ERROR_STOP=1 <<SQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO \$roles\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
\$roles\$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS \$function\$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
\$function\$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Minimal pre-existing platform contract used by the feature migrations.
CREATE TABLE public.directory_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  public_visible boolean NOT NULL DEFAULT true,
  verification_status text NOT NULL DEFAULT 'published'
);
GRANT SELECT ON public.directory_entities TO authenticated;

CREATE OR REPLACE FUNCTION private.layan_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS \$function\$
  SELECT COALESCE(auth.uid() = '$ADMIN_ID'::uuid, false);
\$function\$;
GRANT EXECUTE ON FUNCTION private.layan_is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.layan_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS \$function\$
  SELECT private.layan_is_admin();
\$function\$;
GRANT EXECUTE ON FUNCTION public.layan_is_admin() TO authenticated;

INSERT INTO auth.users (id)
VALUES ('$USER_ONE'), ('$USER_TWO'), ('$ADMIN_ID')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.directory_entities (id, name_ar, public_visible, verification_status)
VALUES ('$ENTITY_ID', 'شركة اختبار معزولة', true, 'published')
ON CONFLICT (id) DO NOTHING;
SQL

echo "1/5 Fresh install: the guarded locking migration must safely skip missing feature tables."
psql -X -v ON_ERROR_STOP=1 -f "$MIGRATIONS/20261113165309_serialize_company_claim_approvals_by_entity.sql"
if [[ "$(psql -X -Atqc "SELECT to_regprocedure('private.company_claim_admin_review(uuid,text,text)') IS NULL")" != "t" ]]; then
  echo "FAIL: the guard migration should not create its function before the feature tables exist." >&2
  exit 1
fi

echo "2/5 Fresh install: apply the self-contained reconciliation migration."
psql -X -v ON_ERROR_STOP=1 -f "$MIGRATIONS/20261113172533_company_claim_feature_schema_reconciliation.sql"

echo "3/5 Upgrade/idempotency: rerun reconciliation, then exercise the existing-schema locking path."
psql -X -v ON_ERROR_STOP=1 -f "$MIGRATIONS/20261113172533_company_claim_feature_schema_reconciliation.sql"
psql -X -v ON_ERROR_STOP=1 -f "$MIGRATIONS/20261113165309_serialize_company_claim_approvals_by_entity.sql"

echo "Checking RLS, grants, function security modes and the company-row lock..."
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $check$
DECLARE
  v_lock boolean;
  v_private_definer boolean;
  v_public_invoker boolean;
BEGIN
  IF to_regclass('public.company_claim_requests') IS NULL
     OR to_regclass('public.company_entity_managers') IS NULL THEN
    RAISE EXCEPTION 'Company-claim tables were not created';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.company_claim_requests'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.company_entity_managers'::regclass) THEN
    RAISE EXCEPTION 'RLS must be enabled on both company-claim tables';
  END IF;

  IF has_table_privilege('anon', 'public.company_claim_requests', 'SELECT')
     OR has_table_privilege('anon', 'public.company_claim_requests', 'INSERT')
     OR has_table_privilege('anon', 'public.company_entity_managers', 'SELECT') THEN
    RAISE EXCEPTION 'Anonymous access must be denied on company-claim tables';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.company_claim_requests', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.company_claim_requests', 'INSERT')
     OR has_table_privilege('authenticated', 'public.company_claim_requests', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.company_claim_requests', 'DELETE')
     OR NOT has_table_privilege('authenticated', 'public.company_entity_managers', 'SELECT')
     OR has_table_privilege('authenticated', 'public.company_entity_managers', 'INSERT') THEN
    RAISE EXCEPTION 'Authenticated grants do not match the least-privilege model';
  END IF;

  IF has_function_privilege('anon', 'public.company_claim_admin_list()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.company_claim_admin_review(uuid,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.company_claim_admin_list()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.company_claim_admin_review(uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Admin RPC execute grants do not match the expected boundary';
  END IF;

  SELECT p.prosecdef INTO v_private_definer
  FROM pg_proc p
  WHERE p.oid = 'private.company_claim_admin_review(uuid,text,text)'::regprocedure;
  SELECT NOT p.prosecdef INTO v_public_invoker
  FROM pg_proc p
  WHERE p.oid = 'public.company_claim_admin_review(uuid,text,text)'::regprocedure;
  IF NOT COALESCE(v_private_definer, false) OR NOT COALESCE(v_public_invoker, false) THEN
    RAISE EXCEPTION 'Private review function must be SECURITY DEFINER and public wrapper SECURITY INVOKER';
  END IF;

  SELECT position('FOR UPDATE' IN pg_get_functiondef(
    'private.company_claim_admin_review(uuid,text,text)'::regprocedure
  )) > 0 INTO v_lock;
  IF NOT COALESCE(v_lock, false) THEN
    RAISE EXCEPTION 'Approval function is missing the directory entity row lock';
  END IF;

  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'company_claim_requests') <> 2
     OR (SELECT count(*) FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'company_entity_managers') <> 1 THEN
    RAISE EXCEPTION 'Unexpected RLS policy count for the company-claim tables';
  END IF;
END
$check$;
SQL

echo "4/5 RLS smoke test: each signed-in requester can create and read only their own pending request."
psql -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$USER_ONE', true);
INSERT INTO public.company_claim_requests (
  id, directory_entity_id, requester_user_id,
  representative_name, representative_role, contact_phone
) VALUES (
  '$CLAIM_ONE', '$ENTITY_ID', '$USER_ONE',
  'ممثل الشركة الأول', 'مدير فرع', '01012345678'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$USER_TWO', true);
INSERT INTO public.company_claim_requests (
  id, directory_entity_id, requester_user_id,
  representative_name, representative_role, contact_phone
) VALUES (
  '$CLAIM_TWO', '$ENTITY_ID', '$USER_TWO',
  'ممثل الشركة الثاني', 'مدير فرع', '01087654321'
);
COMMIT;
SQL

psql -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$USER_ONE', true);
DO \$own_read\$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.company_claim_requests;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Requester one can see % claim rows; expected exactly one', v_count; END IF;
END
\$own_read\$;
SELECT set_config('request.jwt.claim.sub', '$USER_TWO', true);
DO \$own_read\$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.company_claim_requests;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Requester two can see % claim rows; expected exactly one', v_count; END IF;
END
\$own_read\$;
COMMIT;
SQL

echo "Checking that a requester cannot submit a claim for another user's account..."
set +e
psql -X -v ON_ERROR_STOP=1 > /tmp/company-claim-forged-owner.log 2>&1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$USER_ONE', true);
INSERT INTO public.company_claim_requests (
  id, directory_entity_id, requester_user_id,
  representative_name, representative_role, contact_phone
) VALUES (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '$ENTITY_ID', '$USER_TWO',
  'محاولة غير مصرح بها', 'مدير فرع', '01011112222'
);
COMMIT;
SQL
forged_insert_status=$?
set -e
if [[ "$forged_insert_status" -eq 0 ]]; then
  echo "FAIL: forged requester_user_id insert was accepted." >&2
  exit 1
fi
if ! grep -Eqi 'row-level security|policy' /tmp/company-claim-forged-owner.log; then
  cat /tmp/company-claim-forged-owner.log >&2
  echo "FAIL: forged insert failed for an unexpected reason." >&2
  exit 1
fi

echo "5/5 Concurrency test: two approvals for the same company must not both succeed."
psql -X -v ON_ERROR_STOP=1 <<'SQL'
CREATE OR REPLACE FUNCTION public.company_claim_test_delay_manager_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM pg_sleep(2);
  RETURN NEW;
END;
$function$;

CREATE TRIGGER company_claim_test_delay_manager_insert
BEFORE INSERT ON public.company_entity_managers
FOR EACH ROW EXECUTE FUNCTION public.company_claim_test_delay_manager_insert();
SQL

approve_claim() {
  local claim_id="$1"
  local output_file="$2"
  psql -X -v ON_ERROR_STOP=1 > "$output_file" 2>&1 <<SQL
\\set VERBOSITY verbose
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$ADMIN_ID', true);
SELECT public.company_claim_admin_review('$claim_id', 'approve', NULL);
COMMIT;
SQL
}

set +e
approve_claim "$CLAIM_ONE" /tmp/company-claim-approval-one.log &
approval_one_pid=$!
sleep 0.2
approve_claim "$CLAIM_TWO" /tmp/company-claim-approval-two.log &
approval_two_pid=$!
wait "$approval_one_pid"
approval_one_status=$?
wait "$approval_two_pid"
approval_two_status=$?
set -e

if [[ "$approval_one_status" -eq "$approval_two_status" ]]; then
  cat /tmp/company-claim-approval-one.log /tmp/company-claim-approval-two.log >&2
  echo "FAIL: expected exactly one concurrent approval to succeed." >&2
  exit 1
fi
if [[ "$approval_one_status" -ne 0 ]] && ! grep -Fq 'هذا الملف مرتبط بالفعل بحساب ممثل آخر' /tmp/company-claim-approval-one.log; then
  cat /tmp/company-claim-approval-one.log >&2
  echo "FAIL: first approval failed for an unexpected reason." >&2
  exit 1
fi
if [[ "$approval_two_status" -ne 0 ]] && ! grep -Fq 'هذا الملف مرتبط بالفعل بحساب ممثل آخر' /tmp/company-claim-approval-two.log; then
  cat /tmp/company-claim-approval-two.log >&2
  echo "FAIL: second approval failed for an unexpected reason." >&2
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $concurrency$
BEGIN
  IF (SELECT count(*) FROM public.company_entity_managers) <> 1 THEN
    RAISE EXCEPTION 'Exactly one manager link must remain after concurrent approvals';
  END IF;
  IF (SELECT count(*) FROM public.company_claim_requests WHERE status = 'approved') <> 1 THEN
    RAISE EXCEPTION 'Exactly one claim request must be approved after concurrent approvals';
  END IF;
  IF (SELECT count(*) FROM public.company_claim_requests WHERE status = 'pending') <> 1 THEN
    RAISE EXCEPTION 'The losing claim must remain pending for manual review';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.company_entity_managers m
    JOIN public.company_claim_requests c ON c.id = m.claim_request_id
    WHERE c.status <> 'approved' OR m.owner_user_id <> c.requester_user_id
  ) THEN
    RAISE EXCEPTION 'The manager link must correspond to the approved requester';
  END IF;
END
$concurrency$;
SQL

echo "PASS: clean-install guard, reconciliation idempotency, existing-schema upgrade, RLS/grants, admin RPC security and concurrent company approvals."

echo "Preparing the verified-representative and company-profile self-service contracts..."
psql -X -v ON_ERROR_STOP=1 <<SQL
ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;
UPDATE auth.users SET
  email = CASE
    WHEN id = '$USER_ONE'::uuid THEN 'owner-one@example.invalid'
    WHEN id = '$USER_TWO'::uuid THEN 'owner-two@example.invalid'
    WHEN id = '$ADMIN_ID'::uuid THEN 'admin@example.invalid'
    ELSE email END,
  email_confirmed_at = now();

ALTER TABLE public.directory_entities
  ADD COLUMN IF NOT EXISTS public_phone text,
  ADD COLUMN IF NOT EXISTS public_email text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS public_business_hours text,
  ADD COLUMN IF NOT EXISTS public_services text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS public_coverage_areas text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS public_gallery_urls text[] NOT NULL DEFAULT '{}'::text[];

CREATE OR REPLACE FUNCTION public.layan_is_http_url(p_url text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS \$function\$
  SELECT p_url ~* '^https?://[^[:space:]]+';
\$function\$;

CREATE TABLE IF NOT EXISTS public.directory_change_log (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  changed_by uuid,
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.directory_change_log TO authenticated;

CREATE TABLE public.company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  services text[] NOT NULL DEFAULT '{}'::text[],
  city text NOT NULL DEFAULT 'أسيوط',
  address text,
  phone text NOT NULL,
  whatsapp text,
  website text,
  logo_url text,
  gallery_urls text[] NOT NULL DEFAULT '{}'::text[],
  projects jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  pending_update jsonb,
  update_status text,
  update_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.company_profiles(
  id,owner_id,company_name,category,description,services,city,phone,status,reviewed_at,reviewed_by
) VALUES (
  '99999999-9999-4999-8999-999999999991','$USER_ONE',
  'شركة قائمة للاختبار','خدمات عقارية','ملف شركة موجود لاختبار إدارة البيانات التشغيلية والصلاحيات.',
  ARRAY['استشارات عقارية'],'أسيوط','01012345678','active',now(),'$ADMIN_ID'
);
SQL

echo "Applying verified representative and delegated access migrations to the isolated PostgreSQL test database..."
psql -X -v ON_ERROR_STOP=1 -f "$MIGRATIONS/20261114200000_verified_representatives_self_service.sql"
psql -X -v ON_ERROR_STOP=1 -f "$MIGRATIONS/20261114203000_company_profile_verified_owner_controls.sql"

echo "Checking verification and least-privilege schema contracts..."
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $schema_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='company_entity_managers' AND column_name='verified_at'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='directory_entities' AND column_name='representative_verified_at'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='company_profiles' AND column_name='verified_at'
  ) THEN
    RAISE EXCEPTION 'Representative verification fields are missing';
  END IF;

  IF has_table_privilege('anon','public.company_entity_manager_members','SELECT')
     OR has_table_privilege('authenticated','public.company_entity_manager_members','INSERT')
     OR has_table_privilege('authenticated','public.company_entity_manager_members','UPDATE')
     OR has_table_privilege('authenticated','public.company_entity_manager_members','DELETE')
     OR has_table_privilege('anon','public.company_profile_manager_members','SELECT')
     OR has_table_privilege('authenticated','public.company_profile_manager_members','INSERT')
     OR has_table_privilege('authenticated','public.company_profile_manager_members','UPDATE')
     OR has_table_privilege('authenticated','public.company_profile_manager_members','DELETE') THEN
    RAISE EXCEPTION 'Delegated access table grants are too broad';
  END IF;

  IF has_function_privilege('anon','public.company_entity_profile_update_direct(uuid,jsonb)','EXECUTE')
     OR has_function_privilege('anon','public.company_profile_update_direct(uuid,jsonb)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.company_entity_profile_update_direct(uuid,jsonb)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.company_profile_update_direct(uuid,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Direct-update RPC grants are incorrect';
  END IF;

  IF (SELECT prosecdef FROM pg_proc WHERE oid='private.company_entity_profile_update_direct(uuid,jsonb)'::regprocedure) IS DISTINCT FROM true
     OR (SELECT prosecdef FROM pg_proc WHERE oid='private.company_profile_update_direct(uuid,jsonb)'::regprocedure) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Profile update RPCs must enforce authorization in SECURITY DEFINER functions';
  END IF;

  IF (SELECT count(*) FROM public.company_profiles WHERE id='99999999-9999-4999-8999-999999999991'::uuid AND verified_at IS NOT NULL)<>1 THEN
    RAISE EXCEPTION 'Previously approved company profiles were not migrated to verified status';
  END IF;
END
$schema_check$;
SQL

echo "Testing verified directory representative, direct operational edits and delegated revocation..."
psql -X -v ON_ERROR_STOP=1 <<SQL
INSERT INTO public.directory_entities(
  id,name_ar,public_visible,verification_status,public_phone,description
) VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01','ملف اختبار ممثل موثق',true,'published','01055555555','وصف أولي للاختبار'
);

INSERT INTO public.company_claim_requests(
  id,directory_entity_id,requester_user_id,representative_name,representative_role,
  contact_phone,contact_email,notes,evidence_url,evidence_description,status
) VALUES (
  'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01','$USER_ONE',
  'ممثل الشركة الجديد','مدير النشاط','01011112222','owner-one@example.invalid',
  'طلب تحقق تجريبي','https://company.example.invalid/team',
  'اسمي مدرج في صفحة الفريق الرسمية.','pending'
);
SQL

psql -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$ADMIN_ID', true);
SELECT public.company_claim_admin_review(
  'cccccccc-cccc-4ccc-8ccc-cccccccccc01','approve',NULL,
  'official_phone','تم الاتصال بالهاتف الرسمي والتحقق من صفة الممثل والتفويض'
);
COMMIT;
SQL

psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $directory_verified$
DECLARE
  v_employee uuid := '22222222-2222-4222-8222-222222222222';
  v_denied boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.company_entity_managers
    WHERE directory_entity_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01'::uuid
      AND owner_user_id='11111111-1111-4111-8111-111111111111'::uuid
      AND verified_at IS NOT NULL AND verification_method='official_phone'
  ) THEN RAISE EXCEPTION 'Claim approval did not record a verified representative'; END IF;

  PERFORM set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  PERFORM public.company_entity_profile_update_direct(
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01'::uuid,
    '{"description":"تحديث تشغيلي مباشر بواسطة ممثل موثق"}'::jsonb
  );
  BEGIN
    PERFORM public.company_entity_profile_update_direct(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01'::uuid,
      '{"name_ar":"تغيير اسم الشركة دون مراجعة"}'::jsonb
    );
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'High-risk identity field was accepted by direct update'; END IF;

  PERFORM public.company_entity_manager_invite(
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01'::uuid,'owner-two@example.invalid','editor'
  );
  PERFORM set_config('request.jwt.claim.sub',v_employee::text,true);
  PERFORM public.company_entity_profile_update_direct(
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01'::uuid,
    '{"description":"تحديث بواسطة محرر مفوض"}'::jsonb
  );
  PERFORM set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  IF NOT public.company_entity_manager_revoke(
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01'::uuid,v_employee
  ) THEN RAISE EXCEPTION 'Owner could not revoke delegated access'; END IF;

  PERFORM set_config('request.jwt.claim.sub',v_employee::text,true);
  v_denied:=false;
  BEGIN
    PERFORM public.company_entity_profile_update_direct(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01'::uuid,
      '{"description":"محاولة تعديل بعد سحب الصلاحية"}'::jsonb
    );
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Revoked directory member retained edit access'; END IF;
END
$directory_verified$;
SQL

echo "Testing owner-submitted company profile verification and delegated self-service..."
psql -X -v ON_ERROR_STOP=1 <<SQL
INSERT INTO public.company_profiles(
  id,owner_id,company_name,category,description,services,city,phone,status
) VALUES (
  '99999999-9999-4999-8999-999999999992','$USER_TWO',
  'شركة جديدة للاختبار','شركات عقارية','ملف تجريبي جديد لاختبار التحقق من ممثل الشركة.',
  ARRAY['تسويق عقاري'],'أسيوط','01087654321','pending'
);
SQL

psql -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$USER_TWO', true);
SELECT public.layan_company_profile_set_representative_details(
  '99999999-9999-4999-8999-999999999992'::uuid,
  'ممثل الشركة الثانية','شريك','https://company-two.example.invalid/about',
  'الممثل شريك في الشركة حسب الصفحة الرسمية.'
);
COMMIT;
SQL

psql -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$ADMIN_ID', true);
SELECT public.layan_review_company_profile(
  '99999999-9999-4999-8999-999999999992'::uuid,'approve',NULL,
  'official_phone','تم الاتصال بالهاتف المنشور والتحقق من صفة الشريك'
);
COMMIT;
SQL

psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $company_verified$
DECLARE
  v_denied boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.company_profiles
    WHERE id='99999999-9999-4999-8999-999999999992'::uuid
      AND status='active' AND verified_at IS NOT NULL
      AND verification_method='official_phone'
      AND verified_by='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
  ) THEN RAISE EXCEPTION 'Company profile approval did not verify the representative'; END IF;

  PERFORM set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  PERFORM public.company_profile_manager_invite(
    '99999999-9999-4999-8999-999999999991'::uuid,'owner-two@example.invalid','editor'
  );
  PERFORM set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
  PERFORM public.company_profile_update_direct(
    '99999999-9999-4999-8999-999999999991'::uuid,
    '{"description":"تحديث تشغيلي مباشر بواسطة موظف الشركة المفوض"}'::jsonb
  );
  BEGIN
    PERFORM public.company_profile_update_direct(
      '99999999-9999-4999-8999-999999999991'::uuid,
      '{"company_name":"تغيير الهوية دون مراجعة"}'::jsonb
    );
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Company identity fields were accepted by direct update'; END IF;
  PERFORM set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  IF NOT public.company_profile_manager_revoke(
    '99999999-9999-4999-8999-999999999991'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid
  ) THEN RAISE EXCEPTION 'Company owner could not revoke employee access'; END IF;
END
$company_verified$;
SQL

echo "PASS: verified identity approval, safe direct edits, admin-reviewed identity changes, delegated access and revocation for both company systems."

