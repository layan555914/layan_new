-- ASYUT AQAR | Company profile security verification
-- Safe verification only. Run against the isolated staging project:
-- wisnmlbefdrkcbbqvdlg
-- Do not run this file against production without explicit owner approval.
-- Every test is read-only; transactions are rolled back.

BEGIN;
SET LOCAL ROLE anon;
DO $test_anon$
BEGIN
  IF has_table_privilege(current_user, 'public.company_profiles', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: anon still has table-level SELECT';
  END IF;
  IF has_column_privilege(current_user, 'public.company_profiles', 'owner_id', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: anon can read owner_id';
  END IF;
  IF has_column_privilege(current_user, 'public.company_profiles', 'admin_notes', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: anon can read admin_notes';
  END IF;
  IF NOT has_column_privilege(current_user, 'public.company_profiles', 'phone', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: anon cannot read public phone field';
  END IF;

  PERFORM count(*) FROM public.company_profiles_public;

  BEGIN
    PERFORM public.layan_company_owner_profile();
    RAISE EXCEPTION 'FAIL: anon executed the owner RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
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
    RAISE EXCEPTION 'FAIL: authenticated still has direct table access';
  END IF;

  IF has_column_privilege(current_user, 'public.company_profiles', 'owner_id', 'SELECT')
     OR has_column_privilege(current_user, 'public.company_profiles', 'admin_notes', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: authenticated can read internal columns';
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

-- Final invariant summary (expected values):
-- * RLS enabled = true
-- * company_profiles row count unchanged
-- * anon/authenticated have no table-level SELECT/INSERT/UPDATE
-- * anon/authenticated cannot SELECT owner_id or admin_notes
-- * anon/authenticated can SELECT the approved public columns and public view
-- * only authenticated can execute the public company-profile RPCs
