-- ASYUT AQAR reviewed database repair proposal
-- Target: production project ebyhwqkmhxbgocngpqfe
-- IMPORTANT: review only. This file is not applied to production by this commit.
-- Prerequisites verified against the current production catalog on 2026-11-01:
--   public.enforce_layan_offer_limit() (reviewed but intentionally not wired)
--   public.enforce_company_property_ad_limit()
--   public.guard_property_offer_promotion()
--   public.guard_company_owner_update()
--   public.set_company_profiles_updated_at()
--   public.layan_is_admin()
--
-- The company profile SELECT is handled in companies.js using the existing
-- owner-scoped SELECT policy. No SECURITY DEFINER RPC is needed.

begin;

-- 1) Restore owner edits for active company profiles.
-- The BEFORE UPDATE guard keeps approved public fields unchanged and accepts
-- edits only through pending_update. Admins retain their existing path.
drop policy if exists company_profiles_update_scope on public.company_profiles;
create policy company_profiles_update_scope
on public.company_profiles
for update
to authenticated
using (
  public.layan_is_admin()
  or (
    owner_id = (select auth.uid())
    and status in ('pending','needs_changes','rejected','active')
  )
)
with check (
  public.layan_is_admin()
  or (
    owner_id = (select auth.uid())
    and status in ('pending','needs_changes','rejected','active')
  )
);

-- 2) Wire only the company-ad limit and promotion-state guards.
-- The account-wide offer cap is intentionally excluded until plan semantics
-- are confirmed; see note below.
-- Names are prefixed to make BEFORE INSERT trigger execution order explicit.
drop trigger if exists a_property_offer_promotion_guard on public.property_offers;
create trigger a_property_offer_promotion_guard
before insert on public.property_offers
for each row execute function public.guard_property_offer_promotion();

-- NOT wired here: enforce_layan_offer_limit() currently caps every owner at
-- three offers forever, regardless of plan_code/trial expiry. The product rules
-- and plan-aware enforcement must be confirmed before enabling this limit.

drop trigger if exists c_property_offer_company_limit on public.property_offers;
create trigger c_property_offer_company_limit
before insert on public.property_offers
for each row execute function public.enforce_company_property_ad_limit();

-- 3) Protect company-profile updates through the existing guard.
drop trigger if exists company_profiles_owner_update_guard on public.company_profiles;
create trigger company_profiles_owner_update_guard
before update on public.company_profiles
for each row execute function public.guard_company_owner_update();

-- 4) Keep company profile timestamps current.
drop trigger if exists company_profiles_set_updated_at on public.company_profiles;
create trigger company_profiles_set_updated_at
before update on public.company_profiles
for each row execute function public.set_company_profiles_updated_at();

commit;

-- Post-apply verification (run separately after approval/application):
-- select c.relname,t.tgname,pg_get_triggerdef(t.oid)
-- from pg_trigger t join pg_class c on c.oid=t.tgrelid
-- join pg_namespace n on n.oid=c.relnamespace
-- where n.nspname='public' and not t.tgisinternal
--   and c.relname in ('company_profiles','property_offers')
-- order by c.relname,t.tgname;
-- select policyname,cmd,qual,with_check from pg_policies
-- where schemaname='public' and tablename='company_profiles';

-- Additional release blocker found during constraint review:
-- company_profiles has no UNIQUE(owner_id) constraint/index. The UI currently
-- models one company profile per signed-in owner, but the database does not
-- enforce that assumption. Do not add UNIQUE(owner_id) until the product owner
-- confirms whether one account may register multiple companies and duplicate
-- existing records have been checked.
