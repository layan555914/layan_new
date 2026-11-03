-- Existing application Storage bucket metadata captured from production.
-- Does not copy or modify storage.objects file contents.
-- Apply only to a clean Supabase project after Storage is enabled.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES
 ('layan_real_estat','layan_real_estat',true,5242880,ARRAY['image/jpeg','image/png','image/webp']::text[]),
 ('layan-property-documents','layan-property-documents',false,10485760,ARRAY['application/pdf','image/jpeg','image/png']::text[])
ON CONFLICT (id) DO UPDATE SET
 name=EXCLUDED.name,
 public=EXCLUDED.public,
 file_size_limit=EXCLUDED.file_size_limit,
 allowed_mime_types=EXCLUDED.allowed_mime_types;
