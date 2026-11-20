-- ASYUT AQAR — per-ad sponsored placement controls.
-- Additive and backward-compatible: existing supplier ads keep their current visibility.
-- Production application is intentionally separate from this Git change.

ALTER TABLE public.supplier_ads
  ADD COLUMN IF NOT EXISTS placement_keys text[]
  NOT NULL
  DEFAULT ARRAY['home', 'offers', 'marketplace', 'featured']::text[];

ALTER TABLE public.supplier_ads
  ALTER COLUMN placement_keys
  SET DEFAULT ARRAY['home', 'offers', 'marketplace', 'featured']::text[];

UPDATE public.supplier_ads
   SET placement_keys = ARRAY['home', 'offers', 'marketplace', 'featured']::text[]
 WHERE placement_keys IS NULL;

ALTER TABLE public.supplier_ads
  ALTER COLUMN placement_keys SET NOT NULL;

ALTER TABLE public.supplier_ads
  DROP CONSTRAINT IF EXISTS supplier_ads_placement_keys_check;

ALTER TABLE public.supplier_ads
  ADD CONSTRAINT supplier_ads_placement_keys_check
  CHECK (
    cardinality(placement_keys) BETWEEN 1 AND 4
    AND placement_keys <@ ARRAY['home', 'offers', 'marketplace', 'featured']::text[]
  );

-- Placement settings are public display metadata, but only administrators may
-- choose or change them. Owner-submitted rows always receive the compatibility
-- default; owners cannot target extra placements by crafting their REST payload.
CREATE OR REPLACE FUNCTION private.layan_guard_supplier_ad_placements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_is_admin boolean := COALESCE(private.layan_is_admin(), false);
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT v_is_admin THEN
      NEW.placement_keys := ARRAY['home', 'offers', 'marketplace', 'featured']::text[];
    END IF;
  ELSIF NEW.placement_keys IS DISTINCT FROM OLD.placement_keys AND NOT v_is_admin THEN
    RAISE EXCEPTION 'لا يمكن تغيير أماكن ظهور الإعلان إلا من خلال إدارة أسيوط عقار'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS layan_guard_supplier_ad_placements ON public.supplier_ads;
CREATE TRIGGER layan_guard_supplier_ad_placements
BEFORE INSERT OR UPDATE ON public.supplier_ads
FOR EACH ROW
EXECUTE FUNCTION private.layan_guard_supplier_ad_placements();

REVOKE ALL ON FUNCTION private.layan_guard_supplier_ad_placements() FROM PUBLIC, anon, authenticated;

-- The shared public view remains SECURITY INVOKER so supplier_ads RLS still applies.
-- placement_keys is appended at the end to preserve the existing view column order.
CREATE OR REPLACE VIEW public.public_active_supplier_ads
WITH (security_invoker = true)
AS
  SELECT id, business_name, category, title, description, image_url,
         target_url, contact_phone, created_at, placement_keys
    FROM public.supplier_ads
   WHERE status = 'active'
     AND (ends_at IS NULL OR ends_at > now());

GRANT SELECT (placement_keys) ON public.supplier_ads TO anon, authenticated;
