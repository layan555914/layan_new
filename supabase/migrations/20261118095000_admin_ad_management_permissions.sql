-- ASYUT AQAR: grant the authenticated admin team the same ad-management
-- capabilities as customers, while keeping ownership immutable after creation.
-- This migration is staged in Git only; apply it to production only after review.

create or replace function public.layan_admin_resolve_user(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
begin
  if auth.uid() is null or not private.layan_is_admin() then
    raise exception 'غير مسموح' using errcode = '42501';
  end if;

  if nullif(trim(p_email), '') is null then
    raise exception 'اكتب البريد الإلكتروني لصاحب الإعلان';
  end if;

  select u.id
    into v_user_id
    from auth.users u
   where lower(u.email) = lower(trim(p_email))
     and u.deleted_at is null
   limit 1;

  if v_user_id is null then
    raise exception 'لا يوجد حساب نشط بهذا البريد الإلكتروني';
  end if;

  return v_user_id;
end;
$function$;

revoke all on function public.layan_admin_resolve_user(text) from public, anon;
grant execute on function public.layan_admin_resolve_user(text) to authenticated;

-- Owners can be selected when an admin creates an ad, but an existing ad
-- cannot silently be transferred to a different account during editing.
create or replace function private.layan_guard_ad_owner_immutable()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'لا يمكن تغيير صاحب الإعلان بعد إنشائه' using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists layan_guard_owner_property_offers on public.property_offers;
create trigger layan_guard_owner_property_offers
before update of owner_id on public.property_offers
for each row execute function private.layan_guard_ad_owner_immutable();

drop trigger if exists layan_guard_owner_marketplace_listings on public.marketplace_listings;
create trigger layan_guard_owner_marketplace_listings
before update of owner_id on public.marketplace_listings
for each row execute function private.layan_guard_ad_owner_immutable();

drop trigger if exists layan_guard_owner_supplier_ads on public.supplier_ads;
create trigger layan_guard_owner_supplier_ads
before update of owner_id on public.supplier_ads
for each row execute function private.layan_guard_ad_owner_immutable();

drop trigger if exists layan_guard_owner_company_property_ads on public.company_property_ads;
create trigger layan_guard_owner_company_property_ads
before update of owner_id on public.company_property_ads
for each row execute function private.layan_guard_ad_owner_immutable();

-- Property offers: admins can see all states, create for an existing account
-- in the pending state, and edit any field without changing owner_id.
drop policy if exists property_offers_admin_read_all on public.property_offers;
create policy property_offers_admin_read_all
on public.property_offers for select to authenticated
using (public.layan_is_admin());

drop policy if exists property_offers_admin_insert_for_customer on public.property_offers;
create policy property_offers_admin_insert_for_customer
on public.property_offers for insert to authenticated
with check (
  public.layan_is_admin()
  and owner_id is not null
  and status = 'pending'
  and is_featured = false
  and verification_status = 'pending'
  and developer_approval_status = 'unknown'
  and verified_at is null
  and featured_until is null
  and (
    (featured_requested = false and promotion_status = 'none')
    or (featured_requested = true and promotion_status = 'requested')
  )
);

drop policy if exists property_offers_admin_update_all on public.property_offers;
create policy property_offers_admin_update_all
on public.property_offers for update to authenticated
using (public.layan_is_admin())
with check (public.layan_is_admin());

-- Marketplace: admin-created submissions enter review like customer submissions.
drop policy if exists marketplace_listings_admin_insert_for_customer on public.marketplace_listings;
create policy marketplace_listings_admin_insert_for_customer
on public.marketplace_listings for insert to authenticated
with check (
  public.layan_is_admin()
  and owner_id is not null
  and status = 'pending'
  and is_featured = false
  and reviewed_at is null
  and reviewed_by is null
  and admin_notes is null
);

drop policy if exists marketplace_listings_admin_update_all on public.marketplace_listings;
create policy marketplace_listings_admin_update_all
on public.marketplace_listings for update to authenticated
using (public.layan_is_admin())
with check (public.layan_is_admin());

-- Sponsored / supplier advertisements.
drop policy if exists supplier_ads_admin_insert_for_customer on public.supplier_ads;
create policy supplier_ads_admin_insert_for_customer
on public.supplier_ads for insert to authenticated
with check (
  public.layan_is_admin()
  and owner_id is not null
  and status = 'pending'
);

drop policy if exists supplier_ads_admin_update_all on public.supplier_ads;
create policy supplier_ads_admin_update_all
on public.supplier_ads for update to authenticated
using (public.layan_is_admin())
with check (public.layan_is_admin());

-- Company property-ad requests.
drop policy if exists company_property_ads_admin_insert_for_customer on public.company_property_ads;
create policy company_property_ads_admin_insert_for_customer
on public.company_property_ads for insert to authenticated
with check (
  public.layan_is_admin()
  and owner_id is not null
  and status = 'pending'
);

drop policy if exists company_property_ads_admin_update_all on public.company_property_ads;
create policy company_property_ads_admin_update_all
on public.company_property_ads for update to authenticated
using (public.layan_is_admin())
with check (public.layan_is_admin());

-- Admin-managed promotional placements and sponsor records.
drop policy if exists partner_ad_slots_admin_insert on public.partner_ad_slots;
create policy partner_ad_slots_admin_insert
on public.partner_ad_slots for insert to authenticated
with check (public.layan_is_admin());

drop policy if exists partner_ad_slots_admin_update_all on public.partner_ad_slots;
create policy partner_ad_slots_admin_update_all
on public.partner_ad_slots for update to authenticated
using (public.layan_is_admin())
with check (public.layan_is_admin());

drop policy if exists partner_ad_slots_admin_delete on public.partner_ad_slots;
create policy partner_ad_slots_admin_delete
on public.partner_ad_slots for delete to authenticated
using (public.layan_is_admin());

drop policy if exists platform_sponsors_admin_insert_all on public.platform_sponsors;
create policy platform_sponsors_admin_insert_all
on public.platform_sponsors for insert to authenticated
with check (public.layan_is_admin());

drop policy if exists platform_sponsors_admin_update_all on public.platform_sponsors;
create policy platform_sponsors_admin_update_all
on public.platform_sponsors for update to authenticated
using (public.layan_is_admin())
with check (public.layan_is_admin());

-- Admin image uploads are scoped to the public offer-image bucket and to
-- an offers/<account-uuid>/... path. No private document bucket is touched.
drop policy if exists asyut_admin_upload_customer_offer_images on storage.objects;
create policy asyut_admin_upload_customer_offer_images
on storage.objects for insert to authenticated
with check (
  bucket_id = 'layan_real_estat'
  and (storage.foldername(name))[1] = 'offers'
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.layan_is_admin()
);

drop policy if exists asyut_admin_read_customer_offer_images on storage.objects;
create policy asyut_admin_read_customer_offer_images
on storage.objects for select to authenticated
using (
  bucket_id = 'layan_real_estat'
  and (storage.foldername(name))[1] = 'offers'
  and public.layan_is_admin()
);

drop policy if exists asyut_admin_replace_customer_offer_images on storage.objects;
create policy asyut_admin_replace_customer_offer_images
on storage.objects for update to authenticated
using (
  bucket_id = 'layan_real_estat'
  and (storage.foldername(name))[1] = 'offers'
  and public.layan_is_admin()
)
with check (
  bucket_id = 'layan_real_estat'
  and (storage.foldername(name))[1] = 'offers'
  and public.layan_is_admin()
);

drop policy if exists asyut_admin_delete_customer_offer_images on storage.objects;
create policy asyut_admin_delete_customer_offer_images
on storage.objects for delete to authenticated
using (
  bucket_id = 'layan_real_estat'
  and (storage.foldername(name))[1] = 'offers'
  and public.layan_is_admin()
);

notify pgrst, 'reload schema';
