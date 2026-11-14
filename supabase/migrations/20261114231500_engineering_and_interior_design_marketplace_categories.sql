-- Dedicated engineering-design and interior-design marketplace categories.
-- Adds only hidden, unverified discovery candidates; no public visibility is granted.
-- Intended for the isolated ASYUT AQAR development database first.

BEGIN;

ALTER TABLE public.marketplace_listings
  DROP CONSTRAINT IF EXISTS marketplace_listings_category_check;

ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_category_check
  CHECK (category = ANY (ARRAY[
    'سوق العقارات','التنازلات العقارية','أراضي للبيع','أراضي التنازلات','إيجار يومي ومفروش',
    'الشركات والمكاتب العقارية','مواد البناء والتشطيب','الأثاث والفرش وتجهيز الوحدات',
    'المشروعات والمطورون العقاريون','الصيانة وإدارة العقارات','الاستشارات والخدمات العقارية',
    'مكاتب التصميم الهندسي','مهندسو الديكور والتصميم الداخلي'
  ]::text[]));

ALTER TABLE public.marketplace_categories
  DROP CONSTRAINT IF EXISTS marketplace_categories_display_order_check;

ALTER TABLE public.marketplace_categories
  ADD CONSTRAINT marketplace_categories_display_order_check
  CHECK (display_order BETWEEN 1 AND 13);

INSERT INTO public.marketplace_categories(name, description, display_order, is_active)
VALUES
  ('مكاتب التصميم الهندسي',
   'مكاتب الاستشارات والتصميم المعماري والإنشائي والإشراف الهندسي ودراسات التربة.',
   12, true),
  ('مهندسو الديكور والتصميم الداخلي',
   'مهندسو ومكاتب التصميم الداخلي والديكور وتوزيع المساحات وتصميم 2D و3D.',
   13, true)
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    is_active = true;

