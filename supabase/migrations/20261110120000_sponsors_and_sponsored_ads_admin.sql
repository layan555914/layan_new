-- ASYUT AQAR — 2026-11-10
-- 1) Official sponsors managed from the admin page (was hard-coded in index.html).
-- 2) Sponsored ads (supplier_ads): admins can delete (owners immediately, added admins via the
--    owner-approval request flow); expired ads stop showing publicly.
-- 3) Owner edits may change "price on request" (column added on 2026-11-09).
-- Additive; existing rows, policies and RLS of other tables are unchanged. Safe to re-run.
-- Rollback: DROP TABLE public.platform_sponsors; restore the view/perform/act bodies from
-- 20261108190000 and 20261108200000.

-- ---------- 1) Official sponsors ----------
CREATE TABLE IF NOT EXISTS public.platform_sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 80),
  tier text NOT NULL DEFAULT 'official' CHECK (tier IN ('official', 'partner')),
  kicker text CHECK (kicker IS NULL OR char_length(kicker) <= 80),
  tagline text CHECK (tagline IS NULL OR char_length(tagline) <= 220),
  subline text CHECK (subline IS NULL OR char_length(subline) <= 160),
  logo_url text NOT NULL CHECK (
    char_length(logo_url) <= 1000
    AND (logo_url LIKE './assets/%' OR logo_url LIKE 'https://%')
  ),
  link_url text CHECK (link_url IS NULL OR (char_length(link_url) <= 1000 AND link_url ~ '^https?://')),
  link_label text CHECK (link_label IS NULL OR char_length(link_label) <= 60),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_sponsors_dates_check CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
ALTER TABLE public.platform_sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_sponsors_public_read ON public.platform_sponsors;
CREATE POLICY platform_sponsors_public_read ON public.platform_sponsors FOR SELECT TO anon, authenticated
  USING (is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()));
DROP POLICY IF EXISTS platform_sponsors_admin_read ON public.platform_sponsors;
CREATE POLICY platform_sponsors_admin_read ON public.platform_sponsors FOR SELECT TO authenticated
  USING (private.layan_is_admin());
DROP POLICY IF EXISTS platform_sponsors_admin_insert ON public.platform_sponsors;
CREATE POLICY platform_sponsors_admin_insert ON public.platform_sponsors FOR INSERT TO authenticated
  WITH CHECK (private.layan_is_admin());
DROP POLICY IF EXISTS platform_sponsors_admin_update ON public.platform_sponsors;
CREATE POLICY platform_sponsors_admin_update ON public.platform_sponsors FOR UPDATE TO authenticated
  USING (private.layan_is_admin()) WITH CHECK (private.layan_is_admin());
-- No DELETE policy: deletion goes through public.layan_admin_delete_sponsor (owner approval for added admins).

REVOKE ALL ON public.platform_sponsors FROM anon, authenticated;
GRANT SELECT ON public.platform_sponsors TO anon;
GRANT SELECT, INSERT, UPDATE ON public.platform_sponsors TO authenticated;

CREATE OR REPLACE FUNCTION private.layan_touch_platform_sponsor()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $f$
BEGIN NEW.updated_at := now(); RETURN NEW; END $f$;
DROP TRIGGER IF EXISTS platform_sponsors_touch ON public.platform_sponsors;
CREATE TRIGGER platform_sponsors_touch BEFORE UPDATE ON public.platform_sponsors
  FOR EACH ROW EXECUTE FUNCTION private.layan_touch_platform_sponsor();

-- Keep today's sponsor (was hard-coded in index.html) as the first row.
INSERT INTO public.platform_sponsors (name, tier, kicker, tagline, subline, logo_url, link_url, link_label, sort_order, created_by)
SELECT 'Golden Ratio', 'official', 'الراعي الرسمي لمنصة أسيوط عقار',
       'شركة مصرية تقدم حلولًا هندسية متكاملة.', 'Integrated Engineering Solutions · Eng. Ahmed Khashaba',
       './assets/brand/golden-ratio-logo.svg?v=1', 'https://www.facebook.com/goldenratioegy', 'زيارة صفحة الشركة على فيسبوك', 0, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.platform_sponsors);

-- ---------- 2) Sponsored ads: hide expired ones, admin delete ----------
CREATE OR REPLACE VIEW public.public_active_supplier_ads WITH (security_invoker = true) AS
  SELECT id, business_name, category, title, description, image_url, target_url, contact_phone, created_at
  FROM public.supplier_ads
  WHERE status = 'active' AND (ends_at IS NULL OR ends_at > now());

ALTER TABLE private.layan_admin_requests DROP CONSTRAINT IF EXISTS layan_admin_requests_action_check;
ALTER TABLE private.layan_admin_requests ADD CONSTRAINT layan_admin_requests_action_check
  CHECK (action IN ('delete_user','suspend_user','unsuspend_user','delete_offer','delete_service','delete_company',
                    'delete_supplier_ad','delete_sponsor'));

