# ASYUT AQAR — تقرير استعادة واختبار مخطط الإنتاج

**تاريخ الفحص:** 3 نوفمبر 2026  
**مصدر المخطط:** قاعدة الإنتاج PostgreSQL 17.11  
**اختبار CLI:** GitHub Actions run `41600477197` — **نجاح كامل**  
**الرابط:** https://github.com/layan555914/layan_new/actions/runs/41600477197

## ملخص النتيجة

تم إنشاء Supabase محلي جديد من الصفر باستخدام Supabase CLI وDocker، وأُعيد تطبيق مخطط التطبيق وسياسات التخزين، ثم اجتازت كل تأكيدات المخطط وRLS واختبارات Storage API. نجح كذلك مسار التحقق المعتاد للمنصة وPlaywright وقراءة Supabase الحية.

الاختبار جرى في بيئة محلية مؤقتة داخل GitHub Actions، ولم يكن مرتبطًا بأي مشروع Supabase مستضاف.

## ملفات baseline ومراحل التشغيل

الملف المجمّع للقراءة والمراجعة:
- `_review/PRODUCTION_BASELINE_COMPLETE_20261103.sql`

**لا تشغّل الملف المجمّع كملف migration واحد.** هو مرجع يجمع المرحلتين. التنفيذ الصحيح والمختبر يتم كالآتي:

1. `_review/PRODUCTION_BASELINE_APP_20261103.sql` — جداول ودوال وعروض ومشغلات وصلاحيات التطبيق. يُطبّق كـmigration بدور مالك مخطط التطبيق.
2. `_review/PRODUCTION_BASELINE_STORAGE_ADMIN_20261103.sql` — حاويات التخزين وامتيازاته وسياسات `storage.objects`. في اختبار CLI المحلي تم تطبيقه عبر سياق superuser داخل حاوية الاختبار، لأن Supabase يحتفظ بملكية جداول Storage لدور الإدارة المُدار.

الملفات التفصيلية الأخرى:
- `PRODUCTION_BASELINE_TABLES_20261103.sql`
- `PRODUCTION_BASELINE_CONSTRAINTS_INDEXES_20261103.sql`
- `PRODUCTION_BASELINE_FUNCTIONS_VIEWS_TRIGGERS_20261103.sql`
- `PRODUCTION_BASELINE_RLS_POLICIES_20261103.sql`
- `PRODUCTION_BASELINE_APP_GRANTS_20261103.sql`
- `PRODUCTION_BASELINE_STORAGE_BUCKETS_20261103.sql`
- `PRODUCTION_BASELINE_STORAGE_POLICIES_20261103.sql`

جميعها في فرع المراجعة `review/directory-atomic-audit-20261103` تحت `_review/`، ولا توجد كترحيلات رسمية في `main`.

## مطابقة عناصر المخطط من كتالوج الإنتاج

| العنصر | العدد |
|---|---:|
| جداول التطبيق | 28 (26 public و2 private) |
| القيود | 135 |
| الفهارس الثانوية | 32 |
| الدوال والإجراءات | 20 |
| العروض | 2 |
| المشغلات | 7 |
| سياسات RLS للتطبيق | 80 |
| مجموعات امتيازات الجداول والعروض | 70 |
| تسلسلات لها امتيازات API | 2 |
| حاويات Storage | 2 |
| سياسات `storage.objects` | 6 |

تم تفعيل RLS على الجداول الـ28 الخاصة بالتطبيق. أما جداول Storage المُدارة فيتم تفعيل RLS عليها في حزمة Supabase القياسية، ويتأكد الاختبار من بقائه مفعلًا بعد إعادة الاستعادة.

## مسار Supabase CLI الذي نجح

ملف التشغيل:
- `scripts/ci/rehearse-production-schema-baseline.sh`

ملف تأكيدات SQL:
- `tests/db/production-schema-baseline.assertions.sql`

اختبار Storage API:
- `tests/db/storage-api-baseline.mjs`

ما قام به التشغيل `41600477197`:
- تثبيت Supabase CLI بإصدار محدد `2.84.2`.
- فحص Docker.
- إنشاء مجلد مشروع مؤقت خارج شجرة المستودع، دون ربطه بمشروع مستضاف.
- تشغيل Supabase محلي مع PostgreSQL 17 وAuth وStorage وPostgREST.
- نسخ مرحلة التطبيق إلى مجلد migrations المؤقت ثم تنفيذ `supabase db reset --local --no-seed`.
- تطبيق مرحلة Storage المُدارة داخل حاوية PostgreSQL المؤقتة بالسياق الإداري المطلوب.
- مطابقة الجداول والقيود والفهارس والدوال والعروض والمشغلات وسياسات RLS والامتيازات والحاويات.

<badge>كل تأكيدات إعادة البناء المحلية اجتازت</badge>

## اختبارات السلوك الناجحة

**دليل أسيوط**
- منع نشر جهة بلا مصدر عام.
- قبول النشر بعد ربط مصدر عام.
- حصر قراءة الزائر في المنطقة المنشورة.
- منع الزائر من قراءة جدول البيانات الخاصة أو استعمال مخطط `private`.
- منع الزائر من تنفيذ دوال الإدارة.