-- Candidate list: these are research leads only, never published by this migration.
WITH candidates(
  slug, name_ar, entity_type, service_category,
  source_code, source_title, publisher, source_type, source_url, confidence_level,
  internal_phone, internal_address, notes
) AS (
  VALUES
  ('centre-engineering-designs-assiut','مركز الاستشارات والتصميمات الهندسية','consultant','engineering_design',
   'SP-20261114-CENTRE-ENG','Centre of Engineering Designs and Consultations — LinkedIn','Centre of Engineering Designs and Consultations','LinkedIn — مصدر اكتشاف',
   'https://www.linkedin.com/company/group-of-engineering-designs-and-consultations/','business_directory',
   '01032587032','برج الخلفاء، آخر شارع الخلفاء ناحية التجنيد، أسيوط',
   'المقر والتخصصات موثقان بصفحة LinkedIn؛ يلزم تأكيد استمرار النشاط وبيانات الاتصال مباشرة.'),
  ('engineering-consultants-group-assiut','Engineering Consultants Group (ECG) — مكتب أسيوط','consultant','engineering_design',
   'SP-20261114-ECG-ASSIUT','Engineering Consultants Group — مكتب أسيوط','Google Maps / دليل أعمال','مصدر اكتشاف فقط',
   'https://www.google.com/maps/search/?api=1&query=Engineering+Consultants+Group+Assiut','business_directory',
   '0882290607','منطقة ممتاز، أسيوط 2',
   'مدرج كمكتب استشارات هندسية بأسيوط؛ يلزم تأكيد تبعية الفرع للشركة وبياناته الحالية.'),
  ('sherif-engineering-consultants-assiut','الشريف للاستشارات الهندسية','consultant','engineering_design',
   'SP-20261114-SHERIF-ENG','الشريف للاستشارات الهندسية — موقع الفرع','Google Maps / دليل أعمال','مصدر اكتشاف فقط',
   'https://www.google.com/maps/search/?api=1&query=الشريف+للاستشارات+الهندسية+أسيوط','business_directory',
   '01070110666','أمام بنك فيصل الإسلامي، شارع يسري راغب، الحمرا الثانية، أسيوط',
   'مدرج في دليل الأعمال كمكتب استشارات هندسية؛ يلزم تأكيد رقم الهاتف والخدمات.'),
  ('middle-east-engineering-consultants-assiut','مكتب الشرق الأوسط للاستشارات الهندسية','consultant','engineering_design',
   'SP-20261114-MEAST-ENG','مكتب الشرق الأوسط للاستشارات الهندسية — أسيوط','Google Maps / دليل أعمال','مصدر اكتشاف فقط',
   'https://www.google.com/maps/search/?api=1&query=مكتب+الشرق+الأوسط+للاستشارات+الهندسية+أسيوط','business_directory',
   '0882057773','كورنيش النيل، أمام قناطر أسيوط',
   'توجد اختلافات بين الأدلة في رقم الهاتف والعنوان؛ لا تعتمد بيانات الاتصال قبل التحقق المباشر.'),
  ('bonian-misr-architects-assiut','بنيان مصر للعمارة والتصميم','consultant','engineering_design',
   'SP-20261114-BONIAN','BONIAN misr Architects — LinkedIn','BONIAN misr Architects','LinkedIn — مصدر اكتشاف',
   'https://www.linkedin.com/company/bonian-misr-architects/','primary_company',
   '01001018467','13 شارع صلاح الدين الأيوبي، شارع النميس، حي شرق، أسيوط',
   'صفحة الشركة تشير إلى مقر أسيوط وخدمات العمارة والتصميم؛ يلزم تأكيد الهاتف وعنوان المكتب الحالي.'),
  ('dar-altasmeemat-engineering-assiut','دار التصميمات والاستشارات الهندسية','consultant','engineering_design',
   'SP-20261114-DAR-TASMEEM','دار التصميمات والاستشارات الهندسية — أسيوط','Google Maps / دليل أعمال','مصدر اكتشاف فقط',
   'https://www.google.com/maps/search/?api=1&query=دار+التصميمات+والاستشارات+الهندسية+أسيوط','business_directory',
   '01061997717','شارع الجمهورية، الحمرا الثانية، أسيوط 2',
   'مدرج كمكتب استشارات هندسية؛ يلزم تأكيد النشاط ورقم التواصل قبل العرض.'),
  ('topmountain-design-assiut','TOP MOUNTAIN — تصميم واستشارات هندسية','consultant','engineering_design',
   'SP-20261114-TOPMOUNTAIN','TOP MOUNTAIN — الموقع الرسمي','TOP MOUNTAIN','الموقع الرسمي — مصدر اكتشاف',
   'https://www.topmountain.org/','primary_company',
   '0882135106 / 01094243135','شارع النميس، أسيوط 2',
   'الموقع الرسمي يعرض خدمات Architecture وInterior Design وHome Lighting؛ يلزم التحقق من البيانات قبل النشر.'),
  ('byoot-designs-assiut','بيوت للتصميم الداخلي والتشطيبات — Byoot Designs','other','finishing_decoration',
   'SP-20261114-BYOOT','Byoot Designs — أسيوط','Google Maps / دليل أعمال','مصدر اكتشاف فقط',
   'https://www.google.com/maps/search/?api=1&query=Byoot+Designs+Assiut','business_directory',
   '0882343036','الطريق الدائري، منطقة الحمرا الأولى، أسيوط 1',
   'مصدر الأعمال يصنفه كمصمم داخلي وتشطيبات؛ يلزم تأكيد الخدمات والهاتف.'),
  ('elkashef-design-group-assiut','Elkashef Design Group — الكاشف للتصميم والديكور','other','finishing_decoration',
   'SP-20261114-ELKASHEF','Elkashef Design Group — أسيوط','Google Maps / دليل أعمال','مصدر اكتشاف فقط',
   'https://www.google.com/maps/search/?api=1&query=Elkashef+Design+Group+Assiut','business_directory',
   '01111812817','امتداد يسري راغب، برج معونة الشتا، أسيوط',
   'مدرج كجهة تصميم وديكور داخلي؛ يلزم التحقق من الأعمال والبيانات.'),
  ('mh-designs-assiut','MH Designs — تصميم داخلي وديكور','other','finishing_decoration',
   'SP-20261114-MH-DESIGNS','MH Designs — أسيوط','Google Maps / دليل أعمال','مصدر اكتشاف فقط',
   'https://www.google.com/maps/search/?api=1&query=MH+Designs+Asyut','business_directory',
   '01120777444','منطقة سلامة حجازي، أسيوط 2',
   'مصدر الأعمال يصنفه كجهة ديكور داخلي؛ يلزم تأكيد النشاط الحالي.'),
  ('noha-elsharkawy-designs-assiut','مكتب نهى الشرقاوي للتصميمات','other','finishing_decoration',
   'SP-20261114-NOHA-DESIGN','Noha ElSharkawy Designs — أسيوط','Google Maps / دليل أعمال','مصدر اكتشاف فقط',
   'https://www.google.com/maps/search/?api=1&query=Noha+ElSharkawy+Designs+Assiut','business_directory',
   '01020400333','شارع جمال ثابت، متفرع من شارع الجلاء، الوليدية القبلية، أسيوط 2',
   'مدرج كمكتب تصميم داخلي؛ يلزم التأكد من هوية المكتب وملف الأعمال قبل النشر.'),
  ('dizn-studio-assiut','DIZN STUDIO — تصميم معماري وداخلي','consultant','engineering_design',
   'SP-20261114-DIZN','DIZN STUDIO — LinkedIn','DIZN STUDIO','LinkedIn — مصدر اكتشاف',
   'https://www.linkedin.com/company/dizn-studio/','business_directory',
   NULL,'أسيوط — لم يتحدد عنوان فرع عام موثق',
   'صفحة LinkedIn تذكر المقر في أسيوط وخدمات التصميم المعماري والداخلي؛ لا تنشر بيانات اتصال قبل التأكيد.')
),
saved_entities AS (
  INSERT INTO public.directory_entities(slug,name_ar,entity_type,service_category,verification_status,public_visible)
  SELECT slug,name_ar,entity_type,service_category,'needs_review',false
  FROM candidates
  ON CONFLICT (slug) DO UPDATE
    SET service_category = COALESCE(public.directory_entities.service_category, EXCLUDED.service_category)
  RETURNING id,slug
),
resolved_entities AS (
  SELECT e.id,c.*
  FROM candidates c
  JOIN public.directory_entities e ON e.slug=c.slug
),
saved_sources AS (
  INSERT INTO public.directory_sources(
    source_code,title,publisher,source_type,source_url,confidence_level,is_public,notes
  )
  SELECT source_code,source_title,publisher,source_type,source_url,confidence_level,false,
         'مصدر اكتشاف داخلي فقط؛ لا يثبت الترخيص أو الشراكة أو استمرار النشاط.'
  FROM candidates
  ON CONFLICT (source_code) DO UPDATE
    SET notes=EXCLUDED.notes
  RETURNING id,source_code
)
INSERT INTO public.directory_entity_sources(entity_id,source_id,claim_key)
SELECT e.id,s.id,'service_provider_discovery'
FROM resolved_entities e
JOIN saved_sources s ON s.source_code=e.source_code
ON CONFLICT (entity_id,source_id,claim_key) DO NOTHING;

