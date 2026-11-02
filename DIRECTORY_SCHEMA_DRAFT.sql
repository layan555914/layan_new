-- ASYUT AQAR | Directory schema proposal only; NOT executed.
begin;
create extension if not exists pgcrypto;
create table if not exists public.directory_areas (
 id uuid primary key default gen_random_uuid(), slug text unique not null, name_ar text not null, name_en text,
 area_type text not null check(area_type in ('governorate','center','city','new_city','district','neighborhood','village','zone','industrial_zone')),
 parent_id uuid references public.directory_areas(id) on delete restrict, is_active boolean not null default true,
 verification_status text not null default 'draft' check(verification_status in ('draft','needs_review','verified','published','archived')),
 public_visible boolean not null default false, last_verified_at date, next_review_at date, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.directory_entities (
 id uuid primary key default gen_random_uuid(), slug text unique not null, name_ar text not null, name_en text,
 entity_type text not null check(entity_type in ('developer','brokerage','marketing','contractor','public_authority','sales_office','consultant','other')),
 description text, website_url text, public_phone text, public_email text, public_address text,
 primary_area_id uuid references public.directory_areas(id) on delete set null,
 verification_status text not null default 'draft' check(verification_status in ('draft','needs_review','verified','published','archived')),
 public_visible boolean not null default false, last_verified_at date, next_review_at date, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.directory_projects (
 id uuid primary key default gen_random_uuid(), slug text unique not null, name_ar text not null, name_en text,
 project_type text not null check(project_type in ('residential','commercial','administrative','medical','educational','mixed_use','land','service','other')),
 description text, area_id uuid references public.directory_areas(id) on delete set null, location_text text,
 size_value numeric(14,2), size_unit text, unit_count integer check(unit_count is null or unit_count>=0),
 project_status text not null default 'unknown' check(project_status in ('announced','planned','under_construction','partially_delivered','completed','operating','stalled','unknown')),
 verification_status text not null default 'draft' check(verification_status in ('draft','needs_review','verified','published','archived')),
 public_visible boolean not null default false, last_verified_at date, next_review_at date, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.directory_project_entities (
 project_id uuid not null references public.directory_projects(id) on delete cascade,
 entity_id uuid not null references public.directory_entities(id) on delete restrict,
 relation_type text not null check(relation_type in ('developer','land_owner','marketing_agent','sales_agent','contractor','consultant','operator','public_authority','other')),
 notes text, primary key(project_id,entity_id,relation_type));
create table if not exists public.directory_sources (
 id uuid primary key default gen_random_uuid(), title text not null, publisher text,
 source_type text not null, source_url text unique not null, publication_date date,
 accessed_at timestamptz not null default now(), confidence_level text not null default 'unverified',
 is_public boolean not null default false, notes text);
create table if not exists public.directory_entity_sources (
 entity_id uuid not null references public.directory_entities(id) on delete cascade,
 source_id uuid not null references public.directory_sources(id) on delete restrict,
 claim_key text not null default 'general', primary key(entity_id,source_id,claim_key));
create table if not exists public.directory_project_sources (
 project_id uuid not null references public.directory_projects(id) on delete cascade,
 source_id uuid not null references public.directory_sources(id) on delete restrict,
 claim_key text not null default 'general', primary key(project_id,source_id,claim_key));
create table if not exists public.directory_change_log (
 id uuid primary key default gen_random_uuid(), table_name text not null, record_id uuid not null,
 changed_by uuid, old_values jsonb, new_values jsonb, reason text, created_at timestamptz not null default now());
alter table public.directory_areas enable row level security;
alter table public.directory_entities enable row level security;
alter table public.directory_projects enable row level security;
alter table public.directory_project_entities enable row level security;
alter table public.directory_sources enable row level security;
alter table public.directory_entity_sources enable row level security;
alter table public.directory_project_sources enable row level security;
alter table public.directory_change_log enable row level security;
create policy directory_areas_public_read on public.directory_areas for select to anon,authenticated using(is_active and public_visible and verification_status='published');
create policy directory_entities_public_read on public.directory_entities for select to anon,authenticated using(public_visible and verification_status='published');
create policy directory_projects_public_read on public.directory_projects for select to anon,authenticated using(public_visible and verification_status='published');
create policy directory_sources_public_read on public.directory_sources for select to anon,authenticated using(is_public);
create policy directory_project_entities_public_read on public.directory_project_entities for select to anon,authenticated using(exists(select 1 from public.directory_projects p where p.id=project_id and p.public_visible and p.verification_status='published'));
create policy directory_entity_sources_public_read on public.directory_entity_sources for select to anon,authenticated using(exists(select 1 from public.directory_entities e where e.id=entity_id and e.public_visible and e.verification_status='published'));
create policy directory_project_sources_public_read on public.directory_project_sources for select to anon,authenticated using(exists(select 1 from public.directory_projects p where p.id=project_id and p.public_visible and p.verification_status='published'));
grant select on public.directory_areas,public.directory_entities,public.directory_projects,public.directory_project_entities,public.directory_sources,public.directory_entity_sources,public.directory_project_sources to anon,authenticated;
-- Intentionally no public INSERT/UPDATE/DELETE policies. Admin writes require a separately audited admin-only policy.
-- Review Data API grants, function privileges, and the existing admin RPC before applying to any database.
commit;
-- This proposal has NOT been executed on production.
