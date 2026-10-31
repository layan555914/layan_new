# اقتراح CSP والكاش (غير مطبَّق)

## الوضع الحالي (من فحص الملفات)
- GitHub Pages لا يسمح بتعيين رؤوس HTTP، فالحل الممكن هو وسم `<meta http-equiv="Content-Security-Policy">`، وهو لا يدعم `frame-ancestors`.
- لا توجد سكربتات مضمنة في الصفحات الفعّالة إلا واحد في `reset-password.html`. توجد `style` مضمنة وسمات `style=""`، وعدة نسخ قديمة من الصفحات (`index-5 (1).html` و`layan_new_platform-1.html`) فيها سكربتات ومعالجات `on...` مضمنة، وهي غير مستخدمة لكنها منشورة.
- المضيفات الخارجية: خطوط Google، وصور من `images.unsplash.com` و`images.pexels.com`، وSupabase، وروابط `wa.me` و`facebook` و`instagram` (روابط تنقل فقط وليست موارد).

## اقتراح لوحة الإدارة أولاً (الأعلى خطراً)، في `admin.html`
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.supabase.co; connect-src 'self' https://*.supabase.co; base-uri 'none'; form-action 'none'">
```
- `admin.html` يحمل `config.js` و`admin.js` فقط، فهذه السياسة لا تتوقع أن تكسره. الصور المعروضة هي روابط يفتحها الأدمن في تبويب جديد وليست مضمنة.
- **خطوة الاختبار:** جرّبها أولاً بـ `Content-Security-Policy-Report-Only` في staging ثم افحص وحدة التحكم.

## اقتراح الموقع العام (بعد الاختبار)
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src https://fonts.gstatic.com; img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://images.pexels.com;
connect-src 'self' https://*.supabase.co; base-uri 'self'; form-action 'self'
```
- `reset-password.html` فيه سكربت مضمن: إما نقله لملف خارجي أو إضافة hash له في `script-src`.
- صور الشركات والإعلانات من روابط يدخلها المستخدم قد تأتي من أي مضيف، فقد تحتاج `img-src https:`، وهو أقل صرامة. قرار منتج.
- ملاحظة: ملفات النسخ القديمة (`index-5 (1).html` وغيرها) لا تتوافق مع CSP، وإن بقيت منشورة فاستهدفها بالأرشفة.

## الكاش (`sw.js`)
1. **الإصدار اليدوي:** كل تعديل في ملف مخزّن يتطلب رفع `CACHE_NAME`. اقتراح: ربطه برقم commit أو بخطوة نشر تلقائية، أو تذكير في قالب الـ PR.
2. **الكاش أولاً لملفات نفس النطاق:** يبقي `admin.js` و`config.js` قديمين حتى تغيّر الإصدار. الاقتراح لملفات `*.js` وCSS: **stale-while-revalidate** أو الشبكة أولاً مع الرجوع للكاش، مع إبقاء الكاش أولاً للصور والأيقونات.
3. **`cache.addAll` قد يخزّن نسخة قديمة من كاش المتصفح** بعد النشر: استخدم `new Request(url, {cache: 'reload'})` عند التثبيت.
4. **عدم تخزين صفحات الإدارة:** استثناء `admin.html` و`admin.js` من الكاش بالكامل.
5. **تضخم الكاش:** صفحات navigation بمعاملات مختلفة (`company.html?id=...`) تُخزَّن كلها. اقتراح: تقييد التخزين بمسارات الصفحات الثابتة.
**تنبيه:** الكاش يتفاعل مع كل الصفحات، فاختبر على staging مع تحديث الموقع مرتين وفي وضع عدم الاتصال قبل أي اعتماد.