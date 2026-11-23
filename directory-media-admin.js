document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const cfg = window.LAYAN_CONFIG || {};
  const base = String(cfg.SUPABASE_URL || "").replace(/\/$/, "");
  const key = cfg.SUPABASE_PUBLISHABLE_KEY || "";
  const auth = window.LAYAN_SUPABASE;
  const bucket = "asyut-directory-media";
  const loginPanel = document.getElementById("mediaAdminLoginPanel");
  const panel = document.getElementById("mediaAdminPanel");
  const grid = document.getElementById("mediaAdminGrid");
  const status = document.getElementById("mediaAdminStatus");
  const globalStatus = document.getElementById("mediaAdminGlobalStatus");
  let currentSession = auth?.getSession?.() || null;
  let rows = [];

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
  function showLoggedIn(value) {
    loginPanel.hidden = value;
    panel.hidden = !value;
  }
  async function fresh() {
    if (!auth?.requireAuthenticated) throw new Error("خدمة تسجيل الدخول غير جاهزة.");
    currentSession = await auth.requireAuthenticated();
    if (!currentSession?.access_token || !currentSession?.user?.id) throw new Error("سجّل الدخول أولًا.");
    return currentSession;
  }
  async function api(path, options) {
    const session = await fresh();
    const response = await fetch(base + path, {
      ...options,
      headers: {
        apikey:key,
        Authorization:"Bearer " + session.access_token,
        ...(options?.headers || {})
      }
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = raw; }
    if (!response.ok) {
      throw new Error(data?.message || data?.details || data?.error || ("فشل الطلب (HTTP " + response.status + ")."));
    }
    return data;
  }
  async function requireAdmin() {
    const value = await api("/rest/v1/rpc/layan_is_admin", {
      method:"POST", headers:{"Content-Type":"application/json"}, body:"{}"
    });
    if (value !== true) throw new Error("هذا الحساب غير مخوّل لمراجعة صور الدليل.");
  }
  function encodePath(path) {
    return String(path).split("/").map(encodeURIComponent).join("/");
  }
  async function signedUrl(path) {
    const data = await api("/storage/v1/object/sign/" + bucket + "/" + encodePath(path), {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({expiresIn:3600})
    });
    const value = data?.signedURL || data?.signedUrl;
    if (!value) throw new Error("تعذر فتح الصورة للمراجعة.");
    return /^https?:\/\//i.test(value) ? value : base + (value.startsWith("/") ? value : "/" + value);
  }
  async function load() {
    status.textContent = "جارٍ تحميل الصور المرسلة للمراجعة...";
    grid.innerHTML = "";
    await requireAdmin();
    rows = await api("/rest/v1/directory_media_assets?select=id,directory_entity_id,project_id,owner_user_id,media_kind,storage_path,caption,created_at,status&status=eq.pending&order=created_at.asc&limit=100", {method:"GET"});
    rows = Array.isArray(rows) ? rows : [];
    const entityIds = [...new Set(rows.map(row => row.directory_entity_id).filter(Boolean))];
    const projectIds = [...new Set(rows.map(row => row.project_id).filter(Boolean))];
    const [entities, projects] = await Promise.all([
      entityIds.length ? api("/rest/v1/directory_entities?select=id,name_ar&id=in.(" + entityIds.join(",") + ")", {method:"GET"}) : [],
      projectIds.length ? api("/rest/v1/directory_projects?select=id,name_ar&id=in.(" + projectIds.join(",") + ")", {method:"GET"}) : []
    ]);
    const entityMap = new Map((entities || []).map(row => [row.id,row.name_ar]));
    const projectMap = new Map((projects || []).map(row => [row.id,row.name_ar]));
    const kindLabels = {
      entity_logo:"شعار جهة",entity_cover:"غلاف الشركة",entity_gallery:"صور الشركة والأعمال",
      service_gallery:"صور الخدمات",project_gallery:"صور المشروع"
    };
    const cards = [];
    for (const row of rows) {
      let image = "";
      try { image = await signedUrl(row.storage_path); }
      catch (error) { console.warn("Media review image unavailable:", row.id, error); }
      cards.push('<article class="media-admin-card" data-media-id="' + esc(row.id) + '">' +
        (image ? '<img src="' + esc(image) + '" alt="صورة قيد المراجعة" loading="lazy">' : '<p>تعذر تحميل معاينة الصورة.</p>') +
        '<h3>' + esc(entityMap.get(row.directory_entity_id) || "جهة غير معروفة") + '</h3>' +
        (row.project_id ? '<p>المشروع: ' + esc(projectMap.get(row.project_id) || "مشروع غير معروف") + '</p>' : "") +
        '<p>النوع: ' + esc(kindLabels[row.media_kind] || row.media_kind) + '</p>' +
        '<p>تاريخ الإرسال: ' + esc(new Date(row.created_at).toLocaleString("ar-EG")) + '</p>' +
        '<p>وصف المرسل: ' + esc(row.caption || "بدون وصف") + '</p>' +
        '<label>ملاحظة المراجعة<textarea data-review-note maxlength="1200" placeholder="سبب الرفض أو ملاحظة داخلية عند الحاجة"></textarea></label>' +
        '<div class="media-admin-actions"><button type="button" class="btn btn-gold" data-media-action="approve">اعتماد وإظهار</button>' +
        '<button type="button" class="btn btn-outline" data-media-action="reject">رفض</button></div></article>');
    }
    grid.innerHTML = cards.join("");
    status.textContent = rows.length ? "عدد الصور قيد المراجعة: " + rows.length : "لا توجد صور جديدة قيد المراجعة.";
  }
  async function review(id, action, note) {
    const session = await fresh();
    const nextStatus = action === "approve" ? "approved" : "rejected";
    await api("/rest/v1/directory_media_assets?id=eq." + encodeURIComponent(id) + "&status=eq.pending", {
      method:"PATCH",
      headers:{"Content-Type":"application/json","Prefer":"return=minimal"},
      body:JSON.stringify({
        status:nextStatus,
        review_note:String(note || "").trim() || null,
        reviewed_by:session.user.id,
        reviewed_at:new Date().toISOString(),
        updated_at:new Date().toISOString()
      })
    });
  }
  document.getElementById("mediaAdminLogin").addEventListener("submit", async event => {
    event.preventDefault();
    const button = event.target.querySelector("button[type=submit]");
    button.disabled = true;
    globalStatus.textContent = "جارٍ التحقق من حساب الإدارة...";
    try {
      await auth.signIn(document.getElementById("mediaAdminEmail").value.trim(), document.getElementById("mediaAdminPassword").value);
      await requireAdmin();
      showLoggedIn(true);
      await load();
      globalStatus.textContent = "تم التحقق من صلاحية الإدارة.";
    } catch (error) {
      showLoggedIn(false);
      globalStatus.textContent = error.message || "تعذر تسجيل الدخول.";
    } finally { button.disabled = false; }
  });
  document.getElementById("mediaAdminRefresh").addEventListener("click", async () => {
    try { await load(); } catch (error) { status.textContent = error.message || "تعذر تحديث القائمة."; }
  });
  grid.addEventListener("click", async event => {
    const button = event.target.closest("[data-media-action]");
    const card = event.target.closest("[data-media-id]");
    if (!button || !card) return;
    button.disabled = true;
    const note = card.querySelector("[data-review-note]")?.value || "";
    try {
      await review(card.dataset.mediaId, button.dataset.mediaAction, note);
      card.remove();
      rows = rows.filter(row => row.id !== card.dataset.mediaId);
      status.textContent = button.dataset.mediaAction === "approve"
        ? "تم اعتماد الصورة. ستظهر للزوار إذا كان ملف الجهة والمشروع منشورًا."
        : "تم رفض الصورة، ولن تظهر للزوار.";
      if (!grid.children.length) status.textContent = "لا توجد صور جديدة قيد المراجعة.";
    } catch (error) {
      status.textContent = error.message || "تعذر حفظ قرار المراجعة.";
      button.disabled = false;
    }
  });
  showLoggedIn(false);
  if (currentSession?.access_token) {
    (async () => {
      try { await requireAdmin(); showLoggedIn(true); await load(); }
      catch (_) { showLoggedIn(false); }
    })();
  }
});