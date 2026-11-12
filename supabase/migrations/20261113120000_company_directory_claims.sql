-- Company directory profiles and owner-claim workflow.
-- This migration is intentionally reviewed in a PR; it is not applied to production here.

create table if not exists public.company_directory_entries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  company_name text not null check (char_length(btrim(company_name)) between 2 and 160),
  category text not null check (char_length(btrim(category)) between 2 and 140),
  description text not null default '',
  city text not null default 'أسيوط',
  public_address text,
  public_phone text,
  website_url text,
  logo_url text,
  gallery_urls text[] not null default '{}'::text[],
  services text[] not null default '{}'::text[],
  source_label text not null,
  source_url text not null check (source_url ~ '^https?://'),
  source_checked_at date not null default current_date,
  is_published boolean not null default true,
  claim_status text not null default 'unclaimed'
    check (claim_status in ('unclaimed','claimed')),
  claimed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_directory_entries_public_idx
  on public.company_directory_entries (is_published, company_name);
create index if not exists company_directory_entries_city_category_idx
  on public.company_directory_entries (city, category);

create table if not exists public.company_directory_claim_requests (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.company_directory_entries(id) on delete cascade,
  claimant_id uuid not null references auth.users(id) on delete cascade,
  claimant_name text not null check (char_length(btrim(claimant_name)) between 2 and 120),
  claimant_role text not null check (char_length(btrim(claimant_role)) between 2 and 120),
  contact_phone text not null check (char_length(btrim(contact_phone)) between 7 and 30),
  proof_note text not null check (char_length(btrim(proof_note)) between 10 and 1200),
  proof_url text check (proof_url is null or proof_url ~ '^https?://'),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  admin_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists company_directory_claim_requests_pending_idx
  on public.company_directory_claim_requests (status, created_at);
create index if not exists company_directory_claim_requests_owner_idx
  on public.company_directory_claim_requests (claimant_id, entry_id, created_at desc);
create unique index if not exists company_directory_claim_requests_one_active_idx
  on public.company_directory_claim_requests (entry_id)
  where status in ('pending','approved');

alter table public.company_directory_entries enable row level security;
alter table public.company_directory_claim_requests enable row level security;

revoke all on public.company_directory_entries from anon, authenticated;
grant select (
  id, slug, company_name, category, description, city, public_address, public_phone,
  website_url, logo_url, gallery_urls, services, source_label, source_url,
  source_checked_at, is_published, claim_status, created_at, updated_at
) on public.company_directory_entries to anon, authenticated;
grant update (
  company_name, category, description, city, public_address, public_phone,
  website_url, logo_url, gallery_urls, services, updated_at
) on public.company_directory_entries to authenticated;

drop policy if exists company_directory_entries_public_read on public.company_directory_entries;
create policy company_directory_entries_public_read
  on public.company_directory_entries for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists company_directory_entries_admin_read on public.company_directory_entries;
create policy company_directory_entries_admin_read
  on public.company_directory_entries for select
  to authenticated
  using (public.layan_is_admin());

drop policy if exists company_directory_entries_owner_update on public.company_directory_entries;
create policy company_directory_entries_owner_update
  on public.company_directory_entries for update
  to authenticated
  using (
    is_published = true
    and claim_status = 'claimed'
    and claimed_by = (select auth.uid())
  )
  with check (
    is_published = true
    and claim_status = 'claimed'
    and claimed_by = (select auth.uid())
  );

revoke all on public.company_directory_claim_requests from anon, authenticated;
grant select, insert, update on public.company_directory_claim_requests to authenticated;

drop policy if exists company_directory_claims_owner_read on public.company_directory_claim_requests;
create policy company_directory_claims_owner_read
  on public.company_directory_claim_requests for select
  to authenticated
  using (claimant_id = (select auth.uid()));

drop policy if exists company_directory_claims_admin_read on public.company_directory_claim_requests;
create policy company_directory_claims_admin_read
  on public.company_directory_claim_requests for select
  to authenticated
  using (public.layan_is_admin());

drop policy if exists company_directory_claims_owner_insert on public.company_directory_claim_requests;
create policy company_directory_claims_owner_insert
  on public.company_directory_claim_requests for insert
  to authenticated
  with check (
    claimant_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and admin_notes is null
  );

drop policy if exists company_directory_claims_admin_update on public.company_directory_claim_requests;
create policy company_directory_claims_admin_update
  on public.company_directory_claim_requests for update
  to authenticated
  using (public.layan_is_admin())
  with check (public.layan_is_admin());

create or replace function private.layan_review_company_directory_claim(
  p_claim_id uuid,
  p_decision text,
  p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_claim public.company_directory_claim_requests%rowtype;
begin
  if auth.uid() is null or not coalesce(private.layan_is_admin(), false) then
    raise exception 'غير مصرح بمراجعة طلبات استلام الشركات' using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in ('approve','reject') then
    raise exception 'قرار المراجعة غير صحيح' using errcode = '22023';
  end if;

  if p_admin_notes is not null and char_length(p_admin_notes) > 1200 then
    raise exception 'ملاحظات الإدارة أطول من الحد المسموح' using errcode = '22023';
  end if;

  select *
    into v_claim
    from public.company_directory_claim_requests
   where id = p_claim_id
   for update;

  if not found or v_claim.status <> 'pending' then
    raise exception 'طلب الاستلام غير موجود أو تمت مراجعته مسبقًا' using errcode = 'P0002';
  end if;

  if p_decision = 'approve' then
    update public.company_directory_entries
       set claim_status = 'claimed',
           claimed_by = v_claim.claimant_id,
           updated_at = now()
     where id = v_claim.entry_id
       and is_published = true
       and claim_status = 'unclaimed';

    if not found then
      raise exception 'الصفحة مستلمة بالفعل أو غير منشورة' using errcode = '23514';
    end if;

    update public.company_directory_claim_requests
       set status = 'approved',
           admin_notes = nullif(btrim(coalesce(p_admin_notes,'')), ''),
           reviewed_by = auth.uid(),
           reviewed_at = now()
     where id = p_claim_id;
  else
    update public.company_directory_claim_requests
       set status = 'rejected',
           admin_notes = nullif(btrim(coalesce(p_admin_notes,'')), ''),
           reviewed_by = auth.uid(),
           reviewed_at = now()
     where id = p_claim_id;
  end if;

  return jsonb_build_object('id',p_claim_id,'status',case when p_decision='approve' then 'approved' else 'rejected' end);
end;
$function$;

revoke all on function private.layan_review_company_directory_claim(uuid,text,text) from public, anon;
grant execute on function private.layan_review_company_directory_claim(uuid,text,text) to authenticated;

create or replace function public.layan_review_company_directory_claim(
  p_claim_id uuid,
  p_decision text,
  p_admin_notes text default null
)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.layan_review_company_directory_claim(p_claim_id,p_decision,p_admin_notes);
$function$;

revoke all on function public.layan_review_company_directory_claim(uuid,text,text) from public, anon;
grant execute on function public.layan_review_company_directory_claim(uuid,text,text) to authenticated;

comment on table public.company_directory_entries is
  'ملفات تعريفية أولية لشركات وخدمات محلية. الملكية لا تنتقل إلا بعد مراجعة طلب الاستلام من الإدارة.';
comment on table public.company_directory_claim_requests is
  'طلبات استلام خاصة؛ لا تعرض بيانات مقدم الطلب للعامة.';

insert into public.company_directory_entries
  (slug, company_name, category, description, city, public_address, public_phone, website_url, services, source_label, source_url, source_checked_at)
values
  ('abd-el-shafy-real-estate','عبد الشافي للتطوير والتسويق العقاري','شركات عقارية',
   'ملف تعريفي أولي من دليل أعمال منشور. بيانات العنوان والهاتف تحتاج تأكيد الشركة، والصفحة غير مستلمة أو معتمدة منها.',
   'أسيوط','برج طيبة، أسيوط','01000477444 / 01144984444',null,
   array['تطوير عقاري','تسويق عقاري'],'EgyptFinder / دليل الأعمال',
   'https://egyfinder.net/categories/en/real-estate/assyout','2026-11-13'),
  ('aqar-real-estate-assiut','عقار للاستثمار والتسويق العقاري','شركات عقارية',
   'ملف تعريفي أولي من دليل أعمال منشور. بيانات العنوان والهاتف تحتاج تأكيد الشركة، والصفحة غير مستلمة أو معتمدة منها.',
   'أسيوط','أبراج الوطنية، شارع الجمهورية، الدور الثاني، شقة 1','0882293429 / 01114471729',null,
   array['استثمار عقاري','تسويق عقاري'],'Dalil140 / دليل الأعمال',
   'https://dalil140.com/category/ar/real-estate/assyout','2026-11-13'),
  ('bait-el-baraka-real-estate','بيت البركة للاستثمار والتسويق العقاري','شركات عقارية',
   'ملف تعريفي أولي من دليل أعمال منشور. بيانات العنوان والهاتف تحتاج تأكيد الشركة، والصفحة غير مستلمة أو معتمدة منها.',
   'أسيوط','برج خالد بن الوليد، ميدان المحطة، الدور الثاني، شقة 207','01014429745 / 01110543999',null,
   array['استثمار عقاري','تسويق عقاري'],'EgyptFinder / دليل الأعمال',
   'https://egyfinder.net/categories/en/real-estate/assyout','2026-11-13'),
  ('baitk-biedak-assiut','بيتك بأيدك – فرع أسيوط','شركات عقارية',
   'ملف تعريفي أولي من دليل أعمال منشور. رقم خدمة العملاء والموقع يحتاجان تأكيد الفرع، والصفحة غير مستلمة أو معتمدة من الشركة.',
   'أسيوط','شارع الجيش، برج رميح، الدور الأول','19695','http://www.baitkbiedak.com/',
   array['تسويق وخدمات عقارية'],'EgyptFinder / دليل الأعمال',
   'https://egyfinder.net/categories/en/real-estate/assyout','2026-11-13'),
  ('economic-group-assiut','المجموعة الاقتصادية للتطوير العمراني','شركات عقارية',
   'ملف تعريفي أولي من دليل أعمال منشور. بيانات العنوان والهاتف تحتاج تأكيد الشركة، والصفحة غير مستلمة أو معتمدة منها.',
   'أسيوط','ميدان المنفذ، برج الغول','0882299938 / 01111191146',null,
   array['تطوير عمراني','استثمار عقاري'],'Dalil140 / دليل الأعمال',
   'https://dalil140.com/category/ar/real-estate/assyout','2026-11-13'),
  ('el-azemy-contracting-real-estate','العزمي للمقاولات والاستثمار العقاري','مقاولات وتشطيبات',
   'ملف تعريفي أولي من دليل أعمال منشور. بيانات العنوان والهاتف تحتاج تأكيد الشركة، والصفحة غير مستلمة أو معتمدة منها.',
   'أسيوط','شارع محمود رشوان، الدور الثالث، أمام مسجد مكة','0882052145 / 01227207595',null,
   array['مقاولات','استثمار عقاري'],'EgyptFinder / دليل الأعمال',
   'https://egyfinder.net/categories/en/real-estate/assyout','2026-11-13'),
  ('el-masreya-real-estate','المصرية للاستثمار العقاري بأسيوط','شركات عقارية',
   'ملف تعريفي أولي من دليل أعمال منشور. بيانات العنوان والهاتف تحتاج تأكيد الشركة، والصفحة غير مستلمة أو معتمدة منها.',
   'أسيوط','برج الهدى مول، شارع 26 يوليو، الدور الثالث، شقة 4','0889202002 / 0882362003','http://www.elmasria.co/',
   array['استثمار عقاري'],'EgyptFinder / دليل الأعمال',
   'https://egyfinder.net/categories/en/real-estate/assyout','2026-11-13'),
  ('el-mostaqbal-real-estate-marketing','المستقبل للتسويق العقاري','تسويق عقاري',
   'ملف تعريفي أولي من دليل أعمال منشور. بيانات العنوان ووسائل الاتصال تحتاج تأكيد الشركة، والصفحة غير مستلمة أو معتمدة منها.',
   'أسيوط','برج عمر بن الخطاب، شارع الهلالي، شقة 6',null,null,
   array['تسويق عقاري'],'Yellow Pages Egypt',
   'https://yellowpages.com.eg/ar/category/اسيوط-عقارات/25','2026-11-13'),
  ('el-mottaheda-real-estate','المتحدة للاستثمار العقاري','شركات عقارية',
   'ملف تعريفي أولي من دليل أعمال منشور. بيانات العنوان ووسائل الاتصال تحتاج تأكيد الشركة، والصفحة غير مستلمة أو معتمدة منها.',
   'أسيوط','امتداد شارع يسري راغب، برج الأزهر، الدور السابع',null,null,
   array['استثمار عقاري'],'Yellow Pages Egypt',
   'https://yellowpages.com.eg/ar/category/اسيوط-عقارات/25','2026-11-13'),
  ('el-safa-real-estate-marketing','الصفا للتسويق العقاري','تسويق عقاري',
   'ملف تعريفي أولي من دليل أعمال منشور. بيانات العنوان والهاتف تحتاج تأكيد الشركة، والصفحة غير مستلمة أو معتمدة منها.',
   'أسيوط','9 شارع جمال عبد الناصر، منطقة فريال، حي شرق','01092702727 / 01003462216',null,
   array['تسويق عقاري','وساطة عقارية'],'EgyptFinder / دليل الأعمال',
   'https://egyfinder.net/categories/en/real-estate/assyout','2026-11-13'),
  ('el-wasset-contracting-real-estate','الوسيط للمقاولات العامة والاستثمار العقاري','مقاولات وتشطيبات',
   'ملف تعريفي أولي من دليل أعمال منشور. بيانات العنوان والهاتف تحتاج تأكيد الشركة، والصفحة غير مستلمة أو معتمدة منها.',
   'أسيوط','9 شارع نزيه خليفة، متفرع من شارع الجمهورية','01006604548 / 01022515211','http://www.elwasset.site123.me/',
   array['مقاولات عامة','استثمار عقاري'],'EgyptFinder / دليل الأعمال',
   'https://egyfinder.net/categories/en/real-estate/assyout','2026-11-13'),
  ('mekka-construction-projects','مكة للتشييد وإدارة المشروعات','مقاولات وتشطيبات',
   'ملف تعريفي أولي من دليل أعمال منشور. العنوان ووسائل الاتصال يحتاجان تأكيد الشركة، والصفحة غير مستلمة أو معتمدة منها.',
   'أسيوط','شارع عدلي، أسيوط',null,null,
   array['تشييد','إدارة مشروعات'],'Yellow Pages Egypt',
   'https://yellowpages.com.eg/ar/category/اسيوط-عقارات/25','2026-11-13'),
  ('memaar-al-morshedy-assiut','معمار المرشدي – فرع أسيوط','شركات تطوير ومشروعات عقارية',
   'ملف تعريفي أولي لفرع أسيوط وفق دليل أعمال منشور. يلزم تأكيد بيانات الفرع من الشركة، والصفحة غير مستلمة أو معتمدة منها.',
   'أسيوط','18 شارع الجمهورية، الدور الثاني، برج اللؤلؤة الإداري','0882284156 / 01100993028','http://www.morshedy.com/',
   array['تطوير عقاري','مشروعات سكنية'],'EgyptFinder / دليل الأعمال',
   'https://egyfinder.net/categories/en/real-estate/assyout','2026-11-13'),
  ('porto-group-assiut','بورتو جروب – فرع أسيوط','شركات تطوير ومشروعات عقارية',
   'ملف تعريفي أولي لفرع أسيوط وفق دليل أعمال منشور. يلزم تأكيد بيانات الفرع من الشركة، والصفحة غير مستلمة أو معتمدة منها.',
   'أسيوط','شارع الجمهورية، برج بانوراما','16663','https://portodevelopments.com/',
   array['تطوير عقاري','مشروعات عقارية'],'Yellow Pages Egypt',
   'https://yellowpages.com.eg/ar/category/اسيوط-عقارات/25','2026-11-13'),
  ('road-house-assiut','رود هاوس','تسويق عقاري',
   'ملف تعريفي أولي من دليل أعمال منشور. بيانات العنوان والهاتف تحتاج تأكيد الشركة، والصفحة غير مستلمة أو معتمدة منها.',
   'أسيوط','8 شارع المساحة، متفرع من شارع الجمهورية، مركز أسيوط الثاني، الدور الأول','01127666366 / 01142863138',null,
   array['خدمات وتسويق عقاري'],'EgyptFinder / دليل الأعمال',
   'https://egyfinder.net/categories/en/real-estate/assyout','2026-11-13'),
  ('star-group-housing-development','ستار جروب للإسكان والتعمير','شركات تطوير ومشروعات عقارية',
   'ملف تعريفي أولي من دليل أعمال منشور. بيانات العنوان والهاتف تحتاج تأكيد الشركة، والصفحة غير مستلمة أو معتمدة منها.',
   'أسيوط','شارع يسري راغب، برج التجاريين، الدور الثاني، شقة 218','0882060992 / 01155556723',null,
   array['إسكان','تطوير عقاري'],'EgyptFinder / دليل الأعمال',
   'https://egyfinder.net/categories/en/real-estate/assyout','2026-11-13'),
  ('themar-real-estate-assiut','ثمار العقارية','شركات عقارية',
   'ملف تعريفي أولي من دليل أعمال منشور. بيانات العنوان ووسائل الاتصال تحتاج تأكيد الشركة، والصفحة غير مستلمة أو معتمدة منها.',
   'أسيوط','شارع تقسيم البترول',null,null,
   array['خدمات عقارية'],'Yellow Pages Egypt',
   'https://yellowpages.com.eg/ar/category/اسيوط-عقارات/25','2026-11-13'),
  ('tiba-land-division-abnoub','طيبة لتقسيم الأراضي – أبنوب','استثمار وتطوير الأراضي',
   'ملف تعريفي أولي لفرع أبنوب وفق دليل أعمال منشور. بيانات العنوان والهاتف تحتاج تأكيد الشركة، والصفحة غير مستلمة أو معتمدة منها.',
   'أبنوب – أسيوط','2 شارع التحرير، الدور الثاني، شقة 2، أبنوب','0882510205 / 01004241926',null,
   array['تقسيم أراضٍ','خدمات عقارية'],'EgyptFinder / دليل الأعمال',
   'https://egyfinder.net/categories/en/real-estate/assyout','2026-11-13'),
  ('upper-capital-constructions','أبر كابيتال للمقاولات','مقاولات وتشطيبات',
   'ملف تعريفي أولي من دليل أعمال محلي. بيانات العنوان والهاتف تحتاج تأكيد الشركة، والصفحة غير مستلمة أو معتمدة منها.',
   'أسيوط','139 شارع جامعة الأزهر، الدور الخامس، أعلى عربيياتا','01018999927 / 01095200002',null,
   array['مقاولات','إنشاءات'],'EgyptFinder – دليل شركات المقاولات',
   'https://egyfinder.net/categories/en/construction/assyout','2026-11-13'),
  ('arab-contractors-assiut-branch','المقاولون العرب – فرع أسيوط','مقاولات وتشطيبات',
   'ملف تعريفي أولي لفرع أسيوط وفق بطاقة نشاط محلية. يجب تأكيد عنوان الفرع ورقم الهاتف مباشرة مع الشركة، والصفحة غير مستلمة أو معتمدة منها.',
   'أسيوط','29 كورنيش النيل، بجوار ديوان عام المحافظة، حي شرق','0882324871',null,
   array['مقاولات عامة','إنشاءات'],'Google Business – بطاقة نشاط محلية',
   'https://www.google.com/maps/search/?api=1&query=Arab+Contractors+Assiut+Egypt','2026-11-13')
on conflict (slug) do nothing;
