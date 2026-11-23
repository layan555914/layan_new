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
  IF v_count <> 55 THEN
    RAISE EXCEPTION 'Expected 55 clean-install migrations after adding the owner-approval execution hardening migration; found %', v_count;
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

  IF to_regclass('private.admin_crm_leads') IS NULL
     OR to_regclass('private.admin_crm_activities') IS NULL THEN
    RAISE EXCEPTION 'Private CRM lead and activity tables are missing';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private.admin_crm_leads'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private.admin_crm_activities'::regclass)
     OR has_table_privilege('anon','private.admin_crm_activities','SELECT')
     OR has_table_privilege('authenticated','private.admin_crm_activities','UPDATE')
     OR has_table_privilege('authenticated','private.admin_crm_activities','DELETE') THEN
    RAISE EXCEPTION 'Private CRM tables must remain RLS-enabled and unavailable through direct table grants';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='private' AND c.relname='admin_crm_activities'
      AND t.tgname='admin_crm_activities_append_only'
      AND NOT t.tgisinternal AND t.tgenabled='O'
      AND (t.tgtype & 16)=16 AND (t.tgtype & 8)=8
  ) THEN
    RAISE EXCEPTION 'CRM activity history must reject both UPDATE and DELETE, including lead-delete cascades';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='private' AND p.proname='layan_admin_crm_reject_activity_mutation'
      AND p.proconfig @> ARRAY['search_path=""']
      AND pg_get_functiondef(p.oid) ILIKE '%UPDATE and DELETE are prohibited%'
  ) THEN
    RAISE EXCEPTION 'CRM append-only trigger function is missing or unsafe';
  END IF;

  IF (SELECT count(*) FROM public.company_claim_requests) <> 0
     OR (SELECT count(*) FROM public.company_entity_managers) <> 0 THEN
    RAISE EXCEPTION 'Fresh schema rehearsal must not contain production company claim rows';
  END IF;
END;
$current_state_assertions$;




