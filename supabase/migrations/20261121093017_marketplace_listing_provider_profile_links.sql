-- ASYUT AQAR: connect approved marketplace service listings to verified directory provider profiles.
create table if not exists public.marketplace_listing_provider_links (
  listing_id uuid primary key references public.marketplace_listings(id) on delete cascade,
  directory_entity_id uuid not null references public.directory_entities(id) on delete cascade,
  linked_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists marketplace_listing_provider_links_entity_idx
  on public.marketplace_listing_provider_links(directory_entity_id, created_at desc);
alter table public.marketplace_listing_provider_links enable row level security;
revoke all on table public.marketplace_listing_provider_links from public, anon, authenticated;
grant select on table public.marketplace_listing_provider_links to anon, authenticated;
grant insert, delete on table public.marketplace_listing_provider_links to authenticated;

create policy marketplace_listing_provider_links_public_read
on public.marketplace_listing_provider_links for select to anon
using (exists (
  select 1 from public.marketplace_listings l
  join public.directory_entities e on e.id = marketplace_listing_provider_links.directory_entity_id
  where l.id = marketplace_listing_provider_links.listing_id
    and l.status = 'approved'
    and e.verification_status = 'published'
    and e.public_visible = true
));

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
  or exists (
    select 1 from public.company_entity_managers m
    where m.directory_entity_id = marketplace_listing_provider_links.directory_entity_id
      and m.owner_user_id = (select auth.uid())
      and m.verified_at is not null
  )
  or exists (
    select 1 from public.company_entity_manager_members mm
    join public.company_entity_managers m on m.directory_entity_id = mm.directory_entity_id
    where mm.directory_entity_id = marketplace_listing_provider_links.directory_entity_id
      and mm.user_id = (select auth.uid())
      and mm.revoked_at is null
      and m.verified_at is not null
  )
  or (select private.layan_is_admin())
);

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
  and (
    exists (
      select 1 from public.company_entity_managers m
      where m.directory_entity_id = marketplace_listing_provider_links.directory_entity_id
        and m.owner_user_id = (select auth.uid())
        and m.verified_at is not null
    )
    or exists (
      select 1 from public.company_entity_manager_members mm
      join public.company_entity_managers m on m.directory_entity_id = mm.directory_entity_id
      where mm.directory_entity_id = marketplace_listing_provider_links.directory_entity_id
        and mm.user_id = (select auth.uid())
        and mm.revoked_at is null
        and mm.member_role in ('manager','editor')
        and m.verified_at is not null
    )
  )
);

create policy marketplace_listing_provider_links_owner_delete
on public.marketplace_listing_provider_links for delete to authenticated
using (
  exists (
    select 1 from public.marketplace_listings l
    where l.id = marketplace_listing_provider_links.listing_id
      and l.owner_id = (select auth.uid())
      and l.status in ('pending','rejected')
  )
  or (select private.layan_is_admin())
);
comment on table public.marketplace_listing_provider_links is
'Links a marketplace service listing to its claimed directory provider profile. Public reads are limited to approved listings and published visible profiles; writes require a verified representative.';
