document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  const $ = id => document.getElementById(id);
  const status = $("priceGuideStatus");
  const summary = $("priceGuideSummary");
  const results = $("priceGuideResults");
  const cityFilter = $("priceGuideCity");
  const areaFilter = $("priceGuideArea");
  const typeFilter = $("priceGuideType");
  const rentalPeriodFilter = $("priceGuideRentalPeriod");
  const rentalPeriodField = $("priceGuideRentalPeriodField");
  const updatedAt = $("priceGuideUpdatedAt");
  const MIN_SAMPLE_SIZE = 3;
  const purposes = ["بيع", "إيجار", "تنازل"];
  const rentalPeriods = ["يومي", "شهري", "سنوي"];
  const rentalPeriodLabels = {
    "يومي": "يوميًا",
    "شهري": "شهريًا",
    "سنوي": "سنويًا"
  };
  let selectedPurpose = "بيع";
  let sourceRows = [];

  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));
  const money = value => new Intl.NumberFormat("ar-EG-u-nu-latn", {
    maximumFractionDigits: 0
  }).format(Math.round(value));
  const median = values => {
    const sorted = values.slice().sort((a,b) => a-b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle-1] + sorted[middle]) / 2;
  };
  const isTestOrSample = row => /اختبار|وهمي|تجريبي|\b(?:test|demo|dummy)\b/i.test(
    [row.title, row.description].filter(Boolean).join(" ")
  );

  function usableRows() {
    return sourceRows.filter(row => {
      const purpose = String(row.listing_purpose || "").trim();
      const rentalPeriod = String(row.rental_period || "").trim();
      const price = Number(row.total_price);
      const area = Number(row.area_m2);
      return row.status === "available" &&
        purposes.includes(purpose) &&
        purpose === selectedPurpose &&
        (purpose !== "إيجار" || rentalPeriods.includes(rentalPeriod)) &&
        row.price_on_request !== true &&
        Number.isFinite(price) && price > 0 &&
        Number.isFinite(area) && area > 0 &&
        String(row.city || "").trim() &&
        String(row.area || "").trim() &&
        String(row.property_type || "").trim() &&
        !isTestOrSample(row);
    }).map(row => ({
      city: String(row.city).trim(),
      area: String(row.area).trim(),
      propertyType: String(row.property_type).trim(),
      rentalPeriod: selectedPurpose === "إيجار" ? String(row.rental_period).trim() : "",
      pricePerMeter: Number(row.total_price) / Number(row.area_m2)
    })).filter(row => Number.isFinite(row.pricePerMeter) && row.pricePerMeter > 0);
  }

  function populateSelect(select, values, placeholder, keepValue = true) {
    if (!select) return;
    const previous = keepValue ? select.value : "";
    select.replaceChildren(new Option(placeholder, ""));
    [...new Set(values)].sort((a,b) => a.localeCompare(b,"ar")).forEach(value => {
      select.add(new Option(value, value));
    });
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }

  function populateFilters() {
    const allRows = usableRows();
    if (rentalPeriodField) rentalPeriodField.hidden = selectedPurpose !== "إيجار";
    if (selectedPurpose === "إيجار") {
      populateSelect(rentalPeriodFilter, allRows.map(row => row.rentalPeriod), "كل دوريات الإيجار");
    } else if (rentalPeriodFilter) {
      rentalPeriodFilter.value = "";
    }
    const selectedPeriod = selectedPurpose === "إيجار" ? (rentalPeriodFilter?.value || "") : "";
    const rows = selectedPeriod ? allRows.filter(row => row.rentalPeriod === selectedPeriod) : allRows;
    populateSelect(cityFilter, rows.map(row => row.city), "كل مدن ومراكز أسيوط");
    const selectedCity = cityFilter?.value || "";
    const cityRows = selectedCity ? rows.filter(row => row.city === selectedCity) : rows;
    populateSelect(areaFilter, cityRows.map(row => row.area), "كل المناطق");
    const selectedArea = areaFilter?.value || "";
    const areaRows = selectedArea ? cityRows.filter(row => row.area === selectedArea) : cityRows;
    populateSelect(typeFilter, areaRows.map(row => row.propertyType), "كل أنواع العقارات");
  }

  function render() {
    const rows = usableRows().filter(row =>
      (!cityFilter?.value || row.city === cityFilter.value) &&
      (!areaFilter?.value || row.area === areaFilter.value) &&
      (!typeFilter?.value || row.propertyType === typeFilter.value) &&
      (selectedPurpose !== "إيجار" || !rentalPeriodFilter?.value || row.rentalPeriod === rentalPeriodFilter.value)
    );

    const groups = new Map();
    rows.forEach(row => {
      const key = [row.city, row.area, row.propertyType, row.rentalPeriod].join("\u001f");
      if (!groups.has(key)) groups.set(key, {
        city:row.city, area:row.area, propertyType:row.propertyType,
        rentalPeriod:row.rentalPeriod, values:[]
      });
      groups.get(key).values.push(row.pricePerMeter);
    });

    const sufficientGroups = [...groups.values()]
      .filter(group => group.values.length >= MIN_SAMPLE_SIZE)
      .map(group => ({
        ...group,
        sampleSize: group.values.length,
        median: median(group.values),
        minimum: Math.min(...group.values),
        maximum: Math.max(...group.values)
      }))
      .sort((a,b) => b.sampleSize - a.sampleSize || a.city.localeCompare(b.city,"ar") || a.area.localeCompare(b.area,"ar"));

    const summaryItems = [
      ["إعلانات مكتملة داخلة في الحساب", rows.length],
      ["مناطق ونوع عقار لديها عينة كافية", sufficientGroups.length],
      ["الحد الأدنى للعينة", MIN_SAMPLE_SIZE + " إعلانات"]
    ];
    summary.replaceChildren(...summaryItems.map(([label,value]) => {
      const span = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = String(value);
      const text = document.createTextNode(" " + label);
      span.append(strong,text);
      return span;
    }));
    summary.hidden = false;

    if (!rows.length) {
      results.innerHTML = '<div class="price-guide-empty">لا توجد حاليًا بيانات مكتملة كافية لهذا الاختيار. اختر معاملة أو منطقة أخرى، وسيظل الدليل بلا أرقام حتى تتوفر بيانات صالحة.</div>';
      return;
    }
    if (!sufficientGroups.length) {
      results.innerHTML = '<div class="price-guide-empty">البيانات الحالية لا تكفي لإظهار مؤشر موثوق. نحتاج إلى 3 إعلانات مكتملة على الأقل لنفس نوع العقار والمنطقة والمعاملة' +
        (selectedPurpose === "إيجار" ? " ودورية الإيجار" : "") +
        '. لن نعرض متوسطًا أو سعرًا تقديريًا بعينة أقل من ذلك.</div>';
      return;
    }

    results.innerHTML = sufficientGroups.map(group => {
      const params = new URLSearchParams({
        purpose: selectedPurpose,
        city: group.city,
        area: group.area,
        type: group.propertyType
      });
      const queryLink = "./offers.html?" + params.toString();
      const unit = selectedPurpose === "إيجار"
        ? "جنيه / م² " + rentalPeriodLabels[group.rentalPeriod]
        : "جنيه / م²";
      const basis = selectedPurpose === "تنازل"
        ? "من القيمة الإجمالية المعلنة للتنازل"
        : selectedPurpose === "بيع"
          ? "من سعر البيع الإجمالي"
          : "";
      return `
        <article class="price-guide-card">
          <h3>${escapeHTML(group.propertyType)}</h3>
          ${selectedPurpose === "إيجار" ? `<p class="price-guide-card-period">دورية الإيجار: ${escapeHTML(group.rentalPeriod)}</p>` : ""}
          <p class="price-guide-card-location">${escapeHTML(group.city)} · ${escapeHTML(group.area)}</p>
          <div class="price-guide-median">
            <strong>${money(group.median)}</strong>
            <span>${unit} · الوسيط${basis ? " · " + basis : ""}</span>
          </div>
          <div class="price-guide-range">
            <div><span>أقل قيمة معلنة للمتر</span><strong>${money(group.minimum)} ج.م</strong></div>
            <div><span>أعلى قيمة معلنة للمتر</span><strong>${money(group.maximum)} ج.م</strong></div>
          </div>
          <div class="price-guide-card-foot">
            <span>العينة: ${group.sampleSize} إعلانات مكتملة</span>
            <a href="${queryLink}">عرض إعلانات المنطقة</a>
          </div>
        </article>`;
    }).join("");
  }

  function updatePurposeTabs() {
    document.querySelectorAll("[data-guide-purpose]").forEach(button => {
      const active = button.dataset.guidePurpose === selectedPurpose;
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function refresh() {
    populateFilters();
    updatePurposeTabs();
    render();
  }

  document.querySelectorAll("[data-guide-purpose]").forEach(button => {
    button.addEventListener("click", () => {
      const purpose = button.dataset.guidePurpose;
      if (!purposes.includes(purpose)) return;
      selectedPurpose = purpose;
      if (cityFilter) cityFilter.value = "";
      if (areaFilter) areaFilter.value = "";
      if (typeFilter) typeFilter.value = "";
      if (rentalPeriodFilter) rentalPeriodFilter.value = "";
      refresh();
    });
  });
  [rentalPeriodFilter, cityFilter, areaFilter, typeFilter].forEach(select => select?.addEventListener("change", () => {
    if (select === cityFilter) {
      if (areaFilter) areaFilter.value = "";
      if (typeFilter) typeFilter.value = "";
    } else if (select === areaFilter && typeFilter) {
      typeFilter.value = "";
    }
    populateFilters();
    render();
  }));
  $("priceGuideReset")?.addEventListener("click", () => {
    if (cityFilter) cityFilter.value = "";
    if (areaFilter) areaFilter.value = "";
    if (typeFilter) typeFilter.value = "";
    if (rentalPeriodFilter) rentalPeriodFilter.value = "";
    refresh();
  });

  try {
    const api = window.LAYAN_SUPABASE;
    if (!api?.getPriceGuideOffers) throw new Error("خدمة قراءة بيانات دليل الأسعار غير متاحة حاليًا.");
    const rows = await api.getPriceGuideOffers();
    if (!Array.isArray(rows)) throw new Error("تعذر قراءة بيانات الإعلانات.");
    sourceRows = rows;
    if (updatedAt) updatedAt.textContent = new Intl.DateTimeFormat("ar-EG", {
      dateStyle:"medium", timeStyle:"short"
    }).format(new Date());
    status.textContent = "تم تحميل بيانات الإعلانات المتاحة. الأسعار المعروضة مؤشرات لأسعار الطلب المعلنة، وليست أسعار صفقات منفذة.";
    refresh();
  } catch (error) {
    console.error("ASYUT AQAR price guide:", error);
    status.textContent = "تعذر تحميل بيانات دليل الأسعار الآن. حاول تحديث الصفحة لاحقًا.";
    results.innerHTML = '<div class="price-guide-empty">لم نتمكن من الوصول إلى بيانات الأسعار. لا توجد أرقام تقديرية بديلة أو بيانات تجريبية معروضة.</div>';
  }
});
