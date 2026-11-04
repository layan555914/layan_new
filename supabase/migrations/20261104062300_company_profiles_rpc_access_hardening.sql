-- Harden company_profiles behind owner/admin RPCs while preserving the approved public directory.
-- Apply only to the isolated ASYUT AQAR TEST project before reviewing this migration for production.

CREATE OR REPLACE VIEW public.company_profiles_public
WITH (security_invoker = false)
AS
SELECT
  id,
  company_name,
  category,
  description,
  services,
  city,
  logo_url,
  address,
  phone,
  whatsapp,
  website,
  gallery_urls,
  projects
FROM public.company_profiles
WHERE status = 'active';

REVOKE ALL ON TABLE public.company_profiles_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.company_profiles_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.layan_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT private.layan_is_admin();
$function$;

REVOKE ALL ON FUNCTION public.layan_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.layan_company_owner_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.company_profiles%ROWTYPE;
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لعرض ملف الشركة' USING ERRCODE = '42501';
  END IF;

  SELECT count(*)::integer
  INTO v_count
  FROM public.company_profiles
  WHERE owner_id = v_user_id;

  IF v_count > 1 THEN
    RAISE EXCEPTION 'يوجد أكثر من ملف شركة مرتبط بالحساب؛ يلزم مراجعة الإدارة'
      USING ERRCODE = '23514';
  END IF;

  SELECT cp.*
  INTO v_row
  FROM public.company_profiles AS cp
  WHERE cp.owner_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Return only the caller's business fields and owner-facing review status.
  -- Never return owner_id, reviewed_by, or internal administrative identifiers.
  RETURN jsonb_build_object(
    'id', v_row.id,
    'company_name', v_row.company_name,
    'category', v_row.category,
    'description', v_row.description,
    'services', to_jsonb(v_row.services),
    'city', v_row.city,
    'address', v_row.address,
    'phone', v_row.phone,
    'whatsapp', v_row.whatsapp,
    'website', v_row.website,
    'logo_url', v_row.logo_url,
    'gallery_urls', to_jsonb(v_row.gallery_urls),
    'projects', v_row.projects,
    'status', v_row.status,
    'admin_notes', v_row.admin_notes,
    'pending_update', v_row.pending_update,
    'update_status', v_row.update_status,
    'update_notes', v_row.update_notes,
    'created_at', v_row.created_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.layan_submit_company_profile(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_name text;
  v_category text;
  v_description text;
  v_city text;
  v_address text;
  v_phone text;
  v_whatsapp text;
  v_website text;
  v_logo_url text;
  v_services text[];
  v_gallery_urls text[];
  v_projects jsonb;
  v_existing public.company_profiles%ROWTYPE;
  v_count integer;
  v_payload jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول لإرسال ملف الشركة' USING ERRCODE = '42501';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
     OR length(p_payload::text) > 20000 THEN
    RAISE EXCEPTION 'بيانات ملف الشركة غير صالحة' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_payload) AS supplied(key)
    WHERE supplied.key NOT IN (
      'company_name','category','description','services','city','address',
      'phone','whatsapp','website','logo_url','gallery_urls','projects'
    )
  ) THEN
    RAISE EXCEPTION 'يحتوي الطلب على حقول غير مسموح بها' USING ERRCODE = '22023';
  END IF;

  IF NOT (p_payload ?& ARRAY[
    'company_name','category','description','services','city','phone',
    'gallery_urls','projects'
  ]) THEN
    RAISE EXCEPTION 'بعض بيانات الشركة الأساسية غير موجودة' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_payload->'company_name') <> 'string'
     OR jsonb_typeof(p_payload->'category') <> 'string'
     OR jsonb_typeof(p_payload->'description') <> 'string'
     OR jsonb_typeof(p_payload->'phone') <> 'string'
     OR jsonb_typeof(p_payload->'city') <> 'string'
     OR jsonb_typeof(p_payload->'services') <> 'array'
     OR jsonb_typeof(p_payload->'gallery_urls') <> 'array'
     OR jsonb_typeof(p_payload->'projects') <> 'array' THEN
    RAISE EXCEPTION 'أنواع بعض بيانات الشركة غير صحيحة' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_each(p_payload) AS item(key, value)
    WHERE item.key IN ('address','whatsapp','website','logo_url')
      AND item.value <> 'null'::jsonb
      AND jsonb_typeof(item.value) <> 'string'
  ) THEN
    RAISE EXCEPTION 'بعض البيانات الاختيارية يجب أن تكون نصوصًا' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_payload->'services') AS item(value)
    WHERE jsonb_typeof(item.value) <> 'string'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_payload->'gallery_urls') AS item(value)
    WHERE jsonb_typeof(item.value) <> 'string'
  ) THEN
    RAISE EXCEPTION 'قائمة الخدمات أو روابط الصور غير صحيحة' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_payload->'projects') AS item(value)
    WHERE jsonb_typeof(item.value) <> 'object'
       OR EXISTS (
         SELECT 1
         FROM jsonb_object_keys(
           CASE WHEN jsonb_typeof(item.value) = 'object' THEN item.value ELSE '{}'::jsonb END
         ) AS project_key(key)
         WHERE project_key.key NOT IN ('title','description')
       )
       OR (item.value ? 'title' AND jsonb_typeof(item.value->'title') <> 'string')
       OR (item.value ? 'description' AND jsonb_typeof(item.value->'description') <> 'string')
  ) THEN
    RAISE EXCEPTION 'صيغة المشروعات أو الأعمال السابقة غير صحيحة' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_payload->'services') > 50
     OR jsonb_array_length(p_payload->'gallery_urls') > 50
     OR jsonb_array_length(p_payload->'projects') > 50 THEN
    RAISE EXCEPTION 'تجاوزت إحدى قوائم الشركة الحد المسموح' USING ERRCODE = '22023';
  END IF;

  v_company_name := nullif(btrim(p_payload->>'company_name'), '');
  v_category := nullif(btrim(p_payload->>'category'), '');
  v_description := btrim(p_payload->>'description');
  v_city := coalesce(nullif(btrim(p_payload->>'city'), ''), 'أسيوط');
  v_address := nullif(btrim(p_payload->>'address'), '');
  v_phone := nullif(btrim(p_payload->>'phone'), '');
  v_whatsapp := nullif(btrim(p_payload->>'whatsapp'), '');
  v_website := nullif(btrim(p_payload->>'website'), '');
  v_logo_url := nullif(btrim(p_payload->>'logo_url'), '');
  SELECT coalesce(array_agg(value), ARRAY[]::text[])
  INTO v_services
  FROM jsonb_array_elements_text(p_payload->'services') AS item(value);
  SELECT coalesce(array_agg(value), ARRAY[]::text[])
  INTO v_gallery_urls
  FROM jsonb_array_elements_text(p_payload->'gallery_urls') AS item(value);
  v_projects := p_payload->'projects';

  IF v_company_name IS NULL OR char_length(v_company_name) NOT BETWEEN 2 AND 140
     OR v_category IS NULL OR char_length(v_category) > 140
     OR char_length(v_description) NOT BETWEEN 20 AND 1200
     OR v_phone IS NULL OR char_length(v_phone) NOT BETWEEN 7 AND 30
     OR char_length(v_city) > 100
     OR (v_address IS NOT NULL AND char_length(v_address) > 240)
     OR (v_whatsapp IS NOT NULL AND char_length(v_whatsapp) > 30) THEN
    RAISE EXCEPTION 'راجع اسم الشركة والمجال والنبذة والهاتف والمدينة' USING ERRCODE = '22023';
  END IF;

  IF NOT public.layan_is_http_url(v_website)
     OR NOT public.layan_is_http_url(v_logo_url)
     OR EXISTS (
       SELECT 1 FROM unnest(v_gallery_urls) AS item(url)
       WHERE NOT public.layan_is_http_url(item.url)
     ) THEN
    RAISE EXCEPTION 'روابط الموقع والشعار والصور يجب أن تبدأ بـ http:// أو https://'
      USING ERRCODE = '22023';
  END IF;

  v_payload := jsonb_build_object(
    'company_name', v_company_name,
    'category', v_category,
    'description', v_description,
    'services', to_jsonb(v_services),
    'city', v_city,
    'address', v_address,
    'phone', v_phone,
    'whatsapp', v_whatsapp,
    'website', v_website,
    'logo_url', v_logo_url,
    'gallery_urls', to_jsonb(v_gallery_urls),
    'projects', v_projects
  );

  SELECT count(*)::integer
  INTO v_count
  FROM public.company_profiles
  WHERE owner_id = v_user_id;

  IF v_count > 1 THEN
    RAISE EXCEPTION 'يوجد أكثر من ملف شركة مرتبط بالحساب؛ لم يتم تعديل أي ملف'
      USING ERRCODE = '23514';
  END IF;

  SELECT cp.*
  INTO v_existing
  FROM public.company_profiles AS cp
  WHERE cp.owner_id = v_user_id
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status = 'paused' THEN
      RAISE EXCEPTION 'ملف الشركة موقوف مؤقتًا؛ تواصل مع الإدارة قبل التعديل'
        USING ERRCODE = '42501';
    ELSIF v_existing.status = 'active' THEN
      UPDATE public.company_profiles
      SET pending_update = v_payload,
          update_status = 'pending',
          update_notes = NULL
      WHERE id = v_existing.id
        AND owner_id = v_user_id
        AND status = 'active';
    ELSIF v_existing.status IN ('pending','needs_changes','rejected') THEN
      UPDATE public.company_profiles
      SET company_name = v_company_name,
          category = v_category,
          description = v_description,
          services = v_services,
          city = v_city,
          address = v_address,
          phone = v_phone,
          whatsapp = v_whatsapp,
          website = v_website,
          logo_url = v_logo_url,
          gallery_urls = v_gallery_urls,
          projects = v_projects,
          status = 'pending',
          admin_notes = NULL,
          reviewed_at = NULL,
          reviewed_by = NULL,
          pending_update = NULL,
          update_status = NULL,
          update_notes = NULL
      WHERE id = v_existing.id
        AND owner_id = v_user_id
        AND status IN ('pending','needs_changes','rejected');
    ELSE
      RAISE EXCEPTION 'حالة ملف الشركة لا تسمح بإرسال تعديل'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    INSERT INTO public.company_profiles (
      owner_id, company_name, category, description, services, city, address,
      phone, whatsapp, website, logo_url, gallery_urls, projects, status
    )
    VALUES (
      v_user_id, v_company_name, v_category, v_description, v_services, v_city,
      v_address, v_phone, v_whatsapp, v_website, v_logo_url, v_gallery_urls,
      v_projects, 'pending'
    );
  END IF;

  RETURN public.layan_company_owner_profile();
