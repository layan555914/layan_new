-- ASYUT AQAR Phase 4: verified project-to-property-offer relationships.
-- Existing offers remain standalone unless an explicit verified relation is submitted.
-- This migration is reviewed in CI only; do not apply to production without owner approval.

ALTER TABLE public.property_offers
  ADD COLUMN IF NOT EXISTS directory_project_id uuid,
  ADD COLUMN IF NOT EXISTS directory_entity_id uuid;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.property_offers'::regclass
      AND conname='property_offers_directory_project_id_fkey'
  ) THEN
    ALTER TABLE public.property_offers
      ADD CONSTRAINT property_offers_directory_project_id_fkey
      FOREIGN KEY (directory_project_id)
      REFERENCES public.directory_projects(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.property_offers'::regclass
      AND conname='property_offers_directory_entity_id_fkey'
  ) THEN
    ALTER TABLE public.property_offers
      ADD CONSTRAINT property_offers_directory_entity_id_fkey
      FOREIGN KEY (directory_entity_id)
      REFERENCES public.directory_entities(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.property_offers'::regclass
      AND conname='property_offers_project_entity_pair_check'
  ) THEN
    ALTER TABLE public.property_offers
      ADD CONSTRAINT property_offers_project_entity_pair_check
      CHECK (
        (directory_project_id IS NULL AND directory_entity_id IS NULL)
        OR (directory_project_id IS NOT NULL AND directory_entity_id IS NOT NULL)
      );
  END IF;
END
$constraints$;

CREATE INDEX IF NOT EXISTS property_offers_directory_project_status_idx
  ON public.property_offers(directory_project_id, status, verification_status)
  WHERE directory_project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS property_offers_directory_entity_created_idx
  ON public.property_offers(directory_entity_id, created_at DESC)
  WHERE directory_entity_id IS NOT NULL;

COMMENT ON COLUMN public.property_offers.directory_project_id IS
  'Verified directory project relationship for a property/unit offer. Never inferred from the legacy project_name text.';
COMMENT ON COLUMN public.property_offers.directory_entity_id IS
  'Verified directory company/provider relationship for a project-linked offer. The company role is checked server-side.';

-- Only expose the two relationship identifiers through the existing column-level
-- read grants. No direct INSERT/UPDATE privilege is added for these columns.
GRANT SELECT (directory_project_id, directory_entity_id)
  ON public.property_offers TO anon, authenticated;

-- Public visitors may continue to see existing standalone available offers.
-- Linked offers additionally require a currently published project, published
-- company profile, and an explicitly recorded allowed company/project relation.
DROP POLICY IF EXISTS property_offers_public_read ON public.property_offers;
CREATE POLICY property_offers_public_read
ON public.property_offers
FOR SELECT
TO anon
USING (
  status = 'available'
  AND (
    (directory_project_id IS NULL AND directory_entity_id IS NULL)
    OR (
      directory_project_id IS NOT NULL
      AND directory_entity_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.directory_projects p
        JOIN public.directory_entities e
          ON e.id = property_offers.directory_entity_id
        JOIN public.directory_project_entities pe
          ON pe.project_id = p.id
         AND pe.entity_id = e.id
        WHERE p.id = property_offers.directory_project_id
          AND p.public_visible = true
          AND p.verification_status = 'published'
          AND e.public_visible = true
          AND e.verification_status = 'published'
          AND pe.relation_type IN (
            'developer','land_owner','marketing_agent','sales_agent'
          )
      )
    )
  )
);

DROP POLICY IF EXISTS property_offers_authenticated_read ON public.property_offers;
CREATE POLICY property_offers_authenticated_read
ON public.property_offers
FOR SELECT
TO authenticated
USING (
  (
    status = 'available'
    AND (
      (directory_project_id IS NULL AND directory_entity_id IS NULL)
      OR (
        directory_project_id IS NOT NULL
        AND directory_entity_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.directory_projects p
          JOIN public.directory_entities e
            ON e.id = property_offers.directory_entity_id
          JOIN public.directory_project_entities pe
            ON pe.project_id = p.id
           AND pe.entity_id = e.id
          WHERE p.id = property_offers.directory_project_id
            AND p.public_visible = true
            AND p.verification_status = 'published'
            AND e.public_visible = true
            AND e.verification_status = 'published'
            AND pe.relation_type IN (
              'developer','land_owner','marketing_agent','sales_agent'
            )
        )
      )
    )
  )
  OR owner_id = (SELECT auth.uid())
  OR (status = 'pending' AND (SELECT private.layan_is_admin()))
  OR (
    directory_entity_id IS NOT NULL
    AND private.company_entity_manager_access(directory_entity_id)
      IN ('owner','manager','editor')
  )
);

