
document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  // Strip campaign tags from outbound share links only; keep inbound analytics intact.
  const cleanShareUrl = value => {
    const url = new URL(String(value), window.location.href);
    for (const key of Array.from(url.searchParams.keys())) {
      if (/^utm_/i.test(key)) url.searchParams.delete(key);
    }
    return url.href;
  };

  const $ = (id) => document.getElementById(id);
  // The home page shows a short preview; any search there opens the full offers page with the same filters.
  const isHomePreview = document.body.classList.contains("page-home");
  const FILTER_PARAMS = [["q","searchInput"],["purpose","purposeFilter"],["type","typeFilter"],["city","cityFilter"],["area","areaFilter"],["max","totalPriceMaxFilter"],["down","downPaymentMaxFilter"],["monthly","monthlyMaxFilter"],["beds","minBedroomsFilter"],["sort","sortFilter"]];
  const showResults = () => {
    if (isHomePreview) {
      const params = new URLSearchParams();
      FILTER_PARAMS.forEach(([key, id]) => {
        const value = $(id)?.value;
        if (value && !(key === "sort" && value === "newest")) params.set(key, value);
      });
      if (activeKind) params.set("kind", activeKind);
      if (activeDealKind) params.set("deal", activeDealKind);
      const query = params.toString();
      window.location.href = "./offers.html" + (query ? "?" + query : "");
      return;
    }
    render();
    $("offers")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // "Posted today / 3 days ago" on listing cards (falls back to the old label).
  const postedAgo = value => {
    const time = new Date(value || "").getTime();
    if (!Number.isFinite(time)) return "إعلان منشور";
    const days = Math.floor((Date.now() - time) / 86400000);
    if (days <= 0) return "نُشر اليوم";
    if (days === 1) return "نُشر أمس";
    if (days === 2) return "نُشر منذ يومين";
    if (days <= 10) return "نُشر منذ " + days + " أيام";
    if (days < 30) return "نُشر منذ " + days + " يومًا";
    const months = Math.floor(days / 30);
    if (months === 1) return "نُشر منذ شهر";
    if (months === 2) return "نُشر منذ شهرين";
    if (months <= 10) return "نُشر منذ " + months + " أشهر";
    return "نُشر منذ أكثر من " + months + " شهرًا";
  };
  const trustBadge = row => row?.trust_badge === "owner"
    ? '<span class="trust-badge" title="تحققت الإدارة من ملكية المعلن">مالك موثّق</span>'
    : row?.trust_badge === "company" ? '<span class="trust-badge trust-badge-company" title="شركة تحققت منها الإدارة">شركة موثّقة</span>' : "";
  const applyUrlFilters = () => {
    const params = new URLSearchParams(window.location.search);
    // Area landing pages (areas/<slug>.html) preset their city.
    const preset = window.ASYUT_PRESET_FILTERS || {};
    FILTER_PARAMS.forEach(([key, id]) => {
      const value = params.get(key) ?? preset[key] ?? null;
      const field = $(id);
      if (value != null && field) field.value = value;
    });
    if (params.get("kind")) activeKind = params.get("kind");
    if (params.get("deal")) activeDealKind = params.get("deal");
  };
  // Category cards filter offers by broad use, not by an exact property subtype.
  document.querySelectorAll("[data-category-kind]").forEach((tile) => {
    tile.addEventListener("click", () => {
      activeKind = tile.dataset.categoryKind || "";
      activeDealKind = "";
      const typeFilter = $("typeFilter");
      const areaFilter = $("areaFilter");
      if (typeFilter) typeFilter.value = "";
      if (areaFilter) areaFilter.value = "";
      $("searchInput") && ($("searchInput").value = "");
      document.querySelectorAll("[data-category-kind]").forEach((item) => {
        item.classList.toggle("active", item === tile);
        item.setAttribute("aria-pressed", item === tile ? "true" : "false");
      });
      showResults();
    });
  });
  const grid = $("offersGrid");
  // Keep broken remote property photos from leaving empty or broken-image areas.
  document.addEventListener("error", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;
    if (image.classList.contains("details-thumb") || image.closest(".details-thumb")) {
      image.closest(".details-thumb")?.remove();
      return;
    }
    if (!image.classList.contains("offer-image") && !image.classList.contains("details-image")) return;
    const fallback = document.createElement("div");
    fallback.className = "offer-image offer-image-placeholder image-load-fallback";
    fallback.textContent = "ASYUT AQAR";
    fallback.setAttribute("role", "img");
    fallback.setAttribute("aria-label", "صورة العقار غير متاحة");
    image.replaceWith(fallback);
  }, true);
  const form = $("offerForm");
  const dialog = $("offerDialog");
  const statusBox = $("statusMessage");
  const formStatusBox = $("formStatusMessage");
  const photosInput = $("photosInput");
  const documentsInput = $("documentsInput");
  // Live financial cross-check helps catch amount-entry mistakes before submission.
  const financeNote = document.createElement("p");
  financeNote.className = "layan-finance-check";
  financeNote.setAttribute("role", "status");
  financeNote.setAttribute("aria-live", "polite");
  const remainingField = form?.querySelector('[name="remaining_installments"]');
  remainingField?.closest("label")?.insertAdjacentElement("afterend", financeNote);
  const priceOnRequestToggle = form?.querySelector('[name="price_on_request"]');
  const totalPriceInput = form?.querySelector('[name="total_price"]');
  const financeFields = ["total_price", "paid_amount", "remaining_installments"].map(name => form?.querySelector('[name="' + name + '"]')).filter(Boolean);
  const formatFinance = value => new Intl.NumberFormat("ar-EG-u-nu-latn", { maximumFractionDigits: 0 }).format(value) + " جنيه";
  function updateFinanceCheck() {
    if (!financeNote || !form) return;
    if (priceOnRequestToggle?.checked) {
      financeNote.textContent = "السعر عند التواصل؛ لن نعرض مبلغًا إجماليًا في الإعلان. يمكن توضيح تفاصيل الدفع في وصف الوحدة.";
      financeNote.dataset.state = "neutral";
      return;
    }
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
  function updatePriceRequestState() {
    const enabled = priceOnRequestToggle?.checked === true;
    if (totalPriceInput) {
      totalPriceInput.disabled = enabled;
      totalPriceInput.required = !enabled;
    }
    updateFinanceCheck();
  }
  financeFields.forEach(field => field.addEventListener("input", updateFinanceCheck));
  priceOnRequestToggle?.addEventListener("change", updatePriceRequestState);
  updatePriceRequestState();
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
      !(/^image\//i.test(file.type || "") || /\.(jpe?g|png|heic|heif|webp)$/i.test(file.name || "")) || file.size > 15 * 1024 * 1024
    );
    if (invalid) {
      photosPreview.textContent = "الصورة غير صالحة: " + invalid.name + ". اختر صورة (JPG أو PNG أو HEIC) بحجم لا يتجاوز 15 ميجابايت.";
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
  const cityFilter = $("cityFilter");
  // Instagram does not accept a website URL as a direct feed-post share.
  // Open Instagram directly and copy the official ASYUT AQAR URL for pasting into a bio, story, or DM.
  // Prefer the Android/iOS native share sheet so Facebook can open in its installed app.
  // This shares the ASYUT AQAR platform homepage, not an individual property listing.
  const facebookShareLink = document.querySelector(".social-facebook");
  facebookShareLink?.addEventListener("click", async (event) => {
    if (!navigator.share) return; // Keep the standard Facebook sharer as a fallback.
    event.preventDefault();
    try {
      await navigator.share({
        title: "ASYUT AQAR | أسيوط عقار",
        text: "اكتشف عروض التنازل العقاري على منصة أسيوط عقار",
        url: "https://www.asyutq.com/"
      });
    } catch (error) {
      if (error?.name !== "AbortError") {
        const shareUrl = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent("https://www.asyutq.com/");
        window.open(shareUrl, "_blank", "noopener,noreferrer");
      }
    }
  });
  const instagramShareLink = $("instagramShareLink");
  instagramShareLink?.addEventListener("click", async (event) => {
    event.preventDefault();
    const siteUrl = "https://www.asyutq.com/";
    // Open on the direct tap to avoid mobile popup blockers.
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(siteUrl);
        alert("تم نسخ رابط أسيوط عقار: " + siteUrl + "\nالصقه داخل إنستجرام في الرسالة أو النبذة أو القصة.");
      } else {
        window.prompt("انسخ رابط أسيوط عقار والصقه في إنستجرام:", siteUrl);
      }
    } catch {
      window.prompt("انسخ رابط أسيوط عقار والصقه في إنستجرام:", siteUrl);
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
      <div class="details-dialog-header auth-brand-head"><span class="auth-brand"><img src="./icon.svg" alt="" width="30" height="30">أسيوط عقار</span><button type="button" id="closeAuthDialog" aria-label="إغلاق">×</button></div>
      <h2 id="authTitle" class="auth-title">تسجيل الدخول إلى أسيوط عقار</h2>
      <p class="auth-intro" id="authIntro">سجّل الدخول لإضافة إعلاناتك ومتابعتها وحفظ العقارات.</p>
      <form id="authForm" class="auth-form">
        <fieldset class="auth-signup-only auth-account-types" hidden>
          <legend>نوع الحساب</legend>
          <label class="auth-type"><input type="radio" name="authAccountType" value="seeker"><span><i aria-hidden="true">⌕</i>باحث عن عقار</span></label>
          <label class="auth-type"><input type="radio" name="authAccountType" value="owner"><span><i aria-hidden="true">⌂</i>مالك عقار</span></label>
          <label class="auth-type"><input type="radio" name="authAccountType" value="broker"><span><i aria-hidden="true">☺</i>وسيط عقاري</span></label>
          <label class="auth-type"><input type="radio" name="authAccountType" value="company"><span><i aria-hidden="true">▦</i>شركة عقارية</span></label>
        </fieldset>
        <label class="auth-signup-only" hidden>الاسم الكامل<input id="authFullName" type="text" autocomplete="name" maxlength="80" placeholder="الاسم كما سيظهر للإدارة"></label>
        <label class="auth-signup-only" hidden>رقم الموبايل<span class="auth-phone"><span dir="ltr">+20</span><input id="authPhone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" maxlength="13" placeholder="01xxxxxxxxx"></span></label>
        <label>البريد الإلكتروني<input id="authEmail" type="email" autocomplete="email" required placeholder="name@example.com"></label>
        <label>كلمة المرور<span class="auth-password"><input id="authPassword" type="password" autocomplete="current-password" minlength="6" required placeholder="6 أحرف على الأقل"><button type="button" id="authShowPassword" aria-label="إظهار كلمة المرور" aria-pressed="false">👁</button></span></label>
        <label class="auth-signup-only auth-terms" hidden><input id="authTerms" type="checkbox"> أوافق على <a href="./terms.html" target="_blank" rel="noopener">الشروط</a> و<a href="./privacy.html" target="_blank" rel="noopener">سياسة الخصوصية</a></label>
        <p id="authStatus" role="status" aria-live="polite"></p>
        <button class="btn btn-outline-dark" id="resendConfirmationBtn" type="button" hidden>إعادة إرسال رسالة التأكيد</button>
        <button class="btn btn-outline-dark auth-forgot-password" id="forgotPasswordBtn" type="button" aria-label="استعادة كلمة المرور عبر البريد الإلكتروني">نسيت كلمة المرور؟</button>
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
    const signupOnly = [...authDialog.querySelectorAll(".auth-signup-only")];
    const fullName = authDialog.querySelector("#authFullName");
    const phone = authDialog.querySelector("#authPhone");
    const terms = authDialog.querySelector("#authTerms");
    const intro = authDialog.querySelector("#authIntro");
    authDialog.querySelector("#authShowPassword").addEventListener("click", event => {
      const show = password.type === "password";
      password.type = show ? "text" : "password";
      event.currentTarget.setAttribute("aria-pressed", String(show));
      event.currentTarget.setAttribute("aria-label", show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
    });
    const paintMode = () => {
      resendButton.hidden = true;
      forgotButton.hidden = mode !== "login";
      signupOnly.forEach(node => { node.hidden = mode !== "signup"; });
      fullName.required = phone.required = terms.required = mode === "signup";
      intro.textContent = mode === "login" ? "سجّل الدخول لإضافة إعلاناتك ومتابعتها وحفظ العقارات." : "ابدأ البحث عن عقار أو أضف إعلانك مجانًا. كل الحقول مطلوبة.";
      title.textContent = mode === "login" ? "تسجيل الدخول إلى أسيوط عقار" : "إنشاء حساب مجاني";
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
          window.dispatchEvent(new CustomEvent("layan-auth-state-changed", { detail: { authenticated: true } }));
          status.textContent = "تم تسجيل الدخول بنجاح.";
          updateAuthButton();
          window.setTimeout(() => { if (continueCompanyRegistration()) return; authDialog.close(); setStatus("أهلًا بك، يمكنك الآن إضافة عرضك."); }, 450);
        } else {
          const accountType = authDialog.querySelector('input[name="authAccountType"]:checked')?.value || "";
          const name = fullName.value.trim().replace(/\s+/g, " ");
          const mobile = phone.value.replace(/[^0-9]/g, "").replace(/^20/, "").replace(/^(?!0)/, "0");
          if (!accountType) throw new Error("اختر نوع الحساب.");
          if (name.length < 3) throw new Error("اكتب الاسم الكامل.");
          if (!/^01[0125][0-9]{8}$/.test(mobile)) throw new Error("اكتب رقم موبايل مصري صحيح مثل 01012345678.");
          if (!terms.checked) throw new Error("يلزم الموافقة على الشروط وسياسة الخصوصية.");
          const result = await api.signUp(email, pass, { full_name: name, phone: mobile, account_type: accountType });
          if (result.needsEmailConfirmation) {
            status.textContent = "تم إنشاء الحساب بنجاح. افتح رسالة تأكيد البريد واضغط رابط التأكيد، ثم ارجع إلى منصة أسيوط عقار وسجّل الدخول. لو لم تصلك الرسالة، راجع مجلد الرسائل غير المرغوب فيها أو اضغط «إعادة إرسال رسالة التأكيد».";
            resendButton.hidden = false;
          } else {
            status.textContent = "تم إنشاء الحساب وتسجيل الدخول.";
            updateAuthButton();
            window.dispatchEvent(new CustomEvent("layan-auth-state-changed", { detail: { authenticated: true } }));
            window.setTimeout(() => { if (continueCompanyRegistration()) return; authDialog.close(); setStatus("أهلًا بك في أسيوط عقار."); }, 450);
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
    if (/redirect.*(allow|url)|not allowed.*redirect|invalid.*redirect/i.test(text)) return "رابط العودة بعد تأكيد البريد غير مسموح به في إعدادات Supabase Auth. أضف رابط منصة أسيوط عقار إلى قائمة Redirect URLs المسموح بها.";
    if (/rate limit|over_email_send_rate_limit/i.test(text)) return "تم تجاوز عدد محاولات الإرسال المسموح. انتظر قليلًا ثم حاول مرة أخرى.";
    if (/email_address_invalid|invalid email/i.test(text)) return "صيغة البريد الإلكتروني غير صحيحة. راجع كتابة البريد وحاول مرة أخرى.";
    if (/signup_disabled|signups not allowed/i.test(text)) return "إنشاء الحسابات متوقف حاليًا من إعدادات المنصة. يلزم تفعيل التسجيل في إعدادات Supabase Auth.";
    if (/user already registered/i.test(text)) return "هذا البريد مسجّل بالفعل. ارجع إلى تسجيل الدخول أو استخدم «نسيت كلمة المرور؟».";
    return text.length < 220 ? text : "تعذر إتمام العملية. راجع البريد وكلمة المرور ثم حاول مجددًا.";
  }
  function updateAuthButton() {
    const button = $("loginBtn");
    const listingsLink = $("myListingsLink");
    const api = window.LAYAN_SUPABASE;
    if (!button || !api) return;
    const user = api.getUser();
    button.textContent = user ? "خروج (" + (user.email || "حسابي") + ")" : "تسجيل الدخول";
    button.title = user ? "اضغط لتسجيل الخروج" : "تسجيل الدخول أو إنشاء حساب";
    if (listingsLink) listingsLink.hidden = !user;
  }
  window.addEventListener("layan:auth-ready", () => {
    updateAuthButton();
    setStatus("تم تأكيد بريدك الإلكتروني وتسجيل دخولك بنجاح. أهلًا بك في أسيوط عقار.");
  });
  window.addEventListener("layan-auth-state-changed", updateAuthButton);
  function openAuth(mode = "login") {
    const d = ensureAuthDialog();
    d._setMode(mode);
    if (!d.open) d.showModal();
  }
  // Used by the mascot and by links like "./?auth=signup" from other pages.
  window.AsyutOpenAuth = mode => openAuth(mode === "signup" ? "signup" : "login");
  {
    const authParam = new URLSearchParams(window.location.search).get("auth");
    if (authParam === "login" || authParam === "signup") window.setTimeout(() => openAuth(authParam), 0);
  }

  function continueCompanyRegistration() {
    if (sessionStorage.getItem("layanCompanyRegistrationPending") !== "1") return false;
    sessionStorage.removeItem("layanCompanyRegistrationPending");
    window.location.href = "./companies.html?resumeCompanyRegistration=1";
    return true;
  }

  let offers = [];
  let activeKind = "";
  const OFFERS_PER_PAGE = 12;
  let offersPage = 1;
  const FAVORITES_KEY = "asyutAqarFavoriteOffers";
  let activeDealKind = "";
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
    if (category === "أراضي مطروحة للبناء") return has("أرض مطروحة للبناء", "أراضي مطروحة للبناء", "أرض بناء", "أراضي بناء");
    if (category === "أراضي التنازلات") return has("أرض تنازل", "أراضي التنازلات", "أرض للتنازل", "أراضي للتنازل");
    return false;
  }


  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const money = (v) =>
    num(v).toLocaleString("ar-EG-u-nu-latn", {
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
      ? "ASY-" + id.replace(/-/g, "").slice(0, 8).toUpperCase()
      : "قيد المراجعة";
  };

  function favoriteIds() { try { return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]").map(String)); } catch (_) { return new Set(); } }
  async function toggleFavorite(id) {
    const ids=favoriteIds(), key=String(id), wasSaved=ids.has(key);
    wasSaved ? ids.delete(key) : ids.add(key);
    try{localStorage.setItem(FAVORITES_KEY,JSON.stringify([...ids]));}catch(_){}
    render();
    const api=window.LAYAN_SUPABASE;
    if(api?.isAuthenticated?.()){
      try { wasSaved ? await api.removeFavoriteOffer(key) : await api.addFavoriteOffer(key); }
      catch(error){ console.warn("تعذر مزامنة المفضلة مع الحساب:",error); }
    }
  }
  const COMPARE_KEY = "asyutAqarCompareOffers";
  function compareIds() { try { const v=JSON.parse(localStorage.getItem(COMPARE_KEY)||"[]"); return Array.isArray(v)?[...new Set(v.map(String))].slice(0,3):[]; } catch (_) { return []; } }
  function updateCompareTray() {
    const tray=$("compareTray"), count=$("compareTrayCount"), open=$("openCompareBtn"); if(!tray||!count||!open)return;
    let ids=compareIds(); const availableIds=ids.filter(id=>offers.some(offer=>String(offer.id)===id)); if(availableIds.length!==ids.length){ids=availableIds;localStorage.setItem(COMPARE_KEY,JSON.stringify(ids));} tray.hidden=ids.length===0; count.textContent=ids.length+" من 3 عقارات محددة"; open.disabled=ids.length<2;
    document.querySelectorAll("[data-compare-id]").forEach(button=>{const yes=ids.includes(String(button.dataset.compareId));button.classList.toggle("is-compared",yes);button.setAttribute("aria-pressed",String(yes));button.textContent=yes?"✓ تمت الإضافة":"＋ قارن";});
  }
  function toggleCompare(id) {
    const key=String(id),ids=compareIds();
    if(ids.includes(key)) localStorage.setItem(COMPARE_KEY,JSON.stringify(ids.filter(x=>x!==key)));
    else { if(ids.length>=3){setStatus("يمكنك مقارنة 3 عقارات فقط. أزل أحد الاختيارات أولًا.");return;} localStorage.setItem(COMPARE_KEY,JSON.stringify([...ids,key]));setStatus("تمت إضافة العقار للمقارنة."); }
    updateCompareTray();
  }
  function compareValue(value,kind) {
    if(value===null||value===undefined||value==="")return "غير متاح";
    if(kind==="money")return Number(value)>0?money(value):"غير محدد";
    if(kind==="area")return Number(value)>0?Number(value).toLocaleString("ar-EG-u-nu-latn")+" م²":"غير متاح";
    if(kind==="count")return Number(value)>0?Number(value).toLocaleString("ar-EG-u-nu-latn"):"غير متاح";
    return esc(value);
  }
  function openPropertyComparison() {
    const selected=compareIds().map(id=>offers.find(o=>String(o.id)===id)).filter(Boolean); if(selected.length<2)return;
    const rows=[["نوع المعاملة",o=>compareValue(o.listing_purpose||"تنازل")],["نوع العقار",o=>compareValue(o.property_type)],["المدينة / المركز",o=>compareValue(o.city)],["الحي / المنطقة",o=>compareValue(o.area)],["السعر المعلن",o=>o.price_on_request ? "السعر عند التواصل" : compareValue(o.total_price,"money")],["المقدم",o=>compareValue(o.down_payment,"money")],["إجمالي المدفوع",o=>compareValue(o.paid_amount,"money")],["المبلغ المتبقي",o=>compareValue(o.remaining_amount,"money")],["القسط الشهري",o=>compareValue(o.monthly_installment,"money")],["رسوم التنازل",o=>compareValue(o.assignment_fee,"money")],["المساحة",o=>compareValue(o.area_m2,"area")],["غرف النوم",o=>compareValue(o.bedrooms,"count")],["الحمامات",o=>compareValue(o.bathrooms,"count")],["المطور / الشركة",o=>compareValue(o.developer_name)],["كود الإعلان",o=>compareValue(offerCode(o))]];
    const wrap=$("compareTableWrap"); if(!wrap)return;
    const head="<table class=compare-table><thead><tr><th>بيانات المقارنة</th>"+selected.map(o=>"<th><div class=compare-property-head><strong>"+esc(o.title)+"</strong><small>"+esc(offerCode(o))+"</small><button type=button data-remove-compare="+esc(o.id)+">إزالة</button></div></th>").join("")+"</tr></thead><tbody>";
    const body=rows.map(r=>"<tr><th scope=row>"+r[0]+"</th>"+selected.map(o=>"<td>"+r[1](o)+"</td>").join("")+"</tr>").join("");
    const tail="<tr><th>تفاصيل الإعلان</th>"+selected.map(o=>"<td><button type=button class=compare-details-btn data-open-compare-offer="+esc(o.id)+">عرض التفاصيل</button></td>").join("")+"</tr></tbody></table>";
    wrap.innerHTML=head+body+tail; const dialog=$("compareDialog"); if(dialog&&!dialog.open)dialog.showModal();
  }
  function renderPagination(total) { const box=$("offersPagination"); if(!box)return; const pages=Math.max(1,Math.ceil(total/OFFERS_PER_PAGE)); offersPage=Math.min(Math.max(1,offersPage),pages); box.hidden=total<=OFFERS_PER_PAGE; if(box.hidden){box.replaceChildren();return;} box.innerHTML='<button type="button" data-page-nav="prev" '+(offersPage===1?'disabled':'')+'>السابق</button><span>صفحة '+offersPage+' من '+pages+'</span><button type="button" data-page-nav="next" '+(offersPage===pages?'disabled':'')+'>التالي</button>'; }

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
      listing_purpose: row.listing_purpose || "تنازل",
      land_ownership_authority: row.land_ownership_authority || "",
      land_permit_details: row.land_permit_details || "",
      land_utilities: row.land_utilities || "",
      land_zoning: row.land_zoning || "",
      city: row.city || "",
      area: row.area || "",
      area_m2: num(row.area_m2),
      bedrooms: num(row.bedrooms),
      bathrooms: num(row.bathrooms),
      monthly_installment: num(row.monthly_installment),
      property_type: row.property_type || "شقة",
      price_on_request: row.price_on_request === true,
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
    const assiutCenters = ["مدينة أسيوط", "أسيوط الجديدة", "ديروط", "القوصية", "منفلوط", "أبنوب", "الفتح", "ساحل سليم", "البداري", "أبو تيج", "صدفا", "الغنايم"];
    if (cityFilter) {
      const previousCity = cityFilter.value;
      const cities = [...new Set([...assiutCenters, ...offers.map(o => String(o.city || "").trim()).filter(Boolean)])];
      cityFilter.innerHTML = '<option value="">كل مدن ومراكز أسيوط</option>' + cities.map(city => '<option value="' + esc(city) + '">' + esc(city) + '</option>').join("");
      if (cities.includes(previousCity)) cityFilter.value = previousCity;
    }
    if (areaFilter) {
      const previousArea = areaFilter.value;
      const areas = [...new Set(["الهضبة", ...offers.map(o => String(o.area || "").trim()).filter(Boolean)])].sort((a,b) => a.localeCompare(b,"ar"));
      areaFilter.innerHTML = '<option value="">كل الأحياء والمناطق</option>' + areas.map(area => '<option value="' + esc(area) + '">' + esc(area) + '</option>').join("");
      if (areas.includes(previousArea)) areaFilter.value = previousArea;
    }
    const areaHints = $("asyut-neighborhoods");
    if (areaHints) {
      const areas = [...new Set(["الهضبة", ...offers.map(o => String(o.area || "").trim()).filter(Boolean)])].sort((a,b) => a.localeCompare(b,"ar"));
      areaHints.innerHTML = areas.map(area => '<option value="' + esc(area) + '"></option>').join("");
    }
  }

  function render() {
    if (!grid) {
      console.error("ASYUT AQAR: العنصر offersGrid غير موجود في index.html");
      return;
    }

    const normalizeSearch = (value) => String(value || "")
      .trim().toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/^مدينه\s+/, "")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[ـ]/g, "")
      .replace(/\s+/g, " ");
    const search = normalizeSearch($("searchInput")?.value || "");
    const type = normalizeSearch($("typeFilter")?.value || "");
    const purpose = normalizeSearch($("purposeFilter")?.value || "");
    const city = normalizeSearch(cityFilter?.value || "");
    const area = normalizeSearch(areaFilter?.value || "");
    const totalPriceMaxRaw = $("totalPriceMaxFilter")?.value ?? "";
    const downPaymentMaxRaw = $("downPaymentMaxFilter")?.value ?? "";
    const monthlyMaxRaw = $("monthlyMaxFilter")?.value ?? "";
    const minBedroomsRaw = $("minBedroomsFilter")?.value ?? "";
    const dealKind = activeDealKind;
    const totalPriceMax = totalPriceMaxRaw.trim() === "" ? null : num(totalPriceMaxRaw);
    const downPaymentMax = downPaymentMaxRaw.trim() === "" ? null : num(downPaymentMaxRaw);
    const monthlyMax = monthlyMaxRaw.trim() === "" ? null : num(monthlyMaxRaw);
    const minBedrooms = minBedroomsRaw.trim() === "" ? null : num(minBedroomsRaw);
    const sort = $("sortFilter")?.value || "newest";
    const companyQuery = normalizeSearch($("companySearchInput")?.value || "");
    // Advertiser page (advertiser.html?id=<owner>) shows one advertiser's listings only.
    const ownerFilter = String(new URLSearchParams(window.location.search).get("id") || "").trim();
    const onAdvertiserPage = document.body.classList.contains("page-advertiser");

    const filtered = offers.filter((o) => {
      if (onAdvertiserPage && String(o.owner_id || "") !== ownerFilter) return false;
      const text = [
        o.title, o.city, o.area, o.property_type,
        o.description, o.developer_name
      ].join(" ");
      const normalizedText = normalizeSearch(text);

      return (!search || normalizedText.includes(search)) &&
        (!companyQuery || normalizeSearch(o.developer_name).includes(companyQuery)) &&
        (!type || normalizeSearch(o.property_type) === type) &&
        (!purpose || normalizeSearch(o.listing_purpose || "تنازل") === purpose) &&
        (!city || normalizeSearch(o.city) === city) &&
        (!area || normalizeSearch(o.area) === area) &&
        (totalPriceMax === null || (!o.price_on_request && num(o.total_price) <= totalPriceMax)) &&
        (downPaymentMax === null || num(o.down_payment) <= downPaymentMax) &&
        (monthlyMax === null || (num(o.monthly_installment) > 0 && num(o.monthly_installment) <= monthlyMax)) &&
        (minBedrooms === null || num(o.bedrooms) >= minBedrooms) &&
        (!activeKind || categoryMatches(o, activeKind)) && (!dealKind || normalizeSearch(o.listing_purpose || "تنازل") === normalizeSearch(dealKind));
    });

    window.LAYAN_FILTERED_PROPERTY_OFFERS = filtered;
    window.dispatchEvent(new CustomEvent("layan-offers-rendered", { detail: { offers: filtered } }));

    filtered.sort((a, b) => {
      const aFeatured = a.is_featured && (!a.featured_until || new Date(a.featured_until) > new Date());
      const bFeatured = b.is_featured && (!b.featured_until || new Date(b.featured_until) > new Date());
      const featuredOrder = Number(bFeatured) - Number(aFeatured);
      if (featuredOrder) return featuredOrder;
      if (sort === "price-asc" || sort === "price-desc") {
        const aUnknownPrice = a.price_on_request || num(a.total_price) <= 1;
        const bUnknownPrice = b.price_on_request || num(b.total_price) <= 1;
        if (aUnknownPrice !== bUnknownPrice) return aUnknownPrice ? 1 : -1;
        const difference = num(a.total_price) - num(b.total_price);
        return sort === "price-asc" ? difference : -difference;
      }
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
      const activeFilters = Boolean(search || companyQuery || type || purpose || city || area || totalPriceMaxRaw.trim() || downPaymentMaxRaw.trim() || monthlyMaxRaw.trim() || minBedroomsRaw.trim() || activeKind || activeDealKind);
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
      renderPagination(0);
      grid.innerHTML = `
        <div class="empty-state">
          <h3>لا توجد عروض منشورة حاليًا</h3>
          <p>يمكنك تعديل البحث أو العودة لاحقًا.</p>
        </div>`;
      return;
    }

    const pages=Math.max(1,Math.ceil(filtered.length/OFFERS_PER_PAGE));
    offersPage=Math.min(Math.max(1,offersPage),pages);
    const pageRows=filtered.slice((offersPage-1)*OFFERS_PER_PAGE,offersPage*OFFERS_PER_PAGE);
    renderPagination(filtered.length);
    const favorites=favoriteIds();
    updateCompareTray();
    grid.innerHTML = pageRows.map((o) => {
      const image = o.image_urls[0];
      const favorite = favorites.has(String(o.id));
      const isAssignment = String(o.listing_purpose || "تنازل").includes("تنازل");
      const isFeatured = o.is_featured && (!o.featured_until || new Date(o.featured_until) > new Date());
      const photoCount = o.image_urls.length;
      const priceLabel = String(o.listing_purpose || "").includes("إيجار") ? "قيمة الإيجار المعلنة" : "السعر المعلن";

      const purposeText = String(o.listing_purpose || "تنازل");
      const typeText = String(o.property_type || "عقار");
      const dealLabel = /تنازل/.test(typeText) ? typeText
        : purposeText.includes("إيجار") ? typeText + " للإيجار"
        : purposeText.includes("تنازل") ? typeText + " للتنازل"
        : typeText + " للبيع";
      const isRent = purposeText.includes("إيجار");
      const advertiser = String(o.contact_name || o.developer_name || "").trim() || "معلن على أسيوط عقار";
      const isCompany = Boolean(o.company_ad_id || o.trust_badge === "company" || /شركة|مكتب|للتطوير|العقارية/.test(advertiser));
      const initial = advertiser.replace(/^(ال)/, "").trim().charAt(0) || "أ";
      const specs = [o.area_m2 ? `${esc(o.area_m2)} م²` : "", o.bedrooms ? `${esc(o.bedrooms)} ${Number(o.bedrooms) === 2 ? "غرفتان" : "غرف"}` : "", o.bathrooms ? `${esc(o.bathrooms)} حمام` : ""].filter(Boolean);
      const money2 = value => num(value) > 1 ? Math.round(num(value)).toLocaleString("en-US") + " ج.م" : "السعر غير معلن";
      const finance = [
        num(o.down_payment) > 0 ? `<span>مقدم <b>${money2(o.down_payment)}</b></span>` : "",
        num(o.remaining_amount) > 0 ? `<span>متبقي <b>${money2(o.remaining_amount)}</b></span>` : "",
        num(o.monthly_installment) > 0 ? `<span>قسط <b>${money2(o.monthly_installment)}</b>/شهر</span>` : "",
        isAssignment && num(o.assignment_fee) > 0 ? `<span>رسوم التنازل <b>${money2(o.assignment_fee)}</b></span>` : ""
      ].filter(Boolean);
      const detailsHref = "./property.html?id=" + encodeURIComponent(String(o.id));
      const advertiserHref = o.owner_id ? "./advertiser.html?id=" + encodeURIComponent(String(o.owner_id)) : "";

      return `
        <article class="offer-card listing-card${isFeatured ? " is-featured" : ""}" data-listing-id="${esc(o.id)}">
          <div class="offer-card-media">
            <a href="${detailsHref}" class="offer-media-link" tabindex="-1" aria-hidden="true">${
              image
                ? `<img class="offer-image" src="${esc(image)}" alt="${esc(o.title)}" loading="lazy" decoding="async">`
                : `<div class="offer-image offer-image-placeholder"><span>ASYUT AQAR</span><small>لا توجد صور بعد</small></div>`
            }</a>
            <span class="listing-deal-label">${esc(dealLabel)}</span>
            ${isFeatured ? '<span class="listing-featured">★ مميز</span>' : ""}
            <button type="button" class="favorite-button listing-heart ${favorite ? "is-favorite" : ""}" data-favorite-id="${esc(o.id)}" aria-pressed="${favorite}" aria-label="${favorite ? "إزالة من المفضلة" : "حفظ في المفضلة"}">${favorite ? "♥" : "♡"}</button>
            ${photoCount > 1 ? `<span class="offer-photo-count">▧ ${photoCount}</span>` : ""}
            <button type="button" class="compare-card-button listing-compare" data-compare-id="${esc(o.id)}" aria-pressed="false" title="أضف للمقارنة">＋ قارن</button>
          </div>
          <div class="offer-card-content">
            <div class="listing-head">
              <h3><a href="${detailsHref}">${esc(o.title)}</a></h3>
              <strong class="listing-price">${o.price_on_request ? "السعر عند التواصل" : money2(o.total_price)}${!o.price_on_request && isRent ? " / شهر" : ""}</strong>
            </div>
            <p class="offer-location"><span aria-hidden="true">⌖</span> ${esc([o.city, o.area].filter(Boolean).join("، ") || "أسيوط")}</p>
            ${specs.length ? `<p class="listing-specs">${specs.join(" <i>•</i> ")}</p>` : ""}
            ${finance.length ? `<p class="listing-finance">${finance.join("")}</p>` : ""}
            <p class="listing-meta"><span>${esc(offerCode(o))}</span><span>${postedAgo(o.created_at)}</span>${trustBadge(o)}</p>
            <div class="listing-footer">
              <div class="listing-advertiser">
                <span class="listing-avatar${isCompany ? " is-company" : ""}" aria-hidden="true">${isCompany ? "▦" : esc(initial)}</span>
                <div><b>${esc(advertiser)}</b>${advertiserHref ? `<a href="${advertiserHref}">كل إعلانات المعلن</a>` : ""}</div>
              </div>
              <div class="listing-actions">
                <a class="details-button" href="${detailsHref}">عرض التفاصيل</a>
              </div>
            </div>
          </div>
        </article>`;
    }).join("");
    updateCompareTray();
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
    const contact = '<a href="https://wa.me/201007044265?text=%D8%A3%D8%B1%D8%BA%D8%A8%20%D9%81%D9%8A%20%D9%85%D8%B9%D8%B1%D9%81%D8%A9%20%D8%AA%D9%81%D8%A7%D8%B5%D9%8A%D9%84%20%D9%88%D8%B3%D8%B9%D8%B1%20%D8%A5%D8%B9%D9%84%D8%A7%D9%86%20%D8%A3%D8%B3%D9%8A%D9%88%D8%B7%20%D8%B9%D9%82%D8%A7%D8%B1" target="_blank" rel="noopener noreferrer">اسأل إدارة أسيوط عقار عبر واتساب</a>';
    if (plan === "featured_15" || plan === "featured_30") note.innerHTML = "طلب التمييز اختياري. المميزات والمدة والسعر النهائي يتم تأكيدها عبر واتساب قبل أي اتفاق. " + contact;
    else note.innerHTML = "الإعلان العقاري العادي مجاني دائمًا، ولا توجد عمولة لأسيوط عقار على البيع أو التنازل. " + contact;
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
      const propertyRows = c.properties.slice(0, 6).map(o => `
        <li class="company-property">
          <span class="company-property-type">${esc(o.property_type || "عقار")}</span>
          <strong>${esc(o.title || "عرض عقاري")}</strong>
          <span>${esc([o.city, o.area].filter(Boolean).join("، ") || "أسيوط")}</span>
          <b>${o.price_on_request ? "السعر عند التواصل" : money(o.total_price)}</b>
        </li>`).join("");
      const countLabel = c.id
        ? `${c.properties.length} عقار منشور ضمن إعلان الشركة`
        : `${c.properties.length} عقار مرتبط باسم الشركة`;
      return `
        <article class="company-card">
          <div class="company-card-heading"><h3>${esc(c.name)}</h3><span class="company-count">${c.properties.length}</span></div>
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
      : `<div class="offer-image offer-image-placeholder details-placeholder">ASYUT AQAR</div>`;

    content.innerHTML = `
      ${galleryMarkup}
      <span class="offer-type">${esc(o.property_type)}</span>
      <h2>${esc(o.title)}</h2>
      <p class="offer-code">كود الإعلان: <strong>${esc(offerCode(o))}</strong></p>
      <div class="details-price-highlight" aria-label="ملخص المبالغ">
        <div><span>المقدم المدفوع</span><strong>${money(o.down_payment)}</strong></div>
        <div><span>المتبقي</span><strong>${money(o.remaining_amount)}</strong></div>
      </div>
      <div class="details-info">
        <p><span>المدينة / المركز</span><strong>${esc(o.city || "أسيوط")}</strong></p>
        <p><span>المنطقة</span><strong>${esc(o.area || "غير محدد")}</strong></p>
        ${o.latitude != null && o.longitude != null ? `<p><span>موقع العقار</span><strong><a href="https://www.google.com/maps?q=${encodeURIComponent(Number(o.latitude)+","+Number(o.longitude))}" target="_blank" rel="noopener noreferrer">فتح الموقع على الخريطة</a></strong></p>` : ""}
        ${o.developer_name ? `<p><span>المطور العقاري</span><strong>${esc(o.developer_name)}</strong></p>` : ""}
        ${o.project_name ? `<p><span>المشروع / الكمبوند</span><strong>${esc(o.project_name)}</strong></p>` : ""}
        ${o.land_ownership_authority ? `<p><span>جهة الولاية / التخصيص</span><strong>${esc(o.land_ownership_authority)}</strong></p>` : ""}
        ${o.land_permit_details ? `<p><span>اشتراطات البناء</span><strong>${esc(o.land_permit_details)}</strong></p>` : ""}
        ${o.land_utilities ? `<p><span>المرافق</span><strong>${esc(o.land_utilities)}</strong></p>` : ""}
        ${o.land_zoning ? `<p><span>استخدام الأرض</span><strong>${esc(o.land_zoning)}</strong></p>` : ""}
        ${o.area_m2 ? `<p><span>المساحة</span><strong>${esc(o.area_m2)} م²</strong></p>` : ""}
        ${o.bedrooms ? `<p><span>غرف النوم</span><strong>${esc(o.bedrooms)}</strong></p>` : ""}
        ${o.bathrooms ? `<p><span>الحمامات</span><strong>${esc(o.bathrooms)}</strong></p>` : ""}
        <p><span>السعر الإجمالي</span><strong>${o.price_on_request ? "السعر عند التواصل" : money(o.total_price)}</strong></p>
        <p><span>المقدم المدفوع عند التعاقد</span><strong>${money(o.down_payment)}</strong></p>
        <p><span>إجمالي المدفوع حتى الآن (شامل المقدم)</span><strong>${money(o.paid_amount)}</strong></p>
        <p><span>المبلغ المتبقي</span><strong>${money(o.remaining_amount)}</strong></p>
        ${o.monthly_installment ? `<p><span>القسط الشهري</span><strong>${money(o.monthly_installment)}</strong></p>` : ""}
        ${o.listing_purpose === "تنازل" ? `<p><span>رسوم التنازل</span><strong>${money(o.assignment_fee)}</strong></p>` : ""}
        ${o.discount_amount ? `<p><span>قيمة الخصم</span><strong>${money(o.discount_amount)}</strong></p>` : ""}
        ${o.discount_percent ? `<p><span>نسبة الخصم</span><strong>${esc(o.discount_percent)}٪</strong></p>` : ""}
      </div>
      <p>${esc(o.description || "لا يوجد وصف إضافي.")}</p>
      <h3>تواصل مباشرة مع صاحب الإعلان</h3>
      <p>أسيوط عقار منصة إعلانات فقط؛ التواصل والاتفاق يتمان مباشرة بين المعلن والمهتم بالعقار.</p>
      <div class="details-contact">
        ${o.contact_phone ? `<a class="btn btn-gold" href="tel:${esc(String(o.contact_phone).replace(/[^0-9+]/g, ""))}">اتصال بصاحب الإعلان</a>
        <a class="btn btn-dark" target="_blank" rel="noopener noreferrer"
          href="https://wa.me/${String(o.contact_phone).replace(/[^0-9]/g, "").replace(/^0/, "2")}?text=${encodeURIComponent("مرحبًا، أنا مهتم بإعلانك: " + o.title + " - كود " + offerCode(o) + "، من منصة ASYUT AQAR.")}">واتساب صاحب الإعلان</a>` : `<p class="details-warning">لم يضف صاحب الإعلان رقم تواصل؛ يمكنك الرجوع لاحقًا أو اختيار عرض آخر.</p>`}
      </div>
      <p class="details-warning">تحقق من العقد والمستندات وموافقة المطوّر قبل دفع أي مبلغ.</p>
      <div class="details-actions">
        <button type="button" class="btn btn-outline-dark" id="shareOfferBtn">مشاركة الإعلان</button>
        <a class="btn btn-outline-dark" id="reportOfferBtn" target="_blank" rel="noopener noreferrer"
          href="https://wa.me/201007044265?text=${encodeURIComponent("أرغب في الإبلاغ عن إعلان على ASYUT AQAR: " + o.title + " - كود الإعلان " + offerCode(o))}">الإبلاغ عن الإعلان</a>
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
      // Share the listing's own page so WhatsApp/Facebook show its photo, title and price.
      const shareUrl = o.id != null
        ? new URL("./ads/" + encodeURIComponent(String(o.id)) + ".html", window.location.href)
        : new URL("./offers.html", window.location.href);
      const cleanUrl = cleanShareUrl(shareUrl);
      const shareData = {title: "ASYUT AQAR | " + o.title, text: "إعلان عقاري على أسيوط عقار: " + o.title + " — كود الإعلان " + offerCode(o), url: cleanUrl};
      try {
        if (navigator.share) await navigator.share(shareData);
        else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareData.text + "\n" + cleanUrl);
          setStatus("تم نسخ تفاصيل الإعلان ورابط أسيوط عقار للمشاركة.");
        } else {
          window.prompt("انسخ تفاصيل الإعلان ورابط أسيوط عقار:", shareData.text + "\n" + cleanUrl);
        }
      } catch (error) {
        if (error?.name !== "AbortError") setStatus("تعذرت المشاركة تلقائيًا. يمكنك نسخ رابط أسيوط عقار ومشاركة كود الإعلان: " + offerCode(o));
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
        meta.className = "my-offer-meta";
        const location = document.createElement("p");
        location.className = "my-offer-location";
        location.textContent = [offer.city || "أسيوط", offer.area].filter(Boolean).join(" · ") || "الموقع غير محدد";
        const financials = document.createElement("div");
        financials.className = "my-offer-financials";
        [
          ["المقدم", offer.down_payment],
          ["المتبقي", offer.remaining_amount],
          ["القسط الشهري", offer.monthly_installment]
        ].forEach(([label, value]) => {
          if (value === null || value === undefined || value === "") return;
          const item = document.createElement("div");
          const caption = document.createElement("span");
          caption.textContent = label;
          const amount = document.createElement("strong");
          amount.textContent = money(value);
          item.append(caption, amount);
          financials.appendChild(item);
        });
        const state = document.createElement("span");
        state.className = "my-offer-state";
        state.textContent = labels[offer.status] || "الحالة: " + (offer.status || "غير محددة");
        const date = document.createElement("small");
        const parsed = offer.created_at ? new Date(offer.created_at) : null;
        date.textContent = parsed && !Number.isNaN(parsed.getTime())
          ? "تاريخ الإرسال: " + parsed.toLocaleDateString("ar-EG-u-nu-latn")
          : "تاريخ الإرسال غير متاح";
        card.append(heading, meta, location);
        if (financials.childElementCount) card.appendChild(financials);
        card.append(state, date);
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
      if (!window.confirm("هل تريد تسجيل الخروج من حساب أسيوط عقار؟")) return;
      try { await api.signOut(); updateAuthButton(); window.dispatchEvent(new CustomEvent("layan-auth-state-changed", { detail: { authenticated: false } })); setStatus("تم تسجيل الخروج."); }
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
  document.querySelectorAll("[data-open-add-offer]").forEach(button => button.addEventListener("click", () => { selectedAccountType = "individual"; startAddOffer(); }));
  // Other pages link to "./?add=1" to open the add-listing flow directly.
  if (new URLSearchParams(window.location.search).get("add") === "1") {
    selectedAccountType = "individual";
    window.setTimeout(startAddOffer, 0);
  }
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
    showResults();
  });
  $("closeDialog")?.addEventListener("click", closeDialog);

  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });

  window.addEventListener("layan-open-offer", event => {
    const id = String(event.detail?.id ?? "");
    const offer = offers.find(item => String(item.id) === id);
    if (offer) showDetails(offer);
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

  document.querySelectorAll("[data-deal-kind]").forEach(button => button.addEventListener("click", () => { activeDealKind = button.dataset.dealKind || ""; activeKind = ""; showResults(); }));
  const listingPurpose = form?.querySelector('[name="listing_purpose"]');
  const landDetails = $("landDetailsFields");
  const updateLandFields = () => { if (landDetails) landDetails.hidden = !String(form?.querySelector('[name="property_type"]')?.value || "").includes("أرض"); };
  form?.querySelector('[name="property_type"]')?.addEventListener("change", updateLandFields);
  updateLandFields();
  $("resetFiltersBtn")?.addEventListener("click", () => {
    ["searchInput", "purposeFilter", "typeFilter", "cityFilter", "areaFilter", "totalPriceMaxFilter", "downPaymentMaxFilter", "monthlyMaxFilter", "minBedroomsFilter"].forEach(id => {
      const field = $(id);
      if (field) field.value = "";
    });
    if ($("sortFilter")) $("sortFilter").value = "newest";
    const advancedFilters = $("advancedPropertyFilters");
    const advancedToggle = $("toggleAdvancedFilters");
    if (advancedFilters) advancedFilters.hidden = true;
    if (advancedToggle) { advancedToggle.setAttribute("aria-expanded", "false"); advancedToggle.textContent = "＋ فلاتر إضافية"; }
    activeKind = "";
    activeDealKind = "";
    document.querySelectorAll("[data-category-kind]").forEach(tile => {
      tile.classList.remove("active");
      tile.setAttribute("aria-pressed", "false");
    });
    render();
  });
  $("searchInput")?.addEventListener("input", render);
  $("typeFilter")?.addEventListener("change", render);
  $("purposeFilter")?.addEventListener("change", render);
  $("totalPriceMaxFilter")?.addEventListener("input", render);
  $("minBedroomsFilter")?.addEventListener("change", render);
  $("toggleAdvancedFilters")?.addEventListener("click", () => {
    const panel = $("advancedPropertyFilters");
    const button = $("toggleAdvancedFilters");
    if (!panel || !button) return;
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
    button.textContent = panel.hidden ? "＋ فلاتر إضافية" : "− إخفاء الفلاتر";
  });
  cityFilter?.addEventListener("change", render);
  areaFilter?.addEventListener("change", render);
  $("sortFilter")?.addEventListener("change", render);
  $("downPaymentMaxFilter")?.addEventListener("input", render);
  $("monthlyMaxFilter")?.addEventListener("input", render);
  $("searchBtn")?.addEventListener("click", render);

  // Wire the hero's quick-search controls to the same canonical filters as the main results.
  $("heroQuickSearch")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const purpose = $("heroPurposeFilter")?.value || "";
    const type = $("heroTypeFilter")?.value || "";
    const place = $("heroAreaFilter")?.value || "";
    const budget = $("heroBudgetFilter")?.value || "";

    // Reset any previous free-text query so the quick-search choices work independently.
    if ($("searchInput")) $("searchInput").value = "";
    if ($("purposeFilter")) $("purposeFilter").value = purpose;
    if ($("typeFilter")) $("typeFilter").value = type;
    if (cityFilter) cityFilter.value = place && place !== "الهضبة" ? place : "";
    if (areaFilter) areaFilter.value = place === "الهضبة" ? place : "";
    if ($("totalPriceMaxFilter")) $("totalPriceMaxFilter").value = budget;

    // Clear hidden advanced filters so the quick search does not inherit old criteria.
    ["downPaymentMaxFilter", "monthlyMaxFilter", "minBedroomsFilter"].forEach(id => {
      const field = $(id);
      if (field) field.value = "";
    });
    if ($("sortFilter")) $("sortFilter").value = "newest";
    activeKind = "";
    activeDealKind = "";
    document.querySelectorAll("[data-category-kind]").forEach(tile => {
      tile.classList.remove("active");
      tile.setAttribute("aria-pressed", "false");
    });
    showResults();
  });

  const calcContract = $("calcContract");
  const calcPaid = $("calcPaid");
  const calcFees = $("calcFees");
  const formatCalc = (value) => num(value).toLocaleString("ar-EG-u-nu-latn", { maximumFractionDigits: 2 }) + " ج.م";
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
      listing_purpose: value("listing_purpose") || "تنازل",
      land_ownership_authority: value("land_ownership_authority"),
      land_permit_details: value("land_permit_details"),
      land_utilities: value("land_utilities"),
      land_zoning: value("land_zoning"),
      governorate: "أسيوط",
      city: value("city"),
      area: value("area"),
      latitude: value("latitude") === "" ? null : Number(value("latitude")),
      longitude: value("longitude") === "" ? null : Number(value("longitude")),
      area_m2: amount("area_m2"),
      bedrooms: Math.floor(amount("bedrooms")),
      bathrooms: Math.floor(amount("bathrooms")),
      monthly_installment: amount("monthly_installment"),
      property_type: value("property_type") || "شقة",
      description: value("description"),
      price_on_request: priceOnRequestToggle?.checked === true,
      total_price: amount("total_price"),
      down_payment: amount("down_payment"),
      paid_amount: amount("paid_amount"),
      remaining_amount: amount("remaining_installments"),
      assignment_fee: amount("transfer_fee"),
      assignment_fee_percentage: 0,
      discount_amount: amount("discount_amount"),
      discount_percent: amount("discount_percent"),
      contact_name: value("contact_name"),
      developer_name: value("developer_name"),
      project_name: value("project_name"),
      company_business_name: selectedAccountType === "company" ? value("company_business_name") : "",
      contact_phone: value("contact_phone"),
      featured_requested: value("promotion_plan") === "featured_15" || value("promotion_plan") === "featured_30",
      promotion_status: (value("promotion_plan") === "featured_15" || value("promotion_plan") === "featured_30") ? "requested" : "none",
      is_featured: false,
      image_urls: []
    };

    const hasLatitude = value("latitude") !== "";
    const hasLongitude = value("longitude") !== "";
    if (hasLatitude !== hasLongitude) {
      setStatus("أدخل خط العرض وخط الطول معًا، أو اترك الاثنين فارغين.");
      return;
    }
    if (hasLatitude && (!Number.isFinite(offer.latitude) || offer.latitude < -90 || offer.latitude > 90 ||
        !Number.isFinite(offer.longitude) || offer.longitude < -180 || offer.longitude > 180)) {
      setStatus("إحداثيات الموقع غير صحيحة. راجع خط العرض والطول.");
      return;
    }

    if (offer.contact_phone && !data.get("contact_consent")) {
      setStatus("لنشر رقم التواصل داخل الإعلان يجب الموافقة صراحةً على نشره. اترك الرقم فارغًا إن لم ترغب في نشره.");
      return;
    }

    if (selectedAccountType === "company" && !offer.company_business_name) {
      setStatus("اكتب اسم الشركة صاحبة الإعلان.");
      return;
    }

    if (!offer.title) {
      setStatus("اكتب عنوان العرض أولًا.");
      return;
    }

    if (!offer.price_on_request && offer.total_price <= 0) {
      setStatus("اكتب إجمالي سعر صحيحًا أكبر من صفر.");
      return;
    }
    if (!offer.price_on_request && (offer.down_payment < 0 || offer.down_payment > offer.total_price)) {
      setStatus("المقدم يجب أن يكون بين صفر وإجمالي السعر.");
      return;
    }
    if (!offer.price_on_request && (offer.paid_amount < 0 || offer.paid_amount > offer.total_price)) {
      setStatus("المبلغ المدفوع يجب ألا يتجاوز إجمالي السعر.");
      return;
    }
    if (!offer.price_on_request && (offer.remaining_amount < 0 || offer.remaining_amount > offer.total_price)) {
      setStatus("المبلغ المتبقي يجب أن يكون بين صفر وإجمالي السعر.");
      return;
    }
    if (!offer.price_on_request && offer.paid_amount + offer.remaining_amount > offer.total_price + 0.01) {
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

    // PNG / HEIC / WebP photos from phones are converted to JPEG here instead of being rejected.
    const files = await Promise.all(Array.from(photosInput?.files || []).map(file => (window.LAYAN_TO_JPEG ? window.LAYAN_TO_JPEG(file) : file)));
    const documentFiles = Array.from(documentsInput?.files || []);
    if (files.some((file) => file.type !== "image/jpeg" || !/\.jpe?g$/i.test(file.name))) {
      setStatus("تعذر قراءة إحدى الصور. جرّب صورة أخرى أو التقطها بالكاميرا.");
      return;
    }
    if (files.some((file) => file.size > 15 * 1024 * 1024)) {
      setStatus("حجم الصورة الواحدة يجب ألا يتجاوز 15 ميجابايت.");
      return;
    }

    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    let uploadedImageUrls = [];
    let uploadedDocumentPaths = [];
    let offerWasCreated = false;
    let apiForCleanup = null;
    try {
      const api = window.LAYAN_SUPABASE;
      apiForCleanup = api;
      if (!api?.createOffer) throw new Error("اتصال Supabase غير جاهز.");
      if (!api.isAuthenticated()) throw new Error("سجّل الدخول أو أنشئ حسابًا أولًا لإرسال عرضك.");

      if (files.length) {
        if (!api.uploadImages) throw new Error("رفع الصور غير مفعّل.");
        setStatus("جارٍ رفع الصور...");
        uploadedImageUrls = await api.uploadImages(files);
        offer.image_urls = uploadedImageUrls;
      }

      setStatus(selectedAccountType === "company" ? "جارٍ ربط العقار بإعلان الشركة..." : "جارٍ حفظ العرض...");
      if (documentFiles.length) {
        if (!api.uploadPropertyDocuments) throw new Error("رفع مستندات العقار غير جاهز. حدّث الصفحة وحاول مرة أخرى.");
        setStatus("جارٍ رفع المستندات إلى مساحة خاصة...");
        uploadedDocumentPaths = await api.uploadPropertyDocuments(documentFiles);
        offer.document_urls = uploadedDocumentPaths;
      }

      if (selectedAccountType === "company") {
        if (!api.getOrCreateCompanyAd) throw new Error("ميزة إعلانات الشركات غير جاهزة. حدّث الصفحة وحاول مرة أخرى.");
        offer.company_ad_id = await api.getOrCreateCompanyAd(offer.company_business_name);
      }
      await api.createOffer(offer);
      offerWasCreated = true;

      form.reset();
      clearPhotoPreview();
      closeDialog();
      setStatus(offer.featured_requested
        ? "تم إرسال العرض وطلب الإعلان المميز للمراجعة. ستتواصل معك إدارة أسيوط عقار عبر واتساب لتوضيح تفاصيل الخدمة؛ لا تحوّل أي مبلغ قبل تأكيد التفاصيل رسميًا من الإدارة."
        : selectedAccountType === "company"
          ? "تم إرسال العقار للمراجعة وربطه بإعلان الشركة. يمكنك إضافة عقارين آخرين كحد أقصى إلى إعلان الشركة نفسه باستخدام اسم الشركة ذاته. قاعدة البيانات تمنع إضافة عقار رابع إلى الإعلان الواحد."
          : "تم إرسال العرض للمراجعة، وسيظهر بعد الموافقة.");
    } catch (error) {
      console.error("فشل حفظ العرض:", error);
      if (!offerWasCreated && uploadedDocumentPaths.length && apiForCleanup?.deleteUploadedPropertyDocuments) {
        try { await apiForCleanup.deleteUploadedPropertyDocuments(uploadedDocumentPaths); } catch (cleanupError) { console.warn("تعذر تنظيف المستندات المؤقتة:", cleanupError); }
      }
      if (!offerWasCreated && uploadedImageUrls.length && apiForCleanup?.deleteUploadedImages) {
        setStatus("تعذر حفظ الإعلان. جارٍ حذف الصور التي رُفعت لهذا الإعلان غير المكتمل...");
        try {
          await apiForCleanup.deleteUploadedImages(uploadedImageUrls);
          uploadedImageUrls = [];
        } catch (cleanupError) {
          console.warn("تعذر تنظيف الصور المؤقتة:", cleanupError);
        }
      }
      const rawMessage = String(error?.message || "");
      const friendlyMessage = /failed to fetch|network|load failed/i.test(rawMessage)
        ? "تعذر الاتصال بالخادم. راجع الإنترنت وحاول مرة أخرى."
        : /duplicate|already exists|unique/i.test(rawMessage)
          ? "تعذر إكمال العملية بسبب سجل موجود بالفعل. حدّث الصفحة وحاول مرة أخرى."
          : rawMessage || "لم يتم حفظ الإعلان. حاول مرة أخرى بعد مراجعة البيانات.";
      setStatus("لم يتم إرسال الإعلان. " + friendlyMessage);
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
        if (note) note.textContent = "مساحة إعلانية للشركات — تُضاف بيانات النشاط بعد موافقة صاحبه واعتماد الإعلان من إدارة أسيوط عقار.";
      });
      const visible = [...section.querySelectorAll("[data-partner-slot]")].some(card => !card.hidden);
      if (!visible) section.hidden = true;
    } catch (error) {
      console.warn("ASYUT AQAR partner ad slots:", error.message);
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
      window.ASYUT_OFFERS = offers.slice();
      window.dispatchEvent(new CustomEvent("asyut:offers-loaded"));
      updateAreaFilter();
      applyUrlFilters();
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
            ? "" // the results count above the grid already says how many offers are shown
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

  $("offersPagination")?.addEventListener("click", event => { const button=event.target.closest("[data-page-nav]"); if(!button||button.disabled)return; offersPage+=button.dataset.pageNav==="next"?1:-1; showResults(); });
  $("offersGrid")?.addEventListener("click", event => {
    const compareButton = event.target.closest("[data-compare-id]");
    if (compareButton) { toggleCompare(compareButton.dataset.compareId); return; }
    const favoriteButton = event.target.closest("[data-favorite-id]");
    if (favoriteButton) toggleFavorite(favoriteButton.dataset.favoriteId);
  });
  $("openCompareBtn")?.addEventListener("click", openPropertyComparison);
  $("clearCompareBtn")?.addEventListener("click", () => { localStorage.removeItem(COMPARE_KEY); updateCompareTray(); });
  $("closeCompareDialog")?.addEventListener("click", () => $("compareDialog")?.close());
  $("compareTableWrap")?.addEventListener("click", event => {
    const removeButton = event.target.closest("[data-remove-compare]");
    if (removeButton) {
      toggleCompare(removeButton.dataset.removeCompare);
      $("compareDialog")?.close();
      openPropertyComparison();
      return;
    }
    const detailsButton = event.target.closest("[data-open-compare-offer]");
    if (detailsButton) {
      const offer = offers.find(item => String(item.id) === String(detailsButton.dataset.openCompareOffer));
      $("compareDialog")?.close();
      if (offer) showDetails(offer);
    }
  });
  updateCompareTray();

  async function syncFavoritesToAccount() {
    const api=window.LAYAN_SUPABASE;
    if(!api?.isAuthenticated?.()) return;
    try {
      const merged=[...new Set([...favoriteIds(),...(await api.getFavoriteOfferIds())])];
      await api.syncFavoriteOffers(merged);
      localStorage.setItem(FAVORITES_KEY,JSON.stringify(merged));
    } catch(error) { console.warn("تعذر مزامنة المفضلة:",error); }
  }
  syncFavoritesToAccount();

  function handleAuthCallback(event) {
    if (event.detail?.success) {
      updateAuthButton();
      if (continueCompanyRegistration()) return;
      setStatus("تم تأكيد البريد الإلكتروني وتسجيل الدخول بنجاح. أهلًا بك في أسيوط عقار.");
    } else if (event.detail?.message) {
      setStatus("تعذر إكمال تأكيد البريد. افتح أحدث رسالة تأكيد في نفس المتصفح الذي أنشأت منه الحساب، أو اضغط إعادة الإرسال.");
      console.warn("ASYUT AQAR auth callback:", event.detail.message);
    }
  }
  window.addEventListener("layan-auth-callback", handleAuthCallback);
  // The Supabase client may finish exchanging the callback code before app.js attaches its listener.
  if (window.LAYAN_AUTH_CALLBACK_RESULT) {
    handleAuthCallback({ detail: window.LAYAN_AUTH_CALLBACK_RESULT });
  }
  updateAuthButton();
  if (new URLSearchParams(window.location.search).get("company-register") === "1") {
    sessionStorage.setItem("layanCompanyRegistrationPending", "1");
    if (window.LAYAN_SUPABASE?.isAuthenticated?.()) continueCompanyRegistration();
    else { openAuth("login"); setStatus("سجّل الدخول أو أنشئ حسابًا مجانيًا، وسنعود بك تلقائيًا إلى نموذج تسجيل الشركة."); }
  }
  await Promise.all([loadOffers(), loadPartnerAdSlots()]);
});
