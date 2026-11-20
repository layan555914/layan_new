-- ASYUT AQAR — manually order active sponsored ads independently in each placement.
-- Additive and backward-compatible: empty per-placement priorities preserve created_at ordering.

ALTER TABLE public.supplier_ads
  ADD COLUMN IF NOT EXISTS placement_order jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION private.layan_guard_supplier_ad_placements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_is_admin boolean := COALESCE(private.layan_is_admin(), false);
  v_item record;
  v_order numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT v_is_admin THEN
      NEW.placement_keys := ARRAY['home', 'offers', 'marketplace', 'featured']::text[];
      NEW.placement_order := '{}'::jsonb;
    END IF;
  ELSIF NOT v_is_admin THEN
    IF NEW.placement_keys IS DISTINCT FROM OLD.placement_keys THEN
      RAISE EXCEPTION 'لا يمكن تغيير أماكن ظهور الإعلان إلا من خلال إدارة أسيوط عقار'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.placement_order IS DISTINCT FROM OLD.placement_order THEN
      RAISE EXCEPTION 'لا يمكن تغيير ترتيب الإعلان إلا من خلال إدارة أسيوط عقار'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF jsonb_typeof(COALESCE(NEW.placement_order, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'بيانات ترتيب الإعلان غير صحيحة'
      USING ERRCODE = '23514';
  END IF;

  FOR v_item IN
    SELECT key, value FROM jsonb_each(COALESCE(NEW.placement_order, '{}'::jsonb))
  LOOP
    IF v_item.key NOT IN ('home', 'offers', 'marketplace', 'featured', 'property_details')
       OR jsonb_typeof(v_item.value) <> 'number' THEN
      RAISE EXCEPTION 'بيانات ترتيب الإعلان تحتوي على موضع أو قيمة غير صحيحة'
        USING ERRCODE = '23514';
    END IF;

    v_order := (v_item.value #>> '{}')::numeric;
    IF v_order < 0 OR v_order > 1000000 OR trunc(v_order) <> v_order THEN
      RAISE EXCEPTION 'ترتيب الإعلان يجب أن يكون رقمًا صحيحًا غير سالب'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.layan_guard_supplier_ad_placements() FROM PUBLIC, anon, authenticated;

-- Preserve all existing public view columns and append placement_order.
CREATE OR REPLACE VIEW public.public_active_supplier_ads
WITH (security_invoker = true)
AS
  SELECT id, business_name, category, title, description, image_url,
         target_url, contact_phone, created_at, placement_keys, placement_order
    FROM public.supplier_ads
   WHERE status = 'active'
     AND (ends_at IS NULL OR ends_at > now());

GRANT SELECT (placement_order) ON public.supplier_ads TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.layan_reorder_supplier_ads(
  p_placement_key text,
  p_ordered_ad_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_expected integer;
  v_updated integer;
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'غير مصرح: يلزم حساب إدارة معتمد'
      USING ERRCODE = '42501';
  END IF;

  IF p_placement_key NOT IN ('home', 'offers', 'marketplace', 'featured', 'property_details') THEN
    RAISE EXCEPTION 'موضع الإعلان غير صحيح'
      USING ERRCODE = '22023';
  END IF;

  IF p_ordered_ad_ids IS NULL OR cardinality(p_ordered_ad_ids) > 200 THEN
    RAISE EXCEPTION 'قائمة الإعلانات غير صحيحة'
      USING ERRCODE = '22023';
  END IF;

  IF cardinality(p_ordered_ad_ids) <>
     (SELECT count(DISTINCT item_id) FROM unnest(p_ordered_ad_ids) AS item_id) THEN
    RAISE EXCEPTION 'قائمة ترتيب الإعلانات تحتوي على عناصر مكررة'
      USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::integer
    INTO v_expected
    FROM public.supplier_ads a
   WHERE a.status = 'active'
     AND (a.ends_at IS NULL OR a.ends_at > now())
     AND p_placement_key = ANY(a.placement_keys);

  IF cardinality(p_ordered_ad_ids) <> v_expected THEN
    RAISE EXCEPTION 'تغيرت قائمة الإعلانات أثناء الترتيب. حدّث القائمة وحاول مرة أخرى.'
      USING ERRCODE = '40001';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM unnest(p_ordered_ad_ids) AS requested(id)
      LEFT JOIN public.supplier_ads a ON a.id = requested.id
     WHERE a.id IS NULL
        OR a.status <> 'active'
        OR (a.ends_at IS NOT NULL AND a.ends_at <= now())
        OR NOT (p_placement_key = ANY(a.placement_keys))
  ) THEN
    RAISE EXCEPTION 'تحتوي القائمة على إعلان غير نشط أو غير مخصص لهذا الموضع'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.supplier_ads a
     SET placement_order = jsonb_set(
           COALESCE(a.placement_order, '{}'::jsonb),
           ARRAY[p_placement_key],
           to_jsonb(requested.ordinality - 1),
           true
         ),
         updated_at = now()
    FROM unnest(p_ordered_ad_ids) WITH ORDINALITY AS requested(id, ordinality)
   WHERE a.id = requested.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'placement_key', p_placement_key,
    'updated_ads', v_updated
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.layan_reorder_supplier_ads(text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_reorder_supplier_ads(text, uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