**Storage API بمستخدمين تجريبيين**
- أنشأ الاختبار حسابين مؤقتين في Auth المحلي.
- رفع كل مستخدم ملفه داخل مجلده: نجح.
- رفع المستخدم الأول ملفًا داخل مجلد المستخدم الثاني: رُفض.
- قراءة ملف المستخدم الثاني بواسطة المستخدم الأول: رُفضت.
- محاولة المستخدم الأول حذف ملف المستخدم الثاني عبر Storage API: لم تحذف الملف، وظل قابلًا للقراءة بواسطة صاحبه.
- حذف المالك لملفه عبر Storage API: نجح.
- قراءة زائر لمستند خاص: رُفضت.

استخدم الاختبار Storage API للحذف، وليس SQL المباشر؛ لأن Supabase يمنع الحذف المباشر من `storage.objects` لحماية الملفات من أن تصبح orphaned. توثيق Supabase يوصي باستخدام Storage API للحذف.  
المصدر: https://supabase.com/docs/guides/storage/management/delete-objects

أُنشئت حسابات الاختبار والملفات محليًا فقط، ثم نُظفت عبر واجهات Auth وStorage قبل إيقاف الحزمة.

**فحوص المنصة**
- JavaScript syntax وDeno type-check.
- فحص صفحات RTL والأصول المحلية وPWA.
- Playwright customer/admin journeys.
- فحص القراءة الحية وحدود صلاحيات `anon`.

وظيفتا GitHub Actions في التشغيل `41600477197` انتهتا بحالة `success`.

## حدود ما تعنيه النتيجة

الاختبار يثبت أن **snapshot الحالة الحالية لمخطط التطبيق يمكن إنشاؤه في Supabase جديد محليًا، وأن سياسات الوصول والتخزين الأساسية تعمل في الاختبار**. لكنه لا يعيد إنشاء التاريخ الأصلي للترحيلات الـ59.

لا يزال خارج هذا الـsnapshot:
- Auth users والجلسات.
- صفوف المسؤولين في `private.layan_admins`.
- قرارات `private.project_decisions`.
- مفاتيح VAPID الخاصة.
- بيانات الشركات والعقارات والدليل.
- صفوف وملفات Storage الفعلية.

تحتاج هذه العناصر خطة نقل/تهيئة منفصلة، مع حماية الأسرار والبيانات الشخصية.

## حالة سجل migrations والإنتاج

- سجل migrations المسجل في الإنتاج لا يزال 59 حتى `20261102180739`.
- لم تُستعد ملفات SQL التاريخية الأصلية الـ59.
- لم يتغير `supabase_migrations.schema_migrations`، ولم يتم تنفيذ `migration repair`.
- snapshot الجديد لم يوضع داخل `supabase/migrations` في فرع الإنتاج، ولم يتم دفعه إلى قاعدة الإنتاج. لا يجوز تشغيله على الإنتاج الحالي كإجراء استعادة.

فحص الإنتاج بعد الاختبارات أكد:
- الجهات: 70
- المشروعات: 37
- المناطق: 26
- المصادر: 81
- الفرص: 31
- migrations: 59
- دالة `directory_admin_mutate_with_audit` غير مطبقة على الإنتاج.

**لا دمج ولا نشر:** PR #42 ما زال مسودة، و`main` والإنتاج لم يتغيرا في هذه المهمة.


## Addendum — approved metadata-only migration ledger alignment (2026-11-03 17:35 Egypt time)

The user explicitly approved adding the baseline and marketplace-seed migration records to the production migration ledger only.

Immediately before the change, all 15 production catalog fingerprints matched the reviewed baseline; all 11 marketplace category rows matched the seed exactly; the two versions were absent; and the directory-admin RPC was absent.

The two records were added to `supabase_migrations.schema_migrations` using the same metadata upsert fields and SQL-statement parsing behavior as Supabase CLI v2.84.2 `migration repair --status applied`. The CLI executable itself was not run because a linked CLI/database-password session was unavailable; the metadata-only operation was performed through the authorized Supabase SQL connection.

Post-change checks:
- Migration ledger count is 61.
- The exact baseline and category-seed version/name records are present.
- The 11 category rows remain unchanged.
- The directory-admin RPC migration version `20261103141537` is still pending.
- The directory-admin RPC itself remains absent.
- No SQL from the two repaired migration files was executed; no application data, users, files, schema objects or policies were changed.

The repository has 62 migration files, so the only file not yet represented in the production ledger is `20261103141537_directory_admin_mutate_with_audit.sql`. A literal `supabase db push --dry-run` was not available in this session; the pending state was derived from the verified repository file list and the production migration ledger. No push, merge or deployment was performed.


## Final readiness check — directory admin RPC (2026-11-03)

CI run [#41666562897](https://github.com/layan555914/layan_new/actions/runs/41666562897) completed successfully for both the full disposable Supabase baseline rehearsal and platform validation.

A new staging transaction test invoked the already-installed RPC as an authenticated staging admin, updated only the synthetic directory entity, and returned a valid audit ID. The transaction was rolled back. Post-rollback checks showed: zero audit rows, zero temporary admin memberships, original synthetic entity description restored, and the same single pre-existing staging Auth user.

Staging catalog still reports SECURITY INVOKER, empty search_path, no anon EXECUTE, and authenticated/service_role EXECUTE. The production read-only preflight confirmed all RPC dependency tables and `layan_is_admin()` exist, authenticated table grants and audit INSERT are in place, and RLS is enabled on all affected tables. The RPC itself remains absent in production.

**Status: ready for a separately approved production DDL migration only.** No production RPC SQL has been executed; no merge, frontend deployment, or additional production migration was performed.
