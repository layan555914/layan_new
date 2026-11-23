-- ASYUT AQAR — restore the owner-approval boundary after later admin workflow additions.
-- Added-admin reads remain available. Administrative writes and reviews are owner-only
-- in the database, not merely blocked by the browser-side approval wrapper.
DO $owner_gate$
DECLARE
  v_public_policy_names text[] := ARRAY[
    'property_offers_admin_insert_for_customer','property_offers_admin_update_all',
    'marketplace_listings_admin_insert_for_customer','marketplace_listings_admin_update_all',
    'supplier_ads_admin_insert_for_customer','supplier_ads_admin_update_all',
    'company_property_ads_admin_insert_for_customer','company_property_ads_admin_update_all',
    'partner_ad_slots_admin_insert','partner_ad_slots_admin_update_all','partner_ad_slots_admin_delete',
    'platform_sponsors_admin_insert_all','platform_sponsors_admin_update_all'
  ];
  v_storage_policy_names text[] := ARRAY[
    'asyut_admin_upload_customer_offer_images','asyut_admin_replace_customer_offer_images',
    'asyut_admin_delete_customer_offer_images'
  ];
  p record; f record; v_using text; v_check text; v_definition text; v_sql text; v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname='public' AND policyname=ANY(v_public_policy_names);
  IF v_count <> cardinality(v_public_policy_names) THEN
    RAISE EXCEPTION 'Expected % ad/sponsor write policies before owner repair; found %', cardinality(v_public_policy_names), v_count;
  END IF;
  FOR p IN SELECT schemaname,tablename,policyname,qual,with_check FROM pg_policies
    WHERE schemaname='public' AND policyname=ANY(v_public_policy_names)
  LOOP
    v_using := CASE WHEN p.qual IS NULL THEN NULL ELSE
      regexp_replace(p.qual,'((private|public)\.)?layan_is_admin\(\)','private.layan_is_owner()','g') END;
    v_check := CASE WHEN p.with_check IS NULL THEN NULL ELSE
      regexp_replace(p.with_check,'((private|public)\.)?layan_is_admin\(\)','private.layan_is_owner()','g') END;
    v_sql := format('ALTER POLICY %I ON %I.%I',p.policyname,p.schemaname,p.tablename);
    IF v_using IS NOT NULL THEN v_sql := v_sql || ' USING (' || v_using || ')'; END IF;
    IF v_check IS NOT NULL THEN v_sql := v_sql || ' WITH CHECK (' || v_check || ')'; END IF;
    EXECUTE v_sql;
  END LOOP;

  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects' AND policyname=ANY(v_storage_policy_names);
  IF v_count <> cardinality(v_storage_policy_names) THEN
    RAISE EXCEPTION 'Expected % customer-image write policies before owner repair; found %', cardinality(v_storage_policy_names), v_count;
  END IF;
  FOR p IN SELECT schemaname,tablename,policyname,qual,with_check FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname=ANY(v_storage_policy_names)
  LOOP
    v_using := CASE WHEN p.qual IS NULL THEN NULL ELSE
      regexp_replace(p.qual,'((private|public)\.)?layan_is_admin\(\)','private.layan_is_owner()','g') END;
    v_check := CASE WHEN p.with_check IS NULL THEN NULL ELSE
      regexp_replace(p.with_check,'((private|public)\.)?layan_is_admin\(\)','private.layan_is_owner()','g') END;
    v_sql := format('ALTER POLICY %I ON %I.%I',p.policyname,p.schemaname,p.tablename);
    IF v_using IS NOT NULL THEN v_sql := v_sql || ' USING (' || v_using || ')'; END IF;
    IF v_check IS NOT NULL THEN v_sql := v_sql || ' WITH CHECK (' || v_check || ')'; END IF;
    EXECUTE v_sql;
  END LOOP;

  -- Verify every targeted policy individually after rewriting; counts alone can hide a missing owner gate.
  IF EXISTS (
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
    )
    SELECT 1 FROM expected e LEFT JOIN pg_policies p
      ON p.schemaname='public' AND p.policyname=e.policyname
    WHERE p.policyname IS NULL OR p.cmd IS DISTINCT FROM e.cmd
       OR (e.cmd IN ('UPDATE','DELETE') AND coalesce(p.qual,'') !~* 'layan_is_owner\\(\\)')
       OR (e.cmd IN ('INSERT','UPDATE') AND coalesce(p.with_check,'') !~* 'layan_is_owner\\(\\)')
       OR coalesce(p.qual,'') ~* 'layan_is_admin\\(\\)'
       OR coalesce(p.with_check,'') ~* 'layan_is_admin\\(\\)'
  ) THEN
    RAISE EXCEPTION 'One or more of the 13 public ad/sponsor policies did not become owner-only';
  END IF;

  IF EXISTS (
    WITH expected(policyname, cmd) AS (VALUES
      ('asyut_admin_upload_customer_offer_images','INSERT'),
      ('asyut_admin_replace_customer_offer_images','UPDATE'),
      ('asyut_admin_delete_customer_offer_images','DELETE')
    )
    SELECT 1 FROM expected e LEFT JOIN pg_policies p
      ON p.schemaname='storage' AND p.tablename='objects' AND p.policyname=e.policyname
    WHERE p.policyname IS NULL OR p.cmd IS DISTINCT FROM e.cmd
       OR (e.cmd IN ('UPDATE','DELETE') AND coalesce(p.qual,'') !~* 'layan_is_owner\\(\\)')
       OR (e.cmd IN ('INSERT','UPDATE') AND coalesce(p.with_check,'') !~* 'layan_is_owner\\(\\)')
       OR coalesce(p.qual,'') ~* 'layan_is_admin\\(\\)'
       OR coalesce(p.with_check,'') ~* 'layan_is_admin\\(\\)'
  ) THEN
    RAISE EXCEPTION 'One or more of the 3 customer-image Storage policies did not become owner-only';
  END IF;

  v_count := 0;
  FOR f IN SELECT proc_row.oid
    FROM pg_proc AS proc_row
    JOIN pg_namespace AS schema_row ON schema_row.oid=proc_row.pronamespace
    WHERE (schema_row.nspname='private' AND proc_row.proname IN (
      'layan_activate_supplier_ad','layan_admin_review_property_offer',
      'company_entity_profile_update_admin_review','company_claim_admin_review',
      'layan_review_company_profile','company_project_request_admin_review',
      'company_project_unit_request_admin_review','property_offer_project_unit_request_admin_review'
    ))
       OR (schema_row.nspname='public' AND proc_row.proname IN ('layan_reject_supplier_ad','layan_approve_free_trial_ad'))
  LOOP
    v_definition := pg_get_functiondef(f.oid);
    IF position('private.layan_is_admin()' IN v_definition)=0 THEN
      RAISE EXCEPTION 'Expected admin gate missing in write RPC % before owner repair',f.oid;
    END IF;
    v_definition := replace(v_definition,'private.layan_is_admin()','private.layan_is_owner()');
    EXECUTE v_definition;
    v_count := v_count + 1;
  END LOOP;
  IF v_count <> 10 THEN
    RAISE EXCEPTION 'Expected 10 administrative write/review RPCs to repair; found %',v_count;
  END IF;
END;
$owner_gate$;

NOTIFY pgrst, 'reload schema';
