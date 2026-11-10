-- ASYUT AQAR — 2026-11-10: advertiser logo / photo shown in the circle next to the advertiser name
-- (listing cards, advertiser page). Every new logo waits for the admin's approval, like listing edits.
-- Additive only: a new table + RPCs. No existing table, policy or data is changed. Safe to re-run.
-- Rollback: DROP FUNCTION the five layan_*logo* functions below; DROP TABLE public.advertiser_profiles;

CREATE TABLE IF NOT EXISTS public.advertiser_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  logo_url text CHECK (logo_url IS NULL OR (char_length(logo_url) <= 1000 AND logo_url ~ '^https://')),
  pending_logo_url text CHECK (pending_logo_url IS NULL OR (char_length(pending_logo_url) <= 1000 AND pending_logo_url ~ '^https://')),
  pending_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.advertiser_profiles ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: the browser never touches the table directly, only the functions below.
REVOKE ALL ON public.advertiser_profiles FROM PUBLIC, anon, authenticated;

-- Public: approved logos for a list of advertisers. Falls back to the logo of the advertiser's active company profile.
CREATE OR REPLACE FUNCTION public.layan_advertiser_logos(p_ids uuid[])
RETURNS TABLE (owner_id uuid, logo_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f$
  SELECT ids.id,
         COALESCE(
           (SELECT a.logo_url FROM public.advertiser_profiles a WHERE a.user_id = ids.id AND a.logo_url IS NOT NULL),
           (SELECT c.logo_url FROM public.company_profiles c
             WHERE c.owner_id = ids.id AND c.status = 'active' AND c.logo_url ~ '^https://'
             ORDER BY c.updated_at DESC NULLS LAST LIMIT 1)
         )
    FROM (SELECT DISTINCT unnest(p_ids[1:200]) AS id) ids
$f$;
REVOKE ALL ON FUNCTION public.layan_advertiser_logos(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.layan_advertiser_logos(uuid[]) TO anon, authenticated;

-- Signed-in user: my current and pending logo.
CREATE OR REPLACE FUNCTION public.layan_my_advertiser_logo()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f$
  SELECT jsonb_build_object('logo_url', a.logo_url, 'pending_logo_url', a.pending_logo_url, 'pending_at', a.pending_at)
    FROM public.advertiser_profiles a WHERE a.user_id = auth.uid()
$f$;
REVOKE ALL ON FUNCTION public.layan_my_advertiser_logo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_my_advertiser_logo() TO authenticated;

-- Signed-in user: send a new logo for approval (only an image from the user's own storage folder),
-- or pass NULL to remove the current logo right away.
CREATE OR REPLACE FUNCTION public.layan_set_my_advertiser_logo(p_url text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_url text := nullif(btrim(p_url), '');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'سجّل الدخول أولًا' USING ERRCODE = '42501'; END IF;
  IF v_url IS NULL THEN
    INSERT INTO public.advertiser_profiles (user_id) VALUES (v_uid) ON CONFLICT (user_id) DO NOTHING;
    UPDATE public.advertiser_profiles SET logo_url = NULL, pending_logo_url = NULL, pending_at = NULL, updated_at = now() WHERE user_id = v_uid;
    RETURN 'removed';
  END IF;
  IF char_length(v_url) > 1000
     OR position('/storage/v1/object/public/layan_real_estat/offers/' || v_uid::text || '/' IN v_url) = 0
     OR v_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/' THEN
    RAISE EXCEPTION 'صورة غير صالحة' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.advertiser_profiles (user_id, pending_logo_url, pending_at)
  VALUES (v_uid, v_url, now())
  ON CONFLICT (user_id) DO UPDATE SET pending_logo_url = EXCLUDED.pending_logo_url, pending_at = now(), updated_at = now();
  RETURN 'pending';
END
$function$;
REVOKE ALL ON FUNCTION public.layan_set_my_advertiser_logo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_set_my_advertiser_logo(text) TO authenticated;

-- Admin: logos waiting for approval.
CREATE OR REPLACE FUNCTION public.layan_admin_list_pending_logos()
RETURNS TABLE (user_id uuid, email text, logo_url text, pending_logo_url text, pending_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT a.user_id, u.email::text, a.logo_url, a.pending_logo_url, a.pending_at
      FROM public.advertiser_profiles a JOIN auth.users u ON u.id = a.user_id
     WHERE a.pending_logo_url IS NOT NULL
     ORDER BY a.pending_at;
END
$function$;
REVOKE ALL ON FUNCTION public.layan_admin_list_pending_logos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_list_pending_logos() TO authenticated;

-- Owner (المدير): approve or reject a pending logo. Added admins go through the approval-request flow.
CREATE OR REPLACE FUNCTION public.layan_admin_review_logo(p_user uuid, p_approve boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT private.layan_is_owner() THEN
    RAISE EXCEPTION 'اعتماد الشعارات متاح للمدير فقط' USING ERRCODE = '42501';
  END IF;
  UPDATE public.advertiser_profiles
     SET logo_url = CASE WHEN p_approve THEN pending_logo_url ELSE logo_url END,
         pending_logo_url = NULL, pending_at = NULL, reviewed_at = now(), reviewed_by = auth.uid(), updated_at = now()
   WHERE user_id = p_user AND pending_logo_url IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'لا يوجد شعار بانتظار المراجعة' USING ERRCODE = 'P0002'; END IF;
  RETURN CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;
END
$function$;
REVOKE ALL ON FUNCTION public.layan_admin_review_logo(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_review_logo(uuid, boolean) TO authenticated;
