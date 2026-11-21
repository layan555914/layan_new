-- Allow an authenticated owner to attach an already-published service listing to a provider profile they are verified to manage.
-- No listing data or existing provider links are changed by this migration.
drop policy if exists marketplace_listing_provider_links_verified_manager_insert
  on public.marketplace_listing_provider_links;

create policy marketplace_listing_provider_links_verified_manager_insert
on public.marketplace_listing_provider_links
for insert to authenticated
with check (
  linked_by = (select auth.uid())
  and exists (
    select 1
    from public.marketplace_listings l
    where l.id = marketplace_listing_provider_links.listing_id
      and l.owner_id = (select auth.uid())
      and l.status in ('pending', 'rejected', 'approved')
  )
  and exists (
    select 1
    from public.directory_entities e
    where e.id = marketplace_listing_provider_links.directory_entity_id
      and e.verification_status = 'published'
      and e.public_visible = true
  )
  and (select private.layan_can_manage_directory_entity(
    marketplace_listing_provider_links.directory_entity_id
  ))
);

comment on policy marketplace_listing_provider_links_verified_manager_insert
on public.marketplace_listing_provider_links is
'Listing owner may link their own pending, rejected, or approved service listing only to a public published provider profile they are verified to manage as owner or active manager/editor.';
