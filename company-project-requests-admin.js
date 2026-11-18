document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $ = id => document.getElementById(id);
  const config = window.LAYAN_CONFIG || {};
  const base = String(config.SUPABASE_URL || "").replace(/\/$/, "");
  const key = config.SUPABASE_PUBLISHABLE_KEY || "";
  const auth = window.LAYAN_SUPABASE;
  let session = auth?.getSession?.() || null;

  const loginPanel = $("cprLoginPanel");
  const panel = $("cprAdminPanel");
  const status = $("cprStatus");
  const list = $("cprRequestsList");
  const count = $("cprCount");
  const filter = $("cprStatusFilter");
  const logout = $("cprLogout");
  const refresh = $("cprRefresh");

  const statusLabels = {
    pending: "قيد مراجعة الإدارة",
    needs_changes: "مطلوب استكمال",
    rejected: "لم تتم الموافقة",
    approved: "تم الاعتماد"
  };
  const relationLabels = {
    developer: "المطور / الجهة المطورة",
    land_owner: "مالك الأرض",
    marketing_agent: "وكيل تسويق",
    sales_agent: "وكيل مبيعات",
    contractor: "مقاول",
    consultant: "استشاري",
    operator: "جهة تشغيل",
    public_authority: "جهة عامة",
    other: "جهة مرتبطة"
  };
  const typeLabels = {
    residential: "سكني", commercial: "تجاري", administrative: "إداري",
    medical: "طبي", educational: "تعليمي", mixed_use: "متعدد الاستخدامات",
    land: "أرض", service: "خدمي", other: "أخرى"
  };
  const projectStatusLabels = {
    announced: "معلن عنه", planned: "مخطط", under_construction: "تحت التنفيذ",
    partially_delivered: "تسليم مرحلي", completed: "مكتمل",
    operating: "يعمل", stalled: "متوقف", unknown: "غير محدد"
  };

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }

  function say(message) {
    status.textContent = message || "";
  }

  function setState(isAdmin) {
    loginPanel.hidden = isAdmin;
    panel.hidden = !isAdmin;
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch (_) {
      return "";
    }
  }

  async function fresh() {
    if (!session?.access_token) session = auth?.getSession?.() || null;
    if (!session?.access_token) throw new Error("سجّل الدخول أولًا.");
    if (Number(session.expires_at || 0) <= Math.floor(Date.now() / 1000) + 60) {
      if (!auth?.requireAuthenticated) throw new Error("انتهت الجلسة. سجّل الدخول مرة أخرى.");
      session = await auth.requireAuthenticated();
    }
  }

  async function api(path, options = {}) {
    if (!base || !key) throw new Error("إعدادات الاتصال بقاعدة البيانات غير مكتملة.");
    await fresh();
    let response;
    try {
      response = await fetch(base + path, {
        ...options,
        headers: {
          apikey: key,
          Authorization: "Bearer " + session.access_token,
          "Content-Type": "application/json",
          ...(options.headers || {})
        }
      });
    } catch (_) {
      throw new Error("تعذر الاتصال بقاعدة البيانات. تحقق من الاتصال وحاول مرة أخرى.");
    }
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = raw; }
    if (!response.ok) {
      const detail = data?.message || data?.details || data?.hint || data?.error_description || data?.error;
      throw new Error(detail || ("تعذر تنفيذ الطلب (HTTP " + response.status + ")."));
    }
    return data;
  }

  async function rpc(name, body) {
    return api("/rest/v1/rpc/" + name, { method: "POST", body: JSON.stringify(body || {}) });
  }

  async function requireAdmin() {
    await fresh();
    const isAdmin = await rpc("layan_is_admin", {});
    if (isAdmin !== true) {
      throw new Error("هذا الحساب مسجل، لكنه غير مخوّل لمراجعة طلبات المشروعات.");
    }
  }

  function appendDetail(parent, label, value) {
    const cell = el("div");
    cell.append(el("span", label), el("strong", value || "—"));
    parent.append(cell);
  }

  function renderCard(row) {
    const card = el("article", undefined, "cpr-card");
    const head = el("div", undefined, "cpr-card-head");
    const title = row.request_type === "new_project" ? "طلب إضافة مشروع جديد" : "طلب ربط بمشروع منشور";
    head.append(el("h2", title));
    head.append(el("span", statusLabels[row.status] || "حالة غير محددة", "cpr-badge " + (row.status || "")));
    card.append(head);

    const name = row.project_name || row.project_payload?.name_ar || "مشروع دون اسم";
    card.append(el("p", "المشروع: " + name));
    card.append(el("p", "ملف الشركة: " + (row.entity_name || "غير محدد")));

    const details = el("div", undefined, "cpr-details");
    appendDetail(details, "صفة الشركة", relationLabels[row.requested_relation_type] || row.requested_relation_type);
    appendDetail(details, "مقدم الطلب", row.requester_role === "owner" ? "المالك المعتمد" : "مدير ملف مفوض");
    appendDetail(details, "تاريخ الطلب", row.created_at ? new Date(row.created_at).toLocaleString("ar-EG") : "—");
    if (row.request_type === "new_project") {
      const payload = row.project_payload || {};
      appendDetail(details, "نوع المشروع", typeLabels[payload.project_type] || payload.project_type || "—");
      appendDetail(details, "حالة المشروع", projectStatusLabels[payload.project_status] || "غير محدد");
      appendDetail(details, "المساحة", payload.size_value ? String(payload.size_value) + " " + (payload.size_unit || "") : "—");
      appendDetail(details, "عدد الوحدات", payload.unit_count ?? "—");
      appendDetail(details, "وصف الموقع", payload.location_text || "—");
      if (payload.description) card.append(el("p", "وصف مقدم الطلب: " + payload.description));
    }
    card.append(details);

    if (row.evidence_description) card.append(el("p", "دليل العلاقة: " + row.evidence_description));
    const evidenceUrl = safeUrl(row.evidence_url);
    if (evidenceUrl) {
      const evidence = el("p", undefined, "cpr-evidence");
      evidence.append("رابط الدليل: ");
      const anchor = el("a", "فتح رابط الدليل");
      anchor.href = evidenceUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      evidence.append(anchor);
      card.append(evidence);
    }
    if (row.admin_notes) card.append(el("p", "ملاحظة المراجعة السابقة: " + row.admin_notes));

    if (row.resulting_project_id && row.request_type === "new_project") {
      card.append(el("p", "سجل المشروع الداخلي: " + row.resulting_project_id + " — لا يزال غير منشور لحين استكمال المراجع والتحقق."));
    }
    if (row.status === "pending") {
      const note = makeNotes();
      card.append(note);
      const actions = el("div", undefined, "cpr-actions");
      const approveLabel = row.request_type === "new_project" ? "اعتماد وإنشاء سجل داخلي" : "اعتماد ربط الشركة";
      const approve = el("button", approveLabel, "btn btn-gold");
      const changes = el("button", "طلب استكمال البيانات", "btn btn-outline-dark");
      const reject = el("button", "رفض الطلب", "btn btn-outline-dark");
      approve.type = changes.type = reject.type = "button";
      approve.addEventListener("click", () => review(row, "approve", note.value, [approve, changes, reject]));
      changes.addEventListener("click", () => review(row, "needs_changes", note.value, [approve, changes, reject]));
      reject.addEventListener("click", () => review(row, "reject", note.value, [approve, changes, reject]));
      actions.append(approve, changes, reject);
      card.append(actions);
    }
    return card;
  }

  function makeNotes() {
    const label = el("label", "ملاحظة الإدارة (إلزامية عند طلب الاستكمال أو الرفض)");
    const area = el("textarea");
    area.maxLength = 1200;
    area.placeholder = "اكتب ما يلزم استكماله أو سبب القرار...";
    label.append(area);
    return area;
  }

  async function review(row, action, notes, buttons) {
    if (action !== "approve" && String(notes || "").trim().length < 3) {
      say("اكتب ملاحظة لا تقل عن 3 أحرف لطلب الاستكمال أو رفض الطلب.");
      return;
    }
    const question = action === "approve"
      ? (row.request_type === "new_project"
        ? "اعتماد الطلب وإنشاء سجل داخلي غير منشور للمشروع؟"
        : "اعتماد علاقة الشركة بالمشروع المنشور؟")
      : action === "needs_changes"
        ? "إعادة الطلب للشركة مع ملاحظة استكمال البيانات؟"
        : "رفض طلب إدارة المشروع؟";
    if (!window.confirm(question)) return;

    buttons.forEach(button => { button.disabled = true; });
    say("جارٍ حفظ قرار المراجعة...");
    try {
      await rpc("company_project_request_admin_review", {
        p_request_id: row.request_id,
        p_action: action,
        p_admin_notes: String(notes || "").trim() || null
      });
      say(action === "approve"
        ? "تم اعتماد الطلب. مشروع جديد تم إنشاؤه كسجل داخلي غير منشور، أو تم اعتماد الربط حسب نوع الطلب."
        : action === "needs_changes"
          ? "تم إرسال ملاحظة الاستكمال إلى صاحب الطلب."
          : "تم رفض الطلب.");
      await load();
    } catch (error) {
      say(error.message || "تعذر حفظ قرار المراجعة.");
      buttons.forEach(button => { button.disabled = false; });
    }
  }

  async function load() {
    list.replaceChildren(el("p", "جارٍ تحميل الطلبات...", "cpr-empty"));
    try {
      const rows = await rpc("company_project_request_admin_list", {});
      const all = Array.isArray(rows) ? rows : [];
      const selected = filter.value;
      const visible = selected ? all.filter(row => row.status === selected) : all;
      count.textContent = "إجمالي الطلبات: " + all.length + " · المعروضة: " + visible.length;
      list.replaceChildren();
      if (!visible.length) {
        list.append(el("p", "لا توجد طلبات تطابق حالة المراجعة المحددة.", "cpr-empty"));
        return;
      }
      visible.forEach(row => list.append(renderCard(row)));
    } catch (error) {
      list.replaceChildren(el("p", error.message || "تعذر تحميل طلبات المشروعات.", "cpr-empty"));
      throw error;
    }
  }

  $("cprLoginForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type=submit]");
    button.disabled = true;
    say("جارٍ تسجيل الدخول والتحقق من صلاحية الإدارة...");
    try {
      if (!auth?.signIn) throw new Error("خدمة تسجيل الدخول غير جاهزة.");
      await auth.signIn($("cprEmail").value.trim(), $("cprPassword").value);
      session = auth.getSession?.() || null;
      await requireAdmin();
      setState(true);
      await load();
      say("تم التحقق من صلاحية الإدارة.");
    } catch (error) {
      session = null;
      setState(false);
      say(error.message || "تعذر تسجيل الدخول أو التحقق من الصلاحية.");
    } finally {
      button.disabled = false;
    }
  });

  logout.addEventListener("click", async () => {
    try {
      await auth?.signOut?.();
      session = null;
      setState(false);
      say("تم تسجيل الخروج.");
    } catch (error) {
      say(error.message || "تعذر تسجيل الخروج.");
    }
  });

  refresh.addEventListener("click", () => load().catch(error => say(error.message)));
  filter.addEventListener("change", () => load().catch(error => say(error.message)));

  setState(false);
  if (session?.access_token) {
    (async () => {
      try {
        await requireAdmin();
        setState(true);
        await load();
        say("تم التحقق من صلاحية الإدارة.");
      } catch (_) {
        session = null;
        setState(false);
        say("يلزم تسجيل الدخول بحساب مسؤول معتمد.");
      }
    })();
  }
});
