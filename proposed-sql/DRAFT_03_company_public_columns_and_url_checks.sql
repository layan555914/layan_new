-- ============================================================================
-- DRAFT FOR REVIEW — NOT EXECUTED — NOT FINAL — UNTESTED
-- (أ) حصر ما يقرؤه الزائر (anon) في الأعمدة العامة فقط: لا owner_id ولا reviewed_by ولا admin_notes.
-- (ب) قيود بروتوكول الروابط (NOT VALID: تُطبّق على الإدخال/التعديل الجديد ولا تكسر الصفوف الحالية).
-- شرط (أ): كل استعلامات الزائر في الكود الحالي تستخدم قوائم أعمدة صريحة (تم التحقق في
-- companies.js و company-profile.js). أي استعلام للزائر بـ select=* سيفشل بعد التطبيق.
-- ملاحظة: المستخدم المسجّل (authenticated) يحتفظ بصلاحية قراءة الجدول كله على الصفوف المنشورة؛
-- الحل الأقوى لاحقاً هو view عام للدليل. جرّب على staging أولاً.
-- ============================================================================
begin;

revoke select on public.company_profiles from anon;
grant select (id, company_name, category, description, services, city, address, phone, whatsapp,
              website, logo_url, gallery_urls, projects, status)
  on public.company_profiles to anon;

create or replace function public.layan_is_http_url(u text) returns boolean
language sql immutable set search_path = public as $$
  select u is null or u = '' or u ~* '^https?://[^[:space:]]+$'
$$;
create or replace function public.layan_all_http_urls(arr text[]) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(bool_and(public.layan_is_http_url(x)), true) from unnest(arr) as x
$$;

alter table public.company_profiles drop constraint if exists company_profiles_website_http;
alter table public.company_profiles add constraint company_profiles_website_http
  check (public.layan_is_http_url(website)) not valid;
alter table public.company_profiles drop constraint if exists company_profiles_logo_http;
alter table public.company_profiles add constraint company_profiles_logo_http
  check (public.layan_is_http_url(logo_url)) not valid;
alter table public.company_profiles drop constraint if exists company_profiles_gallery_http;
alter table public.company_profiles add constraint company_profiles_gallery_http
  check (public.layan_all_http_urls(gallery_urls)) not valid;

commit;
-- بعد تنظيف أي صفوف قديمة مخالفة يمكن تنفيذ: alter table ... validate constraint ...;