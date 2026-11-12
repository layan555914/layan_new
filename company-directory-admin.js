document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const config = window.LAYAN_CONFIG || {};
  const base = String(config.SUPABASE_URL || "").replace(/\/$/, "");
  const key = config.SUPABASE_PUBLISHABLE_KEY || "";
  const auth = window.LAYAN_SUPABASE;
  const $ = id => document.getElementById(id);
  const login = $("claimAdminLogin");
  const panel = $("claimAdminPanel");
  const loginStatus = $("claimAdminLoginStatus");
  const status = $("claimAdminStatus");
  const list = $("claimAdminRequests");
  let session = auth?.getSession?.() || null;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[ch]);
  async function api(path, options = {}) {
    if (!base || !key) throw new Error("إعدادات الاتصال بقاعدة البيانات غير مكتملة.");
    session = auth?.getSession?.() || session;
    if (!session?.access_token) throw new Error("سجّل الدخول بحساب الإدارة.");
    const response = await fetch(base + "/rest/v1/" + path, {
      ...options,
      headers: { apikey:key, Authorization:"Bearer "+session.access_token,
        "Content-Type":"application/json", ...(options.headers || {}) }
    });
    const raw = await response.text();
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch (_) {}
    if (!response.ok) throw new Error(body?.message || body?.details || "تعذر تنفيذ الطلب.");
    return body;
  }
  async function requireAdmin() {
    const result = await api("rpc/layan_is_admin", {method:"POST",body:"{}"});
    if (result !== true) throw new Error("هذا الحساب ليس لديه صلاحية إدارة الدليل.");
    login.hidden = true;
    panel.hidden = false;
  }
  async function load() {
    status.textContent = "جارٍ تحميل طلبات الاستلام...";
    list.innerHTML = '<p class="company-directory-state">جارٍ التحميل...</p>';
    const [claims, entries] = await Promise.all([
      api("company_directory_claim_requests?select=id,entry_id,claimant_id,claimant_name,claimant_role,contact_phone,proof_note,proof_url,status,created_at&status=eq.pending&order=created_at.asc"),
      api("company_directory_entries?select=id,slug,company_name,category,city,public_address,public_phone&is_published=eq.true")
    ]);
    const entryMap = new Map((entries || []).map(item => [item.id,item]));
    const pending = (claims || []).filter(item => entryMap.has(item.entry_id));
    list.innerHTML = pending.length ? pending.map(item => {
      const company = entryMap.get(item.entry_id);
      const proof = item.proof_url ? '<p><strong>رابط الإثبات:</strong> <a target="_blank" rel="noopener noreferrer" href="' + esc(item.proof_url) + '">فتح الرابط ↗</a></p>' : '';
      return '<article class="company-directory-card" data-claim="' + esc(item.id) + '"><div class="company-directory-card-body">' +
        '<span class="company-card-status">طلب استلام قيد المراجعة</span><h3>' + esc(company.company_name) + '</h3>' +
        '<p><strong>مقدم الطلب:</strong> ' + esc(item.claimant_name) + '</p>' +
        '<p><strong>الصفة:</strong> ' + esc(item.claimant_role) + '</p>' +
        '<p><strong>رقم التواصل:</strong> <a href="tel:' + esc(String(item.contact_phone).replace(/[^+0-9]/g,'')) + '">' + esc(item.contact_phone) + '</a></p>' +
        '<p><strong>بيان الإثبات:</strong> ' + esc(item.proof_note) + '</p>' + proof +
        '<p><strong>عنوان الصفحة:</strong> ' + esc(company.city || "أسيوط") + ' · ' + esc(company.public_address || "العنوان غير مكتمل") + '</p>' +
        '<label>ملاحظات الإدارة<textarea data-admin-note rows="2" maxlength="1200"></textarea></label>' +
        '<div class="company-contact-actions"><button class="company-contact-primary" data-decision="approve" type="button">اعتماد وربط الصفحة</button><button class="company-contact-secondary" data-decision="reject" type="button">رفض الطلب</button></div>' +
        '</div></article>';
    }).join("") : '<p class="company-directory-state">لا توجد طلبات استلام معلقة حاليًا.</p>';
    status.textContent = "عدد الطلبات المعلقة: " + pending.length;
  }
  list.addEventListener("click", async event => {
    const button = event.target.closest("button[data-decision]");
    if (!button) return;
    const card = button.closest("[data-claim]");
    const note = card.querySelector("[data-admin-note]")?.value.trim() || "";
    const decision = button.dataset.decision;
    if (decision === "approve" && !window.confirm("تأكيد صفة مقدم الطلب واعتماد استلامه لهذه الصفحة؟")) return;
    if (decision === "reject" && !window.confirm("تأكيد رفض طلب استلام الصفحة؟")) return;
    button.disabled = true;
    try {
      const result = await api("rpc/layan_review_company_directory_claim", {
        method:"POST",
        body:JSON.stringify({p_claim_id:card.dataset.claim,p_decision:decision,p_admin_notes:note || null})
      });
      if (!result || result.status !== (decision === "approve" ? "approved" : "rejected")) {
        throw new Error("لم يؤكد النظام قرار المراجعة.");
      }
      await load();
    } catch (error) {
      status.textContent = error.message || "تعذر مراجعة الطلب.";
      button.disabled = false;
    }
  });
  $("claimAdminRefresh").addEventListener("click", () => load().catch(e => status.textContent = e.message));
  $("claimAdminLogout").addEventListener("click", async () => {
    try { await auth?.signOut?.(); } finally { session=null; login.hidden=false; panel.hidden=true; }
  });
  $("claimAdminLoginForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    loginStatus.textContent = "جارٍ التحقق من حساب الإدارة...";
    try {
      if (!auth?.signIn) throw new Error("خدمة تسجيل الدخول غير جاهزة.");
      await auth.signIn($("claimAdminEmail").value.trim(), $("claimAdminPassword").value);
      session = auth.getSession?.() || null;
      await requireAdmin();
      await load();
    } catch (error) {
      loginStatus.textContent = error.message || "تعذر تسجيل الدخول.";
      session=null;
    } finally { button.disabled=false; }
  });
  if (session?.access_token) {
    requireAdmin().then(load).catch(() => { login.hidden=false; panel.hidden=true; });
  }
});