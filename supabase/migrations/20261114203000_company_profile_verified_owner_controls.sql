-- Apply verified representative ownership and self-service controls to owner-submitted company profiles.
-- Development branch only. This migration has not been applied to production.

BEGIN;

ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS representative_name text,
  ADD COLUMN IF NOT EXISTS representative_role text,
  ADD COLUMN IF NOT EXISTS evidence_url text,
  ADD COLUMN IF NOT EXISTS evidence_description text,
  ADD COLUMN IF NOT EXISTS verification_method text,
  ADD COLUMN IF NOT EXISTS verification_note text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.company_profiles'::regclass
      AND conname='company_profiles_evidence_url_check'
  ) THEN
    ALTER TABLE public.company_profiles
      ADD CONSTRAINT company_profiles_evidence_url_check
      CHECK (evidence_url IS NULL OR (char_length(evidence_url)<=500 AND public.layan_is_http_url(evidence_url)));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.company_profiles'::regclass
      AND conname='company_profiles_evidence_description_check'
  ) THEN
    ALTER TABLE public.company_profiles
      ADD CONSTRAINT company_profiles_evidence_description_check
      CHECK (evidence_description IS NULL OR char_length(evidence_description)<=500);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.company_profiles'::regclass
      AND conname='company_profiles_representative_role_check'
  ) THEN
    ALTER TABLE public.company_profiles
      ADD CONSTRAINT company_profiles_representative_role_check
      CHECK (representative_role IS NULL OR representative_role = ANY (ARRAY[
        'المالك','شريك','مدير النشاط','مدير الفرع','مسؤول تسويق أو مبيعات',
        'موظف مفوض','وكيل / ممثل قانوني','صفة أخرى'
      ]::text[]));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.company_profiles'::regclass
      AND conname='company_profiles_verification_method_check'
  ) THEN
    ALTER TABLE public.company_profiles
      ADD CONSTRAINT company_profiles_verification_method_check
      CHECK (verification_method IS NULL OR verification_method = ANY (ARRAY[
        'official_phone','official_email','official_website','authorization_letter',
        'registration_document','in_person','legacy_admin_review'
      ]::text[]));
  END IF;
END
$constraints$;

-- Preserve access for already-published profiles that were explicitly approved by an administrator.
UPDATE public.company_profiles
SET verified_at=COALESCE(verified_at,reviewed_at),
    verified_by=COALESCE(verified_by,reviewed_by),
    verification_method=COALESCE(verification_method,'legacy_admin_review'),
    verification_note=COALESCE(verification_note,'اعتماد إداري سابق لملف الشركة')
WHERE status='active'
  AND reviewed_by IS NOT NULL
  AND verified_at IS NULL;

CREATE TABLE IF NOT EXISTS public.company_profile_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id uuid NOT NULL REFERENCES public.company_profiles(id) ON DELETE RESTRICT,
  changed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  old_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_profile_change_log_values_check
    CHECK (jsonb_typeof(old_values)='object' AND jsonb_typeof(new_values)='object')
);

CREATE INDEX IF NOT EXISTS company_profile_change_log_profile_idx
  ON public.company_profile_change_log(company_profile_id,created_at DESC);
ALTER TABLE public.company_profile_change_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_profile_change_log FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.company_profile_change_log TO authenticated;
DROP POLICY IF EXISTS company_profile_change_log_admin_read
  ON public.company_profile_change_log;
CREATE POLICY company_profile_change_log_admin_read
  ON public.company_profile_change_log
  FOR SELECT TO authenticated
  USING (public.layan_is_admin());

