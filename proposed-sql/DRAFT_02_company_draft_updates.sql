-- ============================================================================
-- DRAFT FOR REVIEW — NOT EXECUTED — NOT FINAL — UNTESTED
-- نموذج "النسخة المقترحة": تعديلات مالك الملف المنشور تُحفظ في pending_update، وتبقى النسخة العامة
-- كما هي حتى تعتمدها الإدارة عبر الدالة layan_review_company_profile.
-- يعتمد على: DRAFT_01 (أو ما يكافئه في القاعدة الحية)، ووجود الدالة public.layan_is_admin().
-- الواجهة المعدّلة تكتشف الأعمدة تلقائياً: قبل تطبيق هذا الملف تعمل بالمسار القديم مع تحذير.
-- ============================================================================
begin;

alter table public.company_profiles
  add column if not exists pending_update jsonb,
  add column if not exists update_status text,
  add column if not exists update_notes text;
alter table public.company_profiles drop constraint if exists company_profiles_update_status_check;
alter table public.company_profiles add constraint company_profiles_update_status_check
  check (update_status is null or update_status in ('pending','needs_changes','rejected'));
alter table public.company_profiles drop constraint if exists company_profiles_pending_update_shape;
alter table public.company_profiles add constraint company_profiles_pending_update_shape
  check (pending_update is null or (jsonb_typeof(pending_update) = 'object' and length(pending_update::text) <= 20000));

create or replace function public.layan_is_http_url(u text) returns boolean
language sql immutable set search_path = public as $function$
  select u is null or u = '' or u ~* '^https?://[^[:space:]]+$'
$function$;
create or replace function public.layan_all_http_urls(arr text[]) returns boolean
language sql immutable set search_path = public as $function$
  select coalesce(bool_and(public.layan_is_http_url(x)), true) from unnest(arr) as x
$function$;

-- حارس: ما يستطيع المالك تغييره فعلياً (لا يؤثر على الأدمن ولا على التنفيذ من SQL Editor)
create or replace function public.guard_company_owner_update()
returns trigger language plpgsql set search_path = '' as $function$
declare k text;
begin
  if auth.uid() is null or public.layan_is_admin() then return new; end if;
  new.id := old.id; new.owner_id := old.owner_id; new.created_at := old.created_at;
  new.reviewed_at := old.reviewed_at; new.reviewed_by := old.reviewed_by;
  if old.status = 'active' then
    -- ملف منشور: لا تُمس الأعمدة العامة ولا الحالة؛ المسموح فقط إرسال pending_update
    if new.pending_update is null or jsonb_typeof(new.pending_update) <> 'object' then
      raise exception 'يجب إرسال التعديلات كنسخة مقترحة (pending_update)' using errcode = '23514';
    end if;
    for k in select jsonb_object_keys(new.pending_update) loop
      if k not in ('company_name','category','description','services','city','address','phone','whatsapp','website','logo_url','gallery_urls','projects') then
        raise exception 'حقل غير مسموح في التعديل المقترح: %', k using errcode = '23514';
      end if;
    end loop;
    if not public.layan_is_http_url(new.pending_update->>'website')
       or not public.layan_is_http_url(new.pending_update->>'logo_url') then
      raise exception 'الروابط يجب أن تبدأ بـ http:// أو https://' using errcode = '23514';
    end if;
    new.company_name := old.company_name; new.category := old.category; new.description := old.description;
    new.services := old.services; new.city := old.city; new.address := old.address; new.phone := old.phone;
    new.whatsapp := old.whatsapp; new.website := old.website; new.logo_url := old.logo_url;
    new.gallery_urls := old.gallery_urls; new.projects := old.projects;
    new.status := 'active'; new.admin_notes := old.admin_notes;
    new.update_status := 'pending'; new.update_notes := null;
  else
    -- pending / needs_changes / rejected: تعديل مباشر وإعادة إرسال للمراجعة
    new.status := 'pending'; new.admin_notes := null;
    new.reviewed_at := null; new.reviewed_by := null;
    new.pending_update := null; new.update_status := null; new.update_notes := null;
  end if;
  return new;
end $function$;
drop trigger if exists company_profiles_guard_owner on public.company_profiles;
create trigger company_profiles_guard_owner before update on public.company_profiles
  for each row execute function public.guard_company_owner_update();

-- سياسة تعديل المالك (الحارس أعلاه هو الذي يفرض الحالة النهائية؛ WITH CHECK شبكة أمان)
drop policy if exists "Owners can edit own pending company profiles" on public.company_profiles;
create policy "Owners can edit own pending company profiles" on public.company_profiles
  for update to authenticated
  using (owner_id = (select auth.uid()) and status in ('pending','active','needs_changes','rejected'))
  with check (owner_id = (select auth.uid()) and status in ('pending','active'));

-- دالة الإدارة: اعتماد / طلب استكمال / رفض لتعديل مقترح على ملف منشور
create or replace function public.layan_review_company_profile(p_id uuid, p_action text, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $function$
declare r public.company_profiles; d jsonb;
begin
  if not public.layan_is_admin() then raise exception 'غير مسموح' using errcode = '42501'; end if;
  select * into r from public.company_profiles where id = p_id for update;
  if not found or r.status <> 'active' or r.update_status is distinct from 'pending' or r.pending_update is null then
    raise exception 'لا يوجد تعديل معلّق لهذا الملف';
  end if;
  d := r.pending_update;
  if p_action = 'approve' then
    update public.company_profiles set
      company_name = coalesce(nullif(d->>'company_name',''), company_name),
      category     = coalesce(nullif(d->>'category',''), category),
      description  = coalesce(nullif(d->>'description',''), description),
      services     = case when jsonb_typeof(d->'services') = 'array' then array(select jsonb_array_elements_text(d->'services')) else services end,
      city         = coalesce(nullif(d->>'city',''), city),
      address      = case when d ? 'address'  then nullif(d->>'address','')  else address end,
      phone        = coalesce(nullif(d->>'phone',''), phone),
      whatsapp     = case when d ? 'whatsapp' then nullif(d->>'whatsapp','') else whatsapp end,
      website      = case when d ? 'website'  then nullif(d->>'website','')  else website end,
      logo_url     = case when d ? 'logo_url' then nullif(d->>'logo_url','') else logo_url end,
      gallery_urls = case when jsonb_typeof(d->'gallery_urls') = 'array' then array(select jsonb_array_elements_text(d->'gallery_urls')) else gallery_urls end,
      projects     = case when jsonb_typeof(d->'projects') = 'array' then d->'projects' else projects end,
      pending_update = null, update_status = null, update_notes = null, admin_notes = null,
      reviewed_at = now(), reviewed_by = auth.uid()
    where id = p_id;
  elsif p_action in ('request_changes','reject') then
    if coalesce(trim(p_notes),'') = '' then raise exception 'الملاحظات مطلوبة'; end if;
    update public.company_profiles set
      update_status = case p_action when 'request_changes' then 'needs_changes' else 'rejected' end,
      update_notes = left(trim(p_notes), 500)
    where id = p_id;
  else
    raise exception 'إجراء غير صالح';
  end if;
end $function$;
revoke all on function public.layan_review_company_profile(uuid, text, text) from public, anon;
grant execute on function public.layan_review_company_profile(uuid, text, text) to authenticated;

commit;
-- تنبيه: القيمة الجديدة من approve تمر عبر قيود الجدول (ومنها DRAFT_03 إن طُبّق) لذا تُرفض الروابط غير الآمنة.