document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const config = window.LAYAN_CONFIG || {};
  const base = String(config.SUPABASE_URL || "").replace(/\/$/, "");
  const key = config.SUPABASE_PUBLISHABLE_KEY || "";
  const list = document.getElementById("pendingAds");
  const status = document.getElementById("adminStatus");
  const login = document.getElementById("adminLogin");
  const email = document.getElementById("adminEmail");
  const password = document.getElementById("adminPassword");
  const authPanel = document.getElementById("authPanel");
  const reviewPanel = document.getElementById("reviewPanel");
  const sessionKey = "layanSupabaseSession";
  const readSession = () => { try { return JSON.parse(sessionStorage.getItem(sessionKey) || "null"); } catch (_) { return null; } };
  let session = readSession();
  const setStatus = message => { status.textContent = message || ""; };
  async function request(path, options = {}) {
    if (!base || !key) throw new Error("إعدادات قاعدة البيانات غير مكتملة.");
    const response = await fetch(base + path, {
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
    if (!response.ok) throw new Error(data?.message || data?.details || data?.hint || "تعذر تنفيذ الطلب.");
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
      '<p><strong>الهاتف:</strong> ' + esc(ad.contact_phone) + '</p><p><strong>الخطة:</strong> ' + (ad.plan_code === "trial_30" ? "تجربة مجانية 30 يومًا" : esc(ad.plan_code)) + '</p>' +
      (ad.image_url ? '<p><a href="' + esc(ad.image_url) + '" target="_blank" rel="noopener noreferrer">عرض صورة الإعلان</a></p>' : '') +
      (ad.target_url ? '<p><a href="' + esc(ad.target_url) + '" target="_blank" rel="noopener noreferrer">رابط النشاط</a></p>' : '') +
      '</div><div class="admin-actions"><button type="button" class="btn btn-gold" data-action="approve" ' + (ad.plan_code === "trial_30" ? "" : "disabled") + '>اعتماد التجربة المجانية</button>' +
      '<button type="button" class="btn btn-outline-dark" data-action="reject">رفض الطلب</button></div></article>').join("");
  }
  async function loadPending() {
    setStatus("جارٍ التحقق من صلاحية الإدارة وتحميل الطلبات...");
    try {
      const rows = await request("/rest/v1/supplier_ads?select=id,business_name,category,title,description,image_url,target_url,contact_phone,plan_code,requested_days,requested_price,created_at&status=eq.pending&order=created_at.asc");
      render(rows);
      setStatus("تم التحقق من الصلاحيات وتحميل طلبات المراجعة.");
    } catch (error) {
      list.innerHTML = "";
      setStatus(/غير مصرح|permission|row-level|policy|401|403/i.test(error.message)
        ? "هذا الحساب غير مخوّل للإدارة. يلزم إضافة معرّف حسابك إلى قائمة مديري LAYAN من لوحة Supabase الآمنة."
        : error.message);
    }
  }
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
      if (button.dataset.action === "approve") {
        if (!window.confirm("اعتماد هذا الإعلان وتفعيله مجانًا لمدة 30 يومًا؟")) return;
        await request("/rest/v1/rpc/layan_approve_free_trial_ad", {method:"POST",body:JSON.stringify({p_ad_id:id})});
        setStatus("تم اعتماد الإعلان وتفعيل التجربة المجانية لمدة 30 يومًا.");
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
    sessionStorage.removeItem(sessionKey);
    showState(false);
    setStatus("تم تسجيل الخروج.");
  });
  showState(Boolean(session?.access_token && session?.user?.id));
  if (session?.access_token) loadPending();
});