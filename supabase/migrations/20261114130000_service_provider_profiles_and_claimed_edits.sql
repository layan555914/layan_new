-- Service-provider profiles and owner-submitted changes.
-- Depends on the company claim tables and RPCs from PR #115.
-- This migration is committed to a development branch only; it has not been applied to production.

BEGIN;

ALTER TABLE public.directory_entities
  ADD COLUMN IF NOT EXISTS service_category text,
  ADD COLUMN IF NOT EXISTS public_whatsapp text,
  ADD COLUMN IF NOT EXISTS public_logo_url text,
  ADD COLUMN IF NOT EXISTS public_services text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS public_gallery_urls text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS public_business_hours text,
  ADD COLUMN IF NOT EXISTS public_coverage_areas text[] NOT NULL DEFAULT '{}'::text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.directory_entities'::regclass
      AND conname='directory_entities_service_category_check'
  ) THEN
    ALTER TABLE public.directory_entities
      ADD CONSTRAINT directory_entities_service_category_check
      CHECK (service_category IS NULL OR service_category = ANY (ARRAY[
        'contracting_construction','real_estate_marketing','real_estate_brokerage',
        'building_materials','finishing_decoration','furniture_furnishings',
        'engineering_design','maintenance_property_management','real_estate_consultancy',
        'real_estate_development','real_estate_sales','other_real_estate_services'
      ]::text[]));
  END IF;
END $$;

-- Classify existing contractor and marketing records; do not duplicate them.
UPDATE public.directory_entities
SET service_category = CASE entity_type
  WHEN 'contractor' THEN 'contracting_construction'
  WHEN 'marketing' THEN 'real_estate_marketing'
  WHEN 'brokerage' THEN 'real_estate_brokerage'
  WHEN 'consultant' THEN 'real_estate_consultancy'
  WHEN 'developer' THEN 'real_estate_development'
  WHEN 'sales_office' THEN 'real_estate_sales'
  ELSE service_category
END
WHERE service_category IS NULL
  AND entity_type IN ('contractor','marketing','brokerage','consultant','developer','sales_office');

CREATE INDEX IF NOT EXISTS directory_entities_service_category_public_idx
  ON public.directory_entities(service_category,name_ar)
  WHERE public_visible=true AND verification_status='published';

-- Publish access is row-protected by the existing RLS rules. Only the new profile
-- columns receive explicit public SELECT grants. Updates still require existing admin RLS.
GRANT SELECT (
  service_category,public_whatsapp,public_logo_url,public_services,
  public_gallery_urls,public_business_hours,public_coverage_areas
) ON public.directory_entities TO anon,authenticated;
GRANT UPDATE (
  service_category,public_whatsapp,public_logo_url,public_services,
  public_gallery_urls,public_business_hours,public_coverage_areas
) ON public.directory_entities TO authenticated;

CREATE TABLE IF NOT EXISTS public.company_entity_profile_update_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_entity_id uuid NOT NULL REFERENCES public.directory_entities(id) ON DELETE RESTRICT,
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_entity_profile_update_payload_check
    CHECK (jsonb_typeof(payload)='object' AND length(payload::text)<=20000),
  CONSTRAINT company_entity_profile_update_status_check
    CHECK (status IN ('pending','needs_changes','rejected','approved'))
);