CREATE TABLE IF NOT EXISTS public.company_profile_manager_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id uuid NOT NULL REFERENCES public.company_profiles(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_role text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT company_profile_manager_members_role_check
    CHECK (member_role IN ('manager','editor')),
  CONSTRAINT company_profile_manager_members_revoke_pair_check
    CHECK ((revoked_at IS NULL AND revoked_by IS NULL) OR revoked_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS company_profile_manager_members_one_active_user
  ON public.company_profile_manager_members(company_profile_id,user_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS company_profile_manager_members_user_idx
  ON public.company_profile_manager_members(user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.company_profile_manager_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_profile_manager_members FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.company_profile_manager_members TO authenticated;
DROP POLICY IF EXISTS company_profile_manager_members_read_related
  ON public.company_profile_manager_members;
CREATE POLICY company_profile_manager_members_read_related
  ON public.company_profile_manager_members
  FOR SELECT TO authenticated
  USING (
    user_id=(SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.company_profiles owner_profile
      WHERE owner_profile.id=company_profile_manager_members.company_profile_id
        AND owner_profile.owner_id=(SELECT auth.uid())
        AND owner_profile.verified_at IS NOT NULL
        AND owner_profile.status='active'
    )
    OR public.layan_is_admin()
  );

CREATE OR REPLACE FUNCTION private.company_profile_manager_access(p_company_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid:=auth.uid();
  v_role text;
BEGIN
  IF v_user IS NULL THEN RETURN NULL; END IF;
  SELECT 'owner' INTO v_role
  FROM public.company_profiles p
  WHERE p.id=p_company_profile_id
    AND p.owner_id=v_user
    AND p.verified_at IS NOT NULL
    AND p.status='active';
  IF FOUND THEN RETURN v_role; END IF;

  SELECT mm.member_role INTO v_role
  FROM public.company_profile_manager_members mm
  JOIN public.company_profiles p ON p.id=mm.company_profile_id
  WHERE mm.company_profile_id=p_company_profile_id
    AND mm.user_id=v_user
    AND mm.revoked_at IS NULL
    AND p.verified_at IS NOT NULL
    AND p.status='active'
  LIMIT 1;
  RETURN v_role;
END;
$function$;

CREATE OR REPLACE FUNCTION private.company_profile_manager_invite(
  p_company_profile_id uuid,p_email text,p_role text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_email text:=lower(btrim(coalesce(p_email,'')));
  v_user_id uuid;
  v_member_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.company_profiles p
    WHERE p.id=p_company_profile_id AND p.owner_id=auth.uid()
      AND p.verified_at IS NOT NULL AND p.status='active'
  ) THEN
    RAISE EXCEPTION 'إضافة أعضاء الفريق متاحة لمالك الشركة بعد التحقق فقط' USING errcode='42501';
  END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
     OR char_length(v_email)>254 THEN
    RAISE EXCEPTION 'أدخل بريدًا إلكترونيًا صحيحًا' USING errcode='22023';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('manager','editor') THEN
    RAISE EXCEPTION 'صلاحية الموظف غير صحيحة' USING errcode='22023';
  END IF;

  SELECT u.id INTO v_user_id FROM auth.users u
  WHERE lower(u.email)=v_email AND u.email_confirmed_at IS NOT NULL
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'يجب أن ينشئ الموظف حسابًا على أسيوط عقار ويؤكد بريده أولًا' USING errcode='P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.company_profiles p
    WHERE p.id=p_company_profile_id AND p.owner_id=v_user_id
  ) THEN
    RAISE EXCEPTION 'هذا الحساب هو مالك الشركة بالفعل' USING errcode='23505';
  END IF;

  INSERT INTO public.company_profile_manager_members(company_profile_id,user_id,member_role,invited_by)
  VALUES(p_company_profile_id,v_user_id,p_role,auth.uid())
  RETURNING id INTO v_member_id;
  RETURN v_member_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'هذا المستخدم مضاف بالفعل إلى فريق الشركة' USING errcode='23505';
END;
$function$;

CREATE OR REPLACE FUNCTION private.company_profile_manager_member_list(p_company_profile_id uuid)
RETURNS TABLE(member_id uuid,user_id uuid,email text,member_role text,created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.company_profiles p
    WHERE p.id=p_company_profile_id AND p.owner_id=auth.uid()
      AND p.verified_at IS NOT NULL AND p.status='active'
  ) THEN
    RAISE EXCEPTION 'قائمة فريق الشركة متاحة لمالكها بعد التحقق فقط' USING errcode='42501';
  END IF;
  RETURN QUERY
  SELECT mm.id,mm.user_id,u.email::text,mm.member_role,mm.created_at
  FROM public.company_profile_manager_members mm
  JOIN auth.users u ON u.id=mm.user_id
  WHERE mm.company_profile_id=p_company_profile_id AND mm.revoked_at IS NULL
  ORDER BY mm.created_at ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION private.company_profile_manager_revoke(p_company_profile_id uuid,p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.company_profiles p
    WHERE p.id=p_company_profile_id AND p.owner_id=auth.uid()
      AND p.verified_at IS NOT NULL AND p.status='active'
  ) THEN
    RAISE EXCEPTION 'إلغاء صلاحيات الفريق متاح لمالك الشركة بعد التحقق فقط' USING errcode='42501';
  END IF;
  IF p_user_id=auth.uid() THEN
    RAISE EXCEPTION 'لا يمكن إلغاء صلاحية المالك الأساسي من هذه الشاشة' USING errcode='22023';
  END IF;
  UPDATE public.company_profile_manager_members
  SET revoked_at=now(),revoked_by=auth.uid()
  WHERE company_profile_id=p_company_profile_id AND user_id=p_user_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count>0;
END;
$function$;

CREATE OR REPLACE FUNCTION private.company_profile_update_direct(p_company_profile_id uuid,p_payload jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile public.company_profiles%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
  v_role text;
  v_allowed text[]:=ARRAY['description','services','gallery_urls','projects'];
BEGIN
  v_role:=private.company_profile_manager_access(p_company_profile_id);
  IF auth.uid() IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'هذا الحساب غير مخوّل لإدارة ملف الشركة' USING errcode='42501';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR p_payload='{}'::jsonb OR length(p_payload::text)>16000 THEN
    RAISE EXCEPTION 'بيانات التعديل غير صحيحة أو فارغة' USING errcode='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) AS x(key_name)
    WHERE NOT (key_name=ANY(v_allowed))) THEN
    RAISE EXCEPTION 'هذه الحقول تتطلب موافقة الإدارة قبل نشرها' USING errcode='42501';
  END IF;
  IF p_payload ? 'description' AND (
    jsonb_typeof(p_payload->'description') IS DISTINCT FROM 'string'
    OR char_length(btrim(p_payload->>'description')) NOT BETWEEN 20 AND 1200
  ) THEN RAISE EXCEPTION 'النبذة يجب أن تكون من 20 إلى 1200 حرف' USING errcode='22023'; END IF;
  IF p_payload ? 'services' AND (
    jsonb_typeof(p_payload->'services') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_payload->'services')>50
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'services') AS x(value)
      WHERE jsonb_typeof(x.value) IS DISTINCT FROM 'string'
        OR char_length(btrim(x.value #>> '{}')) NOT BETWEEN 1 AND 120)
  ) THEN RAISE EXCEPTION 'قائمة الخدمات غير صحيحة' USING errcode='22023'; END IF;
  IF p_payload ? 'gallery_urls' AND (
    jsonb_typeof(p_payload->'gallery_urls') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_payload->'gallery_urls')>50
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'gallery_urls') AS x(value)
      WHERE jsonb_typeof(x.value) IS DISTINCT FROM 'string'
        OR NOT public.layan_is_http_url(x.value #>> '{}'))
  ) THEN RAISE EXCEPTION 'روابط معرض الأعمال غير صحيحة' USING errcode='22023'; END IF;
  IF p_payload ? 'projects' AND (
    jsonb_typeof(p_payload->'projects') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_payload->'projects')>50
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'projects') AS x(value)
      WHERE jsonb_typeof(x.value) IS DISTINCT FROM 'object'
        OR char_length(coalesce(x.value->>'title',''))>180
        OR char_length(coalesce(x.value->>'description',''))>1200)
  ) THEN RAISE EXCEPTION 'قائمة المشروعات غير صحيحة' USING errcode='22023'; END IF;

  SELECT * INTO v_profile FROM public.company_profiles
  WHERE id=p_company_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ملف الشركة غير موجود' USING errcode='P0002'; END IF;
  IF v_profile.status<>'active' OR v_profile.verified_at IS NULL THEN
    RAISE EXCEPTION 'يلزم اعتماد الملف والتحقق من ممثله قبل التعديل المباشر' USING errcode='42501';
  END IF;

  SELECT COALESCE(jsonb_object_agg(k.key_name,to_jsonb(v_profile)->k.key_name),'{}'::jsonb)
  INTO v_before FROM jsonb_object_keys(p_payload) AS k(key_name);

  UPDATE public.company_profiles p SET
    description=CASE WHEN p_payload?'description' THEN p_payload->>'description' ELSE p.description END,
    services=CASE WHEN p_payload?'services' THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'services')) ELSE p.services END,
    gallery_urls=CASE WHEN p_payload?'gallery_urls' THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'gallery_urls')) ELSE p.gallery_urls END,
    projects=CASE WHEN p_payload?'projects' THEN p_payload->'projects' ELSE p.projects END,
    updated_at=now()
  WHERE p.id=p_company_profile_id
  RETURNING to_jsonb(p) INTO v_after;

  INSERT INTO public.company_profile_change_log(company_profile_id,changed_by,old_values,new_values,reason)
  VALUES(
    p_company_profile_id,auth.uid(),v_before,
    (SELECT COALESCE(jsonb_object_agg(k.key_name,v_after->k.key_name),'{}'::jsonb)
     FROM jsonb_object_keys(p_payload) AS k(key_name)),
    'تعديل تشغيلي مباشر بواسطة ممثل شركة معتمد'
  );
  RETURN 'updated';
