-- ASYUT AQAR: reserve an owner-approved admin change before any external REST side effect.
-- A request in "executing" is never silently returned to the pending queue. If the owner
-- loses connectivity after the side effect, the request remains locked for manual reconciliation;
-- this intentionally favors preventing duplicate destructive writes over automatic replay.

DROP INDEX IF EXISTS private.layan_admin_requests_one_pending;
DROP INDEX IF EXISTS private.layan_admin_requests_one_active_change;
CREATE UNIQUE INDEX layan_admin_requests_one_active
  ON private.layan_admin_requests (action, target)
  WHERE status IN ('pending','executing');

ALTER TABLE private.layan_admin_requests
  ADD COLUMN IF NOT EXISTS execution_token uuid,
  ADD COLUMN IF NOT EXISTS execution_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS execution_started_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE private.layan_admin_requests
  DROP CONSTRAINT IF EXISTS layan_admin_requests_status_check;
ALTER TABLE private.layan_admin_requests
  ADD CONSTRAINT layan_admin_requests_status_check
  CHECK (status IN ('pending','executing','approved','rejected','failed'));

-- Keep the original destructive-action queue compatible with the widened active-request index.
CREATE OR REPLACE FUNCTION private.layan_admin_act(p_action text, p_target text, p_label text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING ERRCODE = '42501';
  END IF;
  IF p_action IN ('delete_user','suspend_user') AND p_target = auth.uid()::text THEN
    RAISE EXCEPTION 'لا يمكنك تنفيذ هذا الإجراء على حسابك' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(private.layan_is_admin_base(), false) THEN
    PERFORM private.layan_admin_perform(p_action, p_target);
    RETURN 'done';
  END IF;
  INSERT INTO private.layan_admin_requests (action, target, target_label, requested_by)
  VALUES (p_action, p_target, left(p_label, 200), auth.uid())
  ON CONFLICT (action, target) WHERE status IN ('pending','executing') DO NOTHING;
  RETURN 'pending';
END
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_request_change(p_label text, p_payload jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_method text := upper(COALESCE(p_payload->>'method', ''));
  v_path text := COALESCE(p_payload->>'path', '');
  v_resource text;
  v_query text;
  v_target text;
  v_target_id text;
  v_allowed_fields text[];
  v_body jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_payload) <> 'object'
     OR (p_payload->'body' IS NOT NULL AND p_payload->'body' <> 'null'::jsonb AND jsonb_typeof(p_payload->'body') <> 'object')
     OR (v_method IN ('POST','PATCH') AND COALESCE(jsonb_typeof(p_payload->'body'),'') <> 'object')
     OR v_method NOT IN ('POST', 'PATCH', 'DELETE')
     OR v_path !~ '^/rest/v1/([a-z_]+|rpc/[a-z_]+)(\?[A-Za-z0-9_.,=()!_:*+&%~-]*)?$'
     OR char_length(p_payload::text) > 20000 THEN
    RAISE EXCEPTION 'طلب تعديل غير صالح' USING ERRCODE = '22023';
  END IF;

  v_resource := split_part(split_part(v_path, '/rest/v1/', 2), '?', 1);
  v_query := CASE WHEN position('?' IN v_path) > 0 THEN split_part(v_path, '?', 2) ELSE '' END;
  v_body := CASE WHEN p_payload->'body' = 'null'::jsonb THEN '{}'::jsonb ELSE COALESCE(p_payload->'body','{}'::jsonb) END;
  IF v_resource LIKE 'rpc/%' THEN
    IF v_method <> 'POST' OR v_query <> ''
       OR split_part(v_resource, '/', 2) NOT IN (
         'layan_admin_crm_save_lead','layan_admin_crm_log_activity',
         'layan_admin_crm_restore_lead','layan_admin_crm_archive_lead',
         'layan_admin_review_property_offer','layan_activate_supplier_ad',
         'layan_reject_supplier_ad','layan_admin_set_offer_trust_badge',
         'layan_review_company_profile','layan_admin_review_edit',
         'directory_admin_mutate_with_audit','layan_approve_free_trial_ad',
         'layan_admin_review_logo','company_claim_admin_review',
         'company_entity_profile_update_admin_review','company_project_request_admin_review',
         'company_project_unit_request_admin_review','property_offer_project_unit_request_admin_review','layan_reorder_supplier_ads'
       ) THEN
      RAISE EXCEPTION 'إجراء الإدارة المطلوب غير مسموح بمراجعته' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF v_resource NOT IN (
      'supplier_ads','property_offers','marketplace_listings','company_property_ads','partner_ad_slots',
      'directory_sources','directory_change_log','directory_entities','directory_projects',
      'directory_areas','directory_opportunities','directory_entity_sources',
      'directory_project_sources','directory_opportunity_sources'
    ) THEN
      RAISE EXCEPTION 'المورد المطلوب غير مسموح بمراجعته' USING ERRCODE = '22023';
    END IF;
    IF v_method IN ('PATCH','DELETE') AND (v_query = '' OR v_query !~ '(^|&)id=eq\.[0-9a-fA-F-]+(&|$)') THEN
      RAISE EXCEPTION 'تعديل أو حذف السجل يتطلب معرّفًا محددًا' USING ERRCODE = '22023';
    END IF;
    IF v_method = 'POST' AND v_query <> '' AND v_query !~ '^(select=id|on_conflict=[a-z_,]+)$' THEN
      RAISE EXCEPTION 'خيارات الإضافة غير مسموح بها' USING ERRCODE = '22023';
    END IF;

    IF (v_resource IN ('directory_entities','directory_projects','directory_areas','directory_opportunities') AND v_method <> 'PATCH')
       OR (v_resource IN ('directory_entity_sources','directory_project_sources','directory_opportunity_sources','directory_change_log') AND v_method <> 'POST')
       OR (v_resource = 'partner_ad_slots' AND v_method <> 'PATCH')
       OR (v_resource IN ('property_offers','marketplace_listings','supplier_ads','company_property_ads') AND v_method NOT IN ('POST','PATCH'))
       OR (v_resource = 'directory_sources' AND v_method NOT IN ('POST','PATCH')) THEN
      RAISE EXCEPTION 'طريقة الكتابة غير مسموح بها لهذا المورد' USING ERRCODE = '22023';
    END IF;

    v_allowed_fields := CASE v_resource
      WHEN 'property_offers' THEN ARRAY[
        'title','property_type','listing_purpose','city','area','area_m2','land_area_m2','bedrooms','bathrooms',
        'land_ownership_authority','land_permit_details','land_utilities','land_zoning','total_price','price_on_request',
        'down_payment','paid_amount','remaining_amount','monthly_installment','assignment_fee','assignment_fee_percentage',
        'discount_amount','discount_percent','developer_name','project_name','latitude','longitude','contact_name',
        'contact_phone','description','governorate','status','verification_status','developer_approval_status','verified_at',
        'is_featured','featured_until','promotion_status','featured_requested','image_urls','photos','document_urls','owner_id','updated_at'
      ]
      WHEN 'marketplace_listings' THEN ARRAY[
        'title','category','listing_type','description','city','area','price','price_period','contact_phone','whatsapp',
        'owner_id','status','is_featured','reviewed_at','reviewed_by','admin_notes','image_urls','details','updated_at'
      ]
      WHEN 'supplier_ads' THEN ARRAY[
        'business_name','category','title','description','contact_phone','target_url','image_url','requested_days',
        'requested_price','price','owner_id','status','plan_code','starts_at','ends_at','updated_at'
      ]
      WHEN 'company_property_ads' THEN ARRAY[
        'business_name','plan_code','owner_id','status','starts_at','ends_at','updated_at'
      ]
      WHEN 'partner_ad_slots' THEN ARRAY['status']
      WHEN 'directory_entities' THEN ARRAY[
        'name_ar','name_en','service_category','marketplace_category','description','website_url','public_phone',
        'public_whatsapp','public_email','public_address','public_logo_url','public_business_hours','public_services',
        'public_coverage_areas','public_gallery_urls','primary_area_id','latitude','longitude','location_precision',
        'location_source_id','location_verified_at','location_public','public_visible','verification_status',
        'last_verified_at','next_review_at'
      ]
      WHEN 'directory_projects' THEN ARRAY[
        'name_ar','name_en','description','location_text','area_id','project_status','latitude','longitude',
        'location_precision','location_source_id','location_verified_at','location_public','public_visible',
        'verification_status','last_verified_at','next_review_at'
      ]
      WHEN 'directory_areas' THEN ARRAY[
        'name_ar','name_en','slug','area_type','description','notes','latitude','longitude','location_precision',
        'location_source_id','location_verified_at','location_public','is_active','public_visible'
      ]
      WHEN 'directory_opportunities' THEN ARRAY[
        'name_ar','city','activity','announcement_date','opportunity_type','source_claimed_status',
        'size_description','terms_as_published','notes','public_visible','verification_status','last_verified_at'
      ]
      WHEN 'directory_sources' THEN ARRAY[
        'title','publisher','source_type','source_url','publication_date','confidence_level','is_public','notes'
      ]
      WHEN 'directory_change_log' THEN ARRAY[
        'table_name','record_id','changed_by','old_values','new_values','reason'
      ]
      WHEN 'directory_entity_sources' THEN ARRAY['entity_id','source_id','claim_key']
      WHEN 'directory_project_sources' THEN ARRAY['project_id','source_id','claim_key']
      WHEN 'directory_opportunity_sources' THEN ARRAY['opportunity_id','source_id','claim_key']
      ELSE NULL
    END;
    IF v_method='DELETE' THEN v_body := '{}'::jsonb; END IF;
    IF jsonb_typeof(v_body) <> 'object'
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_body) AS keys(field_name) WHERE NOT (field_name = ANY(v_allowed_fields))) THEN
      RAISE EXCEPTION 'حقول التعديل تتجاوز قائمة الحقول المسموح بها لهذا المورد' USING ERRCODE = '22023';
    END IF;
    IF v_method='PATCH' AND v_body ? 'owner_id' THEN
      RAISE EXCEPTION 'لا يمكن تغيير مالك السجل من مسار التعديل' USING ERRCODE = '42501';
    END IF;
    IF v_method='POST' AND v_resource IN ('property_offers','marketplace_listings','supplier_ads','company_property_ads') THEN
      IF COALESCE(v_body->>'owner_id','') !~ '^[0-9a-fA-F-]{36}$'
         OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id=(v_body->>'owner_id')::uuid) THEN
        RAISE EXCEPTION 'يجب ربط الإعلان بحساب عميل موجود' USING ERRCODE = '22023';
      END IF;
      IF v_body->>'status' IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'الإعلانات الجديدة يجب أن تدخل قائمة المراجعة بحالة انتظار' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF v_method='POST' AND v_resource='property_offers'
       AND (COALESCE((v_body->>'is_featured')::boolean,false)
         OR v_body->>'verification_status' IS DISTINCT FROM 'pending') THEN
      RAISE EXCEPTION 'إعلان العقار الجديد لا يمكن نشره أو تمييزه قبل المراجعة' USING ERRCODE = '22023';
    END IF;
    IF v_method='POST' AND v_resource='marketplace_listings'
       AND COALESCE((v_body->>'is_featured')::boolean,false) THEN
      RAISE EXCEPTION 'إعلان السوق الجديد لا يمكن تمييزه قبل المراجعة' USING ERRCODE = '22023';
    END IF;
    IF v_method='POST' AND v_resource='supplier_ads' AND v_body->>'plan_code' IS DISTINCT FROM 'custom' THEN
      RAISE EXCEPTION 'طلبات الإعلانات الممولة يجب أن تستخدم الخطة المخصصة للمراجعة' USING ERRCODE = '22023';
    END IF;
    IF v_method='POST' AND v_resource='company_property_ads' AND v_body->>'plan_code' IS DISTINCT FROM 'trial_30' THEN
      RAISE EXCEPTION 'طلب إعلان الشركة يجب أن يدخل كتجربة للمراجعة' USING ERRCODE = '22023';
    END IF;
    IF v_method='PATCH' AND v_resource='marketplace_listings' AND v_body ? 'status' THEN
      IF COALESCE(v_body->>'status','') NOT IN ('approved','rejected') THEN
        RAISE EXCEPTION 'حالة مراجعة إعلان السوق غير صالحة' USING ERRCODE = '22023';
      END IF;
      v_body := jsonb_set(jsonb_set(v_body,'{reviewed_by}',to_jsonb(auth.uid()),true),'{reviewed_at}',to_jsonb(now()),true);
    END IF;
    IF v_method='PATCH' AND v_resource='company_property_ads' AND v_body ? 'status'
       AND COALESCE(v_body->>'status','') NOT IN ('active','rejected') THEN
      RAISE EXCEPTION 'حالة إعلان الشركة غير صالحة' USING ERRCODE = '22023';
    END IF;
    IF v_method='PATCH' AND v_resource='partner_ad_slots' AND COALESCE(v_body->>'status','') NOT IN ('active','paused') THEN
      RAISE EXCEPTION 'حالة المساحة الإعلانية غير صالحة' USING ERRCODE = '22023';
    END IF;
    IF v_resource='directory_change_log' AND v_method='POST' THEN
      v_body := jsonb_set(v_body,'{changed_by}',to_jsonb(auth.uid()),true);
    END IF;
  END IF;

  -- Stable target keys prevent a second pending/executing request for the same write.
  IF v_resource LIKE 'rpc/%' THEN
    v_target_id := COALESCE(
      p_payload->'body'->>'p_request_id', p_payload->'body'->>'p_id',
      p_payload->'body'->>'p_ad_id', p_payload->'body'->>'p_offer_id',
      p_payload->'body'->>'p_edit_id', p_payload->'body'->>'p_lead_id',
      p_payload->'body'->>'p_entity_id', p_payload->'body'->>'p_project_id',
      p_payload->'body'->>'p_company_id'
    );
    v_target := 'chg:rpc:' || left(split_part(v_resource,'/',2),35) || ':' ||
      md5(COALESCE(v_target_id, jsonb_build_object('path',v_path,'body',v_body)::text));
  ELSIF v_method IN ('PATCH','DELETE') THEN
    v_target_id := (regexp_match(v_query,'(^|&)id=eq\.([^&]+)'))[2];
    v_target := 'chg:' || left(v_resource,35) || ':' || md5(COALESCE(v_target_id,''));
  ELSE
    v_target := 'chg:post:' || left(v_resource,30) || ':' ||
      md5(jsonb_build_object('path',v_path,'body',v_body)::text);
  END IF;

  INSERT INTO private.layan_admin_requests (action, target, target_label, requested_by, payload)
  VALUES ('change', v_target, left(COALESCE(p_label, 'تعديل'), 200), auth.uid(),
          jsonb_build_object('method', v_method, 'path', v_path, 'body', v_body,
                             'prefer', 'return=minimal'))
  ON CONFLICT (action,target) WHERE status IN ('pending','executing') DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'يوجد طلب تعديل نشط بالفعل على نفس العنصر. راجع الطلب السابق قبل تكرار العملية.' USING ERRCODE='23505';
  END IF;
  RETURN 'pending';
