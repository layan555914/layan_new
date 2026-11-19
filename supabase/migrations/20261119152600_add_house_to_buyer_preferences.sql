-- Allow buyers to save "منزل" as a preferred property type.
-- Keep all previously supported options unchanged.
alter table public.buyer_preferences
  drop constraint if exists buyer_preferences_property_type_check;

alter table public.buyer_preferences
  add constraint buyer_preferences_property_type_check
  check (property_type = any (array['شقة'::text, 'منزل'::text, 'فيلا'::text, 'محل'::text, 'أرض'::text, 'أي نوع'::text]));
