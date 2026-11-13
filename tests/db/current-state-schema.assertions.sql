-- Current-state clean-install schema assertions.
-- This runs only against the disposable local Supabase instance created by CI.

BEGIN;

DO $current_state_assertions$
DECLARE
  v_count integer;
  v_old_admin_write_policies integer;
  v_owner_write_policies integer;
  v_definer boolean;
  v_invoker boolean;
  v_has_lock boolean;
BEGIN
  SELECT count(*) INTO v_count FROM supabase_migrations.schema_migrations;
  IF v_count <> 24 THEN
    RAISE EXCEPTION 'Expected 24 clean-install migrations (Nov 3 baseline + 18 main migrations + 2 company-claim migrations + 1 internal CRM migration); found %', v_count;
  END IF;

  IF to_regclass('public.directory_entities') IS NULL
     OR to_regclass('public.directory_projects') IS NULL
     OR to_regclass('public.platform_sponsors') IS NULL
     OR to_regclass('public.advertiser_brand_logos') IS NULL
     OR to_regclass('private.layan_admin_requests') IS NULL
     OR to_regclass('private.layan_admin_members') IS NULL THEN
    RAISE EXCEPTION 'One or more core ASYUT AQAR current-state relations are missing';
  END IF;

  IF to_regclass('public.company_claim_requests') IS NULL
     OR to_regclass('public.company_entity_managers') IS NULL THEN
    RAISE EXCEPTION 'Company representative claim tables were not created';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.company_claim_requests'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.company_entity_managers'::regclass) THEN
    RAISE EXCEPTION 'Company claim tables must have RLS enabled';
  END IF;

  IF has_table_privilege('anon','public.company_claim_requests','SELECT')
     OR has_table_privilege('anon','public.company_claim_requests','INSERT')
     OR has_table_privilege('authenticated','public.company_claim_requests','UPDATE')
     OR has_table_privilege('authenticated','public.company_claim_requests','DELETE')
     OR has_table_privilege('authenticated','public.company_entity_managers','INSERT')
     OR has_table_privilege('authenticated','public.company_entity_managers','UPDATE')
     OR has_table_privilege('authenticated','public.company_entity_managers','DELETE') THEN
    RAISE EXCEPTION 'Company claim direct table grants exceed least-privilege design';
  END IF;

  IF NOT has_table_privilege('authenticated','public.company_claim_requests','SELECT')
     OR NOT has_table_privilege('authenticated','public.company_claim_requests','INSERT')
     OR NOT has_table_privilege('authenticated','public.company_entity_managers','SELECT') THEN
    RAISE EXCEPTION 'Company claim authenticated table grants are incomplete';
  END IF;

  SELECT p.prosecdef, p.proconfig @> ARRAY['search_path=""']
    INTO v_definer, v_has_lock
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='private' AND p.proname='company_claim_admin_review'
     AND pg_get_function_identity_arguments(p.oid)='p_id uuid, p_action text, p_note text';
  IF v_definer IS DISTINCT FROM true OR v_has_lock IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Private company claim review must be SECURITY DEFINER with an empty search_path';
  END IF;

  SELECT position('FOR UPDATE' IN pg_get_functiondef(p.oid)) > 0
    INTO v_has_lock
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='private' AND p.proname='company_claim_admin_review';
  IF v_has_lock IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Company claim approval must serialize by locking the target company row';
  END IF;

  SELECT NOT p.prosecdef
    INTO v_invoker
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='company_claim_admin_review';
  IF v_invoker IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Public company claim wrapper must be SECURITY INVOKER';
  END IF;

  IF has_function_privilege('anon','public.company_claim_admin_list()','EXECUTE')
     OR has_function_privilege('anon','public.company_claim_admin_review(uuid,text,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.company_claim_admin_list()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.company_claim_admin_review(uuid,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Company claim admin RPC EXECUTE grants are incorrect';
  END IF;

  IF to_regclass('private.admin_crm_leads') IS NULL
     OR to_regclass('private.admin_crm_activities') IS NULL THEN
    RAISE EXCEPTION 'Private internal CRM relations are missing';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private.admin_crm_leads'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private.admin_crm_activities'::regclass) THEN
    RAISE EXCEPTION 'Internal CRM tables must have RLS enabled';
  END IF;

  IF has_table_privilege('anon','private.admin_crm_leads','SELECT')
     OR has_table_privilege('anon','private.admin_crm_leads','INSERT')
     OR has_table_privilege('authenticated','private.admin_crm_leads','SELECT')
     OR has_table_privilege('authenticated','private.admin_crm_leads','INSERT')
     OR has_table_privilege('authenticated','private.admin_crm_leads','UPDATE')
     OR has_table_privilege('authenticated','private.admin_crm_leads','DELETE')
     OR has_table_privilege('service_role','private.admin_crm_leads','SELECT')
     OR has_table_privilege('authenticated','private.admin_crm_activities','SELECT')
     OR has_table_privilege('authenticated','private.admin_crm_activities','INSERT')
     OR has_table_privilege('authenticated','private.admin_crm_activities','UPDATE')
     OR has_table_privilege('authenticated','private.admin_crm_activities','DELETE') THEN
    RAISE EXCEPTION 'Internal CRM tables must not grant direct API table access';
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname IN (
      'layan_admin_list_crm_leads',
      'layan_admin_list_crm_summary',
      'layan_admin_list_crm_activities',
      'layan_admin_crm_save_lead',
      'layan_admin_crm_log_activity',
      'layan_admin_crm_archive_lead'
    )
    AND p.prosecdef
    AND p.proconfig @> ARRAY['search_path=""'];
  IF v_count <> 6 THEN
    RAISE EXCEPTION 'Every CRM RPC must be SECURITY DEFINER with an empty search_path; found %', v_count;
  END IF;

  IF has_function_privilege('anon','public.layan_admin_list_crm_leads(text,text,text,text,integer)','EXECUTE')
     OR has_function_privilege('anon','public.layan_admin_list_crm_summary()','EXECUTE')
     OR has_function_privilege('anon','public.layan_admin_list_crm_activities(uuid,integer)','EXECUTE')
     OR has_function_privilege('anon','public.layan_admin_crm_save_lead(uuid,text,text,text,text,text,text,text,text,text,text,text,text,uuid,timestamptz,text)','EXECUTE')
     OR has_function_privilege('anon','public.layan_admin_crm_log_activity(uuid,text,text,text,timestamptz)','EXECUTE')
     OR has_function_privilege('anon','public.layan_admin_crm_archive_lead(uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.layan_admin_list_crm_leads(text,text,text,text,integer)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.layan_admin_list_crm_summary()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.layan_admin_list_crm_activities(uuid,integer)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.layan_admin_crm_save_lead(uuid,text,text,text,text,text,text,text,text,text,text,text,text,uuid,timestamptz,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.layan_admin_crm_log_activity(uuid,text,text,text,timestamptz)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.layan_admin_crm_archive_lead(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'CRM RPC execute grants must exclude anon and allow authenticated sessions to reach server-side role checks';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.advertiser_brand_logos'::regclass)
     OR has_table_privilege('anon','public.advertiser_brand_logos','SELECT')
     OR has_table_privilege('authenticated','public.advertiser_brand_logos','SELECT')
     OR has_table_privilege('authenticated','public.advertiser_brand_logos','INSERT')
     OR has_table_privilege('authenticated','public.advertiser_brand_logos','UPDATE')
     OR has_table_privilege('authenticated','public.advertiser_brand_logos','DELETE') THEN
    RAISE EXCEPTION 'Advertiser logo table must remain RLS-protected and RPC-only';
  END IF;

  IF has_table_privilege('anon','private.layan_admin_requests','SELECT')
     OR has_table_privilege('authenticated','private.layan_admin_requests','SELECT')
     OR has_table_privilege('anon','private.layan_owner_gate_backup','SELECT')
     OR has_table_privilege('authenticated','private.layan_owner_gate_backup','SELECT') THEN
    RAISE EXCEPTION 'Private admin workflow tables must not be directly exposed';
  END IF;

  SELECT count(*) INTO v_old_admin_write_policies
  FROM pg_policies
  WHERE schemaname='public' AND cmd <> 'SELECT'
    AND (coalesce(qual,'') || coalesce(with_check,'')) ~* '(^|[^a-z_])layan_is_admin\(\)';

  SELECT count(*) INTO v_owner_write_policies
  FROM pg_policies
  WHERE schemaname='public' AND cmd <> 'SELECT'
    AND (coalesce(qual,'') || coalesce(with_check,'')) ~* 'layan_is_owner\(\)';

  IF v_old_admin_write_policies <> 0 OR v_owner_write_policies = 0 THEN
    RAISE EXCEPTION 'Owner-only admin write gate was not fully installed (old %, owner %)',
      v_old_admin_write_policies, v_owner_write_policies;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='layan_admin_list_admins'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='layan_admin_whoami'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='layan_admin_review_logo'
  ) THEN
    RAISE EXCEPTION 'Current admin team, owner gate, or advertiser logo RPC is missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'A public application table is missing RLS';
  END IF;

  IF (SELECT count(*) FROM storage.buckets WHERE id IN ('layan_real_estat','layan-property-documents')) <> 2
     OR (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects') <> 6 THEN
    RAISE EXCEPTION 'Storage baseline must contain two app buckets and six object policies';
  END IF;

  IF (SELECT count(*) FROM public.company_claim_requests) <> 0
     OR (SELECT count(*) FROM public.company_entity_managers) <> 0 THEN
    RAISE EXCEPTION 'Fresh schema rehearsal must not contain production company claim rows';
  END IF;
END;
$current_state_assertions$;

ROLLBACK;
