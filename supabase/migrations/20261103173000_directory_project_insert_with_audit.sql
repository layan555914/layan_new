-- ASYUT AQAR: extend the audited admin mutation RPC to create directory projects as drafts.
-- Depends on the catalog-derived baseline migration immediately preceding this file.
-- This is an app schema migration; it is safe to replay only on a clean local database.
-- Do not push to the populated production project until a separate migration-ledger
-- reconciliation has been reviewed and explicitly approved.

CREATE OR REPLACE FUNCTION public.directory_admin_mutate_with_audit(
  p_table_name text,
  p_operation text,
  p_record_id uuid,
  p_data jsonb,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_allowed_columns text[];
  v_key text;
  v_assignments text;
  v_columns text;
  v_values text;
  v_before jsonb;
  v_after jsonb;
  v_old_values jsonb := '{}'::jsonb;
  v_new_values jsonb;
  v_audit_record_id uuid;
  v_audit_id uuid;
  v_expected_owner_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.layan_is_admin() THEN
    RAISE EXCEPTION 'مسؤول قاعدة البيانات فقط يمكنه تنفيذ هذه العملية.'
      USING ERRCODE = '42501';
  END IF;

  IF p_data IS NULL
     OR jsonb_typeof(p_data) <> 'object'
     OR p_data = '{}'::jsonb THEN
    RAISE EXCEPTION 'بيانات العملية يجب أن تكون كائن JSON غير فارغ.'
      USING ERRCODE = '22023';
  END IF;

  IF p_operation = 'update' THEN
    IF p_record_id IS NULL THEN
      RAISE EXCEPTION 'معرّف السجل مطلوب للتعديل.'
        USING ERRCODE = '22023';
    END IF;

    CASE p_table_name
      WHEN 'directory_entities' THEN
        v_allowed_columns := ARRAY[
          'name_ar','name_en','description','website_url','public_phone',
          'public_email','public_address','primary_area_id','public_visible',
          'verification_status','last_verified_at','next_review_at'
        ];
      WHEN 'directory_projects' THEN
        v_allowed_columns := ARRAY[
          'name_ar','name_en','description','location_text','area_id',
          'project_status','public_visible','verification_status',
          'last_verified_at','next_review_at'
        ];
      WHEN 'directory_areas' THEN
        v_allowed_columns := ARRAY[
          'name_ar','name_en','slug','area_type','description','notes',
          'is_active','public_visible','verification_status',
          'last_verified_at','next_review_at'
        ];
      WHEN 'directory_opportunities' THEN
        v_allowed_columns := ARRAY[
          'name_ar','city','activity','announcement_date','opportunity_type',
          'source_claimed_status','size_description','terms_as_published',
          'notes','public_visible','verification_status'
        ];
      WHEN 'directory_sources' THEN
        v_allowed_columns := ARRAY[
          'title','publisher','source_type','source_url','publication_date',
          'confidence_level','notes','is_public'
        ];
      ELSE
        RAISE EXCEPTION 'هذا الجدول غير مسموح بالتعديل من هذه الواجهة.'
          USING ERRCODE = '22023';
    END CASE;

  ELSIF p_operation = 'insert' THEN
    CASE p_table_name
      WHEN 'directory_sources' THEN
        IF p_record_id IS NOT NULL THEN
          RAISE EXCEPTION 'لا ترسل معرّف سجل عند إضافة مصدر جديد.'
            USING ERRCODE = '22023';
        END IF;
        v_allowed_columns := ARRAY[
          'title','publisher','source_type','source_url','publication_date',
          'confidence_level','is_public','notes'
        ];
      WHEN 'directory_projects' THEN
        IF p_record_id IS NOT NULL THEN
          RAISE EXCEPTION 'لا ترسل معرّف سجل عند إضافة مشروع جديد.'
            USING ERRCODE = '22023';
        END IF;
        v_allowed_columns := ARRAY[
          'slug','name_ar','name_en','project_type','description','area_id',
          'location_text','size_value','size_unit','unit_count','project_status'
        ];
      WHEN 'directory_entity_sources' THEN
        v_allowed_columns := ARRAY['entity_id','source_id','claim_key'];
        v_expected_owner_id := NULLIF(p_data ->> 'entity_id', '')::uuid;
      WHEN 'directory_project_sources' THEN
        v_allowed_columns := ARRAY['project_id','source_id','claim_key'];
        v_expected_owner_id := NULLIF(p_data ->> 'project_id', '')::uuid;
      WHEN 'directory_opportunity_sources' THEN
        v_allowed_columns := ARRAY['opportunity_id','source_id','claim_key'];
        v_expected_owner_id := NULLIF(p_data ->> 'opportunity_id', '')::uuid;
      ELSE
        RAISE EXCEPTION 'هذا الجدول غير مسموح بالإضافة من هذه الواجهة.'
          USING ERRCODE = '22023';
    END CASE;

    IF p_table_name <> 'directory_sources'
       AND (p_record_id IS NULL OR v_expected_owner_id IS DISTINCT FROM p_record_id) THEN
      RAISE EXCEPTION 'معرّف السجل المرتبط بالمصدر غير مطابق.'
        USING ERRCODE = '22023';
    END IF;

  ELSE
    RAISE EXCEPTION 'نوع العملية غير مدعوم.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_data) AS supplied(key_name)
    WHERE NOT (supplied.key_name = ANY(v_allowed_columns))
  ) THEN
    RAISE EXCEPTION 'تحتوي البيانات على حقل غير مسموح لهذه العملية.'
      USING ERRCODE = '22023';
  END IF;

  IF p_operation = 'update' THEN
    EXECUTE format(
      'SELECT to_jsonb(target) FROM public.%I AS target WHERE target.id = $1 FOR UPDATE',
      p_table_name
    )
    INTO v_before
    USING p_record_id;

    IF v_before IS NULL THEN
      RAISE EXCEPTION 'السجل المطلوب غير موجود.'
        USING ERRCODE = 'P0002';
    END IF;

    SELECT string_agg(
      format(
        '%I = (jsonb_populate_record(NULL::public.%I, $2)).%I',
        supplied.key_name,
        p_table_name,
        supplied.key_name
      ),
      ', '
      ORDER BY supplied.key_name
    )
    INTO v_assignments
    FROM jsonb_object_keys(p_data) AS supplied(key_name);

    EXECUTE format(
      'UPDATE public.%I AS target SET %s WHERE target.id = $1 RETURNING to_jsonb(target)',
      p_table_name,
      v_assignments
    )
    INTO v_after
    USING p_record_id, p_data;

    SELECT COALESCE(
      jsonb_object_agg(supplied.key_name, v_before -> supplied.key_name),
      '{}'::jsonb
    )
    INTO v_old_values
    FROM jsonb_object_keys(p_data) AS supplied(key_name);

    SELECT COALESCE(
      jsonb_object_agg(supplied.key_name, v_after -> supplied.key_name),
      '{}'::jsonb
    )
    INTO v_new_values
    FROM jsonb_object_keys(p_data) AS supplied(key_name);

    v_audit_record_id := p_record_id;

  ELSE
    SELECT
      string_agg(format('%I', supplied.key_name), ', ' ORDER BY supplied.key_name),
      string_agg(
        format(
          '(jsonb_populate_record(NULL::public.%I, $1)).%I',
          p_table_name,
          supplied.key_name
        ),
        ', '
        ORDER BY supplied.key_name
      )
    INTO v_columns, v_values
    FROM jsonb_object_keys(p_data) AS supplied(key_name);

    EXECUTE format(
      'INSERT INTO public.%I AS target (%s) VALUES (%s) RETURNING to_jsonb(target)',
      p_table_name,
      v_columns,
      v_values
    )
    INTO v_after
    USING p_data;

    v_new_values := v_after;

    IF p_table_name IN ('directory_sources', 'directory_projects') THEN
      v_audit_record_id := (v_after ->> 'id')::uuid;
    ELSE
      v_audit_record_id := p_record_id;
    END IF;
  END IF;

  IF v_audit_record_id IS NULL OR v_after IS NULL THEN
    RAISE EXCEPTION 'لم يكتمل حفظ السجل قبل تسجيل أثر العملية.'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.directory_change_log (
    table_name,
    record_id,
    changed_by,
    old_values,
    new_values,
    reason
  )
  VALUES (
    p_table_name,
    v_audit_record_id,
    auth.uid(),
    v_old_values,
    v_new_values,
    LEFT(
      COALESCE(
        NULLIF(BTRIM(p_reason), ''),
        CASE WHEN p_operation = 'insert' THEN 'إضافة سجل من لوحة إدارة الدليل'
             ELSE 'تعديل سجل من لوحة إدارة الدليل' END
      ),
      240
    )
  )
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'record', v_after,
    'audit_id', v_audit_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.directory_admin_mutate_with_audit(text, text, uuid, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.directory_admin_mutate_with_audit(text, text, uuid, jsonb, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
