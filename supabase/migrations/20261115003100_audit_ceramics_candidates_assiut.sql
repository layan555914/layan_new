-- ASYUT AQAR: first-pass audit and correction of existing ceramics/sanitaryware leads.
-- Internal discovery data only. No public contact, profile publication, or user-facing visibility is enabled.

BEGIN;

-- 1) Correct category mapping: this existing supplier is a ceramic/sanitaryware shop,
-- not a duplicate of any of the newly discovered showrooms.
UPDATE public.directory_entities
SET marketplace_category = 'السيراميك والبورسلين والأدوات الصحية'
WHERE slug = 'rashad-rashdy-marcous-assiut'
  AND marketplace_category IS DISTINCT FROM 'السيراميك والبورسلين والأدوات الصحية';

-- 2) Correct and enrich private discovery notes using the sources listed below.
-- AlDoctor: the official site lists four Assiut locations and their published contacts.
UPDATE public.directory_entity_private p
SET internal_phone = '01226771010 / 0882082702 / 0882374433 / 0882730960 / 0882730970 / 0882730980 / 01226774022 / 01226774040 / 088233659',
    internal_address = 'المجاهدين: 226 شارع 26 يوليو أمام مسجد المجاهدين؛ سيتي: 45 شارع سيتي الأول؛ التحرير: 9 شارع التحرير بجوار كنيسة سانت تريزا؛ بني غالب: بجوار الحديقة الدولية، طريق مطار أسيوط.',
    confidence_level = 'primary_company',
    notes = 'مراجعة الموقع الرسمي: الشركة تذكر تاريخها منذ 1982 وتعرض أربعة مواقع في أسيوط. خدمة العملاء 01226771010، مبيعات سيتي 0882082702، التحرير 0882374433، بني غالب 0882730960 و0882730970 و0882730980 ومحمول 01226774022 و01226774040. رقم المجاهدين ظاهر بالموقع 088233659 كما هو مكتوب؛ يبدو أقصر من المعتاد ويحتاج تأكيدًا هاتفيًا. لا تنشر كل الأرقام أو الفروع قبل مراجعة الجهة.'
FROM public.directory_entities e
WHERE p.entity_id=e.id AND e.slug='aldoctor-ceramics-assiut';

-- Cleopatra: sources show more than one possible Assiut location; preserve that discrepancy.
UPDATE public.directory_entity_private p
SET internal_phone = '0882286509 / 0882286510 / 19119',
    internal_address = 'دليل الفروع يذكر فرع حي شرق، 4 شارع الجمهورية، برج الحرية بجوار شركة كمبيوتر شوب؛ ويذكر فرعًا آخر على طريق أسيوط–الوادي الجديد/طريق المطار بجوار المقاولون العرب. توجد أيضًا نتيجة خرائط باسم المجموعة في شارع الجمهورية.',
    confidence_level = 'business_directory',
    notes = 'تطابق اسم العلامة ورقم 0882286509 ظاهر في أكثر من دليل، ودليل الفروع يضيف 0882286510 والخط الساخن 19119. نتيجة خرائط أخرى تصف موقع شارع الجمهورية بأنه حي الفتح؛ يلزم حسم اسم الحي والفرع أو فصل الفروع قبل النشر. لا تفترض أن كل الأرقام تخص نفس المعرض.'
FROM public.directory_entities e
WHERE p.entity_id=e.id AND e.slug='cleopatra-ceramics-assiut-branch';

-- Ideal Standard: official showroom locator confirms the Assiut showroom address and official hotline.
UPDATE public.directory_entity_private p
SET internal_phone = '19696 / 0882291666',
    internal_address = '4 شارع الجمهورية، برج الحرية، حي شرق، أسيوط.',
    confidence_level = 'primary_company',
    notes = 'الموقع الرسمي لـ Ideal Standard يدرج معرض أسيوط في 4 شارع الجمهورية، برج الحرية. الرقم الرسمي المنشور لخدمة العملاء هو 19696؛ رقم 0882291666 وارد في دليل فروع تجاري. الرقم السابق 01068782324 في سجل الاكتشاف لم نعثر له على دعم موثوق، فلا يُعتمد ولا يُنشر قبل تأكيده من الشركة. لا يوصف الفرع بأنه موزع معتمد مستقل؛ هو معرض/موقع مدرج في دليل الشركة.'
FROM public.directory_entities e
WHERE p.entity_id=e.id AND e.slug='ideal-standard-showroom-assiut';

-- Makkah: fix a transcription error in the local telephone number.
UPDATE public.directory_entity_private p
SET internal_phone = '0882330011',
    internal_address = 'شارع سعد زغلول، الحمراء الثانية، قسم ثان أسيوط.',
    confidence_level = 'business_directory',
    notes = 'رقم الهاتف 0882330011 والعنوان متطابقان بين قائمة محلية مستقلة ونتيجة خرائط الأعمال. كان الرقم في السجل السابق 088233011 (صفر ناقص). يظل ملف الاكتشاف خاصًا حتى تأكيد المالك وتحديث بياناته.'
FROM public.directory_entities e
WHERE p.entity_id=e.id AND e.slug='mecca-ceramics-sanitary-assiut';

-- Al Amir: several independent business directories converge on Borg El Marjan, Extension of Yousry Ragheb.
UPDATE public.directory_entity_private p
SET internal_phone = '0882358078',
    internal_address = 'برج المرجان، امتداد شارع يسري راغب، السادات، أسيوط.',
    confidence_level = 'business_directory',
    notes = 'أكثر من دليل أعمال يطابق الاسم والنشاط والهاتف والعنوان: برج المرجان، امتداد شارع يسري راغب، السادات؛ هاتف 0882358078. العنوان السابق 55HQ+46Q في الحمراء الثانية لم تؤيده المصادر الأقوى ويُحتفظ به فقط كبيان سابق غير مؤكد. يلزم تأكيد الجهة قبل النشر.'