END;
$function$;

CREATE OR REPLACE FUNCTION private.company_profile_sensitive_update_submit(p_company_profile_id uuid,p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile public.company_profiles%ROWTYPE;
  v_allowed text[]:=ARRAY['company_name','category','city','address','phone','whatsapp','website','logo_url'];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'سجّل الدخول أولًا' USING errcode='42501'; END IF;
  SELECT * INTO v_profile FROM public.company_profiles
  WHERE id=p_company_profile_id AND owner_id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR v_profile.status<>'active' OR v_profile.verified_at IS NULL THEN
    RAISE EXCEPTION 'هذا الحساب غير مخوّل لإرسال تغييرات هوية الشركة' USING errcode='42501';
  END IF;
  IF v_profile.update_status='pending' THEN
    RAISE EXCEPTION 'لديك تغيير حساس قيد مراجعة الإدارة بالفعل' USING errcode='23505';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR p_payload='{}'::jsonb OR length(p_payload::text)>12000 THEN
    RAISE EXCEPTION 'بيانات التغيير غير صحيحة أو فارغة' USING errcode='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) AS x(key_name)
    WHERE NOT (key_name=ANY(v_allowed))) THEN
    RAISE EXCEPTION 'يتضمن الطلب حقولًا لا تتطلب هذه المراجعة' USING errcode='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(p_payload) x
    WHERE x.value<>'null'::jsonb AND jsonb_typeof(x.value) IS DISTINCT FROM 'string') THEN
    RAISE EXCEPTION 'حقول الهوية والتواصل يجب أن تكون نصوصًا' USING errcode='22023';
  END IF;
  IF p_payload ? 'company_name' AND char_length(btrim(p_payload->>'company_name')) NOT BETWEEN 2 AND 140 THEN
    RAISE EXCEPTION 'اسم الشركة يجب أن يكون من حرفين إلى 140 حرفًا' USING errcode='22023';
  END IF;
  IF p_payload ? 'category' AND char_length(coalesce(p_payload->>'category',''))>140 THEN
    RAISE EXCEPTION 'مجال الشركة أطول من الحد المسموح' USING errcode='22023';
  END IF;
  IF p_payload ? 'city' AND char_length(coalesce(p_payload->>'city',''))>100 THEN
    RAISE EXCEPTION 'المدينة أطول من الحد المسموح' USING errcode='22023';
  END IF;
  IF p_payload ? 'address' AND char_length(coalesce(p_payload->>'address',''))>240 THEN
    RAISE EXCEPTION 'العنوان أطول من الحد المسموح' USING errcode='22023';
  END IF;
  IF p_payload ? 'phone' AND char_length(regexp_replace(coalesce(p_payload->>'phone',''),'[^0-9]','','g')) NOT BETWEEN 7 AND 20 THEN
    RAISE EXCEPTION 'رقم الهاتف غير صحيح' USING errcode='22023';
  END IF;
  IF p_payload ? 'whatsapp' AND p_payload->>'whatsapp' IS NOT NULL
     AND char_length(regexp_replace(p_payload->>'whatsapp','[^0-9]','','g')) NOT BETWEEN 7 AND 20 THEN
    RAISE EXCEPTION 'رقم واتساب غير صحيح' USING errcode='22023';
  END IF;
  IF p_payload ? 'website' AND nullif(btrim(p_payload->>'website'),'') IS NOT NULL
     AND NOT public.layan_is_http_url(p_payload->>'website') THEN
    RAISE EXCEPTION 'رابط الموقع غير صحيح' USING errcode='22023';
  END IF;
  IF p_payload ? 'logo_url' AND nullif(btrim(p_payload->>'logo_url'),'') IS NOT NULL
     AND NOT public.layan_is_http_url(p_payload->>'logo_url') THEN
    RAISE EXCEPTION 'رابط الشعار غير صحيح' USING errcode='22023';
  END IF;

  UPDATE public.company_profiles
  SET pending_update=p_payload,update_status='pending',update_notes=NULL,updated_at=now()
  WHERE id=p_company_profile_id;
  RETURN p_company_profile_id;
