-- ASYUT AQAR: review and enrich Assiut lighting-service candidates.
-- Discovery-only records: all new profiles remain hidden and require direct owner verification.

BEGIN;

-- Existing lighting candidates: update internal discovery information only.
UPDATE public.directory_entity_private p
SET internal_phone = '01096309955',
    internal_address = 'شارع الجمهورية، مدينة أسيوط.',
    confidence_level = 'business_directory',
    notes = 'تطابق الاسم والعنوان والهاتف في أكثر من دليل أعمال؛ مصدر يذكر نشاط الشركة منذ 2014 وموقعها tsalight-eg.com وبريد tsalighting@hotmail.com. يصفها الدليل بأنها تعمل في حلول الإضاءة والكهرباء، لكن صفة الوكيل الرسمي للعلامات التجارية تحتاج تأكيدًا من الشركة أو من العلامات نفسها. لا ننشر قبل التأكيد المباشر.'
FROM public.directory_entities e
WHERE p.entity_id=e.id AND e.slug='tsa-lighting-assiut';

UPDATE public.directory_entity_private p
SET internal_phone = '01221140900',
    internal_address = 'موريس دوس، الحمراء الثانية، أسيوط 2.',
    confidence_level = 'business_directory',
    notes = 'رقم 01221140900 والعنوان في موريس دوس/الحمراء الثانية متوافقان بين دليل أعمال ونتيجة خرائط. دليل آخر يصف المحل بأنه في شارع الجمهورية خلف بنك القاهرة؛ نحتاج حسم العنوان الدقيق عند التواصل. النشاط يشمل الإضاءة والديكور والنجف والتصنيع حسب وصف الدليل، ولا نعتمد هذه الخدمات كحقائق منشورة دون تأكيد.'
FROM public.directory_entities e
WHERE p.entity_id=e.id AND e.slug='chapeau-lighting-assiut';

UPDATE public.directory_entity_private p
SET internal_phone = '01015151785',
    internal_address = 'شارع 26 يوليو، شارع العتبة الزرقاء، أسيوط.',
    confidence_level = 'business_directory',
    notes = 'رقم الهاتف والعنوان مدعومان بصفحة دليل أعمال مخصصة، وصفحة النشاط تذكر galalamer.business.site كرابط للمتجر. رابط الموقع القديم لم يُفتح أثناء المراجعة، لذا لا نعتبره مصدرًا مباشرًا لإثبات استمرار النشاط. يلزم اتصال مباشر قبل الاعتماد.'
FROM public.directory_entities e
WHERE p.entity_id=e.id AND e.slug='jalal-amer-lighting-assiut';

UPDATE public.directory_entity_private p
SET internal_phone = '01201564666',
    internal_address = '7 برج الحرية، شارع الجمهورية، حي شرق، أسيوط.',
    confidence_level = 'business_directory',
    notes = 'بيانات العنوان والهاتف ظهرت في نتيجة نشاط محلية ونتيجة خرائط أعمال؛ دليل BizMidEast يذكر هيرو ضمن متاجر الإضاءة القريبة من شابو. ما زال يلزم تأكيد استمرار الفرع وملكيته للرقم قبل النشر.'
FROM public.directory_entities e
WHERE p.entity_id=e.id AND e.slug='hero-modern-lighting-assiut';

-- The existing AlRomany ceramics profile also appears as an ECOLiTE distributor.
-- Do not duplicate or reassign its single marketplace category until the business confirms
-- whether it is the same legal/commercial entity and whether it serves lighting customers.
UPDATE public.directory_entity_private p
SET notes = concat_ws(' ',p.notes,
  'ملاحظة مراجعة الإضاءة 15 نوفمبر 2026: صفحة موزعي ECOLiTE تدرج موزعًا باسم الروماني في أسيوط بجوار عمارة سويرس ورقم 01225551315. قد يكون نفس مجموعة الروماني المسجلة بالفعل في السيراميك؛ لا ننشئ ملف إضاءة منفصلًا ولا نغيّر تصنيفه حتى تأكيد العلاقة ونطاق النشاط.')
FROM public.directory_entities e
WHERE p.entity_id=e.id AND e.slug='alromany-ceramics-assiut';