FROM public.directory_entities e
WHERE p.entity_id=e.id AND e.slug='al-amer-ceramic-assiut';

-- Mazloum: a newer branch listing supersedes the older map-code-only address,
-- while an alternate phone from a separate listing remains explicitly unconfirmed.
UPDATE public.directory_entity_private p
SET internal_phone = '01271217893 / 01271236797',
    internal_address = 'برج نايل بلازا، طريق أسيوط–سوهاج الرئيسي، نزلة عبد اللاه، مدينة أسيوط.',
    confidence_level = 'business_directory',
    notes = 'دليل متخصص محدث في 28 يناير 2026 يعرض العنوان والأرقام 01271217893 و01271236797 ويذكر السيراميك والبورسلين والأدوات الصحية. نتيجة خرائط أعمال أخرى تعرض رقمًا مختلفًا 01092611953؛ لا نعتمده قبل التأكيد المباشر. العنوان القديم 5693+Q3C لم يعد كافيًا للتعريف بالفرع.'
FROM public.directory_entities e
WHERE p.entity_id=e.id AND e.slug='mazloum-ceramics-assiut';

-- AlRomany: improve location precision, but no phone number is added because none was verified.
UPDATE public.directory_entity_private p
SET internal_address = 'شارع يسري راغب، الحمراء الثانية، قسم ثان أسيوط.',
    confidence_level = 'business_directory',
    notes = 'تطابق الاسم والنشاط والعنوان بين دليل محلي ونتيجة دليل أعمال: الروماني جروب للأدوات الصحية والسيراميك والبورسلين في شارع يسري راغب، الحمراء الثانية. لم نعثر على هاتف موثوق منشور؛ يظل فارغًا حتى تأكيد مباشر.'
FROM public.directory_entities e
WHERE p.entity_id=e.id AND e.slug='alromany-ceramics-assiut';

-- Record additional corroborating references as internal-only source records.
WITH source_rows(source_code,title,publisher,source_type,source_url,confidence_level,notes) AS (
  VALUES
  ('SP-20261115-ALAMIR-BRANCH','بورسيلين وسيراميك الأمير — فرع السادات','دليل 140 وفروع الشركات','دليل فروع أعمال — مصدر تحقق','https://dalil140.com/company/ar/443505-porcelain-ceramic-al-amir','business_directory','اسم النشاط والعنوان والهاتف تتطابق مع السجل الحالي؛ العنوان القديم غير مؤكد.'),
  ('SP-20261115-CLEOPATRA-BRANCHES','سيراميكا كليوباترا — قائمة الفروع في أسيوط','دليل 140','دليل فروع أعمال — مصدر تحقق','https://dalil140.com/branches/ar/71234-ceramica-cleopatra-group','business_directory','يذكر فرعي حي شرق وطريق أسيوط الوادي الجديد، مع ضرورة تأكيد رقم كل فرع.'),
  ('SP-20261115-IDEAL-OFFICIAL','Ideal Standard — محدد صالات العرض الرسمي','Ideal Standard Egypt','الموقع الرسمي للشركة','https://idealstandard-egypt.com/showrooms/','primary_company','الموقع الرسمي يؤكد وجود معرض أسيوط في برج الحرية ورقم خدمة العملاء 19696.'),
  ('SP-20261115-MAZLOUM-2026','مظلوم للسيراميك — بيانات فرع أسيوط المنشورة 2026','المكان','دليل محلي متخصص — مصدر تحقق','https://www.al-makan.com/sanitary-ceramics/مظلوم-اسيوط/','business_directory','بيانات أحدث للعنوان والهاتف؛ توجد نتيجة أخرى برقم بديل يجب مراجعته مباشرة.'),
  ('SP-20261115-MAKKA-LOCAL','معرض مكة للسيراميك والأدوات الصحية — أسيوط','دي زون','دليل محلي — مصدر تحقق','https://dezone.net/place/معرض-مكه-للسيراميك-و-الاداوت-الصحيه/','business_directory','يؤكد 0882330011 والعنوان؛ صححنا صفرًا ناقصًا في السجل الداخلي.'),
  ('SP-20261115-ALROMANY-LOCAL','الروماني جروب للأدوات الصحية والسيراميك والبورسلين','BizMidEast','دليل أعمال — مصدر تحقق','https://www.bizmideast.com/EG/الروماني-جروب-للأدوات-الصحية-والسيراميك','business_directory','مصدر ثانٍ يثبت عنوان يسري راغب؛ لا يقدم هاتفًا موثوقًا.')
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
  ('SP-20261115-ALAMIR-BRANCH','al-amer-ceramic-assiut'),
  ('SP-20261115-CLEOPATRA-BRANCHES','cleopatra-ceramics-assiut-branch'),
  ('SP-20261115-IDEAL-OFFICIAL','ideal-standard-showroom-assiut'),
  ('SP-20261115-MAZLOUM-2026','mazloum-ceramics-assiut'),
  ('SP-20261115-MAKKA-LOCAL','mecca-ceramics-sanitary-assiut'),
  ('SP-20261115-ALROMANY-LOCAL','alromany-ceramics-assiut')
)
INSERT INTO public.directory_entity_sources(entity_id,source_id,claim_key)
SELECT e.id,s.id,'ceramics_candidate_recheck_20261115'
FROM source_owners o
JOIN public.directory_entities e ON e.slug=o.slug
JOIN saved_sources s ON s.source_code=o.source_code
ON CONFLICT (entity_id,source_id,claim_key) DO NOTHING;

COMMIT;
