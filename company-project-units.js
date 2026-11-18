document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  const root = document.getElementById("cdProjectUnitsRoot");
  const listRoot = document.getElementById("cdProjectUnitsList");
  if (!root || !listRoot) return;

  const config = window.LAYAN_CONFIG || {};
  const auth = window.LAYAN_SUPABASE;
  const base = String(config.SUPABASE_URL || "").replace(/\/$/, "");

  const relationLabels = {
    developer: "المطور العقاري",
    land_owner: "مالك الأرض",
    marketing_agent: "وكيل تسويق",
    sales_agent: "وكيل مبيعات"
  };
  const propertyTypes = [
    ["شقة", "شقة"], ["فيلا", "فيلا"], ["محل", "محل تجاري"],
    ["مكتب إداري", "مكتب إداري"], ["عيادة طبية", "عيادة طبية"],
    ["مخزن", "مخزن"], ["معرض", "معرض"], ["أرض مطروحة للبناء", "أرض"],
    ["أرض تنازل", "أرض تنازل"], ["مشروع عقاري", "وحدة داخل مشروع"]
  ];
  const purposes = [["بيع", "بيع"], ["إيجار", "إيجار"], ["تنازل", "تنازل"]];
  const statusLabels = {
    pending: "قيد مراجعة الإدارة",
    available: "متاحة للزوار",
    reserved: "محجوزة",
    sold: "تم البيع / التأجير"
  };
  const verificationLabels = {
    pending: "بانتظار مراجعة الإدارة",
    under_review: "قيد المراجعة",
    verified: "تم التحقق",
    rejected: "مرفوض"
  };

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }

  function field(parent, labelText, control, wide = false) {
    const label = el("label", undefined, wide ? "cd-unit-field cd-unit-field--wide" : "cd-unit-field");
    label.append(el("span", labelText), control);
    parent.append(label);
    return control;
  }

  function input(type, placeholder, value, required, maxLength) {
    const node = document.createElement("input");
    node.type = type;
    node.placeholder = placeholder || "";
    node.value = value == null ? "" : String(value);
    node.required = Boolean(required);
    if (maxLength) node.maxLength = maxLength;
    if (type === "number") {
      node.min = "0";
      node.step = "any";
    }
    return node;
  }

  function select(options, value, placeholder) {
    const node = document.createElement("select");
    const first = el("option", placeholder || "اختر");
    first.value = "";
    node.append(first);
    options.forEach(optionData => {
      const option = el("option", optionData[1]);
      option.value = optionData[0];
      node.append(option);
    });
    node.value = value || "";
    return node;
  }

  function textarea(placeholder, value, rows = 3) {
    const node = document.createElement("textarea");
    node.placeholder = placeholder || "";
    node.value = value || "";
    node.rows = rows;
    node.maxLength = 3000;
    return node;
  }

  function actionButton(text, action, secondary = false) {
    const button = el("button", text, secondary ? "cd-live-button cd-unit-button cd-unit-button--secondary" : "cd-live-button cd-unit-button");
    button.type = "button";
    button.dataset.unitAction = action;
    return button;
  }

  async function request(path, options = {}) {
    if (!base || !auth || typeof auth.authedFetch !== "function") {
      throw new Error("خدمة تسجيل الدخول غير متاحة. حدّث الصفحة وحاول مرة أخرى.");
    }
    const response = await auth.authedFetch(base + "/rest/v1/" + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...((options && options.headers) || {})
      }
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = null; }
    if (!response.ok) {
      throw new Error(data && (data.message || data.details || data.hint) || "تعذر تنفيذ طلب إدارة الوحدة.");
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

  function money(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0
      ? number.toLocaleString("ar-EG-u-nu-latn") + " جنيه"
      : "غير معلن";
  }

  function priceText(row) {
    if (row.price_on_request) return "السعر عند التواصل";
    const value = money(row.total_price);
    return row.listing_purpose === "إيجار" && value !== "غير معلن" ? value + " / شهر" : value;
  }

  function makeNote(text, tone = "neutral") {
    return el("p", text, "cd-unit-note cd-unit-note--" + tone);
  }

  function relationPairLabel(pair) {
    return pair.entity.name_ar + " — " + pair.project.name_ar +
      " (" + (relationLabels[pair.relation_type] || "جهة مرتبطة") + ")";
  }

  function buildCreateForm(pairs, canManage) {
    const panel = el("section", undefined, "cd-team-panel cd-unit-panel");
    panel.append(
      el("div", undefined, "cd-team-heading")
    );
    const heading = panel.firstChild;
    heading.append(
      el("h3", "إضافة وحدة إلى مشروع"),
      el("p", "تُسجّل الوحدة كإعلان مستقل مرتبط بالمشروع والشركة. لن تظهر للزوار قبل مراجعة الإدارة واعتمادها.")
    );

    if (!canManage) {
      panel.append(makeNote("صلاحية حسابك تسمح بعرض الوحدات المرتبطة فقط. إضافة الوحدات وتعديلها متاحان للمالك المعتمد أو مدير الملف المفوض.", "warning"));
      return panel;
    }

    const form = el("form", undefined, "cd-unit-form");
    const pairOptions = pairs.map((pair, index) => [String(index), relationPairLabel(pair)]);
    const pairSelect = field(form, "ملف الشركة والمشروع", select(pairOptions, "", "اختر المشروع المرتبط"), true);
    pairSelect.required = true;

    const title = field(form, "عنوان الوحدة أو رقمها *", input("text", "مثال: شقة 12 — عمارة A", "", true, 160), true);
    const type = field(form, "نوع العقار", select(propertyTypes, "شقة", "اختر نوع العقار"));
    type.value = "شقة";
    const purpose = field(form, "نوع المعاملة", select(purposes, "بيع", "اختر بيع أو إيجار أو تنازل"));
    purpose.value = "بيع";
    const city = field(form, "المدينة / المركز *", input("text", "مدينة أسيوط", "", true, 120));
    const area = field(form, "الحي / المنطقة *", input("text", "اسم الحي أو المنطقة", "", true, 160));
    const areaM2 = field(form, "المساحة (م²)", input("number", "مثال: 120", "", false));
    const bedrooms = field(form, "غرف النوم", input("number", "0", "0", false));
    bedrooms.step = "1";
    const bathrooms = field(form, "الحمامات", input("number", "0", "0", false));
    bathrooms.step = "1";

    const priceOnRequest = document.createElement("input");
    priceOnRequest.type = "checkbox";
    const priceLabel = el("label", undefined, "cd-unit-check cd-unit-field--wide");
    priceLabel.append(priceOnRequest, el("span", "السعر عند التواصل"));
    form.append(priceLabel);
    const totalPrice = field(form, "السعر / قيمة الإيجار أو التنازل (جنيه)", input("number", "مثال: 1500000", "", false));
    const assignment = el("div", undefined, "cd-unit-assignment");
    const assignmentTitle = el("strong", "تفاصيل التنازل");
    assignment.append(assignmentTitle);
    const assignmentGrid = el("div", undefined, "cd-unit-fields");
    const downPayment = field(assignmentGrid, "المقدم", input("number", "0", "0", false));
    const paidAmount = field(assignmentGrid, "إجمالي المدفوع (شامل المقدم)", input("number", "0", "0", false));
    const remainingAmount = field(assignmentGrid, "المبلغ المتبقي", input("number", "0", "0", false));
    const installments = field(assignmentGrid, "عدد الأقساط المتبقية", input("number", "0", "0", false));
    installments.step = "1";
    const monthlyInstallment = field(assignmentGrid, "القسط الشهري", input("number", "0", "0", false));
    const assignmentFee = field(assignmentGrid, "رسوم التنازل", input("number", "0", "0", false));
    assignment.append(assignmentGrid);
    form.append(assignment);

    const description = field(form, "وصف الوحدة", textarea("الدور، التشطيب، التسليم، أو تفاصيل إضافية دقيقة", ""), true);
    const photos = field(form, "صور الوحدة (JPG / JPEG — حتى 10 صور)", input("file", "", "", false), true);
    photos.type = "file";
    photos.accept = ".jpg,.jpeg,image/jpeg";
    photos.multiple = true;
    const photoHelp = makeNote("ارفع صورًا واضحة. تُحفظ الصور في مساحة صور الإعلانات، ولا يتم نشر الوحدة قبل الاعتماد.", "neutral");
    form.append(photoHelp);

    const contactName = field(form, "اسم مسؤول التواصل", input("text", "الاسم", "", false, 120));
    const contactPhone = field(form, "رقم التواصل / واتساب", input("tel", "01xxxxxxxxx", "", false, 30));
    const consent = document.createElement("input");
    consent.type = "checkbox";
    const consentLabel = el("label", undefined, "cd-unit-check cd-unit-field--wide");
    consentLabel.append(consent, el("span", "أوافق صراحةً على نشر رقم التواصل داخل الإعلان للزوار."));
    form.append(consentLabel);

    const feedback = el("p", "", "cd-team-feedback");
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    const submit = el("button", "إرسال الوحدة لمراجعة الإدارة", "cd-live-action cd-live-button cd-unit-submit");
    submit.type = "submit";
    form.append(submit, feedback);

    const paintPurpose = () => {
      const isAssignment = purpose.value === "تنازل";
      assignment.hidden = !isAssignment;
      totalPrice.closest("label").querySelector("span").textContent =
        purpose.value === "إيجار" ? "الإيجار الشهري (جنيه)" :
        isAssignment ? "قيمة التنازل الإجمالية (جنيه)" : "سعر البيع (جنيه)";
    };
    const paintPrice = () => {
      totalPrice.disabled = priceOnRequest.checked;
      if (priceOnRequest.checked) totalPrice.value = "";
      else totalPrice.disabled = false;
    };
    purpose.addEventListener("change", paintPurpose);
    priceOnRequest.addEventListener("change", paintPrice);
    paintPurpose();
    paintPrice();

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const selectedPair = pairs[Number(pairSelect.value)];
      if (!selectedPair) {
        feedback.textContent = "اختر ملف الشركة والمشروع أولًا.";
        pairSelect.focus();
        return;
      }
      const phone = contactPhone.value.trim();
      if (phone && !consent.checked) {
        feedback.textContent = "لنشر رقم التواصل يجب وضع علامة الموافقة الصريحة.";
        consent.focus();
        return;
      }
      if (priceOnRequest.checked === false && Number(totalPrice.value) <= 0) {
        feedback.textContent = "أدخل سعرًا أكبر من صفر أو اختر السعر عند التواصل.";
        totalPrice.focus();
        return;
      }

      const isAssignment = purpose.value === "تنازل";
      const numeric = value => value.trim() === "" ? null : Number(value);
      const files = Array.from(photos.files || []);
      if (files.length > 10) {
        feedback.textContent = "الحد الأقصى 10 صور للوحدة الواحدة.";
        return;
      }
      if (files.some(file => file.type !== "image/jpeg" || !/\.jpe?g$/i.test(file.name) || file.size > 15 * 1024 * 1024)) {
        feedback.textContent = "ارفع صور JPG أو JPEG فقط، ولا يتجاوز حجم الصورة الواحدة 15 ميجابايت.";
        return;
      }

      submit.disabled = true;
      feedback.textContent = "جارٍ تجهيز الصور وإرسال الوحدة...";
      let uploaded = [];
      try {
        if (files.length) {
          if (typeof auth.uploadImages !== "function") throw new Error("خدمة رفع الصور غير متاحة حاليًا.");
          uploaded = await auth.uploadImages(files);
        }

        const payload = {
          title: title.value.trim(),
          listing_purpose: purpose.value,
          property_type: type.value,
          city: city.value.trim(),
          area: area.value.trim(),
          area_m2: numeric(areaM2.value),
          bedrooms: numeric(bedrooms.value) ?? 0,
          bathrooms: numeric(bathrooms.value) ?? 0,
          total_price: numeric(totalPrice.value),
          price_on_request: priceOnRequest.checked,
          down_payment: isAssignment ? (numeric(downPayment.value) ?? 0) : 0,
          paid_amount: isAssignment ? (numeric(paidAmount.value) ?? 0) : 0,
          remaining_amount: isAssignment ? (numeric(remainingAmount.value) ?? 0) : 0,
          remaining_installments: isAssignment ? (numeric(installments.value) ?? 0) : 0,
          monthly_installment: isAssignment ? (numeric(monthlyInstallment.value) ?? 0) : 0,
          assignment_fee: isAssignment ? (numeric(assignmentFee.value) ?? 0) : 0,
          description: description.value.trim(),
          image_urls: uploaded,
          contact_name: contactName.value.trim(),
          contact_phone: phone,
          contact_consent: consent.checked
        };

        await rpc("company_project_offer_submit", {
          p_directory_entity_id: selectedPair.entity.id,
          p_project_id: selectedPair.project.id,
          p_payload: payload
        });

        form.reset();
        purpose.value = "بيع";
        type.value = "شقة";
        priceOnRequest.checked = false;
        paintPurpose();
        paintPrice();
        feedback.textContent = "تم إرسال الوحدة للمراجعة. ستظهر في صفحة المشروع بعد اعتماد الإدارة.";
        await load();
      } catch (error) {
        if (uploaded.length && auth.deleteUploadedImages) {
          await auth.deleteUploadedImages(uploaded).catch(() => {});
        }
        feedback.textContent = error.message || "تعذر إرسال الوحدة للمراجعة.";
      } finally {
        submit.disabled = false;
      }
    });

    panel.append(form);
    return panel;
  }

  function appendEditForm(card, row, canManage) {
    if (!canManage) return;
    const form = el("form", undefined, "cd-unit-edit-form");
    form.append(makeNote("تعديل البيانات الأساسية فقط. إذا كانت الوحدة منشورة فسيظل الإعلان الحالي ظاهرًا حتى اعتماد التعديل.", "neutral"));
    const title = field(form, "عنوان الوحدة", input("text", "", row.title, true, 160));
    const type = field(form, "نوع العقار", select(propertyTypes, row.property_type, "اختر النوع"));
    const purpose = field(form, "نوع المعاملة", select(purposes, row.listing_purpose, "اختر المعاملة"));
    const area = field(form, "المنطقة", input("text", "", row.area, true, 160));
    const areaM2 = field(form, "المساحة (م²)", input("number", "", row.area_m2, false));
    const priceOnRequest = document.createElement("input");
    priceOnRequest.type = "checkbox";
    priceOnRequest.checked = row.price_on_request === true;
    const priceLabel = el("label", undefined, "cd-unit-check cd-unit-field--wide");
    priceLabel.append(priceOnRequest, el("span", "السعر عند التواصل"));
    form.append(priceLabel);
    const totalPrice = field(form, "السعر / القيمة المعلنة", input("number", "", row.total_price, false));
    const description = field(form, "وصف الوحدة", textarea("", row.description, 3), true);
    const save = el("button", "حفظ التعديلات", "cd-live-action cd-live-button");
    save.type = "submit";
    const cancel = el("button", "إلغاء", "cd-live-action cd-unit-button cd-unit-button--secondary");
    cancel.type = "button";
    cancel.addEventListener("click", () => form.remove());
    form.append(save, cancel);

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      if (!priceOnRequest.checked && Number(totalPrice.value) <= 0) {
        save.insertAdjacentElement("beforebegin", makeNote("أدخل سعرًا صحيحًا أو اختر السعر عند التواصل.", "warning"));
        return;
      }
      const changes = {
        title: title.value.trim(),
        property_type: type.value,
        listing_purpose: purpose.value,
        area: area.value.trim(),
        area_m2: areaM2.value.trim() ? Number(areaM2.value) : null,
        price_on_request: priceOnRequest.checked,
        total_price: priceOnRequest.checked ? null : Number(totalPrice.value),
        description: description.value.trim() || null
      };
      save.disabled = true;
      try {
        const result = await rpc("company_project_offer_update", {
          p_id: Number(row.id),
          p_changes: changes
        });
        form.remove();
        setStatus(result === "pending"
          ? "تم إرسال تعديل الوحدة للإدارة. النسخة المنشورة الحالية تظل ظاهرة حتى الاعتماد."
          : result === "unchanged" ? "لم تتغير أي بيانات." : "تم تحديث بيانات الوحدة في الطلب الجاري مراجعته.");
        await load();
      } catch (error) {
        save.disabled = false;
        form.append(makeNote(error.message || "تعذر حفظ التعديلات.", "warning"));
      }
    });

    card.append(form);
  }

  function setStatus(message) {
    const status = root.querySelector("#cdProjectUnitsStatus");
    if (status) status.textContent = message;
  }

  function renderOfferCard(row, pairsByKey, canManage) {
    const card = el("article", undefined, "cd-unit-card");
    const pair = pairsByKey.get(String(row.directory_entity_id) + ":" + String(row.directory_project_id));
    const heading = el("div", undefined, "cd-unit-card-head");
    heading.append(
      el("div", undefined, "cd-unit-card-title")
    );
    heading.firstChild.append(
      el("strong", row.title || "وحدة عقارية"),
      el("small", pair ? relationPairLabel(pair) : "مشروع مرتبط بملف الشركة")
    );
    const tone = row.verification_status === "rejected" ? "danger" :
      row.status === "available" ? "success" :
      row.status === "reserved" ? "warning" : "neutral";
    heading.append(el("span", statusLabels[row.status] || verificationLabels[row.verification_status] || "غير محدد", "cd-live-status cd-live-status--" + tone));
    card.append(heading);

    const facts = el("div", undefined, "cd-unit-card-facts");
    facts.append(el("span", (row.property_type || "عقار") + " · " + (row.listing_purpose || "معاملة غير محددة")));
    facts.append(el("span", [row.city, row.area].filter(Boolean).join(" — ") || "الموقع غير محدد"));
    if (row.area_m2) facts.append(el("span", Number(row.area_m2).toLocaleString("ar-EG-u-nu-latn") + " م²"));
    facts.append(el("strong", priceText(row)));
    card.append(facts);

    if (row.verification_status === "rejected" && row.verification_notes) {
      card.append(makeNote("ملاحظة الإدارة: " + row.verification_notes, "warning"));
    }
    if (row.update_status === "pending") {
      card.append(makeNote("يوجد تعديل مرسل للإدارة. النسخة الحالية تظل ظاهرة حتى اعتماد التعديل.", "warning"));
    } else if (row.update_status === "rejected" && row.update_notes) {
      card.append(makeNote("لم يُعتمد آخر تعديل: " + row.update_notes, "warning"));
    }

    const actions = el("div", undefined, "cd-unit-actions");
    if (canManage && ["available","reserved","sold"].includes(row.status)) {
      if (row.status !== "available") actions.append(actionButton("إعادة متاحة", "available", true));
      if (row.status !== "reserved") actions.append(actionButton("حجز الوحدة", "reserved", true));
      if (row.status !== "sold") actions.append(actionButton("تم البيع / التأجير", "sold", true));
    }
    if (canManage) actions.append(actionButton("تعديل البيانات", "edit", true));
    const details = el("a", "عرض الإعلان", "cd-unit-link");
    details.href = "./property.html?id=" + encodeURIComponent(String(row.id));
    actions.append(details);
    if (actions.childElementCount) card.append(actions);

    card.addEventListener("click", async event => {
      const button = event.target.closest("button[data-unit-action]");
      if (!button) return;
      const action = button.dataset.unitAction;
      if (action === "edit") {
        if (card.querySelector(".cd-unit-edit-form")) return;
        appendEditForm(card,row,canManage);
        return;
      }
      const confirmText = action === "sold"
        ? "تأكيد تغيير حالة الوحدة إلى تم البيع / التأجير؟"
        : action === "reserved"
          ? "تأكيد حجز الوحدة؟"
          : "إعادة إتاحة الوحدة للزوار؟";
      if (!window.confirm(confirmText)) return;
      button.disabled = true;
      try {
        await rpc("company_project_offer_set_status", {
          p_id: Number(row.id),
          p_status: action
        });
        await load();
      } catch (error) {
        button.disabled = false;
        setStatus(error.message || "تعذر تحديث حالة الوحدة.");
      }
    });

    return card;
  }

  async function load() {
    listRoot.replaceChildren(el("p", "جارٍ تحميل الوحدات المرتبطة بالمشروعات...", "cd-live-loading"));
    try {
      if (!auth || typeof auth.requireAuthenticated !== "function") {
        throw new Error("خدمة تسجيل الدخول غير متاحة.");
      }
      const session = await auth.requireAuthenticated();
      const userId = session && session.user && session.user.id;
      if (!userId) throw new Error("سجّل الدخول أولًا لعرض وحدات المشروعات.");

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
        if (row.directory_entity_id && ["manager","editor"].includes(row.member_role) && !accessByEntity.has(row.directory_entity_id)) {
          accessByEntity.set(row.directory_entity_id,row.member_role);
        }
      });

      const entityIds = [...accessByEntity.keys()];
      if (!entityIds.length) {
        root.replaceChildren(makeNote("لا يوجد ملف شركة أو جهة معتمد مرتبط بحسابك. استلم ملف الشركة وتحقق من صفتك أولًا، ثم ستظهر وحدات المشروعات التي تديرها.", "neutral"));
        listRoot.replaceChildren(makeNote("لا توجد وحدات مرتبطة بملفات حسابك حتى الآن.", "neutral"));
        return;
      }

      const inFilter = "in.(" + entityIds.join(",") + ")";
      const [entities, relations] = await Promise.all([
        query("directory_entities", {
          select: "id,name_ar,public_visible,verification_status",
          id: inFilter,
          public_visible: "eq.true",
          verification_status: "eq.published"
        }),
        query("directory_project_entities", {
          select: "project_id,entity_id,relation_type",
          entity_id: inFilter
        })
      ]);

      const usableRelations = (Array.isArray(relations) ? relations : []).filter(row =>
        ["developer","land_owner","marketing_agent","sales_agent"].includes(row.relation_type)
      );
      const projectIds = [...new Set(usableRelations.map(row => row.project_id).filter(Boolean))];
      const projects = projectIds.length ? await query("directory_projects", {
        select: "id,name_ar,project_type,public_visible,verification_status",
        id: "in.(" + projectIds.join(",") + ")",
        public_visible: "eq.true",
        verification_status: "eq.published",
        order: "name_ar.asc"
      }) : [];

      const entityMap = new Map((Array.isArray(entities) ? entities : []).map(row => [row.id,row]));
      const projectMap = new Map((Array.isArray(projects) ? projects : []).map(row => [row.id,row]));
      const pairs = usableRelations.map(relation => ({
        entity: entityMap.get(relation.entity_id),
        project: projectMap.get(relation.project_id),
        relation_type: relation.relation_type,
        accessRole: accessByEntity.get(relation.entity_id)
      })).filter(pair => pair.entity && pair.project &&
        ["owner","manager","editor"].includes(pair.accessRole));
      const pairsByKey = new Map(pairs.map(pair => [
        String(pair.entity.id) + ":" + String(pair.project.id),pair
      ]));

      const offers = await query("property_offers", {
        select: "id,title,property_type,listing_purpose,city,area,area_m2,total_price,price_on_request,down_payment,paid_amount,remaining_amount,remaining_installments,monthly_installment,assignment_fee,bedrooms,bathrooms,description,image_urls,status,verification_status,verification_notes,update_status,update_notes,directory_entity_id,directory_project_id,created_at",
        directory_entity_id: inFilter,
        order: "created_at.desc",
        limit: "300"
      });

      const canManageEntities = new Set([...accessByEntity.entries()]
        .filter(([,role]) => role === "owner" || role === "manager")
        .map(([id]) => id));
      const canManage = pairs.some(pair => canManageEntities.has(pair.entity.id));

      root.replaceChildren();
      const createPanel = buildCreateForm(pairs.filter(pair => canManageEntities.has(pair.entity.id)),canManage);
      if (pairs.length) root.append(createPanel);
      else root.append(makeNote("لا توجد مشروعات منشورة ومرتبطة بملفاتك بصفة مطور أو مالك أرض أو وكيل تسويق أو وكيل مبيعات. بعد اعتماد ربط الشركة بالمشروع ستظهر هنا أدوات إدارة الوحدات.", "neutral"));

      listRoot.replaceChildren();
      const selectedOffers = Array.isArray(offers) ? offers : [];
      if (!selectedOffers.length) {
        listRoot.append(makeNote("لا توجد وحدات مرتبطة بمشروعات هذا الحساب حتى الآن. ابدأ بإضافة أول وحدة من النموذج أعلاه.", "neutral"));
      } else {
        selectedOffers.forEach(row => {
          const card = renderOfferCard(row,pairsByKey,canManageEntities.has(row.directory_entity_id));
          listRoot.append(card);
        });
      }
    } catch (error) {
      root.replaceChildren(makeNote(error.message || "تعذر تحميل إدارة وحدات المشروعات.", "warning"));
      listRoot.replaceChildren();
    }
  }

  try {
    await load();
  } catch (error) {
    root.replaceChildren(makeNote(error.message || "تعذر تحميل إدارة وحدات المشروعات.", "warning"));
    listRoot.replaceChildren();
  }
});