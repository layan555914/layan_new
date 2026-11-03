# مراجعة لوحة إدارة دليل أسيوط — بيئة الاختبار
التاريخ: 3 نوفمبر 2026

## النطاق والضوابط
- قاعدة الاختبار فقط: `layan-claude-test` — `wisnmlbefdrkcbbqvdlg`.
- قاعدة الإنتاج `ebyhwqkmhxbgocngpqfe` لم تُعدّل.
- لا تغييرات على الحسابات أو عضوية المسؤولين أو الصلاحيات أو إعدادات Auth/Storage.
- لا نشر ولا دمج. PR #42 يظل Draft ومفتوحًا.

## حالة بيانات الدليل في staging
الجداول والاعتماديات موجودة بالفعل، لذلك لم تُنشأ نسخة مكررة ولم تُنسخ بيانات إنتاج:
- `directory_areas`: 3
- `directory_entities`: 1
- `directory_entity_private`: 0
- `directory_projects`: 1
- `directory_project_private`: 0
- `directory_opportunities`: 1
- `directory_sources`: 1
- `directory_entity_sources`: 1
- `directory_project_sources`: 1
- `directory_opportunity_sources`: 1
- `directory_change_log`: 0
- `private.layan_admins`: 0
- حسابات Auth الموجودة قبل الاختبار: 1

## نتائج اختبارات القراءة
1. دور `anon`: قرأ 3 مناطق و1 جهة و1 مشروع و1 فرصة و1 مصدر، وفق سياسات النشر الحالية.
2. دور `authenticated` بحساب staging الموجود: `public.layan_is_admin() = false`، وقرأ نفس النطاق العام.
3. الزائر لا يملك صلاحية SELECT على `directory_entity_private`؛ محاولة القراءة رُفضت بصلاحيات PostgreSQL.
4. جميع اختبارات الأدوار نُفذت داخل معاملات انتهت بـ ROLLBACK؛ لم تُنشأ أو تُعدّل سجلات.

## عائق لوحة الإدارة المكتشف
- `directory-admin.js` يستدعي RPC باسم `public.directory_admin_mutate_with_audit` في عمليات التعديل، وربط المصدر، وإضافة المصدر.
- الدالة غير موجودة في قاعدة staging، ولا توجد دالة مطابقة ضمن وظائف `public/private` المفحوصة.
- لذلك عمليات الحفظ والنشر وربط المصادر لن تكتمل عبر الواجهة حتى توفير RPC آمنة ومتوافقة.
- لا يوجد مسؤول معتمد في staging؛ لذلك لا يمكن إجراء اختبار إيجابي لمسار المسؤول دون موافقة منفصلة على تجهيز هوية اختبار مؤقتة وخطة تنظيفها.

## ضوابط قاعدة البيانات الموجودة
- RLS مفعّل على جداول الدليل.
- سياسات القراءة العامة مقيدة بسجلات منشورة، وسياسات الإدارة تستخدم `layan_is_admin()`.
- Trigger `directory_require_public_source()` يمنع نشر جهة أو مشروع أو فرصة دون مصدر عام مرتبط.
- لا ينبغي تجاوز هذه الحماية أو استخدام service-role في المتصفح.

## مراجعة المستشارين
- 4 جداول بلا سياسات RLS: `private.layan_admins`, `private.project_decisions`, `public.buyer_push_subscriptions`, `public.buyer_push_vapid_config`؛ تظل deny-by-default ولا تُضاف سياسات دون سبب موثق.
- تحذير Leaked Password Protection معطل؛ لم يتغير.
- تحذير multiple permissive policies على `company_profiles` SELECT؛ لم يتغير.
- 26 تحذير unused indexes؛ لم تُحذف أي فهارس.

## الخطوة الفنية المطلوبة قبل اختبار الإدارة
تصميم ومراجعة migration لـ `directory_admin_mutate_with_audit`:
- قائمة سماح صريحة للجداول والعمليات والحقول.
- تحقق داخلي من `auth.uid()` وعضوية `private.layan_admins`.
- منع تعديل مفاتيح PK وحقول النظام الحساسة.
- تنفيذ التعديل وسجل `directory_change_log` في معاملة واحدة.
- رفض أي جدول/حقل/عملية غير معتمدة.
- اختبار الرفض للمستخدم العادي والنجاح لمسؤول اختبار مؤقت بعد الموافقة.

**الخلاصة:** اختبارات قراءة staging نجحت، لكن لوحة إدارة الدليل غير جاهزة للاعتماد بسبب RPC مفقودة وعدم وجود مسؤول اختبار. لم يتم أي تعديل إنتاجي أو نشر أو دمج.
