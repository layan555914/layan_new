# مراجعة ما قبل النشر وإصلاحات 2 نوفمبر 2026

## نطاق المراجعة
- المستودع: `layan555914/layan_new`
- الفرع: `restore/asyut-aqar-full-platform-20261101`
- طلب الدمج: [PR #30](https://github.com/layan555914/layan_new/pull/30)
- عدد الملفات المتغيرة الصحيح في PR: **58 ملفًا**. كان تقرير أسبق يذكر 61، وتم تصحيح الرقم في `COMPLETE_PR30_AUDIT_20261102.md`.
- قاعدة البيانات: مشروع Supabase `ebyhwqkmhxbgocngpqfe`.
- هذه مراجعة كود/سياسات/اختبارات آلية، وليست شهادة اختبار قبول نهائي داخل المتصفح.

## الإصلاحات البرمجية المنفذة

### 1. زر استعادة كلمة المرور
- `app.js` — السطر 221: صار زر الاستعادة ظاهرًا في وضع تسجيل الدخول ومخفيًا في وضع إنشاء الحساب.
- `marketplace.js` — السطر 33: تم استخدام خاصية `hidden` بشكل مباشر بدل الاعتماد على class قد تتغلب عليه قواعد CSS.
- المصدر: [إصلاح واجهة الدخول الرئيسية](https://github.com/layan555914/layan_new/commit/74fb6384fba99f9e14ffbc78ac07fe75142922c2) و[إصلاح واجهة دخول السوق](https://github.com/layan555914/layan_new/commit/28f70d4c04b1bc12bdd704ca99823d88d8466b05).

### 2. صور الإعلانات التجارية
- `sponsor.js` — السطر 44: أزيلت صور Pexels العامة التي قد تظهر كما لو كانت صور نشاط المعلن. الصورة المعروضة الآن هي الصورة التي يرسلها المعلن بعد التحقق من الرابط، وإلا يظهر عنصر احتياطي محايد باسم النشاط.
- المصدر: [إصلاح صور الإعلانات](https://github.com/layan555914/layan_new/commit/6722a9feb1aded76088716d42da9b362dab3d58c).

### 3. توسيع التحقق الآلي
- `.github/workflows/validate-static.yml` أصبح يفحص:
  - صياغة ملفات JavaScript داخل المشروع بصورة recursive.
  - أنواع TypeScript لوظيفتي Supabase Edge Functions باستخدام Deno.
  - ملفات HTML واتجاه RTL واللغة العربية.
  - الروابط المحلية وملفات CSS وManifest وService Worker وCNAME.
  - عقود إظهار زر استعادة كلمة المرور وعدم إظهار صور إعلانية عامة مضللة.
- المصدر: [توسيع Workflow](https://github.com/layan555914/layan_new/commit/10fb9bf1cd7e36813c92093eeacc128aafdbadd6).
- تم استبدال README المختصر بتوثيق هيكل المنصة وتشغيلها وقواعد العمل وحواجز النشر: [README](https://github.com/layan555914/layan_new/commit/d9f13addb09b862199705689dd4a0f628ac8f5fa).

## إصلاحات قاعدة بيانات الإنتاج

تم تطبيق الإصلاحات التالية فعليًا على Supabase، وتأكد وجود نسخها في سجل migrations:

### 1. أقل صلاحية لازمة على الجداول والعروض
Migration: `20261102040339_tighten_public_table_grants_20261102`.

- `user_favorite_offers`: إزالة جميع صلاحيات anon؛ للمستخدم المسجل SELECT وINSERT وDELETE فقط، دون UPDATE أو TRUNCATE.
- `buyer_offer_alerts`: منح المستخدم المسجل SELECT وINSERT وUPDATE وDELETE فقط، دون TRUNCATE.
- `company_profiles_public` و`public_active_supplier_ads`: صلاحية SELECT فقط للزوار والمستخدمين المسجلين؛ لا إدخال أو تعديل أو حذف أو TRUNCATE.

### 2. إصلاح قدرة الإدارة على مراجعة ملفات الشركات
Migrations:
- `20261102040527_company_profiles_admin_read_scope_20261102`
- `20261102040606_split_company_profile_admin_select_policy_20261102`

المشكلة التي كُشفت: واجهة الإدارة تستدعي `PATCH` لطلب الشركة الجديد بعد تحميله من RPC آمن، لكن سياسة SELECT لم تكن تشمل الإدارة. وعمليات UPDATE في Postgres/PostgREST تحتاج أيضًا صلاحية رؤية الصف.

الحالة النهائية للسياسات:
- `company_profiles_read_scope`: الزائر والمستخدم العادي يرى الملف النشط أو ملفه المملوك لحسابه فقط.
- `company_profiles_admin_read`: للمستخدم المسجل فقط، وتسمح بالقراءة عند نجاح `public.layan_is_admin()`.
- فصل سياسة الإدارة عن سياسة الزوار مهم لأن دالة فحص الإدارة لا تمنح anon صلاحية EXECUTE.

### تحقق ما بعد الإصلاح
- تحققنا من أن الزائر يستطيع تنفيذ SELECT على جدول الشركة دون خطأ، والصفوف المرئية في وقت الاختبار كانت صفرًا لأن جدول الشركات فارغ.
- تحققنا من أن View دليل الشركات يعمل للزائر.
- تحققنا من grants النهائية: لا يستطيع anon قراءة أو إدخال المفضلة أو التنبيهات؛ ولا يملك المستخدم المسجل TRUNCATE؛ والـ Views أصبحت SELECT-only.
- لم تُنشأ بيانات اختبار ولم تُحذف أي سجلات. لم يتم تعديل حساب مستخدم أو كلمة مرور أو صلاحيات حساب شخصي.
- مرجع SQL للتتبع فقط: [APPLIED_ACCESS_CONTROL_REPAIRS_20261102.sql](https://github.com/layan555914/layan_new/blob/restore/asyut-aqar-full-platform-20261101/_review/APPLIED_ACCESS_CONTROL_REPAIRS_20261102.sql). الملف سجل تاريخي وليس أمرًا لإعادة تشغيله.

## نتائج الاختبارات

GitHub Actions:
- Workflow Run: [Run #182 — Validate ASYUT AQAR platform](https://github.com/layan555914/layan_new/actions/runs/41386429095)
- النتيجة: **success**.
- الخطوات المكتملة بنجاح:
  1. إعداد بيئة Node.
  2. إعداد Deno.
  3. فحص صياغة JavaScript.
  4. Type-check لوظيفتي `asyut-admin` و`asyut-push`.
  5. فحص صفحات HTML والملفات المحلية وPWA وواجهة استعادة كلمة المرور وCNAME.

Supabase:
- سجل migrations يؤكد إدراج الإصلاحات الثلاثة أعلاه.
- تحققت من تعريفات سياسات RLS النهائية ومنح الصلاحيات بعد التطبيق.
- الجداول العقارية والتجارية الرئيسية لا تحتوي إعلانات اختبارية في وقت المراجعة؛ لذلك لا يمكن اعتبار خلوها دليلًا على نجاح رحلة نشر إعلان حقيقي.

## نقاط ما زالت تمنع إعلان الجاهزية النهائية

1. **الشعار الأصلي:** ملف `icon.svg` الحالي ليس مثبتًا أنه الشعار الأصلي الذي طلبت الحفاظ عليه كما هو. لم أستبدله ولم أعدل ملفات الصور المعتمدة. يلزم التأكد من ملف الشعار الأصلي قبل اعتماد الهوية النهائية.
2. **اختبار المتصفح الفعلي:** لا تتاح في هذه الجلسة أداة متصفح لاختبار رحلات المستخدم end-to-end، لذلك لم أختبر إنشاء حساب حقيقي أو رفع صورة فعلية أو اعتماد عقار من واجهة الإدارة.
3. **GitHub Pages والدومين:** لم أتمكن من قراءة إعدادات GitHub Pages الفعلية عبر اتصال GitHub المتاح، كما لم تتمكن أداة التصفح من فتح `https://layan-eg.com`. هذا لا يثبت أن الموقع متوقف؛ لكنه يعني أن مصدر النشر وحالة HTTPS وظهور النسخة الحالية لم يتم تأكيدها.
4. **الإشعارات:** نجاح فحص TypeScript لا يثبت وصول Push إلى جهاز حقيقي. يلزم اختبار جهاز بموافقة صاحبه.
5. **معاينة مشاركة الروابط وSEO:** تحديث OG وJSON-LD عبر JavaScript لا يضمن وحده أن جميع منصات المشاركة ستقرأ البيانات الديناميكية؛ يلزم اختبار المعاينة أو تجهيز prerender/server metadata.
6. **إعداد Auth:** ما زال تحذير Supabase الخاص بـ Leaked Password Protection ظاهرًا. لم أغيّر إعدادات Auth أو كلمات مرور المستخدمين في هذه المراجعة.
7. **بيانات المنصة:** كان جدول `marketplace_categories` يحتوي 11 قسمًا نشطًا، بينما جداول العروض وملفات الشركات والإعلانات الرئيسية كانت فارغة وقت مراجعة الإنتاج. لم أستعد بيانات تاريخية غير موجودة في قاعدة البيانات.

## قرار ما قبل النشر
- الإصلاحات البرمجية أعلاه موجودة على فرع الاستعادة، واختبار GitHub Actions رقم 182 نجح.
- إصلاحات الصلاحيات والسياسات مطبقة على قاعدة بيانات الإنتاج وتم التحقق من حالتها.
- **الحالة: لم تُعتمد الجاهزية النهائية للنشر بعد.**
- PR #30 يظل مفتوحًا كـ Draft. لم أدمجه ولم أنشر نسخة على الدومين، ولم أغير DNS أو إعداد الاستضافة.
- لا إعلان إطلاق قبل تأكيد الشعار، وإعدادات Pages والدومين، واختبار متصفح عملي للمسارات الأساسية.

## سجل المصادر والمراجع
- [PR #30 — طلب الاستعادة](https://github.com/layan555914/layan_new/pull/30)
- [التدقيق الكامل السابق بعد تصحيح عدد الملفات](https://github.com/layan555914/layan_new/blob/restore/asyut-aqar-full-platform-20261101/_review/COMPLETE_PR30_AUDIT_20261102.md)
- [Workflow Run #182](https://github.com/layan555914/layan_new/actions/runs/41386429095)
- [إصلاح زر نسيت كلمة المرور في الصفحة الرئيسية](https://github.com/layan555914/layan_new/commit/74fb6384fba99f9e14ffbc78ac07fe75142922c2)
- [إصلاح زر نسيت كلمة المرور في السوق](https://github.com/layan555914/layan_new/commit/28f70d4c04b1bc12bdd704ca99823d88d8466b05)
- [إزالة الصور التجارية العامة المضللة](https://github.com/layan555914/layan_new/commit/6722a9feb1aded76088716d42da9b362dab3d58c)
- [توسيع فحوص GitHub Actions](https://github.com/layan555914/layan_new/commit/10fb9bf1cd7e36813c92093eeacc128aafdbadd6)
- [تحديث README](https://github.com/layan555914/layan_new/commit/d9f13addb09b862199705689dd4a0f628ac8f5fa)
- [نسخة تتبع إصلاحات الصلاحيات](https://github.com/layan555914/layan_new/blob/restore/asyut-aqar-full-platform-20261101/_review/APPLIED_ACCESS_CONTROL_REPAIRS_20261102.sql)
