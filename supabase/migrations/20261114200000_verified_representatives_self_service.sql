-- Verified representatives, delegated access and audited self-service edits.
-- Development branch only. This migration has not been applied to production.

BEGIN;

ALTER TABLE public.company_claim_requests
  ADD COLUMN IF NOT EXISTS evidence_url text,
  ADD COLUMN IF NOT EXISTS evidence_description text;

ALTER TABLE public.company_entity_managers
  ADD COLUMN IF NOT EXISTS representative_name text,
  ADD COLUMN IF NOT EXISTS representative_role text,
  ADD COLUMN IF NOT EXISTS verification_method text,
  ADD COLUMN IF NOT EXISTS verification_note text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.directory_entities
  ADD COLUMN IF NOT EXISTS representative_verified_at timestamptz;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.company_claim_requests'::regclass
      AND conname='company_claim_requests_evidence_url_check'
  ) THEN
    ALTER TABLE public.company_claim_requests
      ADD CONSTRAINT company_claim_requests_evidence_url_check
      CHECK (evidence_url IS NULL OR (char_length(evidence_url) <= 500 AND public.layan_is_http_url(evidence_url)));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.company_claim_requests'::regclass
      AND conname='company_claim_requests_evidence_description_check'
  ) THEN
    ALTER TABLE public.company_claim_requests
      ADD CONSTRAINT company_claim_requests_evidence_description_check
      CHECK (evidence_description IS NULL OR char_length(evidence_description) <= 500);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.company_entity_managers'::regclass
      AND conname='company_entity_managers_verification_method_check'
  ) THEN
    ALTER TABLE public.company_entity_managers
      ADD CONSTRAINT company_entity_managers_verification_method_check
      CHECK (verification_method IS NULL OR verification_method = ANY (ARRAY[
        'official_phone','official_email','official_website','authorization_letter',
        'registration_document','in_person','legacy_admin_review'
      ]::text[]));
  END IF;
END
$constraints$;

-- Existing owner links were created only by the previous admin approval workflow,
-- whose confirmation explicitly required manual identity/authorization checks.
-- Preserve access for those already-approved representatives and record that legacy path.
UPDATE public.company_entity_managers m
SET representative_name = COALESCE(m.representative_name, c.representative_name),
    representative_role = COALESCE(m.representative_role, c.representative_role),
    verification_method = COALESCE(m.verification_method, 'legacy_admin_review'),
    verification_note = COALESCE(m.verification_note, 'اعتماد إداري سابق بعد مراجعة صفة ممثل الجهة'),
    verified_at = COALESCE(m.verified_at, m.approved_at),
    verified_by = COALESCE(m.verified_by, m.approved_by)
FROM public.company_claim_requests c
WHERE c.id = m.claim_request_id
  AND c.status = 'approved'
  AND m.approved_by IS NOT NULL;

UPDATE public.directory_entities e
SET representative_verified_at = m.verified_at
FROM public.company_entity_managers m
WHERE m.directory_entity_id = e.id
  AND m.verified_at IS NOT NULL
  AND e.representative_verified_at IS NULL;

