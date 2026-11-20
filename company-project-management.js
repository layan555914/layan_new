async function mountCompanyProjectManagement(options = {}) {

  const $ = id => document.getElementById(id);
  const profileEntityId = String(options.entityId || "");
  const root = options.root || $("cdProjectManagementRoot");
  const requestsRoot = options.requestsRoot || $("cdProjectRequestsList");
  if (!root || !requestsRoot) return;

  const config = window.LAYAN_CONFIG || {};
  const auth = window.LAYAN_SUPABASE;
  const base = String(config.SUPABASE_URL || "").replace(/\/$/, "");

  const relationOptions = [
    ["developer", "المطور / الجهة المطورة"],
    ["land_owner", "مالك الأرض"],
    ["marketing_agent", "وكيل تسويق"],
    ["sales_agent", "وكيل مبيعات"],
    ["contractor", "مقاول"],
    ["consultant", "استشاري"],
    ["operator", "جهة تشغيل"],
    ["public_authority", "جهة عامة"],
    ["other", "جهة مرتبطة"]
  ];
  const projectTypes = [
    ["residential", "سكني"], ["commercial", "تجاري"],
    ["administrative", "إداري"], ["medical", "طبي"],
    ["educational", "تعليمي"], ["mixed_use", "متعدد الاستخدامات"],
    ["land", "أرض"], ["service", "خدمي"], ["other", "أخرى"]
  ];
  const projectStatuses = [
    ["unknown", "غير محدد"], ["announced", "معلن عنه"], ["planned", "مخطط"],
    ["under_construction", "تحت التنفيذ"], ["partially_delivered", "تسليم مرحلي"],
    ["completed", "مكتمل"], ["operating", "يعمل"], ["stalled", "متوقف"]
  ];
  const statusLabels = {
    pending: "قيد مراجعة الإدارة",
    needs_changes: "مطلوب استكمال",
    rejected: "لم تتم الموافقة",
    approved: "تم الاعتماد"
  };

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }

  function makeSelect(options, placeholder, required) {
    const node = document.createElement("select");
    node.required = Boolean(required);
    const first = el("option", placeholder);
    first.value = "";
    first.disabled = Boolean(required);
    first.selected = true;
    node.append(first);
    options.forEach(item => {
      const option = el("option", item[1]);
      option.value = item[0];
      node.append(option);
    });
    return node;
  }

  function makeInput(type, placeholder, required, maxLength) {
    const node = document.createElement("input");
    node.type = type;
    node.required = Boolean(required);
    if (placeholder) node.placeholder = placeholder;
    if (maxLength) node.maxLength = maxLength;
    return node;
  }

  function makeTextarea(placeholder, required, maxLength, rows) {
    const node = document.createElement("textarea");
    node.required = Boolean(required);
    node.rows = rows || 3;
    if (placeholder) node.placeholder = placeholder;
    if (maxLength) node.maxLength = maxLength;
    return node;
  }

  function addField(parent, caption, control, wide) {
    const label = el("label", caption);
    if (wide) label.className = "cd-project-field-wide";
    label.append(control);
    parent.append(label);
    return control;
  }

  async function request(path, options) {
    if (!auth || typeof auth.authedFetch !== "function") {
      throw new Error("تعذر تحميل نظام تسجيل الدخول.");
    }
    const response = await auth.authedFetch(base + "/rest/v1/" + path, {
      ...(options || {}),
      headers: {
        "Content-Type": "application/json",
        ...((options && options.headers) || {})
      }
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) {}
    if (!response.ok) {
      throw new Error(data && (data.message || data.details || data.hint) || "تعذر تنفيذ طلب إدارة المشروع.");
    }
    return data;
  }

  function query(table, params) {
    return request(table + "?" + new URLSearchParams(params || {}).toString());
  }

  function rpc(name, body) {
    return request("rpc/" + name, {
      method: "POST",
      body: JSON.stringify(body || {})
    });
  }

  function panel(title, subtitle) {
    const section = el("section", undefined, "cd-team-panel cd-project-management-card");
    const heading = el("div", undefined, "cd-team-heading");
    heading.append(el("h3", title), el("p", subtitle));
    section.append(heading);
    return section;
  }

  function companySelect(entities) {
    const select = makeSelect(entities.map(entity => [
      entity.id,
      entity.name_ar + (entity.accessRole === "owner" ? " · المالك المعتمد" : " · مدير ملف مفوض")
    ]), "اختر ملف الشركة", true);
    if (profileEntityId && entities.length === 1) {
      select.value = entities[0].id;
      select.disabled = true;
      select.required = false;
    }
    return select;
  }

  function addSubmit(form, feedback) {
    const button = el("button", "إرسال الطلب للمراجعة", "cd-live-action cd-live-button");
    button.type = "submit";
    form.append(button);
    feedback.className = "cd-team-feedback";
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    form.append(feedback);
    return button;
  }

  function renderRequests(rows) {
    requestsRoot.replaceChildren();
    const allRows = Array.isArray(rows) ? rows : [];
    const list = profileEntityId ? allRows.filter(row => row.directory_entity_id === profileEntityId) : allRows;
    if (!list.length) {
      const empty = el("div", undefined, "cd-empty-panel cd-empty-panel--live");
      empty.append(
        el("h3", "لا توجد طلبات مشروعات حتى الآن"),
        el("p", "عند طلب إضافة مشروع جديد أو ربط ملف الشركة بمشروع منشور، ستظهر حالة الطلب وملاحظات الإدارة هنا.")
      );
      requestsRoot.append(empty);
      return;
    }

    list.forEach(row => {
      const card = el("article", undefined, "cd-request-card");
      const heading = el("div", undefined, "cd-request-heading");
      const kind = row.request_type === "new_project" ? "طلب إضافة مشروع جديد" : "طلب ربط بمشروع منشور";
      heading.append(el("strong", kind));
      const tone = row.status === "approved" ? "success"
        : row.status === "rejected" ? "danger"
        : row.status === "needs_changes" ? "warning" : "neutral";
      heading.append(el("span", statusLabels[row.status] || "الحالة غير محددة", "cd-live-status cd-live-status--" + tone));
      card.append(heading);
      card.append(el("h4", row.project_name || "مشروع عقاري"));
      card.append(el("p", "ملف الشركة: " + (row.entity_name || "ملف الشركة")));
      const relation = relationOptions.find(option => option[0] === row.requested_relation_type);
      if (relation) card.append(el("p", "الصفة المطلوبة: " + relation[1]));
      if (row.created_at) {
        const date = new Date(row.created_at);
        if (!Number.isNaN(date.getTime())) {
          card.append(el("small", "تاريخ الطلب: " + date.toLocaleDateString("ar-EG")));
        }
      }
      if (row.admin_notes) card.append(el("p", "ملاحظة الإدارة: " + row.admin_notes, "cd-admin-note"));
      else if (row.status === "pending") card.append(el("p", "استلمت الإدارة طلبك، وسيظهر قرار المراجعة هنا.", "cd-request-note"));
      if (row.status === "approved" && row.request_type === "new_project") {
        card.append(el("p", "تم إنشاء سجل داخلي للمشروع. لا يظهر للجمهور قبل مراجعة بياناته ومصادره واعتماده للنشر.", "cd-request-note"));
      }
      requestsRoot.append(card);
    });
  }

  function evidenceFields(form) {
    const url = addField(form, "رابط عام يثبت العلاقة (اختياري)", makeInput("url", "https://...", false, 1000), true);
    const description = addField(form, "وصف دليل العلاقة (مطلوب عند عدم وجود رابط)", makeTextarea("اذكر صفتك أو التفويض أو ما يثبت علاقة الشركة بالمشروع", false, 1200, 3), true);
    return { url, description };
  }

  function relationField(form, optionsForEntity = relationOptions) {
    return addField(form, "صفة الشركة داخل المشروع", makeSelect(optionsForEntity, "اختر الصفة", true));
  }

  function buildNewProjectForm(entities, areas, optionsForEntity = relationOptions) {
    const section = panel(
      "طلب إضافة مشروع جديد",
      "أدخل المعلومات الأساسية فقط. الطلب لا ينشر المشروع تلقائيًا؛ بعد مراجعة الإدارة يُنشأ سجل داخلي لاستكمال المراجع والتحقق قبل النشر."
    );
    const form = el("form", undefined, "cd-team-form cd-project-request-form");
    const company = addField(form, "ملف الشركة المخوّل", companySelect(entities));
    const name = addField(form, "اسم المشروع بالعربية *", makeInput("text", "اسم المشروع", true, 180));
    const type = addField(form, "نوع المشروع *", makeSelect(projectTypes, "اختر النوع", true));
    const status = addField(form, "حالة المشروع", makeSelect(projectStatuses, "اختر الحالة", false));
    status.value = "unknown";
    const areaOptions = areas.map(area => [area.id, area.name_ar]);
    const area = addField(form, "المنطقة", makeSelect(areaOptions, "اختر المنطقة (اختياري)", false));
    const location = addField(form, "وصف الموقع أو العنوان", makeInput("text", "الحي أو الشارع أو علامة مميزة", false, 300));
    const description = addField(form, "نبذة عن المشروع", makeTextarea("وصف مختصر ودقيق للمشروع", false, 3000, 3), true);
    const size = addField(form, "المساحة المعلنة", makeInput("number", "مثال: 1200", false));
    size.min = "0";
    size.step = "0.01";
    const sizeUnit = addField(form, "وحدة المساحة", makeInput("text", "متر مربع / فدان", false, 30));
    const units = addField(form, "عدد الوحدات (إن كان معلومًا)", makeInput("number", "عدد الوحدات", false));
    units.min = "0";
    units.step = "1";
    const relation = relationField(form, optionsForEntity);
    const evidence = evidenceFields(form);
    const feedback = el("p");
    const submit = addSubmit(form, feedback);

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      if (!evidence.url.value.trim() && evidence.description.value.trim().length < 6) {
        feedback.textContent = "أضف رابطًا عامًا أو وصفًا لا يقل عن 6 أحرف لدليل علاقة الشركة بالمشروع.";
        evidence.description.focus();
        return;
      }

      const payload = {
        name_ar: name.value.trim(),
        project_type: type.value,
        project_status: status.value || "unknown",
        area_id: area.value || null,
        location_text: location.value.trim() || null,
        description: description.value.trim() || null,
        name_en: null,
        size_value: size.value.trim() ? Number(size.value) : null,
        size_unit: sizeUnit.value.trim() || null,
        unit_count: units.value.trim() ? Number(units.value) : null
      };
      submit.disabled = true;
      feedback.textContent = "جارٍ إرسال طلب إضافة المشروع...";
      try {
        await rpc("company_project_request_submit", {
          p_directory_entity_id: company.value,
          p_request_type: "new_project",
          p_project_id: null,
          p_project_payload: payload,
          p_relation_type: relation.value,
          p_evidence_url: evidence.url.value.trim() || null,
          p_evidence_description: evidence.description.value.trim() || null
        });
        form.reset();
        status.value = "unknown";
        feedback.textContent = "تم إرسال الطلب بنجاح، وسيظهر في قائمة طلبات المشروعات بعد تحديثها.";
        renderRequests(await rpc("company_project_requests_mine", {}));
      } catch (error) {
        feedback.textContent = error.message || "تعذر إرسال الطلب.";
      } finally {
        submit.disabled = false;
      }
    });

    section.append(form);
    return section;
  }

  function buildLinkProjectForm(entities, projects, optionsForEntity = relationOptions) {
    const section = panel(
      "طلب ربط الشركة بمشروع منشور",
      "استخدم هذا الخيار عندما يكون المشروع موجودًا بالفعل في دليل المشروعات. لن نكرر سجل المشروع؛ ستراجع الإدارة العلاقة والصفة قبل اعتماد الربط."
    );
    const form = el("form", undefined, "cd-team-form cd-project-request-form");
    const company = addField(form, "ملف الشركة المخوّل", companySelect(entities));
    const projectOptions = projects.map(project => [project.id, project.name_ar]);
    const project = addField(form, "المشروع المنشور", makeSelect(projectOptions, projects.length ? "اختر المشروع" : "لا توجد مشروعات منشورة متاحة", true));
    const relation = relationField(form, optionsForEntity);
    const evidence = evidenceFields(form);
    const feedback = el("p");
    const submit = addSubmit(form, feedback);
    if (!projects.length) submit.disabled = true;

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      if (!evidence.url.value.trim() && evidence.description.value.trim().length < 6) {
        feedback.textContent = "أضف رابطًا عامًا أو وصفًا لا يقل عن 6 أحرف لدليل علاقة الشركة بالمشروع.";
        evidence.description.focus();
        return;
      }
      submit.disabled = true;
      feedback.textContent = "جارٍ إرسال طلب الربط...";
      try {
        await rpc("company_project_request_submit", {
          p_directory_entity_id: company.value,
          p_request_type: "link_project",
          p_project_id: project.value,
          p_project_payload: null,
          p_relation_type: relation.value,
          p_evidence_url: evidence.url.value.trim() || null,
          p_evidence_description: evidence.description.value.trim() || null
        });
        form.reset();
        feedback.textContent = "تم إرسال طلب الربط للمراجعة.";
        renderRequests(await rpc("company_project_requests_mine", {}));
      } catch (error) {
        feedback.textContent = error.message || "تعذر إرسال الطلب.";
      } finally {
        submit.disabled = !projects.length;
      }
    });

    section.append(form);
    return section;
  }

  async function load() {
    if (!base || !auth || typeof auth.requireAuthenticated !== "function") {
      throw new Error("خدمة تسجيل الدخول غير متاحة. حدّث الصفحة وحاول مرة أخرى.");
    }
    const session = await auth.requireAuthenticated();
    const userId = session && session.user && session.user.id;
    if (!userId) throw new Error("سجّل الدخول أولًا لطلب إدارة مشروعات شركتك.");

    const [ownerRows, memberships] = await Promise.all([
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

    const accessByEntity = new Map();
    (Array.isArray(ownerRows) ? ownerRows : []).forEach(row => {
      if (row.directory_entity_id) accessByEntity.set(row.directory_entity_id, "owner");
    });
    (Array.isArray(memberships) ? memberships : []).forEach(row => {
      if (row.directory_entity_id && row.member_role === "manager" && !accessByEntity.has(row.directory_entity_id)) {
        accessByEntity.set(row.directory_entity_id, "manager");
      }
    });

    const entityIds = profileEntityId
      ? (accessByEntity.has(profileEntityId) ? [profileEntityId] : [])
      : [...accessByEntity.keys()];
    if (!entityIds.length) {
      root.replaceChildren();
      root.append(el(
        "p",
        "إرسال طلبات المشروعات متاح للمالك المعتمد أو مدير الملف المفوض فقط. يلزم أولًا استلام ملف الشركة والتحقق من الصفة من إدارة أسيوط عقار.",
        "cd-team-note"
      ));
      renderRequests([]);
      return;
    }

    const inFilter = "in.(" + entityIds.join(",") + ")";
    const [entities, projects, areas, requests] = await Promise.all([
      query("directory_entities", {
        select: "id,name_ar,entity_type,service_category",
        id: inFilter,
        public_visible: "eq.true",
        verification_status: "eq.published",
        order: "name_ar.asc"
      }),
      query("directory_projects", {
        select: "id,name_ar,project_type",
        public_visible: "eq.true",
        verification_status: "eq.published",
        order: "name_ar.asc",
        limit: "200"
      }),
      query("directory_areas", {
        select: "id,name_ar",
        is_active: "eq.true",
        public_visible: "eq.true",
        verification_status: "eq.published",
        order: "name_ar.asc",
        limit: "100"
      }),
      rpc("company_project_requests_mine", {})
    ]);

    const eligibleEntities = (Array.isArray(entities) ? entities : []).map(entity => ({
      ...entity,
      accessRole: accessByEntity.get(entity.id)
    })).filter(entity => entity.accessRole === "owner" || entity.accessRole === "manager");

    root.replaceChildren();
    if (!eligibleEntities.length) {
      root.append(el(
        "p",
        "لم نعثر على ملف شركة منشور مرتبط بحسابك وبصلاحية مالك أو مدير مفوض. المحرر يستطيع تحديث البيانات التشغيلية المسموح بها لكنه لا يرسل طلبات إنشاء أو ربط المشروعات.",
        "cd-team-note"
      ));
    } else if (profileEntityId) {
      const entity = eligibleEntities[0];
      const isDeveloper = entity.entity_type === "developer" || entity.service_category === "real_estate_development";
      const isMarketing = ["marketing","brokerage","sales_office"].includes(entity.entity_type) ||
        ["real_estate_marketing","real_estate_brokerage","real_estate_sales"].includes(entity.service_category);
      if (isDeveloper) {
        const developerRelations = relationOptions.filter(option => ["developer","land_owner"].includes(option[0]));
        root.append(buildNewProjectForm(eligibleEntities, Array.isArray(areas) ? areas : [], developerRelations));
        root.append(buildLinkProjectForm(eligibleEntities, Array.isArray(projects) ? projects : [], developerRelations));
      } else if (isMarketing) {
        const marketingRelations = relationOptions.filter(option => ["marketing_agent","sales_agent"].includes(option[0]));
        root.append(buildLinkProjectForm(eligibleEntities, Array.isArray(projects) ? projects : [], marketingRelations));
      } else {
        root.append(el("p", "إدارة المشروعات متاحة لملفات التطوير العقاري أو التسويق والوساطة بعد اعتماد ممثل الشركة.", "cd-team-note"));
      }
    } else {
      root.append(buildNewProjectForm(eligibleEntities, Array.isArray(areas) ? areas : []));
      root.append(buildLinkProjectForm(eligibleEntities, Array.isArray(projects) ? projects : []));
    }
    renderRequests(requests);
  }

  try {
    await load();
  } catch (error) {
    root.replaceChildren(el("p", error.message || "تعذر تحميل أدوات المشروعات.", "cd-team-note"));
    requestsRoot.replaceChildren(el("p", "تعذر تحميل طلبات المشروعات.", "cd-team-note"));
  }
}

window.AsyutCompanyProjectManagement = { mount: mountCompanyProjectManagement };
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("cdProjectManagementRoot")) {
    mountCompanyProjectManagement().catch(error => console.warn("Company project management:", error));
  }
});