END
$function$;
REVOKE ALL ON FUNCTION public.layan_admin_request_change(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_request_change(text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.layan_admin_claim_change(p_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_token uuid := gen_random_uuid();
  v_payload jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_owner() THEN
    RAISE EXCEPTION 'اعتماد الطلبات متاح للمدير فقط' USING ERRCODE = '42501';
  END IF;
  UPDATE private.layan_admin_requests
     SET status = 'executing',
         execution_token = v_token,
         execution_started_at = now(),
         execution_started_by = auth.uid(),
         note = NULL
   WHERE id = p_id AND action = 'change' AND status = 'pending'
  RETURNING payload INTO v_payload;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود أو تم حجزه أو البت فيه بالفعل' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('id', p_id, 'execution_token', v_token, 'payload', v_payload);
END
$function$;
REVOKE ALL ON FUNCTION public.layan_admin_claim_change(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_claim_change(bigint) TO authenticated;

DROP FUNCTION IF EXISTS public.layan_admin_finish_change(bigint, boolean, text);
CREATE OR REPLACE FUNCTION public.layan_admin_finish_change(
  p_id bigint, p_execution_token uuid, p_ok boolean, p_note text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_owner() THEN
    RAISE EXCEPTION 'اعتماد الطلبات متاح للمدير فقط' USING ERRCODE = '42501';
  END IF;
  UPDATE private.layan_admin_requests
     SET status = CASE WHEN p_ok THEN 'approved' ELSE 'failed' END,
         decided_by = auth.uid(),
         decided_at = now(),
         note = left(p_note, 300)
   WHERE id = p_id
     AND action = 'change'
     AND status = 'executing'
     AND execution_token = p_execution_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'رمز التنفيذ غير صالح أو الطلب ليس محجوزًا لهذه العملية' USING ERRCODE = 'P0002';
  END IF;
  RETURN CASE WHEN p_ok THEN 'approved' ELSE 'failed' END;
END
$function$;
REVOKE ALL ON FUNCTION public.layan_admin_finish_change(bigint, uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_finish_change(bigint, uuid, boolean, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
