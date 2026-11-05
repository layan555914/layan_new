document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const config = window.LAYAN_CONFIG || {};
  const base = (config.SUPABASE_URL || "").replace(/\/$/, "");
  const key = config.SUPABASE_PUBLISHABLE_KEY || "";
  const grid = document.getElementById("supplierAdsGrid");
  let ads = [];

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  const safeUrl = value => {
    try {
      const parsed = new URL(String(value || ""));
      return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : "";
    } catch (_) { return ""; }
  };

  const authService = () => window.LAYAN_SUPABASE || null;
  const getSession = () => authService()?.getSession?.() || null;

  async function api(path, options = {}) {
    if (!base || !key) throw new Error("إعدادات الاتصال غير مكتملة.");
    const session = getSession();
    const response = await fetch(base + "/rest/v1/" + path, {
      ...options,
      headers: {
        apikey: key,
        Authorization: "Bearer " + (session?.access_token || key),
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = raw; }
    if (!response.ok) throw new Error(data?.message || data?.details || data?.hint || "تعذر الاتصال بخدمة الإعلانات.");
    return data;
  }

  function renderCard(ad) {
    // Show only the advertiser's own verified image; otherwise render the neutral business-name placeholder.
    const image = safeUrl(ad.image_url);
    const target = safeUrl(ad.target_url);
    const phone = String(ad.contact_phone || "").replace(/[^+0-9]/g, "");
    const phoneLink = phone ? '<a class="btn btn-outline-dark" href="tel:' + esc(phone) + '">اتصل بالمعلن</a>' : "";
    return '<article class="offer-card sponsor-card" data-sponsor-card="' + esc(ad.id) + '">' +
      '<span class="sponsor-label">' + esc(ad.demo ? "نموذج مجاني تجريبي — غير معتمد رسميًا" : "إعلان ممول") + '</span>' +
      (image ? '<img class="offer-image" src="' + esc(image) + '" alt="' + esc(ad.business_name) + '" loading="lazy" referrerpolicy="no-referrer">' :
        '<div class="offer-image offer-image-placeholder sponsor-placeholder">' + esc(ad.business_name) + '</div>') +
      '<div class="offer-card-content"><span class="offer-type">' + esc(ad.category) + '</span>' +
      '<p class="sponsor-business">' + esc(ad.business_name) + '</p><h3>' + esc(ad.title) + '</h3>' +
      '<p>' + esc(ad.description) + '</p><div class="sponsor-actions">' +
      (target ? '<a class="btn btn-gold" href="' + esc(target) + '" target="_blank" rel="noopener noreferrer">اعرف التفاصيل</a>' : "") +
      phoneLink + '</div></div></article>';
  }

  function placeAds() {
    if (!grid) return;
    grid.querySelectorAll("[data-sponsor-card]").forEach(node => node.remove());
    ads.forEach(ad => grid.insertAdjacentHTML("beforeend", renderCard(ad)));
    if (!ads.length) {
      // No approved ad yet: show the available slots so companies see where their ad would appear.
      const slots = [
        ["تشطيب وديكور", "اعرض أعمال التشطيب والتصميم الداخلي أمام أصحاب الوحدات الجديدة."],
        ["أثاث وأجهزة", "منتجاتك أمام من اشترى أو استأجر عقارًا ويجهّز بيته الآن."],
        ["مواد بناء", "سيراميك ودهانات وأدوات صحية لمن يبني أو يشطب في أسيوط."]
      ];
      grid.innerHTML = slots.map(([category, text]) =>
        '<article class="offer-card sponsor-card sponsor-cta sponsor-slot"><span class="sponsor-label">مساحة إعلانية متاحة</span>' +
        '<div class="offer-card-content"><h3>' + esc(category) + '</h3><p>' + esc(text) + '</p>' +
        '<div class="sponsor-actions"><a class="btn btn-gold" href="./advertise.html">احجز المساحة</a></div></div></article>').join("");
    }
  }

  // Native placement inside the listings grid (offers page): approved ads after every 6 listings,
  // or one "advertise here" card when no ad is approved yet. Re-applied after each filter render.
  const offersGrid = document.body.classList.contains("page-offers") ? document.getElementById("offersGrid") : null;
  function inlineCard(ad) {
    return renderCard(ad).replace('class="offer-card sponsor-card"', 'class="offer-card sponsor-card sponsor-inline" data-sponsor-inline');
  }
  function placeInlineAds() {
    if (!offersGrid) return;
    const listings = Array.from(offersGrid.children).filter(node => node.matches?.(".offer-card") && !node.hasAttribute("data-sponsor-inline"));
    offersGrid.querySelectorAll("[data-sponsor-inline]").forEach(node => node.remove());
    if (listings.length < 3) return;
    const slots = [];
    for (let i = 6; i <= listings.length && slots.length < 2; i += 6) slots.push(i);
    if (!slots.length) slots.push(listings.length);
    slots.forEach((position, index) => {
      const html = ads.length
        ? inlineCard(ads[index % ads.length])
        : '<article class="offer-card sponsor-card sponsor-inline sponsor-cta" data-sponsor-inline>' +
          '<span class="sponsor-label">مساحة إعلانية</span>' +
          '<div class="offer-card-content"><h3>اعرض نشاطك هنا أمام الباحثين عن عقار في أسيوط</h3>' +
          '<p>شركات التشطيب والديكور والأثاث ومواد البناء والمطورون: إعلانك يظهر بين العقارات التي يتصفحها العملاء الآن.</p>' +
          '<div class="sponsor-actions"><a class="btn btn-gold" href="./advertise.html">تفاصيل الإعلان</a>' +
          '<a class="btn btn-outline-dark" href="https://wa.me/201007044265?text=' + encodeURIComponent("مرحبًا، أرغب في الإعلان داخل صفحة العقارات على أسيوط عقار.") + '" target="_blank" rel="noopener noreferrer">تواصل واتساب</a></div></div></article>';
      listings[position - 1].insertAdjacentHTML("afterend", html);
    });
  }
  if (offersGrid) {
    let scheduled = false;
    new MutationObserver(() => {
      if (scheduled || offersGrid.querySelector("[data-sponsor-inline]")) return;
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; if (!offersGrid.querySelector("[data-sponsor-inline]")) placeInlineAds(); });
    }).observe(offersGrid, { childList: true });
  }

  async function loadAds() {
    if (!base || !key) return;
    try {
      const rows = await api("public_active_supplier_ads?select=id,business_name,category,title,description,image_url,target_url,contact_phone,created_at&order=created_at.desc&limit=12", { headers: { Authorization: "Bearer " + key } });
      const approvedAds = Array.isArray(rows) ? rows : [];
      // Only show real advertisements that have been approved by ASYUT AQAR administration.
      ads = approvedAds;
      placeAds();
      placeInlineAds();
    } catch (error) {
      console.warn("ASYUT AQAR sponsored ads:", error.message);
    }
  }


  let dialog;
  async function openForm() {
    try {
      const session = await authService()?.requireAuthenticated?.();
      if (!session?.access_token || !session?.user?.id) throw new Error("جلسة الدخول غير متاحة.");
    } catch (_) {
      window.alert("سجّل الدخول إلى حساب أسيوط عقار أولًا، ثم اطلب إعلانك الممول.");
      document.getElementById("loginBtn")?.click();
      return;
    }
    if (!dialog) buildForm();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  const footer = document.querySelector("footer");
  if (footer) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sponsor-footer-link";
    button.textContent = "سوّق منتجاتك لعملاء أسيوط عقار";
    button.addEventListener("click", openForm);
    footer.appendChild(button);
  }
  document.querySelectorAll("[data-open-sponsor-form]").forEach(button => button.addEventListener("click", openForm));

  function buildForm() {
    dialog = document.createElement("dialog");
    dialog.className = "sponsor-dialog";
    dialog.innerHTML =
      '<div class="sponsor-dialog-head"><h2>اطلب إعلانًا مميزًا أو إعلان شركة</h2><button type="button" class="sponsor-close" aria-label="إغلاق">×</button></div>' +
      '<p class="sponsor-price-note">إرسال طلب الإعلان مجاني ولا يعني وجود التزام بالدفع. تحدد إدارة أسيوط عقار المميزات والمدة والسعر النهائي بعد مراجعة النشاط والتواصل معك عبر واتساب. لا تُعرض أسعار الباقات على المنصة.</p>' +
      '<p>الإعلانات تظهر داخل قائمة العروض العقارية بعد موافقة الإدارة. أرسل بيانات نشاطك للمراجعة.</p>' +
      '<form class="sponsor-form">' +
      '<label>اسم النشاط<input name="business_name" required minlength="2" maxlength="120" autocomplete="organization"></label>' +
      '<label>مجال النشاط<select name="category" required><option value="">اختر المجال</option><option>مواد بناء</option><option>تشطيبات</option><option>سيراميك وبورسلين</option><option>دهانات</option><option>أبواب وشبابيك</option><option>مطابخ وأثاث</option><option>ستائر ومفروشات</option><option>أدوات صحية</option><option>كهرباء وسباكة</option><option>مقاولات</option><option>أخرى</option></select></label>' +
      '<label>عنوان الإعلان<input name="title" required minlength="3" maxlength="140"></label>' +
      '<label>وصف مختصر<textarea name="description" required minlength="5" maxlength="500" rows="3"></textarea></label>' +
      '<label>رابط صورة الإعلان (اختياري)<input name="image_url" type="url" maxlength="1000" placeholder="https://..."></label>' +
      '<label>رابط صفحة النشاط (اختياري)<input name="target_url" type="url" maxlength="1000" placeholder="https://..."></label>' +
      '<label>رقم التواصل<input name="contact_phone" required minlength="7" maxlength="30" type="tel" autocomplete="tel"></label>' +
      '<p class="sponsor-plan-note">سيتم تحديد مدة الإعلان والسعر النهائي بعد مراجعة الطلب والتواصل معك عبر واتساب.</p>' +
      '<p class="sponsor-plan-note">لا يتم تحصيل أي مبلغ من خلال هذا النموذج. السعر والمدة يعتمدان بعد التواصل والاتفاق مع الإدارة.</p>' +
      '<p class="sponsor-plan-note">يمكن للشركات العقارية طلب عرض مشروعاتها، ويمكن لشركات التشطيب والديكور والموردين عرض خدماتهم ومنتجاتهم. لا يتم نشر الإعلان إلا بعد مراجعة الإدارة والاتفاق على التفاصيل.</p>' +
      '<p class="sponsor-form-status" role="status" aria-live="polite"></p>' +
      '<button class="btn btn-gold" type="submit">إرسال طلب الإعلان</button></form>';
    document.body.appendChild(dialog);
    dialog.querySelector(".sponsor-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    dialog.querySelector("form").addEventListener("submit", submitRequest);
  }

  async function submitRequest(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const status = form.querySelector(".sponsor-form-status");
    let session;
    try {
      session = await authService()?.requireAuthenticated?.();
      if (!session?.access_token || !session?.user?.id) throw new Error("انتهت جلسة الدخول. سجّل الدخول مرة أخرى.");
    } catch (error) {
      status.textContent = error.message || "انتهت جلسة الدخول. سجّل الدخول ثم أعد إرسال الطلب.";
      return;
    }
    const data = new FormData(form);
    const plan = "custom";
    const imageUrl = safeUrl(data.get("image_url"));
    const targetUrl = safeUrl(data.get("target_url"));
    if (data.get("image_url") && !imageUrl) {
      status.textContent = "رابط الصورة غير صحيح؛ استخدم رابط HTTP أو HTTPS.";
      return;
    }
    if (data.get("target_url") && !targetUrl) {
      status.textContent = "رابط النشاط غير صحيح؛ استخدم رابط HTTP أو HTTPS.";
      return;
    }
    const payload = {
      owner_id: session.user.id,
      business_name: String(data.get("business_name") || "").trim(),
      category: String(data.get("category") || ""),
      title: String(data.get("title") || "").trim(),
      description: String(data.get("description") || "").trim(),
      image_url: imageUrl || null,
      target_url: targetUrl || null,
      contact_phone: String(data.get("contact_phone") || "").trim(),
      plan_code: plan,
      requested_days: 0,
      requested_price: 0,
      status: "pending",
      price: 0,
      starts_at: null,
      ends_at: null
    };
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = "جارٍ إرسال طلب الإعلان للمراجعة...";
    try {
      await api("supplier_ads", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(payload)
      });
      const businessName = String(data.get("business_name") || "").trim();
      const category = String(data.get("category") || "");
      const title = String(data.get("title") || "").trim();
      const phone = String(data.get("contact_phone") || "").trim();
      const message = [
        "مرحبًا، أرسلت طلب إعلان إلى منصة أسيوط عقار وأريد متابعة الطلب.",
        "اسم النشاط: " + businessName,
        "المجال: " + category,
        "عنوان الإعلان: " + title,
        "رقم التواصل: " + phone,
        "مدة الإعلان: يتم تحديدها بعد التواصل مع الإدارة",
        "أرجو إرسال مميزات الإعلان والسعر النهائي والمدة المقترحة عبر واتساب قبل تأكيد أي اتفاق أو دفع."
      ].join("\n");
      const whatsappUrl = "https://wa.me/201007044265?text=" + encodeURIComponent(message);
      form.reset();
      status.innerHTML = "تم حفظ طلبك للمراجعة. تواصل مع إدارة أسيوط عقار لمعرفة مميزات الإعلان والسعر النهائي قبل تأكيد الحجز. <a class=\"sponsor-whatsapp-followup\" href=\"" + whatsappUrl + "\" target=\"_blank\" rel=\"noopener noreferrer\">متابعة الطلب عبر واتساب</a>";
    } catch (error) {
      status.textContent = error.message || "تعذر إرسال الطلب. حاول مرة أخرى.";
    } finally {
      button.disabled = false;
    }
  }

  loadAds();
  window.addEventListener("focus", loadAds);
});
