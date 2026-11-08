-- ASYUT AQAR admin control center (PROPOSAL — apply only after the owner approves).
-- 1) Extra admins managed from the admin page (the original admin check stays as is).
-- 2) Visitor/contact activity log written through one narrow RPC (no direct table access).
-- 3) Admin-only RPCs: users with signup details, activity, summaries, delete/suspend, delete listings.
-- Every admin RPC checks private.layan_is_admin(); nothing here is readable by normal users.

-- ---------------------------------------------------------------------------
-- 1) Admin members
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS private.layan_admin_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by uuid,
  added_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.layan_admin_members FROM PUBLIC, anon, authenticated;

-- Keep the existing admin rule under a new name and extend it with the members table.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private' AND p.proname = 'layan_is_admin_base'
  ) THEN
    ALTER FUNCTION private.layan_is_admin() RENAME TO layan_is_admin_base;
  END IF;
END
$do$;

CREATE OR REPLACE FUNCTION private.layan_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(private.layan_is_admin_base(), false)
      OR EXISTS (SELECT 1 FROM private.layan_admin_members m WHERE m.user_id = auth.uid());
$function$;
REVOKE ALL ON FUNCTION private.layan_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.layan_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.layan_is_admin_base() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Activity log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.layan_activity_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text NOT NULL CHECK (char_length(session_id) BETWEEN 8 AND 64),
  event_type text NOT NULL CHECK (event_type IN ('page_view','listing_view','contact_call','contact_whatsapp','search','favorite','signup','login','add_listing_open','share')),
  page text CHECK (char_length(page) <= 200),
  listing_id bigint,
  target text CHECK (char_length(target) <= 200),
  referrer text CHECK (char_length(referrer) <= 200),
  device text CHECK (char_length(device) <= 40),
  region text CHECK (char_length(region) <= 80)
);
ALTER TABLE public.layan_activity_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.layan_activity_events FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS layan_activity_events_created_idx ON public.layan_activity_events (created_at DESC);
CREATE INDEX IF NOT EXISTS layan_activity_events_user_idx ON public.layan_activity_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS layan_activity_events_type_idx ON public.layan_activity_events (event_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.layan_track_event(
  p_event text, p_session text, p_page text DEFAULT NULL, p_listing bigint DEFAULT NULL,
  p_target text DEFAULT NULL, p_referrer text DEFAULT NULL, p_device text DEFAULT NULL, p_region text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF p_event NOT IN ('page_view','listing_view','contact_call','contact_whatsapp','search','favorite','signup','login','add_listing_open','share')
     OR p_session IS NULL OR char_length(p_session) NOT BETWEEN 8 AND 64 THEN
    RETURN;
  END IF;
  -- Simple flood guard: at most 120 events per session per 10 minutes.
  IF (SELECT count(*) FROM public.layan_activity_events e
      WHERE e.session_id = p_session AND e.created_at > now() - interval '10 minutes') >= 120 THEN
    RETURN;
  END IF;
  INSERT INTO public.layan_activity_events (user_id, session_id, event_type, page, listing_id, target, referrer, device, region)
  VALUES (auth.uid(), p_session, p_event, left(p_page, 200), p_listing, left(p_target, 200), left(p_referrer, 200), left(p_device, 40), left(p_region, 80));
END
$function$;
REVOKE ALL ON FUNCTION public.layan_track_event(text, text, text, bigint, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.layan_track_event(text, text, text, bigint, text, text, text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Admin RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.layan_admin_list_users(p_search text DEFAULT NULL, p_limit int DEFAULT 200, p_offset int DEFAULT 0)
RETURNS TABLE (
  id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, email_confirmed_at timestamptz,
  banned_until timestamptz, full_name text, phone text, account_type text, is_admin boolean,
  listings_count bigint, contacts_count bigint, last_seen timestamptz)
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
  SELECT u.id, u.email::text, u.created_at, u.last_sign_in_at, u.email_confirmed_at, u.banned_until,
         u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'phone', u.raw_user_meta_data->>'account_type',
         EXISTS (SELECT 1 FROM private.layan_admin_members m WHERE m.user_id = u.id),
         (SELECT count(*) FROM public.property_offers o WHERE o.owner_id = u.id),
         (SELECT count(*) FROM public.layan_activity_events e WHERE e.user_id = u.id AND e.event_type IN ('contact_call','contact_whatsapp')),
         (SELECT max(e.created_at) FROM public.layan_activity_events e WHERE e.user_id = u.id)
  FROM auth.users u
  WHERE p_search IS NULL OR p_search = ''
     OR u.email ILIKE '%' || p_search || '%'
     OR (u.raw_user_meta_data->>'full_name') ILIKE '%' || p_search || '%'
     OR (u.raw_user_meta_data->>'phone') ILIKE '%' || p_search || '%'
  ORDER BY u.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 1000) OFFSET GREATEST(p_offset, 0);
END
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_activity(p_days int DEFAULT 30, p_user uuid DEFAULT NULL, p_type text DEFAULT NULL, p_limit int DEFAULT 500)
RETURNS SETOF public.layan_activity_events
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
  SELECT * FROM public.layan_activity_events e
  WHERE e.created_at > now() - make_interval(days => LEAST(GREATEST(p_days, 1), 365))
    AND (p_user IS NULL OR e.user_id = p_user)
    AND (p_type IS NULL OR p_type = '' OR e.event_type = p_type)
  ORDER BY e.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 5000);
END
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_activity_summary(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_since timestamptz := now() - make_interval(days => LEAST(GREATEST(p_days, 1), 365));
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'visits', (SELECT count(*) FROM public.layan_activity_events WHERE created_at > v_since AND event_type = 'page_view'),
    'visitors', (SELECT count(DISTINCT session_id) FROM public.layan_activity_events WHERE created_at > v_since),
    'contacts', (SELECT count(*) FROM public.layan_activity_events WHERE created_at > v_since AND event_type IN ('contact_call','contact_whatsapp')),
    'new_users', (SELECT count(*) FROM auth.users WHERE created_at > v_since),
    'by_region', COALESCE((SELECT jsonb_agg(x) FROM (SELECT COALESCE(region, 'غير معروف') AS region, count(DISTINCT session_id) AS visitors FROM public.layan_activity_events WHERE created_at > v_since GROUP BY 1 ORDER BY 2 DESC LIMIT 20) x), '[]'::jsonb),
    'by_page', COALESCE((SELECT jsonb_agg(x) FROM (SELECT page, count(*) AS views FROM public.layan_activity_events WHERE created_at > v_since AND event_type = 'page_view' GROUP BY 1 ORDER BY 2 DESC LIMIT 15) x), '[]'::jsonb),
    'by_day', COALESCE((SELECT jsonb_agg(x ORDER BY day) FROM (SELECT date_trunc('day', created_at)::date AS day, count(DISTINCT session_id) AS visitors FROM public.layan_activity_events WHERE created_at > v_since GROUP BY 1) x), '[]'::jsonb),
    'top_listings', COALESCE((SELECT jsonb_agg(x) FROM (SELECT listing_id, count(*) FILTER (WHERE event_type = 'listing_view') AS views, count(*) FILTER (WHERE event_type IN ('contact_call','contact_whatsapp')) AS contacts FROM public.layan_activity_events WHERE created_at > v_since AND listing_id IS NOT NULL GROUP BY 1 ORDER BY 3 DESC, 2 DESC LIMIT 15) x), '[]'::jsonb)
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_set_user_suspended(p_user uuid, p_suspended boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING ERRCODE = '42501';
  END IF;
  IF p_user = auth.uid() THEN RAISE EXCEPTION 'لا يمكنك إيقاف حسابك' USING ERRCODE = '22023'; END IF;
  UPDATE auth.users SET banned_until = CASE WHEN p_suspended THEN 'infinity'::timestamptz ELSE NULL END WHERE id = p_user;
END
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_delete_user(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING ERRCODE = '42501';
  END IF;
  IF p_user = auth.uid() THEN RAISE EXCEPTION 'لا يمكنك حذف حسابك من هنا' USING ERRCODE = '22023'; END IF;
  DELETE FROM auth.users WHERE id = p_user;
END
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_delete_property_offer(p_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.property_offers WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الإعلان غير موجود' USING ERRCODE = 'P0002'; END IF;
END
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_delete_marketplace_listing(p_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.marketplace_listings WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الإعلان غير موجود' USING ERRCODE = 'P0002'; END IF;
END
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_list_admins()
RETURNS TABLE (user_id uuid, email text, added_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT m.user_id, u.email::text, m.added_at FROM private.layan_admin_members m JOIN auth.users u ON u.id = m.user_id ORDER BY m.added_at;
END
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_set_admin(p_email text, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(btrim(p_email)) LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'لا يوجد حساب بهذا البريد' USING ERRCODE = 'P0002'; END IF;
  IF p_enabled THEN
    INSERT INTO private.layan_admin_members (user_id, added_by) VALUES (v_user, auth.uid()) ON CONFLICT (user_id) DO NOTHING;
  ELSE
    IF v_user = auth.uid() THEN RAISE EXCEPTION 'لا يمكنك إزالة صلاحيتك بنفسك' USING ERRCODE = '22023'; END IF;
    DELETE FROM private.layan_admin_members WHERE user_id = v_user;
  END IF;
END
$function$;

DO $do$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.layan_admin_list_users(text, int, int)',
    'public.layan_admin_activity(int, uuid, text, int)',
    'public.layan_admin_activity_summary(int)',
    'public.layan_admin_set_user_suspended(uuid, boolean)',
    'public.layan_admin_delete_user(uuid)',
    'public.layan_admin_delete_property_offer(bigint)',
    'public.layan_admin_delete_marketplace_listing(bigint)',
    'public.layan_admin_list_admins()',
    'public.layan_admin_set_admin(text, boolean)'
  ] LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || f || ' FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || f || ' TO authenticated';
  END LOOP;
END
$do$;
