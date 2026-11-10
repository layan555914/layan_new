document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  // Strip campaign tags from outbound share links only; keep inbound analytics intact.
  const cleanShareUrl = value => {
    const url = new URL(String(value), window.location.href);
    for (const key of Array.from(url.searchParams.keys())) {
      if (/^utm_/i.test(key)) url.searchParams.delete(key);
    }
    return url.href;
  };

  const root = document.getElementById("propertyDetailsRoot");
  const config = window.LAYAN_CONFIG || {};
  const base = String(config.SUPABASE_URL || "").replace(/\/$/, "");
  const key = config.SUPABASE_PUBLISHABLE_KEY || "";
  const params = new URLSearchParams(window.location.search);
  const id = String(params.get("id") || window.ASYUT_PROPERTY_ID || "").trim();
  const fields = [
    "id","title","governorate","listing_purpose","land_ownership_authority",
    "land_permit_details","land_utilities","land_zoning","city","area","area_m2",
    "bedrooms","bathrooms","monthly_installment","property_type","description",
    "total_price","down_payment","paid_amount","remaining_amount","assignment_fee",
    "assignment_fee_percentage","discount_amount","discount_percent","developer_name",
    "project_name","image_urls","is_featured","featured_until","contact_phone",
    "latitude","longitude","created_at","updated_at"
  ].join(",");

  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[char]));
  const safeURL = value => {
    try {
      const url = new URL(String(value || ""), window.location.href);
      if (!["https:","http:"].includes(url.protocol)) return "";
      if (url.origin === window.location.origin) return url.href;
      return url.href;
    } catch (_) { return ""; }
  };
  const money = value => {
    if (value === null || value === undefined || value === "") return "غير محدد";
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "غير محدد";
    return new Intl.NumberFormat("ar-EG-u-nu-latn", {maximumFractionDigits:0}).format(amount) + " جنيه";
  };
  const valueOrUnknown = value => value === null || value === undefined || value === "" ? "غير محدد" : String(value);
  const offerCode = offer => "ASY-" + String(offer.id || "").replace(/-/g,"").slice(0,8).toUpperCase();
  const digits = value => String(value || "").replace(/\D/g,"");
  const phoneForWhatsApp = value => {
    let number = digits(value);
    if (number.startsWith("00")) number = number.slice(2);
    if (number.startsWith("0")) number = "20" + number.slice(1);
    else if (number.length === 10 && number.startsWith("1")) number = "20" + number;
    return number;
  };
  const makeFact = (label, value) => value === null || value === undefined || value === ""
    ? "" : '<div class="property-fact"><span>' + escapeHTML(label) + '</span><strong>' + escapeHTML(value) + '</strong></div>';

  function showState(title, message, retry = false) {
    root.innerHTML = '<section class="property-state"><h1>' + escapeHTML(title) + '</h1><p>' + escapeHTML(message) + '</p>' +
      (retry ? '<button class="property-action property-action-gold" id="retryPropertyLoad" type="button">إعادة المحاولة</button>' : '') +
      '</section>';
    root.querySelector("#retryPropertyLoad")?.addEventListener("click", loadProperty);
  }

  const formatDate = value => {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric" });
  };
  const listingDates = row => {
    const posted = formatDate(row.created_at);
    const updated = formatDate(row.updated_at);
    if (!posted && !updated) return "";
    return '<p class="property-dates">' +
      (posted ? '<span>نُشر في <time datetime="' + escapeHTML(row.created_at) + '">' + escapeHTML(posted) + '</time></span>' : "") +
      (updated && updated !== posted ? '<span>آخر تحديث <time datetime="' + escapeHTML(row.updated_at) + '">' + escapeHTML(updated) + '</time></span>' : "") +
      '</p>';
  };

  function renderProperty(row) {
    const title = String(row.title || "إعلان عقاري على أسيوط عقار");
    const purpose = String(row.listing_purpose || "بيع");
    const imagesRaw = Array.isArray(row.image_urls) ? row.image_urls : [];
    const images = imagesRaw.map(safeURL).filter(Boolean).slice(0, 20);
    const phone = String(row.contact_phone || "");
    const tel = phone.replace(/[^0-9+]/g, "");
    const whatsapp = phoneForWhatsApp(phone);
    // Each listing has its own static page (ads/<id>.html) so shared links show the listing photo and price.
    const shareURL = new URL("./ads/" + encodeURIComponent(String(row.id)) + ".html", document.baseURI);
    const shareHref = cleanShareUrl(shareURL.href);
    const shareText = "إعلان على أسيوط عقار: " + title + " — كود " + offerCode(row);
    const isFeatured = row.is_featured === true && (!row.featured_until || new Date(row.featured_until) > new Date());
    const locationText = [row.city, row.area].filter(Boolean).join(" · ") || "أسيوط";
    const mapURL = row.latitude !== null && row.latitude !== undefined && row.longitude !== null && row.longitude !== undefined
      ? "https://www.google.com/maps?q=" + encodeURIComponent(Number(row.latitude) + "," + Number(row.longitude)) : "";

    document.title = title + " | أسيوط عقار";
    const description = String(row.description || ("تفاصيل " + (row.property_type || "العقار") + " في " + locationText + " على منصة أسيوط عقار.")).slice(0, 155);
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", title + " | أسيوط عقار");
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
    document.querySelector('meta[property="og:url"]')?.setAttribute("content", shareHref);
    if (images[0]) document.querySelector('meta[property="og:image"]')?.setAttribute("content", images[0]);
    let schema = document.getElementById("propertyStructuredData");
    if (!schema) {
      schema = document.createElement("script");
      schema.id = "propertyStructuredData";
      schema.type = "application/ld+json";
      document.head.appendChild(schema);
    }
    schema.textContent = JSON.stringify({
      "@context":"https://schema.org",
      "@type":"RealEstateListing",
      "name":title,
      "description":description,
      "url":shareHref,
      "datePosted":row.created_at || undefined,
      "dateModified":row.updated_at || undefined,
      "image":images.length ? images : undefined,
      "address":{"@type":"PostalAddress","addressLocality":row.city || "أسيوط","addressRegion":row.governorate || "أسيوط","addressCountry":"EG"},
      "offers":Number.isFinite(Number(row.total_price)) ? {"@type":"Offer","price":Number(row.total_price),"priceCurrency":"EGP","availability":"https://schema.org/InStock"} : undefined
    });
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = shareHref;

    const mainImage = images.length
      ? '<img id="propertyMainImage" src="' + escapeHTML(images[0]) + '" alt="' + escapeHTML(title) + ' — الصورة الرئيسية" fetchpriority="high">'
      : '<span class="property-gallery-empty">ASYUT AQAR</span>';
    const thumbs = images.length > 1
      ? '<div class="property-gallery-thumbs" aria-label="صور الإعلان">' + images.map((url,index) =>
          '<button type="button" data-property-image="' + index + '" aria-label="عرض الصورة ' + (index + 1) + '" aria-pressed="' + (index === 0 ? "true" : "false") + '">' +
          '<img src="' + escapeHTML(url) + '" alt="" loading="lazy"></button>'
        ).join("") + '</div>' : "";
    const contactActions = phone
      ? '<div class="property-contact-actions"><a class="property-action property-action-gold" href="tel:' + escapeHTML(tel) + '">اتصال بصاحب الإعلان</a>' +
        (whatsapp ? '<a class="property-action" href="https://wa.me/' + escapeHTML(whatsapp) + '?text=' + encodeURIComponent("مرحبًا، أنا مهتم بإعلانك: " + title + " — كود " + offerCode(row) + " من منصة أسيوط عقار. " + shareHref) + '" target="_blank" rel="noopener noreferrer">واتساب صاحب الإعلان</a>' : '') +
        '</div>' : '<p class="property-contact-note">لم يضف صاحب الإعلان رقم تواصل متاحًا حتى الآن.</p>';
    const facts = [
      makeFact("نوع العقار", row.property_type),
      makeFact("نوع الإعلان", purpose),
      makeFact("المدينة / المركز", row.city || "أسيوط"),
      makeFact("المنطقة", row.area),
      makeFact("المشروع / الكمبوند", row.project_name),
      makeFact("المطور العقاري", row.developer_name),
      makeFact("المساحة", row.area_m2 ? row.area_m2 + " م²" : ""),
      makeFact("غرف النوم", /شقة|فيلا|دوبلكس|دوبليكس|روف|استوديو|ستوديو|منزل|بيت|شاليه|سكني/.test(String(row.property_type || "")) ? row.bedrooms : ""),
      makeFact("الحمامات", /أرض|ارض|مشروع/.test(String(row.property_type || "")) ? "" : row.bathrooms),
      makeFact("إجمالي المدفوع", Number(row.paid_amount) > 0 ? money(row.paid_amount) : ""),
      makeFact("القسط الشهري", row.monthly_installment ? money(row.monthly_installment) : ""),
      makeFact("رسوم التنازل", purpose.includes("تنازل") ? (Number(row.assignment_fee) > 0 ? money(row.assignment_fee) : "تحدد من الجهة المختصة") : ""),
      makeFact("قيمة الخصم", Number(row.discount_amount) > 0 ? money(row.discount_amount) : ""),
      makeFact("نسبة الخصم", Number(row.discount_percent) > 0 ? Number(row.discount_percent) + "٪" : ""),
      makeFact("جهة الولاية / التخصيص", row.land_ownership_authority),
      makeFact("اشتراطات البناء", row.land_permit_details),
      makeFact("المرافق", row.land_utilities),
      makeFact("استخدام الأرض", row.land_zoning)
    ].filter(Boolean).join("");

    root.innerHTML = `
      <div class="property-layout">
        <div class="property-visual-column">
          <section class="property-gallery-card" aria-label="صور العقار">
            <div class="property-gallery-main">${mainImage}</div>
            ${thumbs}
          </section>
          <section class="property-section-card">
            <h2>تفاصيل ومواصفات العقار</h2>
            <div class="property-facts-grid">${facts || '<p>لم يضف المعلن تفاصيل إضافية.</p>'}</div>
          </section>
          <section class="property-section-card">
            <h2>وصف الإعلان</h2>
            <p class="property-description">${escapeHTML(row.description || "لا يوجد وصف إضافي من صاحب الإعلان.")}</p>
          </section>
          <section class="property-section-card property-services" aria-labelledby="propertyServicesTitle">
            <div class="property-services-head"><h2 id="propertyServicesTitle">خدمات تحتاجها لهذا العقار</h2><a href="./advertise.html">أعلن هنا</a></div>
            <div class="property-services-grid">
              <a href="./marketplace.html?category=${encodeURIComponent("مواد البناء والتشطيب")}"><b>تشطيب ومواد بناء</b><small>سيراميك، دهانات، مقاولون</small></a>
              <a href="./marketplace.html?category=${encodeURIComponent("الأثاث والفرش وتجهيز الوحدات")}"><b>أثاث وتجهيز</b><small>غرف، مطابخ، أجهزة</small></a>
              <a href="./marketplace.html?category=${encodeURIComponent("الصيانة وإدارة العقارات")}"><b>صيانة وإدارة</b><small>كهرباء، سباكة، نقل</small></a>
              <a href="./marketplace.html?category=${encodeURIComponent("الاستشارات والخدمات العقارية")}"><b>استشارات وعقود</b><small>قانونية وهندسية</small></a>
            </div>
          </section>
          <p class="property-disclaimer">تنبيه مهم: أسيوط عقار منصة إعلانات وربط بين المهتم وصاحب الإعلان، ولا تتدخل في التعاقد أو تحصيل ثمن العقار. راجع الملكية والعقد وجدول الأقساط ورسوم التنازل، وتحقق من موافقة الجهة أو المطوّر المختص قبل دفع أي مبالغ.</p>
        </div>
        <aside class="property-summary-card">
          <div class="property-summary-top">
            <span class="property-purpose-badge">${escapeHTML(row.property_type || "عقار")} · ${escapeHTML(purpose)}</span>
            ${isFeatured ? '<span class="property-featured-badge">★ إعلان مميز</span>' : ""}
            ${row.trust_badge === "owner" ? '<span class="trust-badge" title="تحققت الإدارة من ملكية المعلن">مالك موثّق</span>' : row.trust_badge === "company" ? '<span class="trust-badge trust-badge-company" title="شركة تحققت منها الإدارة">شركة موثّقة</span>' : ""}
          </div>
          <p class="property-listing-code">كود الإعلان: <strong>${escapeHTML(offerCode(row))}</strong></p>
          ${listingDates(row)}
          <h1>${escapeHTML(title)}</h1>
          <p class="property-location">⌖ ${escapeHTML(locationText)} ${mapURL ? ' · <a href="' + escapeHTML(mapURL) + '" target="_blank" rel="noopener noreferrer">عرض الموقع</a>' : ""}</p>
          <div class="property-price-highlight"><span>${purpose.includes("إيجار") ? "قيمة الإيجار المعلنة" : "السعر المعلن"}</span><strong>${money(row.total_price)}</strong></div>
          ${(Number(row.down_payment) > 0 || Number(row.remaining_amount) > 0) ? `<div class="property-key-figures">
            ${Number(row.down_payment) > 0 ? `<div class="property-key-figure"><span>المقدم عند التعاقد</span><strong>${money(row.down_payment)}</strong></div>` : ""}
            ${Number(row.remaining_amount) > 0 ? `<div class="property-key-figure"><span>المبلغ المتبقي</span><strong>${money(row.remaining_amount)}</strong></div>` : ""}
          </div>` : ""}
          ${contactActions}
          <p class="property-contact-note">التواصل والاتفاق يتمان مباشرة بين صاحب الإعلان والمهتم بالعقار. لا تفرض المنصة عمولة على إتمام الصفقة.</p>
          <div class="property-footer-actions">
            <button class="property-action property-action-outline" type="button" id="sharePropertyBtn">مشاركة الإعلان</button>
            <a class="property-action property-action-outline" href="https://wa.me/201007044265?text=${encodeURIComponent("أرغب في الإبلاغ عن إعلان على أسيوط عقار: " + title + " — كود " + offerCode(row))}" target="_blank" rel="noopener noreferrer">الإبلاغ عن الإعلان</a>
            <a class="property-action property-action-outline" href="./offers.html">العودة إلى العقارات</a>
          </div>
        </aside>
      </div>
      <div class="property-mobile-contact">
        ${phone ? '<a class="property-action property-action-gold" href="tel:' + escapeHTML(tel) + '">اتصال</a>' : '<a class="property-action property-action-gold" href="./offers.html">عقارات أخرى</a>'}
        ${whatsapp ? '<a class="property-action" href="https://wa.me/' + escapeHTML(whatsapp) + '?text=' + encodeURIComponent("مرحبًا، أنا مهتم بإعلانك: " + title + " — كود " + offerCode(row)) + '" target="_blank" rel="noopener noreferrer">واتساب</a>' : '<button class="property-action" id="mobileShareFallback" type="button">مشاركة الإعلان</button>'}
      </div>
    `;

    root.querySelector("#propertyMainImage")?.addEventListener("error", event => {
      const placeholder = document.createElement("span");
      placeholder.className = "property-gallery-empty";
      placeholder.textContent = "ASYUT AQAR";
      event.currentTarget.replaceWith(placeholder);
    });
    root.querySelectorAll(".property-gallery-thumbs img").forEach(image => {
      image.addEventListener("error", () => image.closest("button")?.remove());
    });
    root.querySelectorAll("[data-property-image]").forEach(button => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.propertyImage);
        if (!Number.isInteger(index) || !images[index]) return;
        const image = root.querySelector("#propertyMainImage");
        if (image) { image.src = images[index]; image.alt = title + " — الصورة " + (index + 1); }
        root.querySelectorAll("[data-property-image]").forEach(item => item.setAttribute("aria-pressed", item === button ? "true" : "false"));
      });
    });
    root.querySelector("#sharePropertyBtn")?.addEventListener("click", share);
    root.querySelector("#mobileShareFallback")?.addEventListener("click", share);

    function share() {
      const data = {title: title + " | أسيوط عقار", text: shareText, url: shareHref};
      if (navigator.share) {
        navigator.share(data).catch(error => { if (error?.name !== "AbortError") copyShare(); });
      } else copyShare();
    }
    async function copyShare() {
      try {
        await navigator.clipboard.writeText(shareText + "\n" + shareHref);
        showToast("تم نسخ رابط الإعلان للمشاركة.");
      } catch (_) {
        window.prompt("انسخ رابط الإعلان:", shareHref);
      }
    }
    function showToast(message) {
      const toast = document.getElementById("propertyToast");
      if (!toast) return;
      toast.textContent = message;
      toast.hidden = false;
      window.setTimeout(() => { toast.hidden = true; }, 2800);
    }
  }

  async function loadProperty() {
    if (!root) return;
    if (!/^[1-9][0-9]{0,18}$/.test(id) || (id.length === 19 && id > "9223372036854775807")) {
      showState("رابط الإعلان غير مكتمل", "ارجع إلى قائمة العقارات واختر إعلانًا لعرض تفاصيله.");
      return;
    }
    if (!base || !key) {
      showState("الاتصال غير جاهز", "تعذر الاتصال بخدمة العقارات. حاول مرة أخرى لاحقًا.");
      return;
    }
    showState("جارٍ تحميل الإعلان", "نحمّل بيانات العقار وصوره من قاعدة البيانات...");
    try {
      const endpointFor = list => base + "/rest/v1/property_offers?select=" + list + "&id=eq." + encodeURIComponent(id) + "&status=eq.available&limit=1";
      const headers = {headers:{apikey:key,Authorization:"Bearer " + key},cache:"no-store"};
      let response = await fetch(endpointFor(fields + ",trust_badge"), headers);
      // Databases without the admin trust badge column still load the listing.
      if (response.status === 400) response = await fetch(endpointFor(fields), headers);
      if (!response.ok) throw new Error("تعذر تحميل الإعلان.");
      const rows = await response.json();
      if (!Array.isArray(rows) || !rows.length) {
        showState("الإعلان غير متاح", "قد يكون صاحب الإعلان أوقفه أو لم يعد منشورًا. تصفح بقية عقارات أسيوط.");
        return;
      }
      renderProperty(rows[0]);
    } catch (error) {
      console.warn("ASYUT AQAR property page:", error);
      showState("تعذر تحميل الإعلان", "تحقق من اتصال الإنترنت ثم أعد المحاولة.", true);
    }
  }

  loadProperty();
});
