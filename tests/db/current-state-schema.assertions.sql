-- Current-state clean-install schema assertions.
-- This runs only against the disposable local Supabase instance created by CI.

BEGIN;

DO $current_state_assertions$
DECLARE
  v_count integer;
  v_old_admin_write_policies integer;
  v_owner_write_policies integer;
  v_old_admin_storage_write_policies integer;
  v_old_admin_write_functions integer;
  v_owner_write_functions integer;
  v_definer boolean;
  v_invoker boolean;
  v_has_lock boolean;
BEGIN
  SELECT count(*) INTO v_count FROM supabase_migrations.schema_migrations;
  IF v_count <> 54 THEN
    RAISE EXCEPTION 'Expected 54 clean-install migrations (3 Nov 3 baseline files + 42 current main migrations + 1 owner-gate repair + 7 reviewed branch migrations); found %', v_count;
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
     AND pg_get_function_identity_arguments(p.oid)='p_id uuid, p_action text, p_note text, p_verification_method text, p_verification_note text';
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
     OR has_function_privilege('anon','public.company_claim_admin_review(uuid,text,text,text,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.company_claim_admin_list()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.company_claim_admin_review(uuid,text,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Company claim admin RPC EXECUTE grants are incorrect';
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

  -- Scope this assertion to the 13 ad/sponsor write policies explicitly
  -- converted by the owner-gate repair. Other workflows (for example, a
  -- verified directory-manager link cleanup policy) may intentionally retain
  -- an admin alternative and must not be mistaken for an ad-write bypass.
  SELECT count(*) INTO v_old_admin_write_policies
  FROM pg_policies
  WHERE schemaname='public' AND cmd <> 'SELECT'
    AND policyname = ANY(ARRAY[
      'property_offers_admin_insert_for_customer','property_offers_admin_update_all',
      'marketplace_listings_admin_insert_for_customer','marketplace_listings_admin_update_all',
      'supplier_ads_admin_insert_for_customer','supplier_ads_admin_update_all',
      'company_property_ads_admin_insert_for_customer','company_property_ads_admin_update_all',
      'partner_ad_slots_admin_insert','partner_ad_slots_admin_update_all','partner_ad_slots_admin_delete',
      'platform_sponsors_admin_insert_all','platform_sponsors_admin_update_all'
    ])
    AND (coalesce(qual,'') || coalesce(with_check,'')) ~* '(^|[^a-z_])layan_is_admin\(\)';

  SELECT count(*) INTO v_owner_write_policies
  FROM pg_policies
  WHERE schemaname='public' AND cmd <> 'SELECT'
    AND (coalesce(qual,'') || coalesce(with_check,'')) ~* 'layan_is_owner\(\)';

  SELECT count(*) INTO v_old_admin_storage_write_policies
  FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects' AND cmd <> 'SELECT'
    AND (coalesce(qual,'') || coalesce(with_check,'')) ~* '(^|[^a-z_])layan_is_admin\(\)';

  SELECT count(*) INTO v_old_admin_write_functions
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE ((n.nspname='private' AND p.proname IN ('layan_activate_supplier_ad','layan_admin_review_property_offer'))
      OR (n.nspname='public' AND p.proname IN ('layan_reject_supplier_ad','layan_approve_free_trial_ad')))
    AND p.prosrc ILIKE '%private.layan_is_admin()%';

  SELECT count(*) INTO v_owner_write_functions
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE ((n.nspname='private' AND p.proname IN ('layan_activate_supplier_ad','layan_admin_review_property_offer'))
      OR (n.nspname='public' AND p.proname IN ('layan_reject_supplier_ad','layan_approve_free_trial_ad')))
    AND p.prosrc ILIKE '%private.layan_is_owner()%';

  SELECT count(*) INTO v_old_admin_storage_write_policies
  FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects' AND cmd <> 'SELECT'
    AND (coalesce(qual,'') || coalesce(with_check,'')) ~* '(^|[^a-z_])layan_is_admin\(\)';

  SELECT count(*) INTO v_old_admin_write_functions
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE ((n.nspname='private' AND p.proname IN (
        'layan_activate_supplier_ad','layan_admin_review_property_offer',
        'company_entity_profile_update_admin_review','company_claim_admin_review',
        'layan_review_company_profile','company_project_request_admin_review',
        'company_project_unit_request_admin_review','property_offer_project_unit_request_admin_review'
      ))
      OR (n.nspname='public' AND p.proname IN ('layan_reject_supplier_ad','layan_approve_free_trial_ad')))
    AND p.prosrc ILIKE '%private.layan_is_admin()%';

  SELECT count(*) INTO v_owner_write_functions
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE ((n.nspname='private' AND p.proname IN (
        'layan_activate_supplier_ad','layan_admin_review_property_offer',
        'company_entity_profile_update_admin_review','company_claim_admin_review',
        'layan_review_company_profile','company_project_request_admin_review',
        'company_project_unit_request_admin_review','property_offer_project_unit_request_admin_review'
      ))
      OR (n.nspname='public' AND p.proname IN ('layan_reject_supplier_ad','layan_approve_free_trial_ad')))
    AND p.prosrc ILIKE '%private.layan_is_owner()%';

  IF v_old_admin_write_policies <> 0 OR v_owner_write_policies = 0
     OR v_old_admin_storage_write_policies <> 0
     OR v_old_admin_write_functions <> 0 OR v_owner_write_functions <> 10 THEN
    RAISE EXCEPTION 'Owner-only ad/company/project gate incomplete (public policies admin %, owner %; storage admin %; write RPCs admin %, owner %)',
      v_old_admin_write_policies, v_owner_write_policies, v_old_admin_storage_write_policies,
      v_old_admin_write_functions, v_owner_write_functions;
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
     OR (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects') <> 10 THEN
    RAISE EXCEPTION 'Storage baseline must contain two app buckets and ten object policies (six baseline plus four admin image policies)';
  END IF;

  IF (SELECT count(*) FROM public.company_claim_requests) <> 0
     OR (SELECT count(*) FROM public.company_entity_managers) <> 0 THEN
    RAISE EXCEPTION 'Fresh schema rehearsal must not contain production company claim rows';
  END IF;
END;
$current_state_assertions$;


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
    RAISE EXCEPTION 'Expected 54 clean-install migrations (3 CI-only baseline fixtures + 49 current-main migrations + one atomic CRM migration), found %', v_count;
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
