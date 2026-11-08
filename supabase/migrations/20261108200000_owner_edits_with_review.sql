-- ASYUT AQAR — 2026-11-08: owners edit their own listings; edits to published listings wait for
-- admin approval while the published version stays visible (owner's choice "أ").
-- Ownership is enforced here (SECURITY DEFINER + owner_id = auth.uid()), not only in the page.
-- Owners can never change status flags, featured/trust badges, verification or owner_id.
-- Additive, safe to re-run.

ALTER TABLE public.property_offers
  ADD COLUMN IF NOT EXISTS pending_update jsonb,
  ADD COLUMN IF NOT EXISTS update_status text,
  ADD COLUMN IF NOT EXISTS update_notes text,
  ADD COLUMN IF NOT EXISTS update_requested_at timestamptz;
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS pending_update jsonb,
  ADD COLUMN IF NOT EXISTS update_status text,
  ADD COLUMN IF NOT EXISTS update_notes text,
  ADD COLUMN IF NOT EXISTS update_requested_at timestamptz;
DO $do$ BEGIN
  ALTER TABLE public.property_offers ADD CONSTRAINT property_offers_update_status_check CHECK (update_status IS NULL OR update_status IN ('pending','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN
  ALTER TABLE public.marketplace_listings ADD CONSTRAINT marketplace_listings_update_status_check CHECK (update_status IS NULL OR update_status IN ('pending','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- Fields an owner may change.
CREATE OR REPLACE FUNCTION private.layan_offer_editable_fields()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $f$
  SELECT ARRAY['title','governorate','city','area','property_type','listing_purpose','bedrooms','bathrooms','area_m2','land_area_m2',
    'land_ownership_authority','land_permit_details','land_utilities','land_zoning','total_price','down_payment','paid_amount',
    'remaining_amount','remaining_installments','monthly_installment','assignment_fee','assignment_fee_percentage','transfer_fee',
    'discount_amount','discount_percent','description','image_urls','developer_name','project_name','contact_name','contact_phone',
    'latitude','longitude']
$f$;
CREATE OR REPLACE FUNCTION private.layan_service_editable_fields()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $f$
  SELECT ARRAY['category','listing_type','title','description','city','area','price','price_period','contact_phone','whatsapp','image_urls','details','latitude','longitude']
$f$;

-- Keep only allowed keys, and only photos the owner uploaded to their own folder (or kept from before).
CREATE OR REPLACE FUNCTION private.layan_clean_offer_changes(p_old public.property_offers, p_changes jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $f$
DECLARE
  v jsonb := '{}'::jsonb; k text; url text; imgs jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(p_changes) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'بيانات التعديل غير صالحة' USING ERRCODE = '22023'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
    IF k = ANY (private.layan_offer_editable_fields()) THEN v := v || jsonb_build_object(k, p_changes -> k); END IF;
  END LOOP;
  IF v ? 'image_urls' THEN
    IF jsonb_typeof(v -> 'image_urls') <> 'array' OR jsonb_array_length(v -> 'image_urls') > 10 THEN RAISE EXCEPTION 'الصور: 10 صور كحد أقصى' USING ERRCODE = '22023'; END IF;
    FOR url IN SELECT jsonb_array_elements_text(v -> 'image_urls') LOOP
      IF (starts_with(url, 'https://ebyhwqkmhxbgocngpqfe.supabase.co/storage/v1/object/public/layan_real_estat/offers/' || p_old.owner_id::text || '/')
          AND position('..' in url) = 0 AND url !~ '[\s"''<>]')
         OR (p_old.image_urls IS NOT NULL AND p_old.image_urls ? url) THEN
        imgs := imgs || to_jsonb(url);
      ELSE
        RAISE EXCEPTION 'صورة غير مسموح بها في التعديل' USING ERRCODE = '22023';
      END IF;
    END LOOP;
    v := jsonb_set(v, '{image_urls}', imgs);
  END IF;
  IF v ? 'title' AND char_length(trim(v ->> 'title')) < 3 THEN RAISE EXCEPTION 'العنوان قصير جدًا' USING ERRCODE = '22023'; END IF;
  IF v ? 'listing_purpose' AND (v ->> 'listing_purpose') NOT IN ('بيع','إيجار','تنازل') THEN RAISE EXCEPTION 'نوع المعاملة غير صالح' USING ERRCODE = '22023'; END IF;
  RETURN v;
END $f$;

CREATE OR REPLACE FUNCTION private.layan_apply_offer_changes(p_id bigint, p_changes jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
DECLARE r public.property_offers;
BEGIN
  SELECT * INTO r FROM jsonb_populate_record((SELECT o FROM public.property_offers o WHERE o.id = p_id), p_changes);
  UPDATE public.property_offers o SET
    title = r.title, governorate = r.governorate, city = r.city, area = r.area, property_type = r.property_type,
    listing_purpose = r.listing_purpose, bedrooms = r.bedrooms, bathrooms = r.bathrooms, area_m2 = r.area_m2, land_area_m2 = r.land_area_m2,
    land_ownership_authority = r.land_ownership_authority, land_permit_details = r.land_permit_details, land_utilities = r.land_utilities,
    land_zoning = r.land_zoning, total_price = r.total_price, down_payment = r.down_payment, paid_amount = r.paid_amount,
    remaining_amount = r.remaining_amount, remaining_installments = r.remaining_installments, monthly_installment = r.monthly_installment,
    assignment_fee = r.assignment_fee, assignment_fee_percentage = r.assignment_fee_percentage, transfer_fee = r.transfer_fee,
    discount_amount = r.discount_amount, discount_percent = r.discount_percent, description = r.description, image_urls = r.image_urls,
    developer_name = r.developer_name, project_name = r.project_name, contact_name = r.contact_name, contact_phone = r.contact_phone,
    latitude = r.latitude, longitude = r.longitude, updated_at = now()
  WHERE o.id = p_id;
END $f$;
REVOKE ALL ON FUNCTION private.layan_apply_offer_changes(bigint, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.layan_apply_service_changes(p_id uuid, p_changes jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
DECLARE r public.marketplace_listings;
BEGIN
  SELECT * INTO r FROM jsonb_populate_record((SELECT m FROM public.marketplace_listings m WHERE m.id = p_id), p_changes);
  UPDATE public.marketplace_listings m SET
    category = r.category, listing_type = r.listing_type, title = r.title, description = r.description, city = r.city, area = r.area,
    price = r.price, price_period = r.price_period, contact_phone = r.contact_phone, whatsapp = r.whatsapp, image_urls = r.image_urls,
    details = r.details, latitude = r.latitude, longitude = r.longitude, updated_at = now()
  WHERE m.id = p_id;
END $f$;
REVOKE ALL ON FUNCTION private.layan_apply_service_changes(uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- ---- Owner: edit a property ----
CREATE OR REPLACE FUNCTION public.layan_owner_update_offer(p_id bigint, p_changes jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
DECLARE o public.property_offers; v jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'سجّل الدخول أولًا' USING ERRCODE = '42501'; END IF;
  SELECT * INTO o FROM public.property_offers WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR o.owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'لا يمكنك تعديل إعلان لا تملكه' USING ERRCODE = '42501'; END IF;
  v := private.layan_clean_offer_changes(o, p_changes);
  IF v = '{}'::jsonb THEN RETURN 'unchanged'; END IF;
  IF o.status = 'pending' THEN
    -- Not published yet: the edit goes straight into the request under review.
    PERFORM private.layan_apply_offer_changes(p_id, v);
    RETURN 'saved';
  END IF;
  -- Published: the visible version stays; the edit waits for approval.
  UPDATE public.property_offers SET pending_update = v, update_status = 'pending', update_notes = NULL, update_requested_at = now() WHERE id = p_id;
  RETURN 'pending';
END $f$;

-- ---- Owner: mark sold / rented, or show again ----
CREATE OR REPLACE FUNCTION public.layan_owner_set_offer_status(p_id bigint, p_status text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
DECLARE o public.property_offers;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'سجّل الدخول أولًا' USING ERRCODE = '42501'; END IF;
  SELECT * INTO o FROM public.property_offers WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR o.owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'لا يمكنك تعديل إعلان لا تملكه' USING ERRCODE = '42501'; END IF;
  IF o.status NOT IN ('available','reserved','sold') THEN RAISE EXCEPTION 'الإعلان لم يُعتمد بعد' USING ERRCODE = '22023'; END IF;
  IF p_status NOT IN ('available','reserved','sold') THEN RAISE EXCEPTION 'حالة غير صالحة' USING ERRCODE = '22023'; END IF;
  UPDATE public.property_offers SET status = p_status, updated_at = now() WHERE id = p_id;
  RETURN p_status;
END $f$;

-- ---- Owner: delete own property ----
CREATE OR REPLACE FUNCTION public.layan_owner_delete_offer(p_id bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'سجّل الدخول أولًا' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.property_offers WHERE id = p_id AND owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'لا يمكنك حذف إعلان لا تملكه' USING ERRCODE = '42501'; END IF;
  RETURN 'deleted';
END $f$;

-- ---- Owner: edit a service ----
CREATE OR REPLACE FUNCTION public.layan_owner_update_service(p_id uuid, p_changes jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
DECLARE m public.marketplace_listings; v jsonb := '{}'::jsonb; k text; img text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'سجّل الدخول أولًا' USING ERRCODE = '42501'; END IF;
  SELECT * INTO m FROM public.marketplace_listings WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR m.owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'لا يمكنك تعديل إعلان لا تملكه' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_changes) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'بيانات التعديل غير صالحة' USING ERRCODE = '22023'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
    IF k = ANY (private.layan_service_editable_fields()) THEN v := v || jsonb_build_object(k, p_changes -> k); END IF;
  END LOOP;
  IF v ? 'image_urls' THEN
    IF jsonb_typeof(v -> 'image_urls') <> 'array' OR jsonb_array_length(v -> 'image_urls') > 6 THEN RAISE EXCEPTION 'الصور: 6 صور كحد أقصى' USING ERRCODE = '22023'; END IF;
    FOR img IN SELECT jsonb_array_elements_text(v -> 'image_urls') LOOP
      IF NOT (img LIKE 'data:image/jpeg;base64,%' AND char_length(img) < 700000) AND NOT (img = ANY (coalesce(m.image_urls, '{}'))) THEN
        RAISE EXCEPTION 'صورة غير مسموح بها في التعديل' USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;
  IF v = '{}'::jsonb THEN RETURN 'unchanged'; END IF;
  IF m.status IN ('pending','rejected') THEN
    PERFORM private.layan_apply_service_changes(p_id, v);
    UPDATE public.marketplace_listings SET status = 'pending', admin_notes = NULL WHERE id = p_id;
    RETURN 'saved';
  END IF;
  UPDATE public.marketplace_listings SET pending_update = v, update_status = 'pending', update_notes = NULL, update_requested_at = now() WHERE id = p_id;
  RETURN 'pending';
END $f$;

CREATE OR REPLACE FUNCTION public.layan_owner_delete_service(p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'سجّل الدخول أولًا' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.marketplace_listings WHERE id = p_id AND owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'لا يمكنك حذف إعلان لا تملكه' USING ERRCODE = '42501'; END IF;
  RETURN 'deleted';
END $f$;

-- ---- Admin: edits waiting for approval (old vs new) ----
CREATE OR REPLACE FUNCTION public.layan_admin_list_pending_edits()
RETURNS TABLE (kind text, id text, title text, owner_email text, current jsonb, proposed jsonb, requested_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $f$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT 'offer'::text, o.id::text, o.title, u.email::text,
         (SELECT jsonb_object_agg(k, to_jsonb(o) -> k) FROM jsonb_object_keys(o.pending_update) k), o.pending_update, o.update_requested_at
  FROM public.property_offers o LEFT JOIN auth.users u ON u.id = o.owner_id
  WHERE o.update_status = 'pending' AND o.pending_update IS NOT NULL
  UNION ALL
  SELECT 'service'::text, m.id::text, m.title, u.email::text,
         (SELECT jsonb_object_agg(k, to_jsonb(m) -> k) FROM jsonb_object_keys(m.pending_update) k), m.pending_update, m.update_requested_at
  FROM public.marketplace_listings m LEFT JOIN auth.users u ON u.id = m.owner_id
  WHERE m.update_status = 'pending' AND m.pending_update IS NOT NULL
  ORDER BY 7;
END $f$;

CREATE OR REPLACE FUNCTION public.layan_admin_review_edit(p_kind text, p_id text, p_approve boolean, p_notes text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
DECLARE v jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING ERRCODE = '42501'; END IF;
  IF NOT p_approve AND coalesce(trim(p_notes), '') = '' THEN RAISE EXCEPTION 'اكتب سبب الرفض ليصل لصاحب الإعلان' USING ERRCODE = '22023'; END IF;
  IF p_kind = 'offer' THEN
    SELECT pending_update INTO v FROM public.property_offers WHERE id = p_id::bigint AND update_status = 'pending' FOR UPDATE;
    IF v IS NULL THEN RAISE EXCEPTION 'لا يوجد تعديل معلّق' USING ERRCODE = 'P0002'; END IF;
    IF p_approve THEN PERFORM private.layan_apply_offer_changes(p_id::bigint, v); END IF;
    UPDATE public.property_offers SET pending_update = CASE WHEN p_approve THEN NULL ELSE pending_update END,
      update_status = CASE WHEN p_approve THEN NULL ELSE 'rejected' END, update_notes = left(p_notes, 500) WHERE id = p_id::bigint;
  ELSIF p_kind = 'service' THEN
    SELECT pending_update INTO v FROM public.marketplace_listings WHERE id = p_id::uuid AND update_status = 'pending' FOR UPDATE;
    IF v IS NULL THEN RAISE EXCEPTION 'لا يوجد تعديل معلّق' USING ERRCODE = 'P0002'; END IF;
    IF p_approve THEN PERFORM private.layan_apply_service_changes(p_id::uuid, v); END IF;
    UPDATE public.marketplace_listings SET pending_update = CASE WHEN p_approve THEN NULL ELSE pending_update END,
      update_status = CASE WHEN p_approve THEN NULL ELSE 'rejected' END, update_notes = left(p_notes, 500) WHERE id = p_id::uuid;
  ELSE
    RAISE EXCEPTION 'نوع غير صالح' USING ERRCODE = '22023';
  END IF;
  RETURN CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;
END $f$;

DO $do$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.layan_owner_update_offer(bigint, jsonb)','public.layan_owner_set_offer_status(bigint, text)',
    'public.layan_owner_delete_offer(bigint)','public.layan_owner_update_service(uuid, jsonb)','public.layan_owner_delete_service(uuid)',
    'public.layan_admin_list_pending_edits()','public.layan_admin_review_edit(text, text, boolean, text)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END
$do$;
REVOKE ALL ON FUNCTION private.layan_clean_offer_changes(public.property_offers, jsonb) FROM PUBLIC, anon, authenticated;