END;
$function$;

CREATE OR REPLACE FUNCTION private.layan_company_profile_set_representative_details(
  p_company_profile_id uuid,p_representative_name text,p_representative_role text,
  p_evidence_url text DEFAULT NULL,p_evidence_description text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_name text:=btrim(coalesce(p_representative_name,''));
  v_role text:=btrim(coalesce(p_representative_role,''));
  v_url text:=nullif(btrim(coalesce(p_evidence_url,'')),'');
  v_description text:=nullif(btrim(coalesce(p_evidence_description,'')),'');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'سجّل الدخول أولًا' USING errcode='42501'; END IF;
  IF char_length(v_name) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'اسم ممثل الشركة يجب أن يكون من 3 إلى 120 حرفًا' USING errcode='22023';
  END IF;
  IF v_role NOT IN ('المالك','شريك','مدير النشاط','مدير الفرع','مسؤول تسويق أو مبيعات','موظف مفوض','وكيل / ممثل قانوني','صفة أخرى') THEN
    RAISE EXCEPTION 'اختر صفة صحيحة داخل الشركة' USING errcode='22023';
  END IF;
  IF v_url IS NOT NULL AND (char_length(v_url)>500 OR NOT public.layan_is_http_url(v_url)) THEN
    RAISE EXCEPTION 'رابط إثبات الصفة غير صحيح' USING errcode='22023';
  END IF;
  IF v_description IS NOT NULL AND char_length(v_description)>500 THEN
    RAISE EXCEPTION 'وصف دليل الصفة أطول من الحد المسموح' USING errcode='22023';
  END IF;
  UPDATE public.company_profiles
  SET representative_name=v_name,representative_role=v_role,
      evidence_url=v_url,evidence_description=v_description,updated_at=now()
  WHERE id=p_company_profile_id
    AND owner_id=auth.uid()
    AND status IN ('pending','needs_changes','rejected')
    AND verified_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'لا يمكن تغيير بيانات ممثل هذا الملف بعد اعتماده؛ تواصل مع الإدارة لإعادة التحقق' USING errcode='42501';
  END IF;
  RETURN true;
END;
$function$;

-- Include verification state in the owner-only response without exposing internal admin identifiers.
CREATE OR REPLACE FUNCTION private.layan_company_owner_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid:=auth.uid();
  v_row public.company_profiles%ROWTYPE;
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لعرض ملف الشركة' USING errcode='42501';
  END IF;
  SELECT count(*)::integer INTO v_count
  FROM public.company_profiles WHERE owner_id=v_user_id;
  IF v_count>1 THEN
    RAISE EXCEPTION 'يوجد أكثر من ملف شركة مرتبط بالحساب؛ يلزم مراجعة الإدارة'
      USING ERRCODE='23514';
  END IF;
  SELECT cp.* INTO v_row FROM public.company_profiles cp
  WHERE cp.owner_id=v_user_id LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'id',v_row.id,'company_name',v_row.company_name,'category',v_row.category,
    'description',v_row.description,'services',to_jsonb(v_row.services),
    'city',v_row.city,'address',v_row.address,'phone',v_row.phone,
    'whatsapp',v_row.whatsapp,'website',v_row.website,'logo_url',v_row.logo_url,
    'gallery_urls',to_jsonb(v_row.gallery_urls),'projects',v_row.projects,
    'status',v_row.status,'admin_notes',v_row.admin_notes,
    'pending_update',v_row.pending_update,'update_status',v_row.update_status,
    'update_notes',v_row.update_notes,'created_at',v_row.created_at,
    'representative_name',v_row.representative_name,
    'representative_role',v_row.representative_role,
    'evidence_url',v_row.evidence_url,'evidence_description',v_row.evidence_description,
    'verified_at',v_row.verified_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION private.layan_review_company_profile(
  p_id uuid,p_action text,p_notes text DEFAULT NULL,
  p_verification_method text DEFAULT NULL,p_verification_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  r public.company_profiles%ROWTYPE;
  d jsonb;
  v_note text:=nullif(left(btrim(coalesce(p_notes,'')),500),'');
  v_verify_note text:=nullif(left(btrim(coalesce(p_verification_note,'')),500),'');
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'غير مسموح' USING ERRCODE='42501';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('approve','request_changes','reject') THEN
    RAISE EXCEPTION 'إجراء غير صالح' USING ERRCODE='22023';
  END IF;

  SELECT * INTO r FROM public.company_profiles WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ملف الشركة غير موجود'; END IF;

  IF r.status IN ('pending','needs_changes','rejected') THEN
    IF p_action='approve' THEN
      IF r.representative_name IS NULL OR r.representative_role IS NULL
         OR p_verification_method IS NULL OR p_verification_method NOT IN (
           'official_phone','official_email','official_website','authorization_letter',
           'registration_document','in_person'
         ) OR char_length(coalesce(v_verify_note,''))<6 THEN
        RAISE EXCEPTION 'أكمل بيانات الممثل واختر وسيلة التحقق وسجّل ملخص التحقق قبل نشر الشركة' USING ERRCODE='22023';
      END IF;
      UPDATE public.company_profiles
      SET status='active',admin_notes=NULL,reviewed_at=now(),reviewed_by=auth.uid(),
          pending_update=NULL,update_status=NULL,update_notes=NULL,
          verification_method=p_verification_method,verification_note=v_verify_note,
          verified_at=now(),verified_by=auth.uid()
      WHERE id=p_id;
    ELSIF p_action IN ('request_changes','reject') THEN
      IF char_length(coalesce(v_note,''))<3 THEN
        RAISE EXCEPTION 'الملاحظات مطلوبة' USING ERRCODE='22023';
      END IF;
      UPDATE public.company_profiles
      SET status=CASE p_action WHEN 'request_changes' THEN 'needs_changes' ELSE 'rejected' END,
          admin_notes=v_note,reviewed_at=now(),reviewed_by=auth.uid()
      WHERE id=p_id;
    END IF;
    RETURN;
  END IF;

  IF r.status<>'active' OR r.update_status IS DISTINCT FROM 'pending' OR r.pending_update IS NULL THEN
    RAISE EXCEPTION 'لا يوجد تعديل معلّق لهذا الملف';
  END IF;
  d:=r.pending_update;
  IF p_action='approve' THEN
    UPDATE public.company_profiles SET
      company_name=CASE WHEN d?'company_name' THEN d->>'company_name' ELSE company_name END,
      category=CASE WHEN d?'category' THEN d->>'category' ELSE category END,
      city=CASE WHEN d?'city' THEN d->>'city' ELSE city END,
      address=CASE WHEN d?'address' THEN nullif(d->>'address','') ELSE address END,
      phone=CASE WHEN d?'phone' THEN d->>'phone' ELSE phone END,
      whatsapp=CASE WHEN d?'whatsapp' THEN nullif(d->>'whatsapp','') ELSE whatsapp END,
      website=CASE WHEN d?'website' THEN nullif(d->>'website','') ELSE website END,
      logo_url=CASE WHEN d?'logo_url' THEN nullif(d->>'logo_url','') ELSE logo_url END,
      pending_update=NULL,update_status=NULL,update_notes=NULL,
      admin_notes=NULL,reviewed_at=now(),reviewed_by=auth.uid()
    WHERE id=p_id;
  ELSIF p_action IN ('request_changes','reject') THEN
    IF char_length(coalesce(v_note,''))<3 THEN
      RAISE EXCEPTION 'الملاحظات مطلوبة' USING ERRCODE='22023';
    END IF;
    UPDATE public.company_profiles
    SET update_status=CASE p_action WHEN 'request_changes' THEN 'needs_changes' ELSE 'rejected' END,
        update_notes=v_note
    WHERE id=p_id;
  ELSE
    RAISE EXCEPTION 'إجراء غير صالح' USING ERRCODE='22023';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.company_profile_update_direct(p_company_profile_id uuid,p_payload jsonb)
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT private.company_profile_update_direct(p_company_profile_id,p_payload); $function$;

CREATE OR REPLACE FUNCTION public.company_profile_sensitive_update_submit(p_company_profile_id uuid,p_payload jsonb)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT private.company_profile_sensitive_update_submit(p_company_profile_id,p_payload); $function$;

CREATE OR REPLACE FUNCTION public.company_profile_manager_invite(p_company_profile_id uuid,p_email text,p_role text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT private.company_profile_manager_invite(p_company_profile_id,p_email,p_role); $function$;

CREATE OR REPLACE FUNCTION public.company_profile_manager_member_list(p_company_profile_id uuid)
RETURNS TABLE(member_id uuid,user_id uuid,email text,member_role text,created_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT * FROM private.company_profile_manager_member_list(p_company_profile_id); $function$;

CREATE OR REPLACE FUNCTION public.company_profile_manager_revoke(p_company_profile_id uuid,p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT private.company_profile_manager_revoke(p_company_profile_id,p_user_id); $function$;

CREATE OR REPLACE FUNCTION public.layan_company_profile_set_representative_details(
  p_company_profile_id uuid,p_representative_name text,p_representative_role text,
  p_evidence_url text DEFAULT NULL,p_evidence_description text DEFAULT NULL
)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$
  SELECT private.layan_company_profile_set_representative_details(
    p_company_profile_id,p_representative_name,p_representative_role,p_evidence_url,p_evidence_description
  );
$function$;

DROP FUNCTION IF EXISTS public.layan_review_company_profile(uuid,text,text);
DROP FUNCTION IF EXISTS private.layan_review_company_profile(uuid,text,text);

CREATE FUNCTION public.layan_review_company_profile(
  p_id uuid,p_action text,p_notes text DEFAULT NULL,
  p_verification_method text DEFAULT NULL,p_verification_note text DEFAULT NULL
)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$
  SELECT private.layan_review_company_profile(
    p_id,p_action,p_notes,p_verification_method,p_verification_note
  );
$function$;

REVOKE ALL ON FUNCTION private.company_profile_manager_access(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.company_profile_manager_invite(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.company_profile_manager_member_list(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.company_profile_manager_revoke(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.company_profile_update_direct(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.company_profile_sensitive_update_submit(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.layan_company_profile_set_representative_details(uuid,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.layan_company_owner_profile() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.layan_review_company_profile(uuid,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.company_profile_manager_invite(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.company_profile_manager_member_list(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.company_profile_manager_revoke(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.company_profile_update_direct(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.company_profile_sensitive_update_submit(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.layan_company_profile_set_representative_details(uuid,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.layan_review_company_profile(uuid,text,text,text,text) FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION private.company_profile_manager_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_profile_manager_invite(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_profile_manager_member_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_profile_manager_revoke(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_profile_update_direct(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_profile_sensitive_update_submit(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION private.layan_company_profile_set_representative_details(uuid,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.layan_company_owner_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION private.layan_review_company_profile(uuid,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_profile_manager_invite(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_profile_manager_member_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_profile_manager_revoke(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_profile_update_direct(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_profile_sensitive_update_submit(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.layan_company_profile_set_representative_details(uuid,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.layan_review_company_profile(uuid,text,text,text,text) TO authenticated;

COMMIT;