WITH private_candidates(slug,internal_phone,internal_address,confidence_level,notes) AS (
  VALUES
  ('centre-engineering-designs-assiut','01032587032','برج الخلفاء، آخر شارع الخلفاء ناحية التجنيد، أسيوط','business_directory','مرشح داخلي؛ تأكيد التواصل المباشر مطلوب.'),
  ('engineering-consultants-group-assiut','0882290607','منطقة ممتاز، أسيوط 2','business_directory','تأكيد تبعية الفرع للشركة مطلوب.'),
  ('sherif-engineering-consultants-assiut','01070110666','أمام بنك فيصل الإسلامي، شارع يسري راغب، الحمرا الثانية، أسيوط','business_directory','تأكيد البيانات والخدمات مطلوب.'),
  ('middle-east-engineering-consultants-assiut','0882057773','كورنيش النيل، أمام قناطر أسيوط','business_directory','مصادر أخرى تعرض رقمًا وعنوانًا مختلفين؛ يلزم التحقق.'),
  ('bonian-misr-architects-assiut','01001018467','13 شارع صلاح الدين الأيوبي، شارع النميس، حي شرق، أسيوط','primary_company','تأكيد بيانات الاتصال والمقر الحالي مطلوب.'),
  ('dar-altasmeemat-engineering-assiut','01061997717','شارع الجمهورية، الحمرا الثانية، أسيوط 2','business_directory','تأكيد استمرار النشاط مطلوب.'),
  ('topmountain-design-assiut','0882135106 / 01094243135','شارع النميس، أسيوط 2','primary_company','مصدر رسمي؛ لا يزال التحقق المباشر مطلوبًا.'),
  ('byoot-designs-assiut','0882343036','الطريق الدائري، الحمرا الأولى، أسيوط 1','business_directory','تأكيد الخدمات والهاتف مطلوب.'),
  ('elkashef-design-group-assiut','01111812817','امتداد يسري راغب، برج معونة الشتا، أسيوط','business_directory','تأكيد الأعمال والبيانات مطلوب.'),
  ('mh-designs-assiut','01120777444','منطقة سلامة حجازي، أسيوط 2','business_directory','تأكيد النشاط الحالي مطلوب.'),
  ('noha-elsharkawy-designs-assiut','01020400333','شارع جمال ثابت، متفرع من شارع الجلاء، الوليدية القبلية، أسيوط 2','business_directory','تأكيد الهوية والخدمات مطلوب.'),
  ('dizn-studio-assiut',NULL,'أسيوط — لم يتحدد عنوان فرع عام موثق','business_directory','لا تنشر بيانات الاتصال قبل التأكيد المباشر.')
)
INSERT INTO public.directory_entity_private(entity_id,internal_phone,internal_address,verification_label,confidence_level,notes)
SELECT e.id,c.internal_phone,c.internal_address,'مرشح بحثي — غير معتمد للنشر',c.confidence_level,c.notes
FROM private_candidates c
JOIN public.directory_entities e ON e.slug=c.slug
ON CONFLICT (entity_id) DO NOTHING;

COMMIT;
