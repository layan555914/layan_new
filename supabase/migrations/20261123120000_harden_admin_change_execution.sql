-- ASYUT AQAR: reserve an owner-approved admin change before any external REST side effect.
-- A request in "executing" is never silently returned to the pending queue. If the owner
-- loses connectivity after the side effect, the request remains locked for manual reconciliation;
-- this intentionally favors preventing duplicate destructive writes over automatic replay.

DROP INDEX IF EXISTS private.layan_admin_requests_one_active_change;
CREATE UNIQUE INDEX IF NOT EXISTS layan_admin_requests_one_pending
  ON private.layan_admin_requests (action, target) WHERE status='pending';
CREATE UNIQUE INDEX layan_admin_requests_one_active_change
  ON private.layan_admin_requests (action, target)
  WHERE action='change' AND status IN ('pending','executing');

ALTER TABLE private.layan_admin_requests
  ADD COLUMN IF NOT EXISTS execution_token uuid,
  ADD COLUMN IF NOT EXISTS execution_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS execution_started_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE private.layan_admin_requests
  DROP CONSTRAINT IF EXISTS layan_admin_requests_status_check;
ALTER TABLE private.layan_admin_requests
  ADD CONSTRAINT layan_admin_requests_status_check
  CHECK (status IN ('pending','executing','approved','rejected','failed'));

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
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_payload) <> 'object'
     OR (p_payload->'body' IS NOT NULL AND p_payload->'body' <> 'null'::jsonb AND jsonb_typeof(p_payload->'body') <> 'object')
     OR v_method NOT IN ('POST', 'PATCH', 'DELETE')
     OR v_path !~ '^/rest/v1/([a-z_]+|rpc/[a-z_]+)(\?[A-Za-z0-9_.,=()!_:*+&%~-]*)?$'
     OR char_length(p_payload::text) > 20000 THEN
    RAISE EXCEPTION 'طلب تعديل غير صالح' USING ERRCODE = '22023';
  END IF;

  v_resource := split_part(split_part(v_path, '/rest/v1/', 2), '?', 1);
  v_query := CASE WHEN position('?' IN v_path) > 0 THEN split_part(v_path, '?', 2) ELSE '' END;
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
      'platform_sponsors','supplier_ads','property_offers','marketplace_listings',
      'company_profiles','company_property_ads','company_entity_profile_update_requests',
      'partner_ad_slots','directory_sources','directory_change_log','directory_entities',
      'directory_projects','directory_areas','directory_opportunities','directory_entity_sources',
      'directory_project_sources','directory_opportunity_sources'
    ) THEN
      RAISE EXCEPTION 'المورد المطلوب غير مسموح بمراجعته' USING ERRCODE = '22023';
    END IF;
    IF v_method IN ('PATCH','DELETE') AND (v_query = '' OR v_query !~ '(^|&)id=eq\.[0-9a-fA-F-]+(&|$)') THEN
      RAISE EXCEPTION 'تعديل أو حذف السجل يتطلب معرّفًا محددًا' USING ERRCODE = '22023';
    END IF;
    IF v_method = 'POST' AND v_query <> '' AND v_query !~ '^on_conflict=[a-z_,]+$' THEN
      RAISE EXCEPTION 'خيارات الإضافة غير مسموح بها' USING ERRCODE = '22023';
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
      md5(COALESCE(v_target_id, jsonb_build_object('path',v_path,'body',p_payload->'body')::text));
  ELSIF v_method IN ('PATCH','DELETE') THEN
    v_target_id := (regexp_match(v_query,'(^|&)id=eq\.([^&]+)'))[2];
    v_target := 'chg:' || left(v_resource,35) || ':' || md5(COALESCE(v_target_id,''));
  ELSE
    v_target := 'chg:post:' || left(v_resource,30) || ':' ||
      md5(jsonb_build_object('path',v_path,'body',p_payload->'body')::text);
  END IF;

  INSERT INTO private.layan_admin_requests (action, target, target_label, requested_by, payload)
  VALUES ('change', v_target, left(COALESCE(p_label, 'تعديل'), 200), auth.uid(),
          jsonb_build_object('method', v_method, 'path', v_path, 'body', p_payload->'body',
                             'prefer', 'return=minimal'))
  ON CONFLICT (action,target) WHERE action='change' AND status IN ('pending','executing') DO NOTHING;
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
