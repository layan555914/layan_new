-- ASYUT AQAR: repair private details and discovery-source links for lighting candidates.
-- The profiles remain hidden and pending review.

BEGIN;

WITH candidate_private(slug,internal_phone,internal_address,confidence_level,notes) AS (
  VALUES
  ('asfour-crystal-assiut','16218 / 0882286606 / 01095343216','تقسيم البترول، برج كريستال، أسيوط.','business_directory',
   'تطابق عنوان الفرع وأرقام 0882286606 و01095343216 والخط الساخن 16218 في أكثر من دليل مستقل، مع إدراج الموقع asfourcrystal.com. يلزم اتصال بالشركة لتأكيد استمرار الفرع وملكية بيانات التواصل.'),
  ('queen-home-assiut','0882331841 / 01006107996','شارع يسري راغب، حي غرب، أمام بنك فيصل الإسلامي، أسيوط.','business_directory',
   'الاسم والعنوان والهاتف والتصنيف (لمبات ونجف وأنظمة إضاءة) متوافقة في ثلاثة أدلة محلية. لا يوجد مصدر رسمي مباشر؛ يلزم اتصال للتأكد من أن النشاط ما زال قائمًا ونطاق منتجات الإضاءة الحالي.'),
  ('gila-electrical-assiut','19796 / 0882146635 / 01001750164 / 01002189638','1 شارع أحمد حسن الباقوري، برج الإبراهيمية، أسيوط.','primary_company',
   'الموقع الرسمي يدرج فرع أسيوط بهذا العنوان ورقم 0882146635 والمحمول 01001750164؛ أدلة فروع أخرى تضيف 01002189638. Yellow Pages يصنف الفرع ضمن لمبات ونجف وأنظمة إضاءة إلى جانب الأنشطة الكهربائية. يلزم تأكيد الخدمات التي يقدمها الفرع للأفراد قبل نشره تحت فئة الإضاءة.'),
  ('electro-center-lighting-assiut','01271096099','شارع يسري راغب، أسيوط.','business_directory',
   'مدرج في صفحة موزعي ECOLiTE تحت أسيوط مع هاتف 01271096099. الصفحة لا تعرض تاريخ تحديث واضح؛ يجب تأكيد استمرار التوزيع والفرع قبل اعتماد الملف.'),
  ('ker-mena-lighting-assiut','01229294091','قائمة ECOLiTE تذكر شارع المنفذ، أسيوط؛ ونتيجة نشاط أخرى تذكر 17 شارع عدلي يكن، حي غرب.','business_directory',
   'اسم كير مينا ورقم 01229294091 ظاهران في قائمة موزعي ECOLiTE ونتيجة نشاط محلية، لكن العنوان مختلف بين المصدرين. لا يُعتمد عنوان ولا يُنشر رقم قبل التأكد من صاحب النشاط والفرع الحالي.'),
  ('white-light-modern-lighting-assiut',NULL,'القيسارية، بجوار مسجد سيدي جلال الدين الأسيوطي، أسيوط.','business_directory',
   'مدرج في دليل محلات محلية مع وصف لمنتجات النجف الليد والكريستال والأباليك والدلايات والأباجورات. لم يظهر رقم هاتف موثوق في المصدر؛ يجب تحديد الاسم التجاري الدقيق ورقم التواصل قبل النشر.'),
  ('el-galaa-lighting-assiut','0882333153 / 01003412314','امتداد شارع يسري راغب، حي غرب، أسيوط، بجوار كنز للملابس.','business_directory',
   'مدرج باسم الجلاء ضمن فئة لمبات ونجف وأنظمة إضاءة، وتطابقت بيانات العنوان والهاتف مع دليل مدينة محلي. نحتاج تأكيد الاسم التجاري الكامل واستمرار النشاط والخدمات قبل الاعتماد.')
)
INSERT INTO public.directory_entity_private(
  entity_id,internal_phone,internal_address,verification_label,confidence_level,notes
)
SELECT e.id,c.internal_phone,c.internal_address,'مرشح بحثي — غير معتمد للنشر',c.confidence_level,c.notes
FROM candidate_private c
JOIN public.directory_entities e ON e.slug=c.slug
ON CONFLICT (entity_id) DO UPDATE
SET internal_phone=EXCLUDED.internal_phone,
    internal_address=EXCLUDED.internal_address,
    verification_label='مرشح بحثي — غير معتمد للنشر',
    confidence_level=EXCLUDED.confidence_level,
    notes=EXCLUDED.notes,
    updated_at=now();

WITH source_owners(source_code,slug) AS (
  VALUES
  ('SP-20261115-ASFOUR-BRANCH','asfour-crystal-assiut'),
  ('SP-20261115-QUEEN-HOME','queen-home-assiut'),
  ('SP-20261115-GILA-ASSIUT','gila-electrical-assiut'),
  ('SP-20261115-ECOLITE-ASSIUT','electro-center-lighting-assiut'),
  ('SP-20261115-KERMENA-ECOLITE','ker-mena-lighting-assiut'),
  ('SP-20261115-WHITELIGHT','white-light-modern-lighting-assiut'),
  ('SP-20261115-ELGALAA','el-galaa-lighting-assiut')
)
INSERT INTO public.directory_entity_sources(entity_id,source_id,claim_key)
SELECT e.id,s.id,'service_provider_discovery'
FROM source_owners o
JOIN public.directory_entities e ON e.slug=o.slug
JOIN public.directory_sources s ON s.source_code=o.source_code
ON CONFLICT (entity_id,source_id,claim_key) DO NOTHING;

COMMIT;
