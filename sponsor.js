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
      const demoAds = [
        {
          id: "layan-demo-iereny",
          demo: true,
          business_name: "Original Iereny — إيريني الأصلي",
          category: "أثاث وموبيليا",
          title: "جهّز بيتك بعد استلام وحدتك",
          description: "نموذج تعريفي تجريبي لمعرض أثاث في أسيوط. هذا العرض غير رسمي ولا يعني وجود اتفاق أو موافقة من العلامة التجارية.",
          target_url: "https://www.originaliereny.com/",
          contact_phone: "01207180692"
        },
        {
          id: "layan-demo-aldoctor",
          demo: true,
          business_name: "AlDoctor Group — مجموعة الدكتور",
          category: "سيراميك وبورسلين وأدوات صحية",
          title: "أفكار لتشطيب وحدتك العقارية",
          description: "نموذج تعريفي تجريبي لخدمات السيراميك والتشطيبات في أسيوط. الإعلان غير رسمي لحين موافقة النشاط التجاري.",
          target_url: "https://aldoctorgroup.com/",
          contact_phone: "01226771010"
        },
        {
          id: "layan-demo-jotun",
          demo: true,
          business_name: "Jotun — جوتن",
          category: "دهانات وتشطيبات",
          title: "اختيارات ألوان وتشطيبات لمنزلك",
          description: "نموذج تجريبي للتعريف بعلامة الدهانات. ليس إعلانًا معتمدًا من جوتن؛ استخدم الدليل الرسمي للعثور على موزع.",
          target_url: "https://www.jotun.com/eg-en/industries/dealers/find-a-jotun-dealer",
          contact_phone: ""
        }
      ];
      // Real, approved ads take priority. Demo cards appear only when no approved ads are available.
      ads = approvedAds.length ? approvedAds : demoAds;
      placeAds();
    } catch (error) {
      console.warn("LAYAN sponsored ads:", error.message);
    }
  }

  if (grid) {
    new MutationObserver(() => {
      if (placing) return;
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

  function buildForm() {
    dialog = document.createElement("dialog");
    dialog.className = "sponsor-dialog";
    dialog.innerHTML =
      '<div class="sponsor-dialog-head"><h2>اطلب إعلانًا ممولًا</h2><button type="button" class="sponsor-close" aria-label="إغلاق">×</button></div>' +
      '<p class="sponsor-price-note">تجربة مجانية لمدة 30 يومًا تبدأ بعد موافقة الإدارة وتفعيل الإعلان، وليس بمجرد إرسال الطلب. بعد انتهاء التجربة، لا تُفرض رسوم إلا بعد موافقتك.</p>' +
      '<p>الإعلانات تظهر داخل قائمة العروض العقارية بعد موافقة الإدارة. أرسل بيانات نشاطك للمراجعة.</p>' +
      '<form class="sponsor-form">' +
      '<label>اسم النشاط<input name="business_name" required minlength="2" maxlength="120" autocomplete="organization"></label>' +
      '<label>مجال النشاط<select name="category" required><option value="">اختر المجال</option><option>مواد بناء</option><option>تشطيبات</option><option>سيراميك وبورسلين</option><option>دهانات</option><option>أبواب وشبابيك</option><option>مطابخ وأثاث</option><option>ستائر ومفروشات</option><option>أدوات صحية</option><option>كهرباء وسباكة</option><option>مقاولات</option><option>أخرى</option></select></label>' +
      '<label>عنوان الإعلان<input name="title" required minlength="3" maxlength="140"></label>' +
      '<label>وصف مختصر<textarea name="description" required minlength="5" maxlength="500" rows="3"></textarea></label>' +
      '<label>رابط صورة الإعلان (اختياري)<input name="image_url" type="url" maxlength="1000" placeholder="https://..."></label>' +
      '<label>رابط صفحة النشاط (اختياري)<input name="target_url" type="url" maxlength="1000" placeholder="https://..."></label>' +
      '<label>رقم التواصل<input name="contact_phone" required minlength="7" maxlength="30" type="tel" autocomplete="tel"></label>' +
      '<label>الباقة المطلوبة بعد الشهر المجاني<select name="plan_code" required><option value="trial_30">تجربة مجانية — 30 يومًا (0 جنيه)</option><option value="starter_15">15 يومًا — 250 جنيهًا (مقترح)</option><option value="growth_30">30 يومًا — 450 جنيهًا (مقترح)</option><option value="partner_90">90 يومًا — 1200 جنيه (مقترح)</option></select></label>' +
      '<p class="sponsor-plan-note">الأسعار مبدئية للتوضيح فقط، وليست طلب دفع. لن يتم الخصم أو تحصيل أي مبلغ تلقائيًا.</p>' +
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
      trial_30: { days: 30, price: 0 },
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
    status.textContent = plan === "trial_30" ? "جارٍ إرسال طلب التجربة المجانية للمراجعة..." : "جارٍ إرسال الطلب...";
    try {
      await api("supplier_ads", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(payload)
      });
      form.reset();
      status.textContent = "تم إرسال الطلب بنجاح للمراجعة. تبدأ التجربة المجانية لمدة 30 يومًا بعد موافقة الإدارة وتفعيل الإعلان. لن تُحصّل رسوم بعد التجربة دون موافقتك.";
    } catch (error) {
      status.textContent = error.message || "تعذر إرسال الطلب. حاول مرة أخرى.";
    } finally {
      button.disabled = false;
    }
  }

  loadAds();
  window.addEventListener("focus", loadAds);
});
