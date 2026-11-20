-- Enforce the same developer/marketing project-role contract in PostgreSQL
-- that the company-profile UI already presents. This closes direct-RPC bypasses.
--
-- Developer files may create new projects and request links as developer/land_owner.
-- Marketing files may only request links as marketing_agent/sales_agent.
-- A new-project approval rechecks the same contract before the request is approved.

CREATE OR REPLACE FUNCTION private.enforce_company_project_request_role_contract()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_entity_type text;
  v_service_category text;
  v_is_developer boolean;
  v_is_marketing boolean;
BEGIN
  -- Re-check at the moment of approval, but do not prevent administrators from
  -- returning or rejecting an older request if its company profile has changed.
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  SELECT e.entity_type, e.service_category
    INTO v_entity_type, v_service_category
  FROM public.directory_entities e
  WHERE e.id = NEW.directory_entity_id
    AND e.public_visible = true
    AND e.verification_status = 'published';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ملف الشركة لم يعد منشورًا ومعتمدًا؛ لا يمكن إرسال الطلب أو اعتماده'
      USING ERRCODE = '42501';
  END IF;

  -- Keep the same precedence as the profile UI: a developer classification
  -- wins if legacy type/category fields happen to disagree.
  v_is_developer :=
    coalesce(v_entity_type = 'developer', false)
    OR coalesce(v_service_category = 'real_estate_development', false);

  v_is_marketing :=
    coalesce(v_entity_type IN ('marketing', 'brokerage', 'sales_office'), false)
    OR coalesce(v_service_category IN (
      'real_estate_marketing',
      'real_estate_brokerage',
      'real_estate_sales'
    ), false);

  IF NEW.request_type = 'new_project' THEN
    IF NOT v_is_developer THEN
      RAISE EXCEPTION 'ملف التسويق لا يمكنه إنشاء مشروع جديد؛ يمكنه طلب ربط مشروع منشور فقط'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.requested_relation_type NOT IN ('developer', 'land_owner') THEN
      RAISE EXCEPTION 'صفة ملف التطوير العقاري داخل المشروع يجب أن تكون المطور أو مالك الأرض'
        USING ERRCODE = '42501';
    END IF;

  ELSIF NEW.request_type = 'link_project' THEN
    IF v_is_developer THEN
      IF NEW.requested_relation_type NOT IN ('developer', 'land_owner') THEN
        RAISE EXCEPTION 'صفة ملف التطوير العقاري داخل المشروع يجب أن تكون المطور أو مالك الأرض'
          USING ERRCODE = '42501';
      END IF;
    ELSIF v_is_marketing THEN
      IF NEW.requested_relation_type NOT IN ('marketing_agent', 'sales_agent') THEN
        RAISE EXCEPTION 'صفة ملف التسويق داخل المشروع يجب أن تكون وكيل تسويق أو وكيل مبيعات'
          USING ERRCODE = '42501';
      END IF;
    ELSE
      RAISE EXCEPTION 'طلبات ربط المشروعات متاحة لملفات التطوير أو التسويق العقاري المعتمدة فقط'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'نوع طلب المشروع غير مدعوم'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$;

-- Trigger-only function: no direct API execution path is needed or granted.
REVOKE ALL ON FUNCTION private.enforce_company_project_request_role_contract()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS company_project_request_role_contract
  ON private.company_project_requests;

CREATE TRIGGER company_project_request_role_contract
BEFORE INSERT OR UPDATE OF
  directory_entity_id,
  request_type,
  requested_relation_type,
  status
ON private.company_project_requests
FOR EACH ROW
EXECUTE FUNCTION private.enforce_company_project_request_role_contract();
