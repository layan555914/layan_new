
document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const grid = $("offersGrid");
  const form = $("offerForm");
  const dialog = $("offerDialog");
  const statusBox = $("statusMessage");
  const formStatusBox = $("formStatusMessage");
  const photosInput = $("photosInput");
  const areaFilter = $("areaFilter");

  // Progressive Web App: install prompt and offline shell.
  let installPrompt = null;
  const installBanner = $("installAppBanner");
  const installButton = $("installAppBtn");
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("./sw.js").catch(error => console.warn("تعذر تسجيل وضع العمل دون اتصال:", error));
  }
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    if (!standalone && installBanner && !sessionStorage.getItem("layanInstallDismissed")) installBanner.hidden = false;
  });
  installButton?.addEventListener("click", async () => {
    if (!installPrompt) {
      setStatus("لو خيار التثبيت مش ظاهر، افتح قائمة المتصفح ثم اختر «إضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق».");
      return;
    }
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    if (installBanner) installBanner.hidden = true;
  });
  $("dismissInstallBtn")?.addEventListener("click", () => {
    if (installBanner) installBanner.hidden = true;
    sessionStorage.setItem("layanInstallDismissed", "1");
  });
  window.addEventListener("appinstalled", () => { if (installBanner) installBanner.hidden = true; });


  let authDialog;
  function ensureAuthDialog() {
    if (authDialog) return authDialog;
    authDialog = document.createElement("dialog");
    authDialog.id = "authDialog";
    authDialog.className = "details-dialog auth-dialog";
    authDialog.innerHTML = `
      <div class="details-dialog-header"><h2 id="authTitle">تسجيل الدخول إلى ليان</h2><button type="button" id="closeAuthDialog" aria-label="إغلاق">×</button></div>
      <p class="auth-intro">أنشئ حسابًا مجانيًا أو سجّل الدخول لإضافة عروضك ومتابعتها.</p>
      <form id="authForm" class="auth-form">
        <label>البريد الإلكتروني<input id="authEmail" type="email" autocomplete="email" required placeholder="name@example.com"></label>
        <label>كلمة المرور<input id="authPassword" type="password" autocomplete="current-password" minlength="6" required placeholder="6 أحرف على الأقل"></label>
        <p id="authStatus" role="status" aria-live="polite"></p>
        <button class="btn btn-outline-dark" id="resendConfirmationBtn" type="button" hidden>إعادة إرسال رسالة التأكيد</button>
        <button class="btn btn-gold" id="authSubmit" type="submit">تسجيل الدخول</button>
        <button class="btn btn-outline-dark" id="authToggle" type="button">إنشاء حساب جديد</button>
      </form>`;
    document.body.appendChild(authDialog);
    let mode = "login";
    const title = authDialog.querySelector("#authTitle");
    const submit = authDialog.querySelector("#authSubmit");
    const toggle = authDialog.querySelector("#authToggle");
    const password = authDialog.querySelector("#authPassword");
    const status = authDialog.querySelector("#authStatus");
    const resendButton = authDialog.querySelector("#resendConfirmationBtn");
    const paintMode = () => {
      resendButton.hidden = true;
      title.textContent = mode === "login" ? "تسجيل الدخول إلى ليان" : "إنشاء حساب مجاني";
      submit.textContent = mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب";
      toggle.textContent = mode === "login" ? "ليس لديك حساب؟ أنشئ حسابًا" : "لديك حساب بالفعل؟ سجّل الدخول";
      password.autocomplete = mode === "login" ? "current-password" : "new-password";
      status.textContent = "";
    };
    toggle.addEventListener("click", () => { mode = mode === "login" ? "signup" : "login"; paintMode(); });
    resendButton.addEventListener("click", async () => {
      const api = window.LAYAN_SUPABASE;
      const email = authDialog.querySelector("#authEmail").value.trim();
      if (!email) { status.textContent = "اكتب بريدك الإلكتروني أولًا."; return; }
      if (!api?.resendConfirmation) { status.textContent = "إعادة إرسال التأكيد غير متاحة حاليًا."; return; }
      resendButton.disabled = true;
      status.textContent = "جارٍ إرسال رسالة تأكيد جديدة...";
      try {
        await api.resendConfirmation(email);
        status.textContent = "طلبنا إرسال رسالة جديدة. راجع الوارد والرسائل غير المرغوب فيها.";
        resendButton.hidden = true;
      } catch (error) {
        status.textContent = friendlyAuthError(error.message);
        if (mode === "login" && /Email not confirmed/i.test(error.message || "")) {
          resendButton.hidden = false;
        }
      } finally {
        resendButton.disabled = false;
      }
    });
    authDialog.querySelector("#closeAuthDialog").addEventListener("click", () => authDialog.close());
    authDialog.addEventListener("click", event => { if (event.target === authDialog) authDialog.close(); });
    authDialog.querySelector("#authForm").addEventListener("submit", async event => {
      event.preventDefault();
      if (!event.currentTarget.reportValidity()) return;
      const api = window.LAYAN_SUPABASE;
      if (!api) { status.textContent = "الاتصال بقاعدة البيانات غير جاهز."; return; }
      const email = authDialog.querySelector("#authEmail").value.trim();
      const pass = password.value;
      submit.disabled = true;
      toggle.disabled = true;
      status.textContent = mode === "login" ? "جارٍ تسجيل الدخول..." : "جارٍ إنشاء الحساب...";
      try {
        if (mode === "login") {
          await api.signIn(email, pass);
          status.textContent = "تم تسجيل الدخول بنجاح.";
          updateAuthButton();
          window.setTimeout(() => { authDialog.close(); setStatus("أهلًا بك، يمكنك الآن إضافة عرضك."); }, 450);
        } else {
          const result = await api.signUp(email, pass);
          if (result.needsEmailConfirmation) {
            status.textContent = "تم إنشاء الحساب. افتح بريدك الإلكتروني وأكّد الحساب، ثم ارجع وسجّل الدخول.";
          } else {
            status.textContent = "تم إنشاء الحساب وتسجيل الدخول.";
            updateAuthButton();
            window.setTimeout(() => { authDialog.close(); setStatus("أهلًا بك في ليان."); }, 450);
          }
        }
      } catch (error) {
        status.textContent = friendlyAuthError(error.message);
      } finally {
        submit.disabled = false;
        toggle.disabled = false;
      }
    });
    authDialog.dataset.mode = "login";
    authDialog._setMode = value => { mode = value || "login"; paintMode(); };
    return authDialog;
  }
  function friendlyAuthError(message) {
    const text = String(message || "");
    if (/Invalid login credentials/i.test(text)) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    if (/already registered|User already registered/i.test(text)) return "هذا البريد مسجّل بالفعل. سجّل الدخول بدلًا من إنشاء حساب جديد.";
    if (/Password should be at least|weak password/i.test(text)) return "كلمة المرور ضعيفة؛ استخدم 6 أحرف على الأقل.";
    if (/Email not confirmed/i.test(text)) return "أكّد بريدك الإلكتروني من الرسالة التي وصلتك ثم سجّل الدخول.";
    if (/rate limit/i.test(text)) return "تمت محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.";
    return text.length < 220 ? text : "تعذر إتمام العملية. راجع البريد وكلمة المرور ثم حاول مجددًا.";
  }
  function updateAuthButton() {
    const button = $("loginBtn");
    const api = window.LAYAN_SUPABASE;
    if (!button || !api) return;
    const user = api.getUser();
    button.textContent = user ? "خروج (" + (user.email || "حسابي") + ")" : "تسجيل الدخول";
    button.title = user ? "اضغط لتسجيل الخروج" : "تسجيل الدخول أو إنشاء حساب";
  }
  window.addEventListener("layan:auth-ready", () => {
    updateAuthButton();
    setStatus("تم تأكيد بريدك الإلكتروني وتسجيل دخولك بنجاح. أهلًا بك في ليان.");
  });
  function openAuth(mode = "login") {
    const d = ensureAuthDialog();
    d._setMode(mode);
    if (!d.open) d.showModal();
  }

  let offers = [];
  let activeKind = "";
  let selectedAccountType = "individual";
  let selectedPromotionDuration = 15;
  const LAYAN_PHONE = "201007044265";

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const money = (v) =>
    num(v).toLocaleString("ar-EG", {
      maximumFractionDigits: 2
    }) + " ج.م";

  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);

  const offerCode = (offer) => {
    const id = String(offer?.id || "");
    return id
      ? "LAY-" + id.replace(/-/g, "").slice(0, 8).toUpperCase()
      : "قيد المراجعة";
  };

  function setStatus(message) {
    if (statusBox) statusBox.textContent = message;
    if (formStatusBox) formStatusBox.textContent = message;
  }

  function normalize(row = {}) {
    let images = row.image_urls || [];

    if (typeof images === "string") {
      try {
        images = JSON.parse(images);
      } catch {
        images = [];
      }
    }

    if (!Array.isArray(images)) images = [];
    const illustrativeImages = {
      "شقة سكنية عصرية": "assets/layan-property-9.svg",
      "شقة داخل كمبوند": "assets/layan-property-10.svg",
      "شقة فرصة للتنازل": "assets/layan-property-11.svg"
    };
    if (!images.length && illustrativeImages[row.title]) {
      images = [illustrativeImages[row.title]];
    }

    const paid = num(row.paid_amount);
    const discount = num(row.discount_amount);

    return {
      ...row,
      title: row.title || "عرض عقاري",
      area: row.area || "",
      property_type: row.property_type || "شقة",
      total_price: num(row.total_price),
      down_payment: num(row.down_payment),
      paid_amount: paid,
      remaining_amount: num(row.remaining_amount ?? row.remaining_installments),
      assignment_fee: num(row.assignment_fee ?? row.transfer_fee),
      assignment_fee_percentage: num(row.assignment_fee_percentage ?? row.transfer_fee_percentage),
      discount_amount: discount,
      description: row.description || "",
      developer_name: row.developer_name || "",
      image_urls: images.filter(
        (url) => typeof url === "string" && (/^https?:\/\//i.test(url) || /^assets\//i.test(url))
      ),
      status: row.status || "pending"
    };
  }

  function updateAreaFilter() {
    if (!areaFilter) return;

    const previous = areaFilter.value;
    const areas = [...new Set(
      offers.map((o) => o.area.trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "ar"));

    areaFilter.innerHTML =
      '<option value="">كل المناطق</option>' +
      areas.map((area) =>
        `<option value="${esc(area)}">${esc(area)}</option>`
      ).join("");

    if (areas.includes(previous)) areaFilter.value = previous;
  }

  function render() {
    if (!grid) {
      console.error("LAYAN: العنصر offersGrid غير موجود في index.html");
      return;
    }

    const search = ($("searchInput")?.value || "")
      .trim().toLowerCase();
    const type = $("typeFilter")?.value || "";
    const area = areaFilter?.value || "";
    const companyQuery = ($("companySearchInput")?.value || "").trim().toLowerCase();

    const filtered = offers.filter((o) => {
      const text = [
        o.title, o.area, o.property_type,
        o.description, o.developer_name
      ].join(" ").toLowerCase();

      return (!search || text.includes(search)) &&
        (!companyQuery || String(o.developer_name || "").toLowerCase().includes(companyQuery)) &&
        (!type || o.property_type === type) &&
        (!area || o.area === area) &&
        (!activeKind || o.property_type === activeKind);
    });

    filtered.sort((a, b) => {
      const aFeatured = a.is_featured && (!a.featured_until || new Date(a.featured_until) > new Date());
      const bFeatured = b.is_featured && (!b.featured_until || new Date(b.featured_until) > new Date());
      return Number(bFeatured) - Number(aFeatured) ||
        new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>لا توجد عروض منشورة حاليًا</h3>
          <p>يمكنك تعديل البحث أو العودة لاحقًا.</p>
        </div>`;
      return;
    }

    grid.innerHTML = filtered.map((o) => {
      const index = offers.indexOf(o);
      const image = o.image_urls[0];

      return `
        <article class="offer-card">
          ${
            image
              ? `<img class="offer-image"
                   src="${esc(image)}"
                   alt="${esc(o.title)}"
                   loading="lazy">`
              : `<div class="offer-image offer-image-placeholder">
                   LAYAN AQAR
                 </div>`
          }
          <div class="offer-card-content">
            ${o.is_featured && (!o.featured_until || new Date(o.featured_until) > new Date()) ? '<span class="featured-badge">★ عرض مميز</span>' : ''}
            <span class="offer-type">${esc(o.property_type)}</span>
            <p class="offer-code">كود الإعلان:
              <strong>${esc(offerCode(o))}</strong>
            </p>
            <h3>${esc(o.title)}</h3>
            <p>${esc(o.area || "أسيوط")}</p>
            <div class="offer-details">
              <div><span>السعر الإجمالي</span>
                <strong>${money(o.total_price)}</strong></div>
              <div><span>المقدم</span>
                <strong>${money(o.down_payment)}</strong></div>
              <div><span>المبلغ المدفوع</span>
                <strong>${money(o.paid_amount)}</strong></div>
              <div><span>المبلغ المتبقي</span>
                <strong>${money(o.remaining_amount)}</strong></div>
              <div><span>رسوم التنازل</span>
                <strong>${money(o.assignment_fee)}</strong></div>
            </div>
            <button type="button"
              class="details-button"
              data-offer-index="${index}">
              عرض التفاصيل
            </button>
          </div>
        </article>`;
    }).join("");
  }

  function updateAccountForm() {
    const select = $("accountTypeSelect");
    const companyField = $("companyNameField");
    const companyInput = $("companyNameInput");
    if (select) select.value = selectedAccountType;
    if (companyField) companyField.hidden = selectedAccountType !== "company";
    if (companyInput) {
      companyInput.required = selectedAccountType === "company";
      if (selectedAccountType !== "company") companyInput.value = "";
    }
  }

  function updatePromotionNote() {
    const plan = $("promotionPlanSelect")?.value || "standard";
    const note = $("promotionPlanNote");
    if (!note) return;
    if (plan === "featured_15") note.textContent = "السعر 100 جنيه لمدة 15 يومًا. لا تحوّل أي مبلغ الآن؛ سيتم الإعلان عن وسيلة التحصيل الرسمية بعد تجهيزها.";
    else if (plan === "featured_30") note.textContent = "السعر 200 جنيه لمدة 30 يومًا. لا تحوّل أي مبلغ الآن؛ التفعيل بعد مراجعة التحويل يدويًا.";
    else note.textContent = "الإعلان العادي مجاني. طلب التمييز لا يفعّل الإعلان تلقائيًا.";
  }

  function renderCompanies() {
    const companyGrid = $("companyGrid");
    if (!companyGrid) return;
    const query = ($("companySearchInput")?.value || "").trim().toLowerCase();
    const groups = new Map();
    offers.filter(o => o.developer_name && String(o.developer_name).trim()).forEach(o => {
      const name = String(o.developer_name).trim();
      const key = name.toLocaleLowerCase();
      if (!groups.has(key)) groups.set(key, {name, count:0});
      groups.get(key).count += 1;
    });
    const found = [...groups.values()].filter(c => !query || c.name.toLowerCase().includes(query));
    companyGrid.innerHTML = found.length ? found.map(c => `
      <article class="company-card"><h3>${esc(c.name)}</h3>
      <p>${c.count} إعلان منشور</p>
      <button class="btn btn-outline-dark" type="button" data-company-name="${esc(c.name)}">عرض عقارات الشركة</button></article>`
    ).join("") : `<p class="company-empty">${query ? "لا توجد شركة بهذا الاسم ضمن العروض المنشورة حاليًا." : "لا توجد أسماء شركات مرتبطة بعروض منشورة حتى الآن."}</p>`;
  }

  function openDialog() {
    updateAccountForm();
    updatePromotionNote();
    if (!dialog) {
      setStatus("نموذج الإضافة غير موجود في الصفحة.");
      return;
    }
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog() {
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
  }

  function showDetails(o) {
    let d = $("detailsDialog");

    if (!d) {
      d = document.createElement("dialog");
      d.id = "detailsDialog";
      d.className = "details-dialog";
      d.innerHTML = `
        <div class="details-dialog-header">
          <h2>تفاصيل الوحدة</h2>
          <button id="closeDetailsDialog" type="button" aria-label="إغلاق التفاصيل">×</button>
        </div>
        <div id="detailsContent"></div>`;
      document.body.appendChild(d);
      $("closeDetailsDialog").addEventListener("click", () => {
        if (typeof d.close === "function") d.close();
        else d.removeAttribute("open");
      });
      d.addEventListener("click", (event) => {
        if (event.target === d) {
          if (typeof d.close === "function") d.close();
          else d.removeAttribute("open");
        }
      });
    }

    const content = $("detailsContent");
    const images = o.image_urls.length
      ? o.image_urls.map((url) =>
          `<img class="details-image" src="${esc(url)}" alt="${esc(o.title)}">`
        ).join("")
      : `<div class="offer-image offer-image-placeholder details-placeholder">LAYAN AQAR</div>`;

    content.innerHTML = `
      ${images}
      <span class="offer-type">${esc(o.property_type)}</span>
      <h2>${esc(o.title)}</h2>
      <p class="offer-code">كود الإعلان: <strong>${esc(offerCode(o))}</strong></p>
      <div class="details-info">
        <p><span>المنطقة</span><strong>${esc(o.area || "أسيوط")}</strong></p>
        <p><span>السعر الإجمالي</span><strong>${money(o.total_price)}</strong></p>
        <p><span>المقدم</span><strong>${money(o.down_payment)}</strong></p>
        <p><span>المبلغ المدفوع</span><strong>${money(o.paid_amount)}</strong></p>
        <p><span>المبلغ المتبقي</span><strong>${money(o.remaining_amount)}</strong></p>
        <p><span>رسوم التنازل</span><strong>${money(o.assignment_fee)}</strong></p>
      </div>
      <p>${esc(o.description || "لا يوجد وصف إضافي.")}</p>
      <h3>تواصل مباشرة مع صاحب الإعلان</h3>
      <p>ليان منصة إعلانات فقط؛ التواصل والاتفاق يتمان مباشرة بين المعلن والمهتم بالعقار.</p>
      <div class="details-contact">
        ${o.contact_phone ? `<a class="btn btn-gold" href="tel:${esc(String(o.contact_phone).replace(/[^0-9+]/g, ""))}">اتصال بصاحب الإعلان</a>
        <a class="btn btn-dark" target="_blank" rel="noopener noreferrer"
          href="https://wa.me/${String(o.contact_phone).replace(/[^0-9]/g, "").replace(/^0/, "2")}?text=${encodeURIComponent("مرحبًا، أنا مهتم بإعلانك: " + o.title + " - كود " + offerCode(o) + "، من منصة LAYAN AQAR.")}">واتساب صاحب الإعلان</a>` : `<p class="details-warning">لم يضف صاحب الإعلان رقم تواصل؛ يمكنك الرجوع لاحقًا أو اختيار عرض آخر.</p>`}
      </div>
      <p class="details-warning">تحقق من العقد والمستندات وموافقة المطوّر قبل دفع أي مبلغ.</p>
    `;

    if (!d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    }
  }


  $("loginBtn")?.addEventListener("click", async () => {
    const api = window.LAYAN_SUPABASE;
    if (api?.isAuthenticated()) {
      if (!window.confirm("هل تريد تسجيل الخروج من حساب ليان؟")) return;
      try { await api.signOut(); updateAuthButton(); setStatus("تم تسجيل الخروج."); }
      catch (error) { setStatus(friendlyAuthError(error.message)); }
    } else openAuth("login");
  });
  function startAddOffer() {
    const api = window.LAYAN_SUPABASE;
    if (!api?.isAuthenticated()) { openAuth("login"); setStatus("سجّل الدخول أولًا، ثم أضف عرضك."); return; }
    selectedAccountType = selectedAccountType || "individual";
    openDialog();
  }
  $("addOfferTop")?.addEventListener("click", () => { selectedAccountType = "individual"; startAddOffer(); });
  $("addOfferBtn")?.addEventListener("click", () => { selectedAccountType = "individual"; startAddOffer(); });
  $("mobileAddOfferBtn")?.addEventListener("click", () => { selectedAccountType = "individual"; startAddOffer(); });
  document.querySelectorAll("[data-account-type]").forEach(button => {
    button.addEventListener("click", () => {
      selectedAccountType = button.dataset.accountType || "individual";
      const duration = Number(button.dataset.promotionDuration);
      if (duration === 15 || duration === 30) {
        selectedPromotionDuration = duration;
        const plan = $("promotionPlanSelect");
        if (plan) plan.value = duration === 15 ? "featured_15" : "featured_30";
      }
      startAddOffer();
    });
  });
  $("accountTypeSelect")?.addEventListener("change", event => {
    selectedAccountType = event.target.value;
    updateAccountForm();
  });
  $("promotionPlanSelect")?.addEventListener("change", updatePromotionNote);
  $("companySearchInput")?.addEventListener("input", renderCompanies);
  $("companySearchBtn")?.addEventListener("click", renderCompanies);
  $("companyGrid")?.addEventListener("click", event => {
    const button = event.target.closest("[data-company-name]");
    if (!button) return;
    const search = $("searchInput");
    if (search) search.value = button.dataset.companyName;
    const companySearch = $("companySearchInput");
    if (companySearch) companySearch.value = "";
    renderCompanies();
    render();
    $("offers")?.scrollIntoView({behavior:"smooth",block:"start"});
  });
  $("closeDialog")?.addEventListener("click", closeDialog);

  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });

  grid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-offer-index]");
    if (!button) return;

    const index = Number(button.dataset.offerIndex);
    if (Number.isInteger(index) && offers[index]) {
      showDetails(offers[index]);
    }
  });

  document.querySelectorAll("[data-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      activeKind = button.dataset.kind || "";
      document.querySelectorAll("[data-kind]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      render();
    });
  });

  $("searchInput")?.addEventListener("input", render);
  $("typeFilter")?.addEventListener("change", render);
  areaFilter?.addEventListener("change", render);
  $("searchBtn")?.addEventListener("click", render);

  const calcContract = $("calcContract");
  const calcPaid = $("calcPaid");
  const calcFees = $("calcFees");
  const formatCalc = (value) => num(value).toLocaleString("ar-EG", { maximumFractionDigits: 2 }) + " ج.م";
  function updateCalculator() {
    if (!calcContract || !calcPaid || !calcFees) return;
    const contract = num(calcContract.value);
    const paid = num(calcPaid.value);
    const fees = num(calcFees.value);
    const remaining = Math.max(0, contract - paid);
    $("calcRemaining").textContent = formatCalc(remaining);
    $("calcTotal").textContent = formatCalc(paid + fees);
    if (paid > contract && contract > 0) {
      $("calcRemaining").textContent = "راجع المبلغ المدفوع";
    }
  }
  [calcContract, calcPaid, calcFees].forEach((input) => input?.addEventListener("input", updateCalculator));
  updateCalculator();

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const value = (name) => String(data.get(name) || "").trim();
    const amount = (name) => num(data.get(name));

    const offer = {
      title: value("title"),
      governorate: "أسيوط",
      area: value("area"),
      property_type: value("property_type") || "شقة",
      description: value("description"),
      total_price: amount("total_price"),
      down_payment: amount("down_payment"),
      paid_amount: amount("paid_amount"),
      remaining_amount: amount("remaining_installments"),
      assignment_fee: amount("transfer_fee"),
      assignment_fee_percentage: 0,
      discount_amount: amount("discount_amount"),
      discount_percent: amount("discount_percent"),
      contact_name: value("contact_name"),
      developer_name: selectedAccountType === "company" ? value("developer_name") : "",
      contact_phone: value("contact_phone"),
      featured_requested: value("promotion_plan") === "featured_15" || value("promotion_plan") === "featured_30",
      promotion_status: (value("promotion_plan") === "featured_15" || value("promotion_plan") === "featured_30") ? "requested" : "none",
      is_featured: false,
      image_urls: []
    };

    if (selectedAccountType === "company" && !offer.developer_name) {
      setStatus("اكتب اسم الشركة العقارية.");
      return;
    }

    if (!offer.title) {
      setStatus("اكتب عنوان العرض أولًا.");
      return;
    }

    if (offer.total_price <= 0) {
      setStatus("اكتب إجمالي سعر صحيحًا أكبر من صفر.");
      return;
    }
    if (offer.down_payment < 0 || offer.down_payment > offer.total_price) {
      setStatus("المقدم يجب أن يكون بين صفر وإجمالي السعر.");
      return;
    }
    if (offer.paid_amount < 0 || offer.paid_amount > offer.total_price) {
      setStatus("المبلغ المدفوع يجب ألا يتجاوز إجمالي السعر.");
      return;
    }

    const files = Array.from(photosInput?.files || []);
    if (files.some((file) => file.type !== "image/jpeg" || !/\.jpe?g$/i.test(file.name))) {
      setStatus("لأمان المنصة، ارفع الصور بصيغة JPG أو JPEG فقط.");
      return;
    }
    if (files.some((file) => file.size > 5 * 1024 * 1024)) {
      setStatus("حجم الصورة الواحدة يجب ألا يتجاوز 5 ميجابايت.");
      return;
    }

    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const api = window.LAYAN_SUPABASE;
      if (!api?.createOffer) throw new Error("اتصال Supabase غير جاهز.");
      if (!api.isAuthenticated()) throw new Error("سجّل الدخول أو أنشئ حسابًا أولًا لإرسال عرضك.");

      if (files.length) {
        if (!api.uploadImages) throw new Error("رفع الصور غير مفعّل.");
        setStatus("جارٍ رفع الصور...");
        offer.image_urls = await api.uploadImages(files);
      }

      setStatus("جارٍ حفظ العرض...");
      await api.createOffer(offer);

      form.reset();
      closeDialog();
      setStatus(offer.featured_requested
        ? "تم إرسال العرض وطلب الإعلان المميز للمراجعة. الدفع الإلكتروني غير مفعّل حاليًا؛ لا تحوّل أي مبلغ قبل إعلان وسيلة دفع رسمية من إدارة ليان. لن يظهر الإعلان كمميز إلا بعد تأكيد الدفع من الإدارة."
        : "تم إرسال العرض للمراجعة، وسيظهر بعد الموافقة.");
    } catch (error) {
      console.error("فشل حفظ العرض:", error);
      setStatus(error.message || "فشل الحفظ. راجع إعدادات Supabase.");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  async function loadOffers() {
    setStatus("جارٍ تحميل العروض...");

    try {
      const api = window.LAYAN_SUPABASE;
      if (!api?.getOffers) {
        throw new Error("ملف Supabase غير جاهز أو لم يتم تحميله.");
      }

      const rows = await api.getOffers();
      if (!Array.isArray(rows)) {
        throw new Error("استجابة غير صحيحة من قاعدة البيانات.");
      }

      offers = rows.map(normalize);
      updateAreaFilter();
      renderCompanies();
      render();

      setStatus(
        offers.length
          ? `تم تحميل ${offers.length} عرض.`
          : "لا توجد عروض منشورة حاليًا."
      );
    } catch (error) {
      console.error("خطأ تحميل العروض:", error);
      offers = [];
      updateAreaFilter();
      renderCompanies();
      render();
      setStatus("تعذر تحميل العروض. راجع إعدادات الاتصال والصلاحيات.");
    }
  }

  window.addEventListener("layan-auth-callback", event => {
    if (event.detail?.success) {
      updateAuthButton();
      setStatus("تم تأكيد البريد الإلكتروني وتسجيل الدخول بنجاح. أهلًا بك في ليان.");
    } else if (event.detail?.message) {
      setStatus("تعذر إكمال تأكيد البريد. جرّب فتح رابط التأكيد مرة أخرى أو سجّل الدخول بعد التأكيد.");
      console.warn("LAYAN auth callback:", event.detail.message);
    }
  });
  updateAuthButton();
  await loadOffers();
});