-- Add new candidate profiles, leaving all public contact fields empty.
WITH candidates(slug,name_ar,name_en,source_code,source_title,publisher,source_type,source_url,confidence_level,internal_phone,internal_address,notes) AS (
  VALUES
  ('asfour-crystal-assiut','كريستال عصفور — فرع أسيوط','Asfour Crystal Assiut','SP-20261115-ASFOUR-BRANCH','كريستال عصفور — فرع أسيوط','دليل 140 / Hotlines / Yellow Pages','دليل فروع وعلامات تجارية','https://dalil140.com/branches/ar/252515-asfour-crystal','business_directory',
   '16218 / 0882286606 / 01095343216','تقسيم البترول، برج كريستال، أسيوط.',
   'تطابق عنوان الفرع وأرقام 0882286606 و01095343216 والخط الساخن 16218 في أكثر من دليل مستقل، مع إدراج الموقع asfourcrystal.com. يلزم اتصال بالشركة لتأكيد استمرار الفرع وملكية بيانات التواصل.'),
  ('queen-home-assiut','كوين هوم — Queen Home','Queen Home','SP-20261115-QUEEN-HOME','كوين هوم — فرع أسيوط','دليل 140 / EgyFinder / 140Online','أدلة أنشطة محلية متطابقة','https://dalil140.com/company/ar/256030-queen-home','business_directory',
   '0882331841 / 01006107996','شارع يسري راغب، حي غرب، أمام بنك فيصل الإسلامي، أسيوط.',
   'الاسم والعنوان والهاتف والتصنيف (لمبات ونجف وأنظمة إضاءة) متوافقة في ثلاثة أدلة محلية. لا يوجد مصدر رسمي مباشر؛ يلزم اتصال للتأكد من أن النشاط ما زال قائمًا ونطاق منتجات الإضاءة الحالي.'),
  ('gila-electrical-assiut','جيلا — شركة التوكل الكهربائية، فرع أسيوط','Gila - Al Tawakol Electrical Co.','SP-20261115-GILA-ASSIUT','Gila Electric — فرع أسيوط، الموقع الرسمي','Gila Electric','الموقع الرسمي للشركة','https://gilaelectric.com/contact-us/','primary_company',
   '19796 / 0882146635 / 01001750164 / 01002189638','1 شارع أحمد حسن الباقوري، برج الإبراهيمية، أسيوط.',
   'الموقع الرسمي يدرج فرع أسيوط بهذا العنوان ورقم 0882146635 والمحمول 01001750164؛ أدلة فروع أخرى تضيف 01002189638. Yellow Pages يصنف الفرع ضمن لمبات ونجف وأنظمة إضاءة إلى جانب الأنشطة الكهربائية. يلزم تأكيد الخدمات التي يقدمها الفرع للأفراد قبل نشره تحت فئة الإضاءة.'),
  ('electro-center-lighting-assiut','إلكترو سنتر — موزع إضاءة، أسيوط','Electro Center','SP-20261115-ECOLITE-ASSIUT','قائمة موزعي ECOLiTE — الصعيد','ECOLiTE','قائمة موزعين على موقع الشركة المصنعة','https://ecolite-eg.com/الموزعين/','business_directory',
   '01271096099','شارع يسري راغب، أسيوط.',
   'مدرج في صفحة موزعي ECOLiTE تحت أسيوط مع هاتف 01271096099. الصفحة لا تعرض تاريخ تحديث واضح؛ يجب تأكيد استمرار التوزيع والفرع قبل اعتماد الملف.'),
  ('ker-mena-lighting-assiut','كير مينا — نشاط إضاءة، أسيوط','Ker Mena','SP-20261115-KERMENA-ECOLITE','قائمة موزعي ECOLiTE — الصعيد','ECOLiTE','قائمة موزعين على موقع الشركة المصنعة','https://ecolite-eg.com/الموزعين/','business_directory',
   '01229294091','قائمة ECOLiTE تذكر شارع المنفذ، أسيوط؛ ونتيجة نشاط أخرى تذكر 17 شارع عدلي يكن، حي غرب.',
   'اسم كير مينا ورقم 01229294091 ظاهران في قائمة موزعي ECOLiTE ونتيجة نشاط محلية، لكن العنوان مختلف بين المصدرين. لا يُعتمد عنوان ولا يُنشر رقم قبل التأكد من صاحب النشاط والفرع الحالي.'),
  ('white-light-modern-lighting-assiut','وايت لايت للإضاءة الحديثة — أسيوط','White Light Modern Lighting','SP-20261115-WHITELIGHT','White Light للاضاءة الحديثة — قائمة متاجر أسيوط','MegaBizDir','دليل محلات محلي','https://www.megabizdir.com/EG/Asyut/67430-42/genre/196820813663200/Lighting%2Bfixtures','business_directory',
   NULL,'القيسارية، بجوار مسجد سيدي جلال الدين الأسيوطي، أسيوط.',
   'مدرج في دليل محلات محلية مع وصف لمنتجات النجف الليد والكريستال والأباليك والدلايات والأباجورات. لم يظهر رقم هاتف موثوق في المصدر؛ يجب تحديد الاسم التجاري الدقيق ورقم التواصل قبل النشر.'),
  ('el-galaa-lighting-assiut','الجلاء للنجف وأنظمة الإضاءة — أسيوط','El Galaa Lighting','SP-20261115-ELGALAA','الجلاء — دليل لمبات ونجف وأنظمة إضاءة بأسيوط','دليل 140 / دليل المدينة','أدلة أنشطة محلية','https://dalil140.com/category/ar/lighting-systems-lamps-chandeliers-bulbs/assyout/gharb-district','business_directory',
   '0882333153 / 01003412314','امتداد شارع يسري راغب، حي غرب، أسيوط، بجوار كنز للملابس.',
   'مدرج باسم الجلاء ضمن فئة لمبات ونجف وأنظمة إضاءة، وتطابقت بيانات العنوان والهاتف مع دليل مدينة محلي. نحتاج تأكيد الاسم التجاري الكامل واستمرار النشاط والخدمات قبل الاعتماد.')
),
saved_entities AS (
  INSERT INTO public.directory_entities(
    slug,name_ar,name_en,entity_type,service_category,marketplace_category,verification_status,public_visible
  )
  SELECT slug,name_ar,name_en,'other','building_materials','الإضاءة ووحدات الإنارة','needs_review',false
  FROM candidates
  ON CONFLICT (slug) DO UPDATE
    SET marketplace_category = COALESCE(public.directory_entities.marketplace_category,EXCLUDED.marketplace_category),
        public_visible = false,
        verification_status = CASE
          WHEN public.directory_entities.verification_status='published'
          THEN public.directory_entities.verification_status
          ELSE 'needs_review'
        END
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
         'مصدر اكتشاف داخلي؛ لا يثبت الشراكة أو الترخيص أو استمرار النشاط. يلزم تحقق مباشر قبل النشر.'
  FROM candidates
  ON CONFLICT (source_code) DO UPDATE
    SET title=EXCLUDED.title,publisher=EXCLUDED.publisher,source_type=EXCLUDED.source_type,
        source_url=EXCLUDED.source_url,confidence_level=EXCLUDED.confidence_level,
        is_public=false,notes=EXCLUDED.notes
  RETURNING id,source_code
),
linked_sources AS (
  INSERT INTO public.directory_entity_sources(entity_id,source_id,claim_key)
  SELECT e.id,s.id,'lighting_candidate_review_20261115'
  FROM resolved_entities e
  JOIN saved_sources s ON s.source_code=e.source_code
  ON CONFLICT (entity_id,source_id,claim_key) DO NOTHING
  RETURNING entity_id
)
INSERT INTO public.directory_entity_private(
  entity_id,internal_phone,internal_address,verification_label,confidence_level,notes
)
SELECT e.id,c.internal_phone,c.internal_address,'مرشح بحثي — غير معتمد للنشر',c.confidence_level,c.notes
FROM candidates c
JOIN public.directory_entities e ON e.slug=c.slug
ON CONFLICT (entity_id) DO UPDATE
SET internal_phone=EXCLUDED.internal_phone,
    internal_address=EXCLUDED.internal_address,
    verification_label='مرشح بحثي — غير معتمد للنشر',
    confidence_level=EXCLUDED.confidence_level,
    notes=EXCLUDED.notes,
    updated_at=now();

