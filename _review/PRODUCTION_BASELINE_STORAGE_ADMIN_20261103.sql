-- ASYUT AQAR — Supabase-managed Storage schema restoration phase.
-- Run only after the application baseline exists and only as the Storage table owner
-- or a Supabase database superuser in a disposable local rehearsal.
-- The standard Supabase stack already provisions auth/storage schemas and their tables.
-- Do not run this fragment as an ordinary postgres migration on hosted Supabase:
-- storage.buckets and storage.objects are owned by supabase_storage_admin.
-- No Storage object rows or file contents are copied.

-- 6. Supabase Storage table grants and current bucket metadata.
-- Existing application Storage bucket metadata captured from production.
-- Does not copy or modify storage.objects file contents.
-- Apply only to a clean Supabase project after Storage is enabled.

-- Match the source project's Storage API schema and table access model.
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- The disposable local Supabase stack may ship broader default ACLs than production.
-- Clear API-role and PUBLIC grants first, then reproduce the captured production ACLs.
REVOKE ALL PRIVILEGES ON TABLE storage.buckets FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE storage.objects FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE storage.buckets TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE storage.buckets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE storage.objects TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE storage.objects TO service_role;

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES
 ('layan_real_estat','layan_real_estat',true,5242880,ARRAY['image/jpeg','image/png','image/webp']::text[]),
 ('layan-property-documents','layan-property-documents',false,10485760,ARRAY['application/pdf','image/jpeg','image/png']::text[])
ON CONFLICT (id) DO UPDATE SET
 name=EXCLUDED.name,
 public=EXCLUDED.public,
 file_size_limit=EXCLUDED.file_size_limit,
 allowed_mime_types=EXCLUDED.allowed_mime_types;

-- 7. Current Storage.objects RLS policies.
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


