(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const config = window.LAYAN_CONFIG || {};
  const base = String(config.SUPABASE_URL || "").replace(/\/$/, "");
  const key = config.SUPABASE_PUBLISHABLE_KEY || "";
  const MIN_SAMPLE = 5;
  const FIELDS = [
    "city", "area", "property_type", "listing_purpose", "area_m2",
    "total_price", "price_on_request", "created_at", "updated_at"
  ].join(",");
  const KNOWN_CITIES = [
    "مدينة أسيوط", "أسيوط الجديدة", "ديروط", "القوصية",
    "منفلوط", "أبنوب", "الفتح", "ساحل سليم", "البداري",
    "أبو تيج", "صدفا", "الغنايم"
  ];
  const KNOWN_TYPES = [
    "شقة", "فيلا", "بيت", "محل", "مكتب إداري", "عيادة طبية",
    "مخزن", "معرض", "مشروع عقاري", "أرض مطروحة للبناء", "أرض تنازل"
  ];
  let allRows = [];
  let loading = false;

  const text = value => String(value ?? "").trim();
  const escapeHTML = value => text(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
  const number = value => {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const formatNumber = value => new Intl.NumberFormat("ar-EG-u-nu-latn", {
    maximumFractionDigits: 0
  }).format(value);
  const normalize = value => text(value).toLocaleLowerCase("ar")
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/[\u064B-\u065F\u0670]/g, "").replace(/\s+/g, " ");
  function cityLabel(value) {
    const raw = text(value);
    const normalized = normalize(raw);
    if (!raw) return "المدينة غير محددة";
    if (["اسيوط", "مدينه اسيوط"].includes(normalized)) return "مدينة أسيوط";
    if (normalized === "اسيوط الجديده") return "أسيوط الجديدة";
    if (normalized === "مركز الفتح") return "الفتح";
    return raw;
  }
  const canonicalCity = value => cityLabel(value);
  const formatDate = value => {
    const date = new Date(value || "");
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ar-EG-u-nu-latn", {
      day: "numeric", month: "short", year: "numeric"
    });
  };
  const maxDate = rows => rows.reduce((latest, row) => {
    const time = new Date(row.updated_at || row.created_at || "").getTime();
    return Number.isFinite(time) && time > latest ? time : latest;
  }, 0);

  function median(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  function percentile(values, fraction) {
    const sorted = values.slice().sort((a, b) => a - b);
    if (!sorted.length) return null;
    const index = (sorted.length - 1) * fraction;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  }
  function hasPublicPrice(row) {
    return row.price_on_request !== true && number(row.total_price) !== null;
  }
  function hasPriceAndArea(row) {
    return hasPublicPrice(row) && number(row.area_m2) !== null;
  }
  function comparablePricePerMeter(row) {
    if (!hasPriceAndArea(row) || row.listing_purpose === "إيجار") return null;
    return Number(row.total_price) / Number(row.area_m2);
  }

  function setStatus(message, isError = false) {
    const status = $("mpStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function fillSelect(select, values, firstLabel) {
    const current = select.value;
    select.replaceChildren(new Option(firstLabel, ""));
    values.forEach(value => select.add(new Option(value, value)));
    if ([...select.options].some(option => option.value === current)) select.value = current;
  }

  function populateFilters() {
    const cities = new Set(KNOWN_CITIES);
    const types = new Set(KNOWN_TYPES);
    allRows.forEach(row => {
      if (text(row.city)) cities.add(canonicalCity(row.city));
      if (text(row.property_type)) types.add(text(row.property_type));
    });
    const preferred = KNOWN_CITIES.filter(city => cities.has(city));
    const additional = [...cities].filter(city => !preferred.includes(city) && city !== "المدينة غير محددة")
      .sort((a, b) => a.localeCompare(b, "ar"));
    fillSelect($("mpCity"), [...preferred, ...additional], "كل محافظة أسيوط");
    const preferredTypes = KNOWN_TYPES.filter(type => types.has(type));
    const additionalTypes = [...types].filter(type => !preferredTypes.includes(type))
      .sort((a, b) => a.localeCompare(b, "ar"));
    fillSelect($("mpType"), [...preferredTypes, ...additionalTypes], "كل أنواع العقارات");
  }

  function filteredRows() {
    const city = $("mpCity").value;
    const type = $("mpType").value;
    const purpose = $("mpPurpose").value;
    const areaQuery = normalize($("mpAreaSearch").value);
    return allRows.filter(row => {
      if (city && normalize(canonicalCity(row.city)) !== normalize(city)) return false;
      if (type && text(row.property_type) !== type) return false;
      if (purpose && text(row.listing_purpose) !== purpose) return false;
      if (areaQuery && !normalize(row.area).includes(areaQuery) && !normalize(row.city).includes(areaQuery)) return false;
      return true;
    });
  }

  function groupRows(rows) {
    const groups = new Map();
    rows.forEach(row => {
      const city = cityLabel(row.city);
      const area = text(row.area) || "الحي غير محدد";
      const type = text(row.property_type) || "نوع العقار غير محدد";
      const purpose = text(row.listing_purpose) || "المعاملة غير محددة";
      const key = [normalize(city), normalize(area), normalize(type), normalize(purpose)].join("|");
      if (!groups.has(key)) groups.set(key, { city, area, type, purpose, rows: [] });
      groups.get(key).rows.push(row);
    });
    return [...groups.values()].sort((a, b) =>
      a.city.localeCompare(b.city, "ar") ||
      a.area.localeCompare(b.area, "ar") ||
      a.type.localeCompare(b.type, "ar")
    );
  }

  function card(group) {
    const publicPriced = group.rows.filter(hasPublicPrice).length;
    const complete = group.rows.filter(hasPriceAndArea).length;
    const comparable = group.rows.map(comparablePricePerMeter).filter(value => value !== null && Number.isFinite(value));
    let indicator;
    if (group.purpose === "إيجار") {
      indicator = '<div class="mp-indicator"><span>مؤشر الإيجار</span><strong>لا نحسب متوسطًا حاليًا</strong><p>مدة الإيجار غير موحدة في بيانات الإعلانات (يومي أو شهري أو سنوي)، لذلك لا نجمع مبالغ غير متجانسة.</p></div>';
    } else if (comparable.length >= MIN_SAMPLE) {
      const middle = median(comparable);
      const lower = percentile(comparable, 0.25);
      const upper = percentile(comparable, 0.75);
      indicator = '<div class="mp-indicator is-ready"><span>وسيط السعر المطلوب للمتر المربع</span><strong>' +
        formatNumber(Math.round(middle)) + ' جنيه/م²</strong><p>النطاق الأوسط للعينة: ' +
        formatNumber(Math.round(lower)) + ' إلى ' + formatNumber(Math.round(upper)) +
        ' جنيه/م² · محسوب من ' + formatNumber(comparable.length) + ' إعلانات مكتملة.</p></div>';
    } else {
      indicator = '<div class="mp-indicator"><span>مؤشر سعر المتر</span><strong>العينة غير كافية حتى الآن</strong><p>المتاح للمقارنة: ' +
        formatNumber(comparable.length) + ' من ' + formatNumber(MIN_SAMPLE) +
        ' إعلانات مكتملة مطلوبة. لن نعرض متوسطًا قد يضللك.</p></div>';
    }
    return '<article class="mp-card">' +
      '<h3>' + escapeHTML(group.type) + ' · ' + escapeHTML(group.purpose) + '</h3>' +
      '<p class="mp-card-sub">' + escapeHTML(group.city) + ' · ' + escapeHTML(group.area) + '</p>' +
      '<div class="mp-card-counts">' +
        '<div><span>إعلانات متاحة</span><strong>' + formatNumber(group.rows.length) + '</strong></div>' +
        '<div><span>بسعر معلن</span><strong>' + formatNumber(publicPriced) + '</strong></div>' +
        '<div><span>سعر ومساحة</span><strong>' + formatNumber(complete) + '</strong></div>' +
      '</div>' + indicator + '</article>';
  }

  function render() {
    const rows = filteredRows();
    const priced = rows.filter(hasPublicPrice).length;
    const complete = rows.filter(hasPriceAndArea).length;
    const latest = maxDate(rows);
    $("mpTotal").textContent = formatNumber(rows.length);
    $("mpPriced").textContent = formatNumber(priced);
    $("mpComplete").textContent = formatNumber(complete);
    $("mpUpdated").textContent = latest ? formatDate(new Date(latest).toISOString()) : "لا يوجد";
    $("mpResultsSummary").textContent = "عدد الإعلانات المطابقة للفلاتر: " + formatNumber(rows.length);
    const groups = groupRows(rows);
    $("mpResults").innerHTML = groups.length
      ? groups.map(card).join("")
      : '<div class="mp-empty">لا توجد إعلانات متاحة تطابق الاختيارات الحالية. جرّب اختيار منطقة أخرى أو امسح الفلاتر.</div>';
    $("mpResults").setAttribute("aria-busy", "false");
  }

  async function load() {
    if (loading) return;
    loading = true;
    $("mpRefresh").disabled = true;
    $("mpResults").setAttribute("aria-busy", "true");
    setStatus("جارٍ جلب الإعلانات المتاحة والمعتمدة...");
    if (!base || !key) {
      setStatus("إعدادات الاتصال غير متاحة. حاول لاحقًا.", true);
      $("mpResults").innerHTML = '<div class="mp-empty">تعذر الاتصال ببيانات دليل الأسعار الآن.</div>';
      $("mpResults").setAttribute("aria-busy", "false");
      loading = false;
      $("mpRefresh").disabled = false;
      return;
    }
    try {
      const params = new URLSearchParams({
        select: FIELDS,
        status: "eq.available",
        verification_status: "eq.verified",
        order: "updated_at.desc",
        limit: "1000"
      });
      const response = await fetch(base + "/rest/v1/property_offers?" + params.toString(), {
        method: "GET",
        headers: { apikey: key, Authorization: "Bearer " + key, Accept: "application/json" },
        cache: "no-store"
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Invalid response");
      allRows = data.filter(row => row && row.status !== "pending");
      populateFilters();
      render();
      const latest = maxDate(allRows);
      setStatus("تم تحديث البيانات من الإعلانات العامة المعتمدة." +
        (latest ? " أحدث تعديل مسجل: " + formatDate(new Date(latest).toISOString()) + "." : "") +
        " لا يتم حفظ أي بيانات جديدة من هذه الصفحة.");
    } catch (error) {
      console.warn("ASYUT AQAR market prices:", error);
      setStatus("تعذر تحميل المؤشرات الآن. تحقق من اتصال الإنترنت ثم اضغط «تحديث البيانات».", true);
      $("mpResults").innerHTML = '<div class="mp-empty">لم نعرض أرقامًا مخمّنة. أعد المحاولة عند عودة الاتصال.</div>';
      $("mpResults").setAttribute("aria-busy", "false");
    } finally {
      loading = false;
      $("mpRefresh").disabled = false;
    }
  }

  ["mpCity", "mpType", "mpPurpose"].forEach(id => $(id).addEventListener("change", render));
  $("mpAreaSearch").addEventListener("input", render);
  $("mpRefresh").addEventListener("click", load);
  load();
})();
