(() => {
  "use strict";

  const section = document.getElementById("marketplaceFeaturedAds");
  const grid = document.getElementById("marketplaceSponsoredAds");
  const heading = document.getElementById("marketplaceSponsoredTitle");
  const count = document.getElementById("marketplaceSponsoredCount");
  const categoryFilter = document.getElementById("marketplaceCategoryFilter");
  const searchInput = document.getElementById("marketplaceSearch");
  const config = window.LAYAN_CONFIG || {};
  const base = String(config.SUPABASE_URL || "").replace(/\/$/, "");
  const key = config.SUPABASE_PUBLISHABLE_KEY || "";
  if (!section || !grid || !categoryFilter || !base || !key) return;

  const limit = 3;
  const normalize = value => String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");

  // Existing advertiser labels remain supported; newer exact marketplace labels
  // are also available from the administration form.
  const CATEGORY_ALIASES = {
    "مواد البناء والتشطيب": [
      "مواد البناء والتشطيب", "مواد بناء", "تشطيبات", "دهانات",
      "ابواب وشبابيك", "ادوات صحيه", "كهرباء وسباكه", "مقاولات",
      "سيراميك وبورسلين"
    ],
    "الأثاث والفرش وتجهيز الوحدات": [
      "الاثاث والفرش وتجهيز الوحدات", "مطابخ واثاث"
    ],
    "الصيانة وإدارة العقارات": [
      "الصيانه واداره العقارات", "كهرباء وسباكه", "صيانة"
    ],
    "الاستشارات والخدمات العقارية": [
      "الاستشارات والخدمات العقاريه", "استشارات عقارية"
    ],
    "مكاتب التصميم الهندسي": [
      "مكاتب التصميم الهندسي", "تصميم هندسي"
    ],
    "مهندسو الديكور والتصميم الداخلي": [
      "مهندسو الديكور والتصميم الداخلي", "ديكور", "تشطيبات"
    ],
    "السيراميك والبورسلين والأدوات الصحية": [
      "السيراميك والبورسلين والادوات الصحيه", "سيراميك وبورسلين", "ادوات صحيه"
    ],
    "الإضاءة ووحدات الإنارة": [
      "الاضاءه ووحدات الاناره", "اضاءة", "وحدات انارة"
    ],
    "الستائر والمفروشات": [
      "الستائر والمفروشات", "ستائر ومفروشات"
    ]
  };
  const normalizedAliases = Object.fromEntries(
    Object.entries(CATEGORY_ALIASES).map(([category, aliases]) => [
      category, new Set(aliases.map(normalize))
    ])
  );

  let ads = [];
  let loadFailed = false;

  function matchesCategory(ad, selected) {
    const category = normalize(ad.category);
    if (selected) {
      const aliases = normalizedAliases[selected];
      return !!aliases && aliases.has(category);
    }
    // Do not mix property-development or unrelated commercial ads into the
    // services marketplace when the visitor has not selected a category.
    return Object.values(normalizedAliases).some(aliases => aliases.has(category));
  }

  function matchesSearch(ad, query) {
    if (!query) return true;
    const haystack = normalize([
      ad.business_name, ad.category, ad.title, ad.description
    ].join(" "));
    return haystack.includes(query);
  }

  function renderFallbackCard(ad) {
    const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    })[char]);
    const image = /^https:\/\//i.test(String(ad.image_url || "")) ? ad.image_url : "";
    const phone = String(ad.contact_phone || "").replace(/[^+0-9]/g, "");
    return '<article class="offer-card sponsor-card sp-ad mk-sponsored-card">' +
      '<div class="sp-ad-media">' +
      (image ? '<img src="' + esc(image) + '" alt="' + esc(ad.business_name) + '" loading="lazy">' : '<div class="sp-ad-monogram"><span>★</span><small>' + esc(ad.business_name) + '</small></div>') +
      '<span class="sp-ad-badge">إعلان مميز</span></div>' +
      '<div class="sp-ad-body"><div class="sp-ad-brand"><strong>' + esc(ad.business_name) + '</strong></div>' +
      '<h3>' + esc(ad.title) + '</h3><p class="sp-ad-desc">' + esc(ad.description) + '</p>' +
      '<div class="sp-ad-actions">' +
      (phone ? '<a class="sp-ad-btn" href="tel:' + esc(phone) + '">اتصال</a>' : "") +
      '<a class="sp-ad-btn sp-ad-btn-primary" href="./advertise.html">تفاصيل الإعلان</a>' +
      '</div></div></article>';
  }

  function render() {
    if (!section) return;
    const selected = categoryFilter.value;
    const query = normalize(searchInput?.value || "");
    const filtered = ads
      .filter(ad => matchesCategory(ad, selected) && matchesSearch(ad, query))
      .slice(0, limit);

    if (heading) {
      heading.textContent = selected
        ? "إعلانات مميزة في " + selected
        : "إعلانات مميزة في سوق الخدمات";
    }

    if (filtered.length) {
      section.hidden = false;
      if (count) count.textContent = filtered.length + " إعلان";
      grid.innerHTML = filtered.map(ad =>
        window.AsyutSponsoredAd?.render
          ? window.AsyutSponsoredAd.render(ad, { className: "mk-sponsored-card" })
          : renderFallbackCard(ad)
      ).join("");
      return;
    }

    if (loadFailed) {
      section.hidden = true;
      grid.replaceChildren();
      return;
    }

    if (!selected) {
      section.hidden = true;
      grid.replaceChildren();
      return;
    }

    section.hidden = false;
    if (count) count.textContent = "المساحة متاحة";
    grid.innerHTML =
      '<div class="mk-sponsored-empty">' +
      '<strong>لا توجد إعلانات مميزة في هذا القسم حاليًا</strong>' +
      '<p>يمكنك عرض نشاطك أمام العملاء الذين يبحثون عن هذه الخدمة.</p>' +
      '<a class="btn btn-gold" href="./advertise.html">اطلب إعلانًا في هذا القسم</a>' +
      '</div>';
  }

  async function load() {
    try {
      const response = await fetch(
        base + "/rest/v1/public_active_supplier_ads?select=id,business_name,category,title,description,image_url,target_url,contact_phone,created_at&order=created_at.desc&limit=50",
        { headers: { apikey: key, Authorization: "Bearer " + key } }
      );
      const raw = await response.text();
      let data = [];
      try { data = raw ? JSON.parse(raw) : []; } catch (_) {}
      if (!response.ok || !Array.isArray(data)) {
        throw new Error("تعذر تحميل الإعلانات المميزة.");
      }
      ads = data;
      render();
    } catch (error) {
      loadFailed = true;
      section.hidden = true;
      grid.replaceChildren();
      console.warn("Marketplace sponsored ads unavailable:", error.message);
    }
  }

  categoryFilter.addEventListener("change", render);
  searchInput?.addEventListener("input", render);
  load();
})();