DO $admin_change_execution_assertions$
DECLARE
  v_definition text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='private.layan_admin_requests'::regclass
      AND conname='layan_admin_requests_status_check'
      AND pg_get_constraintdef(oid) ILIKE '%executing%'
  ) THEN
    RAISE EXCEPTION 'Admin request status constraint does not support the reserved executing state';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='private' AND table_name='layan_admin_requests'
      AND column_name='execution_token' AND data_type='uuid'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='private' AND table_name='layan_admin_requests'
      AND column_name='execution_started_at' AND data_type='timestamp with time zone'
  ) THEN
    RAISE EXCEPTION 'Admin request execution reservation columns are missing';
  END IF;
  IF to_regprocedure('public.layan_admin_claim_change(bigint)') IS NULL
     OR to_regprocedure('public.layan_admin_finish_change(bigint,uuid,boolean,text)') IS NULL
     OR to_regprocedure('public.layan_admin_finish_change(bigint,boolean,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Owner claim/finish RPC signatures do not enforce the execution token contract';
  END IF;
  SELECT pg_get_functiondef('public.layan_admin_claim_change(bigint)'::regprocedure) INTO v_definition;
  IF v_definition NOT ILIKE '%status = ''pending''%'
     OR v_definition NOT ILIKE '%status = ''executing''%'
     OR v_definition NOT ILIKE '%layan_is_owner%' THEN
    RAISE EXCEPTION 'Admin change claim RPC does not atomically reserve pending requests for the owner';
  END IF;
  SELECT pg_get_functiondef('public.layan_admin_request_change(text,jsonb)'::regprocedure) INTO v_definition;
  IF v_definition NOT ILIKE '%layan_admin_crm_save_lead%'
     OR v_definition NOT ILIKE '%platform_sponsors%'
     OR v_definition NOT ILIKE '%v_resource NOT IN%'
     OR v_definition NOT ILIKE '%split_part(v_resource%' THEN
    RAISE EXCEPTION 'Admin change request RPC does not enforce its explicit resource allowlist';
  END IF;
  IF has_function_privilege('anon','public.layan_admin_claim_change(bigint)','EXECUTE')
     OR has_function_privilege('anon','public.layan_admin_finish_change(bigint,uuid,boolean,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous users must not execute owner approval claim/finish RPCs';
  END IF;
END;
$admin_change_execution_assertions$;

DO $crm_append_only_behavior$
DECLARE
  v_lead uuid;
  v_activity uuid;
  v_count integer;
BEGIN
  INSERT INTO private.admin_crm_leads (category, name)
  VALUES ('other', 'CI append-only fixture') RETURNING id INTO v_lead;
  INSERT INTO private.admin_crm_activities (lead_id, activity_type, notes)
  VALUES (v_lead, 'note', 'CI immutable timeline fixture') RETURNING id INTO v_activity;

  BEGIN
    UPDATE private.admin_crm_activities SET notes='tampered' WHERE id=v_activity;
    RAISE EXCEPTION 'CRM activity UPDATE unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;

  BEGIN
    DELETE FROM private.admin_crm_activities WHERE id=v_activity;
    RAISE EXCEPTION 'CRM activity DELETE unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;

  BEGIN
    DELETE FROM private.admin_crm_leads WHERE id=v_lead;
    RAISE EXCEPTION 'CRM lead deletion unexpectedly cascaded through immutable activity history';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;

  SELECT count(*) INTO v_count FROM private.admin_crm_activities
  WHERE id=v_activity AND lead_id=v_lead AND notes='CI immutable timeline fixture';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'CRM append-only fixture was modified or deleted';
  END IF;
  SELECT count(*) INTO v_count FROM private.admin_crm_leads WHERE id=v_lead;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'CRM lead was deleted despite immutable activity history';
  END IF;
END;
$crm_append_only_behavior$;

DO $owner_policy_assertions$
DECLARE
  v_bad text;
BEGIN
  WITH expected(policyname, cmd) AS (VALUES
    ('property_offers_admin_insert_for_customer','INSERT'),
    ('property_offers_admin_update_all','UPDATE'),
    ('marketplace_listings_admin_insert_for_customer','INSERT'),
    ('marketplace_listings_admin_update_all','UPDATE'),
    ('supplier_ads_admin_insert_for_customer','INSERT'),
    ('supplier_ads_admin_update_all','UPDATE'),
    ('company_property_ads_admin_insert_for_customer','INSERT'),
    ('company_property_ads_admin_update_all','UPDATE'),
    ('partner_ad_slots_admin_insert','INSERT'),
    ('partner_ad_slots_admin_update_all','UPDATE'),
    ('partner_ad_slots_admin_delete','DELETE'),
    ('platform_sponsors_admin_insert_all','INSERT'),
    ('platform_sponsors_admin_update_all','UPDATE')
  ), checked AS (
    SELECT e.policyname, e.cmd, p.cmd AS actual_cmd, p.qual, p.with_check
    FROM expected e LEFT JOIN pg_policies p
      ON p.schemaname='public' AND p.policyname=e.policyname
  )
  SELECT string_agg(policyname, ', ' ORDER BY policyname) INTO v_bad
  FROM checked
  WHERE actual_cmd IS DISTINCT FROM cmd
     OR (cmd IN ('UPDATE','DELETE') AND coalesce(qual,'') !~* 'layan_is_owner\(\)')
     OR (cmd IN ('INSERT','UPDATE') AND coalesce(with_check,'') !~* 'layan_is_owner\(\)')
     OR coalesce(qual,'') ~* 'layan_is_admin\(\)'
     OR coalesce(with_check,'') ~* 'layan_is_admin\(\)';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Owner-only public ad/sponsor write policies are incomplete or unsafe: %', v_bad;
  END IF;

  WITH expected(policyname, cmd) AS (VALUES
    ('asyut_admin_upload_customer_offer_images','INSERT'),
    ('asyut_admin_replace_customer_offer_images','UPDATE'),
    ('asyut_admin_delete_customer_offer_images','DELETE')
  ), checked AS (
    SELECT e.policyname, e.cmd, p.cmd AS actual_cmd, p.qual, p.with_check
    FROM expected e LEFT JOIN pg_policies p
      ON p.schemaname='storage' AND p.tablename='objects' AND p.policyname=e.policyname
  )
  SELECT string_agg(policyname, ', ' ORDER BY policyname) INTO v_bad
  FROM checked
  WHERE actual_cmd IS DISTINCT FROM cmd
     OR (cmd IN ('UPDATE','DELETE') AND coalesce(qual,'') !~* 'layan_is_owner\(\)')
     OR (cmd IN ('INSERT','UPDATE') AND coalesce(with_check,'') !~* 'layan_is_owner\(\)')
     OR coalesce(qual,'') ~* 'layan_is_admin\(\)'
     OR coalesce(with_check,'') ~* 'layan_is_admin\(\)';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Owner-only customer-image Storage policies are incomplete or unsafe: %', v_bad;
  END IF;
END;
$owner_policy_assertions$;

ROLLBACK;
