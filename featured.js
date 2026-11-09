document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const config = window.LAYAN_CONFIG || {};
  const base = String(config.SUPABASE_URL || "").replace(/\/$/, "");
  const key = config.SUPABASE_PUBLISHABLE_KEY || "";
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[char]);
  const safeLink = value => {
    try {
      const url = new URL(String(value || ""));
      return ["https:","http:"].includes(url.protocol) ? url.href : "";
    } catch (_) { return ""; }
  };
  const safeImage = value => {
    const raw = String(value || "");
    if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(raw)) return raw;
    if (/^assets\/[a-z0-9_./-]+$/i.test(raw)) return "./" + raw;
    return safeLink(raw);
  };
  const phoneNumber = value => {
    let digits = String(value || "").replace(/[^0-9]/g, "");
    if (digits.startsWith("20")) digits = digits.slice(2);
    if (digits && !digits.startsWith("0")) digits = "0" + digits;
    return /^01[0125][0-9]{8}$/.test(digits) ? digits : "";
  };
  const money = value => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number.toLocaleString("en-US") + " ج.م" : "السعر عند التواصل";
  };
  function state(grid, message, error) {
    if (!grid) return;
    grid.innerHTML = '<p class="featured-state' + (error ? ' error' : '') + '">' + esc(message) + '</p>';
  }
  function propertyCard(item) {
    const image = safeImage(Array.isArray(item.image_urls) ? item.image_urls[0] : "");
    const title = item.title || "عرض عقاري";
    const location = [item.city, item.area].filter(Boolean).join("، ") || "أسيوط";
    const href = "./property.html?id=" + encodeURIComponent(String(item.id));
    const imageHtml = image
      ? '<img src="' + esc(image) + '" alt="' + esc(title) + '" loading="lazy">'
      : '<div class="featured-card-placeholder">ASYUT AQAR</div>';
    const purpose = String(item.listing_purpose || "بيع");
    const type = String(item.property_type || "عقار");
    return '<article class="featured-card"><div class="featured-card-media">' + imageHtml +
      '<span class="featured-card-badge">★ عقار مميز</span></div><div class="featured-card-body">' +
      '<p class="featured-card-category">' + esc(type) + ' · ' + esc(purpose) + '</p><h3>' + esc(title) +
      '</h3><p class="featured-card-meta">⌖ ' + esc(location) + '</p><strong class="featured-card-price">' +
      esc(money(item.total_price)) + '</strong><div class="featured-card-actions"><a href="' + href +
      '">عرض التفاصيل</a></div></div></article>';
  }
  function serviceCard(item) {
    const images = Array.isArray(item.image_urls) ? item.image_urls : [];
    const image = safeImage(images.find(value => safeImage(value)) || "");
    const title = item.title || "خدمة مميزة";
    const location = [item.city, item.area].filter(Boolean).join("، ") || "أسيوط";
    const phone = phoneNumber(item.contact_phone);
    const whatsapp = phoneNumber(item.whatsapp) || phone;
    const href = "./marketplace.html#marketplace-listing-" + encodeURIComponent(String(item.id));
    const imageHtml = image
      ? '<img src="' + esc(image) + '" alt="' + esc(title) + '" loading="lazy">'
      : '<div class="featured-card-placeholder">' + esc(item.category || "سوق الخدمات") + '</div>';
    const actions = '<a href="' + href + '" class="secondary">عرض الإعلان</a>' +
      (phone ? '<a href="tel:' + esc(phone) + '">اتصال</a>' : "") +
      (whatsapp ? '<a href="https://wa.me/2' + esc(whatsapp) + '" target="_blank" rel="noopener noreferrer">واتساب</a>' : "");
    return '<article class="featured-card"><div class="featured-card-media">' + imageHtml +
      '<span class="featured-card-badge">★ خدمة مميزة</span></div><div class="featured-card-body">' +
      '<p class="featured-card-category">' + esc(item.category || "خدمات") + '</p><h3>' + esc(title) +
      '</h3><p class="featured-card-desc">' + esc(String(item.description || "").slice(0, 145)) +
      '</p><p class="featured-card-meta">⌖ ' + esc(location) + '</p><strong class="featured-card-price">' +
      esc(money(item.price)) + '</strong><div class="featured-card-actions">' + actions + '</div></div></article>';
  }
  function sponsorCard(item) {
    const image = safeImage(item.image_url);
    const target = safeLink(item.target_url);
    const phone = String(item.contact_phone || "").replace(/[^+0-9]/g, "");
    const actions = (target ? '<a href="' + esc(target) + '" target="_blank" rel="noopener noreferrer">اعرف التفاصيل</a>' : "") +
      (phone ? '<a class="secondary" href="tel:' + esc(phone) + '">اتصال</a>' : "");
    const imageHtml = image
      ? '<img src="' + esc(image) + '" alt="' + esc(item.business_name || item.title || "إعلان ممول") + '" loading="lazy" referrerpolicy="no-referrer">'
      : '<div class="featured-card-placeholder">' + esc(item.business_name || "إعلان تجاري") + '</div>';
    return '<article class="featured-card"><div class="featured-card-media">' + imageHtml +
      '<span class="featured-card-badge">إعلان ممول</span></div><div class="featured-card-body">' +
      '<p class="featured-card-category">' + esc(item.category || "إعلان تجاري") + '</p><h3>' +
      esc(item.title || item.business_name || "إعلان تجاري") + '</h3><p class="featured-card-desc">' +
      esc(item.description || "") + '</p><div class="featured-card-meta">' + esc(item.business_name || "") +
      '</div><div class="featured-card-actions">' + (actions || '<a href="./advertise.html">تفاصيل الإعلان</a>') +
      '</div></div></article>';
  }
  async function rest(path) {
    if (!base || !key) throw new Error("إعدادات الاتصال غير مكتملة.");
    const response = await fetch(base + "/rest/v1/" + path, {
      headers: { apikey:key, Authorization:"Bearer " + key }
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) {}
    if (!response.ok) throw new Error(data?.message || "تعذر تحميل البيانات.");
    return Array.isArray(data) ? data : [];
  }
  async function loadProperties() {
    const grid = $("featuredPropertiesGrid");
    try {
      const service = window.LAYAN_SUPABASE;
      if (!service?.getOffers) throw new Error("خدمة العقارات غير جاهزة.");
      const rows = await service.getOffers();
      const now = Date.now();
      const featured = (Array.isArray(rows) ? rows : []).filter(item =>
        item.is_featured === true && (!item.featured_until || new Date(item.featured_until).getTime() > now)
      );
      grid.innerHTML = featured.length ? featured.map(propertyCard).join("") :
        '<p class="featured-state">لا توجد عقارات مميزة سارية حاليًا. <a href="./offers.html">تصفح كل العقارات</a>.</p>';
    } catch (error) {
      state(grid, error.message || "تعذر تحميل العقارات المميزة.", true);
    }
  }
  async function loadServices() {
    const grid = $("featuredServicesGrid");
    try {
      const rows = await rest("marketplace_listings?select=id,category,title,description,city,area,price,contact_phone,whatsapp,image_urls,created_at,is_featured&status=eq.approved&order=is_featured.desc,created_at.desc&limit=100");
      const featured = rows.filter(item => item.is_featured === true);
      grid.innerHTML = featured.length ? featured.map(serviceCard).join("") :
        '<p class="featured-state">لا توجد خدمات مميزة منشورة حاليًا. <a href="./marketplace.html">تصفح سوق الخدمات</a>.</p>';
    } catch (error) {
      state(grid, error.message || "تعذر تحميل الخدمات المميزة.", true);
    }
  }
  async function loadSponsors() {
    const grid = $("featuredSponsorsGrid");
    try {
      const rows = await rest("public_active_supplier_ads?select=id,business_name,category,title,description,image_url,target_url,contact_phone,created_at&order=created_at.desc&limit=12");
      grid.innerHTML = rows.length ? rows.map(sponsorCard).join("") :
        '<p class="featured-state">لا توجد إعلانات تجارية نشطة للعرض حاليًا. <a href="./advertise.html">اعرف كيف تعلن معنا</a>.</p>';
    } catch (error) {
      state(grid, error.message || "تعذر تحميل الإعلانات التجارية.", true);
    }
  }
  Promise.allSettled([loadProperties(), loadServices(), loadSponsors()]);
});
