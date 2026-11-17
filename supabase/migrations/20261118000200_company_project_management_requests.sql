-- Phase 3: company-submitted project requests with administrator review.
-- This migration is intentionally committed to the feature branch only. Do not apply to production
-- until the migration, UI, and isolated-database tests have been reviewed and approved.

CREATE TABLE IF NOT EXISTS private.company_project_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_entity_id uuid NOT NULL REFERENCES public.directory_entities(id) ON DELETE RESTRICT,
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  requester_role text NOT NULL CHECK (requester_role IN ('owner','manager')),
  request_type text NOT NULL CHECK (request_type IN ('new_project','link_project')),
  project_id uuid REFERENCES public.directory_projects(id) ON DELETE RESTRICT,
  project_payload jsonb,
  requested_relation_type text NOT NULL CHECK (
    requested_relation_type IN (
      'developer','land_owner','marketing_agent','sales_agent',
      'contractor','consultant','operator','public_authority','other'
    )
  ),
  evidence_url text,
  evidence_description text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','needs_changes','rejected','approved')
  ),
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  resulting_project_id uuid REFERENCES public.directory_projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_project_requests_payload_shape CHECK (
    (request_type = 'new_project' AND project_id IS NULL AND project_payload IS NOT NULL)
    OR
    (request_type = 'link_project' AND project_id IS NOT NULL AND project_payload IS NULL)
  )
);

