-- LAYAN AQAR: company directory and public profile workflow.
-- Apply through a reviewed Supabase migration; this file is not executed automatically.
create table if not exists public.company_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null check (char_length(trim(company_name)) between 2 and 140),
  category text not null check (category in ('شركات عقارية','مقاولات وتشطيبات','سيراميك وبورسلين','بويات ودهانات','ديكور وأثاث','إضاءة ونجف','ستائر ومفروشات','مطابخ وألوميتال','خدمات عقارية أخرى')),
  description text not null check (char_length(description) between 20 and 1200),
  services text[] not null default '{}',
  city text not null default 'أسيوط',
  address text,
  phone text not null check (char_length(phone) between 7 and 30),
  whatsapp text,
  website text,
  logo_url text,
  gallery_urls text[] not null default '{}',
  projects jsonb not null default '[]'::jsonb check (jsonb_typeof(projects) = 'array'),
  status text not null default 'pending' check (status in ('pending','active','rejected','paused')),
  admin_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists company_profiles_public_directory_idx on public.company_profiles(status, category, company_name);
create index if not exists company_profiles_owner_idx on public.company_profiles(owner_id, created_at desc);
alter table public.company_profiles enable row level security;
drop policy if exists "Public can view approved company profiles" on public.company_profiles;
create policy "Public can view approved company profiles" on public.company_profiles for select to anon, authenticated using (status = 'active');
drop policy if exists "Owners can view own company profiles" on public.company_profiles;
create policy "Owners can view own company profiles" on public.company_profiles for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "Owners can submit pending company profiles" on public.company_profiles;
create policy "Owners can submit pending company profiles" on public.company_profiles for insert to authenticated with check (owner_id = (select auth.uid()) and status = 'pending' and reviewed_at is null and reviewed_by is null and admin_notes is null);
drop policy if exists "Owners can edit own pending company profiles" on public.company_profiles;
create policy "Owners can edit own pending company profiles" on public.company_profiles for update to authenticated using (owner_id = (select auth.uid()) and status = 'pending') with check (owner_id = (select auth.uid()) and status = 'pending' and reviewed_at is null and reviewed_by is null);
drop policy if exists "Admins can review company profiles" on public.company_profiles;
create policy "Admins can review company profiles" on public.company_profiles for all to authenticated using (public.layan_is_admin()) with check (public.layan_is_admin());
create or replace function public.set_company_profiles_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists company_profiles_updated_at on public.company_profiles;
create trigger company_profiles_updated_at before update on public.company_profiles for each row execute function public.set_company_profiles_updated_at();
