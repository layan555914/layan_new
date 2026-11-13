// ASYUT AQAR — internal advertiser and sponsor CRM.
// All reads use the admin RLS policy. Writes by added admins are routed through
// admin-approval.js; the database itself permits direct writes only from owners.
(() => {
  "use strict";

  const root = document.getElementById("advertiserCrmPanel");
  if (!root) return;

  const $ = selector => root.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
  const dateLabel = value => value
    ? new Date(value).toLocaleString("ar-EG-u-nu-latn", { dateStyle: "medium", timeStyle: "short" })
    : "لم يحدد";
  const inputDate = value => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };
  const isoDate = value => value ? new Date(value).toISOString() : null;
  const digits = value => String(value || "").replace(/\D/g, "");

  const TYPES = [
    ["developer", "مطور عقاري"],
    ["brokerage", "شركة تسويق ووساطة"],
    ["real_estate_office", "مكتب عقاري"],
    ["bank_finance", "بنك أو تمويل عقاري"],
    ["building_materials", "مواد بناء"],
    ["manufacturer", "مصنع أو مورد"],
    ["finishing_furniture", "تشطيبات وأثاث"],
    ["service_provider", "مقدم خدمات"],
    ["sponsor", "راعٍ محتمل"],
    ["other", "جهة أخرى"]
  ];
  const STAGES = [
    ["new", "جديد"],
    ["contacted", "تم التواصل"],
    ["interested", "مهتم"],
    ["follow_up", "متابعة لاحقة"],
    ["negotiation", "تفاوض"],
    ["converted", "تم التعاقد"],
    ["not_interested", "غير مهتم"]
  ];
  const PRIORITIES = [["low", "عادي"], ["normal", "متوسط"], ["high", "مهم"]];
  const ACTIVITIES = [
    ["call", "مكالمة هاتفية"],
    ["whatsapp", "واتساب"],
    ["meeting", "اجتماع"],
    ["email", "بريد إلكتروني"],
    ["visit", "زيارة"],
    ["note", "ملاحظة داخلية"]
  ];
  const OUTCOMES = [
    ["completed", "تم التواصل"],
    ["no_answer", "لا يوجد رد"],
    ["interested", "أبدى اهتمامًا"],
    ["needs_details", "طلب تفاصيل"],
    ["follow_up", "طلب متابعة لاحقة"],
    ["not_interested", "غير مهتم حاليًا"],
    ["other", "نتيجة أخرى"]
  ];
  const typeLabel = value => (TYPES.find(x => x[0] === value) || [null, "جهة أخرى"])[1];
  const stageLabel = value => (STAGES.find(x => x[0] === value) || [null, "غير محدد"])[1];
  const activityLabel = value => (ACTIVITIES.find(x => x[0] === value) || [null, "نشاط"])[1];
  const outcomeLabel = value => (OUTCOMES.find(x => x[0] === value) || [null, "نتيجة أخرى"])[1];

  let A = null;
  let leads = [];
  let selectedLead = null;
  let initialized = false;
  let loading = false;

  function say(message) {
    A?.setStatus?.(message);
  }
  function pendingApproval(error) {
    return /PENDING_APPROVAL|تم إرسال طلبك إلى المدير للموافقة|سيُنفَّذ بعد موافقته/.test(
      String(error?.message || error || "")
    );
  }
  function stageOptions(selected) {
    return STAGES.map(item =>
      '<option value="' + item[0] + '"' + (item[0] === selected ? " selected" : "") + '>' +
      esc(item[1]) + "</option>"
    ).join("");
  }
  function typeOptions(selected) {
    return TYPES.map(item =>
      '<option value="' + item[0] + '"' + (item[0] === selected ? " selected" : "") + '>' +
      esc(item[1]) + "</option>"
    ).join("");
  }
  function priorityOptions(selected) {
    return PRIORITIES.map(item =>
      '<option value="' + item[0] + '"' + (item[0] === selected ? " selected" : "") + '>' +
      esc(item[1]) + "</option>"
    ).join("");
  }
  function selectOptions(items, selected, placeholder) {
    return (placeholder ? '<option value="">' + esc(placeholder) + "</option>" : "") +
      items.map(item => '<option value="' + item[0] + '"' +
        (item[0] === selected ? " selected" : "") + ">" + esc(item[1]) + "</option>").join("");
  }

  function shell() {
    root.innerHTML = [
      '<div class="crm-head-row">',
        '<div><h2>سجل الجهات التجارية</h2>',
        '<p>متابعة الشركات والمطورين والمكاتب والموردين والرعاة المحتملين في مكان واحد.</p></div>',
        '<div class="crm-actions">',
          '<button type="button" class="btn btn-gold" data-crm-new>＋ إضافة جهة</button>',
          '<button type="button" class="btn btn-outline-dark" data-crm-export>تنزيل Excel / CSV</button>',
          '<button type="button" class="btn btn-outline-dark" data-crm-reload>تحديث</button>',
        '</div>',
      '</div>',
      '<div class="crm-summary" id="crmSummary"></div>',
      '<div class="crm-toolbar">',
        '<label>بحث<input type="search" id="crmSearch" placeholder="اسم الشركة أو المسؤول أو الهاتف"></label>',
        '<label>نوع الجهة<select id="crmTypeFilter"><option value="">كل الأنواع</option>' + typeOptions("") + '</select></label>',
        '<label>مرحلة المتابعة<select id="crmStageFilter"><option value="">كل المراحل</option>' + stageOptions("") + '</select></label>',
        '<label>موعد المتابعة<select id="crmDueFilter"><option value="">كل المواعيد</option><option value="overdue">متأخر</option><option value="today">مطلوب اليوم</option><option value="upcoming">خلال 7 أيام</option><option value="none">بدون موعد</option></select></label>',
      '</div>',
      '<div id="crmEditor" class="crm-editor" hidden></div>',
      '<div id="crmDetails" class="crm-details" hidden></div>',
      '<div id="crmLeadList" class="crm-lead-list"><p class="admin-empty">جارٍ تحميل الجهات...</p></div>',
      '<p class="crm-footnote">البيانات هنا داخلية للإدارة. لا تُرسل رسائل أو مكالمات تلقائيًا؛ هذا السجل ينظم المتابعة التي ينفذها فريق أسيوط عقار.</p>'
    ].join("");
  }

  function countSummary() {
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const endToday = startToday + 86400000;
    const active = leads.filter(x => !x.archived_at);
    const overdue = active.filter(x => x.next_follow_up_at && new Date(x.next_follow_up_at).getTime() < startToday);
    const dueToday = active.filter(x => {
      if (!x.next_follow_up_at) return false;
      const t = new Date(x.next_follow_up_at).getTime();
      return t >= startToday && t < endToday;
    });
    const negotiating = active.filter(x => ["interested", "negotiation"].includes(x.stage));
    const converted = active.filter(x => x.stage === "converted");
    const items = [
      [active.length, "إجمالي الجهات"],
      [dueToday.length, "متابعة اليوم"],
      [overdue.length, "متابعة متأخرة"],
      [negotiating.length, "مهتمة أو في تفاوض"],
      [converted.length, "تم التعاقد"]
    ];
    const target = $("#crmSummary");
    if (target) target.innerHTML = items.map(item =>
      '<div class="crm-kpi"><strong>' + esc(item[0]) + "</strong><span>" + esc(item[1]) + "</span></div>"
    ).join("");
  }

  function filteredLeads() {
    const q = String($("#crmSearch")?.value || "").trim().toLowerCase();
    const type = $("#crmTypeFilter")?.value || "";
    const stage = $("#crmStageFilter")?.value || "";
    const due = $("#crmDueFilter")?.value || "";
    const now = Date.now();
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const endToday = startToday + 86400000;
    return leads.filter(lead => {
      if (lead.archived_at) return false;
      if (type && lead.organization_type !== type) return false;
      if (stage && lead.stage !== stage) return false;
      const haystack = [
        lead.organization_name, lead.contact_name, lead.contact_phone,
        lead.contact_whatsapp, lead.contact_email, lead.city, lead.area
      ].join(" ").toLowerCase();
      if (q && !haystack.includes(q)) return false;
      const dueTime = lead.next_follow_up_at ? new Date(lead.next_follow_up_at).getTime() : null;
      if (due === "none" && dueTime) return false;
      if (due === "overdue" && (!dueTime || dueTime >= startToday)) return false;
      if (due === "today" && (!dueTime || dueTime < startToday || dueTime >= endToday)) return false;
      if (due === "upcoming" && (!dueTime || dueTime < startToday || dueTime > now + 7 * 86400000)) return false;
      return true;
    });
  }

  function dueClass(value) {
    if (!value) return "crm-due-none";
    const d = new Date(value).getTime();
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (d < start) return "crm-due-late";
    if (d < start + 86400000) return "crm-due-today";
    return "crm-due-upcoming";
  }

  function renderList() {
    const target = $("#crmLeadList");
    if (!target) return;
    const rows = filteredLeads();
    if (!rows.length) {
      target.innerHTML = leads.length
        ? '<p class="admin-empty">لا توجد جهات مطابقة للبحث أو الفلتر الحالي.</p>'
        : '<div class="crm-empty"><strong>سجل المعلنين والرعاة فارغ حاليًا</strong><p>ابدأ بإضافة أول شركة أو مطور أو مكتب تريد التواصل معه.</p><button type="button" class="btn btn-gold" data-crm-new>＋ إضافة أول جهة</button></div>';
      return;
    }
    target.innerHTML = rows.map(lead => {
      const phone = lead.contact_phone ? '<span dir="ltr">' + esc(lead.contact_phone) + "</span>" : "غير مسجل";
      const whatsapp = lead.contact_whatsapp ? '<span dir="ltr">' + esc(lead.contact_whatsapp) + "</span>" : "غير مسجل";
      const place = [lead.governorate, lead.city, lead.area].filter(Boolean).join(" · ");
      return [
        '<article class="crm-lead-card" data-crm-lead-id="' + esc(lead.id) + '">',
          '<div class="crm-lead-main">',
            '<div class="crm-lead-title-row">',
              '<div><span class="crm-tag">' + esc(typeLabel(lead.organization_type)) + '</span>',
              '<h3>' + esc(lead.organization_name) + '</h3></div>',
              '<span class="crm-stage crm-stage-' + esc(lead.stage) + '">' + esc(stageLabel(lead.stage)) + "</span>",
            '</div>',
            '<div class="crm-lead-meta">',
              '<span><b>مسؤول التواصل:</b> ' + esc(lead.contact_name || "غير محدد") + "</span>",
              '<span><b>الهاتف:</b> ' + phone + "</span>",
              '<span><b>واتساب:</b> ' + whatsapp + "</span>",
              '<span><b>الموقع:</b> ' + esc(place || "غير محدد") + "</span>",
              '<span><b>آخر تواصل:</b> ' + esc(dateLabel(lead.last_contact_at)) + "</span>",
              '<span class="' + dueClass(lead.next_follow_up_at) + '"><b>المتابعة القادمة:</b> ' + esc(dateLabel(lead.next_follow_up_at)) + "</span>",
            '</div>',
            lead.interest ? '<p class="crm-interest"><b>الاهتمام:</b> ' + esc(lead.interest) + "</p>" : "",
            lead.notes ? '<p class="crm-note-preview">' + esc(lead.notes) + "</p>" : "",
          '</div>',
          '<div class="crm-lead-actions">',
            '<button type="button" class="btn btn-outline-dark" data-crm-activity="' + esc(lead.id) + '">سجل التواصل</button>',
            '<button type="button" class="btn btn-outline-dark" data-crm-edit="' + esc(lead.id) + '">تعديل البيانات</button>',
            '<button type="button" class="btn btn-outline-dark" data-crm-archive="' + esc(lead.id) + '">أرشفة</button>',
          '</div>',
        "</article>"
      ].join("");
    }).join("");
  }

  function renderAll() {
    countSummary();
    renderList();
  }

  function editor(lead) {
    const target = $("#crmEditor");
    if (!target) return;
    const item = lead || {};
    target.hidden = false;
    target.innerHTML = [
      '<form id="crmLeadForm" class="crm-form" data-crm-id="' + esc(item.id || "") + '">',
        '<div class="crm-form-head"><div><h3>' + (lead ? "تعديل بيانات الجهة" : "إضافة جهة جديدة") + '</h3><p>سجّل البيانات المتاحة فقط، ويمكن استكمال الباقي لاحقًا.</p></div><button type="button" class="btn btn-outline-dark" data-crm-cancel>إغلاق</button></div>',
        '<div class="crm-form-grid">',
          '<label>اسم الشركة أو الجهة *<input name="organization_name" required minlength="2" maxlength="180" value="' + esc(item.organization_name || "") + '"></label>',
          '<label>نوع الجهة<select name="organization_type">' + typeOptions(item.organization_type || "other") + "</select></label>",
          '<label>اسم مسؤول التواصل<input name="contact_name" maxlength="140" value="' + esc(item.contact_name || "") + '"></label>',
          '<label>رقم الهاتف<input name="contact_phone" inputmode="tel" maxlength="30" value="' + esc(item.contact_phone || "") + '"></label>',
          '<label>رقم واتساب<input name="contact_whatsapp" inputmode="tel" maxlength="30" value="' + esc(item.contact_whatsapp || "") + '"></label>',
          '<label>البريد الإلكتروني<input name="contact_email" type="email" maxlength="160" value="' + esc(item.contact_email || "") + '"></label>',
          '<label>الموقع الإلكتروني<input name="website_url" type="url" placeholder="https://" value="' + esc(item.website_url || "") + '"></label>',
          '<label>المحافظة<input name="governorate" maxlength="80" value="' + esc(item.governorate || "أسيوط") + '"></label>',
          '<label>المدينة أو المركز<input name="city" maxlength="100" value="' + esc(item.city || "") + '"></label>',
          '<label>المنطقة<input name="area" maxlength="120" value="' + esc(item.area || "") + '"></label>',
          '<label>مصدر جهة الاتصال<input name="lead_source" maxlength="160" placeholder="ترشيح، زيارة، فيسبوك..." value="' + esc(item.lead_source || "") + '"></label>',
          '<label>مرحلة المتابعة<select name="stage">' + stageOptions(item.stage || "new") + "</select></label>",
          '<label>الأولوية<select name="priority">' + priorityOptions(item.priority || "normal") + "</select></label>",
          '<label>موعد المتابعة القادم<input name="next_follow_up_at" type="datetime-local" value="' + esc(inputDate(item.next_follow_up_at)) + '"></label>',
          '<label class="crm-form-wide">العرض أو مجال الاهتمام<textarea name="interest" rows="2" maxlength="1000">' + esc(item.interest || "") + "</textarea></label>",
          '<label class="crm-form-wide">ملاحظات داخلية<textarea name="notes" rows="3" maxlength="3000">' + esc(item.notes || "") + "</textarea></label>",
        '</div>',
        '<div class="crm-form-actions"><button type="submit" class="btn btn-gold">حفظ البيانات</button><button type="button" class="btn btn-outline-dark" data-crm-cancel>إلغاء</button></div>',
        '<p class="crm-form-hint">حفظ المشرفين المضافين يمر بموافقة المدير، وفق نظام صلاحيات الإدارة الحالي.</p>',
      "</form>"
    ].join("");
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function details(leadId) {
    const lead = leads.find(x => x.id === leadId);
    if (!lead) return;
    selectedLead = lead;
    const target = $("#crmDetails");
    if (!target) return;
    target.hidden = false;
    target.innerHTML = '<div class="crm-details-head"><h3>سجل التواصل — ' + esc(lead.organization_name) + '</h3><button type="button" class="btn btn-outline-dark" data-crm-close-details>إغلاق</button></div><p class="admin-empty">جارٍ تحميل سجل التواصل...</p>';
    try {
      const rows = await A.request(
        "/rest/v1/advertiser_lead_activities?select=id,activity_type,outcome,notes,next_follow_up_at,stage_after,created_at&lead_id=eq." +
        encodeURIComponent(leadId) + "&order=created_at.desc&limit=100"
      );
      renderDetails(lead, Array.isArray(rows) ? rows : []);
    } catch (error) {
      target.innerHTML = '<div class="crm-details-head"><h3>سجل التواصل — ' + esc(lead.organization_name) + '</h3><button type="button" class="btn btn-outline-dark" data-crm-close-details>إغلاق</button></div><p class="admin-empty">' + esc(error.message || "تعذر تحميل سجل التواصل.") + "</p>";
    }
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderDetails(lead, rows) {
    const target = $("#crmDetails");
    if (!target) return;
    const timeline = rows.length ? rows.map(row => [
      '<article class="crm-activity-entry">',
        '<div class="crm-activity-heading"><strong>' + esc(activityLabel(row.activity_type)) + '</strong><span>' + esc(dateLabel(row.created_at)) + "</span></div>",
        '<p><b>النتيجة:</b> ' + esc(outcomeLabel(row.outcome)) + "</p>",
        row.notes ? '<p>' + esc(row.notes) + "</p>" : "",
        row.stage_after ? '<p><b>المرحلة بعد التواصل:</b> ' + esc(stageLabel(row.stage_after)) + "</p>" : "",
        row.next_follow_up_at ? '<p><b>المتابعة القادمة:</b> ' + esc(dateLabel(row.next_follow_up_at)) + "</p>" : "",
      "</article>"
    ].join("")).join("") : '<p class="admin-empty">لا يوجد تواصل مسجل لهذه الجهة حتى الآن.</p>';

    target.innerHTML = [
      '<div class="crm-details-head"><div><h3>سجل التواصل — ' + esc(lead.organization_name) + '</h3><p>' + esc(lead.contact_name || "بدون مسؤول تواصل") + " · " + esc(lead.contact_phone || "بدون هاتف") + '</p></div><button type="button" class="btn btn-outline-dark" data-crm-close-details>إغلاق</button></div>',
      '<form id="crmActivityForm" class="crm-activity-form" data-crm-lead-id="' + esc(lead.id) + '">',
        '<h4>تسجيل تواصل جديد</h4>',
        '<div class="crm-form-grid">',
          '<label>طريقة التواصل<select name="activity_type">' + selectOptions(ACTIVITIES, "call") + "</select></label>",
          '<label>النتيجة<select name="outcome">' + selectOptions(OUTCOMES, "completed") + "</select></label>",
          '<label>متابعة قادمة<input name="next_follow_up_at" type="datetime-local"></label>',
          '<label>تحديث مرحلة الجهة<select name="stage_after">' + selectOptions(STAGES, "", "اترك المرحلة كما هي") + "</select></label>",
          '<label class="crm-form-wide">ملاحظات التواصل<textarea name="notes" rows="2" maxlength="1600" placeholder="ملخص المكالمة أو الرسالة أو الاجتماع..."></textarea></label>',
        '</div>',
        '<div class="crm-form-actions"><button type="submit" class="btn btn-gold">حفظ سجل التواصل</button></div>',
      "</form>",
      '<div class="crm-timeline"><h4>التواصل السابق</h4>' + timeline + "</div>"
    ].join("");
  }

  async function loadLeads() {
    if (!A || loading) return;
    loading = true;
    const target = $("#crmLeadList");
    if (target) target.innerHTML = '<p class="admin-empty">جارٍ تحميل سجل المعلنين...</p>';
    try {
      const rows = await A.request(
        "/rest/v1/advertiser_leads?select=*&archived_at=is.null&order=next_follow_up_at.asc.nullslast,created_at.desc&limit=500"
      );
      leads = Array.isArray(rows) ? rows : [];
      renderAll();
    } catch (error) {
      if (target) {
        const missing = /advertiser_leads|PGRST20[02]|does not exist|404|schema cache/i.test(String(error.message || error));
        target.innerHTML = '<p class="admin-empty">' +
          (missing ? "تحتاج خاصية متابعة المعلنين إلى تفعيل تحديث قاعدة البيانات الخاص بها في بيئة الاختبار أولًا." : esc(error.message || "تعذر تحميل سجل المعلنين.")) +
          "</p>";
      }
    } finally {
      loading = false;
    }
  }

  function formValues(form) {
    const data = new FormData(form);
    return {
      organization_name: String(data.get("organization_name") || "").trim(),
      organization_type: String(data.get("organization_type") || "other"),
      contact_name: String(data.get("contact_name") || "").trim() || null,
      contact_phone: String(data.get("contact_phone") || "").trim() || null,
      contact_whatsapp: String(data.get("contact_whatsapp") || "").trim() || null,
      contact_email: String(data.get("contact_email") || "").trim() || null,
      website_url: String(data.get("website_url") || "").trim() || null,
      governorate: String(data.get("governorate") || "أسيوط").trim() || "أسيوط",
      city: String(data.get("city") || "").trim() || null,
      area: String(data.get("area") || "").trim() || null,
      lead_source: String(data.get("lead_source") || "").trim() || null,
      stage: String(data.get("stage") || "new"),
      priority: String(data.get("priority") || "normal"),
      next_follow_up_at: isoDate(data.get("next_follow_up_at")),
      interest: String(data.get("interest") || "").trim() || null,
      notes: String(data.get("notes") || "").trim() || null
    };
  }

  async function saveLead(form) {
    const id = form.dataset.crmId;
    const body = formValues(form);
    if (body.website_url && !/^https?:\/\//i.test(body.website_url)) {
      throw new Error("رابط الموقع يجب أن يبدأ بـ https:// أو http://");
    }
    try {
      if (id) {
        await A.request("/rest/v1/advertiser_leads?id=eq." + encodeURIComponent(id), {
          method: "PATCH",
          body: JSON.stringify(body),
          headers: { Prefer: "return=minimal" }
        });
        say("تم حفظ تعديلات الجهة.");
      } else {
        await A.request("/rest/v1/advertiser_leads", {
          method: "POST",
          body: JSON.stringify(body),
          headers: { Prefer: "return=representation" }
        });
        say("تمت إضافة الجهة إلى سجل المتابعة.");
      }
      $("#crmEditor").hidden = true;
      await loadLeads();
    } catch (error) {
      if (pendingApproval(error)) {
        $("#crmEditor").hidden = true;
        say("تم إرسال التغيير إلى المدير للموافقة. سيظهر بعد الاعتماد.");
        await loadLeads();
        return;
      }
      throw error;
    }
  }

  async function saveActivity(form) {
    const data = new FormData(form);
    const leadId = form.dataset.crmLeadId;
    const body = {
      lead_id: leadId,
      activity_type: String(data.get("activity_type") || "call"),
      outcome: String(data.get("outcome") || "completed"),
      notes: String(data.get("notes") || "").trim() || null,
      next_follow_up_at: isoDate(data.get("next_follow_up_at")),
      stage_after: String(data.get("stage_after") || "") || null
    };
    try {
      await A.request("/rest/v1/advertiser_lead_activities", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { Prefer: "return=minimal" }
      });
      say("تم تسجيل التواصل وتحديث موعد المتابعة.");
      await loadLeads();
      await details(leadId);
    } catch (error) {
      if (pendingApproval(error)) {
        say("تم إرسال سجل التواصل إلى المدير للموافقة. سيُسجل بعد الاعتماد.");
        return;
      }
      throw error;
    }
  }

  async function archiveLead(id) {
    const lead = leads.find(x => x.id === id);
    if (!lead || !window.confirm("أرشفة جهة " + lead.organization_name + "؟ ستختفي من القائمة النشطة ويمكن الاحتفاظ بسجلها للمراجعة.")) return;
    try {
      await A.request("/rest/v1/advertiser_leads?id=eq." + encodeURIComponent(id), {
        method: "PATCH",
        body: JSON.stringify({ archived_at: new Date().toISOString() }),
        headers: { Prefer: "return=minimal" }
      });
      say("تمت أرشفة الجهة.");
      await loadLeads();
      if (selectedLead?.id === id) $("#crmDetails").hidden = true;
    } catch (error) {
      if (pendingApproval(error)) {
        say("تم إرسال طلب الأرشفة إلى المدير للموافقة.");
        return;
      }
      throw error;
    }
  }

  function exportCsv() {
    if (!leads.length) { say("لا توجد جهات لتصديرها."); return; }
    const headers = ["اسم الجهة", "النوع", "مسؤول التواصل", "الهاتف", "واتساب", "البريد", "المحافظة", "المدينة", "المنطقة", "مصدر التواصل", "المرحلة", "الأولوية", "موعد المتابعة", "آخر تواصل", "مجال الاهتمام", "ملاحظات"];
    const rows = leads.map(x => [
      x.organization_name, typeLabel(x.organization_type), x.contact_name, x.contact_phone,
      x.contact_whatsapp, x.contact_email, x.governorate, x.city, x.area, x.lead_source,
      stageLabel(x.stage), x.priority, dateLabel(x.next_follow_up_at), dateLabel(x.last_contact_at),
      x.interest, x.notes
    ]);
    const csv = "\uFEFF" + [headers, ...rows].map(row =>
      row.map(value => '"' + String(value ?? "").replace(/"/g, '""') + '"').join(",")
    ).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "asyut-aqar-advertiser-crm-" + new Date().toISOString().slice(0, 10) + ".csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function bindEvents() {
    root.addEventListener("click", async event => {
      const target = event.target;
      if (target.closest("[data-crm-new]")) { editor(null); return; }
      if (target.closest("[data-crm-cancel]")) { $("#crmEditor").hidden = true; return; }
      if (target.closest("[data-crm-reload]")) { loadLeads(); return; }
      if (target.closest("[data-crm-export]")) { exportCsv(); return; }
      if (target.closest("[data-crm-close-details]")) { $("#crmDetails").hidden = true; selectedLead = null; return; }
      const edit = target.closest("[data-crm-edit]");
      if (edit) { const item = leads.find(x => x.id === edit.dataset.crmEdit); if (item) editor(item); return; }
      const activity = target.closest("[data-crm-activity]");
      if (activity) { await details(activity.dataset.crmActivity); return; }
      const archive = target.closest("[data-crm-archive]");
      if (archive) { await archiveLead(archive.dataset.crmArchive); return; }
    });

    root.addEventListener("submit", async event => {
      if (event.target.id === "crmLeadForm") {
        event.preventDefault();
        const button = event.target.querySelector('[type="submit"]');
        button.disabled = true;
        try { await saveLead(event.target); }
        catch (error) { say(error.message || "تعذر حفظ بيانات الجهة."); }
        finally { if (button.isConnected) button.disabled = false; }
      }
      if (event.target.id === "crmActivityForm") {
        event.preventDefault();
        const button = event.target.querySelector('[type="submit"]');
        button.disabled = true;
        try { await saveActivity(event.target); }
        catch (error) { say(error.message || "تعذر تسجيل التواصل."); }
        finally { if (button.isConnected) button.disabled = false; }
      }
    });

    root.addEventListener("input", event => {
      if (event.target.id === "crmSearch") renderList();
    });
    root.addEventListener("change", event => {
      if (["crmTypeFilter", "crmStageFilter", "crmDueFilter"].includes(event.target.id)) renderList();
    });
  }

  function open() {
    A = window.AsyutAdmin || A;
    if (!A) {
      root.innerHTML = '<p class="admin-empty">سجّل الدخول إلى حساب الإدارة أولًا.</p>';
      return;
    }
    if (!initialized) {
      shell();
      bindEvents();
      initialized = true;
    }
    loadLeads();
  }

  window.AsyutCrm = { open, reload: loadLeads };
  window.addEventListener("asyut:admin-ready", () => { A = window.AsyutAdmin || A; });
})();
