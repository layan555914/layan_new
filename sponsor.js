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
      const demoAds = [
        {
          id: "layan-demo-iereny",
          demo: true,
          business_name: "Original Iereny — إيريني الأصلي",
          image_url: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=80",
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
          image_url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80",
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
          image_url: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=900&q=80",
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

  function buildForm() {
    dialog = document.createElement("dialog");
    dialog.className = "sponsor-dialog";
    dialog.innerHTML =
      '<div class="sponsor-dialog-head"><h2>اطلب إعلانًا ممولًا</h2><button type="button" class="sponsor-close" aria-label="إغلاق">×</button></div>' +
      '<p class="sponsor-price-note">أول 30 يومًا من الإطلاق الرسمي مجانية لجميع المستخدمين: الأفراد والشركات العقارية وشركات التشطيب والديكور. الأسعار المدفوعة تبدأ بعد انتهاء الشهر المجاني والإعلان رسميًا عن تفعيل الدفع. إرسال الطلب لا يفرض أي رسوم.</p>' +
      '<p>الإعلانات تظهر داخل قائمة العروض العقارية بعد موافقة الإدارة. أرسل بيانات نشاطك للمراجعة.</p>' +
      '<form class="sponsor-form">' +
      '<label>اسم النشاط<input name="business_name" required minlength="2" maxlength="120" autocomplete="organization"></label>' +
      '<label>مجال النشاط<select name="category" required><option value="">اختر المجال</option><option>مواد بناء</option><option>تشطيبات</option><option>سيراميك وبورسلين</option><option>دهانات</option><option>أبواب وشبابيك</option><option>مطابخ وأثاث</option><option>ستائر ومفروشات</option><option>أدوات صحية</option><option>كهرباء وسباكة</option><option>مقاولات</option><option>أخرى</option></select></label>' +
      '<label>عنوان الإعلان<input name="title" required minlength="3" maxlength="140"></label>' +
      '<label>وصف مختصر<textarea name="description" required minlength="5" maxlength="500" rows="3"></textarea></label>' +
      '<label>رابط صورة الإعلان (اختياري)<input name="image_url" type="url" maxlength="1000" placeholder="https://..."></label>' +
      '<label>رابط صفحة النشاط (اختياري)<input name="target_url" type="url" maxlength="1000" placeholder="https://..."></label>' +
      '<label>رقم التواصل<input name="contact_phone" required minlength="7" maxlength="30" type="tel" autocomplete="tel"></label>' +
      '<label>الباقة المطلوبة بعد الشهر المجاني<select name="plan_code" required><option value="trial_30">الشهر الأول المجاني للجميع — 30 يومًا (0 جنيه)</option><option value="starter_15">بعد الشهر المجاني: الباقة الأساسية — 15 يومًا (250 جنيهًا)</option><option value="growth_30">بعد الشهر المجاني: باقة النمو — 30 يومًا (450 جنيهًا)</option><option value="partner_90">بعد الشهر المجاني: باقة الشركاء — 90 يومًا (1200 جنيه)</option></select></label>' +
      '<div class="sponsor-package-details"><strong>تفاصيل باقات الشركات العقارية بعد الشهر المجاني:</strong><ul><li>الأساسية — 250 جنيهًا / 15 يومًا: عرض حتى 3 عقارات في الإعلان الواحد مع بيانات الشركة ووسيلة التواصل.</li><li>النمو — 450 جنيهًا / 30 يومًا: عرض حتى 3 عقارات في الإعلان الواحد، ومدة أطول للتسويق ومتابعة اهتمام العملاء.</li><li>الشركاء — 1200 جنيه / 90 يومًا: عرض حتى 3 عقارات في الإعلان الواحد، مناسبة للتسويق المستمر لثلاثة أشهر.</li></ul><p>أول 30 يومًا من الإطلاق الرسمي مجانية للجميع، ولا يتم تحصيل أي رسوم خلالها.</p></div>' +
      '<p class="sponsor-plan-note">باقات الشركات العقارية تتيح عرض حتى 3 عقارات في الإعلان الواحد. الشهر الأول مجاني لجميع المستخدمين. الباقات المدفوعة تبدأ بعد انتهاء أول 30 يومًا من الإطلاق الرسمي، وبعد إعلان ليان عن تفعيل الدفع. لا تحوّل أي مبلغ خلال الفترة المجانية.</p>' +
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
      status.textContent = "تم إرسال طلب الإعلان للمراجعة. الشهر الأول مجاني لجميع المستخدمين. الباقات المدفوعة تبدأ بعد انتهاء أول 30 يومًا من الإطلاق الرسمي وإعلان ليان عن تفعيل الدفع؛ لا تحوّل أي مبلغ الآن.";
    } catch (error) {
      status.textContent = error.message || "تعذر إرسال الطلب. حاول مرة أخرى.";
    } finally {
      button.disabled = false;
    }
  }

  loadAds();
  window.addEventListener("focus", loadAds);
});
