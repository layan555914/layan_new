-- Assertions run only against the disposable local Supabase stack created by CI.
BEGIN;
DO $crm_current_state$
DECLARE
  v_count integer;
  v_fn text;
  v_definer boolean;
  v_empty_path boolean;
  v_private_definer boolean;
  v_private_empty_path boolean;
BEGIN
  SELECT count(*) INTO v_count FROM supabase_migrations.schema_migrations;
  IF v_count <> 54 THEN
    RAISE EXCEPTION 'Expected 54 clean-install migrations (3 CI-only baseline fixtures + 49 current-main migrations + CRM schema + private RPC facades), found %', v_count;
  END IF;

  IF to_regclass('public.directory_entities') IS NULL
     OR to_regclass('public.directory_projects') IS NULL
     OR to_regclass('public.platform_sponsors') IS NULL
     OR to_regclass('public.marketplace_listing_provider_links') IS NULL
     OR to_regclass('private.layan_admin_requests') IS NULL
     OR to_regclass('private.layan_admin_members') IS NULL THEN
    RAISE EXCEPTION 'Current ASYUT AQAR core relations are missing from the clean local build';
  END IF;

  IF to_regclass('private.admin_crm_leads') IS NULL
     OR to_regclass('private.admin_crm_activities') IS NULL THEN
    RAISE EXCEPTION 'Private CRM tables were not created';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private.admin_crm_leads'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private.admin_crm_activities'::regclass) THEN
    RAISE EXCEPTION 'Both private CRM tables must have RLS enabled';
  END IF;

  IF has_table_privilege('anon','private.admin_crm_leads','SELECT')
     OR has_table_privilege('authenticated','private.admin_crm_leads','SELECT')
     OR has_table_privilege('service_role','private.admin_crm_leads','SELECT')
     OR has_table_privilege('anon','private.admin_crm_activities','SELECT')
     OR has_table_privilege('authenticated','private.admin_crm_activities','SELECT')
     OR has_table_privilege('service_role','private.admin_crm_activities','SELECT') THEN
    RAISE EXCEPTION 'Private CRM tables must not be directly readable by API roles';
  END IF;

  FOREACH v_fn IN ARRAY ARRAY[
    'layan_admin_list_crm_leads(text,text,text,text,integer)',
    'layan_admin_list_crm_archived(text,text,text,integer)',
    'layan_admin_list_crm_summary()',
    'layan_admin_list_crm_activities(uuid,integer)',
    'layan_admin_crm_save_lead(uuid,text,text,text,text,text,text,text,text,text,text,text,text,uuid,timestamptz,text)',
    'layan_admin_crm_log_activity(uuid,text,text,text,timestamptz)',
    'layan_admin_crm_archive_lead(uuid)',
    'layan_admin_crm_restore_lead(uuid)'
  ] LOOP
    IF has_function_privilege('anon','public.' || v_fn,'EXECUTE')
       OR NOT has_function_privilege('authenticated','public.' || v_fn,'EXECUTE') THEN
      RAISE EXCEPTION 'CRM RPC grants are incorrect for %', v_fn;
    END IF;

    SELECT p.prosecdef, p.proconfig @> ARRAY['search_path=""']
      INTO v_definer, v_empty_path
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.oid=to_regprocedure('public.' || v_fn);
    IF v_definer IS DISTINCT FROM false OR v_empty_path IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Public CRM RPC facade % must be SECURITY INVOKER with an empty search_path', v_fn;
    END IF;

    IF has_function_privilege('anon','private.' || v_fn,'EXECUTE')
       OR NOT has_function_privilege('authenticated','private.' || v_fn,'EXECUTE') THEN
      RAISE EXCEPTION 'Private CRM helper grants are incorrect for %', v_fn;
    END IF;

    SELECT p.prosecdef, p.proconfig @> ARRAY['search_path=""']
      INTO v_private_definer, v_private_empty_path
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='private' AND p.oid=to_regprocedure('private.' || v_fn);
    IF v_private_definer IS DISTINCT FROM true OR v_private_empty_path IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Private CRM helper % must remain SECURITY DEFINER with an empty search_path', v_fn;
    END IF;
  END LOOP;

  IF to_regprocedure('private.layan_is_admin()') IS NULL
     OR to_regprocedure('private.layan_is_owner()') IS NULL THEN
    RAISE EXCEPTION 'CRM role-check helpers are missing';
  END IF;

  IF (SELECT count(*) FROM private.admin_crm_leads) <> 0
     OR (SELECT count(*) FROM private.admin_crm_activities) <> 0 THEN
    RAISE EXCEPTION 'The clean CRM database unexpectedly contains rows';
  END IF;
END;
$crm_current_state$;
ROLLBACK;
