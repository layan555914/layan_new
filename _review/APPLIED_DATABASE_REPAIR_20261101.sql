-- ASYUT AQAR — applied repair SQL audit copy
-- Applied to production project ebyhwqkmhxbgocngpqfe as migration
-- 20261101210205_asyut_aqar_company_profile_update_and_property_ad_limit.
-- This is a traceability copy, not a new migration to apply again.
-- Scope:
--   1) Allow an owner of an ACTIVE company profile to submit edits as pending_update.
--   2) Enforce the three-property maximum per company_property_ads row in the DB.
--   3) Preserve the existing promotion-state and company-owner update guards.
--
-- Important frontend/schema alignment:
-- company_profiles is reviewed through pending_update.
-- company_property_ads.business_name is the company account label.
-- property_offers.developer_name is a separate "developer" field, not the
-- company account label. The cap guard therefore validates company_ad_id
-- ownership and status, but MUST NOT compare business_name to developer_name.

begin;

-- Preflight: stop rather than partially applying to a different schema.
do $preflight$
begin
  if to_regclass('public.company_profiles') is null
     or to_regclass('public.company_property_ads') is null
     or to_regclass('public.property_offers') is null then
    raise exception 'Required ASYUT AQAR tables are missing';
  end if;

  if to_regprocedure('public.guard_company_owner_update()') is null
     or to_regprocedure('public.guard_property_offer_promotion()') is null
     or to_regprocedure('public.set_company_profiles_updated_at()') is null
     or to_regprocedure('public.layan_is_admin()') is null then
    raise exception 'A required existing ASYUT AQAR guard function is missing';
  end if;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'company_profiles'
      and c.relrowsecurity
  ) or not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'property_offers'
      and c.relrowsecurity
  ) then
    raise exception 'RLS must remain enabled on company_profiles and property_offers';
  end if;
end
$preflight$;

-- 1) Let an owner PATCH an active profile to submit a review draft.
-- The BEFORE UPDATE trigger below freezes every approved public field and
-- accepts only the allow-listed pending_update JSON object.
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
    and (status = 'active' or reviewed_by is null)
  )
);

-- 2) Enforce the company-ad property cap inside PostgreSQL.
-- The existing implementation incorrectly compared business_name with
-- property_offers.developer_name; those are distinct form fields. Replace
-- that comparison with server-side owner + status validation.
create or replace function public.enforce_company_property_ad_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_owner uuid;
  v_status text;
  v_count bigint;
begin
  if new.company_ad_id is null then
    return new;
  end if;

  -- Serialize inserts for this one company ad to prevent concurrent
  -- requests from both observing a count below three.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.company_ad_id::text, 0)
  );

  select c.owner_id, c.status
    into v_owner, v_status
    from public.company_property_ads c
   where c.id = new.company_ad_id;

  if not found then
    raise exception 'إعلان الشركة غير موجود. ابدأ طلب إعلان شركة جديد.';
  end if;

  if v_owner is distinct from new.owner_id then
    raise exception 'لا يمكنك إضافة عقار إلى إعلان شركة لا تملكه.';
  end if;

  if v_status not in ('pending','active') then
    raise exception 'إعلان الشركة غير نشط. أرسل طلب إعلان شركة جديدًا.';
  end if;

  select pg_catalog.count(*)
    into v_count
    from public.property_offers p
   where p.company_ad_id = new.company_ad_id;

  if v_count >= 3 then
    raise exception 'وصل إعلان الشركة إلى الحد الأقصى: 3 عقارات في الإعلان الواحد.';
  end if;

  return new;
end;
$function$;

-- 3) Wire BEFORE INSERT protections in alphabetical execution order.
drop trigger if exists a_property_offer_promotion_guard on public.property_offers;
create trigger a_property_offer_promotion_guard
before insert on public.property_offers
for each row execute function public.guard_property_offer_promotion();

drop trigger if exists c_property_offer_company_limit on public.property_offers;
create trigger c_property_offer_company_limit
before insert on public.property_offers
for each row execute function public.enforce_company_property_ad_limit();

-- 4) Wire owner-update guard and updated_at timestamp for company profiles.
-- Alphabetical ordering ensures the owner guard runs before the timestamp helper.
drop trigger if exists company_profiles_owner_update_guard on public.company_profiles;
create trigger company_profiles_owner_update_guard
before update on public.company_profiles
for each row execute function public.guard_company_owner_update();

drop trigger if exists company_profiles_set_updated_at on public.company_profiles;
create trigger company_profiles_set_updated_at
before update on public.company_profiles
for each row execute function public.set_company_profiles_updated_at();

commit;

-- Post-apply verification (completed successfully after migration 20261101210205):
-- select c.relname,t.tgname,pg_get_triggerdef(t.oid)
-- from pg_trigger t join pg_class c on c.oid=t.tgrelid
-- join pg_namespace n on n.oid=c.relnamespace
-- where n.nspname='public' and not t.tgisinternal
--   and c.relname in ('company_profiles','property_offers')
-- order by c.relname,t.tgname;
--
-- select policyname,cmd,qual,with_check from pg_policies
-- where schemaname='public' and tablename='company_profiles';
--
-- select pg_get_functiondef('public.enforce_company_property_ad_limit()'::regprocedure);

-- Deliberately NOT included: enforce_layan_offer_limit().
-- Its current implementation caps every owner at three property offers
-- regardless of plan_code or trial expiry; that commercial rule must be
-- redesigned before activation.
--
-- No UNIQUE(owner_id) constraint is added to company_profiles: the one-profile
-- per account rule has not yet been confirmed as a product rule and the
-- existing data must be reconciled before enforcing it.
