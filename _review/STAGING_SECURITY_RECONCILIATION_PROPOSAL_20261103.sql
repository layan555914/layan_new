-- NOT APPLIED — STAGING ONLY — REQUIRES EXPLICIT USER APPROVAL.
-- Target: Supabase project wisnmlbefdrkcbbqvdlg (layan-claude-test).
-- Purpose: reconcile the known marketplace RLS and supplier-ad RPC differences
-- with the production catalog snapshot without changing Auth users, admin membership,
-- table grants, Storage buckets, production, or Edge Function source.
--
-- IMPORTANT:
-- 1. Do not run this file against production.
-- 2. This file intentionally includes DROP POLICY and DROP FUNCTION statements.
-- 3. It changes authorization behaviour and callable RPC definitions.
-- 4. Apply only after the user separately approves this exact staging security/function change.
-- 5. Review the current admin frontend callers and run tests immediately after applying.
--
-- Preserved by design:
-- - Existing private.layan_admins rows (currently zero); no administrator is added.
-- - Existing Auth user and identity.
-- - Existing table grants and RLS enablement.
-- - Existing private helper functions; no account or role changes.
-- - Existing marketplace rows (currently zero), indexes and non-conflicting constraints.

BEGIN;

-- A. Restore production-equivalent marketplace policies.
-- Remove only the five known legacy test policies on this table.
DROP POLICY IF EXISTS "admins manage marketplace listings" ON public.marketplace_listings;
DROP POLICY IF EXISTS "owners read own marketplace listings" ON public.marketplace_listings;
DROP POLICY IF EXISTS "owners submit marketplace listings" ON public.marketplace_listings;
DROP POLICY IF EXISTS "owners update own unapproved marketplace listings" ON public.marketplace_listings;
DROP POLICY IF EXISTS "public read approved marketplace listings" ON public.marketplace_listings;

CREATE POLICY "Owners can submit pending marketplace listings"
ON public.marketplace_listings
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  ((SELECT auth.uid()) = owner_id)
  AND status = 'pending'
  AND is_featured = false
  AND reviewed_at IS NULL
  AND reviewed_by IS NULL
  AND admin_notes IS NULL
);

CREATE POLICY "marketplace_listings_authenticated_read"
ON public.marketplace_listings
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  status = 'approved'
  OR owner_id = (SELECT auth.uid())
  OR public.layan_is_admin()
);

CREATE POLICY "marketplace_listings_public_read"
ON public.marketplace_listings
AS PERMISSIVE
FOR SELECT
TO anon
USING (status = 'approved');

CREATE POLICY "marketplace_listings_update_scope"
ON public.marketplace_listings
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  public.layan_is_admin()
  OR (
    owner_id = (SELECT auth.uid())
    AND status IN ('pending','rejected')
  )
)
WITH CHECK (
  public.layan_is_admin()
  OR (
    owner_id = (SELECT auth.uid())
    AND status = 'pending'
    AND is_featured = false
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
  )
);

-- B. Align the admin predicate wrapper with production.
-- Keep existing private helpers and the empty admin allowlist unchanged.
CREATE OR REPLACE FUNCTION public.layan_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT private.layan_is_admin();
$function$;

-- C. The old staging RPCs return void and reference columns not present in supplier_ads.
-- PostgreSQL cannot change a function's return type with CREATE OR REPLACE,
-- so the exact signatures must be dropped and recreated after the dependency check.
-- Prior catalog inspection found no SQL-object dependencies on these two public wrappers.

DROP FUNCTION IF EXISTS public.layan_activate_supplier_ad(uuid, integer, numeric);

CREATE FUNCTION public.layan_activate_supplier_ad(
  p_ad_id uuid,
  p_days integer,
  p_price numeric
)
RETURNS jsonb
LANGUAGE sql
SET search_path TO ''
AS $function$
  SELECT private.layan_activate_supplier_ad(p_ad_id, p_days, p_price);
$function$;

DROP FUNCTION IF EXISTS public.layan_reject_supplier_ad(uuid, text);

CREATE FUNCTION public.layan_reject_supplier_ad(
  p_ad_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM private.layan_admins a WHERE a.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'غير مصرح: يلزم حساب إدارة معتمد';
  END IF;

  IF length(trim(coalesce(p_reason, ''))) < 3 OR length(p_reason) > 500 THEN
    RAISE EXCEPTION 'اكتب سبب رفض واضحًا';
  END IF;

  UPDATE public.supplier_ads
  SET status = 'rejected',
      updated_at = now()
  WHERE id = p_ad_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الإعلان غير موجود أو ليس قيد المراجعة';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ad_id', p_ad_id,
    'status', 'rejected'
  );
END;
$function$;

-- D. Remove public/anonymous EXECUTE from admin-facing wrappers.
-- Preserve authenticated and service_role grants as in production.
REVOKE ALL ON FUNCTION public.layan_activate_supplier_ad(uuid, integer, numeric)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_activate_supplier_ad(uuid, integer, numeric)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.layan_reject_supplier_ad(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_reject_supplier_ad(uuid, text)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.layan_admin_list_company_profiles()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.layan_admin_review_property_offer(bigint, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.layan_approve_free_trial_ad(uuid)
  FROM PUBLIC, anon;

-- PostgreSQL grants EXECUTE to PUBLIC on newly created functions by default.
-- Explicitly assert that anonymous execution is absent from the two supplier RPCs.
DO $verify$
BEGIN
  IF has_function_privilege('anon',
      'public.layan_activate_supplier_ad(uuid,integer,numeric)','EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute layan_activate_supplier_ad';
  END IF;
  IF has_function_privilege('anon',
      'public.layan_reject_supplier_ad(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute layan_reject_supplier_ad';
  END IF;
  IF NOT has_function_privilege('authenticated',
      'public.layan_activate_supplier_ad(uuid,integer,numeric)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated lost layan_activate_supplier_ad execute';
  END IF;
  IF NOT has_function_privilege('authenticated',
      'public.layan_reject_supplier_ad(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated lost layan_reject_supplier_ad execute';
  END IF;
END;
$verify$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Post-apply verification checklist (run separately as read-only SQL):
-- 1. marketplace_listings has exactly the four production policy names above.
-- 2. INSERT policy checks is_featured=false, reviewed_at IS NULL, reviewed_by IS NULL,
--    admin_notes IS NULL.
-- 3. UPDATE WITH CHECK enforces is_featured=false and null review fields.
-- 4. supplier RPC return types are jsonb and no longer reference nonexistent supplier_ads columns.
-- 5. anon/PUBLIC cannot execute supplier-ad RPCs; authenticated/service_role can.
-- 6. Auth user count remains 1; private.layan_admins remains empty.
-- 7. No application rows or Storage objects were inserted, updated or removed.
