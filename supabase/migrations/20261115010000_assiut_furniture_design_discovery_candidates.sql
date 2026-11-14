-- ASYUT AQAR: additional Assiut furniture, kitchen, engineering and interior-design discovery candidates.
-- All contact/address details remain in the private table. No candidate is published by this migration.
-- Idempotent: safe to re-run without duplicating entities, sources or links.

BEGIN;

WITH candidates(
  slug,name_ar,name_en,service_category,marketplace_category,
  internal_address,internal_phone,private_notes,
  source_code,source_title,publisher,source_type,source_url,publication_date,source_notes
) AS (
  VALUES
  (
    'landbond-furniture-assiut','لاند بوند للأثاث — أسيوط','Land Bond Furniture',
    'furniture_furnishings','الأثاث والفرش وتجهيز الوحدات',
    'أبراج النصر، أمام مستشفى الصدر، أسيوط',NULL,
    'ملف مرشح مخفي. منشورات مؤرخة 15 سبتمبر و20 أغسطس و4 يونيو 2026 تذكر فرع أسيوط في أبراج النصر أمام مستشفى الصدر. يوجد تعارض في رقم الهاتف بين نص المنشورات 01008741923 وبيانات الترويسة +201008741932؛ لذلك تُرك الهاتف فارغًا ولا يعتمد أي رقم قبل التأكيد المباشر.',
    'SP-20261115-LANDBOND','Land Bond — منشورات فرع أسيوط 2026','Furniture1000','دليل أعمال — مصدر اكتشاف',
    'https://www.furniture1000.com/EG/Asyut/832554726867102/Land-bond---%D9%84%D8%A7%D9%86%D8%AF-%D8%A8%D9%88%D9%86%D8%AF',
    '2026-09-15'::date,
    'المصدر يعرض منشورات حديثة عن الفرع والعنوان. يوجد اختلاف في رقم الهاتف داخل الصفحة؛ لا يستخدم رقم قبل تأكيد مباشر.'
  ),
  (
    'lacasa-furniture-assiut','لاكازا للأثاث والتصميم — أسيوط','LaCasa Furniture',
    'furniture_furnishings','الأثاث والفرش وتجهيز الوحدات',
    'فرع أسيوط: أمام حديقة الفردوس بعد معرض سمارت فرنيتشر؛ فرع أسيوط الجديدة: حي الزهور',
    '01008700152 / 01003700156',
    'ملف مرشح مخفي. منشورات سبتمبر 2026 تعرض فرعين في أسيوط وخدمات تصميم وتنفيذ المطابخ المودرن والدريسينج روم وغرف النوم ومكتبات الشاشة ووحدات الحمام وديكورات بديل الرخام والخشب والشيبورد. يجب تأكيد عمل الفرعين والأرقام قبل الاعتماد.',
    'SP-20261115-LACASA','LaCasa Furniture — منشورات الفروع والخدمات في سبتمبر 2026','FindGlocal','دليل أعمال — مصدر اكتشاف',
    'https://www.findglocal.com/EG/Asyut/102398601544547/LaCasa-Furniture',
    '2026-09-16'::date,
    'الدليل يعرض منشورات مؤرخة 16 و12 و10 و8 سبتمبر 2026 ويذكر فرعين في أسيوط وأرقام تواصل. صفحة النشاط المشار إليها: https://facebook.com/LaCasa.Asyut/. يلزم تأكيد مباشر.'
  ),
  (
    'elgarhy-furniture-assiut','الجارحي للأثاث الراقي — أسيوط','El Garhy Furniture Assiut',
    'furniture_furnishings','الأثاث والفرش وتجهيز الوحدات',
    '2 شارع العادلي، شركة فريال، أسيوط',
    '01002054772 / 01016006093',
    'ملف مرشح مخفي. ظهر العنوان ورقما الاتصال في أكثر من دليل، مع منشورات خلال سبتمبر 2026. لا يعد ذلك إثبات موافقة على الظهور بمنصة أسيوط عقار؛ يلزم الاتصال المباشر قبل الاعتماد.',
    'SP-20261115-ELGARHY','الجارحي للأثاث الراقي — بيانات الفرع ومنشورات 2026','Furniture1000','دليل أعمال — مصدر اكتشاف',
    'https://www.furniture1000.com/EG/Asyut/233802289972180/%D8%A7%D9%84%D8%AC%D8%A7%D8%B1%D8%AD%D9%8A-%D9%84%D9%84%D8%A7%D8%AB%D8%A7%D8%AB-%D8%A7%D9%84%D8%B1%D8%A7%D9%82%D9%8A-%D8%A8%D8%A3%D8%B3%D9%8A%D9%88%D8%B7-Elgarhy-furniture-Assiut',
    '2026-09-11'::date,
    'المنشورات تذكر عنوان 2 شارع العادلي شركة فريال ورقمي 01002054772 و01016006093. يلزم اتصال مباشر.'
  ),
  (
    'taki-vita-assiut','تاكي فيتا وستايل — أسيوط','TAKI VITA & Style Assiut',
    'furniture_furnishings','الأثاث والفرش وتجهيز الوحدات',
    'فرع الجمهورية: برج الياسمين، الدور الثاني؛ فرع الهلالي: ميدان الحمامة؛ فرع تقسيم البترول: بجوار أرامكس',
    '01093318832 / 01061684422 / 01050599303',
    'ملف مرشح مخفي. منشورات حتى 21 أكتوبر 2026 تذكر فروع الجمهورية والهلالي وتقسيم البترول، وتعرض مراتب وأثاثًا منزليًا ومكتبيًا وديكورات. صفة الوكيل الحصري تحتاج تأكيدًا من العلامة نفسها، ويجب ربط كل رقم بالفرع الصحيح قبل النشر.',
    'SP-20261115-TAKI-VITA','TAKI VITA — منشورات فروع أسيوط 2026','Furniture1000','دليل أعمال — مصدر اكتشاف',
    'https://www.furniture1000.com/EG/Asyut/345914849180662/TAKI-VITA---Assiut-%D9%80-%D8%AA%D8%A7%D9%83%D9%8A-%D8%A7%D8%B3%D9%8A%D9%88%D8%B7',
    '2026-10-21'::date,
    'منشورات أكتوبر 2026 تذكر أكثر من فرع وتخصصات المراتب والأثاث المنزلي والمكتبي. نحتاج تأكيد الصفة التجارية والأرقام حسب كل فرع.'
  ),
  (
    'gn-kitchens-assiut','GN Kitchens — مطابخ ودريسينج أسيوط','GN Kitchens',
    'furniture_furnishings','الأثاث والفرش وتجهيز الوحدات',
    'شارع أحمد علي العُبا، أسيوط','01271766654',
    'ملف مرشح مخفي. النشاط المعلن متخصص في تصميم وتنفيذ المطابخ والدريسينج. عنوان النشاط ظهر في دليل متخصص، ورقم الاتصال والعنوان في بيانات نشاط محلية. يلزم اتصال مباشر للتحقق من استمرار النشاط ونطاق الخدمة.',
    'SP-20261115-GN-KITCHENS','GN Kitchens — بيانات المطبخ والدريسينج','Alidebo / دليل نشاط محلي','دليل أعمال — مصدر اكتشاف',
    'https://alidebo.com/en/directory/mtabkh-o-drysyng-mgorg-nbyl-gn-kitchens-nqvkv',
    NULL::date,
    'الدليل يذكر الاسم والتخصص والعنوان، وبيانات نشاط محلية تعرض الهاتف والعنوان. مصدر اكتشاف فقط.'
  ),
  (
    'egyptian-modern-furniture-assiut','المصرية للأثاث والتجهيزات التجارية — أسيوط','Egyptian Modern Furniture & Commercial Equipment',
    'furniture_furnishings','الأثاث والفرش وتجهيز الوحدات',
    'المحطة، شارع الألفي، خلف مستشفى فاروق مراد، أسيوط',
    '01090505685 / 0882367250',
    'ملف مرشح مخفي. ظهر النشاط باسم المصرية للأثاث الراقي أو المودرن والتجهيزات التجارية؛ يوجد اختلاف في صياغة الاسم بين المصادر. يلزم تأكيد الاسم التجاري الحالي وطبيعة النشاط والعنوان والهاتف قبل الاعتماد.',
    'SP-20261115-EGYPTIAN-FURNITURE','المصرية للأثاث والتجهيزات التجارية — بيانات النشاط','Furniture1000','دليل أعمال — مصدر اكتشاف',
    'https://www.furniture1000.com/EG/Asyut/423579637834348/',
    NULL::date,
    'مصدر اكتشاف يعرض العنوان ورقمي اتصال ووصف النشاط. اختلاف الاسم بين قوائم البحث يستلزم تأكيدًا مباشرًا.'
  ),
  (
    'design-group-engineering-assiut','ديزاين جروب للخدمات الهندسية والديكور — أسيوط','Design Group Engineering Assiut',
    'engineering_design',NULL,
    '16 شارع الشهيد يسري راغب، حي غرب، أسيوط',
    '0882372155 / 01114943084',
    'ملف مرشح مخفي. دليلان محليان يعرضان الاسم والعنوان نفسه والرقم الأرضي 0882372155، ويعرض أحدهما رقمًا محمولًا إضافيًا. التصنيف المنشور يشمل مهندسين ومصممي ديكور ومكاتب التصميم الداخلي. يلزم الاتصال لتأكيد استمرار المكتب ونطاق الخدمات.',
    'SP-20261115-DESIGN-GROUP','Design Group Engineering — دليل 140online','140online','دليل أعمال — مصدر اكتشاف',
    'https://140online.com/company.aspx?CompanyId=C129969&Lang=En&Name=Design+Group+Engineering',
    NULL::date,
    'قائمة دليل أعمال تعرض 16 شارع الشهيد يسري راغب، أسيوط، ورقم 0882372155 وتصنيف التصميم الداخلي والديكور.'
  ),
  (
    'hisham-elqady-design-office-assiut','مكتب التصميم الهندسي أ.د. هشام القاضي — أسيوط','Hisham El Qady Engineering Design Office',
    'engineering_design',NULL,
    '30 شارع الحجاز، متفرع من شارع محمود رشوان، أمام مستشفى الحياة، أسيوط',
    '01006580880',
    'ملف مرشح مخفي. سجل خرائط محلية يصنفه مكتبًا معماريًا/تصميمًا هندسيًا ويعرض عنوانًا وهاتفًا. لا توجد جهة رسمية مستقلة أكدت صفة المكتب أو مؤهلات ممثله؛ يجب التحقق قبل الاعتماد.',
    'SP-20261115-HISHAM-ELQADY','مكتب التصميم الهندسي — نتيجة خرائط محلية','Google Maps','دليل أعمال — مصدر اكتشاف',
    'https://www.google.com/maps/search/?api=1&query=%D9%85%D9%83%D8%AA%D8%A8+%D8%AA%D8%B5%D9%85%D9%8A%D9%85+%D8%A7%D9%84%D9%87%D9%86%D8%AF%D8%B3%D9%8A+%D9%87%D8%B4%D8%A7%D9%85+%D8%A7%D9%84%D9%82%D8%A7%D8%B6%D9%8A+%D8%A3%D8%B3%D9%8A%D9%88%D8%B7',
    NULL::date,
    'مصدر اكتشاف محلي للاسم والعنوان والهاتف؛ لا يثبت الترخيص أو المؤهلات.'
  ),
  (
    'ebdaa-decor-assiut','إبداع للديكورات — أسيوط','Ebdaa Decorations Assiut',
    'finishing_decoration',NULL,
    'ميدان أم البطل، أبراج الكهرباء، برج 4، الدور الأول، شقة 2، أسيوط',
    '01123320036 / 01111747483',
    'ملف مرشح مخفي. دليل محلي يصنف النشاط ضمن مهندسي ومصممي الديكور ويعرض عنوانًا ورقمي اتصال. يلزم التحقق المباشر من الاسم التجاري الحالي وطبيعة الخدمات واستمرار النشاط.',
    'SP-20261115-EBDAA-DECOR','إبداع للديكورات — دليل مهندسي ومصممي الديكور بأسيوط','Dalil140','دليل أعمال — مصدر اكتشاف',
    'https://dalil140.com/category/ar/interior-decorators-designers/assyout',
    NULL::date,
    'قائمة دليل محلي تعرض الاسم والعنوان ورقمي اتصال؛ لا تثبت الاعتماد المهني.'
  ),
  (
    'dary-building-decoration-assiut','دارى — مركز البناء والديكور، فرع حي شرق أسيوط','Dary Building & Decoration Assiut',
    'finishing_decoration',NULL,
    'برج المروة، شارع الجمهورية، بجوار مطعم مصطفى درويش، حي شرق، أسيوط',
    '0882303877 / 16172',
    'ملف مرشح مخفي. دليل محلي يعرض فرع حي شرق لخدمات البناء والديكور، ورقم هاتف أرضي ورقم خدمة مختصر وموقع daryegypt.com. يلزم تأكيد أن الفرع ما زال يعمل وأن تفاصيل الاتصال والخدمات سارية.',
    'SP-20261115-DARY-DECOR','دارى — مركز البناء والديكور، فرع حي شرق','Dalil140','دليل أعمال — مصدر اكتشاف',
    'https://dalil140.com/category/ar/interior-decorators-designers/assyout',
    NULL::date,
    'دليل محلي يذكر فرع حي شرق والعنوان ورقم الهاتف والموقع الإلكتروني؛ يلزم التأكيد المباشر.'
  ),
  (
    'decorando-interior-design-assiut','Decorando — ديكوراندو للتصميم والديكور','Decorando Assiut',
    'finishing_decoration',NULL,
    'شارع أحمد مدحت، متفرع من شارع سيتي الأول، أمام محمد ربيع للشنط، أسيوط',
    '01025458617 / 01124609999',
    'ملف مرشح مخفي. قائمة محلية تعرض خدمات تصميمات هندسية 2D و3D وأثاث وديكور وواجهات ووحدات إضاءة، مع عنوان ورقمي اتصال. يلزم الاتصال للتحقق من استمرار النشاط ومن يملك حق تمثيل الاسم التجاري.',
    'SP-20261115-DECORANDO','Decorando — قائمة أنشطة الديكور بأسيوط','MegaBizDir','دليل أعمال — مصدر اكتشاف',
    'https://www.megabizdir.com/EG/Asyut/67430-30/genre/192647794097278/Home%2Bdecor',
    NULL::date,
    'دليل محلي يعرض اسم النشاط والخدمات والأرقام والعنوان؛ مصدر اكتشاف فقط.'
  )
),
saved_entities AS (
  INSERT INTO public.directory_entities(
    slug,name_ar,name_en,entity_type,service_category,marketplace_category,
    verification_status,public_visible,location_public
  )
  SELECT slug,name_ar,name_en,'other',service_category,marketplace_category,
         'needs_review',false,false
  FROM candidates
  ON CONFLICT (slug) DO UPDATE
    SET service_category = COALESCE(public.directory_entities.service_category,EXCLUDED.service_category),
        marketplace_category = COALESCE(public.directory_entities.marketplace_category,EXCLUDED.marketplace_category),
        verification_status = CASE
          WHEN public.directory_entities.verification_status='published'
            THEN public.directory_entities.verification_status
          ELSE 'needs_review'
        END,
        public_visible = CASE
          WHEN public.directory_entities.verification_status='published'
            THEN public.directory_entities.public_visible
          ELSE false
        END,
        location_public = CASE
          WHEN public.directory_entities.verification_status='published'
            THEN public.directory_entities.location_public
          ELSE false
        END,
        updated_at = now()
  RETURNING id,slug
),
resolved_entities AS (
  SELECT e.id,c.*
  FROM candidates c
  JOIN saved_entities e ON e.slug=c.slug
),
saved_sources AS (
  INSERT INTO public.directory_sources(
    source_code,title,publisher,source_type,source_url,publication_date,
    accessed_at,confidence_level,is_public,notes
  )
  SELECT source_code,source_title,publisher,source_type,source_url,publication_date,
         now(),'business_directory',false,source_notes
  FROM candidates
  ON CONFLICT (source_code) DO UPDATE
    SET title=EXCLUDED.title,publisher=EXCLUDED.publisher,source_type=EXCLUDED.source_type,
        source_url=EXCLUDED.source_url,publication_date=EXCLUDED.publication_date,
        confidence_level=EXCLUDED.confidence_level,is_public=false,
        notes=EXCLUDED.notes,accessed_at=now()
  RETURNING id,source_code
),
linked_sources AS (
  INSERT INTO public.directory_entity_sources(entity_id,source_id,claim_key)
  SELECT e.id,s.id,'service_provider_discovery'
  FROM resolved_entities e
  JOIN saved_sources s ON s.source_code=e.source_code
  ON CONFLICT (entity_id,source_id,claim_key) DO NOTHING
  RETURNING entity_id
)
INSERT INTO public.directory_entity_private(
  entity_id,internal_address,internal_phone,verification_label,confidence_level,notes,updated_at
)
SELECT e.id,c.internal_address,c.internal_phone,
       'مرشح بحثي — غير معتمد للنشر','business_directory',c.private_notes,now()
FROM resolved_entities e
JOIN candidates c ON c.slug=e.slug
ON CONFLICT (entity_id) DO UPDATE
  SET internal_address=EXCLUDED.internal_address,
      internal_phone=EXCLUDED.internal_phone,
      verification_label='مرشح بحثي — غير معتمد للنشر',
      confidence_level='business_directory',
      notes=EXCLUDED.notes,
      updated_at=now();

COMMIT;
