document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  const $ = id => document.getElementById(id);
  const root = $("cdProjectUnitsRoot");
  const requestsRoot = $("cdProjectUnitRequestsList");
  if (!root || !requestsRoot) return;

  const config = window.LAYAN_CONFIG || {};
  const base = String(config.SUPABASE_URL || "").replace(/\/$/, "");
  const auth = window.LAYAN_SUPABASE;

  const unitTypes = [
    ["apartment", "شقة"],
    ["villa", "فيلا"],
    ["shop", "محل تجاري"],
    ["office", "مكتب إداري"],
    ["clinic", "عيادة"],
    ["land", "قطعة أرض"],
    ["other", "أخرى"]
  ];
  const statusLabels = {
    pending: "قيد مراجعة الإدارة",
    needs_changes: "مطلوب استكمال",
    rejected: "لم تتم الموافقة",
    approved: "تم الاعتماد والنشر"
  };

  const el = (tag, value, className) => {
    const node = document.createElement(tag);
    if (value !== undefined && value !== null) node.textContent = String(value);
    if (className) node.className = className;
    return node;
  };

  async function api(path, options = {}) {
    if (!auth || typeof auth.authedFetch !== "function") {
      throw new Error("خدمة تسجيل الدخول غير جاهزة.");
    }
    const response = await auth.authedFetch(base + "/rest/v1/" + path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) {}
    if (!response.ok) {
      throw new Error(data?.message || data?.details || data?.hint || "تعذر تحميل بيانات الوحدات.");
    }
    return data;
  }

  function query(table, params) {
    return api(table + "?" + new URLSearchParams(params).toString());
  }

  function rpc(name, body = {}) {
    return api("rpc/" + name, { method: "POST", body: JSON.stringify(body) });
  }

  function field(form, labelText, control, wide = false) {
    const label = el("label", labelText);
    if (wide) label.className = "cd-project-field-wide";
    label.append(control);
    form.append(label);
    return control;
  }

  function input(type, placeholder, maxLength, required = false) {
    const node = document.createElement("input");
    node.type = type;
    node.required = required;
    if (placeholder) node.placeholder = placeholder;
    if (maxLength) node.maxLength = maxLength;
    if (type === "number") {
      node.min = "0";
      node.step = "any";
    }
    return node;
  }

  function textarea(placeholder, maxLength, rows = 3) {
    const node = document.createElement("textarea");
    node.placeholder = placeholder;
    node.maxLength = maxLength;
    node.rows = rows;
    return node;
  }

  function select(options, placeholder) {
    const node = document.createElement("select");
    node.required = true;
    const first = el("option", placeholder);
    first.value = "";
    first.disabled = true;
    first.selected = true;
    node.append(first);
    options.forEach(([value, label]) => {
      const option = el("option", label);
      option.value = value;
      node.append(option);
    });
    return node;
  }

  function statusPill(status) {
    const tone = status === "approved" ? "success"
      : status === "rejected" ? "danger"
      : status === "needs_changes" ? "warning" : "neutral";
    return el("span", statusLabels[status] || "حالة غير محددة", "cd-live-status cd-live-status--" + tone);
  }

  function renderRequests(rows) {
    requestsRoot.replaceChildren();
    if (!Array.isArray(rows) || !rows.length) {
      requestsRoot.append(el(
        "p",
        "لا توجد طلبات وحدات حتى الآن. بعد إرسال طلب وحدة سيظهر هنا رقمها وحالة مراجعتها وملاحظات الإدارة.",
        "cd-live-loading"
      ));
      return;
    }

    rows.forEach(row => {
      const card = el("article", undefined, "cd-project-unit-request-card");
      const head = el("div", undefined, "cd-request-heading");
      head.append(el("strong", row.unit_payload?.unit_ref || "وحدة داخل المشروع"));
      head.append(statusPill(row.status));
      card.append(head);
      card.append(el("p", "المشروع: " + (row.project_name || "مشروع منشور")));
      if (row.entity_name) card.append(el("p", "ملف الشركة: " + row.entity_name));
      const facts = [
        ["نوع الوحدة", unitTypes.find(item => item[0] === row.unit_payload?.unit_type)?.[1] || "غير محدد"],
        ["المساحة", row.unit_payload?.area_m2 ? row.unit_payload.area_m2 + " م²" : "غير محددة"],
        ["العمارة", row.unit_payload?.building_label || "—"],
        ["الدور", row.unit_payload?.floor_label || "—"]
      ];
      const details = el("div", undefined, "cd-project-unit-facts");
      facts.forEach(([label, value]) => {
        const cell = el("div");
        cell.append(el("small", label), el("strong", value));
        details.append(cell);
      });
      card.append(details);
      if (row.admin_notes) card.append(el("p", "ملاحظة الإدارة: " + row.admin_notes, "cd-admin-note"));
      if (row.resulting_unit_id) {
        card.append(el("p", "رقم الوحدة المنشور: " + row.resulting_unit_id, "cd-request-note"));
      }
      requestsRoot.append(card);
    });
  }

  function buildForm(projectChoices) {
    const section = el("section", undefined, "cd-team-panel cd-project-management-card");
    const heading = el("div", undefined, "cd-team-heading");
    heading.append(
      el("h3", "إضافة وحدة إلى مشروع"),
      el("p", "اختر المشروع وملف الشركة المقصودين معًا. متاح لمالك الملف المعتمد أو مديره المفوض إذا كانت الشركة مرتبطة بالمشروع بصفة المطوّر أو مالك الأرض. لن تظهر الوحدة للعامة قبل مراجعة الإدارة.")
    );
    section.append(heading);

    const form = el("form", undefined, "cd-team-form cd-project-unit-form");
    const projectCompany = field(form, "المشروع وملف الشركة المخوّل *", select(
      projectChoices.map(item => [item.value, item.label]),
      "اختر المشروع وملف الشركة"
    ), true);
    const unitRef = field(form, "كود / وصف يميز الوحدة *", input("text", "مثال: عمارة 2 - الدور 3 - شقة 12", 100, true), true);
    const unitType = field(form, "نوع الوحدة *", select(unitTypes, "اختر نوع الوحدة"));
    const building = field(form, "العمارة / المبنى", input("text", "مثال: العمارة 2", 100));
    const floor = field(form, "الدور", input("text", "مثال: الثاني", 60));
    const number = field(form, "رقم الوحدة", input("text", "مثال: 12", 60));
    const area = field(form, "المساحة بالمتر المربع", input("number", "مثال: 145"));
    const bedrooms = field(form, "غرف النوم", input("number", "مثال: 3"));
    const bathrooms = field(form, "الحمامات", input("number", "مثال: 2"));
    const finishing = field(form, "التشطيب", input("text", "مثال: نصف تشطيب", 100));
    const description = field(form, "وصف إضافي", textarea("تفاصيل تعريفية للوحدة، بدون مستندات حساسة", 1800), true);
    const evidenceUrl = field(form, "رابط عام لدليل الوحدة (اختياري)", input("url", "https://...", 1000), true);
    const evidenceText = field(form, "وصف دليل بيانات الوحدة *", textarea("اذكر مصدر البيانات أو المستند الذي يمكن للإدارة مراجعته", 1200), true);
    const submit = el("button", "إرسال الوحدة للمراجعة", "cd-live-action cd-live-button");
    submit.type = "submit";
    const feedback = el("p", undefined, "cd-team-feedback");
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    form.append(submit, feedback);

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      if (evidenceText.value.trim().length < 6) {
        feedback.textContent = "اكتب وصفًا واضحًا لدليل بيانات الوحدة.";
        evidenceText.focus();
        return;
      }

      const payload = {
        unit_ref: unitRef.value.trim(),
        unit_type: unitType.value,
        building_label: building.value.trim() || null,
        floor_label: floor.value.trim() || null,
        unit_number: number.value.trim() || null,
        area_m2: area.value.trim() ? Number(area.value) : null,
        bedrooms: bedrooms.value.trim() ? Number(bedrooms.value) : null,
        bathrooms: bathrooms.value.trim() ? Number(bathrooms.value) : null,
        finishing: finishing.value.trim() || null,
        description: description.value.trim() || null
      };

      submit.disabled = true;
      feedback.textContent = "جارٍ إرسال الوحدة للمراجعة...";
      try {
        const selectedLink = projectCompany.value.split("|");
        if (selectedLink.length !== 2 || !selectedLink[0] || !selectedLink[1]) {
          throw new Error("اختر المشروع وملف الشركة المرتبطين قبل إرسال الوحدة.");
        }
        await rpc("company_project_unit_request_submit", {
          p_project_id: selectedLink[0],
          p_directory_entity_id: selectedLink[1],
          p_unit_payload: payload,
          p_evidence_url: evidenceUrl.value.trim() || null,
          p_evidence_description: evidenceText.value.trim()
        });
        form.reset();
        feedback.textContent = "تم إرسال الوحدة. ستظهر في ملف المشروع بعد اعتماد الإدارة.";
        renderRequests(await rpc("company_project_unit_requests_mine"));
      } catch (error) {
        feedback.textContent = error.message || "تعذر إرسال طلب الوحدة.";
      } finally {
        submit.disabled = false;
      }
    });

    section.append(form);
    return section;
  }

  async function load() {
    if (!base || !auth?.requireAuthenticated) throw new Error("خدمة تسجيل الدخول غير متاحة.");
    const session = await auth.requireAuthenticated();
    const userId = session?.user?.id;
    if (!userId) throw new Error("سجّل الدخول أولًا.");

    const [owners, memberships] = await Promise.all([
      query("company_entity_managers", {
        select: "directory_entity_id",
        owner_user_id: "eq." + userId,
        verified_at: "not.is.null"
      }),
      query("company_entity_manager_members", {
        select: "directory_entity_id,member_role",
        user_id: "eq." + userId,
        revoked_at: "is.null"
      })
    ]);

    const entityRoles = new Map();
    (Array.isArray(owners) ? owners : []).forEach(row => {
      if (row.directory_entity_id) entityRoles.set(row.directory_entity_id, "owner");
    });
    (Array.isArray(memberships) ? memberships : []).forEach(row => {
      if (row.directory_entity_id && row.member_role === "manager" && !entityRoles.has(row.directory_entity_id)) {
        entityRoles.set(row.directory_entity_id, "manager");
      }
    });

    const entityIds = [...entityRoles.keys()];
    if (!entityIds.length) {
      root.replaceChildren(el(
        "p",
        "إدارة وحدات المشروع متاحة للمالك المعتمد أو مدير الملف المفوض فقط. يلزم استلام ملف الشركة والتحقق من الصفة أولًا.",
        "cd-team-note"
      ));
      renderRequests(await rpc("company_project_unit_requests_mine"));
      return;
    }

    const relationRows = await query("directory_project_entities", {
      select: "project_id,entity_id,relation_type",
      entity_id: "in.(" + entityIds.join(",") + ")",
      relation_type: "in.(developer,land_owner)"
    });
    const relationPairs = new Set((Array.isArray(relationRows) ? relationRows : []).map(row => row.project_id));
    const projectIds = [...relationPairs];
    const projects = projectIds.length ? await query("directory_projects", {
      select: "id,name_ar",
      id: "in.(" + projectIds.join(",") + ")",
      public_visible: "eq.true",
      verification_status: "eq.published",
      order: "name_ar.asc"
    }) : [];

    root.replaceChildren();
    if (!projects.length) {
      root.append(el(
        "p",
        "لا يوجد مشروع منشور مرتبط بملف شركتك بصفة المطوّر أو مالك الأرض. بعد اعتماد علاقة الشركة بالمشروع ستتمكن من تقديم بيانات وحداته.",
        "cd-team-note"
      ));
    } else {
      root.append(buildForm(projects));
    }
    renderRequests(await rpc("company_project_unit_requests_mine"));
  }

  try {
    await load();
  } catch (error) {
    root.replaceChildren(el("p", error.message || "تعذر تحميل إدارة وحدات المشروعات.", "cd-team-note"));
    requestsRoot.replaceChildren(el("p", "تعذر تحميل طلبات الوحدات.", "cd-team-note"));
  }
});
