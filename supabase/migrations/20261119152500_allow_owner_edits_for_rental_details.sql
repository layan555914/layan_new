-- Permit owners to edit only the new rental-detail columns through the existing
-- ownership-checked review flow. All existing protected fields remain protected.

create or replace function private.layan_offer_editable_fields()
returns text[] language sql immutable set search_path = '' as $f$
  select array[
    'title','governorate','city','area','property_type','listing_purpose','bedrooms','bathrooms','area_m2','land_area_m2',
    'land_ownership_authority','land_permit_details','land_utilities','land_zoning','total_price','price_on_request','down_payment','paid_amount',
    'remaining_amount','remaining_installments','monthly_installment','assignment_fee','assignment_fee_percentage','transfer_fee',
    'discount_amount','discount_percent','description','image_urls','developer_name','project_name','contact_name','contact_phone',
    'latitude','longitude','rental_period','rental_furnishing','rental_security_deposit','rental_minimum_months'
  ]
$f$;

create or replace function private.layan_apply_offer_changes(p_id bigint, p_changes jsonb)
returns void language plpgsql security definer set search_path = '' as $f$
declare
  r public.property_offers;
begin
  select * into r
  from jsonb_populate_record((select o from public.property_offers o where o.id = p_id), p_changes);

  update public.property_offers o set
    title = r.title,
    governorate = r.governorate,
    city = r.city,
    area = r.area,
    property_type = r.property_type,
    listing_purpose = r.listing_purpose,
    bedrooms = r.bedrooms,
    bathrooms = r.bathrooms,
    area_m2 = r.area_m2,
    land_area_m2 = r.land_area_m2,
    land_ownership_authority = r.land_ownership_authority,
    land_permit_details = r.land_permit_details,
    land_utilities = r.land_utilities,
    land_zoning = r.land_zoning,
    total_price = r.total_price,
    price_on_request = r.price_on_request,
    down_payment = r.down_payment,
    paid_amount = r.paid_amount,
    remaining_amount = r.remaining_amount,
    remaining_installments = r.remaining_installments,
    monthly_installment = r.monthly_installment,
    assignment_fee = r.assignment_fee,
    assignment_fee_percentage = r.assignment_fee_percentage,
    transfer_fee = r.transfer_fee,
    discount_amount = r.discount_amount,
    discount_percent = r.discount_percent,
    description = r.description,
    image_urls = r.image_urls,
    developer_name = r.developer_name,
    project_name = r.project_name,
    contact_name = r.contact_name,
    contact_phone = r.contact_phone,
    latitude = r.latitude,
    longitude = r.longitude,
    rental_period = r.rental_period,
    rental_furnishing = r.rental_furnishing,
    rental_security_deposit = r.rental_security_deposit,
    rental_minimum_months = r.rental_minimum_months,
    updated_at = now()
  where o.id = p_id;
end
$f$;

revoke all on function private.layan_apply_offer_changes(bigint, jsonb) from public, anon, authenticated;
revoke all on function private.layan_offer_editable_fields() from public, anon, authenticated;
