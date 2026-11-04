document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const config = window.LAYAN_CONFIG || {};
  const base = String(config.SUPABASE_URL || "").replace(/\/$/, "");
  const key = config.SUPABASE_PUBLISHABLE_KEY || "";
  const auth = window.LAYAN_SUPABASE;
  const tables = {
    entities: "directory_entities",
    projects: "directory_projects",
    areas: "directory_areas",
    opportunities: "directory_opportunities",
    sources: "directory_sources",
    history: "directory_change_log"
  };
  const ownerKeys = {
    entities: { owner: "entity_id", link: "directory_entity_sources" },
    projects: { owner: "project_id", link: "directory_project_sources" },
    opportunities: { owner: "opportunity_id", link: "directory_opportunity_sources" }
  };
  const labels = {
    draft: "مسودة",
    needs_review: "قيد المراجعة",
    verified: "تم التحقق",
    published: "منشور",
    archived: "مؤرشف"
  };
  let session = auth?.getSession?.() || null;
  let view = "entities";
  let cache = {
    entities: [], projects: [], areas: [], opportunities: [], sources: [],
    history: [], privateEntities: [], privateProjects: [],
    entityLinks: [], projectLinks: [], opportunityLinks: []
  };
  const loginPanel = $("#dirAdminLoginPanel");
  const panel = $("#dirAdminPanel");
  const status = $("#dirAdminStatus");
  const records = $("#dirAdminRecords");
  const listStatus = $("#dirAdminListStatus");
  const logout = $("#dirAdminLogout");
  const toolbar = $("#dirAdminToolbar");
  const sourcesPanel = $("#dirAdminSourcesPanel");
  const sourceForm = $("#dirAdminSourceForm");
  const searchInput = $("#dirAdminSearch");
  const statusFilter = $("#dirAdminStatusFilter");
  const areaFilter = $("#dirAdminAreaFilter");

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
  const safeUrl = value => {
    try {
      const url = new URL(String(value || ""));
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch (_) { return ""; }
  };
  const say = message => { status.textContent = message || ""; };
  const setState = ok => {
    loginPanel.hidden = ok;
    panel.hidden = !ok;
    logout.hidden = !ok;
  };
  const dateText = value => value ? new Date(value).toLocaleString("ar-EG") : "—";
  const sessionUserId = () => session?.user?.id || auth?.getUser?.()?.id || null;

  async function fresh() {
    if (!session?.access_token) session = auth?.getSession?.() || null;
    if (!session?.access_token) throw new Error("سجّل الدخول أولًا.");
    if (Number(session.expires_at || 0) <= Math.floor(Date.now() / 1000) + 60) {
      if (!auth?.requireAuthenticated) throw new Error("انتهت الجلسة. سجّل الدخول مرة أخرى.");
      session = await auth.requireAuthenticated();
    }
  }

  async function api(path, options = {}) {
    if (!base || !key) throw new Error("إعدادات اتصال قاعدة البيانات غير مكتملة.");
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
      throw new Error("تعذر الاتصال بقاعدة البيانات. تحقق من الإنترنت وحاول مرة أخرى.");
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

  async function requireAdmin() {
    await fresh();
    const result = await api("/rest/v1/rpc/layan_is_admin", {
      method: "POST", body: "{}"
    });
    if (result !== true) throw new Error("هذا الحساب مسجل، لكنه غير مخوّل لإدارة قاعدة بيانات السوق العقاري.");
  }

  async function rows(table, select, order) {
    const suffix = order ? "&order=" + encodeURIComponent(order) : "";
    const limit = table === "directory_change_log" ? "&limit=100" : "";
    const data = await api("/rest/v1/" + table + "?select=" + encodeURIComponent(select) + suffix + limit);
    return Array.isArray(data) ? data : [];
  }

  async function load() {
    listStatus.textContent = "جارٍ تحميل قاعدة البيانات...";
    try {
      const result = await Promise.all([
        rows("directory_entities", "id,legacy_code,name_ar,name_en,entity_type,description,website_url,public_phone,public_email,public_address,primary_area_id,latitude,longitude,location_precision,location_source_id,location_verified_at,location_public,verification_status,public_visible,last_verified_at,next_review_at", "name_ar.asc"),
        rows("directory_projects", "id,legacy_code,name_ar,name_en,project_type,description,location_text,project_status,area_id,latitude,longitude,location_precision,location_source_id,location_verified_at,location_public,verification_status,public_visible,last_verified_at,next_review_at", "name_ar.asc"),
        rows("directory_areas", "id,legacy_code,slug,name_ar,name_en,area_type,parent_id,description,is_active,latitude,longitude,location_precision,location_source_id,location_verified_at,location_public,verification_status,public_visible,last_verified_at,next_review_at,notes", "name_ar.asc"),
        rows("directory_opportunities", "id,legacy_code,name_ar,city,activity,size_description,terms_as_published,announcement_date,opportunity_type,source_claimed_status,verification_status,public_visible,notes", "name_ar.asc"),
        rows("directory_sources", "id,source_code,title,publisher,source_type,source_url,publication_date,accessed_at,confidence_level,is_public,notes", "accessed_at.desc"),
        rows("directory_entity_private", "entity_id,internal_address,internal_phone,verification_label,confidence_level,notes,next_review_at"),
        rows("directory_project_private", "project_id,size_as_published,source_claimed_status,confidence_level,notes"),
        rows("directory_entity_sources", "entity_id,source_id,claim_key"),
        rows("directory_project_sources", "project_id,source_id,claim_key"),
        rows("directory_opportunity_sources", "opportunity_id,source_id,claim_key"),
        rows("directory_change_log", "id,table_name,record_id,changed_by,old_values,new_values,reason,created_at", "created_at.desc")
      ]);
      cache = {
        entities: result[0], projects: result[1], areas: result[2], opportunities: result[3],
        sources: result[4], privateEntities: result[5], privateProjects: result[6],
        entityLinks: result[7], projectLinks: result[8], opportunityLinks: result[9],
        history: result[10]
      };
      const published = [...cache.entities, ...cache.projects, ...cache.opportunities, ...cache.areas]
        .filter(item => item.public_visible && item.verification_status === "published").length;
      $("#dirStatEntities").textContent = cache.entities.length;
      $("#dirStatProjects").textContent = cache.projects.length;
      $("#dirStatAreas").textContent = cache.areas.length;
      $("#dirStatPublished").textContent = published;
      fillAreaFilter();
      render();
    } catch (error) {
      listStatus.textContent = "تعذر تحميل البيانات: " + error.message;
      throw error;
    }
  }

  function fillAreaFilter() {
    const current = areaFilter.value;
    areaFilter.innerHTML = '<option value="">كل مناطق أسيوط</option>' + cache.areas.map(area =>
      '<option value="' + esc(area.id) + '">' + esc(area.name_ar) + '</option>'
    ).join("");
    if ([...areaFilter.options].some(option => option.value === current)) areaFilter.value = current;
  }

  function selectedArea(value) {
    return '<select data-field="' + value + '">' +
      '<option value="">غير محدد</option>' +
      cache.areas.map(area => '<option value="' + esc(area.id) + '"' +
        (area.id === value ? " selected" : "") + '>' + esc(area.name_ar) + '</option>').join("") +
      '</select>';
  }

  function inputField(name, label, value, wide, type) {
    const inputType = type || "text";
    const step = inputType === "number" ? ' step="any"' : "";
    return '<label class="' + (wide ? "wide" : "") + '">' + esc(label) +
      '<input data-field="' + esc(name) + '" type="' + inputType + '"' + step + ' value="' + esc(value ?? "") + '">' +
      '</label>';
  }

  function textField(name, label, value, wide) {
    return '<label class="' + (wide ? "wide" : "") + '">' + esc(label) +
      '<textarea data-field="' + esc(name) + '">' + esc(value || "") + '</textarea></label>';
  }

  function selectField(name, label, value, options, wide) {
    return '<label class="' + (wide ? "wide" : "") + '">' + esc(label) +
      '<select data-field="' + esc(name) + '">' + options.map(option =>
        '<option value="' + esc(option[0]) + '"' + (option[0] === value ? " selected" : "") + '>' +
        esc(option[1]) + '</option>'
      ).join("") + '</select></label>';
  }

  function checkField(name, label, value) {
    return '<label class="dir-admin-check"><input data-field="' + esc(name) +
      '" type="checkbox"' + (value ? " checked" : "") + '> ' + esc(label) + '</label>';
  }

  function statusChips(record) {
    return '<span class="dir-admin-chip warn">' + esc(labels[record.verification_status] || record.verification_status || "غير محدد") +
      '</span><span class="dir-admin-chip ' + (record.public_visible ? "good" : "") + '">' +
      (record.public_visible ? "ظاهر للعامة" : "مخفي عن العامة") + '</span>';
  }

  function linksFor(type, id) {
    const config = ownerKeys[type];
    const linkRows = type === "entities" ? cache.entityLinks :
      type === "projects" ? cache.projectLinks : cache.opportunityLinks;
    const linkedIds = linkRows.filter(link => link[config.owner] === id).map(link => link.source_id);
    return cache.sources.filter(source => linkedIds.includes(source.id));
  }

  function sourceHtml(type, record) {
    const sources = linksFor(type, record.id);
    const linked = sources.length ? sources.map(source =>
      '<div class="dir-admin-source-row"><div><strong>' + esc(source.title) + '</strong><br><span>' +
      esc(source.publisher || source.source_type) + ' · ' +
      (source.is_public ? "مصدر عام" : "مصدر داخلي") + ' · ' +
      esc(source.confidence_level || "غير محدد") + '</span></div>' +
      (safeUrl(source.source_url) ? '<a href="' + esc(safeUrl(source.source_url)) +
        '" target="_blank" rel="noopener noreferrer">فتح المصدر ↗</a>' : "") + '</div>'
    ).join("") : '<p>لا يوجد مصدر مرتبط بهذا السجل حتى الآن.</p>';
    const options = cache.sources.map(source =>
      '<option value="' + esc(source.id) + '">' + esc(source.title) +
      (source.is_public ? " — عام" : " — داخلي") + '</option>'
    ).join("");
    return '<div class="dir-admin-sources"><strong>المراجع المرتبطة (' + sources.length + ')</strong>' + linked +
      '<div class="dir-admin-fields"><label class="wide">ربط مصدر موجود<select data-link-source><option value="">اختر مصدرًا من قاعدة المراجع</option>' +
      options + '</select></label></div><div class="dir-admin-actions"><button type="button" class="btn btn-outline-dark" data-link-record>ربط المصدر بالسجل</button></div></div>';
  }

  function mapLocationFields(type, record) {
    const linked = type === "areas" ? null : linksFor(type, record.id).map(source => source.id);
    const trustedSources = cache.sources.filter(source =>
      source.is_public === true &&
      ["high", "official"].includes(source.confidence_level) &&
      (!linked || linked.includes(source.id))
    );
    const sourceOptions = [["", "اختر مصدرًا عامًا موثوقًا"]].concat(
      trustedSources.map(source => [source.id, source.title + " — " + (source.confidence_level === "official" ? "رسمي" : "ثقة مرتفعة")])
    );
    const precisionOptions = [
      ["building", "مبنى / مدخل محدد"],
      ["street", "شارع"],
      ["district_centroid", "مركز حي — تقريبي"],
      ["area_centroid", "مركز منطقة — تقريبي"]
    ];
    return '<div class="dir-admin-map-fields wide"><strong>الموقع الجغرافي الموثق</strong>' +
      '<p>لن تظهر الإحداثيات على خريطة الزوار إلا عند إدخالها مع مصدر عام رسمي أو عالي الثقة وتاريخ تحقق، ثم تفعيل إظهار الموقع. لا تستخدم مركز الحي أو المنطقة كعنوان مبنى.</p>' +
      '<div class="dir-admin-fields">' +
      inputField("latitude", "خط العرض (Latitude)", record.latitude, false, "number") +
      inputField("longitude", "خط الطول (Longitude)", record.longitude, false, "number") +
      selectField("location_precision", "دقة تحديد الموقع", record.location_precision, [["", "اختر الدقة"], ...precisionOptions]) +
      selectField("location_source_id", "مصدر الإحداثيات", record.location_source_id, sourceOptions) +
      inputField("location_verified_at", "تاريخ التحقق من الإحداثيات", record.location_verified_at, false, "date") +
      checkField("location_public", "إظهار الموقع على الخريطة العامة بعد التحقق", record.location_public) +
      '</div><small>إذا تم إخفاء السجل أو سحب المصدر الموثوق، تُزال علامة الموقع من الخريطة.</small></div>';
  }

  function recordCard(type, record) {
    const privateRecord = type === "entities" ?
      cache.privateEntities.find(item => item.entity_id === record.id) :
      (type === "projects" ? cache.privateProjects.find(item => item.project_id === record.id) : null);
    let fields = "";
    let extra = "";
    if (type === "entities") {
      fields = inputField("name_ar", "اسم الجهة", record.name_ar) +
        inputField("name_en", "الاسم بالإنجليزية", record.name_en) +
        textField("description", "النشاط والوصف", record.description, true) +
        inputField("website_url", "الموقع الرسمي", record.website_url, true, "url") +
        inputField("public_phone", "هاتف معلن رسميًا", record.public_phone) +
        inputField("public_email", "بريد معلن رسميًا", record.public_email, false, "email") +
        inputField("public_address", "عنوان معلن رسميًا", record.public_address, true) +
        '<label>المنطقة الرئيسية' + selectedArea(record.primary_area_id) + '</label>' +
        mapLocationFields(type, record);
      extra = '<p><strong>التصنيف:</strong> ' + esc(record.entity_type) + ' · <strong>الكود:</strong> ' + esc(record.legacy_code || "—") + '</p>';
      if (privateRecord) extra += '<div class="dir-admin-sources"><strong>ملاحظات داخلية (لا تُنشر)</strong><p>العنوان المرشح: ' +
        esc(privateRecord.internal_address || "غير مسجل") + ' · الهاتف المرشح: ' +
        esc(privateRecord.internal_phone || "غير مسجل") + '</p><p>درجة الثقة: ' +
        esc(privateRecord.confidence_level || "غير محددة") + ' · ' +
        esc(privateRecord.verification_label || "") + '</p><p>' + esc(privateRecord.notes || "") + '</p></div>';
      fields += checkField("public_visible", "السجل ظاهر للعامة", record.public_visible);
    } else if (type === "projects") {
      fields = inputField("name_ar", "اسم المشروع", record.name_ar) +
        inputField("name_en", "الاسم بالإنجليزية", record.name_en) +
        textField("description", "وصف المشروع", record.description, true) +
        inputField("location_text", "وصف الموقع", record.location_text, true) +
        '<label>المنطقة' + selectedArea(record.area_id) + '</label>' +
        selectField("project_status", "حالة المشروع", record.project_status, [
          ["unknown", "غير معلومة"], ["announced", "معلن"], ["planned", "مخطط"], ["under_construction", "تحت الإنشاء"],
          ["partially_delivered", "تم تسليم جزء"], ["completed", "مكتمل"], ["operating", "يعمل"], ["stalled", "متوقف"]
        ]) +
        mapLocationFields(type, record) +
        checkField("public_visible", "السجل ظاهر للعامة", record.public_visible);
      extra = '<p><strong>النوع:</strong> ' + esc(record.project_type) + ' · <strong>الكود:</strong> ' + esc(record.legacy_code || "—") + '</p>';
      if (privateRecord) extra += '<div class="dir-admin-sources"><strong>تفاصيل داخلية من المصدر</strong><p>المساحة كما وردت: ' +
        esc(privateRecord.size_as_published || "غير منشورة") + ' · الحالة كما أعلنها المصدر: ' +
        esc(privateRecord.source_claimed_status || "غير محددة") + ' · الثقة: ' +
        esc(privateRecord.confidence_level || "غير محددة") + '</p><p>' + esc(privateRecord.notes || "") + '</p></div>';
    } else if (type === "opportunities") {
      fields = inputField("name_ar", "اسم الطرح / الفرصة", record.name_ar) +
        inputField("city", "المدينة / المركز", record.city) +
        inputField("activity", "النشاط", record.activity) +
        inputField("announcement_date", "تاريخ الإعلان", record.announcement_date, false, "date") +
        inputField("opportunity_type", "نوع الطرح", record.opportunity_type) +
        inputField("source_claimed_status", "الحالة كما وردت بالمصدر", record.source_claimed_status) +
        textField("size_description", "المساحة / الحجم كما ورد بالمصدر", record.size_description) +
        textField("terms_as_published", "الشروط كما وردت بالمصدر", record.terms_as_published, true) +
        textField("notes", "ملاحظات داخلية", record.notes, true) +
        checkField("public_visible", "السجل ظاهر للعامة", record.public_visible);
      extra = '<p><strong>الكود:</strong> ' + esc(record.legacy_code || "—") +
        ' · <strong>تنبيه:</strong> راجع تاريخ الإعلان وحالة الطرح قبل عرضه كفرصة حالية.</p>';
    } else if (type === "areas") {
      fields = inputField("name_ar", "اسم المنطقة بالعربية", record.name_ar) +
        inputField("name_en", "اسم المنطقة بالإنجليزية", record.name_en) +
        inputField("slug", "المعرّف المختصر", record.slug) +
        inputField("area_type", "نوع المنطقة", record.area_type) +
        textField("description", "وصف المنطقة", record.description, true) +
        textField("notes", "ملاحظات داخلية", record.notes, true) +
        mapLocationFields(type, record) +
        checkField("is_active", "المنطقة نشطة", record.is_active) +
        checkField("public_visible", "المنطقة ظاهرة للعامة", record.public_visible);
      extra = '<p><strong>الكود:</strong> ' + esc(record.legacy_code || "—") + ' · ' +
        (record.parent_id ? "منطقة فرعية" : "نطاق رئيسي") + '</p>';
    }
    const sourcePart = ownerKeys[type] ? sourceHtml(type, record) : "";
    return '<article class="dir-admin-card" data-kind="' + type + '" data-id="' + esc(record.id) + '">' +
      '<div class="dir-admin-meta">' + statusChips(record) + '</div><h3>' + esc(record.name_ar || "سجل بلا اسم") +
      '</h3>' + extra + '<div class="dir-admin-fields">' + fields + '</div>' + sourcePart +
      (type === "areas" || type === "entities" || type === "projects" || type === "opportunities" ?
        '<label>سبب / ملاحظة المراجعة<input data-reason type="text" maxlength="240" placeholder="مثال: مراجعة المصدر الرسمي بتاريخ اليوم"></label>' : "") +
      '<label class="dir-admin-check"><input type="checkbox" data-confirm> أؤكد أنني راجعت المعلومات والمصدر قبل النشر</label>' +
      '<div class="dir-admin-actions"><button type="button" class="btn btn-outline-dark" data-save>حفظ التعديلات</button>' +
      '<button type="button" class="btn btn-gold" data-publish>اعتماد ونشر</button>' +
      '<button type="button" class="btn btn-outline-dark" data-unpublish>إخفاء وإعادة للمراجعة</button>' +
      '<button type="button" class="btn btn-outline-dark" data-archive>أرشفة</button></div></article>';
  }

  function sourceCard(source) {
    return '<article class="dir-admin-card" data-kind="sources" data-id="' + esc(source.id) + '">' +
      '<div class="dir-admin-meta"><span class="dir-admin-chip ' + (source.is_public ? "good" : "warn") + '">' +
      (source.is_public ? "مصدر عام" : "مصدر داخلي") + '</span><span class="dir-admin-chip">' +
      esc(source.confidence_level || "غير محدد") + '</span></div><div class="dir-admin-fields">' +
      inputField("title", "عنوان المصدر", source.title) +
      inputField("publisher", "الناشر", source.publisher) +
      inputField("source_type", "نوع المصدر", source.source_type) +
      inputField("source_url", "رابط المصدر", source.source_url, true, "url") +
      inputField("publication_date", "تاريخ النشر", source.publication_date, false, "date") +
      selectField("confidence_level", "مستوى الثقة", source.confidence_level, [
        ["unverified", "غير متحقق"], ["low", "منخفض"], ["medium", "متوسط"],
        ["high", "مرتفع"], ["official", "رسمي"]
      ]) + textField("notes", "ملاحظات داخلية", source.notes, true) +
      checkField("is_public", "يمكن استخدامه كمصدر عام في السجلات المنشورة", source.is_public) +
      '</div><p>آخر اطلاع: ' + dateText(source.accessed_at) + ' · معرّف المصدر: ' + esc(source.source_code || source.id) + '</p>' +
      (safeUrl(source.source_url) ? '<a href="' + esc(safeUrl(source.source_url)) +
        '" target="_blank" rel="noopener noreferrer">فتح المصدر في نافذة جديدة ↗</a>' : "") +
      '<div class="dir-admin-actions"><button type="button" class="btn btn-outline-dark" data-save-source>حفظ المصدر</button></div></article>';
  }

  function historyCard(item) {
    return '<details class="dir-admin-log"><summary>' + esc(item.table_name) + ' · ' +
      esc(item.reason || "تعديل") + ' · ' + dateText(item.created_at) + '</summary><p>معرّف السجل: ' +
      esc(item.record_id) + ' · المنفذ: ' + esc(item.changed_by || "غير مسجل") + '</p>' +
      '<strong>قبل التعديل</strong><pre>' + esc(JSON.stringify(item.old_values || {}, null, 2)) +
      '</pre><strong>بعد التعديل</strong><pre>' + esc(JSON.stringify(item.new_values || {}, null, 2)) + '</pre></details>';
  }

  function filteredRows() {
    const all = cache[view] || [];
    const query = String(searchInput.value || "").trim().toLocaleLowerCase("ar");
    const statusValue = statusFilter.value;
    const areaValue = areaFilter.value;
    return all.filter(record => {
      if (query) {
        const searchable = Object.values(record).filter(value =>
          value === null || ["string", "number", "boolean"].includes(typeof value)
        ).join(" ").toLocaleLowerCase("ar");
        if (!searchable.includes(query)) return false;
      }
      if (view === "sources") {
        if (statusValue === "public" && !record.is_public) return false;
        if (statusValue === "internal" && record.is_public) return false;
      } else if (view !== "history" && statusValue && record.verification_status !== statusValue) return false;
      if (areaValue && view !== "history" && view !== "sources") {
        if (view === "entities" && record.primary_area_id !== areaValue) return false;
        if (view === "projects" && record.area_id !== areaValue) return false;
        if (view === "areas" && record.id !== areaValue && record.parent_id !== areaValue) return false;
        if (view === "opportunities") {
          const area = cache.areas.find(item => item.id === areaValue);
          if (!area || !String(record.city || "").includes(area.name_ar)) return false;
        }
      }
      return true;
    });
  }

  function render() {
    const isHistory = view === "history";
    toolbar.hidden = isHistory;
    sourcesPanel.hidden = view !== "sources";
    const previousStatus = statusFilter.value;
    const statusOptions = view === "sources" ? [
      ["", "كل المصادر"], ["public", "مصادر عامة"], ["internal", "مصادر داخلية"]
    ] : [
      ["", "كل الحالات"], ["draft", "مسودة"], ["needs_review", "قيد المراجعة"],
      ["verified", "تم التحقق"], ["published", "منشور"], ["archived", "مؤرشف"]
    ];
    statusFilter.innerHTML = statusOptions.map(option =>
      '<option value="' + option[0] + '">' + option[1] + '</option>'
    ).join("");
    if (statusOptions.some(option => option[0] === previousStatus)) statusFilter.value = previousStatus;
    const result = filteredRows();
    records.className = view === "history" ? "" : "dir-admin-grid";
    if (view === "sources") records.innerHTML = result.map(sourceCard).join("") ||
      '<p class="dir-admin-empty">لا توجد مصادر مطابقة للبحث.</p>';
    else if (isHistory) records.innerHTML = result.map(historyCard).join("") ||
      '<p class="dir-admin-empty">لا توجد تعديلات مسجلة حتى الآن.</p>';
    else records.innerHTML = result.map(record => recordCard(view, record)).join("") ||
      '<p class="dir-admin-empty">لا توجد سجلات مطابقة للفلاتر الحالية.</p>';
    listStatus.textContent = "السجلات المعروضة: " + result.length +
      " من " + (cache[view] || []).length + " · التغييرات تُسجل في سجل المراجعة.";
  }

  function patchFromCard(card) {
    const patch = {};
    card.querySelectorAll("[data-field]").forEach(element => {
      patch[element.dataset.field] = element.type === "checkbox" ? element.checked :
        (element.value.trim() === "" ? null : element.value.trim());
    });
    return patch;
  }

  function changedValues(oldRecord, patch) {
    const before = {};
    const after = {};
    Object.keys(patch).forEach(key => {
      before[key] = oldRecord?.[key] ?? null;
      after[key] = patch[key];
    });
    return { before, after };
  }

  async function writeAudit(tableName, recordId, before, after, reason) {
    const userId = sessionUserId();
    const audit = {
      table_name: tableName,
      record_id: recordId,
      changed_by: userId,
      old_values: before || {},
      new_values: after || {},
      reason: String(reason || "تعديل من لوحة إدارة قاعدة بيانات السوق العقاري").slice(0, 240)
    };
    const result = await api("/rest/v1/directory_change_log", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(audit)
    });
    if (!Array.isArray(result) || result.length !== 1) {
      throw new Error("تم تعديل السجل، لكن لم يؤكد النظام حفظ أثر التعديل في سجل المراجعة.");
    }
  }

  function prepareMapLocationPatch(type, patch) {
    if (!["areas", "entities", "projects"].includes(type)) return patch;
    const clearLocation = () => {
      patch.latitude = null;
      patch.longitude = null;
      patch.location_precision = null;
      patch.location_source_id = null;
      patch.location_verified_at = null;
      patch.location_public = false;
    };
    if (patch.public_visible === false || (type === "areas" && patch.is_active === false) ||
        patch.location_public !== true) {
      clearLocation();
      return patch;
    }
    const latitude = Number(patch.latitude);
    const longitude = Number(patch.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error("أدخل خط عرض بين -90 و90 وخط طول بين -180 و180.");
    }
    if (!patch.location_precision || !patch.location_source_id || !patch.location_verified_at) {
      throw new Error("قبل إظهار الموقع، اختر دقة التحديد والمصدر الموثوق وتاريخ التحقق.");
    }
    if (type === "areas" && !["area_centroid", "district_centroid"].includes(patch.location_precision)) {
      throw new Error("موقع المنطقة يجب أن يكون مركز منطقة أو مركز حي، وليس عنوان مبنى.");
    }
    patch.latitude = latitude;
    patch.longitude = longitude;
    return patch;
  }

  async function updateRecord(type, recordId, patch, reason) {
    prepareMapLocationPatch(type, patch);
    const table = tables[type];
    const oldRecord = (cache[type] || []).find(item => item.id === recordId) || {};
    const beforeAfter = changedValues(oldRecord, patch);
    const result = await api("/rest/v1/" + table + "?id=eq." + encodeURIComponent(recordId), {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch)
    });
    if (!Array.isArray(result) || result.length !== 1) {
      throw new Error("لم يؤكد الخادم تحديث سجل واحد؛ حدّث القائمة قبل المحاولة مجددًا.");
    }
    await writeAudit(table, recordId, beforeAfter.before, beforeAfter.after, reason);
  }

  async function addSourceLink(type, recordId, sourceId) {
    const source = cache.sources.find(item => item.id === sourceId);
    if (!source) throw new Error("اختر مصدرًا صحيحًا من قائمة المصادر.");
    const config = ownerKeys[type];
    const link = {};
    link[config.owner] = recordId;
    link.source_id = sourceId;
    link.claim_key = "general";
    const result = await api("/rest/v1/" + config.link, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(link)
    });
    if (!Array.isArray(result) || result.length !== 1) throw new Error("لم يؤكد الخادم ربط المصدر بالسجل.");
    await writeAudit(config.link, recordId, {}, link, "ربط مصدر بالسجل");
  }

  function getCurrentType() {
    return view;
  }

  records.addEventListener("click", async event => {
    const card = event.target.closest(".dir-admin-card[data-kind]");
    if (!card) return;
    const button = event.target.closest("button");
    if (!button) return;
    button.disabled = true;
    try {
      await requireAdmin();
      const type = card.dataset.kind;
      const recordId = card.dataset.id;
      if (button.hasAttribute("data-save-source")) {
        const patch = patchFromCard(card);
        const url = safeUrl(patch.source_url);
        if (!url) throw new Error("اكتب رابط مصدر صحيحًا يبدأ بـ https:// أو http://.");
        if (patch.is_public === false) {
          const linkedLiveEntity = cache.entityLinks.some(link => link.source_id === recordId &&
            cache.entities.some(item => item.id === link.entity_id && item.public_visible && item.verification_status === "published"));
          const linkedLiveProject = cache.projectLinks.some(link => link.source_id === recordId &&
            cache.projects.some(item => item.id === link.project_id && item.public_visible && item.verification_status === "published"));
          const linkedLiveOpportunity = cache.opportunityLinks.some(link => link.source_id === recordId &&
            cache.opportunities.some(item => item.id === link.opportunity_id && item.public_visible && item.verification_status === "published"));
          if (linkedLiveEntity || linkedLiveProject || linkedLiveOpportunity) {
            throw new Error("هذا المصدر مرتبط بسجل منشور. أخفِ السجل العام أو اربطه بمصدر عام بديل قبل إخفاء هذا المصدر.");
          }
        }
        const beforeAfter = changedValues(cache.sources.find(item => item.id === recordId), patch);
        const result = await api("/rest/v1/directory_sources?id=eq." + encodeURIComponent(recordId), {
          method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch)
        });
        if (!Array.isArray(result) || result.length !== 1) throw new Error("لم يؤكد الخادم تحديث المصدر.");
        await writeAudit("directory_sources", recordId, beforeAfter.before, beforeAfter.after, "تحديث بيانات مصدر");
        say("تم تحديث المصدر وتسجيل التعديل.");
      } else if (button.hasAttribute("data-link-record")) {
        const sourceId = card.querySelector("[data-link-source]")?.value;
        if (!sourceId) throw new Error("اختر مصدرًا أولًا.");
        await addSourceLink(type, recordId, sourceId);
        say("تم ربط المصدر بالسجل وتسجيل العملية.");
      } else {
        const patch = patchFromCard(card);
        const auditReason = card.querySelector("[data-reason]")?.value.trim() || "";
        if (button.hasAttribute("data-save")) {
          await updateRecord(type, recordId, patch, auditReason || "حفظ تعديلات السجل");
          say("تم حفظ التعديلات دون تغيير حالة النشر، وتسجيلها في سجل المراجعة.");
        } else if (button.hasAttribute("data-publish")) {
          if (!card.querySelector("[data-confirm]")?.checked) throw new Error("يجب تأكيد مراجعة المعلومات والمصدر قبل النشر.");
          if (ownerKeys[type] && !linksFor(type, recordId).some(source => source.is_public)) {
            throw new Error("لا يمكن النشر قبل ربط مصدر عام واحد على الأقل.");
          }
          if (type === "opportunities" && !window.confirm("هل تحققت من تاريخ الطرح وحالته؟ تأكد ألا يظهر الطرح المؤرشف كفرصة متاحة.")) return;
          if (!window.confirm("اعتماد السجل وإظهاره للعامة في دليل أسيوط العقاري؟")) return;
          patch.verification_status = "published";
          patch.public_visible = true;
          patch.last_verified_at = new Date().toISOString().slice(0, 10);
          if (type === "entities" || type === "projects") {
            const next = new Date();
            next.setDate(next.getDate() + (type === "entities" ? 90 : 60));
            patch.next_review_at = next.toISOString().slice(0, 10);
          }
          await updateRecord(type, recordId, patch, auditReason || "اعتماد ونشر سجل بعد المراجعة");
          say("تم اعتماد السجل ونشره وتسجيل قرار الاعتماد.");
        } else if (button.hasAttribute("data-unpublish")) {
          if (!window.confirm("إخفاء السجل وإعادته إلى حالة قيد المراجعة؟")) return;
          patch.verification_status = "needs_review";
          patch.public_visible = false;
          await updateRecord(type, recordId, patch, auditReason || "إخفاء السجل وإعادته للمراجعة");
          say("تم إخفاء السجل وإعادته للمراجعة.");
        } else if (button.hasAttribute("data-archive")) {
          if (!window.confirm("أرشفة السجل وإخفاؤه من الدليل العام؟")) return;
          patch.verification_status = "archived";
          patch.public_visible = false;
          await updateRecord(type, recordId, patch, auditReason || "أرشفة السجل");
          say("تمت أرشفة السجل وإخفاؤه عن الزوار.");
        } else return;
      }
      await load();
    } catch (error) {
      say(error.message || "تعذر تنفيذ العملية.");
    } finally {
      button.disabled = false;
    }
  });

  sourceForm.addEventListener("submit", async event => {
    event.preventDefault();
    const submit = sourceForm.querySelector("button[type=submit]");
    submit.disabled = true;
    try {
      await requireAdmin();
      const form = new FormData(sourceForm);
      const url = safeUrl(form.get("source_url"));
      if (!url) throw new Error("يجب إدخال رابط صحيح يبدأ بـ https:// أو http://.");
      const source = {
        title: String(form.get("title") || "").trim(),
        publisher: String(form.get("publisher") || "").trim() || null,
        source_type: String(form.get("source_type") || "").trim(),
        source_url: url,
        publication_date: String(form.get("publication_date") || "") || null,
        confidence_level: String(form.get("confidence_level") || "unverified"),
        is_public: form.get("is_public") === "on",
        notes: String(form.get("notes") || "").trim() || null
      };
      const result = await api("/rest/v1/directory_sources", {
        method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(source)
      });
      if (!Array.isArray(result) || result.length !== 1) throw new Error("لم يؤكد الخادم إضافة المصدر.");
      await writeAudit("directory_sources", result[0].id, {}, source, "إضافة مصدر جديد");
      sourceForm.reset();
      say("تم حفظ المصدر الجديد. يمكنك ربطه بأي جهة أو مشروع أو طرح من بطاقة السجل.");
      await load();
    } catch (error) {
      say(error.message || "تعذر إضافة المصدر.");
    } finally { submit.disabled = false; }
  });

  document.querySelectorAll(".dir-admin-tabs button").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".dir-admin-tabs button").forEach(tab => {
        const active = tab === button;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      view = button.dataset.view;
      render();
    });
  });
  [searchInput, statusFilter, areaFilter].forEach(control => {
    control.addEventListener(control === searchInput ? "input" : "change", render);
  });

  $("#dirAdminLogin").addEventListener("submit", async event => {
    event.preventDefault();
    const button = event.target.querySelector("button[type=submit]");
    button.disabled = true;
    say("جارٍ تسجيل الدخول والتحقق من صلاحية الإدارة...");
    try {
      if (!auth?.signIn) throw new Error("خدمة تسجيل الدخول غير جاهزة.");
      await auth.signIn($("#dirAdminEmail").value.trim(), $("#dirAdminPassword").value);
      session = auth.getSession?.() || null;
      await requireAdmin();
      setState(true);
      await load();
      say("تم التحقق من صلاحية مسؤول قاعدة البيانات.");
    } catch (error) {
      session = null;
      setState(false);
      say(error.message || "تعذر تسجيل الدخول أو التحقق من الصلاحية.");
    } finally { button.disabled = false; }
  });

  logout.addEventListener("click", async () => {
    try {
      await auth?.signOut?.();
      session = null;
      setState(false);
      say("تم تسجيل الخروج.");
    } catch (error) { say(error.message || "تعذر تسجيل الخروج."); }
  });

  setState(false);
  (async () => {
    if (!session?.access_token) return;
    try {
      await requireAdmin();
      setState(true);
      await load();
      say("تم التحقق من صلاحية مسؤول قاعدة البيانات.");
    } catch (_) {
      session = null;
      setState(false);
      say("يلزم تسجيل الدخول بحساب مسؤول قاعدة البيانات.");
    }
  })();
});