ALTER TABLE private.company_project_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.company_project_requests FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE INDEX IF NOT EXISTS company_project_requests_entity_recent_idx
  ON private.company_project_requests (directory_entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS company_project_requests_requester_recent_idx
  ON private.company_project_requests (requester_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS company_project_requests_pending_link_unique
  ON private.company_project_requests (directory_entity_id, project_id, requested_relation_type)
  WHERE status = 'pending' AND request_type = 'link_project';
CREATE UNIQUE INDEX IF NOT EXISTS company_project_requests_pending_create_unique
  ON private.company_project_requests (directory_entity_id, lower(project_payload->>'name_ar'))
  WHERE status = 'pending' AND request_type = 'new_project';

CREATE OR REPLACE FUNCTION private.company_project_request_submit(
  p_directory_entity_id uuid,
  p_request_type text,
  p_project_id uuid DEFAULT NULL,
  p_project_payload jsonb DEFAULT NULL,
  p_relation_type text DEFAULT NULL,
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
  v_access text;
  v_entity_ok boolean;
  v_url text := nullif(btrim(coalesce(p_evidence_url,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_description,'')),'');
  v_area_id uuid;
  v_size_value numeric;
  v_unit_count numeric;
  v_request_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'سجّل الدخول أولًا' USING ERRCODE='42501';
  END IF;

  v_access := private.company_entity_manager_access(p_directory_entity_id);
  IF v_access NOT IN ('owner','manager') THEN
    RAISE EXCEPTION 'إرسال طلبات المشروعات متاح للمالك أو مدير الملف المفوض بعد التحقق فقط' USING ERRCODE='42501';
  END IF;

  SELECT true INTO v_entity_ok
  FROM public.directory_entities e
  WHERE e.id = p_directory_entity_id
    AND e.public_visible = true
    AND e.verification_status = 'published'
  FOR SHARE;
  IF NOT coalesce(v_entity_ok,false) THEN
    RAISE EXCEPTION 'يجب أن يكون ملف الشركة منشورًا ومعتمدًا قبل طلب إدارة مشروعاته' USING ERRCODE='42501';
  END IF;

  IF p_relation_type IS NULL OR p_relation_type NOT IN (
    'developer','land_owner','marketing_agent','sales_agent',
    'contractor','consultant','operator','public_authority','other'
  ) THEN
    RAISE EXCEPTION 'اختر صفة صحيحة للشركة داخل المشروع' USING ERRCODE='22023';
  END IF;

  IF v_url IS NOT NULL AND (
    char_length(v_url) > 1000 OR v_url !~* '^https?://[^[:space:]]+$'
  ) THEN
    RAISE EXCEPTION 'رابط دليل العلاقة غير صحيح' USING ERRCODE='22023';
  END IF;
  IF v_evidence IS NOT NULL AND char_length(v_evidence) > 1200 THEN
    RAISE EXCEPTION 'وصف دليل العلاقة أطول من الحد المسموح' USING ERRCODE='22023';
  END IF;
  IF v_url IS NULL AND char_length(coalesce(v_evidence,'')) < 6 THEN
    RAISE EXCEPTION 'أضف رابطًا عامًا أو وصفًا يوضح دليل علاقة الشركة بالمشروع' USING ERRCODE='22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_directory_entity_id::text, 31));

  IF p_request_type = 'new_project' THEN
    IF p_project_id IS NOT NULL OR p_project_payload IS NULL
       OR jsonb_typeof(p_project_payload) IS DISTINCT FROM 'object'
       OR p_project_payload = '{}'::jsonb
       OR octet_length(p_project_payload::text) > 12000 THEN
      RAISE EXCEPTION 'بيانات المشروع الجديد غير مكتملة أو غير صحيحة' USING ERRCODE='22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_object_keys(p_project_payload) AS item(key_name)
      WHERE key_name <> ALL (ARRAY[
        'name_ar','name_en','project_type','description','project_status',
        'area_id','location_text','size_value','size_unit','unit_count'
      ]::text[])
    ) THEN
      RAISE EXCEPTION 'يتضمن الطلب حقولًا غير مسموح بها' USING ERRCODE='22023';
    END IF;

    IF jsonb_typeof(p_project_payload->'name_ar') IS DISTINCT FROM 'string'
       OR char_length(btrim(coalesce(p_project_payload->>'name_ar',''))) NOT BETWEEN 2 AND 180 THEN
      RAISE EXCEPTION 'اسم المشروع بالعربية مطلوب (من حرفين إلى 180 حرفًا)' USING ERRCODE='22023';
    END IF;
    IF p_project_payload ? 'name_en'
       AND jsonb_typeof(p_project_payload->'name_en') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'اسم المشروع باللغة الإنجليزية غير صحيح' USING ERRCODE='22023';
    END IF;
    IF char_length(coalesce(p_project_payload->>'name_en','')) > 160 THEN
      RAISE EXCEPTION 'اسم المشروع باللغة الإنجليزية أطول من الحد المسموح' USING ERRCODE='22023';
    END IF;

    IF coalesce(p_project_payload->>'project_type','') NOT IN (
      'residential','commercial','administrative','medical','educational',
      'mixed_use','land','service','other'
    ) THEN
      RAISE EXCEPTION 'نوع المشروع غير صحيح' USING ERRCODE='22023';
    END IF;
    IF coalesce(p_project_payload->>'project_status','unknown') NOT IN (
      'announced','planned','under_construction','partially_delivered',
      'completed','operating','stalled','unknown'
    ) THEN
      RAISE EXCEPTION 'حالة المشروع غير صحيحة' USING ERRCODE='22023';
    END IF;
    IF p_project_payload ? 'description'
       AND jsonb_typeof(p_project_payload->'description') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'وصف المشروع غير صحيح' USING ERRCODE='22023';
    END IF;
    IF char_length(coalesce(p_project_payload->>'description','')) > 3000 THEN
      RAISE EXCEPTION 'وصف المشروع أطول من الحد المسموح' USING ERRCODE='22023';
    END IF;
    IF p_project_payload ? 'location_text'
       AND jsonb_typeof(p_project_payload->'location_text') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'وصف الموقع غير صحيح' USING ERRCODE='22023';
    END IF;
    IF char_length(coalesce(p_project_payload->>'location_text','')) > 300 THEN
      RAISE EXCEPTION 'وصف الموقع أطول من الحد المسموح' USING ERRCODE='22023';
    END IF;
    IF p_project_payload ? 'size_unit'
       AND jsonb_typeof(p_project_payload->'size_unit') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'وحدة قياس المساحة غير صحيحة' USING ERRCODE='22023';
    END IF;
    IF char_length(coalesce(p_project_payload->>'size_unit','')) > 30 THEN
      RAISE EXCEPTION 'وحدة قياس المساحة أطول من الحد المسموح' USING ERRCODE='22023';
    END IF;

    IF p_project_payload ? 'area_id' THEN
      IF jsonb_typeof(p_project_payload->'area_id') NOT IN ('string','null') THEN
        RAISE EXCEPTION 'المنطقة المحددة غير صحيحة' USING ERRCODE='22023';
      END IF;
      v_area_id := nullif(p_project_payload->>'area_id','')::uuid;
      IF v_area_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.directory_areas a
        WHERE a.id = v_area_id
          AND a.is_active = true
          AND a.public_visible = true
          AND a.verification_status = 'published'
      ) THEN
        RAISE EXCEPTION 'اختر منطقة منشورة من دليل أسيوط' USING ERRCODE='22023';
      END IF;
    END IF;

    IF p_project_payload ? 'size_value' AND jsonb_typeof(p_project_payload->'size_value') NOT IN ('number','null') THEN
      RAISE EXCEPTION 'المساحة يجب أن تكون رقمًا' USING ERRCODE='22023';
    END IF;
    IF nullif(p_project_payload->>'size_value','') IS NOT NULL THEN
      v_size_value := (p_project_payload->>'size_value')::numeric;
      IF v_size_value < 0 OR v_size_value > 100000000 THEN
        RAISE EXCEPTION 'المساحة خارج النطاق المسموح' USING ERRCODE='22023';
      END IF;
    END IF;

    IF p_project_payload ? 'unit_count' AND jsonb_typeof(p_project_payload->'unit_count') NOT IN ('number','null') THEN
      RAISE EXCEPTION 'عدد الوحدات يجب أن يكون رقمًا صحيحًا' USING ERRCODE='22023';
    END IF;
    IF nullif(p_project_payload->>'unit_count','') IS NOT NULL THEN
      v_unit_count := (p_project_payload->>'unit_count')::numeric;
      IF v_unit_count < 0 OR v_unit_count > 1000000 OR v_unit_count <> trunc(v_unit_count) THEN
        RAISE EXCEPTION 'عدد الوحدات خارج النطاق الصحيح' USING ERRCODE='22023';
      END IF;
    END IF;

  ELSIF p_request_type = 'link_project' THEN
    IF p_project_id IS NULL OR p_project_payload IS NOT NULL THEN
      RAISE EXCEPTION 'اختر مشروعًا منشورًا لطلب ربط الشركة به' USING ERRCODE='22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.directory_projects p
      WHERE p.id = p_project_id
        AND p.public_visible = true
        AND p.verification_status = 'published'
    ) THEN
      RAISE EXCEPTION 'يمكن طلب الربط بمشروع منشور ومعتمد فقط' USING ERRCODE='22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.directory_project_entities r
      WHERE r.project_id = p_project_id
        AND r.entity_id = p_directory_entity_id
        AND r.relation_type = p_relation_type
    ) THEN
      RAISE EXCEPTION 'هذه العلاقة مسجلة بالفعل في ملف المشروع' USING ERRCODE='23505';
    END IF;
  ELSE
    RAISE EXCEPTION 'نوع الطلب غير صحيح' USING ERRCODE='22023';
  END IF;

  INSERT INTO private.company_project_requests (
    directory_entity_id, requester_user_id, requester_role, request_type,
    project_id, project_payload, requested_relation_type,
    evidence_url, evidence_description
  )
  VALUES (
    p_directory_entity_id, v_user_id, v_access, p_request_type,
    p_project_id, p_project_payload, p_relation_type,
    v_url, v_evidence
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'يوجد طلب مماثل قيد مراجعة الإدارة بالفعل' USING ERRCODE='23505';
END;
$function$;

CREATE OR REPLACE FUNCTION private.company_project_requests_mine()
RETURNS TABLE (
  request_id uuid,
  directory_entity_id uuid,
  entity_name text,
  request_type text,
  project_id uuid,
  project_name text,
  project_payload jsonb,
  requested_relation_type text,
  evidence_url text,
  evidence_description text,
  status text,
  admin_notes text,
  reviewed_at timestamptz,
  created_at timestamptz,
  resulting_project_id uuid
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
  SELECT
    r.id, r.directory_entity_id, e.name_ar, r.request_type, r.project_id,
    coalesce(p.name_ar, r.project_payload->>'name_ar'),
    r.project_payload, r.requested_relation_type, r.evidence_url,
    r.evidence_description, r.status, r.admin_notes, r.reviewed_at,
    r.created_at, r.resulting_project_id
  FROM private.company_project_requests r
  JOIN public.directory_entities e ON e.id = r.directory_entity_id
  LEFT JOIN public.directory_projects p ON p.id = r.project_id
  WHERE (
    r.requester_user_id = auth.uid()
    OR private.company_entity_manager_access(r.directory_entity_id) IN ('owner','manager')
  )
  ORDER BY r.created_at DESC
  LIMIT 200;
END;
$function$;

CREATE OR REPLACE FUNCTION private.company_project_request_admin_list()
RETURNS TABLE (
  request_id uuid,
  directory_entity_id uuid,
  entity_name text,
  requester_user_id uuid,
  requester_role text,
  request_type text,
  project_id uuid,
  project_name text,
  project_payload jsonb,
  requested_relation_type text,
  evidence_url text,
  evidence_description text,
  status text,
  admin_notes text,
  created_at timestamptz,
  reviewed_at timestamptz,
  resulting_project_id uuid
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
  SELECT
    r.id, r.directory_entity_id, e.name_ar, r.requester_user_id,
    r.requester_role, r.request_type, r.project_id,
    coalesce(p.name_ar, r.project_payload->>'name_ar'),
    r.project_payload, r.requested_relation_type, r.evidence_url,
    r.evidence_description, r.status, r.admin_notes, r.created_at,
    r.reviewed_at, r.resulting_project_id
  FROM private.company_project_requests r
  JOIN public.directory_entities e ON e.id = r.directory_entity_id
  LEFT JOIN public.directory_projects p ON p.id = r.project_id
  ORDER BY (r.status = 'pending') DESC, r.created_at DESC
  LIMIT 250;
END;
$function$;

CREATE OR REPLACE FUNCTION private.company_project_request_admin_review(
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
  v_request private.company_project_requests%ROWTYPE;
  v_notes text := nullif(left(btrim(coalesce(p_admin_notes,'')),1200),'');
  v_project_id uuid;
  v_slug text;
  v_area_id uuid;
  v_size_value numeric;
  v_unit_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'غير مسموح؛ يلزم حساب إدارة معتمد' USING ERRCODE='42501';
  END IF;
  IF p_action NOT IN ('approve','needs_changes','reject') THEN
    RAISE EXCEPTION 'قرار المراجعة غير صحيح' USING ERRCODE='22023';
  END IF;
  IF p_action IN ('needs_changes','reject') AND char_length(coalesce(v_notes,'')) < 3 THEN
    RAISE EXCEPTION 'اكتب ملاحظة واضحة لصاحب الطلب' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_request
  FROM private.company_project_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب المشروع غير موجود';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'تمت مراجعة هذا الطلب بالفعل أو لم يعد قيد الانتظار';
  END IF;

  IF p_action = 'needs_changes' THEN
    UPDATE private.company_project_requests
    SET status='needs_changes', admin_notes=v_notes,
        reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
    WHERE id=p_request_id;
    RETURN NULL;
  ELSIF p_action = 'reject' THEN
    UPDATE private.company_project_requests
    SET status='rejected', admin_notes=v_notes,
        reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
    WHERE id=p_request_id;
    RETURN NULL;
  END IF;

  IF v_request.request_type = 'link_project' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.directory_projects p
      WHERE p.id = v_request.project_id
        AND p.public_visible = true
        AND p.verification_status = 'published'
    ) THEN
      RAISE EXCEPTION 'لم يعد المشروع منشورًا؛ لا يمكن اعتماد الربط';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.directory_project_entities r
      WHERE r.project_id = v_request.project_id
        AND r.entity_id = v_request.directory_entity_id
        AND r.relation_type = v_request.requested_relation_type
    ) THEN
      RAISE EXCEPTION 'العلاقة أصبحت مسجلة بالفعل؛ راجع السجل قبل اعتماد الطلب';
    END IF;
    INSERT INTO public.directory_project_entities (
      project_id, entity_id, relation_type, notes
    )
    VALUES (
      v_request.project_id, v_request.directory_entity_id,
      v_request.requested_relation_type, NULL
    );
    v_project_id := v_request.project_id;

  ELSIF v_request.request_type = 'new_project' THEN
    IF EXISTS (
      SELECT 1 FROM public.directory_projects p
      WHERE lower(btrim(p.name_ar)) = lower(btrim(v_request.project_payload->>'name_ar'))
    ) THEN
      RAISE EXCEPTION 'يوجد مشروع مسجل بالاسم نفسه؛ راجع الدليل واطلب ربط الشركة بالسجل الموجود بدل إنشاء تكرار';
    END IF;

    v_area_id := nullif(v_request.project_payload->>'area_id','')::uuid;
    v_size_value := nullif(v_request.project_payload->>'size_value','')::numeric;
    v_unit_count := nullif(v_request.project_payload->>'unit_count','')::numeric::integer;
    v_slug := 'company-project-' || replace(gen_random_uuid()::text,'-','');

    INSERT INTO public.directory_projects (
      slug, name_ar, name_en, project_type, description, area_id,
      location_text, size_value, size_unit, unit_count, project_status,
      verification_status, public_visible
    )
    VALUES (
      v_slug,
      btrim(v_request.project_payload->>'name_ar'),
      nullif(btrim(v_request.project_payload->>'name_en'),''),
      v_request.project_payload->>'project_type',
      nullif(btrim(v_request.project_payload->>'description'),''),
      v_area_id,
      nullif(btrim(v_request.project_payload->>'location_text'),''),
      v_size_value,
      nullif(btrim(v_request.project_payload->>'size_unit'),''),
      v_unit_count,
      coalesce(v_request.project_payload->>'project_status','unknown'),
      'needs_review',
      false
    )
    RETURNING id INTO v_project_id;

    INSERT INTO public.directory_project_entities (
      project_id, entity_id, relation_type, notes
    )
    VALUES (
      v_project_id, v_request.directory_entity_id,
      v_request.requested_relation_type, NULL
    );
  ELSE
    RAISE EXCEPTION 'نوع طلب غير مدعوم';
  END IF;

  UPDATE private.company_project_requests
  SET status='approved', admin_notes=v_notes,
      reviewed_by=auth.uid(), reviewed_at=now(),
      resulting_project_id=v_project_id, updated_at=now()
  WHERE id=p_request_id;

  RETURN v_project_id;
END;
$function$;

-- Public API wrappers are SECURITY INVOKER; all privileged work remains in private functions.
CREATE OR REPLACE FUNCTION public.company_project_request_submit(
  p_directory_entity_id uuid,
  p_request_type text,
  p_project_id uuid DEFAULT NULL,
  p_project_payload jsonb DEFAULT NULL,
  p_relation_type text DEFAULT NULL,
  p_evidence_url text DEFAULT NULL,
  p_evidence_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.company_project_request_submit(
    p_directory_entity_id, p_request_type, p_project_id, p_project_payload,
    p_relation_type, p_evidence_url, p_evidence_description
  );
$function$;

CREATE OR REPLACE FUNCTION public.company_project_requests_mine()
RETURNS TABLE (
  request_id uuid,
  directory_entity_id uuid,
  entity_name text,
  request_type text,
  project_id uuid,
  project_name text,
  project_payload jsonb,
  requested_relation_type text,
  evidence_url text,
  evidence_description text,
  status text,
  admin_notes text,
  reviewed_at timestamptz,
  created_at timestamptz,
  resulting_project_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT * FROM private.company_project_requests_mine();
$function$;

CREATE OR REPLACE FUNCTION public.company_project_request_admin_list()
RETURNS TABLE (
  request_id uuid,
  directory_entity_id uuid,
  entity_name text,
  requester_user_id uuid,
  requester_role text,
  request_type text,
  project_id uuid,
  project_name text,
  project_payload jsonb,
  requested_relation_type text,
  evidence_url text,
  evidence_description text,
  status text,
  admin_notes text,
  created_at timestamptz,
  reviewed_at timestamptz,
  resulting_project_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT * FROM private.company_project_request_admin_list();
$function$;

CREATE OR REPLACE FUNCTION public.company_project_request_admin_review(
  p_request_id uuid,
  p_action text,
  p_admin_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.company_project_request_admin_review(
    p_request_id, p_action, p_admin_notes
  );
$function$;

REVOKE ALL ON FUNCTION private.company_project_request_submit(uuid,text,uuid,jsonb,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.company_project_requests_mine() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.company_project_request_admin_list() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.company_project_request_admin_review(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.company_project_request_submit(uuid,text,uuid,jsonb,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.company_project_requests_mine() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.company_project_request_admin_list() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.company_project_request_admin_review(uuid,text,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.company_project_request_submit(uuid,text,uuid,jsonb,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_project_requests_mine() TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_project_request_admin_list() TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_project_request_admin_review(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_project_request_submit(uuid,text,uuid,jsonb,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_project_requests_mine() TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_project_request_admin_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_project_request_admin_review(uuid,text,text) TO authenticated;

COMMENT ON TABLE private.company_project_requests IS
  'Private requests from verified company file owners/managers to create a directory project or link an existing published project; administrator approval is required.';
