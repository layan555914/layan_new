-- Add transaction-specific rental details without changing existing sale/assignment rows.
alter table public.property_offers
  add column if not exists rental_period text,
  add column if not exists rental_furnishing text,
  add column if not exists rental_security_deposit numeric,
  add column if not exists rental_minimum_months integer;

-- Older rental offers were displayed as monthly rent before this field existed.
update public.property_offers
set rental_period = 'شهري'
where listing_purpose = 'إيجار'
  and rental_period is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'property_offers_rental_period_check'
      and conrelid = 'public.property_offers'::regclass
  ) then
    alter table public.property_offers
      add constraint property_offers_rental_period_check
      check (rental_period is null or rental_period in ('يومي', 'شهري', 'سنوي'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'property_offers_rental_furnishing_check'
      and conrelid = 'public.property_offers'::regclass
  ) then
    alter table public.property_offers
      add constraint property_offers_rental_furnishing_check
      check (rental_furnishing is null or rental_furnishing in ('مفروش', 'نصف مفروش', 'غير مفروش'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'property_offers_rental_security_deposit_check'
      and conrelid = 'public.property_offers'::regclass
  ) then
    alter table public.property_offers
      add constraint property_offers_rental_security_deposit_check
      check (rental_security_deposit is null or rental_security_deposit >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'property_offers_rental_minimum_months_check'
      and conrelid = 'public.property_offers'::regclass
  ) then
    alter table public.property_offers
      add constraint property_offers_rental_minimum_months_check
      check (rental_minimum_months is null or rental_minimum_months between 1 and 600);
  end if;
end $$;

comment on column public.property_offers.rental_period is
  'Rent amount frequency: daily, monthly, or yearly. NULL for non-rental offers.';
comment on column public.property_offers.rental_furnishing is
  'Furnishing status for rental offers. NULL for non-rental offers.';
comment on column public.property_offers.rental_security_deposit is
  'Optional refundable security deposit amount in EGP for rental offers.';
comment on column public.property_offers.rental_minimum_months is
  'Optional minimum rental term in months for rental offers.';
