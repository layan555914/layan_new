# تدقيق استعادة سجل Supabase Migrations — 3 نوفمبر 2026

## النتيجة التنفيذية

**لم يتم العثور على سلسلة ملفات migrations الكاملة للإنتاج.** لا يمكن اعتماد إعادة بناء كاملة أو مزامنة تاريخ الترحيلات اعتمادًا على المستودع الحالي أو مشروع الاختبار الموجود.

- مشروع الإنتاج `ebyhwqkmhxbgocngpqfe`: **59 ترحيلًا** مسجلًا، من `20261025191213` إلى `20261102180739`.
- مشروع الاختبار `wisnmlbefdrkcbbqvdlg`: **19 ترحيلًا**، بسلسلة مختلفة تبدأ من `20261031075614` وتنتهي عند `20261101172144`.
- فرع `main` لا يحتوي `supabase/migrations/`؛ محتويات مجلد `supabase` الحالية تقتصر على Edge Functions.
- المستودع لا يحتوي `supabase/config.toml` في `main`.

## ما أمكن استعادته من GitHub

1. عُثر على ملف قديم واحد فقط: `supabase/migrations/20261030_company_profiles.sql` في الفرع التاريخي `review/claude-full-implementation`.
2. يؤكد commit `c2e4f05143f6585cfb2674537fc4ae0622ebee6d` بتاريخ 1 نوفمبر 2026 حذف هذا الملف عند إزالة ملفات LAYAN القديمة. [الالتزام](https://github.com/layan555914/layan_new/commit/c2e4f05143f6585cfb2674537fc4ae0622ebee6d).
3. فحص أشجار الفروع التاريخية المرتبطة بالاستعادة والدليل والإصلاحات لم يُظهر سلسلة migrations أخرى؛ في الفروع التي احتوت مجلد migrations لم يظهر إلا هذا الملف الواحد.
4. توجد ملفات SQL مراجعة/تتبّع في `_review` لبعض إصلاحات لاحقة، لكنها ليست سلسلة الترحيلات الأصلية الكاملة ولا يجوز تشغيل نسخ التدقيق مرة أخرى دون تحليل اختلافها عن الحالة الحية.

## لماذا لا نستخدم مشروع الاختبار كنسخة مصدر

مشروع الاختبار لديه 19 ترحيلًا تختلف أسماؤها وإصداراتها عن سجل الإنتاج. كما سبق استخدامه لاختبارات مؤقتة؛ وجود جداول أو بيانات اختبار لم يكن نسخة مطابقة من إنتاج المنصة. لا يصلح هذا المشروع لإعادة بناء تاريخ الإنتاج أو لتطبيق migrations الناقصة عليه باعتباره بيئة staging مطابقة.

## سجل الإنتاج الكامل كما أبلغت عنه Supabase

| الإصدار | اسم الترحيل |
|---|---|
| 20261025191213 | `secure_property_offers_owner_and_trial_limit` |
| 20261025193501 | `allow_owners_to_view_own_offers` |
| 20261025193613 | `secure_layan_property_photo_uploads` |
| 20261025202223 | `allow_pending_property_offers` |
| 20261025205042 | `supplier_ad_free_trial_from_request` |
| 20261025210106 | `least_privilege_public_table_grants` |
| 20261025210305 | `harden_property_review_and_supplier_trial_fields` |
| 20261026065223 | `allow_curtains_and_furnishings_supplier_ads` |
| 20261026191159 | `restrict_layan_storage_upload_size_and_types` |
| 20261027093734 | `fix_public_offer_image_access_and_promotion_request_guard` |
| 20261027131047 | `index_supplier_and_promotion_foreign_keys` |
| 20261027142311 | `create_partner_ad_slots_for_free_trial` |
| 20261027142412 | `allow_supplier_ads_free_trial_requests` |
| 20261027142717 | `secure_admin_approval_for_free_trial_ads` |
| 20261027142729 | `add_admin_only_pending_ad_review_access` |
| 20261027143024 | `add_confirmed_layan_admin_account` |
| 20261027144249 | `add_confirmed_layan_admin_user` |
| 20261028174607 | `separate_paint_and_curtain_partner_ad_slots` |
| 20261029123626 | `company_property_ads_three_property_limit` |
| 20261029124034 | `fix_company_ad_limit_trigger_locking` |
| 20261029182442 | `add_images_to_partner_ad_slots` |
| 20261030192609 | `activate_supplier_ads_after_whatsapp_agreement` |
| 20261030192718 | `hide_ad_prices_and_secure_supplier_activation` |
| 20261030193054 | `restrict_supplier_ad_price_column_visibility` |
| 20261030193123 | `index_company_property_ads_owner_id` |
| 20261030193157 | `keep_live_supplier_ads_compatible_until_release` |
| 20261030194725 | `allow_custom_supplier_ad_terms` |
| 20261030210935 | `create_company_profiles_directory` |
| 20261030211003 | `restrict_company_profiles_api_grants` |
| 20261030220045 | `company_profile_revision_requested_flow` |
| 20261031081655 | `layan_company_profiles_resubmit_20261031` |
| 20261031081658 | `layan_company_profiles_pending_update_20261031` |
| 20261031081701 | `layan_company_profiles_scoped_read_20261031` |
| 20261031081754 | `layan_company_profiles_reviewed_by_index_20261031` |
| 20261031104640 | `expand_layan_marketplace_listing_and_service_categories` |
| 20261031132027 | `add_secure_admin_property_offer_review` |
| 20261031132151 | `harden_property_review_rpc_boundary` |
| 20261031183034 | `index_marketplace_listings_reviewed_by` |
| 20261101170447 | `create_seed_asyut_aqar_marketplace_categories` |
| 20261101172141 | `remove_layan_tables_keep_marketplace` |
| 20261101210205 | `asyut_aqar_company_profile_update_and_property_ad_limit` |
| 20261101220335 | `add_user_favorite_offers` |
| 20261101220830 | `add_location_search_and_buyer_alerts` |
| 20261101221638 | `tighten_buyer_alert_permissions_and_indexes` |
| 20261101222604 | `add_authenticated_web_push_subscriptions` |
| 20261101222624 | `add_authenticated_web_push_subscriptions` |
| 20261101223114 | `lock_push_subscriptions_to_edge_function` |
| 20261101223300 | `enforce_one_owner_per_push_endpoint` |
| 20261102040339 | `tighten_public_table_grants_20261102` |
| 20261102040527 | `company_profiles_admin_read_scope_20261102` |
| 20261102040606 | `split_company_profile_admin_select_policy_20261102` |
| 20261102175232 | `create_asyut_real_estate_directory_v1` |
| 20261102175438 | `allow_contextual_duplicate_directory_source_urls` |
| 20261102175617 | `seed_asyut_directory_areas_and_sources_v1` |
| 20261102175735 | `seed_asyut_directory_entities_v1` |
| 20261102180129 | `seed_asyut_directory_projects_v1` |
| 20261102180205 | `link_asyut_directory_entities_projects_and_opportunities_v1` |
| 20261102180326 | `refine_asyut_directory_policies_and_indexes` |
| 20261102180739 | `require_public_source_before_directory_publication` |

## سجل مشروع الاختبار الحالي

| الإصدار | اسم الترحيل |
|---|---|
| 20261031075614 | `test_baseline_company_profiles` |
| 20261031075627 | `draft_01_status_and_resubmission` |
| 20261031075657 | `draft_02_company_draft_updates` |
| 20261031075713 | `draft_03_public_columns_url_checks` |
| 20261031075841 | `test_fix_rpc_execute_grants` |
| 20261031080351 | `draft_03_secure_public_view_and_scoped_reads` |
| 20261031080802 | `draft_03_security_invoker_public_view` |
| 20261031081032 | `draft_03_hide_owner_ids_from_direct_reads` |
| 20261031081624 | `final_draft_02_hardened` |
| 20261031081627 | `final_draft_03_column_revoke` |
| 20261101093907 | `asyut_aqar_core_platform_schema` |
| 20261101094023 | `asyut_aqar_api_grants_hardening` |
| 20261101094104 | `asyut_aqar_security_definer_cleanup` |
| 20261101110023 | `admin_manage_partner_ad_slots` |
| 20261101110040 | `support_review_of_new_company_applications` |
| 20261101110352 | `enable_rls_on_private_admin_allowlist` |
| 20261101110818 | `safe_public_supplier_ads_view` |
| 20261101110857 | `secure_public_supplier_ads_view` |
| 20261101172144 | `remove_layan_tables_keep_marketplace` |

## ملفات التتبّع التي فُحصت

- `_review/APPLIED_DATABASE_REPAIR_20261101.sql`: نسخة تدقيق لإصلاحات شركة/حد عقارات، وليست السلسلة السابقة الكاملة.
- `_review/APPLIED_ACCESS_CONTROL_REPAIRS_20261102.sql`: نسخة تدقيق لجزء من تغييرات الصلاحيات والسياسات.
- `DIRECTORY_DATABASE_IMPLEMENTATION.md`: يوثق جداول الدليل وأعداد البيانات وأسماء آخر ثمانية migrations للدليل، لكنه لا يحتوي نصوص الترحيلات الثمانية.
- `DIRECTORY_SCHEMA_DRAFT.sql`: مسودة قصيرة، وليست schema dump كاملًا.
- `_review/DIRECTORY_ADMIN_ATOMIC_AUDIT_20261103.sql`: مقترح دالة الذرّية في PR #42؛ لا يعد migration مطبقًا.

## الإجراء الصحيح لاستعادة قابلية إعادة البناء

1. استعادة مستودع migrations الأصلي أو نسخ SQL الموثوقة لكل الترحيلات الـ59 من نسخة احتياطية/مصدر إصدار موثوق، ثم مطابقة محتوى كل ملف مع اسم وإصدار سجل الإنتاج.
2. عند تعذر استعادة التاريخ، يُدرس إنشاء baseline schema snapshot من قاعدة الإنتاج بأداة Supabase CLI الرسمية، بعد ربط المشروع محليًا وتوفير صلاحية اتصال قاعدة البيانات، ومراجعة SQL الناتج يدويًا. يجب تحديد سياسة صريحة للتعامل مع صفوف تاريخ الترحيلات الحالية قبل أي تعديل لها.
3. اختبار بناء قاعدة جديدة بالكامل من الملفات المستعادة أو الـbaseline على بيئة اختبار مستقلة مطابقة؛ ثم مطابقة الجداول والسياسات والوظائف وTriggers والامتيازات وعدد السجلات دون نقل بيانات شخصية أو أسرار الإنتاج.
4. بعد نجاح ذلك فقط، إضافة دالة سجل المراجعة الذرّي كمigration لاحق، وتطبيقه على بيئة اختبار أولًا، ثم اتخاذ قرار منفصل بشأن الإنتاج.

## ما لم يتم في هذه الجولة

- لم يتم تطبيق أو إصلاح أو حذف أي migration في الإنتاج.
- لم يتم تعديل جدول `supabase_migrations.schema_migrations` أو تنفيذ `migration repair`.
- لم يتم إنشاء baseline تخميني أو ملفات migrations فارغة.
- لم يتم نقل بيانات الإنتاج أو استنساخها أو كشف بيانات شخصية.
- لم يتم تشغيل SQL المقترح في PR #42 على الإنتاج.
- لم يتم الدمج أو النشر.

**قرار المراجعة:** يبقى PR #42 مسودة. مصدر migration history لم يُستعد بعد، وبالتالي لا يجوز نشر واجهة تستدعي RPC غير منشورة ولا إنشاء تاريخ ترحيلات بديل على الإنتاج في هذه المرحلة.

## تحديث التنفيذ — baseline محلي قابل لإعادة البناء (3 نوفمبر 2026)

بعد مراجعة ملفات اللقطة الموجودة في فرع المراجعة، تم تحويل مخطط التطبيق الحالي إلى سلسلة محلية قابلة لإعادة البناء، مع الإبقاء على حقيقة أن تاريخ الإنتاج الأصلي لم يُستعد:

1. `supabase/config.toml` — إعداد المشروع المحلي، بلا project ref مستضاف أو أسرار.
2. `supabase/migrations/20261103140155_asyut_aqar_production_schema_baseline.sql` — baseline مضغوط مستخرج من ملف لقطة مخطط التطبيق. لا يحتوي بيانات المستخدمين أو بيانات الأعمال أو بيانات الاتصال الداخلية أو الأسرار أو ملفات Storage.
3. `supabase/migrations/20261103141537_directory_admin_mutate_with_audit.sql` — migration إضافية للدالة الإدارية الذرية؛ تعتمد على الجداول والسياسات والدوال التي أنشأها baseline.
4. `supabase/bootstrap/storage-baseline.sql` — إعداد منفصل ومقصود لمخطط Storage المدار، وامتيازات API، وبيانات تعريف bucketين وسياسات objects الست. يُنفذ في إعادة البناء المحلية فقط بسياق المالك/المشرف المناسب، ولا يُخلط مع migration التطبيق العادية.
5. `supabase/README.md` — يوضح حدود baseline، وآلية التطوير المحلي، وحظر الدفع للإنتاج قبل خطة منفصلة.
6. تم تعديل `scripts/ci/rehearse-production-schema-baseline.sh` ليطلب من Supabase CLI إنشاء مسارات migrations المؤقتة ثم ينسخ الملفات القانونية إليها بالترتيب: baseline أولًا، ثم RPC الإدارية، ويطبق Storage من ملف bootstrap منفصل.
7. تم تحديث `tests/db/production-schema-baseline.assertions.sql` ليتوقع 21 routine بدل 20، ويتحقق من أن RPC الجديدة:
   - لا تمنح `anon` صلاحية EXECUTE.
   - تمنح `authenticated` صلاحية EXECUTE اللازمة مع تحقق المسؤول داخل الدالة.
   - تعمل بصيغة `SECURITY INVOKER` وليست `SECURITY DEFINER`.
8. تم توسيع `tests/db/storage-api-baseline.mjs` لاختبار فعلي عبر API المحلي: رفض anon والمستخدم غير المسؤول، تعديل سجل من مسؤول اختبار مؤقت، رفض تعديل المفتاح الأساسي، إضافة مصدر وربطه، التحقق من ثلاث سجلات تدقيق، وفرض فشل audit insert للتأكد من تراجع تعديل السجل معه. التنظيف يتحقق من صفر بقايا لجهات/مصادر/روابط/سجلات التدقيق التجريبية.

**تمييز أساسي:** هذه السلسلة هي نقطة بداية جديدة ومضغوطة لإعادة بناء الحالة الحالية من 3 نوفمبر 2026؛ لا تدّعي أنها ملفات الـ59 migration الأصلية ولا أنها تطابق ترتيبها التاريخي. لم يتم تعديل `supabase_migrations.schema_migrations` في الإنتاج، ولم تُنفذ أي migration على الإنتاج، ولم يتم استخدام `db push --linked` أو `migration repair`. يجب إبقاء الـbaseline على فرع المراجعة حتى يُراجع ويُختبر من الصفر.

## تحديث إعادة البناء القابلة للتكرار — 3 نوفمبر 2026

تم تجهيز التسلسل المحلي التالي داخل فرع المراجعة:

- `supabase/migrations/20261103140155_asyut_aqar_production_schema_baseline.sql`: لقطة مخطط التطبيق الحالية كما كانت في 3 نوفمبر 2026، دون صفوف التطبيق أو Auth أو بيانات إدارة أو أسرار.
- `supabase/migrations/20261103141537_directory_admin_mutate_with_audit.sql`: التغيير الإضافي لدالة تعديل الدليل وسجل التدقيق الذري، بعد baseline.
- `supabase/config.toml`: إعداد Supabase المحلي بلا project ref مستضاف أو أسرار.
- `supabase/bootstrap/storage-baseline.sql`: منح Storage وbucket metadata وسياسات Storage الست، منفصلة عن migrations التطبيق لأن جداول Storage مُدارة من Supabase ولها مالك وصلاحيات تشغيل خاصة.
- `supabase/README.md`: شرح آلية التطوير المحلي وحدود الإنتاج.

تم تحديث سكربت CI ليطلب من Supabase CLI إنشاء أسماء ملفات migrations المؤقتة بأمر `supabase migration new` ثم ينسخ إليها الملفات المراجعة بالترتيب. يعيد الاختبار بناء قاعدة محلية نظيفة بـ `supabase db reset --local --no-seed`، ثم يطبق Storage bootstrap فقط داخل قاعدة Docker المؤقتة بسياق المشرف المناسب.

تم توسيع الاختبارات لتتأكد من:
- وجود 21 routine بعد إضافة RPC.
- رفض EXECUTE لدور `anon` ومنحه إلى `authenticated`.
- أن RPC الجديدة `SECURITY INVOKER` وليست `SECURITY DEFINER`.
- رفض RPC للمستخدم العادي والزائر، وقبولها لمسؤول الاختبار المحلي.
- تحديث جهة، إضافة مصدر، ربط المصدر، رفض حقل المفتاح الأساسي.
- إجبار سجل التدقيق على الفشل والتحقق أن تعديل الجهة نفسه لا يبقى بعد فشل التدقيق.
- حذف كل سجلات الاختبار والتحقق من عدم بقاء جهات/مصادر/روابط/آثار تدقيق أو مستخدمي Auth أو عضوية مسؤول مؤقتة.

**ما زال غير مستعاد:** SQL التاريخي الأصلي للـ59 migration. هذه بداية baseline مضغوطة للحالة الحالية، وليست إعادة إنشاء للتسلسل الأصلي. لا يجوز اعتبار رقم baseline الجديد بديلًا عن تاريخ الإنتاج، ولا يجوز تشغيل `db push --linked` أو `migration repair` على الإنتاج. لم يتغير سجل migrations للإنتاج.

### نتيجة إعادة البناء المحلية الكاملة

- GitHub Actions run **#41651964865** نجح في المهمتين: `validate` و`rehearse-full-supabase-baseline`.
- سجل التشغيل يثبت أن قاعدة Supabase محلية جديدة طبقت migration baseline ثم migration دالة الإدارة بالترتيب، ثم نجحت اختبارات Auth/password recovery وMarketplace وDirectory Admin RPC وProperty lifecycle وStorage RLS.
- اختبار دالة الإدارة سجل PASS لرفض الزائر وغير المسؤول، تحديث الجهة المسموح، إضافة المصدر وربطه، رفض حقل المفتاح الأساسي، تراجع التعديل عند فشل التدقيق، وثلاثة سجلات تدقيق ناجحة.
- سجل التنظيف النهائي أكد صفر بقايا من جهات ومصادر وروابط وسجلات تدقيق اختبارية، ومستخدمي Auth/الهويات ومسؤولي الاختبار المؤقتين وعروض العقارات وقوائم Marketplace وملفات Storage التجريبية.
- خطوات JavaScript وDeno وRTL/assets وPWA وPlaywright وقراءات staging وحدود الصلاحيات نجحت أيضًا.

[CI #41651964865 — Full success](https://github.com/layan555914/layan_new/actions/runs/41651964865)

