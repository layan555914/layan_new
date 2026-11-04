-- Keep the company directory view subject to invoker privileges and RLS.
CREATE OR REPLACE VIEW public.company_profiles_public
WITH (security_invoker = true)
AS
SELECT
  id,
  company_name,
  category,
  description,
  services,
  city,
  logo_url,
  address,
  phone,
  whatsapp,
  website,
  gallery_urls,
  projects
FROM public.company_profiles
WHERE status = 'active';

REVOKE ALL ON TABLE public.company_profiles_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.company_profiles_public TO anon, authenticated;

-- No browser role gets table-wide access or access to administrative columns.
REVOKE ALL PRIVILEGES ON TABLE public.company_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES (
  id, owner_id, company_name, category, description, services, city, address,
  phone, whatsapp, website, logo_url, gallery_urls, projects, status,
  admin_notes, reviewed_at, reviewed_by, pending_update, update_status,
  update_notes, created_at, updated_at
) ON TABLE public.company_profiles FROM PUBLIC, anon, authenticated;

-- Column-level SELECT grants are only for the approved public profile fields.
-- status is needed by the invoker view predicate and RLS permits active rows only.
GRANT SELECT (
  id, company_name, category, description, services, city, logo_url,
  address, phone, whatsapp, website, gallery_urls, projects, status
) ON TABLE public.company_profiles TO anon, authenticated;

DROP POLICY IF EXISTS company_profiles_read_scope ON public.company_profiles;
CREATE POLICY company_profiles_read_scope
ON public.company_profiles
FOR SELECT
TO anon, authenticated
USING (status = 'active');
