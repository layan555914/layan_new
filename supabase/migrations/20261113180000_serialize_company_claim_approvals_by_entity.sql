-- Serialize approvals for one company directory entity.
-- This prevents concurrent claims from being approved for conflicting representatives.
CREATE OR REPLACE FUNCTION private.company_claim_admin_review(
  p_id uuid,
  p_action text,
  p_note text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_request public.company_claim_requests%rowtype;
  v_existing_owner uuid;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 1000), '');
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING errcode = '42501';
  END IF;

  IF p_action NOT IN ('approve', 'request_info', 'reject') THEN
    RAISE EXCEPTION 'الإجراء المطلوب غير صحيح' USING errcode = '22023';
  END IF;

  SELECT *
    INTO v_request
    FROM public.company_claim_requests
   WHERE id = p_id AND status = 'pending'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود أو تم البت فيه بالفعل' USING errcode = 'P0002';
  END IF;

  IF p_action IN ('request_info', 'reject') AND char_length(coalesce(v_note, '')) < 3 THEN
    RAISE EXCEPTION 'اكتب ملاحظة واضحة من 3 أحرف على الأقل' USING errcode = '22023';
  END IF;

  IF p_action = 'approve' THEN
    -- Lock the company row before checking the manager link. Every approval for
    -- this entity now serializes here, even if the requests have different IDs.
    PERFORM 1
      FROM public.directory_entities e
     WHERE e.id = v_request.directory_entity_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'سجل الشركة غير موجود؛ تعذر اعتماد طلب الاستلام' USING errcode = 'P0002';
    END IF;

    SELECT m.owner_user_id
      INTO v_existing_owner
      FROM public.company_entity_managers m
     WHERE m.directory_entity_id = v_request.directory_entity_id;

    IF FOUND AND v_existing_owner <> v_request.requester_user_id THEN
      RAISE EXCEPTION 'هذا الملف مرتبط بالفعل بحساب ممثل آخر؛ راجع الإدارة قبل أي تغيير' USING errcode = '23505';
    END IF;

    INSERT INTO public.company_entity_managers (
      directory_entity_id, owner_user_id, claim_request_id, approved_by, approved_at
    )
    VALUES (
      v_request.directory_entity_id, v_request.requester_user_id, v_request.id, auth.uid(), now()
    )
    ON CONFLICT (directory_entity_id) DO NOTHING;

    UPDATE public.company_claim_requests
       SET status = 'approved',
           admin_notes = CASE
             WHEN v_note IS NULL THEN admin_notes
             ELSE concat_ws(E'\n\n', nullif(admin_notes, ''), v_note)
           END,
           reviewed_by = auth.uid(),
           reviewed_at = now(),
           updated_at = now()
     WHERE id = v_request.id;

    RETURN 'approved';
  ELSIF p_action = 'request_info' THEN
    UPDATE public.company_claim_requests
       SET admin_notes = concat_ws(E'\n\n', nullif(admin_notes, ''), v_note),
           reviewed_by = auth.uid(),
           reviewed_at = now(),
           updated_at = now()
     WHERE id = v_request.id;

    RETURN 'info_requested';
  ELSE
    UPDATE public.company_claim_requests
       SET status = 'rejected',
           admin_notes = concat_ws(E'\n\n', nullif(admin_notes, ''), v_note),
           reviewed_by = auth.uid(),
           reviewed_at = now(),
           updated_at = now()
     WHERE id = v_request.id;

    RETURN 'rejected';
  END IF;
END;
$function$;
