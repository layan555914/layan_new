#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATION="$ROOT_DIR/supabase/migrations/20261118000200_company_project_management_requests.sql"

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
AREA_ID="44444444-4444-4444-8444-444444444444"
EXISTING_PROJECT_ID="55555555-5555-4555-8555-555555555555"

echo "Preparing the existing directory/project contract in the isolated migration test database..."
psql -X -v ON_ERROR_STOP=1 <<SQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO \$baseline\$
BEGIN
  IF to_regnamespace('private') IS NULL THEN
    RAISE EXCEPTION 'The prior company-claim migration smoke test must run before this test (private schema missing)';
  END IF;
  IF to_regprocedure('private.company_entity_manager_access(uuid)') IS NULL
     OR to_regprocedure('private.layan_is_admin()') IS NULL THEN
    RAISE EXCEPTION 'The existing verified company access functions are required before this migration test';
  END IF;
END
\$baseline\$;

CREATE TABLE IF NOT EXISTS public.directory_areas (
  id uuid PRIMARY KEY,
  name_ar text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  public_visible boolean NOT NULL DEFAULT true,
  verification_status text NOT NULL DEFAULT 'published'
);

CREATE TABLE IF NOT EXISTS public.directory_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  project_type text NOT NULL CHECK (project_type IN (
    'residential','commercial','administrative','medical','educational',
    'mixed_use','land','service','other'
  )),
  description text,
  area_id uuid REFERENCES public.directory_areas(id) ON DELETE SET NULL,
  location_text text,
  size_value numeric,
  size_unit text,
  unit_count integer CHECK (unit_count IS NULL OR unit_count >= 0),
  project_status text NOT NULL CHECK (project_status IN (
    'announced','planned','under_construction','partially_delivered',
    'completed','operating','stalled','unknown'
  )),
  verification_status text NOT NULL DEFAULT 'draft' CHECK (
    verification_status IN ('draft','needs_review','verified','published','archived')
  ),
  public_visible boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.directory_project_entities (
  project_id uuid NOT NULL REFERENCES public.directory_projects(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.directory_entities(id) ON DELETE RESTRICT,
  relation_type text NOT NULL CHECK (relation_type IN (
    'developer','land_owner','marketing_agent','sales_agent',
    'contractor','consultant','operator','public_authority','other'
  )),
  notes text,
  PRIMARY KEY(project_id, entity_id, relation_type)
);

INSERT INTO public.directory_areas(id,name_ar,is_active,public_visible,verification_status)
VALUES ('$AREA_ID','مدينة أسيوط',true,true,'published')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users(id,email,email_confirmed_at)
VALUES ('$EDITOR_ID','editor-project@example.invalid',now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.company_entity_manager_members(
  directory_entity_id,user_id,member_role,invited_by
)
VALUES ('$ENTITY_ID','$MANAGER_ID','manager','$OWNER_ID')
ON CONFLICT DO NOTHING;

INSERT INTO public.company_entity_manager_members(
  directory_entity_id,user_id,member_role,invited_by
)
VALUES ('$ENTITY_ID','$EDITOR_ID','editor','$OWNER_ID')
ON CONFLICT DO NOTHING;

INSERT INTO public.directory_projects(
  id,slug,name_ar,project_type,project_status,verification_status,public_visible
)
VALUES (
  '$EXISTING_PROJECT_ID','published-project-for-link-test',
  'مشروع منشور لاختبار الربط','residential','operating','published',true
)
ON CONFLICT (id) DO NOTHING;
SQL

echo "Applying the private company-project request migration to the isolated database..."
psql -X -v ON_ERROR_STOP=1 -f "$MIGRATION"

echo "Checking private storage, row security, function modes and grants..."
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $check$
DECLARE
  v_private_definer boolean;
  v_public_invoker boolean;
BEGIN
  IF to_regclass('private.company_project_requests') IS NULL THEN
    RAISE EXCEPTION 'Private project request table was not created';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private.company_project_requests'::regclass) THEN
    RAISE EXCEPTION 'RLS must be enabled on the private project request table';
  END IF;
  IF has_table_privilege('anon','private.company_project_requests','SELECT')
     OR has_table_privilege('authenticated','private.company_project_requests','SELECT')
     OR has_table_privilege('authenticated','private.company_project_requests','INSERT')
     OR has_table_privilege('authenticated','private.company_project_requests','UPDATE')
     OR has_table_privilege('authenticated','private.company_project_requests','DELETE') THEN
    RAISE EXCEPTION 'The private request table must not be directly accessible through table grants';
  END IF;
  IF has_function_privilege('anon','public.company_project_request_submit(uuid,text,uuid,jsonb,text,text,text)','EXECUTE')
     OR has_function_privilege('anon','public.company_project_requests_mine()','EXECUTE')
     OR has_function_privilege('anon','public.company_project_request_admin_list()','EXECUTE')
     OR has_function_privilege('anon','public.company_project_request_admin_review(uuid,text,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.company_project_request_submit(uuid,text,uuid,jsonb,text,text,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.company_project_requests_mine()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.company_project_request_admin_list()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.company_project_request_admin_review(uuid,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Project request RPC execute grants do not match the least-privilege boundary';
  END IF;

  SELECT p.prosecdef INTO v_private_definer
  FROM pg_proc p WHERE p.oid='private.company_project_request_admin_review(uuid,text,text)'::regprocedure;
  SELECT NOT p.prosecdef INTO v_public_invoker
  FROM pg_proc p WHERE p.oid='public.company_project_request_admin_review(uuid,text,text)'::regprocedure;
  IF NOT coalesce(v_private_definer,false) OR NOT coalesce(v_public_invoker,false) THEN
    RAISE EXCEPTION 'Admin review must use a private SECURITY DEFINER function and public SECURITY INVOKER wrapper';
  END IF;
END
$check$;
SQL

echo "Testing verified owner submission and requester-only reads..."
psql -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$OWNER_ID',true);
SELECT public.company_project_request_submit(
  '$ENTITY_ID','new_project',NULL,
  '{"name_ar":"مشروع تجريبي يضاف من الشركة","project_type":"residential","project_status":"planned","area_id":"$AREA_ID","location_text":"مدينة أسيوط","description":"بيانات أولية مقدمة من ممثل الشركة","size_value":1250,"size_unit":"متر مربع","unit_count":48}'::jsonb,
  'developer','https://example.invalid/project-evidence',NULL
);
DO \$owner_read\$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.company_project_requests_mine();
  IF v_count <> 1 THEN RAISE EXCEPTION 'Verified owner should see exactly one submitted request, got %',v_count; END IF;
END
\$owner_read\$;
COMMIT;
SQL

echo "Testing editor denial and manager authorization..."
set +e
psql -X -v ON_ERROR_STOP=1 >/tmp/company-project-editor-denied.log 2>&1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$EDITOR_ID',true);
SELECT public.company_project_request_submit(
  '$ENTITY_ID','new_project',NULL,
  '{"name_ar":"طلب غير مسموح للمحرر","project_type":"residential"}'::jsonb,
  'developer','https://example.invalid/evidence',NULL
);
COMMIT;
SQL
editor_status=$?
set -e
if [[ "$editor_status" -eq 0 ]]; then
  echo "FAIL: an editor was allowed to submit a project request." >&2
  exit 1
fi
if ! grep -Eqi 'owner|manager|permission denied|42501' /tmp/company-project-editor-denied.log; then
  cat /tmp/company-project-editor-denied.log >&2
  echo "FAIL: editor denial failed for an unexpected reason." >&2
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$MANAGER_ID',true);
SELECT public.company_project_request_submit(
  '$ENTITY_ID','new_project',NULL,
  '{"name_ar":"مشروع من مدير مفوض","project_type":"commercial","project_status":"planned"}'::jsonb,
  'marketing_agent',NULL,'تفويض الشركة بتسويق المشروع'
);
COMMIT;
SQL

echo "Approving the first request: it must create an internal project, not publish it."
psql -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$ADMIN_ID',true);
DO \$admin_approve\$
DECLARE v_request uuid; v_project uuid;
BEGIN
  SELECT id INTO v_request FROM private.company_project_requests
  WHERE project_payload->>'name_ar'='مشروع تجريبي يضاف من الشركة' AND status='pending';
  IF v_request IS NULL THEN RAISE EXCEPTION 'New project request not found for administrator review'; END IF;
  v_project := public.company_project_request_admin_review(v_request,'approve','تمت مراجعة صفة الشركة والطلب');
  IF v_project IS NULL THEN RAISE EXCEPTION 'Approval did not return the newly created internal project id'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.directory_projects
    WHERE id=v_project AND verification_status='needs_review' AND public_visible=false
  ) THEN RAISE EXCEPTION 'Company approval must not publish the new project'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.directory_project_entities
    WHERE project_id=v_project AND entity_id='$ENTITY_ID' AND relation_type='developer'
  ) THEN RAISE EXCEPTION 'Approved new project must have its reviewed company relationship';
  END IF;
END
\$admin_approve\$;
COMMIT;
SQL

echo "Approving an existing published-project link and testing the needs-changes decision..."
psql -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$OWNER_ID',true);
SELECT public.company_project_request_submit(
  '$ENTITY_ID','link_project','$EXISTING_PROJECT_ID',NULL,
  'marketing_agent','https://example.invalid/company-project-link',NULL
);
SELECT public.company_project_request_submit(
  '$ENTITY_ID','new_project',NULL,
  '{"name_ar":"مشروع يحتاج استكمال","project_type":"mixed_use"}'::jsonb,
  'developer',NULL,'مستند يوضح الصفة ويحتاج مراجعة إضافية'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$ADMIN_ID',true);
DO \$review\$
DECLARE v_link uuid; v_changes uuid;
BEGIN
  SELECT id INTO v_link FROM private.company_project_requests
  WHERE request_type='link_project' AND status='pending';
  PERFORM public.company_project_request_admin_review(v_link,'approve',NULL);
  SELECT id INTO v_changes FROM private.company_project_requests
  WHERE project_payload->>'name_ar'='مشروع يحتاج استكمال' AND status='pending';
  PERFORM public.company_project_request_admin_review(v_changes,'needs_changes','أرفق مستندًا أوضح يثبت علاقة الشركة بالمشروع');
END
\$review\$;
COMMIT;
SQL

echo "Checking that approved links are recorded and private request history is owner-scoped..."
psql -X -v ON_ERROR_STOP=1 <<SQL
DO \$final_check\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.directory_project_entities
    WHERE project_id='$EXISTING_PROJECT_ID' AND entity_id='$ENTITY_ID' AND relation_type='marketing_agent'
  ) THEN RAISE EXCEPTION 'Approved existing-project link was not created'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM private.company_project_requests
    WHERE request_type='new_project' AND project_payload->>'name_ar'='مشروع يحتاج استكمال'
      AND status='needs_changes' AND reviewed_by='$ADMIN_ID'
  ) THEN RAISE EXCEPTION 'Needs-changes decision was not saved with reviewer metadata'; END IF;

  PERFORM set_config('request.jwt.claim.sub','$EDITOR_ID',true);
  IF (SELECT count(*) FROM public.company_project_requests_mine()) <> 0 THEN
    RAISE EXCEPTION 'An editor must not read other company members project requests';
  END IF;
END
\$final_check\$;
SQL

echo "PASS: project request RLS/grants, owner/manager authorization, editor denial, admin review, no automatic publication and existing-project linking."
