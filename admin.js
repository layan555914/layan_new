document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const config = window.LAYAN_CONFIG || {};
  const base = String(config.SUPABASE_URL || "").replace(/\/$/, "");
  const key = config.SUPABASE_PUBLISHABLE_KEY || "";
  const list = document.getElementById("pendingAds");
  const propertyDocsList = document.getElementById("pendingPropertyDocuments");
  const status = document.getElementById("adminStatus");
  const login = document.getElementById("adminLogin");
  const email = document.getElementById("adminEmail");
  const password = document.getElementById("adminPassword");
  const authPanel = document.getElementById("authPanel");
  const reviewPanel = document.getElementById("reviewPanel");
  // Persist the admin session across tabs and browser restarts; refresh it when needed.
  const sessionKey = "layanSupabaseSession";
  const readSession = () => { try { return JSON.parse(localStorage.getItem(sessionKey) || "null"); } catch (_) { return null; } };
  let session = readSession();
  const setStatus = message => { status.textContent = message || ""; };
  async function ensureFreshSession() {
    if (!session?.access_token) return;
    const expiresAt = Number(session.expires_at || 0);
    if (expiresAt > Math.floor(Date.now() / 1000) + 60) return;
    if (!session.refresh_token) {
      session = null;
      localStorage.removeItem(sessionKey);
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
      localStorage.setItem(sessionKey, JSON.stringify(session));
    } catch (_) {
      session = null;
      localStorage.removeItem(sessionKey);
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
      (ad.image_url ? '<p><a href="' + esc(ad.image_url) + '" target="_blank" rel="noopener noreferrer">عرض صورة الإعلان</a></p>' : '') +
      (ad.target_url ? '<p><a href="' + esc(ad.target_url) + '" target="_blank" rel="noopener noreferrer">رابط النشاط</a></p>' : '') +
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
      const rows = await request("/rest/v1/rpc/layan_admin_pending_property_documents", {method:"POST",body:"{}"});
      if (!Array.isArray(rows) || !rows.length) {
        propertyDocsList.innerHTML = '<p class="admin-empty">لا توجد مستندات عقارات معلقة للمراجعة حاليًا.</p>';
        return;
      }
      const cards = [];
      for (const offer of rows) {
        const docs = Array.isArray(offer.document_urls) ? offer.document_urls : [];
        const links = [];
        for (const path of docs) {
          if (typeof path !== "string" || !path.startsWith("documents/")) continue;
          const response = await fetch(base + "/storage/v1/object/sign/layan-property-documents/" + path.split("/").map(encodeURIComponent).join("/"), {
            method:"POST",headers:{apikey:key,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({expiresIn:600})
          });
          const result = await response.json().catch(()=>({}));
          if (!response.ok || !result.signedURL) continue;
          const href = result.signedURL.startsWith("http") ? result.signedURL : base + "/storage/v1" + result.signedURL;
          links.push('<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">فتح مستند خاص</a>');
        }
        cards.push('<article class="admin-ad"><div><h3>'+esc(offer.title)+'</h3><p><strong>المطور:</strong> '+esc(offer.developer_name || "غير مسجل")+'</p><p><strong>المشروع:</strong> '+esc(offer.project_name || "غير مسجل")+'</p><p><strong>المستندات:</strong> '+links.length+' من '+docs.length+'</p>'+ (links.length ? links.join(" · ") : '<span>تعذر إنشاء روابط العرض المؤقتة.</span>') +'</div></article>');
      }
      propertyDocsList.innerHTML = cards.join("");
    } catch (error) {
      propertyDocsList.innerHTML = '<p class="admin-empty">'+esc(error.message || "تعذر تحميل مستندات العقارات.")+'</p>';
    }
  }
  async function loadPending() {
    setStatus("جارٍ التحقق من صلاحية الإدارة وتحميل الطلبات...");
    try {
      const rows = await request("/rest/v1/supplier_ads?select=id,business_name,category,title,description,image_url,target_url,contact_phone,plan_code,requested_days,created_at&status=eq.pending&order=created_at.asc");
      render(rows);
      await loadPendingPropertyDocuments();
      setStatus("تم التحقق من الصلاحيات وتحميل طلبات المراجعة ومستندات العقارات.");
    } catch (error) {
      list.innerHTML = "";
      setStatus(/غير مصرح|permission|row-level|policy|401|403/i.test(error.message)
        ? "هذا الحساب غير مخوّل للإدارة. يلزم إضافة معرّف حسابك إلى قائمة مديري LAYAN من لوحة Supabase الآمنة."
        : error.message);
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
      localStorage.setItem(sessionKey, JSON.stringify(session));
      showState(true);
      await loadPending();
    } catch (error) {
      setStatus("تعذر تسجيل الدخول: " + error.message);
    } finally { button.disabled = false; }
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
    try { if (session?.access_token) await request("/auth/v1/logout", {method:"POST"}); } catch (_) {}
    session = null;
    localStorage.removeItem(sessionKey);
    showState(false);
    setStatus("تم تسجيل الخروج.");
  });
  showState(Boolean(session?.access_token && session?.user?.id));
  if (session?.access_token) loadPending();
});