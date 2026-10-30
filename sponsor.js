document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const config = window.LAYAN_CONFIG || {};
  const base = (config.SUPABASE_URL || "").replace(/\/$/, "");
  const key = config.SUPABASE_PUBLISHABLE_KEY || "";
  const grid = document.getElementById("offersGrid");
  let ads = [];
  let placing = false;
  let placeTimer;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  const safeUrl = value => {
    try {
      const parsed = new URL(String(value || ""));
      return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : "";
    } catch (_) { return ""; }
  };

  const getSession = () => {
    try { return JSON.parse(sessionStorage.getItem("layanSupabaseSession") || "null"); }
    catch (_) { return null; }
  };

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
    const categoryText = String(ad.category || "").toLowerCase();
    const businessText = String(ad.business_name || "").toLowerCase();
    // Use reliable photo URLs when an approved partner has not uploaded an image.
    const fallbackImage = /jotun|دهان|paint/.test(categoryText + " " + businessText)
      ? "https://images.pexels.com/photos/6474471/pexels-photo-6474471.jpeg?auto=compress&cs=tinysrgb&w=900"
      : /doctor|سيراميك|بورسلين|تشطيب|tile/.test(categoryText + " " + businessText)
        ? "https://images.pexels.com/photos/6585756/pexels-photo-6585756.jpeg?auto=compress&cs=tinysrgb&w=900"
        : "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=900";
    const image = safeUrl(ad.image_url) || fallbackImage;
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
    if (!grid || placing) return;
    placing = true;
    try {
      grid.querySelectorAll("[data-sponsor-card]").forEach(node => node.remove());
      const propertyCards = [...grid.querySelectorAll(".offer-card:not([data-sponsor-card])")];
      if (!ads.length) return;
      if (propertyCards.length < 3) {
        // Keep the starter/demo sponsor cards visible even when the marketplace has few property listings.
        ads.forEach(ad => grid.insertAdjacentHTML("beforeend", renderCard(ad)));
        return;
      }
      let adIndex = 0;
      // Insert one sponsored card after each group of three property cards.
      for (let i = 2; i < propertyCards.length && adIndex < ads.length; i += 3) {
        propertyCards[i].insertAdjacentHTML("afterend", renderCard(ads[adIndex++]));
      }
      // If there are more sponsor cards than placement slots, append the rest.
      while (adIndex < ads.length) grid.insertAdjacentHTML("beforeend", renderCard(ads[adIndex++]));
    } finally {
      placing = false;
    }
  }

  async function loadAds() {
    if (!base || !key) return;
    try {
      const rows = await api("supplier_ads?select=id,business_name,category,title,description,image_url,target_url,contact_phone&status=eq.active&order=created_at.desc&limit=12");
      const approvedAds = Array.isArray(rows) ? rows : [];
      // Only show real advertisements that have been approved by LAYAN administration.
      ads = approvedAds;
      placeAds();
    } catch (error) {
      console.warn("LAYAN sponsored ads:", error.message);
    }
  }

  if (grid) {
    new MutationObserver(records => {
      if (placing) return;
      // Ignore our own sponsor-card insertions/removals to avoid an observer loop.
      const changedPropertyContent = records.some(record =>
        [...record.addedNodes, ...record.removedNodes].some(node =>
          node.nodeType === 1 &&
          !node.matches?.("[data-sponsor-card]") &&
          !node.closest?.("[data-sponsor-card]")
        )
      );
      if (!changedPropertyContent) return;
      clearTimeout(placeTimer);
      placeTimer = setTimeout(placeAds, 120);
    }).observe(grid, { childList: true });
  }

  let dialog;
  function openForm() {
    const session = getSession();
    if (!session?.access_token || !session?.user?.id) {
      window.alert("سجّل الدخول إلى حساب ليان أولًا، ثم اطلب إعلانك الممول.");
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
    button.textContent = "سوّق منتجاتك لعملاء ليان";
    button.addEventListener("click", openForm);
    footer.appendChild(button);
  }
  document.querySelectorAll("[data-open-sponsor-form]").forEach(button => button.addEventListener("click", openForm));

  function buildForm() {
    dialog = document.createElement("dialog");
    dialog.className = "sponsor-dialog";
    dialog.innerHTML =
      '<div class="sponsor-dialog-head"><h2>اطلب إعلانًا مميزًا أو إعلان شركة</h2><button type="button" class="sponsor-close" aria-label="إغلاق">×</button></div>' +
      '<p class="sponsor-price-note">إرسال طلب الإعلان مجاني ولا يعني وجود التزام بالدفع. تحدد إدارة ليان المميزات والمدة والسعر النهائي بعد مراجعة النشاط والتواصل معك عبر واتساب. لا تُعرض أسعار الباقات على المنصة.</p>' +
      '<p>الإعلانات تظهر داخل قائمة العروض العقارية بعد موافقة الإدارة. أرسل بيانات نشاطك للمراجعة.</p>' +
      '<form class="sponsor-form">' +
      '<label>اسم النشاط<input name="business_name" required minlength="2" maxlength="120" autocomplete="organization"></label>' +
      '<label>مجال النشاط<select name="category" required><option value="">اختر المجال</option><option>مواد بناء</option><option>تشطيبات</option><option>سيراميك وبورسلين</option><option>دهانات</option><option>أبواب وشبابيك</option><option>مطابخ وأثاث</option><option>ستائر ومفروشات</option><option>أدوات صحية</option><option>كهرباء وسباكة</option><option>مقاولات</option><option>أخرى</option></select></label>' +
      '<label>عنوان الإعلان<input name="title" required minlength="3" maxlength="140"></label>' +
      '<label>وصف مختصر<textarea name="description" required minlength="5" maxlength="500" rows="3"></textarea></label>' +
      '<label>رابط صورة الإعلان (اختياري)<input name="image_url" type="url" maxlength="1000" placeholder="https://..."></label>' +
      '<label>رابط صفحة النشاط (اختياري)<input name="target_url" type="url" maxlength="1000" placeholder="https://..."></label>' +
      '<label>رقم التواصل<input name="contact_phone" required minlength="7" maxlength="30" type="tel" autocomplete="tel"></label>' +
      '<label>نوع الإعلان المطلوب<select name="plan_code" required><option value="starter_15">إعلان تجاري — مدة قصيرة</option><option value="growth_30">إعلان تجاري — مدة متوسطة</option><option value="partner_90">شراكة إعلانية — مدة ممتدة</option></select></label>' +
      '<p class="sponsor-plan-note">تفاصيل الباقات يتم إرسالها بعد التواصل مع الإدارة، حسب نوع النشاط ومدة الإعلان. لا يتم تحصيل أي مبلغ من خلال هذا النموذج.</p>' +
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
    const session = getSession();
    if (!session?.access_token || !session?.user?.id) {
      status.textContent = "انتهت جلسة الدخول. سجّل الدخول ثم أعد إرسال الطلب.";
      return;
    }
    const data = new FormData(form);
    const plan = String(data.get("plan_code") || "starter_15");
    const planDetails = {
      starter_15: { days: 15, price: 250 },
      growth_30: { days: 30, price: 450 },
      partner_90: { days: 90, price: 1200 }
    }[plan];
    if (!planDetails) {
      status.textContent = "اختر باقة صحيحة.";
      return;
    }
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
      requested_days: planDetails.days,
      requested_price: planDetails.price,
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
      const planNames = {
        starter_15: "باقة أساسية — 15 يومًا",
        growth_30: "باقة نمو — 30 يومًا",
        partner_90: "باقة شركاء — 90 يومًا"
      };
      const message = [
        "مرحبًا، أرسلت طلب إعلان إلى منصة LAYAN AQAR وأريد متابعة الطلب.",
        "اسم النشاط: " + businessName,
        "المجال: " + category,
        "عنوان الإعلان: " + title,
        "رقم التواصل: " + phone,
        "الباقة المطلوبة: " + (planNames[plan] || plan),
        "أرجو إرسال مميزات الإعلان والسعر النهائي والمدة المقترحة عبر واتساب قبل تأكيد أي اتفاق أو دفع."
      ].join("\n");
      const whatsappUrl = "https://wa.me/201007044265?text=" + encodeURIComponent(message);
      form.reset();
      status.innerHTML = "تم حفظ طلبك للمراجعة. تواصل مع إدارة ليان لمعرفة مميزات الإعلان والسعر النهائي قبل تأكيد الحجز. <a class=\\\"sponsor-whatsapp-followup\\\" href=\\\""+ whatsappUrl + "\\\" target=\\\"_blank\\\" rel=\\\"noopener noreferrer\\\">متابعة الطلب عبر واتساب</a>";
    } catch (error) {
      status.textContent = error.message || "تعذر إرسال الطلب. حاول مرة أخرى.";
    } finally {
      button.disabled = false;
    }
  }

  loadAds();
  window.addEventListener("focus", loadAds);
});