-- Save corroborating sources for the existing candidates and the AlRomany overlap.
WITH source_rows(source_code,title,publisher,source_type,source_url,confidence_level,notes) AS (
  VALUES
  ('SP-20261115-TSA-BIZMIDEAST','TSA Lighting — بيانات الاتصال والنشاط','BizMidEast','دليل أعمال','https://www.bizmideast.com/EG/tsa-lighting-0109-630-9955','business_directory','يؤكد هاتف 01096309955 والعنوان ووجود موقع tsalight-eg.com وبريد التواصل.'),
  ('SP-20261115-CHAPEAU-MEGABIZ','Chapeau Lighting Store — قائمة متاجر الإضاءة بأسيوط','MegaBizDir','دليل محلات محلي','https://www.megabizdir.com/EG/Asyut/67430-42/genre/196820813663200/Lighting%2Bfixtures','business_directory','يذكر Chapeau Lighting Store في شارع الجمهورية خلف بنك القاهرة، وهو وصف عنوان يختلف عن موريس دوس في أدلة أخرى؛ يلزم الحسم.'),
  ('SP-20261115-JALAL-BIZMIDEAST','جلال عامر للإضاءة الحديثة — الهاتف والعنوان','BizMidEast','دليل أعمال','https://www.bizmideast.com/EG/جلال-عامر-للإضاءة-الحديثه-أسيوط-0101-515-1785','business_directory','يدعم رقم 01015151785 والعنوان في شارع 26 يوليو والعتبة الزرقاء.'),
  ('SP-20261115-HERO-MAPS','هيرو للإضاءة الحديثة — سجل نشاط محلي','خرائط الأعمال','نتيجة نشاط محلية','https://www.google.com/maps/search/?api=1&query=هيرو+للإضاءة+الحديثة+أسيوط','business_directory','نتيجة نشاط محلية تذكر 7 برج الحرية، شارع الجمهورية، وهاتف 01201564666.'),
  ('SP-20261115-ECOLITE-DISTRIBUTORS','قائمة موزعي ECOLiTE — منطقة الصعيد','ECOLiTE','الموقع الرسمي للشركة المصنعة','https://ecolite-eg.com/الموزعين/','primary_company','القائمة تذكر موزعين في أسيوط: الروماني، إلكترو سنتر، كير مينا مع العناوين والأرقام. تاريخ تحديث القائمة غير ظاهر؛ لا تعتبر اعتمادًا حديثًا أو شراكة مع أسيوط عقار.'),
  ('SP-20261115-QUEEN-EGYFINDER','Queen Home — بيانات الفرع والتخصص','EgyFinder','دليل أنشطة محلي','https://egyfinder.net/company/en/queen-home-iiq','business_directory','يدعم العنوان ورقمي الهاتف وتصنيف الإضاءة في دليل محلي.'),
  ('SP-20261115-GILA-YELLOWPAGES','Gila Electric — تصنيف فرع أسيوط','Yellow Pages Egypt','دليل فروع أعمال','https://yellowpages.com.eg/en/profile/gila-_-al-tawakol-electrical-co./584629','business_directory','يؤكد عنوان برج سرايا الحمد وتصنيف لمبات ونجف وأنظمة الإضاءة والمنتجات/العلامات.'),
  ('SP-20261115-ASFOUR-HOTLINES','كريستال عصفور — بيانات فرع أسيوط','Hotlines','دليل فروع','https://hotlines.tel/en/branch/8833','business_directory','مصدر إضافي يطابق تقسيم البترول وبرج كريستال والخط الساخن 16218.')
),
saved_sources AS (
  INSERT INTO public.directory_sources(source_code,title,publisher,source_type,source_url,confidence_level,is_public,notes)
  SELECT source_code,title,publisher,source_type,source_url,confidence_level,false,notes
  FROM source_rows
  ON CONFLICT (source_code) DO UPDATE
    SET title=EXCLUDED.title,publisher=EXCLUDED.publisher,source_type=EXCLUDED.source_type,
        source_url=EXCLUDED.source_url,confidence_level=EXCLUDED.confidence_level,
        is_public=false,notes=EXCLUDED.notes
  RETURNING id,source_code
),
source_owners(source_code,slug) AS (
  VALUES
  ('SP-20261115-TSA-BIZMIDEAST','tsa-lighting-assiut'),
  ('SP-20261115-CHAPEAU-MEGABIZ','chapeau-lighting-assiut'),
  ('SP-20261115-JALAL-BIZMIDEAST','jalal-amer-lighting-assiut'),
  ('SP-20261115-HERO-MAPS','hero-modern-lighting-assiut'),
  ('SP-20261115-ECOLITE-DISTRIBUTORS','alromany-ceramics-assiut'),
  ('SP-20261115-QUEEN-EGYFINDER','queen-home-assiut'),
  ('SP-20261115-GILA-YELLOWPAGES','gila-electrical-assiut'),
  ('SP-20261115-ASFOUR-HOTLINES','asfour-crystal-assiut')
)
INSERT INTO public.directory_entity_sources(entity_id,source_id,claim_key)
SELECT e.id,s.id,'lighting_corroboration_20261115'
FROM source_owners o
JOIN public.directory_entities e ON e.slug=o.slug
JOIN saved_sources s ON s.source_code=o.source_code
ON CONFLICT (entity_id,source_id,claim_key) DO NOTHING;

COMMIT;
