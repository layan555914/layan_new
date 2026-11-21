-- Ensure member-role checks can see the verified parent manager row despite its owner-only RLS.
create or replace function private.layan_can_manage_directory_entity(p_directory_entity_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $function$
  select
    exists (
      select 1 from public.company_entity_managers m
      where m.directory_entity_id = p_directory_entity_id
        and m.owner_user_id = (select auth.uid())
        and m.verified_at is not null
    )
    or exists (
      select 1
      from public.company_entity_manager_members mm
      join public.company_entity_managers m on m.directory_entity_id = mm.directory_entity_id
      where mm.directory_entity_id = p_directory_entity_id
        and mm.user_id = (select auth.uid())
        and mm.revoked_at is null
        and mm.member_role in ('manager','editor')
        and m.verified_at is not null
    );
$function$;
revoke all on function private.layan_can_manage_directory_entity(uuid) from public, anon;
grant execute on function private.layan_can_manage_directory_entity(uuid) to authenticated;

drop policy if exists marketplace_listing_provider_links_authenticated_read on public.marketplace_listing_provider_links;
create policy marketplace_listing_provider_links_authenticated_read
on public.marketplace_listing_provider_links for select to authenticated
using (
  exists (
    select 1 from public.marketplace_listings l
    join public.directory_entities e on e.id = marketplace_listing_provider_links.directory_entity_id
    where l.id = marketplace_listing_provider_links.listing_id
      and l.status = 'approved'
      and e.verification_status = 'published'
      and e.public_visible = true
  )
  or exists (
    select 1 from public.marketplace_listings l
    where l.id = marketplace_listing_provider_links.listing_id
      and l.owner_id = (select auth.uid())
  )
  or (select private.layan_can_manage_directory_entity(marketplace_listing_provider_links.directory_entity_id))
  or (select private.layan_is_admin())
);
drop policy if exists marketplace_listing_provider_links_verified_manager_insert on public.marketplace_listing_provider_links;
create policy marketplace_listing_provider_links_verified_manager_insert
on public.marketplace_listing_provider_links for insert to authenticated
with check (
  linked_by = (select auth.uid())
  and exists (
    select 1 from public.marketplace_listings l
    where l.id = marketplace_listing_provider_links.listing_id
      and l.owner_id = (select auth.uid())
      and l.status in ('pending','rejected')
  )
  and (select private.layan_can_manage_directory_entity(marketplace_listing_provider_links.directory_entity_id))
);
alter table public.marketplace_listing_provider_links alter column linked_by drop not null;
alter table public.marketplace_listing_provider_links drop constraint if exists marketplace_listing_provider_links_linked_by_fkey;
alter table public.marketplace_listing_provider_links
  add constraint marketplace_listing_provider_links_linked_by_fkey
  foreign key (linked_by) references auth.users(id) on delete set null;
