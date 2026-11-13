// ASYUT AQAR — private advertiser / sponsor CRM for the administration panel.
// Reads are available to the existing admin team; writes by added admins are routed
// through admin-approval.js and must be executed by an owner after approval.
(() => {
  "use strict";
  const root = document.getElementById("adminCrm");
  if (!root) return;

  const $ = (selector, parent = root) => parent.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
  const date = value => value
    ? new Date(value).toLocaleString("ar-EG-u-nu-latn", { dateStyle: "medium", timeStyle: "short" })
    : "—";
  const localInputDate = value => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const shifted = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return shifted.toISOString().slice(0, 16);
  };
  // Phase 1 is limited to real-estate companies and real-estate commercial partners.
  // Service providers, suppliers, finishing and furniture categories are deferred to phase 2.
  const categoryLabels = {
    developer: "مطور عقاري",
    brokerage: "شركة تسويق / وساطة",
    real_estate_office: "مكتب عقاري",
    bank_finance: "بنك / تمويل عقاري",
    potential_sponsor: "راعٍ محتمل",
    other: "جهة عقارية أخرى"
  };
  const stageLabels = {
    new: "جديد",
    contacted: "تم التواصل",
    interested: "مهتم",
    follow_up: "متابعة لاحقة",
    negotiation: "تفاوض",
    converted: "تعاقد / تحويل",
    not_interested: "غير مهتم"
  };
  const activityLabels = {
    call: "مكالمة",
    whatsapp: "واتساب",
    meeting: "اجتماع",
    email: "بريد إلكتروني",
    note: "ملاحظة",
    stage_change: "تغيير مرحلة",
    created: "إنشاء السجل",
    archived: "أرشفة"
  };
  let api = null;
  let ready = false;
  let busy = false;
  let leads = [];
  let admins = [];
  let filters = { search: "", stage: "all", category: "all", due: "all" };
  let expandedLeadId = null;
  let timelineCache = new Map();

  const rpc = async (name, body = {}) => {
    if (!api?.request) throw new Error("جلسة الإدارة غير جاهزة. سجّل الدخول مرة أخرى.");
    return api.request("/rest/v1/rpc/" + name, {
      method: "POST",
      body: JSON.stringify(body)
    });
  };
  const setStatus = message => api?.setStatus?.(message);
  const statusMessage = error => String(error?.message || error || "تعذر تنفيذ العملية.");

  function getFilterValues() {
    const form = $("#crmFilters");
    if (!form) return filters;
    const data = new FormData(form);
    return {
      search: String(data.get("search") || "").trim(),
      stage: String(data.get("stage") || "all"),
      category: String(data.get("category") || "all"),
      due: String(data.get("due") || "all")
    };
  }

  async function loadAdmins() {
    try {
      const rows = await rpc("layan_admin_list_admins", {});
      admins = Array.isArray(rows) ? rows : [];
    } catch (_) {
      admins = [];
    }
  }

  async function loadSummary() {
    const box = $("#crmSummary");
    if (!box) return;
    try {
      const data = await rpc("layan_admin_list_crm_summary", {});
      const items = [
        ["total", "إجمالي الجهات"],
        ["overdue", "متابعات متأخرة"],
        ["today", "متابعات اليوم"],
        ["interested", "مهتمون / تفاوض"],
        ["converted", "تم التعاقد"]
      ];
      box.innerHTML = items.map(([key, label]) =>
        '<div><strong>' + esc(Number(data?.[key] || 0).toLocaleString("en-US")) +
        '</strong><span>' + label + "</span></div>"
      ).join("");
      box.classList.toggle("has-overdue", Number(data?.overdue || 0) > 0);
    } catch (error) {
      box.innerHTML = '<p class="admin-empty">' + esc(statusMessage(error)) + "</p>";
    }
  }

  function dueState(value) {
    if (!value) return "";
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return "";
    const now = Date.now();
    if (time < now) return "is-overdue";
    const dueDate = new Date(value);
    const today = new Date();
    if (dueDate.getFullYear() === today.getFullYear()
        && dueDate.getMonth() === today.getMonth()
        && dueDate.getDate() === today.getDate()) return "is-today";
    return "";
  }

  function renderLeads() {
    const list = $("#crmLeads");
    if (!list) return;
    if (!leads.length) {
      list.innerHTML = '<p class="admin-empty">لا توجد جهات مطابقة للفلاتر الحالية. أضف جهة جديدة أو غيّر الفلاتر.</p>';
      return;
    }
    list.innerHTML = leads.map(lead => {
      const assigned = admins.find(item => item.user_id === lead.assigned_to);
      const dueClass = dueState(lead.next_follow_up_at);
      const expanded = expandedLeadId === lead.id;
      return `
        <article class="admin-crm-lead ${dueClass}" data-crm-lead="${esc(lead.id)}">
          <div class="admin-crm-lead-main">
            <div class="admin-crm-lead-title">
              <div><span class="admin-crm-category">${esc(categoryLabels[lead.category] || lead.category)}</span>
                <h3>${esc(lead.name)}</h3>
                <p>${esc(lead.contact_name || "بدون مسؤول تواصل")}${lead.region ? " · " + esc(lead.region) : ""}</p>
              </div>
              <span class="admin-crm-stage stage-${esc(lead.stage)}">${esc(stageLabels[lead.stage] || lead.stage)}</span>
            </div>
            <div class="admin-crm-meta">
              <span>${lead.phone ? "هاتف: " + esc(lead.phone) : "لا يوجد هاتف"}</span>
              <span>المتابع: ${esc(lead.assigned_to_email || "غير محدد")}</span>
              <span>آخر تواصل: ${esc(date(lead.last_contact_at))}</span>
              <span class="${dueClass}">المتابعة القادمة: ${esc(date(lead.next_follow_up_at))}</span>
              <span>${esc(String(lead.activities_count || 0))} تواصل / ملاحظة</span>
            </div>
            <div class="admin-crm-actions">
              <button type="button" class="btn btn-outline-dark" data-crm-edit="${esc(lead.id)}">تعديل البيانات</button>
              <button type="button" class="btn btn-outline-dark" data-crm-timeline="${esc(lead.id)}">${expanded ? "إخفاء السجل" : "سجل التواصل"}</button>
              <button type="button" class="btn btn-outline-dark" data-crm-archive="${esc(lead.id)}">أرشفة</button>
            </div>
            ${expanded ? '<div class="admin-crm-history" data-crm-history="' + esc(lead.id) + '"><p class="admin-empty">جارٍ تحميل سجل التواصل...</p></div>' : ""}
          </div>
        </article>
      `;
    }).join("");
    if (expandedLeadId) loadTimeline(expandedLeadId);
  }

  async function loadLeads() {
    if (!ready || busy) return;
    busy = true;
    const list = $("#crmLeads");
    if (list) list.innerHTML = '<p class="admin-empty">جارٍ تحميل سجل العلاقات التجارية...</p>';
    filters = getFilterValues();
    try {
      const [rows] = await Promise.all([
        rpc("layan_admin_list_crm_leads", {
          p_search: filters.search || null,
          p_stage: filters.stage,
          p_category: filters.category,
          p_due: filters.due,
          p_limit: 500
        }),
        loadSummary(),
        loadAdmins()
      ]);
      leads = Array.isArray(rows) ? rows : [];
      renderLeads();
    } catch (error) {
      leads = [];
      if (list) list.innerHTML = '<p class="admin-empty">' + esc(statusMessage(error)) + "</p>";
    } finally {
      busy = false;
    }
  }

  function field(name, label, value, type = "text", options = null, required = false) {
    const safeValue = esc(value ?? "");
    const control = options
      ? '<select name="' + name + '">' + options.map(([key, text]) =>
          '<option value="' + esc(key) + '"' + (String(key) === String(value ?? "") ? " selected" : "") + ">" + esc(text) + "</option>"
        ).join("") + "</select>"
      : '<input type="' + type + '" name="' + name + '" value="' + safeValue + '"' +
          (required ? " required" : "") + (type === "datetime-local" ? "" : "") + ">";
    return '<label>' + label + control + "</label>";
  }

  function renderEditor(lead = null) {
    const host = $("#crmLeadEditor");
    if (!host) return;
    const editing = Boolean(lead);
    const assignmentOptions = [["", "غير محدد"], ...admins.map(item => [
      item.user_id,
      (item.role === "owner" ? "مدير: " : "مشرف: ") + (item.email || item.user_id)
    ])];
    host.hidden = false;
    host.innerHTML = `
      <form class="admin-crm-editor" id="crmLeadForm">
        <div class="admin-crm-editor-head">
          <h3>${editing ? "تعديل جهة المتابعة" : "إضافة جهة جديدة"}</h3>
          <button type="button" class="admin-crm-close" data-crm-close aria-label="إغلاق">×</button>
        </div>
        <div class="admin-crm-form-grid">
          ${field("p_name", "اسم الشركة / الجهة *", lead?.name || "", "text", null, true)}
          ${field("p_category", "نوع الجهة", lead?.category || "potential_sponsor", "select", Object.entries(categoryLabels))}
          ${field("p_contact_name", "اسم مسؤول التواصل", lead?.contact_name || "")}
          ${field("p_phone", "رقم الهاتف", lead?.phone || "","tel")}
          ${field("p_whatsapp", "واتساب", lead?.whatsapp || "","tel")}
          ${field("p_email", "البريد الإلكتروني", lead?.email || "","email")}
          ${field("p_website", "الموقع الإلكتروني", lead?.website || "","url")}
          ${field("p_region", "المحافظة / المنطقة", lead?.region || "")}
          ${field("p_source", "مصدر جهة الاتصال", lead?.source || "")}
          ${field("p_stage", "مرحلة المتابعة", lead?.stage || "new", "select", Object.entries(stageLabels))}
          ${field("p_assigned_to", "مسؤول المتابعة", lead?.assigned_to || "", "select", assignmentOptions)}
          ${field("p_next_follow_up_at", "موعد المتابعة القادم", localInputDate(lead?.next_follow_up_at), "datetime-local")}
          <label class="crm-wide">اهتمام الجهة / ما تبحث عنه<textarea name="p_interest" rows="2">${esc(lead?.interest || "")}</textarea></label>
          <label class="crm-wide">العرض المناسب لها<textarea name="p_suitable_offer" rows="2">${esc(lead?.suitable_offer || "")}</textarea></label>
          <label class="crm-wide">ملاحظات داخلية<textarea name="p_notes" rows="3">${esc(lead?.notes || "")}</textarea></label>
        </div>
        <div class="admin-crm-editor-actions">
          <button type="submit" class="btn btn-gold">${editing ? "حفظ التعديلات" : "حفظ الجهة"}</button>
          <button type="button" class="btn btn-outline-dark" data-crm-close>إلغاء</button>
        </div>
        <p class="admin-crm-private-note">بيانات داخلية لفريق الإدارة فقط. لن يتم إرسال أي رسالة أو إجراء اتصال تلقائيًا.</p>
      </form>
    `;
    host.scrollIntoView({ behavior: "smooth", block: "start" });
    $("input[name='p_name']", host)?.focus();
  }

  function closeEditor() {
    const host = $("#crmLeadEditor");
    if (host) { host.hidden = true; host.innerHTML = ""; }
  }

  async function saveLead(form) {
    const data = new FormData(form);
    const val = key => String(data.get(key) || "").trim();
    const dateValue = val("p_next_follow_up_at");
    const id = form.dataset.leadId || null;
    const payload = {
      p_id: id,
      p_category: val("p_category"),
      p_name: val("p_name"),
      p_contact_name: val("p_contact_name") || null,
      p_phone: val("p_phone") || null,
      p_whatsapp: val("p_whatsapp") || null,
      p_email: val("p_email") || null,
      p_website: val("p_website") || null,
      p_region: val("p_region") || null,
      p_source: val("p_source") || null,
      p_interest: val("p_interest") || null,
      p_suitable_offer: val("p_suitable_offer") || null,
      p_stage: val("p_stage"),
      p_assigned_to: val("p_assigned_to") || null,
      p_next_follow_up_at: dateValue ? new Date(dateValue).toISOString() : null,
      p_notes: val("p_notes") || null
    };
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    try {
      await rpc("layan_admin_crm_save_lead", payload);
      closeEditor();
      setStatus(id ? "تم حفظ بيانات جهة المتابعة." : "تمت إضافة جهة المتابعة.");
      await loadLeads();
    } catch (error) {
      setStatus(statusMessage(error));
    } finally {
      button.disabled = false;
    }
  }

  function renderTimeline(id, rows) {
    const host = $('[data-crm-history="' + CSS.escape(id) + '"]');
    if (!host) return;
    host.innerHTML = `
      <h4>السجل الزمني للتواصل</h4>
      <div class="admin-crm-timeline">
        ${rows.length ? rows.map(item => `
          <div class="admin-crm-event">
            <span class="admin-crm-event-type">${esc(activityLabels[item.activity_type] || item.activity_type)}</span>
            <time>${esc(date(item.occurred_at))}</time>
            <p>${esc(item.notes)}</p>
            ${item.outcome ? '<small>النتيجة: ' + esc(item.outcome) + "</small>" : ""}
            ${item.actor_email ? '<small>بواسطة: ' + esc(item.actor_email) + "</small>" : ""}
          </div>
        `).join("") : '<p class="admin-empty">لم يتم تسجيل أي تواصل حتى الآن.</p>'}
      </div>
      <form class="admin-crm-activity-form" data-crm-activity-form="${esc(id)}">
        <h4>تسجيل تواصل جديد</h4>
        <div class="admin-crm-form-grid">
          ${field("activity_type", "نوع التواصل", "call", "select", [["call","مكالمة"],["whatsapp","واتساب"],["meeting","اجتماع"],["email","بريد إلكتروني"],["note","ملاحظة داخلية"]])}
          ${field("outcome", "النتيجة", "")}
          <label class="crm-wide">ملخص التواصل *
            <textarea name="notes" rows="2" required placeholder="ما الذي تم الاتفاق عليه؟ وما الخطوة التالية؟"></textarea>
          </label>
          ${field("occurred_at", "وقت التواصل", localInputDate(new Date().toISOString()), "datetime-local")}
        </div>
        <button type="submit" class="btn btn-gold">حفظ في سجل التواصل</button>
      </form>
    `;
  }

  async function loadTimeline(id) {
    const host = $('[data-crm-history="' + CSS.escape(id) + '"]');
    if (!host) return;
    try {
      const rows = await rpc("layan_admin_list_crm_activities", { p_lead_id: id, p_limit: 100 });
      const list = Array.isArray(rows) ? rows : [];
      timelineCache.set(id, list);
      renderTimeline(id, list);
    } catch (error) {
      host.innerHTML = '<p class="admin-empty">' + esc(statusMessage(error)) + "</p>";
    }
  }

  async function logActivity(form) {
    const data = new FormData(form);
    const id = form.dataset.crmActivityForm;
    const occurred = String(data.get("occurred_at") || "").trim();
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    try {
      await rpc("layan_admin_crm_log_activity", {
        p_lead_id: id,
        p_activity_type: String(data.get("activity_type") || "note"),
        p_outcome: String(data.get("outcome") || "").trim() || null,
        p_notes: String(data.get("notes") || "").trim(),
        p_occurred_at: occurred ? new Date(occurred).toISOString() : new Date().toISOString()
      });
      setStatus("تم تسجيل التواصل في السجل.");
      timelineCache.delete(id);
      await Promise.all([loadTimeline(id), loadSummary(), loadLeads()]);
    } catch (error) {
      setStatus(statusMessage(error));
    } finally {
      button.disabled = false;
    }
  }

  function exportCsv() {
    if (!leads.length) { setStatus("لا توجد بيانات في القائمة الحالية للتنزيل."); return; }
    const columns = [
      ["name","اسم الجهة"],["category","نوع الجهة"],["contact_name","مسؤول التواصل"],
      ["phone","الهاتف"],["whatsapp","واتساب"],["email","البريد"],
      ["website","الموقع"],["region","المنطقة"],["source","المصدر"],
      ["interest","الاهتمام"],["suitable_offer","العرض المناسب"],["stage","المرحلة"],
      ["assigned_to_email","مسؤول المتابعة"],["next_follow_up_at","موعد المتابعة"],
      ["last_contact_at","آخر تواصل"],["notes","ملاحظات داخلية"]
    ];
    const quote = value => {
      let text = String(value ?? "");
      // Third-party names/notes must stay data when opened in Excel or another spreadsheet.
      if (/^[\x00-\x20]*[=+\-@]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const csv = "\uFEFF" + [
      columns.map(([, label]) => quote(label)).join(","),
      ...leads.map(row => columns.map(([key]) =>
        quote(key === "category" ? categoryLabels[row[key]] || row[key]
          : key === "stage" ? stageLabels[row[key]] || row[key]
          : key.endsWith("_at") ? date(row[key]) : row[key])
      ).join(","))
    ].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "asyut-aqar-crm-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  root.addEventListener("click", async event => {
    const target = event.target;
    if (target.closest("#crmAddLead")) {
      renderEditor();
      return;
    }
    const close = target.closest("[data-crm-close]");
    if (close) { closeEditor(); return; }
    const edit = target.closest("[data-crm-edit]");
    if (edit) {
      const record = leads.find(item => item.id === edit.dataset.crmEdit);
      if (record) renderEditor(record);
      return;
    }
    const history = target.closest("[data-crm-timeline]");
    if (history) {
      const id = history.dataset.crmTimeline;
      expandedLeadId = expandedLeadId === id ? null : id;
      renderLeads();
      return;
    }
    const archive = target.closest("[data-crm-archive]");
    if (archive) {
      const id = archive.dataset.crmArchive;
      const record = leads.find(item => item.id === id);
      if (!record || !window.confirm("أرشفة جهة «" + record.name + "»؟ لن تظهر في قائمة المتابعة النشطة.")) return;
      archive.disabled = true;
      try {
        await rpc("layan_admin_crm_archive_lead", { p_id: id });
        setStatus("تمت أرشفة الجهة.");
        expandedLeadId = null;
        await loadLeads();
      } catch (error) {
        setStatus(statusMessage(error));
      } finally {
        archive.disabled = false;
      }
    }
  });

  root.addEventListener("submit", async event => {
    if (event.target.id === "crmFilters") {
      event.preventDefault();
      filters = getFilterValues();
      await loadLeads();
    }
    if (event.target.id === "crmLeadForm") {
      event.preventDefault();
      await saveLead(event.target);
    }
    if (event.target.matches("[data-crm-activity-form]")) {
      event.preventDefault();
      await logActivity(event.target);
    }
  });

  $("#crmExport")?.addEventListener("click", exportCsv);
  document.getElementById("adminRefreshAll")?.addEventListener("click", () => {
    if (document.querySelector('[data-view="crm"][aria-current]')) loadLeads();
  });

  async function activate() {
    api = window.AsyutAdmin || api;
    if (!api?.request) return;
    ready = true;
    await loadLeads();
  }

  window.addEventListener("asyut:admin-ready", () => {
    api = window.AsyutAdmin || null;
    if (api?.request) ready = true;
  });
  window.addEventListener("asyut:admin-view", event => {
    if (event.detail?.name === "crm") activate();
  });
})();
