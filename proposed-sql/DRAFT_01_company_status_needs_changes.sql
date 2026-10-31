-- ============================================================================
-- DRAFT FOR REVIEW — NOT EXECUTED — NOT FINAL
-- يعالج تعارض needs_changes: القيد الحالي في الهجرة لا يسمح بها، وسياسة التعديل لا تسمح للمالك
-- بالتعديل من needs_changes أو rejected.
-- قبل أي تنفيذ: قارنه بنتائج الاستعلامات الحية (pg_policies / pg_constraint). قد تكون القاعدة الحية
-- عُدّلت يدوياً بالفعل. جرّبه أولاً على نسخة تجريبية (staging). لا يمس أي بيانات.
-- ============================================================================
begin;

-- 1) توسيع قيد status ليشمل needs_changes (بدون لمس الصفوف الحالية)
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.company_profiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%' and pg_get_constraintdef(oid) ilike '%pending%'
  loop
    execute format('alter table public.company_profiles drop constraint %I', c);
  end loop;
  alter table public.company_profiles
    add constraint company_profiles_status_check
    check (status in ('pending','active','needs_changes','rejected','paused'));
end $$;

-- 2) السماح للمالك بالتعديل وإعادة الإرسال من needs_changes و rejected
--    (WITH CHECK كما هو: لا يستطيع المالك ضبط غير pending ولا reviewed_*)
drop policy if exists "Owners can edit own pending company profiles" on public.company_profiles;
create policy "Owners can edit own pending company profiles" on public.company_profiles
  for update to authenticated
  using (owner_id = (select auth.uid()) and status in ('pending','active','needs_changes','rejected'))
  with check (owner_id = (select auth.uid()) and status = 'pending' and reviewed_at is null and reviewed_by is null);

commit;
-- ملاحظة: بهذا الملف وحده يبقى تعديل ملف "active" يحوّله إلى pending (يُخفى مؤقتاً).
-- لتحقيق قرار "تبقى النسخة المعتمدة ظاهرة" طبّق DRAFT_02 أيضاً.