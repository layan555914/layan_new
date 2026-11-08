-- ASYUT AQAR — 2026-11-08
-- 1) A company ad can link any number of properties (was max 3). Ownership and status checks stay.
-- 2) Admin can delete a published company profile; added admins go through owner approval
--    (same request flow as other deletions).
-- Additive and safe to re-run. Rollback: re-create the previous function body (in the audit report).

CREATE OR REPLACE FUNCTION public.enforce_company_property_ad_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
declare
  v_owner uuid;
  v_status text;
begin
  if new.company_ad_id is null then
    return new;
  end if;
  select c.owner_id, c.status into v_owner, v_status
  from public.company_property_ads c where c.id = new.company_ad_id;
  if not found then
    raise exception 'إعلان الشركة غير موجود. ابدأ طلب إعلان شركة جديد.';
  end if;
  if v_owner is distinct from new.owner_id then
    raise exception 'لا يمكنك إضافة عقار إلى إعلان شركة لا تملكه.';
  end if;
  if v_status not in ('pending', 'active') then
    raise exception 'إعلان الشركة غير نشط. أرسل طلب إعلان شركة جديدًا.';
  end if;
  -- No limit on the number of properties per company ad.
  return new;
end;
$function$;

-- Allow the new request type.
ALTER TABLE private.layan_admin_requests DROP CONSTRAINT IF EXISTS layan_admin_requests_action_check;
ALTER TABLE private.layan_admin_requests ADD CONSTRAINT layan_admin_requests_action_check
  CHECK (action IN ('delete_user','suspend_user','unsuspend_user','delete_offer','delete_service','delete_company'));

CREATE OR REPLACE FUNCTION private.layan_admin_perform(p_action text, p_target text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF p_action = 'delete_user' THEN
    DELETE FROM auth.users WHERE id = p_target::uuid;
  ELSIF p_action = 'suspend_user' THEN
    UPDATE auth.users SET banned_until = now() + interval '100 years' WHERE id = p_target::uuid;
  ELSIF p_action = 'unsuspend_user' THEN
    UPDATE auth.users SET banned_until = NULL WHERE id = p_target::uuid;
  ELSIF p_action = 'delete_offer' THEN
    DELETE FROM public.property_offers WHERE id = p_target::bigint;
  ELSIF p_action = 'delete_service' THEN
    DELETE FROM public.marketplace_listings WHERE id = p_target::uuid;
  ELSIF p_action = 'delete_company' THEN
    DELETE FROM public.company_profiles WHERE id = p_target::uuid;
  ELSE
    RAISE EXCEPTION 'إجراء غير معروف' USING ERRCODE = '22023';
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'العنصر غير موجود أو حُذف بالفعل' USING ERRCODE = 'P0002'; END IF;
END
$function$;
REVOKE ALL ON FUNCTION private.layan_admin_perform(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.layan_admin_delete_company_profile(p_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT private.layan_admin_act('delete_company', p_id::text, (SELECT c.company_name FROM public.company_profiles c WHERE c.id = p_id));
$function$;
REVOKE ALL ON FUNCTION public.layan_admin_delete_company_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_delete_company_profile(uuid) TO authenticated;

-- Published companies for the admin "published" view (admins only).
CREATE OR REPLACE FUNCTION public.layan_admin_list_published_companies()
RETURNS TABLE (id uuid, company_name text, category text, city text, phone text, owner_id uuid, status text, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT c.id, c.company_name, c.category, c.city, c.phone, c.owner_id, c.status, c.created_at
  FROM public.company_profiles c WHERE c.status = 'active' ORDER BY c.created_at DESC;
END
$function$;
REVOKE ALL ON FUNCTION public.layan_admin_list_published_companies() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_list_published_companies() TO authenticated;