CREATE INDEX IF NOT EXISTS company_entity_profile_updates_requester_idx
  ON public.company_entity_profile_update_requests(requester_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS company_entity_profile_updates_status_idx
  ON public.company_entity_profile_update_requests(status,created_at)
  WHERE status='pending';
CREATE UNIQUE INDEX IF NOT EXISTS company_entity_profile_updates_one_pending_per_entity
  ON public.company_entity_profile_update_requests(directory_entity_id)
  WHERE status='pending';

ALTER TABLE public.company_entity_profile_update_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_entity_profile_update_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.company_entity_profile_update_requests TO authenticated;

DROP POLICY IF EXISTS company_entity_profile_updates_read_own_or_admin
  ON public.company_entity_profile_update_requests;
CREATE POLICY company_entity_profile_updates_read_own_or_admin
  ON public.company_entity_profile_update_requests
  FOR SELECT TO authenticated
  USING (requester_user_id=(SELECT auth.uid()) OR public.layan_is_admin());

CREATE OR REPLACE FUNCTION private.company_entity_profile_update_submit(
  p_directory_entity_id uuid,p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_user uuid:=auth.uid();
  v_entity public.directory_entities%ROWTYPE;
  v_request uuid;
  v_allowed text[]:=ARRAY[
    'name_ar','name_en','description','website_url','public_phone','public_email',
    'public_address','service_category','public_whatsapp','public_logo_url',
    'public_services','public_gallery_urls','public_business_hours','public_coverage_areas'
  ];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'سجّل الدخول أولًا' USING errcode='42501'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR p_payload='{}'::jsonb OR length(p_payload::text)>20000 THEN
    RAISE EXCEPTION 'بيانات التعديل غير صحيحة أو فارغة' USING errcode='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) AS keys(key_name) WHERE NOT (key_name=ANY(v_allowed))) THEN
    RAISE EXCEPTION 'يتضمن الطلب حقولًا غير مسموح بتعديلها' USING errcode='22023';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.company_entity_managers
    WHERE directory_entity_id=p_directory_entity_id AND owner_user_id=v_user
  ) THEN RAISE EXCEPTION 'لا يملك هذا الحساب إدارة الملف؛ اطلب استلامه أولًا' USING errcode='42501'; END IF;

  SELECT * INTO v_entity FROM public.directory_entities
   WHERE id=p_directory_entity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ملف الجهة غير موجود' USING errcode='P0002'; END IF;
  IF v_entity.public_visible IS NOT TRUE OR v_entity.verification_status<>'published' THEN
    RAISE EXCEPTION 'الملف غير منشور حاليًا؛ تواصل مع الإدارة' USING errcode='42501';
  END IF;

  IF EXISTS(
    SELECT 1 FROM jsonb_each(p_payload) x
    WHERE x.key IN ('name_ar','name_en','description','website_url','public_phone','public_email',
      'public_address','public_whatsapp','public_logo_url','public_business_hours')
      AND x.value<>'null'::jsonb AND jsonb_typeof(x.value) IS DISTINCT FROM 'string'
  ) THEN RAISE EXCEPTION 'بعض حقول الملف يجب أن تكون نصوصًا' USING errcode='22023'; END IF;

  IF p_payload ? 'name_ar' AND (
    jsonb_typeof(p_payload->'name_ar') IS DISTINCT FROM 'string'
    OR char_length(btrim(p_payload->>'name_ar')) NOT BETWEEN 2 AND 180
  ) THEN RAISE EXCEPTION 'اسم الجهة مطلوب من حرفين إلى 180 حرفًا' USING errcode='22023'; END IF;

  IF p_payload ? 'service_category' AND (
    jsonb_typeof(p_payload->'service_category') IS DISTINCT FROM 'string'
    OR NOT ((p_payload->>'service_category')=ANY(ARRAY[
      'contracting_construction','real_estate_marketing','real_estate_brokerage',
      'building_materials','finishing_decoration','furniture_furnishings',
      'engineering_design','maintenance_property_management','real_estate_consultancy',
      'real_estate_development','real_estate_sales','other_real_estate_services'
    ]::text[]))
  ) THEN
    RAISE EXCEPTION 'مجال الخدمة غير صحيح' USING errcode='22023';
  END IF;

  IF p_payload ? 'description' AND char_length(coalesce(p_payload->>'description',''))>2000 THEN
    RAISE EXCEPTION 'الوصف أطول من الحد المسموح' USING errcode='22023';
  END IF;

  IF p_payload ? 'website_url' AND nullif(btrim(p_payload->>'website_url'),'') IS NOT NULL
     AND NOT public.layan_is_http_url(p_payload->>'website_url') THEN
    RAISE EXCEPTION 'رابط الموقع غير صحيح' USING errcode='22023';
  END IF;
  IF p_payload ? 'public_logo_url' AND nullif(btrim(p_payload->>'public_logo_url'),'') IS NOT NULL
     AND NOT public.layan_is_http_url(p_payload->>'public_logo_url') THEN
    RAISE EXCEPTION 'رابط الشعار غير صحيح' USING errcode='22023';
  END IF;

  IF p_payload ? 'public_services' AND (
    jsonb_typeof(p_payload->'public_services') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_payload->'public_services')>50
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'public_services') AS item(value)
      WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'string' OR char_length(btrim(item.value #>> '{}')) NOT BETWEEN 1 AND 120)
  ) THEN RAISE EXCEPTION 'قائمة الخدمات غير صحيحة' USING errcode='22023'; END IF;

  IF p_payload ? 'public_coverage_areas' AND (
    jsonb_typeof(p_payload->'public_coverage_areas') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_payload->'public_coverage_areas')>50
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'public_coverage_areas') AS item(value)
      WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'string' OR char_length(btrim(item.value #>> '{}')) NOT BETWEEN 1 AND 120)
  ) THEN RAISE EXCEPTION 'قائمة مناطق التغطية غير صحيحة' USING errcode='22023'; END IF;

  IF p_payload ? 'public_gallery_urls' AND (
    jsonb_typeof(p_payload->'public_gallery_urls') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_payload->'public_gallery_urls')>20
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'public_gallery_urls') AS item(value)
      WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'string' OR NOT public.layan_is_http_url(item.value #>> '{}'))
  ) THEN RAISE EXCEPTION 'روابط معرض الأعمال غير صحيحة' USING errcode='22023'; END IF;

  IF EXISTS(SELECT 1 FROM jsonb_each(p_payload) x
    WHERE x.key IN ('public_phone','public_whatsapp') AND x.value<>'null'::jsonb
      AND char_length(regexp_replace(x.value #>> '{}','[^0-9]','','g')) NOT BETWEEN 7 AND 20
  ) THEN RAISE EXCEPTION 'راجع رقم الهاتف أو واتساب' USING errcode='22023'; END IF;

  INSERT INTO public.company_entity_profile_update_requests(directory_entity_id,requester_user_id,payload)
  VALUES(p_directory_entity_id,v_user,p_payload) RETURNING id INTO v_request;
  RETURN v_request;
END;
$function$;

CREATE OR REPLACE FUNCTION private.company_entity_profile_update_admin_list()
RETURNS TABLE(id uuid,directory_entity_id uuid,company_name text,entity_type text,
  service_category text,requester_user_id uuid,payload jsonb,status text,admin_notes text,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'قائمة تعديلات الملفات متاحة للإدارة فقط' USING errcode='42501';
  END IF;
  RETURN QUERY
  SELECT r.id,r.directory_entity_id,e.name_ar::text,e.entity_type::text,e.service_category::text,
         r.requester_user_id,r.payload,r.status,r.admin_notes,r.created_at
  FROM public.company_entity_profile_update_requests r
  JOIN public.directory_entities e ON e.id=r.directory_entity_id
  WHERE r.status='pending' ORDER BY r.created_at ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION private.company_entity_profile_update_admin_review(
  p_id uuid,p_action text,p_note text DEFAULT NULL
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_request public.company_entity_profile_update_requests%ROWTYPE;
  v_entity public.directory_entities%ROWTYPE;
  v_note text:=nullif(left(btrim(coalesce(p_note,'')),1000),'');
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح للإدارة فقط' USING errcode='42501';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('approve','request_changes','reject') THEN
    RAISE EXCEPTION 'الإجراء غير صحيح' USING errcode='22023';
  END IF;
  SELECT * INTO v_request FROM public.company_entity_profile_update_requests
   WHERE id=p_id AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'طلب التعديل غير موجود أو تم البت فيه' USING errcode='P0002'; END IF;
  IF p_action IN ('request_changes','reject') AND char_length(coalesce(v_note,''))<3 THEN
    RAISE EXCEPTION 'اكتب ملاحظة واضحة لا تقل عن 3 أحرف' USING errcode='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.company_entity_managers
    WHERE directory_entity_id=v_request.directory_entity_id AND owner_user_id=v_request.requester_user_id) THEN
    RAISE EXCEPTION 'مقدم الطلب لم يعد ممثلًا معتمدًا لهذا الملف' USING errcode='42501';
  END IF;

  IF p_action='approve' THEN
    SELECT * INTO v_entity FROM public.directory_entities
      WHERE id=v_request.directory_entity_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ملف الجهة غير موجود' USING errcode='P0002'; END IF;
    SELECT COALESCE(jsonb_object_agg(keys.key_name,to_jsonb(v_entity)->keys.key_name),'{}'::jsonb)
      INTO v_before FROM jsonb_object_keys(v_request.payload) AS keys(key_name);

    UPDATE public.directory_entities e SET
      name_ar=CASE WHEN v_request.payload?'name_ar' THEN v_request.payload->>'name_ar' ELSE e.name_ar END,
      name_en=CASE WHEN v_request.payload?'name_en' THEN nullif(v_request.payload->>'name_en','') ELSE e.name_en END,
      description=CASE WHEN v_request.payload?'description' THEN nullif(v_request.payload->>'description','') ELSE e.description END,
      website_url=CASE WHEN v_request.payload?'website_url' THEN nullif(v_request.payload->>'website_url','') ELSE e.website_url END,
      public_phone=CASE WHEN v_request.payload?'public_phone' THEN nullif(v_request.payload->>'public_phone','') ELSE e.public_phone END,
      public_email=CASE WHEN v_request.payload?'public_email' THEN nullif(v_request.payload->>'public_email','') ELSE e.public_email END,
      public_address=CASE WHEN v_request.payload?'public_address' THEN nullif(v_request.payload->>'public_address','') ELSE e.public_address END,
      service_category=CASE WHEN v_request.payload?'service_category' THEN v_request.payload->>'service_category' ELSE e.service_category END,
      public_whatsapp=CASE WHEN v_request.payload?'public_whatsapp' THEN nullif(v_request.payload->>'public_whatsapp','') ELSE e.public_whatsapp END,
      public_logo_url=CASE WHEN v_request.payload?'public_logo_url' THEN nullif(v_request.payload->>'public_logo_url','') ELSE e.public_logo_url END,
      public_business_hours=CASE WHEN v_request.payload?'public_business_hours' THEN nullif(v_request.payload->>'public_business_hours','') ELSE e.public_business_hours END,
      public_services=CASE WHEN v_request.payload?'public_services' THEN ARRAY(SELECT jsonb_array_elements_text(v_request.payload->'public_services')) ELSE e.public_services END,
      public_gallery_urls=CASE WHEN v_request.payload?'public_gallery_urls' THEN ARRAY(SELECT jsonb_array_elements_text(v_request.payload->'public_gallery_urls')) ELSE e.public_gallery_urls END,
      public_coverage_areas=CASE WHEN v_request.payload?'public_coverage_areas' THEN ARRAY(SELECT jsonb_array_elements_text(v_request.payload->'public_coverage_areas')) ELSE e.public_coverage_areas END,
      updated_at=now()
    WHERE e.id=v_request.directory_entity_id RETURNING to_jsonb(e) INTO v_after;

    INSERT INTO public.directory_change_log(table_name,record_id,changed_by,old_values,new_values,reason)
    VALUES('directory_entities',v_request.directory_entity_id,auth.uid(),v_before,
      (SELECT COALESCE(jsonb_object_agg(keys.key_name,v_after->keys.key_name),'{}'::jsonb)
       FROM jsonb_object_keys(v_request.payload) AS keys(key_name)),
      'اعتماد تعديل ملف جهة بعد استلامها');

    UPDATE public.company_entity_profile_update_requests
      SET status='approved',admin_notes=CASE WHEN v_note IS NULL THEN admin_notes ELSE v_note END,
          reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
      WHERE id=v_request.id;
    RETURN 'approved';
  ELSIF p_action='request_changes' THEN
    UPDATE public.company_entity_profile_update_requests
      SET status='needs_changes',admin_notes=v_note,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
      WHERE id=v_request.id;
    RETURN 'needs_changes';
  ELSE
    UPDATE public.company_entity_profile_update_requests
      SET status='rejected',admin_notes=v_note,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
      WHERE id=v_request.id;
    RETURN 'rejected';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.company_entity_profile_update_submit(p_directory_entity_id uuid,p_payload jsonb)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT private.company_entity_profile_update_submit(p_directory_entity_id,p_payload); $function$;

CREATE OR REPLACE FUNCTION public.company_entity_profile_update_admin_list()
RETURNS TABLE(id uuid,directory_entity_id uuid,company_name text,entity_type text,service_category text,
  requester_user_id uuid,payload jsonb,status text,admin_notes text,created_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT * FROM private.company_entity_profile_update_admin_list(); $function$;

CREATE OR REPLACE FUNCTION public.company_entity_profile_update_admin_review(p_id uuid,p_action text,p_note text DEFAULT NULL)
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT private.company_entity_profile_update_admin_review(p_id,p_action,p_note); $function$;

REVOKE ALL ON FUNCTION private.company_entity_profile_update_submit(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.company_entity_profile_update_admin_list() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.company_entity_profile_update_admin_review(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.company_entity_profile_update_submit(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.company_entity_profile_update_admin_list() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.company_entity_profile_update_admin_review(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.company_entity_profile_update_submit(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_entity_profile_update_admin_list() TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_entity_profile_update_admin_review(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_entity_profile_update_submit(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_entity_profile_update_admin_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_entity_profile_update_admin_review(uuid,text,text) TO authenticated;

-- Candidate service-provider files are created as private, unverified review records.
-- Public fields remain null and the source links are private until direct confirmation.
WITH candidates AS (
  SELECT * FROM jsonb_to_recordset($candidates$
  [
    {"slug":"aldoctor-ceramics-assiut","name_ar":"معارض الدكتور للسيراميك والبورسلين","entity_type":"other","service_category":"building_materials","source_code":"SP-20261114-ALDOCTOR","source_title":"الموقع الرسمي لمعارض الدكتور — الفروع","publisher":"معارض الدكتور","source_type":"الموقع الرسمي للشركة — مصدر اكتشاف","source_url":"https://aldoctorgroup.com/","confidence_level":"primary_company","internal_phone":"0882082702 / 0882374433 / 0882730960","internal_address":"فروع منشورة: سيتي/قلتة؛ شارع التحرير؛ طريق مطار أسيوط بجوار الحديقة الدولية؛ شارع 26 يوليو أمام مسجد المجاهدين.","notes":"أرقام الفروع والعناوين تحتاج إعادة تأكيد وموافقة الجهة."},
    {"slug":"cleopatra-ceramics-assiut-branch","name_ar":"سيراميكا كليوباترا — فرع أسيوط","entity_type":"other","service_category":"building_materials","source_code":"SP-20261114-CLEOPATRA","source_title":"نتيجة خرائط أعمال — سيراميكا كليوباترا أسيوط","publisher":"خرائط Google / دليل أعمال","source_type":"مصدر اكتشاف فقط","source_url":"https://www.google.com/maps/search/?api=1&query=%D8%B3%D9%8A%D8%B1%D8%A7%D9%85%D9%8A%D9%83%D8%A7+%D9%83%D9%84%D9%8A%D9%88%D8%A8%D8%A7%D8%AA%D8%B1%D8%A7+%D8%A3%D8%B3%D9%8A%D9%88%D8%B7","confidence_level":"business_directory","internal_phone":"0882286509","internal_address":"شارع الجمهورية، حي الفتح.","notes":"تأكيد تبعية المعرض للشركة مطلوب."},
    {"slug":"ideal-standard-showroom-assiut","name_ar":"إيديال ستاندرد — معرض أسيوط","entity_type":"other","service_category":"building_materials","source_code":"SP-20261114-IDEAL","source_title":"نتيجة خرائط أعمال — إيديال ستاندرد أسيوط","publisher":"خرائط Google / دليل أعمال","source_type":"مصدر اكتشاف فقط","source_url":"https://www.google.com/maps/search/?api=1&query=%D8%A5%D9%8A%D8%AF%D9%8A%D8%A7%D9%84+%D8%B3%D8%AA%D8%A7%D9%86%D8%AF%D8%B1%D8%AF+%D8%A3%D8%B3%D9%8A%D9%88%D8%B7","confidence_level":"business_directory","internal_phone":"01068782324","internal_address":"4 شارع الجمهورية، حي شرق.","notes":"لا يوصف الموزع بالمعتمد قبل إثبات ذلك."},
    {"slug":"rashad-rashdy-marcous-assiut","name_ar":"معرض رشاد رشدي مرقص للاستيراد والتصدير","entity_type":"other","service_category":"building_materials","source_code":"SP-20261114-RASHAD","source_title":"دليل أعمال — رشاد رشدي مرقص للاستيراد والتصدير","publisher":"Egypt Business","source_type":"دليل أعمال — مصدر اكتشاف","source_url":"https://www.egypt-business.com/company/details/Rashad-Roshdy-Marcous-for-Import--Export","confidence_level":"business_directory","internal_phone":"0882333493","internal_address":"28 شارع يسري راغب أمام إبراهيم باشا.","notes":"تأكد من استمرار النشاط وصحة البيانات."},
    {"slug":"kabbani-furniture-assiut","name_ar":"قباني للأثاث — أسيوط","entity_type":"other","service_category":"furniture_furnishings","source_code":"SP-20261114-KABBANI","source_title":"دليل أعمال — قباني للأثاث أسيوط","publisher":"BizMidEast","source_type":"دليل أعمال — مصدر اكتشاف","source_url":"https://www.bizmideast.com/EG/kabbani-furniture-asyut-%D9%82%D8%A8%D8%A7%D9%86%D9%89-%D9%84%D9%84%D8%A3%D8%AB%D8%A7%D8%AB-0100-784-8884","confidence_level":"business_directory","internal_phone":"01007848884 / 01010182266","internal_address":"30 شارع صلاح الدين الأيوبي المعروف بشارع النميس.","notes":"تأكيد أن البيانات تخص الفرع الحالي مطلوب."},
    {"slug":"smart-furniture-assiut","name_ar":"Smart Furniture — أسيوط","entity_type":"other","service_category":"furniture_furnishings","source_code":"SP-20261114-SMARTFURN","source_title":"نتيجة خرائط أعمال — Smart Furniture أسيوط","publisher":"خرائط Google / دليل أعمال","source_type":"مصدر اكتشاف فقط","source_url":"https://www.google.com/maps/search/?api=1&query=Smart+Furniture+Assiut","confidence_level":"business_directory","internal_phone":"01022222142","internal_address":"جسر الصليبة الحمراء، الحمرا الأولى.","notes":"تحقق من الاسم والعنوان والهاتف الحالي."},
    {"slug":"al-diyar-engineering-office-assiut","name_ar":"مكتب الديار الهندسي","entity_type":"consultant","service_category":"engineering_design","source_code":"SP-20261114-ALDIYAR","source_title":"دليل أعمال — مكتب الديار الهندسي","publisher":"BizMidEast","source_type":"دليل أعمال — مصدر اكتشاف","source_url":"https://www.bizmideast.com/EG/%D9%85%D9%83%D8%AA%D8%A8-%D8%A7%D9%84%D8%AF%D9%8A%D8%A7%D8%B1-%D8%A7%D9%84%D9%87%D9%86%D8%AF%D8%B3%D9%8A-0106-448-0023","confidence_level":"business_directory","internal_phone":"01064480023","internal_address":"برج طيبة، الحمرا الثانية / أسيوط 2.","notes":"تأكيد الخدمات والمؤهلات من المكتب نفسه."},
    {"slug":"george-essam-designs-assiut","name_ar":"George Essam Designs — جورج عصام ديزاينز","entity_type":"consultant","service_category":"finishing_decoration","source_code":"SP-20261114-GEORGE","source_title":"دليل يلوبيدجز — George Essam Designs","publisher":"Yellow Pages Egypt","source_type":"دليل أعمال — مصدر اكتشاف","source_url":"https://yellowpages.com.eg/ar/profile/%D8%AC%D9%88%D8%B1%D8%AC-%D8%B9%D8%B5%D8%A7%D9%85-%D8%AF%D9%8A%D8%B2%D8%A7%D9%8A%D9%86%D8%B2/704714","confidence_level":"business_directory","internal_phone":null,"internal_address":null,"notes":"الأدلة تعرض عنوانين متعارضين؛ لا ينشر عنوان أو هاتف قبل تأكيد الجهة."},
    {"slug":"al-rehab-hvac-assiut","name_ar":"شركة الرحاب للتكييف — أسيوط","entity_type":"other","service_category":"maintenance_property_management","source_code":"SP-20261114-REHABHVAC","source_title":"نتيجة خرائط أعمال — شركة الرحاب للتكييف أسيوط","publisher":"خرائط Google / دليل أعمال","source_type":"مصدر اكتشاف فقط","source_url":"https://www.google.com/maps/search/?api=1&query=%D8%B4%D8%B1%D9%83%D8%A9+%D8%A7%D9%84%D8%B1%D8%AD%D8%A7%D8%A8+%D9%84%D9%84%D8%AA%D9%83%D9%8A%D9%8A%D9%81+%D8%A3%D8%B3%D9%8A%D9%88%D8%B7","confidence_level":"business_directory","internal_phone":"01210037001","internal_address":"شارع الترعة، نطاق الإبراهيمية / الحمرا الثانية.","notes":"تأكيد نوع الخدمات التي تقدمها الجهة مطلوب."}
  ]
  $candidates$::jsonb) AS c(
    slug text,name_ar text,entity_type text,service_category text,
    source_code text,source_title text,publisher text,source_type text,
    source_url text,confidence_level text,internal_phone text,internal_address text,notes text
  )
),
saved_entities AS (
  INSERT INTO public.directory_entities(slug,name_ar,entity_type,service_category,verification_status,public_visible)
  SELECT slug,name_ar,entity_type,service_category,'needs_review',false FROM candidates
  ON CONFLICT(slug) DO UPDATE SET service_category=COALESCE(public.directory_entities.service_category,EXCLUDED.service_category)
  RETURNING id,slug
),
all_entities AS (
  SELECT saved.id,c.* FROM candidates c JOIN saved_entities saved ON saved.slug=c.slug
),
saved_sources AS (
  INSERT INTO public.directory_sources(source_code,title,publisher,source_type,source_url,confidence_level,is_public,notes)
  SELECT source_code,source_title,publisher,source_type,source_url,confidence_level,false,
    'مصدر اكتشاف داخلي فقط. لا يثبت الترخيص أو الشراكة أو استمرار النشاط.'
  FROM candidates
  ON CONFLICT(source_code) DO UPDATE SET source_code=EXCLUDED.source_code
  RETURNING id,source_code
)
INSERT INTO public.directory_entity_sources(entity_id,source_id,claim_key)
SELECT e.id,s.id,'service_provider_discovery'
FROM all_entities e JOIN saved_sources s ON s.source_code=e.source_code
ON CONFLICT(entity_id,source_id,claim_key) DO NOTHING;

WITH candidate_private AS (
  SELECT * FROM jsonb_to_recordset($candidate_private$
  [
    {"slug":"aldoctor-ceramics-assiut","internal_phone":"0882082702 / 0882374433 / 0882730960","internal_address":"سيتي/قلتة؛ شارع التحرير؛ طريق مطار أسيوط بجوار الحديقة الدولية؛ شارع 26 يوليو أمام مسجد المجاهدين.","confidence_level":"primary_company","notes":"مرشح أولي. أرقام الفروع والعناوين تحتاج تأكيدًا مباشرًا."},
    {"slug":"cleopatra-ceramics-assiut-branch","internal_phone":"0882286509","internal_address":"شارع الجمهورية، حي الفتح.","confidence_level":"business_directory","notes":"تأكيد تبعية الفرع مطلوب."},
    {"slug":"ideal-standard-showroom-assiut","internal_phone":"01068782324","internal_address":"4 شارع الجمهورية، حي شرق.","confidence_level":"business_directory","notes":"لا تستخدم وصف موزع معتمد دون إثبات."},
    {"slug":"rashad-rashdy-marcous-assiut","internal_phone":"0882333493","internal_address":"28 شارع يسري راغب أمام إبراهيم باشا.","confidence_level":"business_directory","notes":"تأكد من استمرار النشاط وصحة البيانات."},
    {"slug":"kabbani-furniture-assiut","internal_phone":"01007848884 / 01010182266","internal_address":"30 شارع صلاح الدين الأيوبي / شارع النميس.","confidence_level":"business_directory","notes":"تأكيد بيانات الفرع الحالي مطلوب."},
    {"slug":"smart-furniture-assiut","internal_phone":"01022222142","internal_address":"جسر الصليبة الحمراء، الحمرا الأولى.","confidence_level":"business_directory","notes":"تحقق من الاسم والعنوان والهاتف."},
    {"slug":"al-diyar-engineering-office-assiut","internal_phone":"01064480023","internal_address":"برج طيبة، الحمرا الثانية / أسيوط 2.","confidence_level":"business_directory","notes":"تأكيد الخدمات والمؤهلات مطلوب."},
    {"slug":"george-essam-designs-assiut","internal_phone":null,"internal_address":null,"confidence_level":"business_directory","notes":"الأدلة تعرض عنوانين متعارضين؛ لا تنشر بيانات الاتصال قبل التأكيد."},
    {"slug":"al-rehab-hvac-assiut","internal_phone":"01210037001","internal_address":"شارع الترعة، نطاق الإبراهيمية / الحمرا الثانية.","confidence_level":"business_directory","notes":"تأكيد نوع الخدمات مطلوب."}
  ]
  $candidate_private$::jsonb) AS c(slug text,internal_phone text,internal_address text,confidence_level text,notes text)
)
INSERT INTO public.directory_entity_private(entity_id,internal_address,internal_phone,verification_label,confidence_level,notes)
SELECT e.id,c.internal_address,c.internal_phone,'مرشح بحثي — غير معتمد للنشر',c.confidence_level,c.notes
FROM candidate_private c JOIN public.directory_entities e ON e.slug=c.slug
ON CONFLICT(entity_id) DO NOTHING;

COMMIT;
