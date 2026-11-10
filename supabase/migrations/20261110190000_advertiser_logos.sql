-- ASYUT AQAR — 2026-11-10: advertiser logo / photo shown in the circle next to the advertiser name
-- (listing cards, advertiser page). An advertiser = account + the advertiser name written on the listing,
-- so one account that posts for several companies (e.g. «Hayah City», «مباني أدريس») has a logo per company.
-- Every new logo waits for the admin's approval, like listing edits.
-- Additive only: a new table + RPCs. No existing table, policy or data is changed. Safe to re-run.
-- Rollback: DROP FUNCTION the six layan_*logo* functions below; DROP TABLE public.advertiser_brand_logos;

CREATE OR REPLACE FUNCTION private.layan_brand_key(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $f$ SELECT lower(regexp_replace(btrim(COALESCE(p_name, '')), '\s+', ' ', 'g')) $f$;

CREATE TABLE IF NOT EXISTS public.advertiser_brand_logos (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_key text NOT NULL CHECK (char_length(brand_key) BETWEEN 1 AND 120),
  brand_name text NOT NULL CHECK (char_length(brand_name) BETWEEN 1 AND 120),
  logo_url text CHECK (logo_url IS NULL OR (char_length(logo_url) <= 1000 AND logo_url ~ '^https://')),
  pending_logo_url text CHECK (pending_logo_url IS NULL OR (char_length(pending_logo_url) <= 1000 AND pending_logo_url ~ '^https://')),
  pending_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, brand_key)
);
ALTER TABLE public.advertiser_brand_logos ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: the browser never touches the table directly, only the functions below.
REVOKE ALL ON public.advertiser_brand_logos FROM PUBLIC, anon, authenticated;

-- Public: approved logos for advertisers given as [{"o": owner uuid, "n": advertiser name}, ...].
-- Falls back to the logo of the account's approved company profile with the same name.
CREATE OR REPLACE FUNCTION public.layan_advertiser_logos(p_items jsonb)
RETURNS TABLE (owner_id uuid, brand_key text, logo_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f$
  WITH items AS (
    SELECT DISTINCT (e->>'o')::uuid AS o, private.layan_brand_key(e->>'n') AS k
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_items) = 'array' THEN p_items ELSE '[]'::jsonb END) WITH ORDINALITY AS t(e, i)
     WHERE t.i <= 200 AND (e->>'o') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
  SELECT items.o, items.k,
         COALESCE(
           (SELECT b.logo_url FROM public.advertiser_brand_logos b WHERE b.user_id = items.o AND b.brand_key = items.k AND b.logo_url IS NOT NULL),
           (SELECT c.logo_url FROM public.company_profiles c
             WHERE c.owner_id = items.o AND c.status = 'active' AND c.logo_url ~ '^https://'
               AND private.layan_brand_key(c.company_name) = items.k
             ORDER BY c.updated_at DESC NULLS LAST LIMIT 1)
         )
    FROM items
$f$;
REVOKE ALL ON FUNCTION public.layan_advertiser_logos(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.layan_advertiser_logos(jsonb) TO anon, authenticated;

-- Signed-in user: my advertiser names that already have a logo or a pending one.
CREATE OR REPLACE FUNCTION public.layan_my_advertiser_logos()
RETURNS TABLE (brand_key text, brand_name text, logo_url text, pending_logo_url text, pending_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f$
  SELECT b.brand_key, b.brand_name, b.logo_url, b.pending_logo_url, b.pending_at
    FROM public.advertiser_brand_logos b WHERE b.user_id = auth.uid()
   ORDER BY b.brand_name
$f$;
REVOKE ALL ON FUNCTION public.layan_my_advertiser_logos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_my_advertiser_logos() TO authenticated;

-- Signed-in user: send a new logo for one of my advertiser names (only an image from my own storage folder),
-- or pass NULL to remove that logo right away.
CREATE OR REPLACE FUNCTION public.layan_set_my_advertiser_logo(p_brand text, p_url text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := regexp_replace(btrim(COALESCE(p_brand, '')), '\s+', ' ', 'g');
  v_key text := private.layan_brand_key(p_brand);
  v_url text := nullif(btrim(p_url), '');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'سجّل الدخول أولًا' USING ERRCODE = '42501'; END IF;
  IF char_length(v_key) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'اسم المعلن غير صالح' USING ERRCODE = '22023'; END IF;
  IF v_url IS NULL THEN
    UPDATE public.advertiser_brand_logos SET logo_url = NULL, pending_logo_url = NULL, pending_at = NULL, updated_at = now()
     WHERE user_id = v_uid AND brand_key = v_key;
    RETURN 'removed';
  END IF;
  IF char_length(v_url) > 1000
     OR position('/storage/v1/object/public/layan_real_estat/offers/' || v_uid::text || '/' IN v_url) = 0
     OR v_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/' THEN
    RAISE EXCEPTION 'صورة غير صالحة' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.advertiser_brand_logos (user_id, brand_key, brand_name, pending_logo_url, pending_at)
  VALUES (v_uid, v_key, v_name, v_url, now())
  ON CONFLICT (user_id, brand_key) DO UPDATE
    SET brand_name = EXCLUDED.brand_name, pending_logo_url = EXCLUDED.pending_logo_url, pending_at = now(), updated_at = now();
  RETURN 'pending';
END
$function$;
REVOKE ALL ON FUNCTION public.layan_set_my_advertiser_logo(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_set_my_advertiser_logo(text, text) TO authenticated;

-- Admin: logos waiting for approval.
CREATE OR REPLACE FUNCTION public.layan_admin_list_pending_logos()
RETURNS TABLE (user_id uuid, email text, brand_key text, brand_name text, logo_url text, pending_logo_url text, pending_at timestamptz)
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
    SELECT b.user_id, u.email::text, b.brand_key, b.brand_name, b.logo_url, b.pending_logo_url, b.pending_at
      FROM public.advertiser_brand_logos b JOIN auth.users u ON u.id = b.user_id
     WHERE b.pending_logo_url IS NOT NULL
     ORDER BY b.pending_at;
END
$function$;
REVOKE ALL ON FUNCTION public.layan_admin_list_pending_logos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_list_pending_logos() TO authenticated;

-- Owner (المدير): approve or reject a pending logo. Added admins go through the approval-request flow.
CREATE OR REPLACE FUNCTION public.layan_admin_review_logo(p_user uuid, p_brand_key text, p_approve boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT private.layan_is_owner() THEN
    RAISE EXCEPTION 'اعتماد الشعارات متاح للمدير فقط' USING ERRCODE = '42501';
  END IF;
  UPDATE public.advertiser_brand_logos
     SET logo_url = CASE WHEN p_approve THEN pending_logo_url ELSE logo_url END,
         pending_logo_url = NULL, pending_at = NULL, reviewed_at = now(), reviewed_by = auth.uid(), updated_at = now()
   WHERE user_id = p_user AND brand_key = p_brand_key AND pending_logo_url IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'لا يوجد شعار بانتظار المراجعة' USING ERRCODE = 'P0002'; END IF;
  RETURN CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;
END
$function$;
REVOKE ALL ON FUNCTION public.layan_admin_review_logo(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_review_logo(uuid, text, boolean) TO authenticated;
