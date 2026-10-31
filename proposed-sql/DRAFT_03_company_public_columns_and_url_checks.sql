-- ============================================================================
-- REVIEWED STAGING-TESTED DRAFT — DO NOT APPLY TO PRODUCTION WITHOUT APPROVAL
-- Public reads use a dedicated view; authenticated users cannot SELECT internal
-- columns directly. Owners and admins retrieve scoped records through guarded RPCs.
-- This replaces the earlier DRAFT_03 that left full SELECT granted to authenticated.
-- ============================================================================
begin;

create or replace view public.company_profiles_public
with (security_barrier = true) as
select id, company_name, category, description, services, city, address, phone,
       whatsapp, website, logo_url, gallery_urls, projects
from public.company_profiles
where status = 'active';

revoke all on public.company_profiles from anon, authenticated;
grant insert, update on public.company_profiles to authenticated;
grant select (id, owner_id, status) on public.company_profiles to authenticated;
grant select on public.company_profiles_public to anon, authenticated;

create or replace function public.layan_get_my_company_profile()
returns setof public.company_profiles
language sql stable security definer set search_path = ''
as $function$
  select c.* from public.company_profiles c
  where c.owner_id = auth.uid()
  order by c.created_at desc
  limit 1
$function$;
revoke all on function public.layan_get_my_company_profile() from public, anon;
grant execute on function public.layan_get_my_company_profile() to authenticated;

create or replace function public.layan_admin_list_company_profiles()
returns setof public.company_profiles
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if not public.layan_is_admin() then
    raise exception 'غير مسموح' using errcode = '42501';
  end if;
  return query
    select c.* from public.company_profiles c
    where c.status = 'pending'
       or (c.status = 'active' and c.update_status = 'pending')
    order by c.created_at asc;
end
$function$;
revoke all on function public.layan_admin_list_company_profiles() from public, anon;
grant execute on function public.layan_admin_list_company_profiles() to authenticated;

create or replace function public.layan_is_http_url(u text) returns boolean
language sql immutable set search_path = ''
as $function$
  select u is null or u = '' or u ~* '^https?://[^[:space:]]+$'
$function$;
create or replace function public.layan_all_http_urls(arr text[]) returns boolean
language sql immutable set search_path = ''
as $function$
  select coalesce(bool_and(public.layan_is_http_url(x)), true) from unnest(arr) as x
$function$;

alter table public.company_profiles drop constraint if exists company_profiles_website_http;
alter table public.company_profiles add constraint company_profiles_website_http
  check (public.layan_is_http_url(website)) not valid;
alter table public.company_profiles drop constraint if exists company_profiles_logo_http;
alter table public.company_profiles add constraint company_profiles_logo_http
  check (public.layan_is_http_url(logo_url)) not valid;
alter table public.company_profiles drop constraint if exists company_profiles_gallery_http;
alter table public.company_profiles add constraint company_profiles_gallery_http
  check (public.layan_all_http_urls(gallery_urls)) not valid;

commit;
