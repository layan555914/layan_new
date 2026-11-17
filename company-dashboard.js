document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  const $ = id => document.getElementById(id);
  const cfg = window.LAYAN_CONFIG || {};
  const auth = window.LAYAN_SUPABASE;
  const base = String(cfg.SUPABASE_URL || "").replace(/\/$/, "");
  const root = $("cdCompanyProfiles");
  const projectsRoot = $("cdProjectsList");
  const listingsRoot = $("cdListingsList");
  const message = $("cdConnectionMessage");
  const counts = {
    profiles: $("cdCountProfiles"),
    projects: $("cdCountProjects"),
    listings: $("cdCountListings"),
    reviews: $("cdCountReviews")
  };

  const labels = {
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

  const projectStatusLabels = {
    announced: "معلن عنه", planned: "مخطط", under_construction: "تحت التنفيذ",
    partially_delivered: "تسليم مرحلي", completed: "مكتمل", operating: "يعمل", stalled: "متوقف", unknown: "الحالة غير محددة"
  };

  const statusLabels = {
    pending: "قيد مراجعة الإدارة",
    active: "ملف معتمد",
    rejected: "لم تتم الموافقة",
    paused: "موقوف مؤقتًا",
    needs_changes: "مطلوب استكمال البيانات"
  };

  const offerStatusLabels = {
    pending: "قيد المراجعة",
    available: "منشور / متاح",
    reserved: "محجوز",
    sold: "تم البيع"
  };

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }

  function link(text, href, className) {
    const node = el("a", text, className);
    node.href = href;
    return node;
  }

  function statusPill(text, kind) {
    return el("span", text, "cd-live-status" + (kind ? " cd-live-status--" + kind : ""));
  }

  function safeHttpUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch (_) {
      return "";
    }
  }

  async function request(path, options) {
    if (!auth || typeof auth.authedFetch !== "function") {
      throw new Error("تعذر تحميل نظام الدخول. حدّث الصفحة وحاول مرة أخرى.");
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
      throw new Error(data && (data.message || data.details || data.hint) || "تعذر تحميل بيانات لوحة الشركة.");
    }
    return data;
  }

  function query(table, params, options) {
    const search = new URLSearchParams(params || {});
    return request(table + "?" + search.toString(), options);
  }

  function postRpc(name, body) {
    return request("rpc/" + name, {
      method: "POST",
      body: JSON.stringify(body || {})
    });
  }

  function setStat(key, value) {
    if (counts[key]) counts[key].textContent = String(value);
  }

  function renderEmpty(target, title, description, actionText, actionHref) {
    target.replaceChildren();
    const panel = el("div", undefined, "cd-empty-panel cd-empty-panel--live");
    panel.append(el("span", "⌂", "cd-empty-icon"));
    const copy = el("div");
    copy.append(el("h3", title), el("p", description));
    panel.append(copy);
    if (actionText && actionHref) {
      panel.append(link(actionText, actionHref, "cd-live-action"));
    }
    target.append(panel);
  }

  function statusForProfile(profile) {
    if (profile.verified_at || profile.representative_verified_at) {
      return { text: "ممثل تم التحقق منه", kind: "success" };
    }
    const status = String(profile.status || "");
    return { text: statusLabels[status] || "حالة الملف غير محددة", kind: status === "rejected" ? "danger" : "warning" };
  }

  function renderLogo(name, logoUrl) {
    const box = el("div", undefined, "cd-company-logo");
    const url = safeHttpUrl(logoUrl);
    if (url) {
      const image = el("img");
      image.src = url;
      image.alt = "شعار " + (name || "الشركة");
      image.loading = "lazy";
      image.addEventListener("error", () => {
        image.remove();
        box.textContent = String(name || "ش").trim().slice(0, 1) || "ش";
      }, { once: true });
      box.append(image);
    } else {
      box.textContent = String(name || "ش").trim().slice(0, 1) || "ش";
    }
    return box;
  }

  function renderProfileCard(profile) {
    const card = el("article", undefined, "cd-company-card cd-company-card--live");
    const identity = el("div", undefined, "cd-company-identity");
    const name = profile.name || profile.company_name || "ملف شركة";
    identity.append(renderLogo(name, profile.logo_url));
    const info = el("div", undefined, "cd-company-info");
    info.append(
      el("span", profile.kindLabel, "cd-eyebrow"),
      el("h2", name),
      el("p", [profile.category || profile.city || "", profile.city || ""].filter(Boolean).join(" · "))
    );
    identity.append(info);

    const state = el("div", undefined, "cd-company-state");
    const stateInfo = statusForProfile(profile);
    state.append(statusPill(stateInfo.text, stateInfo.kind));
    if (profile.kind === "directory_entity") {
      state.append(statusPill(profile.roleLabel, "neutral"));
    }
    const actionRow = el("div", undefined, "cd-profile-actions");
    if (profile.kind === "company_profile" && profile.isOwner) {
      actionRow.append(link("إدارة بيانات الشركة", "./companies.html?edit=1", "cd-live-action"));
    } else if (profile.kind === "directory_entity") {
      actionRow.append(link("فتح ملف الشركة وإدارته", "./company.html?entity_id=" + encodeURIComponent(profile.id), "cd-live-action"));
    } else if (profile.kind === "company_profile_member") {
      actionRow.append(link("عرض ملف الشركة", "./company.html?id=" + encodeURIComponent(profile.id), "cd-live-action cd-live-action--secondary"));
    }
    state.append(actionRow);
    card.append(identity, state);

    const detail = el("p", profile.detail || "");
    detail.className = "cd-profile-detail";
    if (profile.adminNote) {
      const note = el("p", "ملاحظة الإدارة: " + profile.adminNote, "cd-admin-note");
      card.append(detail, note);
    } else if (profile.updateStatus === "pending") {
      card.append(detail, el("p", "يوجد تحديث حساس قيد مراجعة الإدارة. ستظل البيانات الحالية منشورة حتى اعتماده.", "cd-admin-note"));
    } else if (profile.status === "needs_changes" || profile.updateStatus === "needs_changes") {
      card.append(detail, el("p", profile.updateNotes || "يرجى مراجعة ملاحظات الإدارة واستكمال المطلوب.", "cd-admin-note"));
    } else if (profile.status === "pending") {
      card.append(detail, el("p", "تم استلام طلب الشركة، ولا يظهر الملف للعامة قبل موافقة الإدارة.", "cd-admin-note"));
    } else {
      card.append(detail);
    }

    if (profile.kind === "company_profile" && Array.isArray(profile.previousWork) && profile.previousWork.length) {
      const previous = el("div", undefined, "cd-previous-work");
      previous.append(el("strong", "أعمال سابقة مدخلة في ملف الشركة"));
      previous.append(el("p", "هذه بيانات وصفية واردة في ملف الشركة، وليست سجلات مشروعات مستقلة في الدليل."));
      profile.previousWork.slice(0, 5).forEach(item => {
        const itemBox = el("div", undefined, "cd-previous-work-item");
        itemBox.append(el("b", item.title || "عمل سابق"));
        if (item.description) itemBox.append(el("small", item.description));
        previous.append(itemBox);
      });
      card.append(previous);
    }

    if (profile.isPrimaryOwner && profile.verified) {
      card.append(buildTeamPanel(profile));
    } else if (profile.kind === "directory_entity" && profile.roleLabel) {
      card.append(el("p", "إدارة أعضاء الفريق متاحة للمالك الأساسي المعتمد فقط. صلاحياتك الحالية لا تسمح بدعوة أعضاء أو إلغاء عضويتهم.", "cd-team-note"));
    }
    return card;
  }

  function buildTeamPanel(profile) {
    const section = el("section", undefined, "cd-team-panel");
    const heading = el("div", undefined, "cd-team-heading");
    heading.append(el("h3", "فريق إدارة الملف"), el("p", "أضف موظفًا لديه حساب مؤكد على أسيوط عقار، وحدد دوره أو ألغِ صلاحياته عند الحاجة."));
    section.append(heading);

    const form = document.createElement("form");
    form.className = "cd-team-form";
    form.noValidate = false;
    const emailLabel = el("label", "البريد الإلكتروني للموظف");
    const email = document.createElement("input");
    email.type = "email";
    email.name = "email";
    email.required = true;
    email.maxLength = 254;
    email.autocomplete = "email";
    email.placeholder = "name@example.com";
    emailLabel.append(email);

    const roleLabel = el("label", "الدور داخل الملف");
    const role = document.createElement("select");
    role.name = "role";
    role.required = true;
    [["editor", "محرر بيانات تشغيلية"], ["manager", "مدير ملف مفوض"]].forEach(optionData => {
      const option = el("option", optionData[1]);
      option.value = optionData[0];
      role.append(option);
    });
    roleLabel.append(role);
    const submit = el("button", "إضافة عضو للفريق", "cd-live-action cd-live-button");
    submit.type = "submit";
    form.append(emailLabel, roleLabel, submit);

    const feedback = el("p", "جارٍ تحميل أعضاء الفريق...", "cd-team-feedback");
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    const list = el("div", undefined, "cd-team-members");
    section.append(form, feedback, list);

    async function loadMembers() {
      feedback.textContent = "جارٍ تحميل أعضاء الفريق...";
      list.replaceChildren();
      const name = profile.kind === "company_profile"
        ? "company_profile_manager_member_list"
        : "company_entity_manager_member_list";
      const arg = profile.kind === "company_profile"
        ? { p_company_profile_id: profile.id }
        : { p_directory_entity_id: profile.id };
      const rows = await postRpc(name, arg);
      if (!Array.isArray(rows) || !rows.length) {
        feedback.textContent = "لا يوجد أعضاء مفوضون حاليًا.";
        return;
      }
      feedback.textContent = "الأعضاء المفوضون: " + rows.length;
      rows.forEach(row => {
        const item = el("div", undefined, "cd-team-member");
        const copy = el("div");
        copy.append(
          el("strong", row.email || "حساب أسيوط عقار"),
          el("small", row.member_role === "manager" ? "مدير ملف مفوض" : "محرر بيانات تشغيلية")
        );
        const revoke = el("button", "إلغاء الصلاحية", "cd-revoke-button");
        revoke.type = "button";
        revoke.addEventListener("click", async () => {
          if (!window.confirm("إلغاء صلاحية هذا المستخدم من إدارة الملف؟")) return;
          revoke.disabled = true;
          try {
            await postRpc(
              profile.kind === "company_profile" ? "company_profile_manager_revoke" : "company_entity_manager_revoke",
              profile.kind === "company_profile"
                ? { p_company_profile_id: profile.id, p_user_id: row.user_id }
                : { p_directory_entity_id: profile.id, p_user_id: row.user_id }
            );
            await loadMembers();
          } catch (error) {
            feedback.textContent = error.message || "تعذر إلغاء الصلاحية.";
          } finally {
            revoke.disabled = false;
          }
        });
        item.append(copy, revoke);
        list.append(item);
      });
    }

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      submit.disabled = true;
      feedback.textContent = "جارٍ إضافة الموظف...";
      try {
        await postRpc(
          profile.kind === "company_profile" ? "company_profile_manager_invite" : "company_entity_manager_invite",
          profile.kind === "company_profile"
            ? { p_company_profile_id: profile.id, p_email: email.value.trim(), p_role: role.value }
            : { p_directory_entity_id: profile.id, p_email: email.value.trim(), p_role: role.value }
        );
        form.reset();
        feedback.textContent = "تمت إضافة الموظف إلى فريق الملف.";
        await loadMembers();
      } catch (error) {
        feedback.textContent = error.message || "تعذرت إضافة الموظف.";
      } finally {
        submit.disabled = false;
      }
    });

    loadMembers().catch(error => {
      feedback.textContent = error.message || "تعذر تحميل فريق الملف.";
    });
    return section;
  }

  async function loadDirectoryProjects(entityId) {
    const relations = await query("directory_project_entities", {
      select: "project_id,relation_type",
      entity_id: "eq." + entityId
    });
    const ids = [...new Set((Array.isArray(relations) ? relations : []).map(row => row.project_id).filter(Boolean))];
    if (!ids.length) return [];
    const inFilter = "in.(" + ids.join(",") + ")";
    const rows = await query("directory_projects", {
      select: "id,slug,name_ar,project_type,project_status,verification_status,public_visible",
      id: inFilter,
      public_visible: "eq.true",
      verification_status: "eq.published",
      order: "name_ar.asc"
    });
    const byId = new Map((Array.isArray(relations) ? relations : []).map(row => [row.project_id, row.relation_type]));
    return (Array.isArray(rows) ? rows : []).map(project => ({
      ...project,
      relationLabel: labels[byId.get(project.id)] || "جهة مرتبطة"
    }));
  }

  function renderProjects(projects, previousWork) {
    projectsRoot.replaceChildren();
    const all = Array.isArray(projects) ? projects : [];
    if (all.length) {
      all.forEach(project => {
        const card = el("article", undefined, "cd-project-card");
        card.append(
          el("span", project.relationLabel, "cd-project-role"),
          el("h3", project.name_ar || "مشروع عقاري"),
          el("p", projectStatusLabels[project.project_status] || "الحالة غير محددة")
        );
        card.append(link("فتح صفحة المشروع", "./project.html?id=" + encodeURIComponent(project.id), "cd-project-link"));
        projectsRoot.append(card);
      });
      return all.length;
    }
    if (previousWork && previousWork.length) {
      renderEmpty(
        projectsRoot,
        "لا توجد روابط مشروعات مستقلة لهذا الملف حتى الآن",
        "يوجد في ملف الشركة " + previousWork.length + " بند من سابقة الأعمال، لكنه لا يتحول تلقائيًا إلى مشروع منشور. يلزم إنشاء سجل مشروع مستقل ومراجعة صفة الشركة.",
        "فتح دليل المشروعات",
        "./directory.html?view=projects"
      );
      return 0;
    }
    renderEmpty(
      projectsRoot,
      "لا توجد مشروعات منشورة مرتبطة بالملفات التي تديرها",
      "ستظهر هنا المشروعات المنشورة التي ترتبط بالشركة بصفتها الموثقة فقط. عدم ظهور مشروع هنا لا يثبت عدم وجود مشروعات للشركة.",
      "فتح دليل المشروعات",
      "./directory.html?view=projects"
    );
    return 0;
  }

  function renderListings(rows) {
    listingsRoot.replaceChildren();
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      renderEmpty(
        listingsRoot,
        "لا توجد إعلانات مرتبطة بحسابك",
        "عند نشر إعلان من حسابك سيظهر هنا. الإعلانات تظل مستقلة عن ملف الشركة إلى أن يتم إنشاء ربط موثّق بينها وبين الشركة أو المشروع."
      );
      return;
    }
    list.slice(0, 12).forEach(row => {
      const item = el("article", undefined, "cd-account-listing");
      item.append(
        el("strong", row.title || "إعلان عقاري"),
        el("span", (row.listing_purpose || "نوع غير محدد") + " · " + (offerStatusLabels[row.status] || "الحالة غير محددة"))
      );
      listingsRoot.append(item);
    });
    if (list.length > 12) {
      listingsRoot.append(el("p", "نعرض أحدث 12 إعلانًا من أصل " + list.length + " إعلانًا على الحساب.", "cd-team-note"));
    }
  }

  async function loadDashboard() {
    if (!auth || typeof auth.requireAuthenticated !== "function") {
      throw new Error("نظام تسجيل الدخول غير متاح على هذه الصفحة.");
    }
    if (!base) throw new Error("إعدادات الاتصال غير متاحة. حدّث الصفحة وحاول مرة أخرى.");
    const session = await auth.requireAuthenticated();
    const userId = session && session.user && session.user.id;
    if (!userId) throw new Error("تعذر التحقق من حسابك. سجّل الدخول مرة أخرى.");

    message.textContent = "تم التحقق من الحساب. جارٍ تحميل الملفات والصلاحيات المتاحة لك.";
    const profiles = [];
    const errors = [];

    const ownerProfile = await postRpc("layan_company_owner_profile", {}).catch(error => {
      errors.push(error.message);
      return null;
    });
    if (ownerProfile && typeof ownerProfile === "object" && !Array.isArray(ownerProfile) && ownerProfile.id) {
      profiles.push({
        kind: "company_profile",
        kindLabel: "ملف شركة مقدم من الشركة",
        id: ownerProfile.id,
        company_name: ownerProfile.company_name,
        category: ownerProfile.category,
        city: ownerProfile.city,
        logo_url: ownerProfile.logo_url,
        status: ownerProfile.status,
        verified_at: ownerProfile.verified_at,
        updateStatus: ownerProfile.update_status,
        updateNotes: ownerProfile.update_notes,
        adminNote: ownerProfile.admin_notes,
        previousWork: Array.isArray(ownerProfile.projects) ? ownerProfile.projects : [],
        detail: "الملف المقدم من الشركة. التعديلات التشغيلية وإدارة الفريق متاحة بعد اعتماد الملف والتحقق من ممثله.",
        isOwner: true,
        isPrimaryOwner: true,
        verified: Boolean(ownerProfile.verified_at && ownerProfile.status === "active")
      });
    }

    const [entityOwners, entityMemberships, profileMemberships, accountOffers] = await Promise.all([
      query("company_entity_managers", {
        select: "directory_entity_id,verified_at,representative_role",
        owner_user_id: "eq." + userId,
        verified_at: "not.is.null"
      }).catch(error => { errors.push(error.message); return []; }),
      query("company_entity_manager_members", {
        select: "directory_entity_id,member_role",
        user_id: "eq." + userId,
        revoked_at: "is.null"
      }).catch(error => { errors.push(error.message); return []; }),
      query("company_profile_manager_members", {
        select: "company_profile_id,member_role",
        user_id: "eq." + userId,
        revoked_at: "is.null"
      }).catch(error => { errors.push(error.message); return []; }),
      query("property_offers", {
        select: "id,title,status,listing_purpose,created_at",
        owner_id: "eq." + userId,
        order: "created_at.desc",
        limit: "100"
      }).catch(error => { errors.push(error.message); return []; })
    ]);

    const entityRoleById = new Map();
    (Array.isArray(entityOwners) ? entityOwners : []).forEach(row => {
      entityRoleById.set(row.directory_entity_id, { role: "owner", isOwner: true, verifiedAt: row.verified_at });
    });
    (Array.isArray(entityMemberships) ? entityMemberships : []).forEach(row => {
      if (!entityRoleById.has(row.directory_entity_id)) {
        entityRoleById.set(row.directory_entity_id, { role: row.member_role, isOwner: false });
      }
    });

    const entityIds = [...entityRoleById.keys()];
    if (entityIds.length) {
      const entities = await query("directory_entities", {
        select: "id,name_ar,name_en,entity_type,service_category,description,public_logo_url,public_address,public_phone,public_services,public_coverage_areas,public_visible,verification_status,representative_verified_at",
        id: "in.(" + entityIds.join(",") + ")",
        public_visible: "eq.true",
        verification_status: "eq.published",
        order: "name_ar.asc"
      }).catch(error => { errors.push(error.message); return []; });
      (Array.isArray(entities) ? entities : []).forEach(entity => {
        const access = entityRoleById.get(entity.id);
        if (!access) return;
        profiles.push({
          kind: "directory_entity",
          kindLabel: "ملف منشور في الدليل العقاري",
          id: entity.id,
          name: entity.name_ar || entity.name_en || "شركة",
          category: entity.service_category || entity.entity_type || "شركة عقارية",
          logo_url: entity.public_logo_url,
          status: "active",
          verified_at: access.verifiedAt || entity.representative_verified_at || null,
          roleLabel: access.role === "owner" ? "المالك الأساسي المعتمد" : (access.role === "manager" ? "مدير ملف مفوض" : "محرر بيانات تشغيلية"),
          detail: entity.public_address || entity.description || "ملف الشركة منشور في الدليل العقاري.",
          isOwner: access.isOwner,
          isPrimaryOwner: access.isOwner,
          verified: access.isOwner
        });
      });
    }

    const profileMemberIds = [...new Set((Array.isArray(profileMemberships) ? profileMemberships : []).map(row => row.company_profile_id).filter(Boolean))];
    if (profileMemberIds.length) {
      const rows = await query("company_profiles_public", {
        select: "id,company_name,category,city,logo_url,verified_at",
        id: "in.(" + profileMemberIds.join(",") + ")"
      }).catch(error => { errors.push(error.message); return []; });
      (Array.isArray(rows) ? rows : []).forEach(profile => {
        if (profiles.some(item => item.kind === "company_profile" && item.id === profile.id)) return;
        const membership = profileMemberships.find(row => row.company_profile_id === profile.id);
        profiles.push({
          kind: "company_profile_member",
          kindLabel: "عضوية في فريق شركة",
          id: profile.id,
          name: profile.company_name,
          category: profile.category,
          city: profile.city,
          logo_url: profile.logo_url,
          status: "active",
          representative_verified_at: profile.representative_verified_at,
          roleLabel: membership && membership.member_role === "manager" ? "مدير ملف مفوض" : "محرر بيانات تشغيلية",
          detail: "أنت عضو مفوض في فريق هذا الملف. صلاحياتك تقتصر على الدور الذي منحه لك مالك الشركة.",
          isOwner: false,
          isPrimaryOwner: false,
          verified: false
        });
      });
    }

    root.replaceChildren();
    if (!profiles.length) {
      renderEmpty(
        root,
        "لا يوجد ملف شركة مرتبط بحسابك حتى الآن",
        "تقدر تسجل شركتك مجانًا، أو تفتح ملف شركتك المنشور في دليل الشركات وتضغط «استلم ملفك مجانًا». لن تحصل على صلاحية الإدارة إلا بعد مراجعة الإدارة واعتماد صفتك.",
        "فتح دليل الشركات",
        "./companies.html"
      );
    } else {
      profiles.forEach(profile => root.append(renderProfileCard(profile)));
    }

    let projectRows = [];
    const directoryProfiles = profiles.filter(profile => profile.kind === "directory_entity");
    for (const profile of directoryProfiles) {
      try {
        const rows = await loadDirectoryProjects(profile.id);
        projectRows = projectRows.concat(rows);
      } catch (error) {
        errors.push(error.message);
      }
    }
    const groupedProjects = new Map();
    projectRows.forEach(row => {
      const existing = groupedProjects.get(row.id);
      if (existing) {
        if (!existing.roles.includes(row.relationLabel)) existing.roles.push(row.relationLabel);
      } else {
        groupedProjects.set(row.id, { ...row, roles: [row.relationLabel] });
      }
    });
    const uniqueProjects = [...groupedProjects.values()].map(row => ({
      ...row,
      relationLabel: row.roles.join(" · ")
    }));
    const previousWork = profiles
      .filter(profile => profile.kind === "company_profile")
      .flatMap(profile => profile.previousWork || []);
    const projectCount = renderProjects(uniqueProjects, previousWork);
    renderListings(accountOffers);

    const accountReviewCount = (Array.isArray(accountOffers) ? accountOffers : []).filter(row => row.status === "pending").length
      + profiles.filter(profile => profile.status === "pending" || profile.updateStatus === "pending" || profile.status === "needs_changes").length;
    setStat("profiles", profiles.length);
    setStat("projects", projectCount);
    setStat("listings", Array.isArray(accountOffers) ? accountOffers.length : 0);
    setStat("reviews", accountReviewCount);

    if (errors.length) {
      message.textContent = "تم تحميل البيانات المتاحة. بعض الأقسام لم تكتمل قراءتها؛ لن نعرض بيانات غير مؤكدة.";
      message.dataset.state = "warning";
    } else {
      message.textContent = "تم تحميل ملفاتك وصلاحياتك الحالية بنجاح.";
      message.dataset.state = "success";
    }
  }

  try {
    await loadDashboard();
  } catch (error) {
    message.textContent = error.message || "تعذر تحميل لوحة الشركة.";
    message.dataset.state = "error";
    renderEmpty(
      root,
      "يلزم تسجيل الدخول لفتح مساحة الشركة",
      "افتح الصفحة الرئيسية وسجّل الدخول إلى حسابك على أسيوط عقار، ثم ارجع إلى لوحة الشركة.",
      "العودة إلى الصفحة الرئيسية",
      "./"
    );
    projectsRoot.replaceChildren();
    listingsRoot.replaceChildren();
    ["profiles", "projects", "listings", "reviews"].forEach(key => setStat(key, "—"));
  }
});
