-- Admin-only trust badges for listings: 'owner' = «مالك موثّق», 'company' = «شركة موثّقة».
-- Owners can insert listings but can never set or change the badge; only the admin RPC can.
ALTER TABLE public.property_offers
  ADD COLUMN IF NOT EXISTS trust_badge text,
  ADD COLUMN IF NOT EXISTS trust_badge_at timestamptz;

DO $do$
BEGIN
  ALTER TABLE public.property_offers
    ADD CONSTRAINT property_offers_trust_badge_check
    CHECK (trust_badge IS NULL OR trust_badge IN ('owner', 'company'));
EXCEPTION WHEN duplicate_object THEN NULL;
END
$do$;

CREATE OR REPLACE FUNCTION private.layan_guard_property_offer_trust_badge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND private.layan_is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.trust_badge := NULL;
    NEW.trust_badge_at := NULL;
  ELSE
    NEW.trust_badge := OLD.trust_badge;
    NEW.trust_badge_at := OLD.trust_badge_at;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS b_property_offer_trust_badge_guard ON public.property_offers;
CREATE TRIGGER b_property_offer_trust_badge_guard
  BEFORE INSERT OR UPDATE ON public.property_offers
  FOR EACH ROW EXECUTE FUNCTION private.layan_guard_property_offer_trust_badge();

CREATE OR REPLACE FUNCTION private.layan_admin_set_offer_trust_badge(p_id bigint, p_badge text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_badge text := nullif(btrim(coalesce(p_badge, '')), '');
  v_row public.property_offers%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING ERRCODE = '42501';
  END IF;
  IF v_badge IS NOT NULL AND v_badge NOT IN ('owner', 'company') THEN
    RAISE EXCEPTION 'نوع التوثيق غير صحيح' USING ERRCODE = '22023';
  END IF;

  UPDATE public.property_offers
  SET trust_badge = v_badge,
      trust_badge_at = CASE WHEN v_badge IS NULL THEN NULL ELSE now() END
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الإعلان غير موجود' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object('id', v_row.id, 'trust_badge', v_row.trust_badge, 'trust_badge_at', v_row.trust_badge_at);
END
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_set_offer_trust_badge(p_id bigint, p_badge text)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.layan_admin_set_offer_trust_badge(p_id, p_badge);
$function$;

REVOKE ALL ON FUNCTION private.layan_guard_property_offer_trust_badge() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.layan_admin_set_offer_trust_badge(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.layan_admin_set_offer_trust_badge(bigint, text) TO authenticated;
REVOKE ALL ON FUNCTION public.layan_admin_set_offer_trust_badge(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_set_offer_trust_badge(bigint, text) TO authenticated;
