-- ASYUT AQAR | مقترح أقل الصلاحيات لجداول الدليل العقاري
-- التاريخ: 2026-11-03
-- الحالة: REVIEW ONLY — لم يتم تنفيذ هذا الملف على Supabase.
--
-- سبب المقترح:
-- أظهر فحص ACL للقراءة فقط أن الدور anon لديه امتيازات
-- INSERT/UPDATE/DELETE/TRUNCATE وغيرها على جداول directory_*،
-- بينما سياسات RLS الحالية لا تمنحه سياسات كتابة.
-- الهدف إزالة الامتيازات غير اللازمة من anon مع الإبقاء على SELECT
-- في الجداول التي تحتوي سياسات قراءة عامة مقيّدة.
--
-- لا تشغّل هذا الملف على الإنتاج قبل:
-- 1) مراجعة مسؤول قاعدة البيانات.
-- 2) نسخة احتياطية معتمدة.
-- 3) تطبيقه في مشروع/بيئة اختبار أولًا.
-- 4) اختبار anon وauthenticated وحساب الإدارة الفعلي.
--
-- لا يغيّر هذا المقترح سياسات RLS أو بيانات الجداول أو Auth أو Storage.

begin;

-- جداول لها سياسات anon SELECT مقيّدة على السجلات/المصادر العامة.
revoke all privileges on table
  public.directory_areas,
  public.directory_entities,
  public.directory_projects,
  public.directory_project_entities,
  public.directory_sources,
  public.directory_entity_sources,
  public.directory_project_sources,
  public.directory_opportunities,
  public.directory_opportunity_sources
from anon;

grant select on table
  public.directory_areas,
  public.directory_entities,
  public.directory_projects,
  public.directory_project_entities,
  public.directory_sources,
  public.directory_entity_sources,
  public.directory_project_sources,
  public.directory_opportunities,
  public.directory_opportunity_sources
to anon;

-- جداول داخلية لا توجد لها سياسة قراءة عامة.
revoke all privileges on table
  public.directory_entity_private,
  public.directory_project_private,
  public.directory_entity_areas,
  public.directory_change_log
from anon;

commit;

-- اختبارات ما بعد التطبيق في بيئة اختبار فقط:
-- A) anon SELECT:
--    - يرى المناطق النشطة المنشورة فقط.
--    - يرى الجهات/المشروعات/الفرص المنشورة والظاهرة فقط.
--    - يرى المصادر العامة وروابط المصادر المسموح بها فقط.
-- B) anon INSERT/UPDATE/DELETE/TRUNCATE:
--    - يجب أن تفشل على كل جداول directory_*.
-- C) anon SELECT على الجداول الداخلية الأربعة:
--    - يجب أن يفشل.
-- D) authenticated غير الإداري:
--    - يجب أن يظل مقيدًا بسياسات RLS الحالية.
-- E) authenticated الإداري:
--    - يجب أن تظل عمليات لوحة الدليل المطلوبة تعمل عبر layan_is_admin().
-- F) يجب إعادة فحص pg_class.relacl وpg_policies وRLS بعد التطبيق.
