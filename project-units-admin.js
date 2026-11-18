document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $ = id => document.getElementById(id);
  const config = window.LAYAN_CONFIG || {};
  const base = String(config.SUPABASE_URL || "").replace(/\/$/, "");
  const auth = window.LAYAN_SUPABASE;
  let session = auth?.getSession?.() || null;
  let queue = "units";
  let unitRequests = [];
  let linkRequests = [];

  const loginPanel = $("puaLoginPanel");
  const panel = $("puaAdminPanel");
  const status = $("puaStatus");
  const list = $("puaRequestsList");
  const count = $("puaCount");
  const filter = $("puaStatusFilter");
  const logout = $("puaLogout");
  const refresh = $("puaRefresh");

  const statusLabels = {
    pending:"قيد مراجعة الإدارة",
    needs_changes:"مطلوب استكمال",
    rejected:"لم تتم الموافقة",
    approved:"تم الاعتماد"
  };
  const unitTypes = {
    apartment:"شقة",villa:"فيلا",shop:"محل تجاري",office:"مكتب إداري",
    clinic:"عيادة",land:"قطعة أرض",other:"أخرى"
  };
  const offerPurposes = {بيع:"بيع",إيجار:"إيجار",تنازل:"تنازل"};
  const offerTypes = {
    شقة:"شقة",فيلا:"فيلا",محل:"محل تجاري","مكتب إداري":"مكتب إداري",
    "عيادة طبية":"عيادة","أرض مطروحة للبناء":"أرض","أرض تنازل":"أرض"
  };

  function el(tag, value, className) {
    const node = document.createElement(tag);
    if (value !== undefined && value !== null) node.textContent = String(value);
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
      return ["https:","http:"].includes(url.protocol) ? url.href : "";
    } catch (_) {
      return "";
    }
  }

  async function fresh() {
    if (!session?.access_token) session = auth?.getSession?.() || null;
    if (!session?.access_token) throw new Error("سجّل الدخول أولًا.");
    if (Number(session.expires_at || 0) <= Math.floor(Date.now()/1000)+60) {
      if (!auth?.requireAuthenticated) throw new Error("انتهت جلسة الدخول.");
      session = await auth.requireAuthenticated();
    }
  }

  async function api(path, options = {}) {
    if (!base || !auth?.authedFetch) throw new Error("خدمة الاتصال غير متاحة.");
    await fresh();
    const response = await auth.authedFetch(base + path, {
      ...options,
      headers: { "Content-Type":"application/json", ...(options.headers || {}) }
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = raw; }
    if (!response.ok) {
      throw new Error(data?.message || data?.details || data?.hint || "تعذر تنفيذ الطلب.");
    }
    return data;
  }

  function rpc(name, body = {}) {
    return api("/rest/v1/rpc/" + name, { method:"POST", body:JSON.stringify(body) });
  }

  async function requireAdmin() {
    await fresh();
    const allowed = await rpc("layan_is_admin", {});
    if (allowed !== true) {
      throw new Error("هذا الحساب مسجل، لكنه غير مخوّل لإدارة وحدات المشروعات.");
    }
  }

  function appendDetail(parent, label, value) {
    const cell = el("div");
    cell.append(el("span",label),el("strong",value || "—"));
    parent.append(cell);
  }

  function evidenceLink(parent, url, description) {
    if (description) parent.append(el("p","دليل الطلب: " + description));
    const href = safeUrl(url);
    if (href) {
      const paragraph = el("p",undefined,"pua-evidence");
      paragraph.append("رابط الدليل: ");
      const anchor = el("a","فتح رابط الدليل");
      anchor.href = href;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      paragraph.append(anchor);
      parent.append(paragraph);
    }
  }

  function makeNotes() {
    const label = el("label","ملاحظة الإدارة (إلزامية عند الاستكمال أو الرفض)");
    const area = el("textarea");
    area.maxLength = 1200;
    area.placeholder = "اكتب ملاحظة واضحة لصاحب الطلب...";
    label.append(area);
    return area;
  }

  function actionButtons(row, actionName, buttonsLabel, notes, card) {
    const actions = el("div",undefined,"pua-actions");
    const [approveLabel,changesLabel,rejectLabel] = buttonsLabel;
    const approve = el("button",approveLabel,"btn btn-gold");
    const changes = el("button",changesLabel,"btn btn-outline-dark");
    const reject = el("button",rejectLabel,"btn btn-outline-dark");
    [approve,changes,reject].forEach(button => button.type = "button");
    approve.addEventListener("click",()=>review(row,actionName,"approve",notes.value,[approve,changes,reject]));
    changes.addEventListener("click",()=>review(row,actionName,"needs_changes",notes.value,[approve,changes,reject]));
    reject.addEventListener("click",()=>review(row,actionName,"reject",notes.value,[approve,changes,reject]));
    actions.append(approve,changes,reject);
    card.append(actions);
  }

  function renderUnitCard(row) {
    const card = el("article",undefined,"pua-card");
    const head = el("div",undefined,"pua-card-head");
    const unit = row.unit_payload || {};
    head.append(el("h2","طلب إضافة وحدة: " + (unit.unit_ref || "مرجع غير محدد")));
    head.append(el("span",statusLabels[row.status] || "حالة غير محددة","pua-badge " + (row.status || "")));
    card.append(head);
    card.append(el("p","المشروع: " + (row.project_name || "مشروع غير محدد")));
    card.append(el("p","الشركة: " + (row.entity_name || "غير محدد")));
    card.append(el("p","مقدم الطلب: " + (row.requester_role === "owner" ? "المالك المعتمد" : "مدير ملف مفوض")));
    const details = el("div",undefined,"pua-details");
    appendDetail(details,"نوع الوحدة",unitTypes[unit.unit_type] || unit.unit_type);
    appendDetail(details,"المساحة",unit.area_m2 ? unit.area_m2 + " م²" : "—");
    appendDetail(details,"العمارة",unit.building_label);
    appendDetail(details,"الدور",unit.floor_label);
    appendDetail(details,"رقم الوحدة",unit.unit_number);
    appendDetail(details,"غرف النوم",unit.bedrooms);
    appendDetail(details,"الحمامات",unit.bathrooms);
    appendDetail(details,"التشطيب",unit.finishing);
    card.append(details);
    if (unit.description) card.append(el("p","وصف الوحدة: " + unit.description));
    evidenceLink(card,row.evidence_url,row.evidence_description);
    if (row.admin_notes) card.append(el("p","ملاحظة الإدارة السابقة: " + row.admin_notes,"pua-note"));
    if (row.resulting_unit_id) {
      card.append(el("p","الوحدة المنشورة: " + row.resulting_unit_id));
    }
    if (row.status === "pending") {
      const notes = makeNotes();
      card.append(notes);
      actionButtons(row,"unit",["اعتماد ونشر الوحدة","طلب استكمال البيانات","رفض الطلب"],notes,card);
    }
    return card;
  }

  function renderLinkCard(row) {
    const card = el("article",undefined,"pua-card");
    const head = el("div",undefined,"pua-card-head");
    head.append(el("h2","طلب ربط إعلان بوحدة"));
    head.append(el("span",statusLabels[row.status] || "حالة غير محددة","pua-badge " + (row.status || "")));
    card.append(head);
    card.append(el("p","الإعلان: " + (row.offer_title || ("رقم " + row.offer_id))));
    card.append(el("p","المشروع: " + (row.project_name || "مشروع منشور")));
    const details = el("div",undefined,"pua-details");
    appendDetail(details,"مرجع الوحدة",row.unit_ref);
    appendDetail(details,"رقم الإعلان",row.offer_id);
    appendDetail(details,"مالك الإعلان",row.offer_owner_id);
    appendDetail(details,"معرّف الوحدة",row.project_unit_id);
    card.append(details);
    evidenceLink(card,row.evidence_url,row.evidence_description);
    if (row.admin_notes) card.append(el("p","ملاحظة الإدارة السابقة: " + row.admin_notes,"pua-note"));
    if (row.status === "pending") {
      const notes = makeNotes();
      card.append(notes);
      actionButtons(row,"link",["اعتماد ربط الإعلان","طلب استكمال البيانات","رفض الطلب"],notes,card);
    }
    return card;
  }

  async function review(row, kind, action, notes, buttons) {
    if (action !== "approve" && String(notes || "").trim().length < 3) {
      say("اكتب ملاحظة لا تقل عن 3 أحرف عند طلب الاستكمال أو رفض الطلب.");
      return;
    }
    const question = action === "approve"
      ? kind === "unit"
        ? "اعتماد الوحدة وإظهارها ضمن الوحدات المنشورة للمشروع؟"
        : "اعتماد ربط الإعلان بهذه الوحدة المنشورة؟"
      : action === "needs_changes"
        ? "إعادة الطلب لصاحبه مع ملاحظة الاستكمال؟"
        : "رفض الطلب؟";
    if (!window.confirm(question)) return;

    buttons.forEach(button => button.disabled = true);
    say("جارٍ حفظ قرار المراجعة...");
    try {
      if (kind === "unit") {
        await rpc("company_project_unit_request_admin_review",{
          p_request_id:row.request_id,
          p_action:action,
          p_admin_notes:String(notes || "").trim() || null
        });
      } else {
        await rpc("property_offer_project_unit_request_admin_review",{
          p_request_id:row.request_id,
          p_action:action,
          p_admin_notes:String(notes || "").trim() || null
        });
      }
      say(action === "approve"
        ? kind === "unit"
          ? "تم اعتماد الوحدة ونشرها داخل ملف المشروع."
          : "تم اعتماد الربط. سيظهر الإعلان تحت الوحدة وفي صفحة المشروع."
        : action === "needs_changes"
          ? "تم إرسال ملاحظة الاستكمال لصاحب الطلب."
          : "تم رفض الطلب.");
      await load();
    } catch (error) {
      say(error.message || "تعذر حفظ قرار المراجعة.");
      buttons.forEach(button => button.disabled = false);
    }
  }

  async function load() {
    list.replaceChildren(el("p","جارٍ تحميل الطلبات...","pua-empty"));
    try {
      const [units,links] = await Promise.all([
        rpc("company_project_unit_request_admin_list",{}),
        rpc("property_offer_project_unit_request_admin_list",{})
      ]);
      unitRequests = Array.isArray(units) ? units : [];
      linkRequests = Array.isArray(links) ? links : [];
      render();
    } catch (error) {
      list.replaceChildren(el("p",error.message || "تعذر تحميل طلبات الوحدات والربط.","pua-empty"));
      throw error;
    }
  }

  function render() {
    const rows = queue === "units" ? unitRequests : linkRequests;
    const selected = filter.value;
    const visible = selected ? rows.filter(row => row.status === selected) : rows;
    const totalPending = unitRequests.filter(row=>row.status==="pending").length +
      linkRequests.filter(row=>row.status==="pending").length;
    count.textContent = "الوحدات: " + unitRequests.length + " · ربط الإعلانات: " +
      linkRequests.length + " · المعلق: " + totalPending + " · المعروض في القسم: " + visible.length;
    list.replaceChildren();
    if (!visible.length) {
      list.append(el("p","لا توجد طلبات تطابق حالة المراجعة المحددة.","pua-empty"));
      return;
    }
    visible.forEach(row => list.append(queue === "units" ? renderUnitCard(row) : renderLinkCard(row)));
  }

  $("puaLoginForm").addEventListener("submit",async event=>{
    event.preventDefault();
    const button=event.currentTarget.querySelector("button[type=submit]");
    button.disabled=true;
    say("جارٍ تسجيل الدخول والتحقق من صلاحية الإدارة...");
    try{
      if(!auth?.signIn) throw new Error("خدمة تسجيل الدخول غير جاهزة.");
      await auth.signIn($("puaEmail").value.trim(),$("puaPassword").value);
      session=auth.getSession?.()||null;
      await requireAdmin();
      setState(true);
      await load();
      say("تم التحقق من صلاحية الإدارة.");
    }catch(error){
      session=null;
      setState(false);
      say(error.message||"تعذر تسجيل الدخول أو التحقق من الصلاحية.");
    }finally{
      button.disabled=false;
    }
  });

  logout.addEventListener("click",async()=>{
    try{
      await auth?.signOut?.();
      session=null;
      setState(false);
      say("تم تسجيل الخروج.");
    }catch(error){say(error.message||"تعذر تسجيل الخروج.");}
  });

  refresh.addEventListener("click",()=>load().catch(error=>say(error.message)));
  filter.addEventListener("change",render);
  document.querySelectorAll("[data-queue]").forEach(button=>{
    button.addEventListener("click",()=>{
      queue=button.dataset.queue;
      document.querySelectorAll("[data-queue]").forEach(tab=>{
        const active=tab===button;
        tab.classList.toggle("active",active);
        tab.setAttribute("aria-selected",String(active));
      });
      render();
    });
  });

  setState(false);
  if(session?.access_token){
    (async()=>{
      try{
        await requireAdmin();
        setState(true);
        await load();
        say("تم التحقق من صلاحية الإدارة.");
      }catch(_){
        session=null;
        setState(false);
        say("يلزم تسجيل الدخول بحساب مسؤول معتمد.");
      }
    })();
  }
});
