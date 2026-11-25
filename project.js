document.addEventListener("DOMContentLoaded", async () => {
  "use strict";
  const root = document.getElementById("projectProfileRoot");
  const config = window.LAYAN_CONFIG || {};
  const base = String(config.SUPABASE_URL || "").replace(/\/$/, "");
  const key = config.SUPABASE_PUBLISHABLE_KEY || "";
  const params = new URLSearchParams(window.location.search);
  const projectId = String(params.get("id") || "").trim();
  const projectSlug = String(params.get("slug") || "").trim();

  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
  const safeURL = value => {
    try {
      const url = new URL(String(value || ""));
      return ["https:","http:"].includes(url.protocol) ? url.href : "";
    } catch (_) { return ""; }
  };
  const dateLabel = value => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ar-EG");
  };
  const projectTypes = {
    residential:"سكني",commercial:"تجاري",administrative:"إداري",medical:"طبي",
    educational:"تعليمي",mixed_use:"متعدد الاستخدامات",land:"أراضٍ",service:"خدمي",other:"نوع آخر"
  };
  const statuses = {
    announced:"معلن عنه وفق المصادر",planned:"مخطط وفق السجل",
    under_construction:"تحت التنفيذ وفق المصدر",partially_delivered:"تسليم مرحلي وفق المصدر",
    completed:"مكتمل وفق السجل",operating:"يعمل وفق السجل",stalled:"متوقف وفق السجل",
    unknown:"الحالة غير محددة"
  };
  const relations = {
    developer:"المطور / الجهة المطورة",land_owner:"مالك الأرض",marketing_agent:"وكيل تسويق",
    sales_agent:"وكيل مبيعات",contractor:"مقاول",consultant:"استشاري",
    operator:"جهة تشغيل",public_authority:"جهة حكومية / عامة",other:"جهة مرتبطة"
  };
  const unitTypes = {
    apartment:"شقة",villa:"فيلا",shop:"محل تجاري",office:"مكتب إداري",
    clinic:"عيادة",land:"قطعة أرض",other:"وحدة أخرى"
  };
  const moneyLabel = value => value == null || value === ""
    ? "السعر عند التواصل"
    : new Intl.NumberFormat("ar-EG-u-nu-latn",{maximumFractionDigits:0}).format(Number(value)) + " جنيه";
  function unitCard(unit, unitOffers) {
    const facts = [
      unit.area_m2 ? new Intl.NumberFormat("ar-EG-u-nu-latn",{maximumFractionDigits:2}).format(Number(unit.area_m2)) + " م²" : null,
      unit.bedrooms != null ? unit.bedrooms + " غرف" : null,
      unit.bathrooms != null ? unit.bathrooms + " حمامات" : null
    ].filter(Boolean);
    const offersHTML = unitOffers.length ? unitOffers.map(offer => {
      const rent = String(offer.listing_purpose || "").includes("إيجار");
      const title = offer.title || "إعلان عقاري منشور";
      const price = offer.price_on_request === true ? "السعر عند التواصل" : moneyLabel(offer.total_price);
      const href = "./property.html?id=" + encodeURIComponent(offer.id);
      return '<article class="project-unit-offer-card">' +
        '<span class="project-unit-offer-purpose">' + escapeHTML(offer.listing_purpose || "إعلان عقاري") + '</span>' +
        '<h4><a href="' + escapeHTML(href) + '">' + escapeHTML(title) + '</a></h4>' +
        '<p>' + escapeHTML(offer.property_type || "عقار") + (offer.area_m2 ? " · " + escapeHTML(offer.area_m2) + " م²" : "") + '</p>' +
        '<strong>' + escapeHTML(price) + (rent ? " · إيجار" : "") + '</strong>' +
        '<a class="project-unit-offer-link" href="' + escapeHTML(href) + '">عرض الإعلان ↗</a>' +
      '</article>';
    }).join("") : '<p class="project-unit-no-offers">لا توجد إعلانات متاحة مرتبطة بهذه الوحدة حاليًا.</p>';
    return '<article class="project-unit-card">' +
      '<div class="project-unit-card-head"><span class="project-unit-kind">' + escapeHTML(unitTypes[unit.unit_type] || "وحدة") + '</span><h3>' + escapeHTML(unit.unit_ref || "وحدة منشورة") + '</h3></div>' +
      (facts.length ? '<div class="project-unit-facts">' + facts.map(fact => '<span>' + escapeHTML(fact) + '</span>').join("") + '</div>' : "") +
      (unit.building_label ? '<p><strong>المبنى:</strong> ' + escapeHTML(unit.building_label) + '</p>' : "") +
      (unit.floor_label ? '<p><strong>الدور:</strong> ' + escapeHTML(unit.floor_label) + '</p>' : "") +
      (unit.unit_number ? '<p><strong>رقم الوحدة:</strong> ' + escapeHTML(unit.unit_number) + '</p>' : "") +
      (unit.finishing ? '<p><strong>التشطيب:</strong> ' + escapeHTML(unit.finishing) + '</p>' : "") +
      (unit.description ? '<p>' + escapeHTML(unit.description) + '</p>' : "") +
      '<div class="project-unit-offers"><h4>الإعلانات المرتبطة بالوحدة</h4>' + offersHTML + '</div>' +
    '</article>';
  }

  function stateMessage(title, message) {
    root.innerHTML = '<section class="project-state"><h1>' + escapeHTML(title) +
      '</h1><p>' + escapeHTML(message) + '</p><div class="project-actions" style="justify-content:center">' +
      '<a class="btn btn-gold" href="./directory.html?view=projects">العودة إلى المشروعات</a></div></section>';
  }

  async function api(table, filters, select) {
    if (!base || !key) throw new Error("إعدادات الاتصال غير متاحة.");
    const query = new URLSearchParams({ select:select || "*", ...filters });
    const response = await fetch(base + "/rest/v1/" + table + "?" + query.toString(), {
      headers:{ apikey:key, Authorization:"Bearer " + key }
    });
    const body = await response.text();
    let data = [];
    try { data = body ? JSON.parse(body) : []; } catch (_) {}
    if (!response.ok) throw new Error("تعذر تحميل بيانات المشروع.");
    return Array.isArray(data) ? data : [];
  }

  async function optionalRows(table, filters, select) {
    try { return await api(table, filters, select); } catch (_) { return []; }
  }

  function mapSection(project, area, trustedSource) {
    const coordinatesAllowed =
      project.location_public === true &&
      project.latitude !== null && project.latitude !== undefined &&
      project.longitude !== null && project.longitude !== undefined &&
      project.location_source_id &&
      trustedSource && ["high","official"].includes(String(trustedSource.confidence_level || "").toLowerCase());
    const mapQuery = coordinatesAllowed
      ? String(Number(project.latitude)) + "," + String(Number(project.longitude))
      : [area && area.name_ar, project.location_text, "أسيوط", "مصر"].filter(Boolean).join(", ");
    const query = encodeURIComponent(mapQuery);
    const mapTitle = coordinatesAllowed ? "خريطة موقع منشور بمصدر موثوق للمشروع" : "بحث جغرافي استرشادي في نطاق المشروع";
    const note = coordinatesAllowed
      ? "الإحداثيات معروضة بعد اعتماد النشر وربطها بمصدر عام موثوق."
      : "هذه خريطة بحث استرشادية عن المنطقة المذكورة في المصادر، وليست دبوسًا جغرافيًا مؤكدًا لموقع المشروع.";
    return '<section class="project-section" aria-labelledby="projectMapTitle"><h2 id="projectMapTitle">الموقع والنطاق الجغرافي</h2>' +
      '<p>' + escapeHTML([area && area.name_ar, project.location_text].filter(Boolean).join(" · ") || "لم يُنشر موقع تفصيلي للمشروع.") + '</p>' +
      '<div class="project-map-frame"><iframe title="' + escapeHTML(mapTitle) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=' + query + '&output=embed"></iframe></div>' +
      '<p class="project-map-note">' + escapeHTML(note) + '</p>' +
      '<a class="project-map-link" href="https://www.google.com/maps/search/?api=1&query=' + query + '" target="_blank" rel="noopener noreferrer">فتح بحث المنطقة على خرائط Google ↗</a></section>';
  }

  function relationCard(entity, relationType) {
    const href = "./company.html?entity_id=" + encodeURIComponent(entity.id);
    const website = safeURL(entity.website_url);
    const phone = String(entity.public_phone || "").replace(/[^0-9+]/g, "");
    const whatsappDigits = String(entity.public_whatsapp || entity.public_phone || "").replace(/\D/g, "");
    const whatsapp = whatsappDigits
      ? "https://wa.me/" + (whatsappDigits.startsWith("0") ? "20" + whatsappDigits.slice(1) : whatsappDigits)
      : "";
    return '<article class="project-entity-card"><span class="project-entity-kind">' + escapeHTML(relations[relationType] || "جهة مرتبطة") + '</span>' +
      '<h3>' + escapeHTML(entity.name_ar || "جهة منشورة") + '</h3>' +
      (entity.description ? '<p>' + escapeHTML(entity.description) + '</p>' : "") +
      '<div class="project-actions">' +
      '<a href="' + escapeHTML(href) + '">عرض ملف الجهة ↗</a>' +
      (website ? '<a href="' + escapeHTML(website) + '" target="_blank" rel="noopener noreferrer">الموقع الرسمي ↗</a>' : "") +
      (phone ? '<a href="tel:' + escapeHTML(phone) + '">اتصال</a>' : "") +
      (whatsapp ? '<a href="' + escapeHTML(whatsapp) + '" target="_blank" rel="noopener noreferrer">واتساب</a>' : "") +
      '</div></article>';
  }

  function sourceCard(source) {
    const url = safeURL(source.source_url);
    return '<article class="project-source-card"><span class="project-source-kind">' + escapeHTML(source.source_type || "مرجع عام") + '</span>' +
      '<h3>' + escapeHTML(source.title || "مصدر مرتبط بالمشروع") + '</h3>' +
      '<p>' + escapeHTML(source.publisher || "الناشر غير محدد") + '</p>' +
      '<div class="project-source-meta">' +
      (source.accessed_at ? '<span>آخر اطلاع: ' + escapeHTML(dateLabel(source.accessed_at)) + '</span>' : "") +
      (source.confidence_level ? '<span>مستوى المصدر: ' + escapeHTML(source.confidence_level) + '</span>' : "") +
      '</div>' +
      (url ? '<a href="' + escapeHTML(url) + '" target="_blank" rel="noopener noreferrer">فتح المصدر الأصلي ↗</a>' : '<p>رابط المصدر غير متاح.</p>') +
      '</article>';
  }

  async function loadProject() {
    if (!projectId && !projectSlug) {
      stateMessage("لم يتم تحديد المشروع", "افتح صفحة المشروع من قائمة المشروعات المنشورة في الدليل العقاري.");
      return;
    }
    try {
      const field = projectId ? "id" : "slug";
      const filterValue = projectId || projectSlug;
      const projects = await api("directory_projects", {
        [field]:"eq." + filterValue,
        public_visible:"eq.true",
        verification_status:"eq.published",
        limit:"1"
      }, "id,slug,name_ar,name_en,project_type,description,location_text,project_status,area_id,size_value,size_unit,unit_count,latitude,longitude,location_precision,location_source_id,location_verified_at,location_public,last_verified_at,next_review_at,verification_status,public_visible");
      const project = projects[0];
      if (!project || project.public_visible !== true || project.verification_status !== "published") {
        stateMessage("المشروع غير متاح للنشر العام", "هذا السجل غير منشور أو غير معتمد حاليًا. يمكنك العودة إلى قائمة المشروعات المتاحة للعامة.");
        return;
      }

      const [areaRows, sourceLinks, relationLinks, unitRows] = await Promise.all([
        project.area_id ? optionalRows("directory_areas", {
          id:"eq." + project.area_id,public_visible:"eq.true",verification_status:"eq.published",is_active:"eq.true",limit:"1"
        }, "id,name_ar,area_type,public_visible,verification_status") : Promise.resolve([]),
        optionalRows("directory_project_sources", { project_id:"eq." + project.id }, "source_id"),
        optionalRows("directory_project_entities", { project_id:"eq." + project.id }, "entity_id,relation_type"),
        optionalRows("directory_project_units", {
          project_id:"eq." + project.id,public_visible:"eq.true",verification_status:"eq.published",order:"unit_ref.asc"
        }, "id,project_id,unit_ref,unit_type,building_label,floor_label,unit_number,area_m2,bedrooms,bathrooms,finishing,description,verification_status,public_visible")
      ]);
      const sourceIds = [...new Set(sourceLinks.map(row => row.source_id).filter(Boolean))];
      const entityIds = [...new Set(relationLinks.map(row => row.entity_id).filter(Boolean))];
      const [sources, entities] = await Promise.all([
        sourceIds.length ? optionalRows("directory_sources", {
          id:"in.(" + sourceIds.join(",") + ")",is_public:"eq.true"
        }, "id,title,publisher,source_type,source_url,accessed_at,confidence_level,is_public") : Promise.resolve([]),
        entityIds.length ? optionalRows("directory_entities", {
          id:"in.(" + entityIds.join(",") + ")",public_visible:"eq.true",verification_status:"eq.published"
        }, "id,name_ar,entity_type,description,website_url,public_phone,public_whatsapp,public_visible,verification_status") : Promise.resolve([])
      ]);
      const unitIds = [...new Set(unitRows.map(unit => unit.id).filter(Boolean))];
      const linkedOffers = unitIds.length ? await optionalRows("property_offers", {
        project_unit_id:"in.(" + unitIds.join(",") + ")",
        status:"eq.available",
        order:"created_at.desc"
      }, "id,title,listing_purpose,property_type,total_price,price_on_request,area_m2,project_unit_id,status,created_at") : [];
      const area = areaRows.find(row => row.public_visible === true && row.verification_status === "published") || null;
      const publicSources = sources.filter(source => source.is_public === true && safeURL(source.source_url));
      const publicEntities = entities.filter(entity => entity.public_visible === true && entity.verification_status === "published");
      const trustedSource = publicSources.find(source =>
        String(source.id) === String(project.location_source_id) &&
        ["high","official"].includes(String(source.confidence_level || "").toLowerCase())
      ) || null;

      const name = String(project.name_ar || "مشروع عقاري");
      const description = String(project.description || "لا يتوفر وصف منشور للمشروع حتى الآن.");
      const areaName = area ? area.name_ar : "";
      document.title = name + " | ملف المشروع | أسيوط عقار";
      const metaDescription = description.slice(0, 155);
      document.querySelector('meta[name="description"]')?.setAttribute("content", metaDescription);
      document.querySelector('meta[property="og:title"]')?.setAttribute("content", name + " | أسيوط عقار");
      document.querySelector('meta[property="og:description"]')?.setAttribute("content", metaDescription);
      document.querySelector('meta[property="og:url"]')?.setAttribute("content", window.location.href.split("#")[0]);

      const facts = [
        ["نوع المشروع", projectTypes[project.project_type] || "غير محدد"],
        ["الحالة المنشورة", statuses[project.project_status] || statuses.unknown],
        ["النطاق", areaName || project.location_text || "غير محدد"],
        project.size_value !== null && project.size_value !== undefined && project.size_unit
          ? ["المساحة المعلنة", new Intl.NumberFormat("ar-EG-u-nu-latn",{maximumFractionDigits:2}).format(Number(project.size_value)) + " " + project.size_unit] : null,
        project.unit_count !== null && project.unit_count !== undefined
          ? ["عدد الوحدات المعلن", new Intl.NumberFormat("ar-EG-u-nu-latn",{maximumFractionDigits:0}).format(Number(project.unit_count))] : null,
        project.last_verified_at ? ["آخر مراجعة", dateLabel(project.last_verified_at)] : null
      ].filter(Boolean);
      const factHTML = facts.map(item =>
        '<div class="project-fact"><span>' + escapeHTML(item[0]) + '</span><strong>' + escapeHTML(item[1]) + '</strong></div>'
      ).join("");

      const relationsHTML = relationLinks.map(link => {
        const entity = publicEntities.find(row => String(row.id) === String(link.entity_id));
        return entity ? relationCard(entity, link.relation_type) : "";
      }).filter(Boolean).join("");
      const projectUnits = unitRows.filter(unit =>
        unit.public_visible === true && unit.verification_status === "published"
      );
      const projectUnitsHTML = projectUnits.length
        ? '<section class="project-section project-units-section"><div class="project-units-heading"><div><span class="project-source-kind">وحدات مسجلة ومعتمدة</span><h2>الوحدات العقارية بالمشروع</h2></div><span class="project-unit-count">' + projectUnits.length + ' وحدة</span></div>' +
          '<div class="project-units-grid">' + projectUnits.map(unit => unitCard(
            unit, linkedOffers.filter(offer => String(offer.project_unit_id) === String(unit.id) && offer.status === "available")
          )).join("") + '</div></section>'
        : '<section class="project-section project-units-section"><h2>الوحدات العقارية بالمشروع</h2><p>لا توجد وحدات مسجلة ومعتمدة للعامة بهذا المشروع حتى الآن.</p></section>';
      const sourcesHTML = publicSources.map(sourceCard).join("");
      const sourcesFallback = sourcesHTML
        ? '<div class="project-sources">' + sourcesHTML + '</div>'
        : '<p>لا توجد مراجع عامة مرتبطة بهذا الملف حاليًا. لا يعني ذلك أن المشروع حاصل على اعتماد قانوني أو أن وحداته متاحة.</p>';
      const relationFallback = relationsHTML
        ? '<div class="project-relations">' + relationsHTML + '</div>'
        : '<p>لا توجد جهة مرتبطة منشورة للعامة بهذا المشروع حتى الآن.</p>';
      const approvedDate = dateLabel(project.last_verified_at);
      const disclaimer = "هذا ملف معلوماتي مستقل مبني على السجلات والمراجع المنشورة. الإدراج لا يعني شراكة أو تزكية أو شهادة ترخيص من أسيوط عقار. حالة المشروع والمعلومات المنشورة تعكس ما ورد بالمصادر وقت مراجعتها وقد تتغير؛ يجب الرجوع إلى الجهة المختصة والمطور مباشرة قبل اتخاذ قرار أو دفع أي مبالغ. تظهر الوحدات والإعلانات هنا فقط بعد تسجيلها وربطها صراحة بسجل الوحدة واعتماد الإدارة؛ لا يتم الربط اعتمادًا على تشابه الأسماء.";

      root.innerHTML =
        '<section class="project-hero"><span class="project-eyebrow">ملف مشروع منشور في الدليل العقاري</span>' +
        '<h1>' + escapeHTML(name) + '</h1><p>' + escapeHTML(description) + '</p>' +
        '<div class="project-tags"><span class="project-tag">' + escapeHTML(projectTypes[project.project_type] || "مشروع عقاري") + '</span>' +
        '<span class="project-tag">' + escapeHTML(statuses[project.project_status] || statuses.unknown) + '</span>' +
        (areaName ? '<span class="project-tag">' + escapeHTML(areaName) + '</span>' : "") +
        '</div></section>' +
        (facts.length ? '<section class="project-facts" aria-label="بيانات المشروع">' + factHTML + '</section>' : "") +
        '<section class="project-section"><h2>نبذة عن المشروع</h2><p>' + escapeHTML(description) + '</p>' +
        (approvedDate ? '<p class="project-map-note">آخر مراجعة مسجلة: ' + escapeHTML(approvedDate) + '</p>' : "") +
        '</section>' +
        mapSection(project, area, trustedSource) +
        projectUnitsHTML +
        '<section class="project-section"><h2>الجهات المرتبطة بالمشروع</h2>' + relationFallback + '</section>' +
        '<section class="project-section"><h2>المصادر والمراجع</h2>' + sourcesFallback + '</section>' +
        '<section class="project-disclaimer">' + escapeHTML(disclaimer) + '</section>' +
        '<div class="project-actions"><a class="btn btn-gold" href="./directory.html?view=projects">العودة إلى المشروعات</a>' +
        '<a class="btn btn-outline" style="background:#2B211B" href="./offers.html">تصفح العقارات المنشورة</a></div>';
      if (window.AsyutDirectoryMedia) {
        window.AsyutDirectoryMedia.renderGallery({ projectId: project.id, root })
          .catch(error => console.warn("Project media gallery unavailable:", error));
      }
    } catch (error) {
      stateMessage("تعذر تحميل ملف المشروع", error && error.message ? error.message : "حدث خطأ أثناء تحميل بيانات المشروع.");
    }
  }

  loadProject();
});