-- Application Storage.objects policies captured from the production catalog.

-- Keep these object-level policies in addition to Supabase's managed Storage internals.

-- No files or object metadata rows are exported.

DROP POLICY IF EXISTS "Authenticated users upload own LAYAN photos" ON storage.objects;

CREATE POLICY "Authenticated users upload own LAYAN photos" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'layan_real_estat'::text) AND ((storage.foldername(name))[1] = 'offers'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)));

DROP POLICY IF EXISTS "Owners and admins read LAYAN property documents" ON storage.objects;

CREATE POLICY "Owners and admins read LAYAN property documents" ON storage.objects AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'layan-property-documents'::text) AND (((storage.foldername(name))[1] = 'documents'::text) AND (((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text) OR ( SELECT layan_is_admin() AS layan_is_admin)))));

DROP POLICY IF EXISTS "Owners delete own LAYAN offer photos" ON storage.objects;

CREATE POLICY "Owners delete own LAYAN offer photos" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'layan_real_estat'::text) AND ((storage.foldername(name))[1] = 'offers'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)));

DROP POLICY IF EXISTS "Owners delete own LAYAN property documents" ON storage.objects;

CREATE POLICY "Owners delete own LAYAN property documents" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'layan-property-documents'::text) AND ((storage.foldername(name))[1] = 'documents'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)));

DROP POLICY IF EXISTS "Owners upload own LAYAN property documents" ON storage.objects;

CREATE POLICY "Owners upload own LAYAN property documents" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'layan-property-documents'::text) AND ((storage.foldername(name))[1] = 'documents'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)));

DROP POLICY IF EXISTS "Public can read LAYAN JPEG offer images" ON storage.objects;

CREATE POLICY "Public can read LAYAN JPEG offer images" ON storage.objects AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (((bucket_id = 'layan_real_estat'::text) AND (storage.extension(name) = 'jpg'::text) AND (lower((storage.foldername(name))[1]) = ANY (ARRAY['public'::text, 'offers'::text]))));
