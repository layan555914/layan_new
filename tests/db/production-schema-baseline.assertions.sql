-- Full Supabase CLI rehearsal assertions for the catalog-derived ASYUT AQAR baseline.
-- Runs only against the isolated local Supabase stack created by the CI script.
-- Every fixture is rolled back at the end.

BEGIN;

DO $catalog_assertions$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p');
  IF v_count <> 28 THEN RAISE EXCEPTION 'Expected 28 application tables; found %', v_count; END IF;

  SELECT count(*) INTO v_count
  FROM pg_constraint co
  JOIN pg_class c ON c.oid=co.conrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','private');
  IF v_count <> 135 THEN RAISE EXCEPTION 'Expected 135 application constraints; found %', v_count; END IF;

  SELECT count(*) INTO v_count
  FROM pg_index i
  JOIN pg_class t ON t.oid=i.indrelid
  JOIN pg_namespace n ON n.oid=t.relnamespace
  WHERE n.nspname IN ('public','private')
    AND NOT i.indisprimary
    AND NOT EXISTS (SELECT 1 FROM pg_constraint co WHERE co.conindid=i.indexrelid);
  IF v_count <> 32 THEN RAISE EXCEPTION 'Expected 32 secondary indexes; found %', v_count; END IF;

  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','private') AND p.prokind IN ('f','p');
  IF v_count <> 21 THEN RAISE EXCEPTION 'Expected 21 routines after the directory admin RPC migration; found %', v_count; END IF;

  SELECT count(*) INTO v_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='v';
  IF v_count <> 2 THEN RAISE EXCEPTION 'Expected 2 public views; found %', v_count; END IF;

  SELECT count(*) INTO v_count
  FROM pg_trigger t
  JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','private') AND NOT t.tgisinternal;
  IF v_count <> 7 THEN RAISE EXCEPTION 'Expected 7 application triggers; found %', v_count; END IF;

  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname IN ('public','private');
  IF v_count <> 80 THEN RAISE EXCEPTION 'Expected 80 application RLS policies; found %', v_count; END IF;

  SELECT count(*) INTO v_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','private')
    AND c.relkind IN ('r','p')
    AND c.relrowsecurity;
  IF v_count <> 28 THEN RAISE EXCEPTION 'RLS must be enabled on all 28 application tables; found %', v_count; END IF;

  SELECT count(*) INTO v_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public'
    AND c.relkind='v'
    AND c.reloptions @> ARRAY['security_invoker=true'];
  IF v_count <> 2 THEN RAISE EXCEPTION 'Both public views must be security invoker; found %', v_count; END IF;

  SELECT count(*) INTO v_count FROM storage.buckets;
  IF v_count <> 2 THEN RAISE EXCEPTION 'Expected 2 LAYAN storage buckets; found %', v_count; END IF;

  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects';
  IF v_count <> 6 THEN RAISE EXCEPTION 'Expected 6 Storage object policies; found %', v_count; END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) THEN
    RAISE EXCEPTION 'RLS is not enabled on storage.objects';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.buckets'::regclass) THEN
    RAISE EXCEPTION 'RLS is not enabled on storage.buckets';
  END IF;

  IF NOT has_table_privilege('anon','public.directory_areas','SELECT') THEN
    RAISE EXCEPTION 'anon is missing the published directory read grant';
  END IF;
  IF has_table_privilege('anon','public.directory_entity_private','SELECT') THEN
    RAISE EXCEPTION 'anon must not read private directory rows';
  END IF;
  IF has_schema_privilege('anon','private','USAGE') THEN
    RAISE EXCEPTION 'anon must not have private schema usage';
  END IF;
  IF NOT has_schema_privilege('authenticated','private','USAGE') THEN
    RAISE EXCEPTION 'authenticated is missing private schema usage';
  END IF;
  IF NOT has_table_privilege('authenticated','public.directory_change_log','INSERT') THEN
    RAISE EXCEPTION 'authenticated is missing the directory audit insert grant';
  END IF;
  IF has_function_privilege('anon','public.layan_is_admin()','EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute public.layan_is_admin()';
  END IF;
  IF NOT has_function_privilege('authenticated','public.layan_is_admin()','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated is missing public.layan_is_admin() execute';
  END IF;
  IF has_function_privilege('anon','public.directory_admin_mutate_with_audit(text,text,uuid,jsonb,text)','EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute the directory admin mutation RPC';
  END IF;
  IF NOT has_function_privilege('authenticated','public.directory_admin_mutate_with_audit(text,text,uuid,jsonb,text)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated is missing directory admin mutation RPC execute';
  END IF;
  SELECT count(*) INTO v_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname='directory_admin_mutate_with_audit'
    AND NOT p.prosecdef;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Directory admin mutation RPC must exist exactly once as SECURITY INVOKER';
  END IF;
  IF NOT has_sequence_privilege('anon','public.property_offers_id_seq','USAGE')
     OR NOT has_sequence_privilege('authenticated','public.property_offers_id_seq','UPDATE')
     OR NOT has_sequence_privilege('service_role','public.promotion_payments_id_seq','USAGE') THEN
    RAISE EXCEPTION 'Application sequence grants are incomplete';
  END IF;
  IF NOT has_schema_privilege('anon','storage','USAGE')
     OR NOT has_table_privilege('anon','storage.objects','INSERT')
     OR NOT has_table_privilege('authenticated','storage.objects','DELETE')
     OR NOT has_table_privilege('service_role','storage.objects','TRUNCATE') THEN
    RAISE EXCEPTION 'Storage API grants are incomplete';
  END IF;
END;
$catalog_assertions$;

-- Directory publication must fail without a public source and succeed once linked.
INSERT INTO public.directory_areas
  (id,slug,name_ar,area_type,is_active,verification_status,public_visible)
VALUES
  ('00000000-0000-0000-0000-000000000101','ci-visible-area','منطقة اختبار منشورة','city',true,'published',true),
  ('00000000-0000-0000-0000-000000000102','ci-hidden-area','منطقة اختبار مخفية','city',true,'draft',false);

INSERT INTO public.directory_sources
  (id,title,source_type,source_url,is_public)
VALUES
  ('00000000-0000-0000-0000-000000000201','مصدر اختبار CI','official_site','https://example.test/source',true);

INSERT INTO public.directory_entities
  (id,slug,name_ar,entity_type,verification_status,public_visible)
VALUES
  ('00000000-0000-0000-0000-000000000301','ci-entity-no-source','جهة اختبار','developer','draft',false);

DO $source_guard_test$
DECLARE
  v_blocked boolean := false;
BEGIN
  BEGIN
    UPDATE public.directory_entities
    SET public_visible=true, verification_status='published'
    WHERE id='00000000-0000-0000-0000-000000000301';
  EXCEPTION WHEN OTHERS THEN
    IF position('مصدر عام' IN SQLERRM) > 0 THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'A directory entity was published without a public source';
  END IF;

  INSERT INTO public.directory_entity_sources(entity_id,source_id,claim_key)
  VALUES (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',
    'general'
  );

  UPDATE public.directory_entities
  SET public_visible=true, verification_status='published'
  WHERE id='00000000-0000-0000-0000-000000000301';

  IF NOT EXISTS (
    SELECT 1 FROM public.directory_entities
    WHERE id='00000000-0000-0000-0000-000000000301'
      AND public_visible AND verification_status='published'
  ) THEN
    RAISE EXCEPTION 'Entity with a public source was not published';
  END IF;
END;
$source_guard_test$;

-- Anonymous readers must see the published area, but not the draft area.
SET LOCAL ROLE anon;
DO $directory_anon_test$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.directory_areas
  WHERE id IN (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000102'
  );
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'anon expected one visible area; found %', v_count;
  END IF;
END;
$directory_anon_test$;
RESET ROLE;

-- Seed one other user's private document as the database owner.
INSERT INTO storage.objects(bucket_id,name,owner_id)
VALUES (
  'layan-property-documents',
  'documents/00000000-0000-0000-0000-000000000499/other.pdf',
  '00000000-0000-0000-0000-000000000499'
);

-- Authenticated owner can upload own photo/document and cannot touch another user's path.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000401',true);

INSERT INTO storage.objects(bucket_id,name,owner_id)
VALUES
  ('layan_real_estat',
   'offers/00000000-0000-0000-0000-000000000401/own.jpg',
   '00000000-0000-0000-0000-000000000401'),
  ('layan-property-documents',
   'documents/00000000-0000-0000-0000-000000000401/own.pdf',
   '00000000-0000-0000-0000-000000000401');

DO $storage_owner_test$
DECLARE
  v_count integer;
  v_blocked boolean := false;
BEGIN
  SELECT count(*) INTO v_count
  FROM storage.objects
  WHERE bucket_id='layan-property-documents';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Owner should see exactly one private document; found %', v_count;
  END IF;

  BEGIN
    INSERT INTO storage.objects(bucket_id,name,owner_id)
    VALUES (
      'layan_real_estat',
      'offers/00000000-0000-0000-0000-000000000499/other.jpg',
      '00000000-0000-0000-0000-000000000499'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Owner uploaded into another user folder';
  END IF;

END;
$storage_owner_test$;
RESET ROLE;

-- The Storage protect_delete() trigger intentionally rejects direct SQL DELETE.
-- Verify the owner-only DELETE policy is installed; real deletion must go through the Storage API.
DO $storage_delete_policy_test$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Owners delete own LAYAN offer photos'
      AND cmd='DELETE' AND 'authenticated'=ANY(roles)
      AND qual LIKE '%auth.uid%' AND qual LIKE '%offers%'
  ) THEN
    RAISE EXCEPTION 'Owner-only offer-photo DELETE policy is missing or not owner-scoped';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Owners delete own LAYAN property documents'
      AND cmd='DELETE' AND 'authenticated'=ANY(roles)
      AND qual LIKE '%auth.uid%' AND qual LIKE '%documents%'
  ) THEN
    RAISE EXCEPTION 'Owner-only property-document DELETE policy is missing or not owner-scoped';
  END IF;
END;
$storage_delete_policy_test$;

-- Public access is limited to matching JPEG paths; private documents stay hidden.
SET LOCAL ROLE anon;
DO $storage_anon_test$
DECLARE
  v_public_photos integer;
  v_private_docs integer;
BEGIN
  SELECT count(*) INTO v_public_photos
  FROM storage.objects
  WHERE bucket_id='layan_real_estat';

  SELECT count(*) INTO v_private_docs
  FROM storage.objects
  WHERE bucket_id='layan-property-documents';

  IF v_public_photos <> 1 THEN
    RAISE EXCEPTION 'anon expected one public offer JPEG; found %', v_public_photos;
  END IF;
  IF v_private_docs <> 0 THEN
    RAISE EXCEPTION 'anon can read private property documents';
  END IF;
END;
$storage_anon_test$;
RESET ROLE;

ROLLBACK;