-- A verified company-file owner or delegated manager can see every offer
-- associated with their own directory entity, including unpublished items.
-- Editors can read the unit list but cannot create, change or publish offers.
CREATE POLICY property_offers_company_file_read
ON public.property_offers
FOR SELECT
TO authenticated
USING (
  directory_entity_id IS NOT NULL
  AND private.company_entity_manager_access(directory_entity_id)
    IN ('owner','manager','editor')
);

CREATE OR REPLACE FUNCTION private.company_project_offer_submit(
  p_directory_entity_id uuid,
  p_project_id uuid,
  p_payload jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_role text;
  v_entity public.directory_entities%ROWTYPE;
  v_project public.directory_projects%ROWTYPE;
  v_relation text;
  v_title text;
  v_purpose text;
  v_property_type text;
  v_city text;
  v_area text;
  v_price_on_request boolean;
  v_total_price numeric;
  v_down_payment numeric;
  v_paid_amount numeric;
  v_remaining_amount numeric;
  v_remaining_installments integer;
  v_monthly_installment numeric;
  v_assignment_fee numeric;
  v_discount_amount numeric;
  v_discount_percent numeric;
  v_area_m2 numeric;
  v_land_area_m2 numeric;
  v_bedrooms integer;
  v_bathrooms integer;
  v_images jsonb;
  v_image_url text;
  v_contact_name text;
  v_contact_phone text;
  v_contact_consent boolean;
  v_new_id bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'سجّل الدخول أولًا لإضافة وحدة إلى المشروع'
      USING ERRCODE='42501';
  END IF;

  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'بيانات الوحدة غير صالحة'
      USING ERRCODE='22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_payload) AS item(key)
    WHERE key <> ALL (ARRAY[
      'title','listing_purpose','property_type','city','area',
      'area_m2','land_area_m2','bedrooms','bathrooms','total_price',
      'price_on_request','down_payment','paid_amount','remaining_amount',
      'remaining_installments','monthly_installment','assignment_fee',
      'discount_amount','discount_percent','description','image_urls',
      'contact_name','contact_phone','contact_consent',
      'land_ownership_authority','land_permit_details','land_utilities','land_zoning'
    ]::text[])
  ) THEN
    RAISE EXCEPTION 'تحتوي بيانات الوحدة على حقول غير مسموح بها'
      USING ERRCODE='22023';
  END IF;

  v_role := private.company_entity_manager_access(p_directory_entity_id);
  IF v_role NOT IN ('owner','manager') THEN
    RAISE EXCEPTION 'إضافة وحدات المشروعات متاحة للمالك المعتمد أو مدير الملف المفوض فقط'
      USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_entity
  FROM public.directory_entities
  WHERE id=p_directory_entity_id
    AND public_visible=true
    AND verification_status='published';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ملف الشركة غير منشور أو لم يعد متاحًا'
      USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_project
  FROM public.directory_projects
  WHERE id=p_project_id
    AND public_visible=true
    AND verification_status='published';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'المشروع غير منشور أو لم يعد متاحًا'
      USING ERRCODE='22023';
  END IF;

  SELECT relation_type INTO v_relation
  FROM public.directory_project_entities
  WHERE project_id=p_project_id
    AND entity_id=p_directory_entity_id
    AND relation_type IN ('developer','land_owner','marketing_agent','sales_agent')
  LIMIT 1;
  IF v_relation IS NULL THEN
    RAISE EXCEPTION 'لا توجد علاقة موثقة تسمح لهذا الملف بإدارة وحدات المشروع'
      USING ERRCODE='42501';
  END IF;

  v_title := nullif(btrim(coalesce(p_payload->>'title','')),'');
  v_purpose := p_payload->>'listing_purpose';
  v_property_type := nullif(btrim(coalesce(p_payload->>'property_type','')),'');
  v_city := nullif(btrim(coalesce(p_payload->>'city','')),'');
  v_area := nullif(btrim(coalesce(p_payload->>'area','')),'');

  IF v_title IS NULL OR char_length(v_title) < 3 OR char_length(v_title) > 160 THEN
    RAISE EXCEPTION 'عنوان الوحدة مطلوب ويجب أن يكون بين 3 و160 حرفًا'
      USING ERRCODE='22023';
  END IF;
  IF v_purpose NOT IN ('بيع','إيجار','تنازل') THEN
    RAISE EXCEPTION 'نوع المعاملة يجب أن يكون بيعًا أو إيجارًا أو تنازلًا'
      USING ERRCODE='22023';
  END IF;
  IF v_property_type IS NULL OR char_length(v_property_type) > 80 THEN
    RAISE EXCEPTION 'حدد نوع العقار'
      USING ERRCODE='22023';
  END IF;
  IF v_city IS NULL OR char_length(v_city) > 120 OR v_area IS NULL OR char_length(v_area) > 160 THEN
    RAISE EXCEPTION 'حدد المدينة والمنطقة قبل إرسال الوحدة'
      USING ERRCODE='22023';
  END IF;

  IF p_payload ? 'price_on_request'
     AND jsonb_typeof(p_payload->'price_on_request') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'اختيار السعر عند التواصل غير صالح'
      USING ERRCODE='22023';
  END IF;
  v_price_on_request := coalesce((p_payload->>'price_on_request')::boolean,false);

  IF EXISTS (
    SELECT 1 FROM jsonb_each(p_payload) AS item(key,value)
    WHERE key IN (
      'area_m2','land_area_m2','bedrooms','bathrooms','total_price',
      'down_payment','paid_amount','remaining_amount','remaining_installments',
      'monthly_installment','assignment_fee','discount_amount','discount_percent'
    )
    AND jsonb_typeof(value) NOT IN ('number','null')
  ) THEN
    RAISE EXCEPTION 'إحدى القيم الرقمية في بيانات الوحدة غير صالحة'
      USING ERRCODE='22023';
  END IF;

  v_total_price := nullif(p_payload->>'total_price','')::numeric;
  v_down_payment := coalesce(nullif(p_payload->>'down_payment','')::numeric,0);
  v_paid_amount := coalesce(nullif(p_payload->>'paid_amount','')::numeric,0);
  v_remaining_amount := coalesce(nullif(p_payload->>'remaining_amount','')::numeric,0);
  v_remaining_installments := coalesce(nullif(p_payload->>'remaining_installments','')::integer,0);
  v_monthly_installment := coalesce(nullif(p_payload->>'monthly_installment','')::numeric,0);
  v_assignment_fee := coalesce(nullif(p_payload->>'assignment_fee','')::numeric,0);
  v_discount_amount := coalesce(nullif(p_payload->>'discount_amount','')::numeric,0);
  v_discount_percent := coalesce(nullif(p_payload->>'discount_percent','')::numeric,0);
  v_area_m2 := nullif(p_payload->>'area_m2','')::numeric;
  v_land_area_m2 := nullif(p_payload->>'land_area_m2','')::numeric;
  v_bedrooms := coalesce(nullif(p_payload->>'bedrooms','')::integer,0);
  v_bathrooms := coalesce(nullif(p_payload->>'bathrooms','')::integer,0);

  IF v_area_m2 < 0 OR v_land_area_m2 < 0
     OR v_down_payment < 0 OR v_paid_amount < 0 OR v_remaining_amount < 0
     OR v_monthly_installment < 0 OR v_assignment_fee < 0
     OR v_discount_amount < 0 OR v_discount_percent < 0
     OR v_discount_percent > 100 OR v_remaining_installments < 0
     OR v_bedrooms < 0 OR v_bathrooms < 0 THEN
    RAISE EXCEPTION 'لا تقبل المساحة أو الأعداد أو المبالغ السالبة'
      USING ERRCODE='22023';
  END IF;

  IF NOT v_price_on_request AND coalesce(v_total_price,0) <= 0 THEN
    RAISE EXCEPTION 'اكتب سعرًا أكبر من صفر أو اختر السعر عند التواصل'
      USING ERRCODE='22023';
  END IF;

  IF v_purpose='تنازل' THEN
    IF NOT v_price_on_request AND (
      v_down_payment > v_total_price
      OR v_paid_amount < v_down_payment
      OR v_paid_amount + v_remaining_amount > v_total_price + 0.01
    ) THEN
      RAISE EXCEPTION 'راجع المقدم والمدفوع والمتبقي مقارنة بإجمالي قيمة التنازل'
        USING ERRCODE='22023';
    END IF;
  ELSE
    v_down_payment := 0;
    v_paid_amount := 0;
    v_remaining_amount := 0;
    v_remaining_installments := 0;
    v_monthly_installment := 0;
    v_assignment_fee := 0;
  END IF;

  IF p_payload ? 'contact_consent'
     AND jsonb_typeof(p_payload->'contact_consent') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'موافقة نشر رقم التواصل غير صالحة'
      USING ERRCODE='22023';
  END IF;
  v_contact_consent := coalesce((p_payload->>'contact_consent')::boolean,false);
  v_contact_name := nullif(btrim(coalesce(p_payload->>'contact_name','')),'');
  v_contact_phone := nullif(btrim(coalesce(p_payload->>'contact_phone','')),'');
  IF v_contact_phone IS NOT NULL AND (
    NOT v_contact_consent OR char_length(v_contact_phone) < 7 OR char_length(v_contact_phone) > 30
  ) THEN
    RAISE EXCEPTION 'لنشر رقم التواصل يجب الموافقة صراحةً وإدخال رقم صحيح'
      USING ERRCODE='22023';
  END IF;

  v_images := coalesce(p_payload->'image_urls','[]'::jsonb);
  IF jsonb_typeof(v_images) IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_images) > 10 THEN
    RAISE EXCEPTION 'صور الوحدة غير صالحة أو تجاوزت الحد الأقصى (10 صور)'
      USING ERRCODE='22023';
  END IF;
  FOR v_image_url IN SELECT jsonb_array_elements_text(v_images) LOOP
    IF NOT starts_with(
      v_image_url,
      'https://ebyhwqkmhxbgocngpqfe.supabase.co/storage/v1/object/public/layan_real_estat/offers/' || auth.uid()::text || '/'
    )
    OR position('..' in v_image_url) > 0
    OR position(' ' in v_image_url) > 0
    OR position(chr(9) in v_image_url) > 0
    OR position('"' in v_image_url) > 0
    OR position('<' in v_image_url) > 0
    OR position('>' in v_image_url) > 0 THEN
      RAISE EXCEPTION 'إحدى صور الوحدة ليست مرفوعة من حسابك على مساحة الصور المسموحة'
        USING ERRCODE='22023';
    END IF;
  END LOOP;

  INSERT INTO public.property_offers (
    owner_id, directory_project_id, directory_entity_id, title,
    listing_purpose, property_type, governorate, city, area,
    area_m2, land_area_m2, bedrooms, bathrooms, total_price,
    price_on_request, down_payment, paid_amount, remaining_amount,
    remaining_installments, monthly_installment, assignment_fee,
    transfer_fee, discount_amount, discount_percent, description,
    land_ownership_authority, land_permit_details, land_utilities, land_zoning,
    developer_name, project_name, contact_name, contact_phone, image_urls,
    status, verification_status, developer_approval_status,
    featured_requested, is_featured, promotion_status
  )
  VALUES (
    auth.uid(), p_project_id, p_directory_entity_id, v_title,
    v_purpose, v_property_type, 'أسيوط', v_city, v_area,
    v_area_m2, v_land_area_m2, v_bedrooms, v_bathrooms,
    CASE WHEN v_price_on_request THEN NULL ELSE v_total_price END,
    v_price_on_request, v_down_payment, v_paid_amount, v_remaining_amount,
    v_remaining_installments, v_monthly_installment, v_assignment_fee,
    v_assignment_fee, v_discount_amount, v_discount_percent,
    nullif(btrim(coalesce(p_payload->>'description','')),''),
    nullif(btrim(coalesce(p_payload->>'land_ownership_authority','')),''),
    nullif(btrim(coalesce(p_payload->>'land_permit_details','')),''),
    nullif(btrim(coalesce(p_payload->>'land_utilities','')),''),
    nullif(btrim(coalesce(p_payload->>'land_zoning','')),''),
    CASE WHEN v_relation='developer' THEN v_entity.name_ar ELSE NULL END,
    v_project.name_ar, v_contact_name, v_contact_phone, v_images,
    'pending', 'pending', 'unknown',
    false, false, 'none'
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION private.company_project_offer_update(
  p_id bigint,
  p_changes jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_offer public.property_offers%ROWTYPE;
  v_role text;
  v_changes jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'سجّل الدخول أولًا لتعديل الوحدة'
      USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_offer
  FROM public.property_offers
  WHERE id=p_id
  FOR UPDATE;
  IF NOT FOUND OR v_offer.directory_entity_id IS NULL THEN
    RAISE EXCEPTION 'الوحدة غير مرتبطة بملف شركة قابل للإدارة'
      USING ERRCODE='42501';
  END IF;

  v_role := private.company_entity_manager_access(v_offer.directory_entity_id);
  IF v_role NOT IN ('owner','manager') THEN
    RAISE EXCEPTION 'تعديل الوحدات متاح للمالك المعتمد أو مدير الملف المفوض فقط'
      USING ERRCODE='42501';
  END IF;

  v_changes := private.layan_clean_offer_changes(v_offer,p_changes);
  IF v_changes='{}'::jsonb THEN
    RETURN 'unchanged';
  END IF;

  IF v_offer.status='pending'
     AND v_offer.verification_status IN ('pending','under_review') THEN
    PERFORM private.layan_apply_offer_changes(p_id,v_changes);
    RETURN 'saved';
  END IF;

  UPDATE public.property_offers
  SET pending_update=v_changes,
      update_status='pending',
      update_notes=NULL,
      update_requested_at=now(),
      updated_at=now()
  WHERE id=p_id;

  RETURN 'pending';
END;
$function$;

CREATE OR REPLACE FUNCTION private.company_project_offer_set_status(
  p_id bigint,
  p_status text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_offer public.property_offers%ROWTYPE;
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'سجّل الدخول لإدارة حالة الوحدة'
      USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_offer
  FROM public.property_offers
  WHERE id=p_id
  FOR UPDATE;
  IF NOT FOUND OR v_offer.directory_entity_id IS NULL THEN
    RAISE EXCEPTION 'الوحدة غير مرتبطة بملف شركة قابل للإدارة'
      USING ERRCODE='42501';
  END IF;

  v_role := private.company_entity_manager_access(v_offer.directory_entity_id);
  IF v_role NOT IN ('owner','manager') THEN
    RAISE EXCEPTION 'تغيير حالة الوحدة متاح للمالك المعتمد أو مدير الملف المفوض فقط'
      USING ERRCODE='42501';
  END IF;
  IF v_offer.status NOT IN ('available','reserved','sold')
     OR p_status NOT IN ('available','reserved','sold') THEN
    RAISE EXCEPTION 'لا يمكن تغيير الحالة قبل اعتماد الوحدة أو إلى حالة غير صالحة'
      USING ERRCODE='22023';
  END IF;

  UPDATE public.property_offers
  SET status=p_status, updated_at=now()
  WHERE id=p_id;
  RETURN p_status;
END;
$function$;

-- Public wrappers remain SECURITY INVOKER; role checks and data writes stay private.
CREATE OR REPLACE FUNCTION public.company_project_offer_submit(
  p_directory_entity_id uuid,
  p_project_id uuid,
  p_payload jsonb
)
RETURNS bigint
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.company_project_offer_submit(
    p_directory_entity_id,p_project_id,p_payload
  );
$function$;

CREATE OR REPLACE FUNCTION public.company_project_offer_update(
  p_id bigint,
  p_changes jsonb
)
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.company_project_offer_update(p_id,p_changes);
$function$;

CREATE OR REPLACE FUNCTION public.company_project_offer_set_status(
  p_id bigint,
  p_status text
)
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.company_project_offer_set_status(p_id,p_status);
$function$;

REVOKE ALL ON FUNCTION private.company_project_offer_submit(uuid,uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.company_project_offer_update(bigint,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.company_project_offer_set_status(bigint,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.company_project_offer_submit(uuid,uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.company_project_offer_update(bigint,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.company_project_offer_set_status(bigint,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.company_project_offer_submit(uuid,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_project_offer_update(bigint,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_project_offer_set_status(bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_project_offer_submit(uuid,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_project_offer_update(bigint,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_project_offer_set_status(bigint,text) TO authenticated;

COMMENT ON FUNCTION public.company_project_offer_submit(uuid,uuid,jsonb) IS
  'Creates a pending property offer explicitly linked to a published project and a verified company/project relation; publication still requires admin review.';
COMMENT ON FUNCTION public.company_project_offer_update(bigint,jsonb) IS
  'Allows verified company owners/managers to change only an offer linked to their directory entity; published changes remain pending admin review.';
COMMENT ON FUNCTION public.company_project_offer_set_status(bigint,text) IS
  'Allows verified company owners/managers to update the availability state of an already approved linked unit.';