GRANT SELECT (representative_verified_at)
  ON public.directory_entities TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.company_entity_manager_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_entity_id uuid NOT NULL REFERENCES public.directory_entities(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_role text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT company_entity_manager_members_role_check
    CHECK (member_role IN ('manager','editor')),
  CONSTRAINT company_entity_manager_members_revoke_pair_check
    CHECK ((revoked_at IS NULL AND revoked_by IS NULL) OR (revoked_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS company_entity_manager_members_one_active_user
  ON public.company_entity_manager_members(directory_entity_id,user_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS company_entity_manager_members_user_idx
  ON public.company_entity_manager_members(user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.company_entity_manager_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_entity_manager_members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.company_entity_manager_members TO authenticated;

DROP POLICY IF EXISTS company_entity_manager_members_read_related
  ON public.company_entity_manager_members;
CREATE POLICY company_entity_manager_members_read_related
  ON public.company_entity_manager_members
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.company_entity_managers owner_link
      WHERE owner_link.directory_entity_id = company_entity_manager_members.directory_entity_id
        AND owner_link.owner_user_id = (SELECT auth.uid())
        AND owner_link.verified_at IS NOT NULL
    )
    OR public.layan_is_admin()
  );

CREATE OR REPLACE FUNCTION private.company_entity_manager_access(p_directory_entity_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
BEGIN
  IF v_user IS NULL THEN RETURN NULL; END IF;

  SELECT 'owner' INTO v_role
  FROM public.company_entity_managers m
  WHERE m.directory_entity_id = p_directory_entity_id
    AND m.owner_user_id = v_user
    AND m.verified_at IS NOT NULL;
  IF FOUND THEN RETURN v_role; END IF;

  SELECT mm.member_role INTO v_role
  FROM public.company_entity_manager_members mm
  JOIN public.company_entity_managers m
    ON m.directory_entity_id = mm.directory_entity_id
  WHERE mm.directory_entity_id = p_directory_entity_id
    AND mm.user_id = v_user
    AND mm.revoked_at IS NULL
    AND m.verified_at IS NOT NULL
  LIMIT 1;
  RETURN v_role;
END;
$function$;

CREATE OR REPLACE FUNCTION private.company_entity_manager_invite(
  p_directory_entity_id uuid,
  p_email text,
  p_role text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_email text := lower(btrim(coalesce(p_email,'')));
  v_user_id uuid;
  v_member_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.company_entity_managers m
    WHERE m.directory_entity_id = p_directory_entity_id
      AND m.owner_user_id = auth.uid()
      AND m.verified_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'إضافة أعضاء الفريق متاحة لمالك الملف بعد التحقق فقط' USING errcode='42501';
  END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
     OR char_length(v_email) > 254 THEN
    RAISE EXCEPTION 'أدخل بريدًا إلكترونيًا صحيحًا' USING errcode='22023';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('manager','editor') THEN
    RAISE EXCEPTION 'صلاحية الموظف غير صحيحة' USING errcode='22023';
  END IF;

  SELECT u.id INTO v_user_id
  FROM auth.users u
  WHERE lower(u.email) = v_email
    AND u.email_confirmed_at IS NOT NULL
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'يجب أن ينشئ الموظف حسابًا على أسيوط عقار ويؤكد بريده أولًا' USING errcode='P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.company_entity_managers m
    WHERE m.directory_entity_id = p_directory_entity_id AND m.owner_user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'هذا الحساب هو المالك الأساسي للملف بالفعل' USING errcode='23505';
  END IF;

  INSERT INTO public.company_entity_manager_members(
    directory_entity_id,user_id,member_role,invited_by
  )
  VALUES(p_directory_entity_id,v_user_id,p_role,auth.uid())
  RETURNING id INTO v_member_id;

  RETURN v_member_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'هذا المستخدم مضاف بالفعل إلى فريق الملف' USING errcode='23505';
END;
$function$;

CREATE OR REPLACE FUNCTION private.company_entity_manager_member_list(
  p_directory_entity_id uuid
)
RETURNS TABLE(member_id uuid,user_id uuid,email text,member_role text,created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.company_entity_managers m
    WHERE m.directory_entity_id = p_directory_entity_id
      AND m.owner_user_id = auth.uid()
      AND m.verified_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'قائمة فريق الملف متاحة لمالك الملف بعد التحقق فقط' USING errcode='42501';
  END IF;

  RETURN QUERY
  SELECT mm.id,mm.user_id,u.email::text,mm.member_role,mm.created_at
  FROM public.company_entity_manager_members mm
  JOIN auth.users u ON u.id=mm.user_id
  WHERE mm.directory_entity_id=p_directory_entity_id
    AND mm.revoked_at IS NULL
  ORDER BY mm.created_at ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION private.company_entity_manager_revoke(
  p_directory_entity_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.company_entity_managers m
    WHERE m.directory_entity_id = p_directory_entity_id
      AND m.owner_user_id = auth.uid()
      AND m.verified_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'إلغاء صلاحيات الفريق متاح لمالك الملف بعد التحقق فقط' USING errcode='42501';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'لا يمكن إلغاء صلاحية المالك الأساسي من هذه الشاشة' USING errcode='22023';
  END IF;

  UPDATE public.company_entity_manager_members
  SET revoked_at=now(),revoked_by=auth.uid()
  WHERE directory_entity_id=p_directory_entity_id
    AND user_id=p_user_id
    AND revoked_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION private.company_entity_profile_update_direct(
  p_directory_entity_id uuid,
  p_payload jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_entity public.directory_entities%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
  v_allowed text[] := ARRAY[
    'description','public_business_hours','public_services',
    'public_coverage_areas','public_gallery_urls'
  ];
  v_actor_role text;
BEGIN
  v_actor_role := private.company_entity_manager_access(p_directory_entity_id);
  IF auth.uid() IS NULL OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'هذا الحساب غير مخوّل لإدارة الملف' USING errcode='42501';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR p_payload='{}'::jsonb OR length(p_payload::text)>16000 THEN
    RAISE EXCEPTION 'بيانات التعديل غير صحيحة أو فارغة' USING errcode='22023';
  END IF;
  IF EXISTS(
    SELECT 1 FROM jsonb_object_keys(p_payload) AS k(key_name)
    WHERE NOT (key_name=ANY(v_allowed))
  ) THEN
    RAISE EXCEPTION 'هذه الحقول تتطلب موافقة الإدارة قبل نشرها' USING errcode='42501';
  END IF;
  IF EXISTS(
    SELECT 1 FROM jsonb_each(p_payload) x
    WHERE x.key IN ('description','public_business_hours')
      AND x.value<>'null'::jsonb
      AND jsonb_typeof(x.value) IS DISTINCT FROM 'string'
  ) THEN
    RAISE EXCEPTION 'الوصف ومواعيد العمل يجب أن يكونا نصوصًا' USING errcode='22023';
  END IF;
  IF p_payload ? 'description' AND char_length(coalesce(p_payload->>'description',''))>2000 THEN
    RAISE EXCEPTION 'الوصف أطول من الحد المسموح' USING errcode='22023';
  END IF;
  IF p_payload ? 'public_business_hours' AND char_length(coalesce(p_payload->>'public_business_hours',''))>240 THEN
    RAISE EXCEPTION 'مواعيد العمل أطول من الحد المسموح' USING errcode='22023';
  END IF;
  IF p_payload ? 'public_services' AND (
    jsonb_typeof(p_payload->'public_services') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_payload->'public_services')>50
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'public_services') AS item(value)
      WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'string'
        OR char_length(btrim(item.value #>> '{}')) NOT BETWEEN 1 AND 120)
  ) THEN RAISE EXCEPTION 'قائمة الخدمات غير صحيحة' USING errcode='22023'; END IF;
  IF p_payload ? 'public_coverage_areas' AND (
    jsonb_typeof(p_payload->'public_coverage_areas') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_payload->'public_coverage_areas')>50
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'public_coverage_areas') AS item(value)
      WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'string'
        OR char_length(btrim(item.value #>> '{}')) NOT BETWEEN 1 AND 120)
  ) THEN RAISE EXCEPTION 'قائمة مناطق التغطية غير صحيحة' USING errcode='22023'; END IF;
  IF p_payload ? 'public_gallery_urls' AND (
    jsonb_typeof(p_payload->'public_gallery_urls') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_payload->'public_gallery_urls')>20
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'public_gallery_urls') AS item(value)
      WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'string'
        OR NOT public.layan_is_http_url(item.value #>> '{}'))
  ) THEN RAISE EXCEPTION 'روابط معرض الأعمال غير صحيحة' USING errcode='22023'; END IF;

  SELECT * INTO v_entity
  FROM public.directory_entities
  WHERE id=p_directory_entity_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ملف الجهة غير موجود' USING errcode='P0002'; END IF;
  IF v_entity.public_visible IS NOT TRUE OR v_entity.verification_status<>'published' THEN
    RAISE EXCEPTION 'الملف غير منشور حاليًا؛ تواصل مع الإدارة' USING errcode='42501';
  END IF;

  SELECT COALESCE(jsonb_object_agg(k.key_name,to_jsonb(v_entity)->k.key_name),'{}'::jsonb)
  INTO v_before FROM jsonb_object_keys(p_payload) AS k(key_name);

  UPDATE public.directory_entities e SET
    description=CASE WHEN p_payload?'description' THEN nullif(p_payload->>'description','') ELSE e.description END,
    public_business_hours=CASE WHEN p_payload?'public_business_hours' THEN nullif(p_payload->>'public_business_hours','') ELSE e.public_business_hours END,
    public_services=CASE WHEN p_payload?'public_services' THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'public_services')) ELSE e.public_services END,
    public_coverage_areas=CASE WHEN p_payload?'public_coverage_areas' THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'public_coverage_areas')) ELSE e.public_coverage_areas END,
    public_gallery_urls=CASE WHEN p_payload?'public_gallery_urls' THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'public_gallery_urls')) ELSE e.public_gallery_urls END,
    updated_at=now()
  WHERE e.id=p_directory_entity_id
  RETURNING to_jsonb(e) INTO v_after;

  INSERT INTO public.directory_change_log(table_name,record_id,changed_by,old_values,new_values,reason)
  VALUES(
    'directory_entities',p_directory_entity_id,auth.uid(),v_before,
    (SELECT COALESCE(jsonb_object_agg(k.key_name,v_after->k.key_name),'{}'::jsonb)
     FROM jsonb_object_keys(p_payload) AS k(key_name)),
    'تعديل ذاتي مباشر بواسطة ممثل جهة معتمد'
  );

  RETURN 'updated';
END;
$function$;

CREATE OR REPLACE FUNCTION public.company_entity_profile_update_direct(
  p_directory_entity_id uuid,p_payload jsonb
)
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.company_entity_profile_update_direct(p_directory_entity_id,p_payload);
$function$;

CREATE OR REPLACE FUNCTION public.company_entity_manager_invite(
  p_directory_entity_id uuid,p_email text,p_role text
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.company_entity_manager_invite(p_directory_entity_id,p_email,p_role);
$function$;

CREATE OR REPLACE FUNCTION public.company_entity_manager_member_list(p_directory_entity_id uuid)
RETURNS TABLE(member_id uuid,user_id uuid,email text,member_role text,created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT * FROM private.company_entity_manager_member_list(p_directory_entity_id);
$function$;

CREATE OR REPLACE FUNCTION public.company_entity_manager_revoke(p_directory_entity_id uuid,p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.company_entity_manager_revoke(p_directory_entity_id,p_user_id);
$function$;

-- Recreate claim review/list RPCs so approval records the evidence actually checked by staff.
DROP FUNCTION IF EXISTS public.company_claim_admin_list();
DROP FUNCTION IF EXISTS private.company_claim_admin_list();
DROP FUNCTION IF EXISTS public.company_claim_admin_review(uuid,text,text,text,text);
DROP FUNCTION IF EXISTS private.company_claim_admin_review(uuid,text,text,text,text);
DROP FUNCTION IF EXISTS public.company_claim_admin_review(uuid,text,text);
DROP FUNCTION IF EXISTS private.company_claim_admin_review(uuid,text,text);

CREATE FUNCTION private.company_claim_admin_list()
RETURNS TABLE(
  id uuid,directory_entity_id uuid,company_name text,requester_user_id uuid,
  representative_name text,representative_role text,contact_phone text,contact_email text,
  notes text,evidence_url text,evidence_description text,official_phone text,
  official_email text,official_website text,status text,admin_notes text,
  created_at timestamptz,reviewed_at timestamptz,reviewed_by uuid
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذه الطلبات متاحة لإدارة أسيوط عقار فقط' USING errcode='42501';
  END IF;
  RETURN QUERY
  SELECT c.id,c.directory_entity_id,e.name_ar::text,c.requester_user_id,
    c.representative_name,c.representative_role,c.contact_phone,c.contact_email,
    c.notes,c.evidence_url,c.evidence_description,e.public_phone,e.public_email,
    e.website_url::text,c.status,c.admin_notes,c.created_at,c.reviewed_at,c.reviewed_by
  FROM public.company_claim_requests c
  JOIN public.directory_entities e ON e.id=c.directory_entity_id
  WHERE c.status='pending'
  ORDER BY c.created_at ASC;
END;
$function$;

CREATE FUNCTION private.company_claim_admin_review(
  p_id uuid,p_action text,p_note text DEFAULT NULL,
  p_verification_method text DEFAULT NULL,p_verification_note text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_request public.company_claim_requests%ROWTYPE;
  v_existing_owner uuid;
  v_note text := nullif(left(btrim(coalesce(p_note,'')),1000),'');
  v_verify_note text := nullif(left(btrim(coalesce(p_verification_note,'')),500),'');
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING errcode='42501';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('approve','request_info','reject') THEN
    RAISE EXCEPTION 'الإجراء المطلوب غير صحيح' USING errcode='22023';
  END IF;

  SELECT * INTO v_request
  FROM public.company_claim_requests
  WHERE id=p_id AND status='pending'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود أو تم البت فيه بالفعل' USING errcode='P0002'; END IF;

  IF p_action IN ('request_info','reject') AND char_length(coalesce(v_note,''))<3 THEN
    RAISE EXCEPTION 'اكتب ملاحظة واضحة من 3 أحرف على الأقل' USING errcode='22023';
  END IF;

  IF p_action='approve' THEN
    IF p_verification_method IS NULL OR p_verification_method NOT IN (
      'official_phone','official_email','official_website','authorization_letter',
      'registration_document','in_person'
    ) OR char_length(coalesce(v_verify_note,''))<6 THEN
      RAISE EXCEPTION 'اختر وسيلة التحقق واكتب ملخصًا لما تمت مراجعته قبل الاعتماد' USING errcode='22023';
    END IF;

    PERFORM 1 FROM public.directory_entities e
    WHERE e.id=v_request.directory_entity_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'سجل الجهة غير موجود' USING errcode='P0002'; END IF;

    SELECT m.owner_user_id INTO v_existing_owner
    FROM public.company_entity_managers m
    WHERE m.directory_entity_id=v_request.directory_entity_id;

    IF FOUND AND v_existing_owner<>v_request.requester_user_id THEN
      RAISE EXCEPTION 'هذا الملف مرتبط بالفعل بحساب ممثل آخر؛ راجع الإدارة قبل أي تغيير' USING errcode='23505';
    END IF;

    INSERT INTO public.company_entity_managers(
      directory_entity_id,owner_user_id,claim_request_id,approved_by,approved_at,
      representative_name,representative_role,verification_method,verification_note,verified_at,verified_by
    ) VALUES (
      v_request.directory_entity_id,v_request.requester_user_id,v_request.id,auth.uid(),now(),
      v_request.representative_name,v_request.representative_role,p_verification_method,v_verify_note,now(),auth.uid()
    )
    ON CONFLICT (directory_entity_id) DO UPDATE SET
      claim_request_id=EXCLUDED.claim_request_id,
      representative_name=EXCLUDED.representative_name,
      representative_role=EXCLUDED.representative_role,
      verification_method=EXCLUDED.verification_method,
      verification_note=EXCLUDED.verification_note,
      verified_at=EXCLUDED.verified_at,
      verified_by=EXCLUDED.verified_by,
      approved_by=EXCLUDED.approved_by,
      approved_at=EXCLUDED.approved_at;

    UPDATE public.directory_entities
    SET representative_verified_at=now(),updated_at=now()
    WHERE id=v_request.directory_entity_id;

    UPDATE public.company_claim_requests
    SET status='approved',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now(),
      admin_notes=CASE WHEN v_note IS NULL THEN admin_notes ELSE concat_ws(E'\n\n',nullif(admin_notes,''),v_note) END
    WHERE id=v_request.id;
    RETURN 'approved';
  ELSIF p_action='request_info' THEN
    UPDATE public.company_claim_requests
    SET admin_notes=concat_ws(E'\n\n',nullif(admin_notes,''),v_note),
      reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
    WHERE id=v_request.id;
    RETURN 'info_requested';
  ELSE
    UPDATE public.company_claim_requests
    SET status='rejected',admin_notes=concat_ws(E'\n\n',nullif(admin_notes,''),v_note),
      reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
    WHERE id=v_request.id;
    RETURN 'rejected';
  END IF;
END;
$function$;

CREATE FUNCTION public.company_claim_admin_list()
RETURNS TABLE(
  id uuid,directory_entity_id uuid,company_name text,requester_user_id uuid,
  representative_name text,representative_role text,contact_phone text,contact_email text,
  notes text,evidence_url text,evidence_description text,official_phone text,
  official_email text,official_website text,status text,admin_notes text,
  created_at timestamptz,reviewed_at timestamptz,reviewed_by uuid
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT * FROM private.company_claim_admin_list(); $function$;

CREATE FUNCTION public.company_claim_admin_review(
  p_id uuid,p_action text,p_note text DEFAULT NULL,
  p_verification_method text DEFAULT NULL,p_verification_note text DEFAULT NULL
)
RETURNS text
LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$
  SELECT private.company_claim_admin_review(
    p_id,p_action,p_note,p_verification_method,p_verification_note
  );
$function$;

REVOKE ALL ON FUNCTION private.company_entity_manager_access(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.company_entity_manager_invite(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.company_entity_manager_member_list(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.company_entity_manager_revoke(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.company_entity_profile_update_direct(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.company_claim_admin_list() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.company_claim_admin_review(uuid,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.company_entity_profile_update_direct(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.company_entity_manager_invite(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.company_entity_manager_member_list(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.company_entity_manager_revoke(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.company_claim_admin_list() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.company_claim_admin_review(uuid,text,text,text,text) FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION private.company_entity_manager_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_entity_manager_invite(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_entity_manager_member_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_entity_manager_revoke(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_entity_profile_update_direct(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_claim_admin_list() TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_claim_admin_review(uuid,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_entity_profile_update_direct(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_entity_manager_invite(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_entity_manager_member_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_entity_manager_revoke(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_claim_admin_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_claim_admin_review(uuid,text,text,text,text) TO authenticated;

COMMIT;
