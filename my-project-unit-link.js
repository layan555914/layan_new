async function mountMyProjectUnitLink(options = {}) {
  "use strict";
  const profileEntityId = String(options.entityId || "");
  const root = options.root || document.getElementById("myProjectUnitLinkFormRoot");
  const requestsRoot = options.requestsRoot || document.getElementById("myProjectUnitLinkRequests");
  const config = window.LAYAN_CONFIG || {};
  const base = String(config.SUPABASE_URL || "").replace(/\/$/, "");
  const auth = window.LAYAN_SUPABASE;
  if (!root || !requestsRoot) return;

  const typeLabels = {
    apartment:"شقة",villa:"فيلا",shop:"محل تجاري",office:"مكتب إداري",
    clinic:"عيادة",land:"قطعة أرض",other:"أخرى"
  };
  const statusLabels = {
    pending:"قيد مراجعة الإدارة",
    needs_changes:"مطلوب استكمال",
    rejected:"لم تتم الموافقة",
    approved:"تم اعتماد الربط"
  };
  let profileProjectIds = null;

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }

  async function api(path, options = {}) {
    const response = await auth.authedFetch(base + "/rest/v1/" + path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) {}
    if (!response.ok) throw new Error(data?.message || data?.details || data?.hint || "تعذر تحميل بيانات ربط الوحدات.");
    return data;
  }

  function query(table, params) {
    return api(table + "?" + new URLSearchParams(params).toString());
  }

  function rpc(name, body = {}) {
    return api("rpc/" + name, { method:"POST", body:JSON.stringify(body) });
  }

  function renderRequests(rows) {
    requestsRoot.replaceChildren();
    const allRows = Array.isArray(rows) ? rows : [];
    const visibleRows = profileProjectIds ? allRows.filter(row => profileProjectIds.has(String(row.project_id))) : allRows;
    if (!visibleRows.length) {
      requestsRoot.append(el("p","لا توجد طلبات ربط وحدات لهذا الحساب حتى الآن.","my-project-unit-muted"));
      return;
    }
    rows.forEach(row => {
      const card = el("article",undefined,"my-project-unit-request");
      const head = el("div",undefined,"my-project-unit-request-head");
      head.append(el("strong",row.offer_title || ("إعلان رقم " + row.offer_id)));
      head.append(el("span",statusLabels[row.status] || "حالة غير محددة","my-project-unit-status"));
      card.append(head,el("p","المشروع: " + (row.project_name || "مشروع منشور") + " · الوحدة: " + (row.unit_ref || "غير محددة")));
      if (row.admin_notes) card.append(el("p","ملاحظة الإدارة: " + row.admin_notes,"my-project-unit-admin-note"));
      requestsRoot.append(card);
    });
  }

  function addField(form,labelText,control) {
    const label=el("label",labelText);
    label.append(control);
    form.append(label);
    return control;
  }

  function makeSelect(rows,placeholder,valueOf,labelOf) {
    const select=document.createElement("select");
    select.required=true;
    const empty=el("option",placeholder);
    empty.value="";
    empty.disabled=true;
    empty.selected=true;
    select.append(empty);
    visibleRows.forEach(row=>{
      const option=el("option",labelOf(row));
      option.value=valueOf(row);
      select.append(option);
    });
    return select;
  }

  async function load() {
    if (!base || !auth?.requireAuthenticated || !auth?.authedFetch) {
      throw new Error("خدمة تسجيل الدخول غير متاحة.");
    }
    const session=await auth.requireAuthenticated();
    const owner=session?.user?.id;
    if (!owner) throw new Error("سجّل الدخول أولًا لربط إعلانك بوحدة.");

    if (profileEntityId) {
      const relations = await query("directory_project_entities", {
        select:"project_id", entity_id:"eq."+profileEntityId
      });
      profileProjectIds = new Set((Array.isArray(relations) ? relations : []).map(row => String(row.project_id)).filter(Boolean));
      if (!profileProjectIds.size) {
        renderRequests([]);
        root.replaceChildren(el("p","لا توجد مشروعات منشورة مرتبطة بهذا الملف حتى الآن. تُتاح عملية ربط الإعلان بعد اعتماد علاقة الشركة بالمشروع ونشر وحداته.","my-project-unit-muted"));
        return;
      }
    }

    const [offers,units,requests]=await Promise.all([
      query("property_offers",{
        select:"id,title,listing_purpose,status",
        owner_id:"eq."+owner,
        status:"eq.available",
        order:"created_at.desc"
      }),
      query("directory_project_units",{
        select:"id,project_id,unit_ref,unit_type,area_m2",
        public_visible:"eq.true",
        verification_status:"eq.published",
        ...(profileProjectIds ? { project_id:"in.("+[...profileProjectIds].join(",")+")" } : {}),
        order:"unit_ref.asc"
      }),
      rpc("property_offer_project_unit_requests_mine")
    ]);
    const requestRows=Array.isArray(requests)?requests:[];
    renderRequests(requestRows);

    const linkedOfferIds=new Set(requestRows.filter(r=>["pending","approved"].includes(r.status)).map(r=>String(r.offer_id)));
    const availableOffers=(Array.isArray(offers)?offers:[]).filter(o=>!linkedOfferIds.has(String(o.id)));
    const publicUnits=Array.isArray(units)?units:[];
    const projectIds=[...new Set(publicUnits.map(u=>u.project_id).filter(Boolean))];
    const projects=projectIds.length?await query("directory_projects",{
      select:"id,name_ar",
      id:"in.("+projectIds.join(",")+")",
      public_visible:"eq.true",
      verification_status:"eq.published"
    }):[];
    const projectNames=new Map((Array.isArray(projects)?projects:[]).map(p=>[String(p.id),p.name_ar]));

    root.replaceChildren();
    if (!publicUnits.length) {
      root.append(el("p","لا توجد وحدات منشورة متاحة للربط حاليًا. ستظهر هنا بعد مراجعة وحدات المشروع واعتمادها.","my-project-unit-muted"));
      return;
    }
    if (!availableOffers.length) {
      root.append(el("p","لا يوجد إعلان عقاري منشور ومتاح وغير مرتبط بوحدة في حسابك. لا يمكن ربط إعلان قيد المراجعة أو إعلان تم بيعه أو تأجيره.","my-project-unit-muted"));
      return;
    }

    const form=el("form",undefined,"my-project-unit-link-form");
    const offerSelect=addField(form,"إعلانك المنشور",makeSelect(
      availableOffers,"اختر إعلانًا متاحًا",
      o=>String(o.id),
      o=>o.title+" · "+(o.listing_purpose||"عقار")
    ));
    const unitSelect=addField(form,"الوحدة داخل المشروع",makeSelect(
      publicUnits,"اختر الوحدة المنشورة",
      u=>u.id,
      u=>(projectNames.get(String(u.project_id))||"مشروع")+" · "+u.unit_ref+" · "+(typeLabels[u.unit_type]||"وحدة")+(u.area_m2?" · "+u.area_m2+" م²":"")
    ));
    const evidenceUrl=document.createElement("input");
    evidenceUrl.type="url";
    evidenceUrl.maxLength=1000;
    evidenceUrl.placeholder="رابط عام يثبت علاقتك بالوحدة (اختياري)";
    addField(form,"رابط الدليل (اختياري)",evidenceUrl);

    const evidenceText=document.createElement("textarea");
    evidenceText.required=true;
    evidenceText.minLength=6;
    evidenceText.maxLength=1200;
    evidenceText.rows=3;
    evidenceText.placeholder="اكتب ما يوضح ملكيتك أو تفويضك بالإعلان عن هذه الوحدة";
    addField(form,"وصف دليل الربط *",evidenceText);

    const submit=el("button","إرسال طلب الربط للمراجعة","btn btn-gold");
    submit.type="submit";
    const feedback=el("p",undefined,"my-project-unit-feedback");
    feedback.setAttribute("role","status");
    feedback.setAttribute("aria-live","polite");
    form.append(submit,feedback);

    form.addEventListener("submit",async event=>{
      event.preventDefault();
      if(!form.reportValidity()) return;
      submit.disabled=true;
      feedback.textContent="جارٍ إرسال طلب الربط...";
      try{
        await rpc("property_offer_project_unit_request_submit",{
          p_offer_id:Number(offerSelect.value),
          p_project_unit_id:unitSelect.value,
          p_evidence_url:evidenceUrl.value.trim()||null,
          p_evidence_description:evidenceText.value.trim()
        });
        feedback.textContent="تم إرسال الطلب. لن يظهر الإعلان داخل المشروع إلا بعد موافقة الإدارة.";
        await load();
      }catch(error){
        feedback.textContent=error.message||"تعذر إرسال طلب الربط.";
      }finally{
        submit.disabled=false;
      }
    });

    root.append(form);
  }

  try{
    await load();
  }catch(error){
    root.replaceChildren(el("p",error.message||"تعذر تحميل الوحدات المنشورة.","my-project-unit-muted"));
    requestsRoot.replaceChildren(el("p","تعذر تحميل طلبات ربط الوحدات.","my-project-unit-muted"));
  }
}

window.AsyutMyProjectUnitLink = { mount: mountMyProjectUnitLink };
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("myProjectUnitLinkFormRoot")) {
    mountMyProjectUnitLink().catch(error => console.warn("Project unit offer link:", error));
  }
});
