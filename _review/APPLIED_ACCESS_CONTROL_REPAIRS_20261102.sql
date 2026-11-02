-- ASYUT AQAR — production access-control repair audit copy
-- Applied to Supabase production project ebyhwqkmhxbgocngpqfe on 2026-11-02.
-- This file is an audit/traceability copy only. Do not re-apply it blindly.

-- Migration: 20261102040339_tighten_public_table_grants_20261102
-- Remove broad table privileges and grant only operations used by the app.
REVOKE ALL PRIVILEGES ON TABLE public.user_favorite_offers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.user_favorite_offers TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.buyer_offer_alerts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.buyer_offer_alerts TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.company_profiles_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.company_profiles_public TO anon, authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.public_active_supplier_ads FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.public_active_supplier_ads TO anon, authenticated;

-- Final policy state:
-- Migrations 20261102040527 and 20261102040606 resulted in split policies.
-- Anonymous users must not need EXECUTE on public.layan_is_admin().
DROP POLICY IF EXISTS company_profiles_read_scope ON public.company_profiles;
CREATE POLICY company_profiles_read_scope
ON public.company_profiles
FOR SELECT
TO anon, authenticated
USING (
  status = 'active'
  OR owner_id = (SELECT auth.uid())
);

DROP POLICY IF EXISTS company_profiles_admin_read ON public.company_profiles;
CREATE POLICY company_profiles_admin_read
ON public.company_profiles
FOR SELECT
TO authenticated
USING (public.layan_is_admin());

-- Verification performed after application:
-- * anonymous SELECT on company_profiles succeeds and returns only policy-visible rows;
-- * anonymous SELECT on company_profiles_public succeeds;
-- * anon has no SELECT/INSERT/UPDATE/DELETE/TRUNCATE privileges on user_favorite_offers;
-- * authenticated has SELECT/INSERT/DELETE on favorites, but no UPDATE/TRUNCATE;
-- * authenticated has SELECT/INSERT/UPDATE/DELETE on buyer_offer_alerts, but no TRUNCATE;
-- * directory views are SELECT-only for anon/authenticated.
-- * company_profiles_read_scope is limited to active rows or auth.uid() ownership;
-- * company_profiles_admin_read applies only to authenticated users and calls layan_is_admin().
