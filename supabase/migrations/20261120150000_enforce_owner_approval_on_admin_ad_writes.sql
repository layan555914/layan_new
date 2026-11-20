-- ASYUT AQAR — restore the owner-approval boundary after admin ad-management policies.
-- The Nov 18 ad-management migration introduced layan_is_admin() write policies after
-- the Nov 10 owner gate. Keep admin reads, but require the platform owner for all writes.
DO $owner_gate$
DECLARE
  v_public_policy_names text[] := ARRAY[
    'property_offers_admin_insert_for_customer',
    'property_offers_admin_update_all',
    'marketplace_listings_admin_insert_for_customer',
    'marketplace_listings_admin_update_all',
    'supplier_ads_admin_insert_for_customer',
    'supplier_ads_admin_update_all',
    'company_property_ads_admin_insert_for_customer',
    'company_property_ads_admin_update_all',
    'partner_ad_slots_admin_insert',
    'partner_ad_slots_admin_update_all',
    'partner_ad_slots_admin_delete',
    'platform_sponsors_admin_insert_all',
    'platform_sponsors_admin_update_all'
  ];
  v_storage_policy_names text[] := ARRAY[
    'asyut_admin_upload_customer_offer_images',
    'asyut_admin_replace_customer_offer_images',
    'asyut_admin_delete_customer_offer_images'
  ];
  p record;
  f record;
  v_using text;
  v_check text;
  v_definition text;
  v_sql text;
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public' AND policyname = ANY(v_public_policy_names);
  IF v_count <> cardinality(v_public_policy_names) THEN
    RAISE EXCEPTION 'Expected % admin ad write policies before owner-gate repair; found %',
      cardinality(v_public_policy_names), v_count;
  END IF;

  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public' AND policyname = ANY(v_public_policy_names)
  LOOP
    v_using := CASE WHEN p.qual IS NULL THEN NULL ELSE
      regexp_replace(p.qual, '((private|public)\.)?layan_is_admin\(\)', 'private.layan_is_owner()', 'g') END;
    v_check := CASE WHEN p.with_check IS NULL THEN NULL ELSE
      regexp_replace(p.with_check, '((private|public)\.)?layan_is_admin\(\)', 'private.layan_is_owner()', 'g') END;
    v_sql := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    IF v_using IS NOT NULL THEN v_sql := v_sql || ' USING (' || v_using || ')'; END IF;
    IF v_check IS NOT NULL THEN v_sql := v_sql || ' WITH CHECK (' || v_check || ')'; END IF;
    EXECUTE v_sql;
  END LOOP;

  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = ANY(v_storage_policy_names);
  IF v_count <> cardinality(v_storage_policy_names) THEN
    RAISE EXCEPTION 'Expected % admin customer-image write policies before owner-gate repair; found %',
      cardinality(v_storage_policy_names), v_count;
  END IF;

  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = ANY(v_storage_policy_names)
  LOOP
    v_using := CASE WHEN p.qual IS NULL THEN NULL ELSE
      regexp_replace(p.qual, '((private|public)\.)?layan_is_admin\(\)', 'private.layan_is_owner()', 'g') END;
    v_check := CASE WHEN p.with_check IS NULL THEN NULL ELSE
      regexp_replace(p.with_check, '((private|public)\.)?layan_is_admin\(\)', 'private.layan_is_owner()', 'g') END;
    v_sql := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    IF v_using IS NOT NULL THEN v_sql := v_sql || ' USING (' || v_using || ')'; END IF;
    IF v_check IS NOT NULL THEN v_sql := v_sql || ' WITH CHECK (' || v_check || ')'; END IF;
    EXECUTE v_sql;
  END LOOP;

  v_count := 0;
  FOR f IN
    SELECT p.oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (n.nspname = 'private' AND p.proname IN ('layan_activate_supplier_ad','layan_admin_review_property_offer'))
       OR (n.nspname = 'public' AND p.proname IN ('layan_reject_supplier_ad','layan_approve_free_trial_ad'))
  LOOP
    v_definition := pg_get_functiondef(f.oid);
    IF position('private.layan_is_admin()' IN v_definition) = 0 THEN
      RAISE EXCEPTION 'Expected an admin role check in write RPC % before owner-gate repair', f.oid;
    END IF;
    v_definition := replace(v_definition, 'private.layan_is_admin()', 'private.layan_is_owner()');
    EXECUTE v_definition;
    v_count := v_count + 1;
  END LOOP;
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'Expected to repair 4 admin write RPCs; found %', v_count;
  END IF;
END;
$owner_gate$;

NOTIFY pgrst, 'reload schema';
