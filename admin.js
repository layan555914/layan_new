document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const config = window.LAYAN_CONFIG || {};
  const base = String(config.SUPABASE_URL || "").replace(/\/$/, "");
  const key = config.SUPABASE_PUBLISHABLE_KEY || "";
  const list = document.getElementById("pendingAds");
  const propertyDocsList = document.getElementById("pendingPropertyDocuments");
  const companyProfilesList = document.getElementById("pendingCompanyProfiles");
  const status = document.getElementById("adminStatus");
  const login = document.getElementById("adminLogin");
  const email = document.getElementById("adminEmail");
  const password = document.getElementById("adminPassword");
  const authPanel = document.getElementById("authPanel");
  const reviewPanel = document.getElementById("reviewPanel");
  // Admin session lives in sessionStorage only (cleared when the tab/browser closes) to limit token exposure; legacy localStorage copy is removed.
  const sessionKey = "layanSupabaseSession";
  try { localStorage.removeItem(sessionKey); } catch (_) {}
  const readSession = () => { try { return JSON.parse(sessionStorage.getItem(sessionKey) || "null"); } catch (_) { return null; } };
  let session = readSession();
  const setStatus = message => { status.textContent = message || ""; };
  async function ensureFreshSession() {
    if (!session?.access_token) return;
    const expiresAt = Number(session.expires_at || 0);
    if (expiresAt > Math.floor(Date.now() / 1000) + 60) return;
    if (!session.refresh_token) {
      session = null;
      sessionStorage.removeItem(sessionKey);
      showState(false);
      throw new Error("انتهت جلسة الإدارة. سجّل الدخول مرة أخرى.");
    }
    try {
      const response = await fetch(base + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      const raw = await response.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch (_) {}
      if (!response.ok || !data?.access_token || !data?.user) throw new Error("refresh failed");
      session = { access_token: data.access_token, refresh_token: data.refresh_token || session.refresh_token, expires_at: data.expires_at || Math.floor(Date.now()/1000)+(data.expires_in || 3600), user: data.user };
      sessionStorage.setItem(sessionKey, JSON.stringify(session));
    } catch (_) {
      session = null;
      sessionStorage.removeItem(sessionKey);
      showState(false);
      throw new Error("انتهت جلسة الإدارة. سجّل الدخول مرة أخرى.");
    }
  }
  async function request(path, options = {}) {
    if (!base || !key) throw new Error("إعدادات قاعدة البيانات غير مكتملة.");
    const isAuthEndpoint = path.startsWith("/auth/v1/");
    if (!isAuthEndpoint) await ensureFreshSession();
    let response;
    try {
      const isAuthEndpoint = path.startsWith("/auth/v1/");
      response = await fetch(base + path, {
        ...options,
        headers: {
          apikey: key,
          Authorization: "Bearer " + (isAuthEndpoint ? key : (session?.access_token || key)),
          "Content-Type": "application/json",
          ...(options.headers || {})
        }
      });
    } catch (networkError) {
      throw new Error("تعذر الاتصال بخدمة Supabase. تحقق من الإنترنت وإعدادات عنوان المشروع والمفتاح العام ثم أعد المحاولة.");
    }
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = raw; }
    if (!response.ok) {
      const detail = data?.message || data?.error_description || data?.msg || data?.error || data?.details || data?.hint;
      if (response.status === 400 && path.startsWith("/auth/v1/token")) {
        throw new Error(detail || "بيانات الدخول غير صحيحة أو لم يتم تفعيل تأكيد البريد في حساب Supabase.");
      }
      throw new Error(detail || ("تعذر تنفيذ الطلب (HTTP " + response.status + ")."));
    }
    return data;
  }
  function showState(isLoggedIn) {
    authPanel.hidden = isLoggedIn;
    reviewPanel.hidden = !isLoggedIn;
  }
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);
  }
  // Only http/https links are ever rendered as clickable; anything else (javascript:, data:, ...) is disabled.
  const safeUrl = value => { try { const u = new URL(String(value || "")); return ["https:", "http:"].includes(u.protocol) ? u.href : ""; } catch (_) { return ""; } };
  const linkHtml = (url, label) => {
    if (!url) return "";
    const s = safeUrl(url);
    return s ? '<a href="' + esc(s) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>'
             : '<span class="admin-chip">رابط غير آمن تم تعطيله (' + label + ')</span>';
  };
  function render(rows) {
    if (!Array.isArray(rows) || !rows.length) {
      list.innerHTML = '<p class="admin-empty">لا توجد إعلانات قيد المراجعة حاليًا.</p>';
      return;
    }
    list.innerHTML = rows.map(ad => '<article class="admin-ad" data-ad-id="' + esc(ad.id) + '">' +
      '<div><span class="admin-chip">' + esc(ad.category) + '</span><h2>' + esc(ad.title) + '</h2>' +
      '<p><strong>النشاط:</strong> ' + esc(ad.business_name) + '</p><p>' + esc(ad.description) + '</p>' +
      '<p><strong>الهاتف:</strong> ' + esc(ad.contact_phone) + '</p><p><strong>نوع الطلب:</strong> ' + 'طلب إعلان مخصص' + '</p>' +
      '<p><strong>المدة:</strong> ' + (Number(ad.requested_days) > 0 ? esc(ad.requested_days) + ' يومًا (مبدئية)' : 'تُحدد بعد الاتفاق') + '</p>' +
      (ad.image_url ? '<p>' + linkHtml(ad.image_url, 'عرض صورة الإعلان') + '</p>' : '') +
      (ad.target_url ? '<p>' + linkHtml(ad.target_url, 'رابط النشاط') + '</p>' : '') +
      '</div><div class="admin-actions">' +
      '<div class="admin-activation-fields"><label>المدة المتفق عليها (يومًا)<input type="number" min="1" max="365" step="1" value="' + esc(ad.requested_days > 0 ? ad.requested_days : "") + '" data-agreed-days></label>' +
      '<label>السعر المتفق عليه (جنيه)<input type="number" min="0" step="1" placeholder="اكتب السعر بعد الاتفاق" data-agreed-price></label></div>' +
      '<button type="button" class="btn btn-gold" data-action="activate">تفعيل بعد تأكيد الاتفاق</button>' +
      '<button type="button" class="btn btn-outline-dark" data-action="reject">رفض الطلب</button></div></article>').join("");
  }
  async function loadPendingPropertyDocuments() {
    if (!propertyDocsList) return;
    propertyDocsList.innerHTML = '<p class="admin-empty">جارٍ تحميل مستندات العقارات...</p>';
    try {
      const rows = await request("/rest/v1/property_offers?select=id,title,developer_name,project_name,document_urls,created_at&status=eq.pending&order=created_at.asc");
      if (!Array.isArray(rows) || !rows.length) {
        propertyDocsList.innerHTML = '<p class="admin-empty">لا توجد مستندات عقارات معلقة للمراجعة حاليًا.</p>';
        return;
      }
      const cards = [];
      for (const offer of rows) {
        const docs = Array.isArray(offer.document_urls) ? offer.document_urls.filter(path => typeof path === "string" && path.startsWith("documents/")) : [];
        // Do not show an empty document card for an offer that has no attached files.
        if (!docs.length) continue;
        const links = [];
        for (const path of docs) {
          if (typeof path !== "string" || !path.startsWith("documents/")) continue;
          const response = await fetch(base + "/storage/v1/object/sign/layan-property-documents/" + path.split("/").map(encodeURIComponent).join("/"), {
            method:"POST",headers:{apikey:key,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({expiresIn:600})
          });
          const result = await response.json().catch(()=>({}));
          if (!response.ok || !result.signedURL) continue;
          const href = safeUrl(result.signedURL.startsWith("http") ? result.signedURL : base + "/storage/v1" + result.signedURL);
          if (!href) continue;
          links.push('<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">فتح مستند خاص</a>');
        }
        cards.push('<article class="admin-ad"><div><h3>'+esc(offer.title)+'</h3><p><strong>المطور:</strong> '+esc(offer.developer_name || "غير مسجل")+'</p><p><strong>المشروع:</strong> '+esc(offer.project_name || "غير مسجل")+'</p><p><strong>المستندات:</strong> '+links.length+' من '+docs.length+'</p>'+ (links.length ? links.join(" · ") : '<span>تعذر إنشاء روابط العرض المؤقتة.</span>') +'</div></article>');
      }
      propertyDocsList.innerHTML = cards.length ? cards.join("") : '<p class="admin-empty">لا توجد مستندات مرفقة بعقارات قيد المراجعة حاليًا.</p>';
    } catch (error) {
      propertyDocsList.innerHTML = '<p class="admin-empty">'+esc(error.message || "تعذر تحميل مستندات العقارات.")+'</p>';
    }
  }
  const COMPANY_COLS = "id,company_name,category,description,services,city,address,phone,whatsapp,website,logo_url,gallery_urls,projects,created_at";
  let companyDraftSupported = false;
  async function loadPendingCompanyProfiles() {
    if (!companyProfilesList) return;
    companyProfilesList.innerHTML = '<p class="admin-empty">جارٍ تحميل طلبات ملفات الشركات...</p>';
    let rows;
    try {
      // Newer schema (draft updates). Falls back to the legacy query if the columns do not exist yet.
      rows = await request("/rest/v1/company_profiles?select=" + COMPANY_COLS + ",status,pending_update,update_status&or=(status.eq.pending,and(status.eq.active,update_status.eq.pending))&order=created_at.asc");
      companyDraftSupported = true;
    } catch (_) {
      companyDraftSupported = false;
      rows = await request("/rest/v1/company_profiles?select=" + COMPANY_COLS + "&status=eq.pending&order=created_at.asc");
    }
    if (!Array.isArray(rows) || !rows.length) {
      companyProfilesList.innerHTML = '<p class="admin-empty">لا توجد طلبات ملفات شركات معلقة.</p>';
      return;
    }
    companyProfilesList.innerHTML = rows.map(row => {
      const isUpdate = companyDraftSupported && row.status === "active" && row.update_status === "pending" && row.pending_update && typeof row.pending_update === "object";
      const c = isUpdate ? Object.assign({}, row, row.pending_update) : row;
      const services = Array.isArray(c.services) ? c.services : [];
      const projects = Array.isArray(c.projects) ? c.projects : [];
      const gallery = Array.isArray(c.gallery_urls) ? c.gallery_urls : [];
      return '<article class="admin-ad" data-company-profile-id="' + esc(row.id) + '" data-company-kind="' + (isUpdate ? "update" : "new") + '">' +
        '<div class="company-review-details" data-company-details hidden>' +
        '<span class="admin-chip">' + esc(c.category) + '</span> <span class="admin-chip">' + (isUpdate ? "طلب تعديل على ملف منشور — النسخة المنشورة ما زالت ظاهرة" : "طلب جديد أو إعادة إرسال") + '</span>' +
        '<h2>' + esc(c.company_name) + '</h2><p>' + esc(c.description) + '</p>' +
        '<p><strong>المدينة:</strong> ' + esc(c.city || "أسيوط") + (c.address ? ' — <strong>العنوان:</strong> ' + esc(c.address) : '') + '</p>' +
        '<p><strong>الهاتف:</strong> ' + esc(c.phone) + (c.whatsapp ? ' — <strong>واتساب:</strong> ' + esc(c.whatsapp) : '') + '</p>' +
        '<p><strong>الخدمات:</strong> ' + esc(services.join("، ")) + '</p>' +
        '<p><strong>المشروعات:</strong> ' + esc(projects.map(p => (p && p.title) || "").filter(Boolean).join("، ") || "لم تُضف") + '</p>' +
        (c.website ? '<p>' + linkHtml(c.website, 'الموقع الإلكتروني') + '</p>' : '') +
        (c.logo_url ? '<p>' + linkHtml(c.logo_url, 'شعار الشركة') + '</p>' : '') +
        '<p><strong>صور الأعمال:</strong> ' + gallery.length + '</p>' + gallery.map((u, i) => linkHtml(u, 'صورة ' + (i + 1))).join(' · ') +
        '</div><div class="admin-actions"><button type="button" class="btn btn-outline-dark" data-company-action="review" aria-expanded="false">مراجعة البيانات</button>' +
        '<button type="button" class="btn btn-gold" data-company-action="approve">اعتماد ونشر الملف</button>' +
        '<button type="button" class="btn btn-outline-dark" data-company-action="request_changes">طلب استكمال البيانات</button>' +
        '<button type="button" class="btn btn-outline-dark" data-company-action="reject">رفض الطلب</button></div></article>';
    }).join("");
  }
  async function loadPending() {
    setStatus("جارٍ التحقق من صلاحية الإدارة وتحميل الطلبات...");
    try {
      // Fail closed: password authentication is not proof of administrator authorization.
      // Check the protected server-side allowlist before requesting any review data or signing documents.
      const adminAllowed = await request("/rest/v1/rpc/layan_is_admin", { method: "POST", body: "{}" });
      if (adminAllowed !== true) {
        session = null;
        sessionStorage.removeItem(sessionKey);
        showState(false);
        list.innerHTML = "";
        if (companyProfilesList) companyProfilesList.innerHTML = "";
        if (propertyDocsList) propertyDocsList.innerHTML = "";
        setStatus("هذا الحساب غير مخوّل بدخول لوحة إدارة LAYAN. يمكنك متابعة ملف شركتك من صفحة دليل الشركات.");
        return false;
      }

      const rows = await request("/rest/v1/supplier_ads?select=id,business_name,category,title,description,image_url,target_url,contact_phone,plan_code,requested_days,created_at&status=eq.pending&order=created_at.asc");
      render(rows);
      await loadPendingCompanyProfiles();
      await loadPendingPropertyDocuments();
      showState(true);
      setStatus("تم التحقق من صلاحية الإدارة وتحميل طلبات الإعلانات والشركات ومستندات العقارات.");
      return true;
    } catch (error) {
      showState(false);
      list.innerHTML = "";
      if (companyProfilesList) companyProfilesList.innerHTML = "";
      if (propertyDocsList) propertyDocsList.innerHTML = "";
      setStatus(/غير مصرح|permission|row-level|policy|401|403|غير مخوّل/i.test(error.message)
        ? "هذا الحساب غير مخوّل للإدارة. يمكنك متابعة ملف شركتك من صفحة دليل الشركات."
        : error.message);
      return false;
    }
  }
  const forgotPassword = document.getElementById("adminForgotPassword");
  forgotPassword?.addEventListener("click", async event => {
    event.preventDefault();
    const recoveryEmail = email.value.trim();
    if (!recoveryEmail) {
      setStatus("اكتب بريدك الإلكتروني أولًا، ثم اضغط «نسيت كلمة المرور؟».");
      email.focus();
      return;
    }
    const link = forgotPassword;
    link.style.pointerEvents = "none";
    setStatus("جارٍ إرسال رابط استعادة كلمة المرور إلى بريدك...");
    try {
      const response = await fetch(base + "/auth/v1/recover?redirect_to=" + encodeURIComponent("https://layan-eg.com/reset-password.html"), {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ email: recoveryEmail })
      });
      const raw = await response.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
      if (!response.ok) throw new Error(data.msg || data.message || data.error_description || data.error || "تعذر إرسال رسالة الاستعادة.");
      setStatus("لو البريد مسجل في المنصة، ستصلك رسالة استعادة. افتح أحدث رسالة من Supabase واضغط الرابط، ثم عيّن كلمة مرور جديدة. راجع الرسائل غير المرغوب فيها أيضًا.");
    } catch (error) {
      setStatus("تعذر إرسال رابط الاستعادة: " + error.message + " إذا ظهر خطأ في الرابط المسموح، يلزم إضافة https://layan-eg.com/reset-password.html إلى إعدادات Redirect URLs في Supabase.");
    } finally {
      link.style.pointerEvents = "";
    }
  });
  login.addEventListener("submit", async event => {
    event.preventDefault();
    const button = login.querySelector('button[type="submit"]');
    button.disabled = true;
    setStatus("جارٍ تسجيل الدخول...");
    try {
      const data = await request("/auth/v1/token?grant_type=password", {
        method: "POST", headers: {}, body: JSON.stringify({email: email.value.trim(), password: password.value})
      });
      if (!data?.access_token || !data?.user?.id) throw new Error("لم يتم إنشاء جلسة دخول صالحة.");
      session = {access_token:data.access_token,refresh_token:data.refresh_token || null,expires_at:data.expires_at || Math.floor(Date.now()/1000)+(data.expires_in || 3600),user:data.user};
      sessionStorage.setItem(sessionKey, JSON.stringify(session));
      showState(false);
      await loadPending();
    } catch (error) {
      setStatus("تعذر تسجيل الدخول: " + error.message);
    } finally { button.disabled = false; }
  });
  companyProfilesList?.addEventListener("click", async event => {
    const button = event.target.closest("button[data-company-action]");
    const card = event.target.closest("[data-company-profile-id]");
    if (!button || !card) return;
    const action = button.dataset.companyAction;
    const id = card.dataset.companyProfileId;
    if (action === "review") {
      const details = card.querySelector("[data-company-details]");
      const expanded = button.getAttribute("aria-expanded") === "true";
      details.hidden = expanded;
      button.setAttribute("aria-expanded", String(!expanded));
      button.textContent = expanded ? "مراجعة البيانات" : "إخفاء البيانات";
      return;
    }
    let notes = null;
    if (action === "reject") {
      notes = window.prompt("اكتب سبب رفض ملف الشركة:");
      if (notes === null) return;
      if (notes.trim().length < 3) { setStatus("اكتب سببًا واضحًا للرفض."); return; }
    } else if (action === "request_changes") {
      notes = window.prompt("اكتب البيانات أو التعديلات المطلوبة من الشركة:");
      if (notes === null) return;
      if (notes.trim().length < 3) { setStatus("اكتب تفاصيل واضحة لاستكمال البيانات."); return; }
    } else if (!window.confirm(card.dataset.companyKind === "update" ? "اعتماد التعديلات وتحديث النسخة العامة لملف الشركة؟" : "اعتماد ملف الشركة ونشره في دليل ليان؟")) return;
    button.disabled = true;
    try {
      if (card.dataset.companyKind === "update") {
        // Draft update on a published profile: server-side function (admin-only) merges or rejects it.
        await request("/rest/v1/rpc/layan_review_company_profile", { method: "POST", body: JSON.stringify({ p_id: id, p_action: action, p_notes: notes }) });
      } else {
        const done = await request("/rest/v1/company_profiles?id=eq." + encodeURIComponent(id) + "&status=eq.pending", {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ status: action === "approve" ? "active" : action === "request_changes" ? "needs_changes" : "rejected", admin_notes: action === "approve" ? null : notes, reviewed_at: new Date().toISOString(), reviewed_by: session.user.id })
        });
        if (!Array.isArray(done) || !done.length) throw new Error("لم يتغير أي طلب: قد تكون حالته تغيّرت أو لا تسمح الصلاحيات بالتعديل. حدّث القائمة وحاول مرة أخرى.");
      }
      setStatus(action === "approve" ? "تم اعتماد ملف الشركة ونشره." : action === "request_changes" ? "تم إرسال طلب استكمال البيانات إلى الشركة." : "تم رفض طلب ملف الشركة.");
      await loadPending();
    } catch (error) { setStatus(error.message || "تعذر تحديث حالة ملف الشركة."); }
    finally { button.disabled = false; }
  });
  list.addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");
    const card = event.target.closest("[data-ad-id]");
    if (!button || !card) return;
    const id = card.dataset.adId;
    button.disabled = true;
    try {
      if (button.dataset.action === "activate") {
        const days = Number(card.querySelector("[data-agreed-days]")?.value);
        const priceInput = card.querySelector("[data-agreed-price]");
        const price = Number(priceInput?.value);
        if (!Number.isInteger(days) || days < 1 || days > 365 || !Number.isFinite(price) || price < 0 || priceInput?.value === "") {
          throw new Error("اكتب المدة المتفق عليها من 1 إلى 365 يومًا والسعر النهائي بعد التواصل مع الشركة عبر واتساب.");
        }
        if (!window.confirm("تأكيد تفعيل الإعلان لمدة " + days + " يومًا بالسعر المتفق عليه " + price + " جنيه؟")) return;
        await request("/rest/v1/rpc/layan_activate_supplier_ad", {method:"POST",body:JSON.stringify({p_ad_id:id,p_days:days,p_price:price})});
        setStatus("تم تفعيل الإعلان بعد تسجيل السعر والمدة المتفق عليهما.");
      } else {
        const reason = window.prompt("اكتب سبب رفض الطلب (3 أحرف على الأقل):");
        if (reason === null) return;
        await request("/rest/v1/rpc/layan_reject_supplier_ad", {method:"POST",body:JSON.stringify({p_ad_id:id,p_reason:reason})});
        setStatus("تم رفض الطلب.");
      }
      await loadPending();
    } catch (error) {
      setStatus(error.message || "تعذر تنفيذ الإجراء.");
    } finally { button.disabled = false; }
  });
  document.getElementById("reloadPending").addEventListener("click", loadPending);
  document.getElementById("adminLogout").addEventListener("click", async () => {
    try { if (session?.access_token) await fetch(base + "/auth/v1/logout", {method:"POST", headers:{apikey:key, Authorization:"Bearer "+session.access_token}}); } catch (_) {}
    session = null;
    sessionStorage.removeItem(sessionKey);
    showState(false);
    setStatus("تم تسجيل الخروج.");
  });
  // Never reveal the administration panel from a locally cached token alone.
  showState(false);
  async function verifyAndLoadAdmin() {
    if (!session?.access_token || !session?.user?.id) return;
    try {
      const response = await fetch(base + "/auth/v1/user", {headers:{apikey:key, Authorization:"Bearer "+session.access_token}});
      const user = response.ok ? await response.json() : null;
      if (!user?.id || user.id !== session.user.id) throw new Error("جلسة الدخول غير صالحة.");
      session.user = user;
      sessionStorage.setItem(sessionKey, JSON.stringify(session));
      const adminAllowed = await request("/rest/v1/rpc/layan_is_admin", {method:"POST", body:"{}"});
      if (adminAllowed !== true) throw new Error("الحساب غير مصرح له بدخول لوحة الإدارة.");
      await loadPending();
    } catch (error) {
      session = null;
      sessionStorage.removeItem(sessionKey);
      showState(false);
      setStatus("يلزم تسجيل الدخول والتحقق من صلاحية الإدارة مرة أخرى.");
    }
  }
  if (session?.access_token) verifyAndLoadAdmin();
});