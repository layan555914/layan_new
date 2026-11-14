-- Reconcile the company-claim feature schema for clean installs and existing environments.
-- This forward migration is intentionally idempotent. It does not change application data.
-- Historical migration timestamps differ between production and test; this migration
-- converges both environments on the same final schema.

CREATE TABLE IF NOT EXISTS public.company_claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_entity_id uuid NOT NULL REFERENCES public.directory_entities(id) ON DELETE RESTRICT,
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  representative_name text NOT NULL,
  representative_role text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_claim_requests_representative_name_check
    CHECK (char_length(btrim(representative_name)) BETWEEN 3 AND 120),
  CONSTRAINT company_claim_requests_representative_role_check
    CHECK (char_length(btrim(representative_role)) BETWEEN 2 AND 80),
  CONSTRAINT company_claim_requests_contact_phone_check
    CHECK (
      char_length(btrim(contact_phone)) BETWEEN 7 AND 30
      AND char_length(regexp_replace(contact_phone, '[^0-9]', '', 'g')) BETWEEN 7 AND 20
    ),
  CONSTRAINT company_claim_requests_contact_email_check
    CHECK (contact_email IS NULL OR char_length(btrim(contact_email)) <= 160),
  CONSTRAINT company_claim_requests_notes_check
    CHECK (notes IS NULL OR char_length(notes) <= 600),
  CONSTRAINT company_claim_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE TABLE IF NOT EXISTS public.company_entity_managers (
  directory_entity_id uuid PRIMARY KEY
    REFERENCES public.directory_entities(id) ON DELETE RESTRICT,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_request_id uuid NOT NULL UNIQUE
    REFERENCES public.company_claim_requests(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_claim_requests_entity_idx
  ON public.company_claim_requests (directory_entity_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS company_claim_requests_one_pending_per_user_entity
  ON public.company_claim_requests (directory_entity_id, requester_user_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS company_claim_requests_requester_user_id_idx
  ON public.company_claim_requests (requester_user_id);
CREATE INDEX IF NOT EXISTS company_claim_requests_reviewed_by_idx
  ON public.company_claim_requests (reviewed_by)
  WHERE reviewed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS company_claim_requests_status_created_idx
  ON public.company_claim_requests (status, created_at);
CREATE INDEX IF NOT EXISTS company_entity_managers_approved_by_idx
  ON public.company_entity_managers (approved_by)
  WHERE approved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS company_entity_managers_owner_user_id_idx
  ON public.company_entity_managers (owner_user_id);

ALTER TABLE public.company_claim_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_entity_managers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.company_claim_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.company_entity_managers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.company_claim_requests TO authenticated;
GRANT SELECT ON TABLE public.company_entity_managers TO authenticated;

DROP POLICY IF EXISTS company_claim_requests_read_own_or_admin
  ON public.company_claim_requests;
CREATE POLICY company_claim_requests_read_own_or_admin
  ON public.company_claim_requests
  FOR SELECT TO authenticated
  USING (requester_user_id = (SELECT auth.uid()) OR public.layan_is_admin());

DROP POLICY IF EXISTS company_claim_requests_insert_own_pending
  ON public.company_claim_requests;
CREATE POLICY company_claim_requests_insert_own_pending
  ON public.company_claim_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_user_id = (SELECT auth.uid())
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND admin_notes IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.directory_entities e
      WHERE e.id = company_claim_requests.directory_entity_id
        AND e.public_visible = true
        AND e.verification_status = 'published'
    )
  );

DROP POLICY IF EXISTS company_entity_managers_read_own_or_admin
  ON public.company_entity_managers;
CREATE POLICY company_entity_managers_read_own_or_admin
  ON public.company_entity_managers
  FOR SELECT TO authenticated
  USING (owner_user_id = (SELECT auth.uid()) OR public.layan_is_admin());

CREATE OR REPLACE FUNCTION private.company_claim_admin_list()
RETURNS TABLE(
  id uuid,
  directory_entity_id uuid,
  company_name text,
  requester_user_id uuid,
  representative_name text,
  representative_role text,
  contact_phone text,
  contact_email text,
  notes text,
  status text,
  admin_notes text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذه الطلبات متاحة لإدارة أسيوط عقار فقط' USING errcode = '42501';
  END IF;

  RETURN QUERY
    SELECT
      c.id,
      c.directory_entity_id,
      e.name_ar::text,
      c.requester_user_id,
      c.representative_name,
      c.representative_role,
      c.contact_phone,
      c.contact_email,
      c.notes,
      c.status,
      c.admin_notes,
      c.created_at,
      c.reviewed_at,
      c.reviewed_by
    FROM public.company_claim_requests c
    JOIN public.directory_entities e ON e.id = c.directory_entity_id
    WHERE c.status = 'pending'
    ORDER BY c.created_at ASC;
END;
$function$;

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
    -- Serialize approvals for the same company, even when requests have different IDs.
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
             ELSE concat_ws(E'\\n\\n', nullif(admin_notes, ''), v_note)
           END,
           reviewed_by = auth.uid(),
           reviewed_at = now(),
           updated_at = now()
     WHERE id = v_request.id;

    RETURN 'approved';
  ELSIF p_action = 'request_info' THEN
    UPDATE public.company_claim_requests
       SET admin_notes = concat_ws(E'\\n\\n', nullif(admin_notes, ''), v_note),
           reviewed_by = auth.uid(),
           reviewed_at = now(),
           updated_at = now()
     WHERE id = v_request.id;

    RETURN 'info_requested';
  ELSE
    UPDATE public.company_claim_requests
       SET status = 'rejected',
           admin_notes = concat_ws(E'\\n\\n', nullif(admin_notes, ''), v_note),
           reviewed_by = auth.uid(),
           reviewed_at = now(),
           updated_at = now()
     WHERE id = v_request.id;

    RETURN 'rejected';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.company_claim_admin_list()
RETURNS TABLE(
  id uuid,
  directory_entity_id uuid,
  company_name text,
  requester_user_id uuid,
  representative_name text,
  representative_role text,
  contact_phone text,
  contact_email text,
  notes text,
  status text,
  admin_notes text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT * FROM private.company_claim_admin_list();
$function$;

CREATE OR REPLACE FUNCTION public.company_claim_admin_review(
  p_id uuid,
  p_action text,
  p_note text DEFAULT NULL
)
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.company_claim_admin_review(p_id, p_action, p_note);
$function$;

REVOKE ALL ON FUNCTION private.company_claim_admin_list() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.company_claim_admin_review(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.company_claim_admin_list() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.company_claim_admin_review(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.company_claim_admin_list() TO authenticated;
GRANT EXECUTE ON FUNCTION private.company_claim_admin_review(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_claim_admin_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_claim_admin_review(uuid, text, text) TO authenticated;
