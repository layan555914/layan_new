
document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  // Category cards filter offers by broad use, not by an exact property subtype.
  document.querySelectorAll(".category-tile[data-category-kind]").forEach((tile) => {
    tile.addEventListener("click", () => {
      activeKind = tile.dataset.categoryKind || "";
      const typeFilter = $("typeFilter");
      const areaFilter = $("areaFilter");
      if (typeFilter) typeFilter.value = "";
      if (areaFilter) areaFilter.value = "";
      $("searchInput") && ($("searchInput").value = "");
      document.querySelectorAll(".category-tile[data-category-kind]").forEach((item) => {
        item.classList.toggle("active", item === tile);
        item.setAttribute("aria-pressed", item === tile ? "true" : "false");
      });
      render();
      $("offers")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  const grid = $("offersGrid");
  const form = $("offerForm");
  const dialog = $("offerDialog");
  const statusBox = $("statusMessage");
  const formStatusBox = $("formStatusMessage");
  const photosInput = $("photosInput");
  // Live financial cross-check helps catch amount-entry mistakes before submission.
  const financeNote = document.createElement("p");
  financeNote.className = "layan-finance-check";
  financeNote.setAttribute("role", "status");
  financeNote.setAttribute("aria-live", "polite");
  const remainingField = form?.querySelector('[name="remaining_installments"]');
  remainingField?.closest("label")?.insertAdjacentElement("afterend", financeNote);
  const financeFields = ["total_price", "paid_amount", "remaining_installments"].map(name => form?.querySelector('[name="' + name + '"]')).filter(Boolean);
  const formatFinance = value => new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(value) + " جنيه";
  function updateFinanceCheck() {
    if (!financeNote || !form) return;
    const read = name => Number(form.querySelector('[name="' + name + '"]')?.value || 0);
    const total = read("total_price"), paid = read("paid_amount"), remaining = read("remaining_installments");
    const entered = paid + remaining;
    if (!total && !paid && !remaining) {
      financeNote.textContent = "أدخل إجمالي السعر والمبلغ المدفوع والمتبقي لمراجعة توافق الأرقام.";
      financeNote.dataset.state = "neutral";
      return;
    }
    const difference = total - entered;
    financeNote.textContent = "إجمالي السعر: " + formatFinance(total) + " · المدفوع والمتبقي: " + formatFinance(entered) +
      (difference > 0 ? " · فرق غير موزع: " + formatFinance(difference) :
       difference < 0 ? " · تنبيه: المدفوع والمتبقي يتجاوزان إجمالي السعر." : " · الأرقام متوافقة.");
    financeNote.dataset.state = difference < 0 ? "warning" : difference === 0 ? "ok" : "neutral";
  }
  financeFields.forEach(field => field.addEventListener("input", updateFinanceCheck));
  updateFinanceCheck();
  const photosPreview = document.createElement("div");
  photosPreview.className = "layan-photo-preview";
  photosPreview.setAttribute("aria-live", "polite");
  photosPreview.setAttribute("aria-label", "معاينة صور الوحدة المختارة");
  photosInput?.closest("label")?.appendChild(photosPreview);
  let previewObjectUrls = [];
  function clearPhotoPreview() {
    previewObjectUrls.forEach(url => URL.revokeObjectURL(url));
    previewObjectUrls = [];
    photosPreview.replaceChildren();
  }
  photosInput?.addEventListener("change", () => {
    photosInput.setCustomValidity("");
    clearPhotoPreview();
    const selected = Array.from(photosInput.files || []);
    if (!selected.length) return;
    const invalid = selected.find(file =>
      file.type !== "image/jpeg" || !/\.jpe?g$/i.test(file.name) || file.size > 5 * 1024 * 1024
    );
    if (invalid) {
      photosPreview.textContent = "الصورة غير صالحة: " + invalid.name + ". استخدم JPG أو JPEG وبحجم لا يتجاوز 5 ميجابايت للصورة.";
      photosInput.setCustomValidity("راجع صيغة الصور وحجمها قبل الإرسال.");
      return;
    }
    photosInput.setCustomValidity("");
    const totalBytes = selected.reduce((sum, file) => sum + file.size, 0);
    const heading = document.createElement("p");
    heading.className = "layan-photo-preview-title";
    heading.textContent = "معاينة الصور (" + selected.length + ") · الحجم الإجمالي " + (totalBytes / (1024 * 1024)).toFixed(2) + " ميجابايت";
    photosPreview.appendChild(heading);
    const grid = document.createElement("div");
    grid.className = "layan-photo-preview-grid";
    selected.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      previewObjectUrls.push(url);
      const figure = document.createElement("figure");
      const image = document.createElement("img");
      image.src = url;
      image.alt = "صورة الوحدة " + (index + 1);
      const caption = document.createElement("figcaption");
      caption.textContent = file.name;
      figure.append(image, caption);
      grid.appendChild(figure);
    });
    photosPreview.appendChild(grid);
  });
  const areaFilter = $("areaFilter");
  // Instagram does not accept a website URL as a direct feed-post share.
  // Open Instagram directly and copy the official LAYAN URL for pasting into a bio, story, or DM.
  const instagramShareLink = $("instagramShareLink");
  instagramShareLink?.addEventListener("click", async (event) => {
    event.preventDefault();
    const siteUrl = "https://layan-eg.com/";
    // Open on the direct tap to avoid mobile popup blockers.
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(siteUrl);
        alert("تم نسخ رابط ليان: " + siteUrl + "\nالصقه داخل إنستجرام في الرسالة أو النبذة أو القصة.");
      } else {
        window.prompt("انسخ رابط ليان والصقه في إنستجرام:", siteUrl);
      }
    } catch {
      window.prompt("انسخ رابط ليان والصقه في إنستجرام:", siteUrl);
    }
  });


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
        <button class="btn btn-outline-dark" id="forgotPasswordBtn" type="button">نسيت كلمة المرور؟</button>
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
    const forgotButton = authDialog.querySelector("#forgotPasswordBtn");
    const paintMode = () => {
      resendButton.hidden = true;
      title.textContent = mode === "login" ? "تسجيل الدخول إلى ليان" : "إنشاء حساب مجاني";
      submit.textContent = mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب";
      toggle.textContent = mode === "login" ? "ليس لديك حساب؟ أنشئ حسابًا" : "لديك حساب بالفعل؟ سجّل الدخول";
      password.autocomplete = mode === "login" ? "current-password" : "new-password";
      status.textContent = "";
    };
    toggle.addEventListener("click", () => { mode = mode === "login" ? "signup" : "login"; paintMode(); });
    forgotButton.addEventListener("click", async () => {
      const api = window.LAYAN_SUPABASE;
      const email = authDialog.querySelector("#authEmail").value.trim();
      if (!email) { status.textContent = "اكتب بريدك الإلكتروني أولًا، ثم اضغط نسيت كلمة المرور."; authDialog.querySelector("#authEmail").focus(); return; }
      if (!api?.resetPasswordForEmail) { status.textContent = "ميزة استعادة كلمة المرور غير جاهزة حاليًا."; return; }
      forgotButton.disabled = true; status.textContent = "جارٍ إرسال رابط استعادة كلمة المرور...";
      try { await api.resetPasswordForEmail(email); status.textContent = "لو البريد مسجل، هتوصلك رسالة استعادة. افتحها واضغط الرابط لتعيين كلمة مرور جديدة، وراجع الرسائل غير المرغوب فيها."; }
      catch (error) { status.textContent = friendlyAuthError(error.message); }
      finally { forgotButton.disabled = false; }
    });
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
      const email = authDialog.querySelector("#authEmail").value.trim().toLowerCase();
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
            status.textContent = "تم إنشاء الحساب بنجاح. افتح رسالة تأكيد البريد واضغط رابط التأكيد، ثم ارجع إلى منصة ليان وسجّل الدخول. لو لم تصلك الرسالة، راجع مجلد الرسائل غير المرغوب فيها أو اضغط «إعادة إرسال رسالة التأكيد».";
            resendButton.hidden = false;
          } else {
            status.textContent = "تم إنشاء الحساب وتسجيل الدخول.";
            updateAuthButton();
            window.setTimeout(() => { authDialog.close(); setStatus("أهلًا بك في ليان."); }, 450);
          }
        }
      } catch (error) {
        status.textContent = friendlyAuthError(error.message);
        if (/Email not confirmed/i.test(error.message || "")) {
          resendButton.hidden = false;
        }
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
    if (/captcha_failed|captcha protection|captcha_token/i.test(text)) return "التسجيل متوقف بسبب إعداد CAPTCHA في خدمة المصادقة. يجب ضبط إعداد CAPTCHA في لوحة Supabase؛ ليست المشكلة في البريد أو كلمة المرور.";
    if (/redirect.*(allow|url)|not allowed.*redirect|invalid.*redirect/i.test(text)) return "رابط العودة بعد تأكيد البريد غير مسموح به في إعدادات Supabase Auth. أضف رابط منصة LAYAN إلى قائمة Redirect URLs المسموح بها.";
    if (/rate limit|over_email_send_rate_limit/i.test(text)) return "تم تجاوز عدد محاولات الإرسال المسموح. انتظر قليلًا ثم حاول مرة أخرى.";
    if (/email_address_invalid|invalid email/i.test(text)) return "صيغة البريد الإلكتروني غير صحيحة. راجع كتابة البريد وحاول مرة أخرى.";
    if (/signup_disabled|signups not allowed/i.test(text)) return "إنشاء الحسابات متوقف حاليًا من إعدادات المنصة. يلزم تفعيل التسجيل في إعدادات Supabase Auth.";
    if (/user already registered/i.test(text)) return "هذا البريد مسجّل بالفعل. ارجع إلى تسجيل الدخول أو استخدم «نسيت كلمة المرور؟».";
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

  function categoryMatches(offer, category) {
    const normalize = (value) => String(value || "")
      .trim().toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/[\u064B-\u065F\u0670]/g, "");
    const text = normalize([
      offer.property_type, offer.title, offer.description
    ].filter(Boolean).join(" "));
    const has = (...words) => words.some((word) => text.includes(normalize(word)));
    if (category === "سكني") return has("سكن", "شقة", "شقق", "فيلا", "فلل", "دوبلكس", "استوديو", "تاون", "بنتهاوس", "residential");
    if (category === "تجاري") return has("تجار", "محل", "معرض", "مخزن", "مول", "كافيه", "مطعم", "مكتب تجاري", "commercial");
    if (category === "إداري") return has("اداري", "مكتب", "مقر", "مبني اداري", "office", "administrative");
    if (category === "طبي") return has("طبي", "عياده", "عيادات", "مركز طبي", "مستشفي", "medical", "clinic");
    return false;
  }


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
      city: row.city || "",
      area: row.area || "",
      area_m2: num(row.area_m2),
      bedrooms: num(row.bedrooms),
      bathrooms: num(row.bathrooms),
      monthly_installment: num(row.monthly_installment),
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
    const downPaymentMaxRaw = $("downPaymentMaxFilter")?.value ?? "";
    const monthlyMaxRaw = $("monthlyMaxFilter")?.value ?? "";
    const downPaymentMax = downPaymentMaxRaw.trim() === "" ? null : num(downPaymentMaxRaw);
    const monthlyMax = monthlyMaxRaw.trim() === "" ? null : num(monthlyMaxRaw);
    const sort = $("sortFilter")?.value || "newest";
    const companyQuery = ($("companySearchInput")?.value || "").trim().toLowerCase();

    const filtered = offers.filter((o) => {
      const text = [
        o.title, o.city, o.area, o.property_type,
        o.description, o.developer_name
      ].join(" ").toLowerCase();

      return (!search || text.includes(search)) &&
        (!companyQuery || String(o.developer_name || "").toLowerCase().includes(companyQuery)) &&
        (!type || o.property_type === type) &&
        (!area || o.area === area) &&
        (downPaymentMax === null || num(o.down_payment) <= downPaymentMax) &&
        (monthlyMax === null || (num(o.monthly_installment) > 0 && num(o.monthly_installment) <= monthlyMax)) &&
        (!activeKind || categoryMatches(o, activeKind));
    });

    filtered.sort((a, b) => {
      const aFeatured = a.is_featured && (!a.featured_until || new Date(a.featured_until) > new Date());
      const bFeatured = b.is_featured && (!b.featured_until || new Date(b.featured_until) > new Date());
      const featuredOrder = Number(bFeatured) - Number(aFeatured);
      if (featuredOrder) return featuredOrder;
      if (sort === "price-asc") return num(a.total_price) - num(b.total_price);
      if (sort === "price-desc") return num(b.total_price) - num(a.total_price);
      if (sort === "paid-asc") return num(a.paid_amount || a.down_payment) - num(b.paid_amount || b.down_payment);
      if (sort === "monthly-asc") {
        const av = num(a.monthly_installment), bv = num(b.monthly_installment);
        if (!av && bv) return 1;
        if (av && !bv) return -1;
        return av - bv;
      }
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    const resultsSummary = $("resultsSummary");
    if (resultsSummary) {
      const activeFilters = Boolean(search || companyQuery || type || area || downPaymentMaxRaw.trim() || monthlyMaxRaw.trim() || activeKind);
      resultsSummary.replaceChildren();
      const count = document.createElement("strong");
      count.textContent = String(filtered.length);
      const label = document.createElement("span");
      label.textContent = filtered.length === 1 ? "عرض متاح" : "عروض متاحة";
      const reset = $("resetFiltersBtn");
      if (reset) reset.hidden = !activeFilters;
      resultsSummary.append(count, label);
    }

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
            <p class="offer-location">${esc([o.city, o.area].filter(Boolean).join(" · ") || "أسيوط")}</p>
            ${(o.area_m2 || o.bedrooms || o.bathrooms) ? `<p class="offer-specs">${o.area_m2 ? `المساحة ${esc(o.area_m2)} م²` : ""}${o.bedrooms ? ` · غرف ${esc(o.bedrooms)}` : ""}${o.bathrooms ? ` · حمامات ${esc(o.bathrooms)}` : ""}</p>` : ""}
            <div class="offer-details">
              <div><span>السعر الإجمالي</span>
                <strong>${money(o.total_price)}</strong></div>
              <div><span>المقدم</span>
                <strong>${money(o.down_payment)}</strong></div>
              <div><span>المبلغ المدفوع</span>
                <strong>${money(o.paid_amount)}</strong></div>
              <div><span>المبلغ المتبقي</span>
                <strong>${money(o.remaining_amount)}</strong></div>
              ${o.monthly_installment ? `<div><span>القسط الشهري</span><strong>${money(o.monthly_installment)}</strong></div>` : ""}
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
    if (plan === "featured_15") note.textContent = 'السعر المستقبلي 100 جنيه لمدة 15 يومًا. التمييز والدفع غير مفعّلين خلال الشهر المجاني؛ لا تحوّل أي مبلغ قبل إعلان ليان رسميًا عن بدء الدفع.';
    else if (plan === "featured_30") note.textContent = 'السعر المستقبلي 200 جنيه لمدة 30 يومًا. التمييز والدفع غير مفعّلين خلال الشهر المجاني؛ لا تحوّل أي مبلغ قبل إعلان ليان رسميًا عن بدء الدفع.';
    else note.textContent = "الإعلان العادي مجاني للأفراد بعد مراجعة الإدارة. جميع المستخدمين يستفيدون من أول 30 يومًا مجانًا؛ لا توجد مدفوعات خلال الفترة التجريبية.";
  }

  function renderCompanies() {
    const companyGrid = $("companyGrid");
    if (!companyGrid) return;
    const query = ($("companySearchInput")?.value || "").trim().toLowerCase();
    const groups = new Map();

    offers.filter(o => o.developer_name && String(o.developer_name).trim()).forEach(o => {
      const name = String(o.developer_name).trim();
      // New company ads are grouped by their database ID; older listings remain discoverable by company name.
      const key = o.company_ad_id ? "ad:" + o.company_ad_id : "legacy:" + name.toLocaleLowerCase();
      if (!groups.has(key)) groups.set(key, {name, id: o.company_ad_id || null, properties: []});
      groups.get(key).properties.push(o);
    });

    const found = [...groups.values()].filter(c => !query || c.name.toLowerCase().includes(query));
    companyGrid.innerHTML = found.length ? found.map(c => {
      const propertyRows = c.properties.slice(0, 3).map(o => `
        <li class="company-property">
          <span class="company-property-type">${esc(o.property_type || "عقار")}</span>
          <strong>${esc(o.title || "عرض عقاري")}</strong>
          <span>${esc([o.city, o.area].filter(Boolean).join("، ") || "أسيوط")}</span>
          <b>${money(o.total_price)}</b>
        </li>`).join("");
      const countLabel = c.id
        ? `${c.properties.length} من 3 عقارات منشورة ضمن إعلان الشركة`
        : `${c.properties.length} عقار مرتبط باسم الشركة`;
      return `
        <article class="company-card">
          <div class="company-card-heading"><h3>${esc(c.name)}</h3><span class="company-count">${c.properties.length}/3</span></div>
          <p>${countLabel}</p>
          <ul class="company-property-list">${propertyRows}</ul>
          <button class="btn btn-outline-dark" type="button" data-company-name="${esc(c.name)}">عرض التفاصيل في قائمة العروض</button>
        </article>`;
    }).join("") : `<p class="company-empty">${query ? "لا توجد شركة بهذا الاسم ضمن العروض المنشورة حاليًا." : "ستظهر الشركات هنا بعد نشر عروضها وموافقة الإدارة."}</p>`;
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
      d.addEventListener("close", () => {
        const current = new URL(window.location.href);
        if (current.searchParams.has("offer")) {
          current.searchParams.delete("offer");
          window.history.replaceState({}, "", current.pathname + current.search + current.hash);
        }
      });
    }

    const content = $("detailsContent");
    const galleryImages = Array.isArray(o.image_urls) ? o.image_urls.filter(Boolean) : [];
    const galleryMarkup = galleryImages.length
      ? `
        <div class="details-gallery" aria-label="معرض صور الوحدة">
          <div class="details-gallery-main">
            <button type="button" class="gallery-arrow gallery-prev" aria-label="الصورة السابقة" ${galleryImages.length < 2 ? "hidden" : ""}>‹</button>
            <img id="detailsMainImage" class="details-image" src="${esc(galleryImages[0])}" alt="${esc(o.title)} — صورة 1">
            <button type="button" class="gallery-arrow gallery-next" aria-label="الصورة التالية" ${galleryImages.length < 2 ? "hidden" : ""}>›</button>
            <span class="gallery-counter" id="galleryCounter">1 / ${galleryImages.length}</span>
          </div>
          ${galleryImages.length > 1 ? `<div class="details-thumbnails">${galleryImages.map((url,index)=>`<button type="button" class="details-thumb ${index===0?"active":""}" data-gallery-index="${index}" aria-label="عرض الصورة ${index+1}" aria-pressed="${index===0?"true":"false"}"><img src="${esc(url)}" alt=""></button>`).join("")}</div>` : ""}
        </div>`
      : `<div class="offer-image offer-image-placeholder details-placeholder">LAYAN AQAR</div>`;

    content.innerHTML = `
      ${galleryMarkup}
      <span class="offer-type">${esc(o.property_type)}</span>
      <h2>${esc(o.title)}</h2>
      <p class="offer-code">كود الإعلان: <strong>${esc(offerCode(o))}</strong></p>
      <div class="details-price-highlight" aria-label="ملخص المبالغ">
        <div><span>المقدم المطلوب</span><strong>${money(o.down_payment)}</strong></div>
        <div><span>المتبقي</span><strong>${money(o.remaining_amount)}</strong></div>
      </div>
      <div class="details-info">
        <p><span>المدينة / المركز</span><strong>${esc(o.city || "أسيوط")}</strong></p>
        <p><span>المنطقة</span><strong>${esc(o.area || "غير محدد")}</strong></p>
        ${o.developer_name ? `<p><span>المطور العقاري</span><strong>${esc(o.developer_name)}</strong></p>` : ""}
        ${o.area_m2 ? `<p><span>المساحة</span><strong>${esc(o.area_m2)} م²</strong></p>` : ""}
        ${o.bedrooms ? `<p><span>غرف النوم</span><strong>${esc(o.bedrooms)}</strong></p>` : ""}
        ${o.bathrooms ? `<p><span>الحمامات</span><strong>${esc(o.bathrooms)}</strong></p>` : ""}
        <p><span>السعر الإجمالي</span><strong>${money(o.total_price)}</strong></p>
        <p><span>المقدم</span><strong>${money(o.down_payment)}</strong></p>
        <p><span>المبلغ المدفوع</span><strong>${money(o.paid_amount)}</strong></p>
        <p><span>المبلغ المتبقي</span><strong>${money(o.remaining_amount)}</strong></p>
        ${o.monthly_installment ? `<p><span>القسط الشهري</span><strong>${money(o.monthly_installment)}</strong></p>` : ""}
        <p><span>رسوم التنازل</span><strong>${money(o.assignment_fee)}</strong></p>
        ${o.discount_amount ? `<p><span>قيمة الخصم</span><strong>${money(o.discount_amount)}</strong></p>` : ""}
        ${o.discount_percent ? `<p><span>نسبة الخصم</span><strong>${esc(o.discount_percent)}٪</strong></p>` : ""}
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
      <div class="details-actions">
        <button type="button" class="btn btn-outline-dark" id="shareOfferBtn">مشاركة الإعلان</button>
        <a class="btn btn-outline-dark" id="reportOfferBtn" target="_blank" rel="noopener noreferrer"
          href="https://wa.me/201007044265?text=${encodeURIComponent("أرغب في الإبلاغ عن إعلان على LAYAN AQAR: " + o.title + " - كود الإعلان " + offerCode(o))}">الإبلاغ عن الإعلان</a>
      </div>
    `;

    if (galleryImages.length > 1) {
      let activeImage = 0;
      const mainImage = $("detailsMainImage");
      const counter = $("galleryCounter");
      const paintGallery = (nextIndex) => {
        activeImage = (nextIndex + galleryImages.length) % galleryImages.length;
        mainImage.src = galleryImages[activeImage];
        mainImage.alt = `${o.title} — صورة ${activeImage + 1}`;
        counter.textContent = `${activeImage + 1} / ${galleryImages.length}`;
        content.querySelectorAll("[data-gallery-index]").forEach((thumb) => {
          const active = Number(thumb.dataset.galleryIndex) === activeImage;
          thumb.classList.toggle("active", active);
          thumb.setAttribute("aria-pressed", active ? "true" : "false");
        });
      };
      content.querySelector(".gallery-prev")?.addEventListener("click", () => paintGallery(activeImage - 1));
      content.querySelector(".gallery-next")?.addEventListener("click", () => paintGallery(activeImage + 1));
      content.querySelectorAll("[data-gallery-index]").forEach((thumb) => {
        thumb.addEventListener("click", () => paintGallery(Number(thumb.dataset.galleryIndex)));
      });
    }

    const shareButton = $("shareOfferBtn");
    shareButton?.addEventListener("click", async () => {
      const shareUrl = new URL(window.location.href);
      if (o.id != null) shareUrl.searchParams.set("offer", String(o.id));
      else shareUrl.hash = "offers";
      const shareData = {title: "LAYAN AQAR | " + o.title, text: "إعلان عقاري على ليان: " + o.title + " — كود الإعلان " + offerCode(o), url: shareUrl.toString()};
      try {
        if (navigator.share) await navigator.share(shareData);
        else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareData.text + "\\n" + shareUrl.toString());
          setStatus("تم نسخ تفاصيل الإعلان ورابط ليان للمشاركة.");
        } else {
          window.prompt("انسخ تفاصيل الإعلان ورابط ليان:", shareData.text + "\\n" + shareUrl.toString());
        }
      } catch (error) {
        if (error?.name !== "AbortError") setStatus("تعذرت المشاركة تلقائيًا. يمكنك نسخ رابط ليان ومشاركة كود الإعلان: " + offerCode(o));
      }
    });

    if (!d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    }
  }


  const myOffersButton = $("loadMyOffersBtn");
  myOffersButton?.addEventListener("click", async () => {
    const status = $("myOffersStatus");
    const list = $("myOffersList");
    const api = window.LAYAN_SUPABASE;
    if (!api?.isAuthenticated?.()) {
      status.textContent = "سجّل الدخول أولًا لعرض إعلاناتك.";
      openAuth("login");
      return;
    }
    myOffersButton.disabled = true;
    status.textContent = "جارٍ تحميل عروضك...";
    list.replaceChildren();
    try {
      const offers = await api.getMyOffers();
      if (!offers.length) {
        status.textContent = "لا توجد عروض مرتبطة بحسابك حتى الآن. يمكنك إرسال عقارك من نموذج «اعرض وحدتك».";
        return;
      }
      const labels = {
        pending: "قيد المراجعة",
        available: "متاح للمهتمين",
        reserved: "محجوز",
        sold: "تم البيع"
      };
      const summary = document.createElement("div");
      summary.className = "my-offers-summary";
      summary.setAttribute("aria-label", "ملخص حالات عروضك");
      const counts = [
        ["pending", "قيد المراجعة"],
        ["available", "متاح"],
        ["reserved", "محجوز"],
        ["sold", "تم البيع"]
      ];
      counts.forEach(([key, label]) => {
        const item = document.createElement("div");
        item.className = "my-offers-summary-item";
        const count = document.createElement("strong");
        count.textContent = String(offers.filter(offer => offer.status === key).length);
        const caption = document.createElement("span");
        caption.textContent = label;
        item.append(count, caption);
        summary.appendChild(item);
      });
      list.appendChild(summary);
      offers.forEach(offer => {
        const card = document.createElement("article");
        card.className = "my-offer-card";
        const heading = document.createElement("h3");
        heading.textContent = offer.title || "عرض عقاري";
        const meta = document.createElement("p");
        meta.textContent = "رقم العرض: " + offer.id;
        const state = document.createElement("span");
        state.className = "my-offer-state";
        state.textContent = labels[offer.status] || "الحالة: " + (offer.status || "غير محددة");
        const date = document.createElement("small");
        const parsed = offer.created_at ? new Date(offer.created_at) : null;
        date.textContent = parsed && !Number.isNaN(parsed.getTime())
          ? "تاريخ الإرسال: " + parsed.toLocaleDateString("ar-EG")
          : "تاريخ الإرسال غير متاح";
        card.append(heading, meta, state, date);
        if (offer.status === "available") {
          const viewLink = document.createElement("a");
          viewLink.className = "my-offer-view-link";
          viewLink.href = "?offer=" + encodeURIComponent(String(offer.id)) + "#offers";
          viewLink.textContent = "فتح الإعلان المنشور";
          viewLink.setAttribute("aria-label", "فتح الإعلان المنشور: " + (offer.title || "عرض عقاري"));
          card.appendChild(viewLink);
        } else {
          const note = document.createElement("small");
          note.className = "my-offer-private-note";
          note.textContent = offer.status === "pending"
            ? "سيظهر رابط الإعلان بعد اعتماده ونشره."
            : "هذا الإعلان غير متاح حاليًا للعرض العام.";
          card.appendChild(note);
        }
        list.appendChild(card);
      });
      status.textContent = "تم تحميل " + offers.length + " من عروضك.";
    } catch (error) {
      console.error("تعذر تحميل عروض الحساب:", error);
      status.textContent = "تعذر تحميل عروضك حاليًا. " + (error.message || "حاول مرة أخرى.");
    } finally {
      myOffersButton.disabled = false;
    }
  });

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

  $("resetFiltersBtn")?.addEventListener("click", () => {
    ["searchInput", "typeFilter", "areaFilter", "downPaymentMaxFilter", "monthlyMaxFilter"].forEach(id => {
      const field = $(id);
      if (field) field.value = "";
    });
    if ($("sortFilter")) $("sortFilter").value = "newest";
    activeKind = "";
    document.querySelectorAll(".category-tile[data-category-kind]").forEach(tile => {
      tile.classList.remove("active");
      tile.setAttribute("aria-pressed", "false");
    });
    render();
  });
  $("searchInput")?.addEventListener("input", render);
  $("typeFilter")?.addEventListener("change", render);
  areaFilter?.addEventListener("change", render);
  $("sortFilter")?.addEventListener("change", render);
  $("downPaymentMaxFilter")?.addEventListener("input", render);
  $("monthlyMaxFilter")?.addEventListener("input", render);
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
      city: value("city"),
      area: value("area"),
      area_m2: amount("area_m2"),
      bedrooms: Math.floor(amount("bedrooms")),
      bathrooms: Math.floor(amount("bathrooms")),
      monthly_installment: amount("monthly_installment"),
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
    if (offer.remaining_amount < 0 || offer.remaining_amount > offer.total_price) {
      setStatus("المبلغ المتبقي يجب أن يكون بين صفر وإجمالي السعر.");
      return;
    }
    if (offer.paid_amount + offer.remaining_amount > offer.total_price + 0.01) {
      setStatus("مجموع المبلغ المدفوع والمتبقي أكبر من إجمالي السعر؛ راجع الأرقام قبل الإرسال.");
      return;
    }
    if (offer.discount_percent < 0 || offer.discount_percent > 100) {
      setStatus("نسبة الخصم يجب أن تكون بين 0 و100٪.");
      return;
    }
    if (offer.assignment_fee < 0 || offer.discount_amount < 0) {
      setStatus("رسوم التنازل والخصم لا يمكن أن تكون أرقامًا سالبة.");
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

      setStatus(selectedAccountType === "company" ? "جارٍ ربط العقار بإعلان الشركة والتحقق من حد 3 عقارات..." : "جارٍ حفظ العرض...");
      if (selectedAccountType === "company") {
        if (!api.getOrCreateCompanyAd) throw new Error("ميزة إعلانات الشركات غير جاهزة. حدّث الصفحة وحاول مرة أخرى.");
        offer.company_ad_id = await api.getOrCreateCompanyAd(offer.developer_name);
      }
      await api.createOffer(offer);

      form.reset();
      clearPhotoPreview();
      closeDialog();
      setStatus(offer.featured_requested
        ? "تم إرسال العرض وطلب الإعلان المميز للمراجعة. الدفع الإلكتروني غير مفعّل حاليًا؛ لا تحوّل أي مبلغ قبل إعلان وسيلة دفع رسمية من إدارة ليان. لن يظهر الإعلان كمميز إلا بعد تأكيد الدفع من الإدارة."
        : selectedAccountType === "company"
          ? "تم إرسال العقار للمراجعة وربطه بإعلان الشركة. يمكنك إضافة عقارين آخرين كحد أقصى إلى إعلان الشركة نفسه باستخدام اسم الشركة ذاته. قاعدة البيانات تمنع إضافة عقار رابع إلى الإعلان الواحد."
          : "تم إرسال العرض للمراجعة، وسيظهر بعد الموافقة.");
    } catch (error) {
      console.error("فشل حفظ العرض:", error);
      setStatus(error.message || "فشل الحفظ. راجع إعدادات Supabase.");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  async function loadPartnerAdSlots() {
    const section = $("partner-ads");
    const config = window.LAYAN_CONFIG || {};
    if (!section || !config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY) return;
    try {
      const base = config.SUPABASE_URL.replace(/\/$/, "");
      const response = await fetch(base + "/rest/v1/partner_ad_slots?select=slot_key,category,title,description,is_free_trial,status&status=eq.active&order=display_order.asc", {
        headers: { apikey: config.SUPABASE_PUBLISHABLE_KEY, Authorization: "Bearer " + config.SUPABASE_PUBLISHABLE_KEY }
      });
      if (!response.ok) throw new Error("تعذر تحميل مساحات الشركاء من قاعدة البيانات.");
      const rows = await response.json();
      const byKey = new Map((Array.isArray(rows) ? rows : []).map(row => [row.slot_key, row]));
      section.querySelectorAll("[data-partner-slot]").forEach(card => {
        const row = byKey.get(card.dataset.partnerSlot);
        if (!row) { card.hidden = true; return; }
        card.hidden = false;
        const category = card.querySelector(".partner-ad-category");
        const title = card.querySelector("h3");
        const description = card.querySelector(".partner-ad-content p");
        const note = card.querySelector(".partner-ad-content small");
        if (category) category.textContent = row.category || "";
        if (title) title.textContent = row.title || "";
        if (description) description.textContent = row.description || "";
        if (note) note.textContent = row.is_free_trial ? "مساحة مجانية طوال فترة التجربة — تُضاف بيانات النشاط بعد موافقة صاحبه." : "مساحة تجارية؛ راجع تفاصيل العرض مع المعلن.";
      });
      const visible = [...section.querySelectorAll("[data-partner-slot]")].some(card => !card.hidden);
      if (!visible) section.hidden = true;
    } catch (error) {
      console.warn("LAYAN partner ad slots:", error.message);
    }
  }

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

      const requestedOfferId = new URLSearchParams(window.location.search).get("offer");
      if (requestedOfferId) {
        const requestedOffer = offers.find(item => String(item.id) === requestedOfferId);
        if (requestedOffer) {
          showDetails(requestedOffer);
          setStatus("أنت تشاهد تفاصيل الإعلان المطلوب.");
        } else {
          setStatus("لم نعثر على هذا الإعلان؛ ربما لم يعد منشورًا.");
        }
      } else {
        setStatus(
          offers.length
            ? `تم تحميل ${offers.length} عرض.`
            : "لا توجد عروض منشورة حاليًا."
        );
      }
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
  await Promise.all([loadOffers(), loadPartnerAdSlots()]);
});
