-- ASYUT AQAR home-finishing marketplace taxonomy.
-- Add dedicated ceramics, lighting, and curtains categories; reuse the existing
-- furniture category and associate already-known profiles without duplicating them.
-- All newly discovered businesses remain private and unverified.

BEGIN;

ALTER TABLE public.marketplace_categories
  DROP CONSTRAINT IF EXISTS marketplace_categories_display_order_check;
ALTER TABLE public.marketplace_categories
  ADD CONSTRAINT marketplace_categories_display_order_check
  CHECK (display_order BETWEEN 1 AND 16);

INSERT INTO public.marketplace_categories(name, description, display_order, is_active)
VALUES
  ('السيراميك والبورسلين والأدوات الصحية',
   'معارض السيراميك والبورسلين والأطقم الصحية والخلاطات وتجهيزات الحمامات.',
   14, true),
  ('الإضاءة ووحدات الإنارة',
   'محلات النجف ووحدات الإنارة الحديثة والأباليك والإضاءة الداخلية والخارجية.',
   15, true),
  ('الستائر والمفروشات',
   'محلات الستائر والأقمشة والتفصيل والمفروشات وتجهيزات النوافذ.',
   16, true)
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    is_active = true;

ALTER TABLE public.marketplace_listings
  DROP CONSTRAINT IF EXISTS marketplace_listings_category_check;
ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_category_check
  CHECK (category = ANY (ARRAY[
    'سوق العقارات','التنازلات العقارية','أراضي للبيع','أراضي التنازلات','إيجار يومي ومفروش',
    'الشركات والمكاتب العقارية','مواد البناء والتشطيب','الأثاث والفرش وتجهيز الوحدات',
    'المشروعات والمطورون العقاريون','الصيانة وإدارة العقارات','الاستشارات والخدمات العقارية',
    'مكاتب التصميم الهندسي','مهندسو الديكور والتصميم الداخلي',
    'السيراميك والبورسلين والأدوات الصحية','الإضاءة ووحدات الإنارة','الستائر والمفروشات'
  ]::text[]));

ALTER TABLE public.directory_entities
  ADD COLUMN IF NOT EXISTS marketplace_category text;

DO $category_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.directory_entities'::regclass
      AND conname='directory_entities_marketplace_category_check'
  ) THEN
    ALTER TABLE public.directory_entities
      ADD CONSTRAINT directory_entities_marketplace_category_check
      CHECK (marketplace_category IS NULL OR marketplace_category = ANY (ARRAY[
        'الأثاث والفرش وتجهيز الوحدات',
        'السيراميك والبورسلين والأدوات الصحية',
        'الإضاءة ووحدات الإنارة',
        'الستائر والمفروشات'
      ]::text[]));
  END IF;
END
$category_constraint$;

GRANT SELECT (marketplace_category) ON public.directory_entities TO anon, authenticated;

-- Keep directory category placement under administrator control, while preserving
-- the existing audited mutation function and its authorization checks.
DO $function_patch$
DECLARE
  v_definition text;
  v_old text := $needle$'verification_status','last_verified_at','next_review_at'$needle$;
  v_new text := $replacement$'verification_status','last_verified_at','next_review_at','marketplace_category'$replacement$;
