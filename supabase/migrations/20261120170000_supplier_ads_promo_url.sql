-- Keep official company websites separate from sponsored social-post links.
alter table public.supplier_ads
  add column if not exists promo_url text;

-- Public profile pages may read only this additional field; no write access is granted.
grant select (promo_url) on public.supplier_ads to anon, authenticated;

-- Attach the existing Facebook post to the existing active sponsored listing.
update public.supplier_ads
set promo_url = 'https://www.facebook.com/share/p/19o3UMpE4U/',
    updated_at = now()
where id = '5df00196-3a69-46b4-b11f-8dd362305827'
  and business_name = 'معارض الدكتور للسيراميك والبورسلين'
  and target_url = 'https://asyutq.com/company.html?entity_id=822eb058-d3de-47c6-8f8f-6024101d97ee'
  and status = 'active';
