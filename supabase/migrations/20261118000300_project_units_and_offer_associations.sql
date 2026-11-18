-- Phase 4: project units and explicitly reviewed property-ad associations.
-- This migration is staged on the feature branch only. It is NOT applied to production.

CREATE TABLE IF NOT EXISTS public.directory_project_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.directory_projects(id) ON DELETE CASCADE,
  unit_ref text NOT NULL CHECK (char_length(btrim(unit_ref)) BETWEEN 2 AND 100),
  unit_type text NOT NULL CHECK (unit_type IN ('apartment','villa','shop','office','clinic','land','other')),
  building_label text,
  floor_label text,
  unit_number text,
  area_m2 numeric CHECK (area_m2 IS NULL OR area_m2 BETWEEN 1 AND 1000000),
  bedrooms integer CHECK (bedrooms IS NULL OR bedrooms BETWEEN 0 AND 50),
  bathrooms integer CHECK (bathrooms IS NULL OR bathrooms BETWEEN 0 AND 50),
  finishing text,
  description text,
  verification_status text NOT NULL DEFAULT 'published' CHECK (verification_status IN ('published','archived')),
  public_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT directory_project_units_public_state CHECK (
    (verification_status = 'published' AND public_visible = true)
    OR (verification_status = 'archived' AND public_visible = false)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS directory_project_units_project_ref_unique
  ON public.directory_project_units (project_id, lower(btrim(unit_ref)));
CREATE INDEX IF NOT EXISTS directory_project_units_project_public_idx
  ON public.directory_project_units (project_id, verification_status, public_visible);

ALTER TABLE public.directory_project_units ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.directory_project_units FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.directory_project_units TO anon, authenticated;

DROP POLICY IF EXISTS directory_project_units_public_read ON public.directory_project_units;
CREATE POLICY directory_project_units_public_read
ON public.directory_project_units
FOR SELECT
TO anon, authenticated
USING (
  verification_status = 'published'
  AND public_visible = true
  AND EXISTS (
    SELECT 1
    FROM public.directory_projects p
    WHERE p.id = directory_project_units.project_id
      AND p.public_visible = true
      AND p.verification_status = 'published'
  )
);

ALTER TABLE public.property_offers
  ADD COLUMN IF NOT EXISTS project_unit_id uuid
  REFERENCES public.directory_project_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS property_offers_project_unit_idx
  ON public.property_offers (project_unit_id)
  WHERE project_unit_id IS NOT NULL;

-- Public offer creation must never be able to attach an unreviewed unit.
-- Only the administrator review RPC below can set this transaction-local flag.
CREATE OR REPLACE FUNCTION private.guard_property_offer_project_unit_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.project_unit_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.project_unit_id IS DISTINCT FROM OLD.project_unit_id
     AND current_setting('asyut.project_unit_link_review', true) IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'ربط الإعلان بوحدة مشروع يحتاج إلى مراجعة واعتماد إدارة أسيوط عقار'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS property_offers_project_unit_link_guard ON public.property_offers;
CREATE TRIGGER property_offers_project_unit_link_guard
BEFORE INSERT OR UPDATE OF project_unit_id ON public.property_offers
FOR EACH ROW EXECUTE FUNCTION private.guard_property_offer_project_unit_link();

CREATE TABLE IF NOT EXISTS private.company_project_unit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.directory_projects(id) ON DELETE RESTRICT,
  directory_entity_id uuid NOT NULL REFERENCES public.directory_entities(id) ON DELETE RESTRICT,
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  requester_role text NOT NULL CHECK (requester_role IN ('owner','manager')),
  unit_payload jsonb NOT NULL CHECK (jsonb_typeof(unit_payload) = 'object'),
  evidence_url text,
  evidence_description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','needs_changes','rejected','approved')),
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  resulting_unit_id uuid REFERENCES public.directory_project_units(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE private.company_project_unit_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.company_project_unit_requests FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS company_project_unit_requests_project_recent_idx
  ON private.company_project_unit_requests (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS company_project_unit_requests_entity_recent_idx
  ON private.company_project_unit_requests (directory_entity_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS company_project_unit_requests_pending_ref_unique
  ON private.company_project_unit_requests (
    project_id, lower(btrim(unit_payload->>'unit_ref'))
  )
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS private.property_offer_project_unit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id bigint NOT NULL REFERENCES public.property_offers(id) ON DELETE CASCADE,
  project_unit_id uuid NOT NULL REFERENCES public.directory_project_units(id) ON DELETE RESTRICT,
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  evidence_url text,
  evidence_description text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','needs_changes','rejected','approved')),
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE private.property_offer_project_unit_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.property_offer_project_unit_requests FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS property_offer_project_unit_requests_offer_recent_idx
  ON private.property_offer_project_unit_requests (offer_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS property_offer_project_unit_requests_pending_offer_unique
  ON private.property_offer_project_unit_requests (offer_id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION private.company_project_unit_request_submit(
  p_project_id uuid,
  p_unit_payload jsonb,
  p_evidence_url text DEFAULT NULL,
  p_evidence_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_entity_id uuid;
  v_access text;
  v_request_id uuid;
  v_url text := nullif(btrim(coalesce(p_evidence_url,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_description,'')),'');
  v_area numeric;
  v_bedrooms numeric;
  v_bathrooms numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'سجّل الدخول أولًا' USING ERRCODE='42501';
  END IF;

  IF p_unit_payload IS NULL
     OR jsonb_typeof(p_unit_payload) IS DISTINCT FROM 'object'
     OR octet_length(p_unit_payload::text) > 9000 THEN
    RAISE EXCEPTION 'بيانات الوحدة غير صحيحة أو أكبر من الحد المسموح' USING ERRCODE='22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_unit_payload) AS item(key_name)
    WHERE key_name <> ALL (ARRAY[
      'unit_ref','unit_type','building_label','floor_label','unit_number',
      'area_m2','bedrooms','bathrooms','finishing','description'
    ]::text[])
  ) THEN
    RAISE EXCEPTION 'يتضمن الطلب حقولًا غير مسموح بها' USING ERRCODE='22023';
  END IF;

  IF jsonb_typeof(p_unit_payload->'unit_ref') IS DISTINCT FROM 'string'
     OR char_length(btrim(coalesce(p_unit_payload->>'unit_ref',''))) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'اكتب كودًا أو وصفًا يميز الوحدة داخل المشروع (من حرفين إلى 100 حرف)' USING ERRCODE='22023';
  END IF;
  IF coalesce(p_unit_payload->>'unit_type','') NOT IN (
    'apartment','villa','shop','office','clinic','land','other'
  ) THEN
    RAISE EXCEPTION 'نوع الوحدة غير صحيح' USING ERRCODE='22023';
  END IF;

  IF p_unit_payload ? 'building_label'
     AND jsonb_typeof(p_unit_payload->'building_label') NOT IN ('string','null') THEN
    RAISE EXCEPTION 'بيان العمارة غير صحيح' USING ERRCODE='22023';
  END IF;
  IF char_length(coalesce(p_unit_payload->>'building_label','')) > 100 THEN
    RAISE EXCEPTION 'بيان العمارة أطول من الحد المسموح' USING ERRCODE='22023';
  END IF;
  IF p_unit_payload ? 'floor_label'
     AND jsonb_typeof(p_unit_payload->'floor_label') NOT IN ('string','null') THEN
    RAISE EXCEPTION 'بيان الدور غير صحيح' USING ERRCODE='22023';
  END IF;
  IF char_length(coalesce(p_unit_payload->>'floor_label','')) > 60 THEN
    RAISE EXCEPTION 'بيان الدور أطول من الحد المسموح' USING ERRCODE='22023';
  END IF;
  IF p_unit_payload ? 'unit_number'
     AND jsonb_typeof(p_unit_payload->'unit_number') NOT IN ('string','null') THEN
    RAISE EXCEPTION 'رقم الوحدة غير صحيح' USING ERRCODE='22023';
  END IF;
  IF char_length(coalesce(p_unit_payload->>'unit_number','')) > 60 THEN
    RAISE EXCEPTION 'رقم الوحدة أطول من الحد المسموح' USING ERRCODE='22023';
  END IF;
  IF p_unit_payload ? 'finishing'
     AND jsonb_typeof(p_unit_payload->'finishing') NOT IN ('string','null') THEN
    RAISE EXCEPTION 'بيان التشطيب غير صحيح' USING ERRCODE='22023';
  END IF;
  IF char_length(coalesce(p_unit_payload->>'finishing','')) > 100 THEN
    RAISE EXCEPTION 'بيان التشطيب أطول من الحد المسموح' USING ERRCODE='22023';
  END IF;
  IF p_unit_payload ? 'description'
     AND jsonb_typeof(p_unit_payload->'description') NOT IN ('string','null') THEN
    RAISE EXCEPTION 'وصف الوحدة غير صحيح' USING ERRCODE='22023';
  END IF;
  IF char_length(coalesce(p_unit_payload->>'description','')) > 1800 THEN
    RAISE EXCEPTION 'وصف الوحدة أطول من الحد المسموح' USING ERRCODE='22023';
  END IF;

  IF p_unit_payload ? 'area_m2' AND jsonb_typeof(p_unit_payload->'area_m2') NOT IN ('number','null') THEN
    RAISE EXCEPTION 'المساحة يجب أن تكون رقمًا' USING ERRCODE='22023';
  END IF;
  IF nullif(p_unit_payload->>'area_m2','') IS NOT NULL THEN
    v_area := (p_unit_payload->>'area_m2')::numeric;
    IF v_area < 1 OR v_area > 1000000 THEN
      RAISE EXCEPTION 'المساحة خارج النطاق المسموح' USING ERRCODE='22023';
    END IF;
  END IF;

  IF p_unit_payload ? 'bedrooms' AND jsonb_typeof(p_unit_payload->'bedrooms') NOT IN ('number','null') THEN
    RAISE EXCEPTION 'عدد الغرف يجب أن يكون رقمًا' USING ERRCODE='22023';
  END IF;
  IF nullif(p_unit_payload->>'bedrooms','') IS NOT NULL THEN
    v_bedrooms := (p_unit_payload->>'bedrooms')::numeric;
    IF v_bedrooms < 0 OR v_bedrooms > 50 OR v_bedrooms <> trunc(v_bedrooms) THEN
      RAISE EXCEPTION 'عدد الغرف خارج النطاق الصحيح' USING ERRCODE='22023';
    END IF;
  END IF;

  IF p_unit_payload ? 'bathrooms' AND jsonb_typeof(p_unit_payload->'bathrooms') NOT IN ('number','null') THEN
    RAISE EXCEPTION 'عدد الحمامات يجب أن يكون رقمًا' USING ERRCODE='22023';
  END IF;
  IF nullif(p_unit_payload->>'bathrooms','') IS NOT NULL THEN
    v_bathrooms := (p_unit_payload->>'bathrooms')::numeric;
    IF v_bathrooms < 0 OR v_bathrooms > 50 OR v_bathrooms <> trunc(v_bathrooms) THEN
      RAISE EXCEPTION 'عدد الحمامات خارج النطاق الصحيح' USING ERRCODE='22023';
    END IF;
  END IF;

  IF v_url IS NOT NULL AND (
    char_length(v_url) > 1000 OR v_url !~* '^https?://[^[:space:]]+$'
  ) THEN
    RAISE EXCEPTION 'رابط دليل الوحدة غير صحيح' USING ERRCODE='22023';
  END IF;
  IF v_url IS NULL AND char_length(coalesce(v_evidence,'')) < 6 THEN
    RAISE EXCEPTION 'أضف رابطًا عامًا أو وصفًا يوضح مستند أو مصدر بيانات الوحدة' USING ERRCODE='22023';
  END IF;
  IF char_length(coalesce(v_evidence,'')) > 1200 THEN
    RAISE EXCEPTION 'وصف دليل الوحدة أطول من الحد المسموح' USING ERRCODE='22023';
  END IF;

  SELECT pe.entity_id, private.company_entity_manager_access(pe.entity_id)
  INTO v_entity_id, v_access
  FROM public.directory_project_entities pe
  JOIN public.directory_entities e
    ON e.id = pe.entity_id
   AND e.public_visible = true
   AND e.verification_status = 'published'
  JOIN public.directory_projects p
    ON p.id = pe.project_id
   AND p.public_visible = true
   AND p.verification_status = 'published'
  WHERE pe.project_id = p_project_id
    AND pe.relation_type IN ('developer','land_owner')
    AND private.company_entity_manager_access(pe.entity_id) IN ('owner','manager')
  ORDER BY CASE WHEN pe.relation_type = 'developer' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_entity_id IS NULL OR v_access NOT IN ('owner','manager') THEN
    RAISE EXCEPTION 'إضافة الوحدات متاحة للمالك المعتمد أو مدير الملف المفوض لشركة مسجلة كمطور أو مالك أرض لهذا المشروع' USING ERRCODE='42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_project_id::text, 44));

  INSERT INTO private.company_project_unit_requests (
    project_id,directory_entity_id,requester_user_id,requester_role,
    unit_payload,evidence_url,evidence_description
  )
  VALUES (
    p_project_id,v_entity_id,v_user_id,v_access,p_unit_payload,v_url,v_evidence
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'يوجد طلب معلق للوحدة نفسها داخل هذا المشروع بالفعل' USING ERRCODE='23505';
END;
$function$;

CREATE OR REPLACE FUNCTION private.company_project_unit_requests_mine()
RETURNS TABLE (
  request_id uuid,
  project_id uuid,
  project_name text,
  directory_entity_id uuid,
  entity_name text,
  requester_role text,
  unit_payload jsonb,
  evidence_url text,
  evidence_description text,
  status text,
  admin_notes text,
  created_at timestamptz,
  resulting_unit_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'سجّل الدخول أولًا' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  SELECT r.id,r.project_id,p.name_ar,r.directory_entity_id,e.name_ar,
         r.requester_role,r.unit_payload,r.evidence_url,r.evidence_description,
         r.status,r.admin_notes,r.created_at,r.resulting_unit_id
  FROM private.company_project_unit_requests r
  JOIN public.directory_projects p ON p.id=r.project_id
  JOIN public.directory_entities e ON e.id=r.directory_entity_id
  WHERE r.requester_user_id=auth.uid()
     OR private.company_entity_manager_access(r.directory_entity_id) IN ('owner','manager')
  ORDER BY r.created_at DESC
  LIMIT 200;
END;
$function$;

CREATE OR REPLACE FUNCTION private.property_offer_project_unit_request_submit(
  p_offer_id bigint,
  p_project_unit_id uuid,
  p_evidence_url text DEFAULT NULL,
  p_evidence_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_request_id uuid;
  v_url text := nullif(btrim(coalesce(p_evidence_url,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_description,'')),'');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'سجّل الدخول أولًا' USING ERRCODE='42501';
  END IF;
  IF char_length(coalesce(v_evidence,'')) NOT BETWEEN 6 AND 1200 THEN
    RAISE EXCEPTION 'اكتب وصفًا لا يقل عن 6 أحرف يوضح سبب ربط الإعلان بهذه الوحدة' USING ERRCODE='22023';
  END IF;
  IF v_url IS NOT NULL AND (
    char_length(v_url) > 1000 OR v_url !~* '^https?://[^[:space:]]+$'
  ) THEN
    RAISE EXCEPTION 'رابط الدليل غير صحيح' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.property_offers o
    WHERE o.id=p_offer_id
      AND o.owner_id=v_user_id
      AND o.status='available'
      AND o.project_unit_id IS NULL
  ) THEN
    RAISE EXCEPTION 'يمكن طلب ربط إعلان منشور ومتاح تملكه فقط، ويجب ألا يكون مرتبطًا بوحدة من قبل' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.directory_project_units u
    JOIN public.directory_projects p
      ON p.id=u.project_id
     AND p.public_visible=true
     AND p.verification_status='published'
    WHERE u.id=p_project_unit_id
      AND u.public_visible=true
      AND u.verification_status='published'
  ) THEN
    RAISE EXCEPTION 'اختر وحدة منشورة داخل مشروع منشور ومعتمد' USING ERRCODE='22023';
  END IF;

  INSERT INTO private.property_offer_project_unit_requests (
    offer_id,project_unit_id,requester_user_id,evidence_url,evidence_description
  )
  VALUES (p_offer_id,p_project_unit_id,v_user_id,v_url,v_evidence)
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'يوجد طلب ربط معلق لهذا الإعلان بالفعل' USING ERRCODE='23505';
END;
$function$;

CREATE OR REPLACE FUNCTION private.property_offer_project_unit_requests_mine()
RETURNS TABLE (
  request_id uuid,
  offer_id bigint,
  offer_title text,
  project_unit_id uuid,
  unit_ref text,
  project_id uuid,
  project_name text,
  status text,
  admin_notes text,
  created_at timestamptz,
  linked_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'سجّل الدخول أولًا' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  SELECT r.id,r.offer_id,o.title,r.project_unit_id,u.unit_ref,u.project_id,p.name_ar,
         r.status,r.admin_notes,r.created_at,
         CASE WHEN r.status='approved' THEN r.reviewed_at ELSE NULL END
  FROM private.property_offer_project_unit_requests r
  JOIN public.property_offers o ON o.id=r.offer_id AND o.owner_id=auth.uid()
  JOIN public.directory_project_units u ON u.id=r.project_unit_id
  JOIN public.directory_projects p ON p.id=u.project_id
  WHERE r.requester_user_id=auth.uid()
  ORDER BY r.created_at DESC
  LIMIT 200;
END;
$function$;

CREATE OR REPLACE FUNCTION private.company_project_unit_request_admin_list()
RETURNS TABLE (
  request_id uuid,
  project_id uuid,
  project_name text,
  directory_entity_id uuid,
  entity_name text,
  requester_user_id uuid,
  requester_role text,
  unit_payload jsonb,
  evidence_url text,
  evidence_description text,
  status text,
  admin_notes text,
  created_at timestamptz,
  resulting_unit_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذه القائمة متاحة لإدارة أسيوط عقار فقط' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  SELECT r.id,r.project_id,p.name_ar,r.directory_entity_id,e.name_ar,
         r.requester_user_id,r.requester_role,r.unit_payload,r.evidence_url,
         r.evidence_description,r.status,r.admin_notes,r.created_at,r.resulting_unit_id
  FROM private.company_project_unit_requests r
  JOIN public.directory_projects p ON p.id=r.project_id
  JOIN public.directory_entities e ON e.id=r.directory_entity_id
  ORDER BY (r.status='pending') DESC,r.created_at DESC
  LIMIT 250;
END;
$function$;

CREATE OR REPLACE FUNCTION private.company_project_unit_request_admin_review(
  p_request_id uuid,
  p_action text,
  p_admin_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_request private.company_project_unit_requests%ROWTYPE;
  v_notes text := nullif(left(btrim(coalesce(p_admin_notes,'')),1200),'');
  v_unit_id uuid;
  v_payload jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'غير مسموح؛ يلزم حساب إدارة معتمد' USING ERRCODE='42501';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('approve','needs_changes','reject') THEN
    RAISE EXCEPTION 'قرار المراجعة غير صحيح' USING ERRCODE='22023';
  END IF;
  IF p_action IN ('needs_changes','reject') AND char_length(coalesce(v_notes,'')) < 3 THEN
    RAISE EXCEPTION 'اكتب ملاحظة واضحة لصاحب الطلب' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_request
  FROM private.company_project_unit_requests
  WHERE id=p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'طلب الوحدة غير موجود'; END IF;
  IF v_request.status <> 'pending' THEN RAISE EXCEPTION 'تمت مراجعة هذا الطلب بالفعل'; END IF;

  IF p_action='needs_changes' THEN
    UPDATE private.company_project_unit_requests
    SET status='needs_changes',admin_notes=v_notes,reviewed_by=auth.uid(),
        reviewed_at=now(),updated_at=now()
    WHERE id=p_request_id;
    RETURN NULL;
  ELSIF p_action='reject' THEN
    UPDATE private.company_project_unit_requests
    SET status='rejected',admin_notes=v_notes,reviewed_by=auth.uid(),
        reviewed_at=now(),updated_at=now()
    WHERE id=p_request_id;
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.directory_projects p
    WHERE p.id=v_request.project_id
      AND p.public_visible=true AND p.verification_status='published'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.directory_project_entities pe
    WHERE pe.project_id=v_request.project_id
      AND pe.entity_id=v_request.directory_entity_id
      AND pe.relation_type IN ('developer','land_owner')
  ) OR NOT EXISTS (
    SELECT 1 FROM public.directory_entities e
    WHERE e.id=v_request.directory_entity_id
      AND e.public_visible=true AND e.verification_status='published'
  ) THEN
    RAISE EXCEPTION 'لم تعد علاقة الشركة بالمشروع صالحة للنشر؛ راجع ملف المشروع والشركة';
  END IF;

  v_payload:=v_request.unit_payload;
  INSERT INTO public.directory_project_units (
    project_id,unit_ref,unit_type,building_label,floor_label,unit_number,
    area_m2,bedrooms,bathrooms,finishing,description,
    verification_status,public_visible
  )
  VALUES (
    v_request.project_id,
    btrim(v_payload->>'unit_ref'),
    v_payload->>'unit_type',
    nullif(btrim(v_payload->>'building_label'),''),
    nullif(btrim(v_payload->>'floor_label'),''),
    nullif(btrim(v_payload->>'unit_number'),''),
    nullif(v_payload->>'area_m2','')::numeric,
    nullif(v_payload->>'bedrooms','')::numeric::integer,
    nullif(v_payload->>'bathrooms','')::numeric::integer,
    nullif(btrim(v_payload->>'finishing'),''),
    nullif(btrim(v_payload->>'description'),''),
    'published',true
  )
  RETURNING id INTO v_unit_id;

  UPDATE private.company_project_unit_requests
  SET status='approved',admin_notes=v_notes,reviewed_by=auth.uid(),
      reviewed_at=now(),resulting_unit_id=v_unit_id,updated_at=now()
  WHERE id=p_request_id;

  RETURN v_unit_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'يوجد سجل وحدة منشور بالمرجع نفسه داخل المشروع؛ راجع السجل قبل اعتماد الطلب' USING ERRCODE='23505';
END;
$function$;

CREATE OR REPLACE FUNCTION private.property_offer_project_unit_request_admin_list()
RETURNS TABLE (
  request_id uuid,
  offer_id bigint,
  offer_title text,
  offer_owner_id uuid,
  project_unit_id uuid,
  unit_ref text,
  project_id uuid,
  project_name text,
  evidence_url text,
  evidence_description text,
  status text,
  admin_notes text,
  requester_user_id uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذه القائمة متاحة لإدارة أسيوط عقار فقط' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  SELECT r.id,r.offer_id,o.title,o.owner_id,r.project_unit_id,u.unit_ref,
         u.project_id,p.name_ar,r.evidence_url,r.evidence_description,
         r.status,r.admin_notes,r.requester_user_id,r.created_at
  FROM private.property_offer_project_unit_requests r
  JOIN public.property_offers o ON o.id=r.offer_id
  JOIN public.directory_project_units u ON u.id=r.project_unit_id
  JOIN public.directory_projects p ON p.id=u.project_id
  ORDER BY (r.status='pending') DESC,r.created_at DESC
  LIMIT 250;
END;
$function$;

CREATE OR REPLACE FUNCTION private.property_offer_project_unit_request_admin_review(
  p_request_id uuid,
  p_action text,
  p_admin_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_request private.property_offer_project_unit_requests%ROWTYPE;
  v_notes text := nullif(left(btrim(coalesce(p_admin_notes,'')),1200),'');
  v_offer public.property_offers%ROWTYPE;
  v_unit public.directory_project_units%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'غير مسموح؛ يلزم حساب إدارة معتمد' USING ERRCODE='42501';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('approve','needs_changes','reject') THEN
    RAISE EXCEPTION 'قرار المراجعة غير صحيح' USING ERRCODE='22023';
  END IF;
  IF p_action IN ('needs_changes','reject') AND char_length(coalesce(v_notes,'')) < 3 THEN
    RAISE EXCEPTION 'اكتب ملاحظة واضحة لصاحب الإعلان' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_request
  FROM private.property_offer_project_unit_requests
  WHERE id=p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'طلب ربط الإعلان بالوحدة غير موجود'; END IF;
  IF v_request.status <> 'pending' THEN RAISE EXCEPTION 'تمت مراجعة هذا الطلب بالفعل'; END IF;

  IF p_action='needs_changes' THEN
    UPDATE private.property_offer_project_unit_requests
    SET status='needs_changes',admin_notes=v_notes,reviewed_by=auth.uid(),
        reviewed_at=now(),updated_at=now()
    WHERE id=p_request_id;
    RETURN NULL;
  ELSIF p_action='reject' THEN
    UPDATE private.property_offer_project_unit_requests
    SET status='rejected',admin_notes=v_notes,reviewed_by=auth.uid(),
        reviewed_at=now(),updated_at=now()
    WHERE id=p_request_id;
    RETURN NULL;
  END IF;

  SELECT * INTO v_offer FROM public.property_offers
  WHERE id=v_request.offer_id FOR UPDATE;
  IF NOT FOUND OR v_offer.owner_id IS DISTINCT FROM v_request.requester_user_id
     OR v_offer.status <> 'available' OR v_offer.project_unit_id IS NOT NULL THEN
    RAISE EXCEPTION 'الإعلان لم يعد متاحًا للربط أو تغير مالكه/حالة نشره';
  END IF;

  SELECT * INTO v_unit FROM public.directory_project_units
  WHERE id=v_request.project_unit_id FOR SHARE;
  IF NOT FOUND OR v_unit.public_visible IS DISTINCT FROM true
     OR v_unit.verification_status <> 'published'
     OR NOT EXISTS (
       SELECT 1 FROM public.directory_projects p
       WHERE p.id=v_unit.project_id AND p.public_visible=true
         AND p.verification_status='published'
     ) THEN
    RAISE EXCEPTION 'الوحدة أو المشروع لم يعد منشورًا؛ لا يمكن اعتماد الربط';
  END IF;

  PERFORM set_config('asyut.project_unit_link_review','approved',true);
  UPDATE public.property_offers
  SET project_unit_id=v_unit.id,updated_at=now()
  WHERE id=v_offer.id AND project_unit_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'تعذر ربط الإعلان؛ ربما تم ربطه بطلب آخر';
  END IF;

  UPDATE private.property_offer_project_unit_requests
  SET status='approved',admin_notes=v_notes,reviewed_by=auth.uid(),
      reviewed_at=now(),updated_at=now()
  WHERE id=p_request_id;

  RETURN v_unit.id;
END;
$function$;

-- Public wrappers are SECURITY INVOKER; authorization and privileged writes remain in private functions.
CREATE OR REPLACE FUNCTION public.company_project_unit_request_submit(
  p_project_id uuid,
  p_unit_payload jsonb,
  p_evidence_url text DEFAULT NULL,
  p_evidence_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.company_project_unit_request_submit(
    p_project_id,p_unit_payload,p_evidence_url,p_evidence_description
  );
$function$;

CREATE OR REPLACE FUNCTION public.company_project_unit_requests_mine()
RETURNS TABLE (
  request_id uuid,project_id uuid,project_name text,directory_entity_id uuid,
  entity_name text,requester_role text,unit_payload jsonb,evidence_url text,
  evidence_description text,status text,admin_notes text,created_at timestamptz,
  resulting_unit_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT * FROM private.company_project_unit_requests_mine();
$function$;

CREATE OR REPLACE FUNCTION public.property_offer_project_unit_request_submit(
  p_offer_id bigint,p_project_unit_id uuid,
  p_evidence_url text DEFAULT NULL,p_evidence_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.property_offer_project_unit_request_submit(
    p_offer_id,p_project_unit_id,p_evidence_url,p_evidence_description
  );
$function$;

CREATE OR REPLACE FUNCTION public.property_offer_project_unit_requests_mine()
RETURNS TABLE (
  request_id uuid,offer_id bigint,offer_title text,project_unit_id uuid,
  unit_ref text,project_id uuid,project_name text,status text,admin_notes text,
  created_at timestamptz,linked_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT * FROM private.property_offer_project_unit_requests_mine();
$function$;

CREATE OR REPLACE FUNCTION public.company_project_unit_request_admin_list()
RETURNS TABLE (
  request_id uuid,project_id uuid,project_name text,directory_entity_id uuid,
  entity_name text,requester_user_id uuid,requester_role text,unit_payload jsonb,
  evidence_url text,evidence_description text,status text,admin_notes text,
  created_at timestamptz,resulting_unit_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT * FROM private.company_project_unit_request_admin_list();
$function$;

CREATE OR REPLACE FUNCTION public.company_project_unit_request_admin_review(
  p_request_id uuid,p_action text,p_admin_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.company_project_unit_request_admin_review(
    p_request_id,p_action,p_admin_notes
  );
$function$;

CREATE OR REPLACE FUNCTION public.property_offer_project_unit_request_admin_list()
RETURNS TABLE (
  request_id uuid,offer_id bigint,offer_title text,offer_owner_id uuid,
  project_unit_id uuid,unit_ref text,project_id uuid,project_name text,
  evidence_url text,evidence_description text,status text,admin_notes text,
  requester_user_id uuid,created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT * FROM private.property_offer_project_unit_request_admin_list();
$function$;

CREATE OR REPLACE FUNCTION public.property_offer_project_unit_request_admin_review(
  p_request_id uuid,p_action text,p_admin_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.property_offer_project_unit_request_admin_review(
    p_request_id,p_action,p_admin_notes
  );
$function$;

REVOKE ALL ON FUNCTION private.company_project_unit_request_submit(uuid,jsonb,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.company_project_unit_requests_mine() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.property_offer_project_unit_request_submit(bigint,uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.property_offer_project_unit_requests_mine() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.company_project_unit_request_admin_list() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.company_project_unit_request_admin_review(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.property_offer_project_unit_request_admin_list() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.property_offer_project_unit_request_admin_review(uuid,text,text) FROM PUBLIC,anon;

REVOKE ALL ON FUNCTION public.company_project_unit_request_submit(uuid,jsonb,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.company_project_unit_requests_mine() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.property_offer_project_unit_request_submit(bigint,uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.property_offer_project_unit_requests_mine() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.company_project_unit_request_admin_list() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.company_project_unit_request_admin_review(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.property_offer_project_unit_request_admin_list() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.property_offer_project_unit_request_admin_review(uuid,text,text) FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION private.company_project_unit_request_submit(uuid,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_project_unit_requests_mine() TO authenticated;
GRANT EXECUTE ON FUNCTION private.property_offer_project_unit_request_submit(bigint,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.property_offer_project_unit_requests_mine() TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_project_unit_request_admin_list() TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_project_unit_request_admin_review(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.property_offer_project_unit_request_admin_list() TO authenticated;
GRANT EXECUTE ON FUNCTION private.property_offer_project_unit_request_admin_review(uuid,text,text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.company_project_unit_request_submit(uuid,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_project_unit_requests_mine() TO authenticated;
GRANT EXECUTE ON FUNCTION public.property_offer_project_unit_request_submit(bigint,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.property_offer_project_unit_requests_mine() TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_project_unit_request_admin_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_project_unit_request_admin_review(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.property_offer_project_unit_request_admin_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.property_offer_project_unit_request_admin_review(uuid,text,text) TO authenticated;

COMMENT ON TABLE public.directory_project_units IS
  'Publicly readable unit records created only after administrator approval of a verified developer/land-owner company request.';
COMMENT ON TABLE private.company_project_unit_requests IS
  'Private requests from verified developer/land-owner company representatives to add a project unit; administrator approval publishes the unit.';
COMMENT ON TABLE private.property_offer_project_unit_requests IS
  'Private owner requests to associate an existing available property offer with a public project unit; only administrator review can set property_offers.project_unit_id.';
COMMENT ON COLUMN public.property_offers.project_unit_id IS
  'Nullable explicit FK to a reviewed public project unit. Legacy offers remain NULL; no name-based backfill or automatic association is performed.';