BEGIN
  v_definition := pg_get_functiondef(
    'public.directory_admin_mutate_with_audit(text,text,uuid,jsonb,text)'::regprocedure
  );

  IF position(v_old IN v_definition) > 0 THEN
    v_definition := replace(v_definition, v_old, v_new);
    EXECUTE v_definition;
  ELSIF position('marketplace_category' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not safely extend the audited directory admin mutation allow-list';
  END IF;
END
$function_patch$;

-- Reclassify the profiles already present in the directory; no new copies are created.
UPDATE public.directory_entities
SET marketplace_category = 'السيراميك والبورسلين والأدوات الصحية'
WHERE slug IN (
  'aldoctor-ceramics-assiut',
  'cleopatra-ceramics-assiut-branch',
  'ideal-standard-showroom-assiut'
)
AND marketplace_category IS NULL;

UPDATE public.directory_entities
SET marketplace_category = 'الأثاث والفرش وتجهيز الوحدات'
WHERE slug IN (
  'kabbani-furniture-assiut',
  'smart-furniture-assiut'
)
AND marketplace_category IS NULL;

-- New discovery candidates. Public contact and address fields are intentionally
-- left blank; discovery details are stored only in directory_entity_private.
WITH candidates(
  slug,name_ar,entity_type,service_category,marketplace_category,
  source_code,source_title,publisher,source_type,source_url,confidence_level,
  internal_phone,internal_address,notes
) AS (
  VALUES
  ('alromany-ceramics-assiut','مجموعة الروماني للسيراميك والبورسلين','other','building_materials','السيراميك والبورسلين والأدوات الصحية',
   'SP-20261114-ALROMANY','AlRomanyGroup — صفحة الشركة وموقع أسيوط','AlRomanyGroup','LinkedIn — مصدر اكتشاف',
   'https://www.linkedin.com/company/alromanygroup','primary_company',
   NULL,'شارع يسري راغب، أسيوط','تصف صفحة الشركة المجموعة بأنها من أكبر معارض السيراميك والبورسلين في صعيد مصر. يلزم تأكيد عنوان الفرع الحالي ورقم التواصل مباشرة.'),
  ('mecca-ceramics-sanitary-assiut','معرض مكة للسيراميك والأدوات الصحية','other','building_materials','السيراميك والبورسلين والأدوات الصحية',
   'SP-20261114-MECCA-CERAMICS','Makka — صفحة اعثر علينا الرسمية','Ceramica Granito','الموقع الرسمي — مصدر اكتشاف',
   'https://www.ceramicagranito.com/find-us?vendor=25','primary_company',
   '088233011','شارع سعد زغلول، برج الأمة، أسيوط','مدرج في صفحة موزع رسمية باسم Makka. يجب تأكيد استمرار الفرع وبياناته قبل إظهار الملف.'),
  ('al-amer-ceramic-assiut','الأمير للسيراميك — Al Amer Ceramic','other','building_materials','السيراميك والبورسلين والأدوات الصحية',
   'SP-20261114-ALAMER-CERAMIC','Al Amer Ceramic — دليل الأعمال','BizMidEast','دليل أعمال — مصدر اكتشاف',
   'https://www.bizmideast.com/EG/al-amer-ceramic','business_directory',
   NULL,'55HQ+46Q، الحمراء الثانية، أسيوط 2','مدرج كتاجر سيراميك بالجملة. لا يوجد رقم اتصال موثوق في المصدر؛ يلزم تأكيد الهوية والهاتف.'),
  ('mazloum-ceramics-assiut','معرض مظلوم للسيراميك — أسيوط','other','building_materials','السيراميك والبورسلين والأدوات الصحية',
   'SP-20261114-MAZLOUM-CERAMIC','معرض مظلوم للسيراميك — دليل الأعمال','BizMidEast','دليل أعمال — مصدر اكتشاف',
   'https://www.bizmideast.com/EG/مظلوم-فرع-اسيوط','business_directory',
   NULL,'5693+Q3C، مركز أسيوط','بيانات الدليل قديمة نسبيًا وآخر تحديث معلن 21 أكتوبر 2025؛ يجب التأكد من استمرار النشاط ومكان الفرع قبل النشر.'),
  ('tsa-lighting-assiut','TSA Lighting — أسيوط','other','building_materials','الإضاءة ووحدات الإنارة',
   'SP-20261114-TSA-LIGHTING','TSA Lighting — بيانات النشاط والفرع','Cybo','دليل أعمال — مصدر اكتشاف',
   'https://www.cybo.com/EG-biz/tsa-lighting','business_directory',
   '01096309955','شارع الجمهورية، أسيوط 2','مدرج كمتجر إضاءة منذ 2014 بحسب الدليل؛ يلزم تأكيد رقم الهاتف ونطاق المنتجات مباشرة.'),
  ('chapeau-lighting-assiut','شابو للإضاءة — Chapeau Lighting','other','building_materials','الإضاءة ووحدات الإنارة',
   'SP-20261114-CHAPEAU-LIGHTING','Chapeau Lighting — بيانات الفرع','BizMidEast','دليل أعمال — مصدر اكتشاف',
   'https://www.bizmideast.com/EG/chapeau-lighting-0122-114-0900','business_directory',
   '01221140900','موريس دوس، الحمراء الثانية، أسيوط 2','مدرج كمتجر للإضاءة والديكور؛ يلزم تأكيد بيانات الفرع الحالية.'),
  ('jalal-amer-lighting-assiut','جلال عامر للإضاءة الحديثة — أسيوط','other','building_materials','الإضاءة ووحدات الإنارة',
   'SP-20261114-JALAL-AMER-LIGHTING','جلال عامر للإضاءة الحديثة — خرائط الأعمال','Google Maps','مصدر اكتشاف فقط',
   'https://www.google.com/maps/search/?api=1&query=جلال+عامر+للإضاءة+الحديثة+أسيوط','business_directory',
   '01015151785','شارع 26 يوليو، شارع العتبة الزرقاء، أسيوط','مدرج كمتجر إضاءة؛ يلزم تأكيد العنوان والهاتف قبل النشر.'),
  ('hero-modern-lighting-assiut','هيرو للإضاءة الحديثة — أسيوط','other','building_materials','الإضاءة ووحدات الإنارة',
   'SP-20261114-HERO-LIGHTING','هيرو للإضاءة الحديثة — خرائط الأعمال','Google Maps','مصدر اكتشاف فقط',
   'https://www.google.com/maps/search/?api=1&query=هيرو+للإضاءة+الحديثة+أسيوط','business_directory',
   '01201564666','7 برج الحرية، شارع الجمهورية، حي شرق، أسيوط','مدرج كمتجر إضاءة ومستلزمات كهرباء؛ يلزم تأكيد الفرع وبيانات التواصل.'),
  ('iereny-wood-industries-assiut','إيريني للصناعات الخشبية والأثاث — أسيوط','other','furniture_furnishings','الأثاث والفرش وتجهيز الوحدات',
   'SP-20261114-IERENY-WOOD','Iereny For Wood Industries — بيانات النشاط','Google Maps','مصدر اكتشاف فقط',
   'https://www.google.com/maps/search/?api=1&query=Iereny+For+Wood+Industries+Assiut','business_directory',
   '01003412323','شارع الجمهورية، الحمراء الثانية، أسيوط 2','توجد قوائم محلية أخرى باسم Original Furniture Gamal Soliman قريبة من نطاق العلامة؛ نتعامل معها كملف واحد حتى تؤكد الجهة علاقة الفروع، ولا ننشئ سجلًا ثانيًا.'),
  ('shezell-textiles-assiut','Shezell Textiles — أقمشة وستائر أسيوط','other','furniture_furnishings','الستائر والمفروشات',
   'SP-20261114-SHEZELL-TEXTILES','Shezell Textiles — بيانات الفرع','Google Maps','دليل أعمال — مصدر اكتشاف',
   'https://www.google.com/maps/search/?api=1&query=Shezell+Textiles+Assiut','business_directory',
   '01286457428','بجوار بنك القاهرة، شارع الجمهورية، الحمراء الثانية، أسيوط 2','مصنف كمتجر أقمشة وستائر ومفروشات؛ يلزم تأكيد استمرار الفرع وبيانات التواصل.'),
  ('hesham-antar-curtains-assiut','هشام عنتر للستائر — أسيوط','other','furniture_furnishings','الستائر والمفروشات',
   'SP-20261114-HESHAM-ANTAR-CURTAINS','هشام عنتر للستائر — بيانات النشاط','Google Maps','مصدر اكتشاف فقط',
   'https://www.google.com/maps/search/?api=1&query=هشام+عنتر+للستائر+أسيوط','business_directory',
   '01007205575','شارع القيسارية، بجوار مسجد سيدي جلال، أسيوط','مصنف كمتجر ستائر؛ يلزم تأكيد خدمة التفصيل والتركيب ومواعيد العمل.'),
  ('menatex-curtains-fabrics-assiut','سنتر ميناتكس للأقمشة والمفروشات والستائر','other','furniture_furnishings','الستائر والمفروشات',
   'SP-20261114-MENATEX','سنتر ميناتكس — بيانات النشاط','Google Maps','مصدر اكتشاف فقط',
   'https://www.google.com/maps/search/?api=1&query=سنتر+ميناتكس+أسيوط','business_directory',
   '01061516157','55GJ+R9H، شارع القيسارية الرئيسي، الحمراء الثانية، أسيوط 2','مصنف كمتجر أقمشة؛ يلزم تأكيد توفر الستائر والتفصيل حاليًا.'),
  ('shatta-assiut-curtains-fabrics','شَطّة أسيوط — أقمشة ومفروشات','other','furniture_furnishings','الستائر والمفروشات',
   'SP-20261114-SHATTA-FABRICS','Shatta Assiut — بيانات النشاط','Google Maps','مصدر اكتشاف فقط',
   'https://www.google.com/maps/search/?api=1&query=Shatta+Assiut+Fabrics','business_directory',
   '01061881800','55MR+2RP، الحمراء الأولى، أسيوط 2','مصنف كمتجر أقمشة ومفروشات؛ يلزم التأكد من أنه يقدم الستائر أو تفصيلها قبل النشر.'),
  ('maher-afandy-fabrics-assiut','ماهر أفندي للأقمشة والمفروشات والستائر','other','furniture_furnishings','الستائر والمفروشات',
   'SP-20261114-MAHER-AFANDY','ماهر أفندي — دليل الأنشطة التجارية','Google Maps','مصدر اكتشاف فقط',
   'https://www.google.com/maps/search/?api=1&query=ماهر+أفندي+للأقمشة+أسيوط','business_directory',
   '01100208081','55MP+V9C، شارع الجمهورية، الحمراء الثانية، أسيوط 2','مصنف كتاجر أقمشة بالجملة ويذكر الستائر والمفروشات؛ يلزم تأكيد الخدمة والبيانات.'),
  ('karakeeb-home-decor-assiut','كراكيب — ستائر وديكورات منزلية','other','furniture_furnishings','الستائر والمفروشات',
   'SP-20261114-KARAKEEB','كراكيب — ملف النشاط التجاري','BizMidEast','دليل أعمال — مصدر اكتشاف',
   'https://www.bizmideast.com/EG/كراكيب-karakeeb-0109-577-0575','business_directory',
   '01095770575','شارع محمود رشوان، قرب تقاطع الجلاء وصيدلية الفاروق، أسيوط','يعلن عن ستائر وورق حائط وأرضيات وديكورات؛ يجب التأكد من استمرار النشاط وطبيعة خدمة الستائر.')
),
saved_entities AS (
  INSERT INTO public.directory_entities(
    slug,name_ar,entity_type,service_category,marketplace_category,verification_status,public_visible
  )
  SELECT slug,name_ar,entity_type,service_category,marketplace_category,'needs_review',false
  FROM candidates
  ON CONFLICT (slug) DO UPDATE
    SET marketplace_category = COALESCE(public.directory_entities.marketplace_category, EXCLUDED.marketplace_category)
  RETURNING id,slug
),
resolved_entities AS (
  SELECT e.id,c.*
  FROM candidates c
  JOIN saved_entities e ON e.slug=c.slug
),
saved_sources AS (
  INSERT INTO public.directory_sources(
    source_code,title,publisher,source_type,source_url,confidence_level,is_public,notes
  )
  SELECT source_code,source_title,publisher,source_type,source_url,confidence_level,false,
         'مصدر اكتشاف داخلي فقط؛ لا يثبت الترخيص أو الشراكة أو استمرار النشاط.'
  FROM candidates
  ON CONFLICT (source_code) DO UPDATE
    SET title=EXCLUDED.title,publisher=EXCLUDED.publisher,source_url=EXCLUDED.source_url,
        confidence_level=EXCLUDED.confidence_level,is_public=false
  RETURNING id,source_code
)
INSERT INTO public.directory_entity_sources(entity_id,source_id,claim_key)
SELECT e.id,s.id,'service_provider_discovery'
FROM resolved_entities e
JOIN saved_sources s ON s.source_code=e.source_code
ON CONFLICT (entity_id,source_id,claim_key) DO NOTHING;

WITH candidates(slug,internal_phone,internal_address,confidence_level,notes) AS (
  VALUES
  ('alromany-ceramics-assiut',NULL,'شارع يسري راغب، أسيوط','primary_company','مقر المجموعة في أسيوط بحسب صفحة الشركة؛ العنوان التفصيلي والهاتف يحتاجان تأكيدًا.'),
  ('mecca-ceramics-sanitary-assiut','088233011','شارع سعد زغلول، برج الأمة، أسيوط','primary_company','بيانات موزع منشورة على موقع علامة السيراميك؛ تأكيد استمرار الفرع مطلوب.'),
  ('al-amer-ceramic-assiut',NULL,'55HQ+46Q، الحمراء الثانية، أسيوط 2','business_directory','لا يوجد هاتف موثق في المصدر.'),
  ('mazloum-ceramics-assiut',NULL,'5693+Q3C، مركز أسيوط','business_directory','قائمة الدليل قديمة نسبيًا؛ لا تنشر قبل التأكد من استمرار النشاط.'),
  ('tsa-lighting-assiut','01096309955','شارع الجمهورية، أسيوط 2','business_directory','تأكيد الوكالات التجارية والبيانات مطلوب.'),
  ('chapeau-lighting-assiut','01221140900','موريس دوس، الحمراء الثانية، أسيوط 2','business_directory','تأكيد بيانات الفرع الحالية مطلوب.'),
  ('jalal-amer-lighting-assiut','01015151785','شارع 26 يوليو، العتبة الزرقاء، أسيوط','business_directory','تأكيد الهاتف والعنوان مطلوب.'),
  ('hero-modern-lighting-assiut','01201564666','7 برج الحرية، شارع الجمهورية، حي شرق، أسيوط','business_directory','تأكيد الهاتف والفرع مطلوب.'),
  ('iereny-wood-industries-assiut','01003412323','شارع الجمهورية، الحمراء الثانية، أسيوط 2','business_directory','التحقق من علاقته بقائمة Original Furniture Gamal Soliman ضروري لتجنب تكرار العلامة.'),
  ('shezell-textiles-assiut','01286457428','بجوار بنك القاهرة، شارع الجمهورية، الحمراء الثانية، أسيوط 2','business_directory','تأكيد استمرار الفرع والخدمات مطلوب.'),
  ('hesham-antar-curtains-assiut','01007205575','شارع القيسارية، بجوار مسجد سيدي جلال، أسيوط','business_directory','تأكيد التفصيل والتركيب مطلوب.'),
  ('menatex-curtains-fabrics-assiut','01061516157','55GJ+R9H، شارع القيسارية الرئيسي، أسيوط 2','business_directory','تأكيد توفر خدمة الستائر مطلوب.'),
  ('shatta-assiut-curtains-fabrics','01061881800','55MR+2RP، الحمراء الأولى، أسيوط 2','business_directory','تأكيد توفر الستائر والتفصيل مطلوب.'),
  ('maher-afandy-fabrics-assiut','01100208081','55MP+V9C، شارع الجمهورية، الحمراء الثانية، أسيوط 2','business_directory','تأكيد بيانات التاجر وخدمات الستائر مطلوب.'),
  ('karakeeb-home-decor-assiut','01095770575','شارع محمود رشوان، قرب تقاطع الجلاء، أسيوط','business_directory','تأكيد استمرار النشاط وخدمات الستائر مطلوب.')
)
INSERT INTO public.directory_entity_private(
  entity_id,internal_phone,internal_address,verification_label,confidence_level,notes
)
SELECT e.id,c.internal_phone,c.internal_address,'مرشح بحثي — غير معتمد للنشر',c.confidence_level,c.notes
FROM candidates c
JOIN public.directory_entities e ON e.slug=c.slug
ON CONFLICT (entity_id) DO NOTHING;

COMMIT;
