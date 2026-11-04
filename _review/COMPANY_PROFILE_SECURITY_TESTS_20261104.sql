-- ASYUT AQAR | Company profile security verification
-- Run only against isolated TEST project: wisnmlbefdrkcbbqvdlg.
-- Never run this file against Production without explicit owner approval.
-- All role simulations and function probes below are read-only; each transaction rolls back.

BEGIN;
SET LOCAL ROLE anon;
DO $test_anon$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.company_profiles'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'FAIL: RLS is not enabled';
  END IF;

  IF has_table_privilege(current_user, 'public.company_profiles', 'SELECT')
     OR has_table_privilege(current_user, 'public.company_profiles', 'INSERT')
     OR has_table_privilege(current_user, 'public.company_profiles', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: anon still has table-level access';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'company_profiles'
      AND (
        has_column_privilege(current_user, 'public.company_profiles', c.column_name, 'INSERT')
        OR has_column_privilege(current_user, 'public.company_profiles', c.column_name, 'UPDATE')
      )
  ) THEN
    RAISE EXCEPTION 'FAIL: anon retains column-level write access';
  END IF;

  IF has_column_privilege(current_user, 'public.company_profiles', 'owner_id', 'SELECT')
     OR has_column_privilege(current_user, 'public.company_profiles', 'admin_notes', 'SELECT')
     OR has_column_privilege(current_user, 'public.company_profiles', 'reviewed_by', 'SELECT')
     OR has_column_privilege(current_user, 'public.company_profiles', 'pending_update', 'SELECT')
     OR has_column_privilege(current_user, 'public.company_profiles', 'update_notes', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: anon can read internal company-profile columns';
  END IF;

  IF NOT has_column_privilege(current_user, 'public.company_profiles', 'phone', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: anon cannot read the approved public phone field';
  END IF;

  IF NOT has_table_privilege(current_user, 'public.company_profiles_public', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: anon cannot read the public company-profile view';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.company_profiles_public'::regclass
      AND coalesce(reloptions, ARRAY[]::text[]) @> ARRAY['security_invoker=true']
  ) THEN
    RAISE EXCEPTION 'FAIL: public view is not security_invoker';
  END IF;

  IF has_function_privilege(current_user, 'public.layan_company_owner_profile()', 'EXECUTE')
     OR has_function_privilege(current_user, 'public.layan_submit_company_profile(jsonb)', 'EXECUTE')
     OR has_function_privilege(current_user, 'public.layan_review_company_profile(uuid,text,text)', 'EXECUTE')
     OR has_function_privilege(current_user, 'public.layan_admin_list_company_profiles()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can execute a protected company-profile RPC';
  END IF;
END
$test_anon$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
DO $test_authenticated$
DECLARE
  v_profile jsonb;
BEGIN
  IF has_table_privilege(current_user, 'public.company_profiles', 'SELECT')
     OR has_table_privilege(current_user, 'public.company_profiles', 'INSERT')
     OR has_table_privilege(current_user, 'public.company_profiles', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: authenticated still has table-level access';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'company_profiles'
      AND (
        has_column_privilege(current_user, 'public.company_profiles', c.column_name, 'INSERT')
        OR has_column_privilege(current_user, 'public.company_profiles', c.column_name, 'UPDATE')
      )
  ) THEN
    RAISE EXCEPTION 'FAIL: authenticated retains direct column-level write access';
  END IF;

  IF has_column_privilege(current_user, 'public.company_profiles', 'owner_id', 'SELECT')
     OR has_column_privilege(current_user, 'public.company_profiles', 'admin_notes', 'SELECT')
     OR has_column_privilege(current_user, 'public.company_profiles', 'reviewed_by', 'SELECT')
     OR has_column_privilege(current_user, 'public.company_profiles', 'pending_update', 'SELECT')
     OR has_column_privilege(current_user, 'public.company_profiles', 'update_notes', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: authenticated can read internal company-profile columns';
  END IF;

  IF NOT has_column_privilege(current_user, 'public.company_profiles', 'phone', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: authenticated cannot read approved public columns';
  END IF;

  IF NOT has_function_privilege(current_user, 'public.layan_company_owner_profile()', 'EXECUTE')
     OR NOT has_function_privilege(current_user, 'public.layan_submit_company_profile(jsonb)', 'EXECUTE')
     OR NOT has_function_privilege(current_user, 'public.layan_review_company_profile(uuid,text,text)', 'EXECUTE')
     OR NOT has_function_privilege(current_user, 'public.layan_admin_list_company_profiles()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated is missing an expected RPC grant';
  END IF;

  v_profile := public.layan_company_owner_profile();
  IF v_profile IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: synthetic owner unexpectedly has a company profile';
  END IF;

  IF public.layan_is_admin() IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: synthetic non-admin passed the admin check';
  END IF;

  BEGIN
    PERFORM public.layan_admin_list_company_profiles();
    RAISE EXCEPTION 'FAIL: synthetic non-admin read the admin review queue';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    PERFORM public.layan_submit_company_profile(jsonb_build_object('status', 'active'));
    RAISE EXCEPTION 'FAIL: client-controlled status was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;
END
$test_authenticated$;
ROLLBACK;

-- Expected invariants:
-- * company_profiles has RLS enabled and no test rows are inserted/updated/deleted.
-- * anon/authenticated have no table-level SELECT/INSERT/UPDATE on the base table.
-- * anon/authenticated have no column-level INSERT/UPDATE on any base-table column.
-- * only the approved public columns are readable; internal columns are not.
-- * the public view is security_invoker and readable by anon.
-- * protected RPCs are not executable by anon; authenticated can execute them.
-- * a non-admin authenticated JWT cannot read the admin review queue or set a profile active.