END;
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_list_company_profiles()
RETURNS SETOF public.company_profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT * FROM private.layan_admin_list_company_profiles();
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_pending_company_profile_count()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'غير مصرح: يلزم حساب إدارة معتمد' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT count(*)::bigint
    FROM public.company_profiles
    WHERE status = 'pending'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.layan_review_company_profile(
  p_id uuid,
  p_action text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  r public.company_profiles;
  d jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'غير مسموح' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO r
  FROM public.company_profiles
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ملف الشركة غير موجود';
  END IF;

  IF r.status = 'pending' THEN
    IF p_action = 'approve' THEN
      UPDATE public.company_profiles
      SET status = 'active',
          admin_notes = NULL,
          reviewed_at = now(),
          reviewed_by = auth.uid(),
          pending_update = NULL,
          update_status = NULL,
          update_notes = NULL
      WHERE id = p_id;
    ELSIF p_action IN ('request_changes','reject') THEN
      IF coalesce(trim(p_notes), '') = '' THEN
        RAISE EXCEPTION 'الملاحظات مطلوبة';
      END IF;
      UPDATE public.company_profiles
      SET status = CASE p_action WHEN 'request_changes' THEN 'needs_changes' ELSE 'rejected' END,
          admin_notes = left(trim(p_notes), 500),
          reviewed_at = now(),
          reviewed_by = auth.uid()
      WHERE id = p_id;
    ELSE
      RAISE EXCEPTION 'إجراء غير صالح';
    END IF;
    RETURN;
  END IF;

  IF r.status <> 'active'
     OR r.update_status IS DISTINCT FROM 'pending'
     OR r.pending_update IS NULL THEN
    RAISE EXCEPTION 'لا يوجد تعديل معلّق لهذا الملف';
  END IF;

  d := r.pending_update;
  IF p_action = 'approve' THEN
    UPDATE public.company_profiles SET
      company_name = coalesce(nullif(d->>'company_name',''), company_name),
      category = coalesce(nullif(d->>'category',''), category),
      description = coalesce(nullif(d->>'description',''), description),
      services = CASE WHEN jsonb_typeof(d->'services') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(d->'services')) ELSE services END,
      city = coalesce(nullif(d->>'city',''), city),
      address = CASE WHEN d ? 'address' THEN nullif(d->>'address','') ELSE address END,
      phone = coalesce(nullif(d->>'phone',''), phone),
      whatsapp = CASE WHEN d ? 'whatsapp' THEN nullif(d->>'whatsapp','') ELSE whatsapp END,
      website = CASE WHEN d ? 'website' THEN nullif(d->>'website','') ELSE website END,
      logo_url = CASE WHEN d ? 'logo_url' THEN nullif(d->>'logo_url','') ELSE logo_url END,
      gallery_urls = CASE WHEN jsonb_typeof(d->'gallery_urls') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(d->'gallery_urls')) ELSE gallery_urls END,
      projects = CASE WHEN jsonb_typeof(d->'projects') = 'array' THEN d->'projects' ELSE projects END,
      pending_update = NULL,
      update_status = NULL,
      update_notes = NULL,
      admin_notes = NULL,
      reviewed_at = now(),
      reviewed_by = auth.uid()
    WHERE id = p_id;
  ELSIF p_action IN ('request_changes','reject') THEN
    IF coalesce(trim(p_notes), '') = '' THEN
      RAISE EXCEPTION 'الملاحظات مطلوبة';
    END IF;
    UPDATE public.company_profiles SET
      update_status = CASE p_action WHEN 'request_changes' THEN 'needs_changes' ELSE 'rejected' END,
      update_notes = left(trim(p_notes), 500)
    WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'إجراء غير صالح';
  END IF;
END;
$function$;

-- Remove both table-level and any column-level grants from browser roles.
REVOKE ALL PRIVILEGES ON TABLE public.company_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES (
  id, owner_id, company_name, category, description, services, city, address,
  phone, whatsapp, website, logo_url, gallery_urls, projects, status,
  admin_notes, reviewed_at, reviewed_by, pending_update, update_status,
  update_notes, created_at, updated_at
) ON TABLE public.company_profiles FROM PUBLIC, anon, authenticated;

-- Keep the private admin helpers callable only by their database owner.
REVOKE ALL ON FUNCTION private.layan_admin_list_company_profiles() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.layan_is_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.layan_admin_list_company_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_list_company_profiles() TO authenticated;

REVOKE ALL ON FUNCTION public.layan_company_owner_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_company_owner_profile() TO authenticated;

REVOKE ALL ON FUNCTION public.layan_submit_company_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_submit_company_profile(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.layan_admin_pending_company_profile_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_pending_company_profile_count() TO authenticated;

REVOKE ALL ON FUNCTION public.layan_review_company_profile(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_review_company_profile(uuid, text, text) TO authenticated;