CREATE OR REPLACE FUNCTION private.layan_admin_perform(p_action text, p_target text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF p_action = 'delete_user' THEN
    DELETE FROM auth.users WHERE id = p_target::uuid;
  ELSIF p_action = 'suspend_user' THEN
    UPDATE auth.users SET banned_until = now() + interval '100 years' WHERE id = p_target::uuid;
  ELSIF p_action = 'unsuspend_user' THEN
    UPDATE auth.users SET banned_until = NULL WHERE id = p_target::uuid;
  ELSIF p_action = 'delete_offer' THEN
    DELETE FROM public.property_offers WHERE id = p_target::bigint;
  ELSIF p_action = 'delete_service' THEN
    DELETE FROM public.marketplace_listings WHERE id = p_target::uuid;
  ELSIF p_action = 'delete_company' THEN
    DELETE FROM public.company_profiles WHERE id = p_target::uuid;
  ELSIF p_action = 'delete_supplier_ad' THEN
    DELETE FROM public.supplier_ads WHERE id = p_target::uuid;
  ELSIF p_action = 'delete_sponsor' THEN
    DELETE FROM public.platform_sponsors WHERE id = p_target::uuid;
  ELSE
    RAISE EXCEPTION 'إجراء غير معروف' USING ERRCODE = '22023';
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'العنصر غير موجود أو حُذف بالفعل' USING ERRCODE = 'P0002'; END IF;
END
$function$;
REVOKE ALL ON FUNCTION private.layan_admin_perform(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.layan_admin_delete_supplier_ad(p_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $f$
  SELECT private.layan_admin_act('delete_supplier_ad', p_id::text,
    (SELECT s.business_name || ' — ' || s.title FROM public.supplier_ads s WHERE s.id = p_id));
$f$;
CREATE OR REPLACE FUNCTION public.layan_admin_delete_sponsor(p_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $f$
  SELECT private.layan_admin_act('delete_sponsor', p_id::text,
    (SELECT 'راعٍ رسمي: ' || s.name FROM public.platform_sponsors s WHERE s.id = p_id));
$f$;
REVOKE ALL ON FUNCTION public.layan_admin_delete_supplier_ad(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.layan_admin_delete_sponsor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_delete_supplier_ad(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.layan_admin_delete_sponsor(uuid) TO authenticated;

-- ---------- 3) Owner edits: allow "price on request" ----------
CREATE OR REPLACE FUNCTION private.layan_offer_editable_fields()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $f$
  SELECT ARRAY['title','governorate','city','area','property_type','listing_purpose','bedrooms','bathrooms','area_m2','land_area_m2',
    'land_ownership_authority','land_permit_details','land_utilities','land_zoning','total_price','price_on_request','down_payment','paid_amount',
    'remaining_amount','remaining_installments','monthly_installment','assignment_fee','assignment_fee_percentage','transfer_fee',
    'discount_amount','discount_percent','description','image_urls','developer_name','project_name','contact_name','contact_phone',
    'latitude','longitude']
$f$;

CREATE OR REPLACE FUNCTION private.layan_apply_offer_changes(p_id bigint, p_changes jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
DECLARE r public.property_offers;
BEGIN
  SELECT * INTO r FROM jsonb_populate_record((SELECT o FROM public.property_offers o WHERE o.id = p_id), p_changes);
  UPDATE public.property_offers o SET
    title = r.title, governorate = r.governorate, city = r.city, area = r.area, property_type = r.property_type,
    listing_purpose = r.listing_purpose, bedrooms = r.bedrooms, bathrooms = r.bathrooms, area_m2 = r.area_m2, land_area_m2 = r.land_area_m2,
    land_ownership_authority = r.land_ownership_authority, land_permit_details = r.land_permit_details, land_utilities = r.land_utilities,
    land_zoning = r.land_zoning, total_price = r.total_price, price_on_request = r.price_on_request, down_payment = r.down_payment, paid_amount = r.paid_amount,
    remaining_amount = r.remaining_amount, remaining_installments = r.remaining_installments, monthly_installment = r.monthly_installment,
    assignment_fee = r.assignment_fee, assignment_fee_percentage = r.assignment_fee_percentage, transfer_fee = r.transfer_fee,
    discount_amount = r.discount_amount, discount_percent = r.discount_percent, description = r.description, image_urls = r.image_urls,
    developer_name = r.developer_name, project_name = r.project_name, contact_name = r.contact_name, contact_phone = r.contact_phone,
    latitude = r.latitude, longitude = r.longitude, updated_at = now()
  WHERE o.id = p_id;
END $f$;
REVOKE ALL ON FUNCTION private.layan_apply_offer_changes(bigint, jsonb) FROM PUBLIC, anon, authenticated;
