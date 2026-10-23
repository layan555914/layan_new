
document.addEventListener("DOMContentLoaded", () => {
  const dialog = document.getElementById("offerDialog");
  const form = document.getElementById("offerForm");
  const closeBtn = document.getElementById("closeDialog");
  const status = document.getElementById("statusMessage");
  const grid = document.getElementById("offersGrid");
  const searchInput = document.getElementById("searchInput");
  const typeFilter = document.getElementById("typeFilter");
  const areaFilter = document.getElementById("areaFilter");

  const STORAGE_KEY = "layan_property_offers_v1";

  const demoOffers = [
    {
      id: "demo-1",
      title: "شقة سكنية في أسيوط الجديدة",
      property_type: "شقة",
      area: "أسيوط الجديدة",
      total_price: 850000,
      down_payment: 200000,
      paid_amount: 180000,
      remaining_installments: 500000,
      transfer_fee: 0,
      discount_percent: 0,
      description: "عرض تجريبي لاختبار الموقع والبحث."
    },
    {
      id: "demo-2",
      title: "شقة للبيع بالتنازل في حي غرب",
      property_type: "شقة",
      area: "حي غرب",
      total_price: 650000,
      down_payment: 150000,
      paid_amount: 120000,
      remaining_installments: 400000,
      transfer_fee: 5000,
      discount_percent: 5,
      description: "بيانات افتراضية وليست عرضًا حقيقيًا."
    },
    {
      id: "demo-3",
      title: "وحدة سكنية في مدينة ناصر",
      property_type: "وحدة سكنية",
      area: "مدينة ناصر",
      total_price: 950000,
      down_payment: 250000,
      paid_amount: 220000,
      remaining_installments: 600000,
      transfer_fee: 0,
      discount_percent: 0,
      description: "عرض افتراضي لتجربة تصفية العقارات."
    }
  ];

  let offers = loadOffers();
  let activeKind = "";

  function loadOffers() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (error) {
      console.warn("تعذر قراءة العروض المحفوظة:", error);
    }

    return demoOffers.map(offer => ({ ...offer }));
  }

  function saveOffers() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(offers));
      return true;
    } catch (error) {
      console.error("تعذر حفظ العروض:", error);
      return false;
    }
  }

  function money(value) {
    return Number(value || 0).toLocaleString("ar-EG") + " ج.م";
  }

  function addText(parent, tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    parent.appendChild(element);
    return element;
  }

  function renderOffers() {
    if (!grid) return;

    grid.replaceChildren();

    if (offers.length === 0) {
      addText(grid, "p", "لا توجد عروض محفوظة حتى الآن.");
      return;
    }

    offers.forEach(offer => {
      const card = document.createElement("article");
      card.className = "offer-card";
      card.dataset.offerId = offer.id;

      addText(card, "h3", offer.title || "عقار بدون عنوان");
      addText(
        card,
        "p",
        `${offer.property_type || "عقار"} — ${offer.area || "أسيوط"}`
      );
      addText(card, "p", `السعر الإجمالي: ${money(offer.total_price)}`);
      addText(card, "p", `المقدم: ${money(offer.down_payment)}`);
      addText(card, "p", `المدفوع: ${money(offer.paid_amount)}`);
      addText(
        card,
        "p",
        `الأقساط المتبقية: ${money(offer.remaining_installments)}`
      );

      if (Number(offer.transfer_fee) > 0) {
        addText(card, "p", `رسوم التنازل: ${money(offer.transfer_fee)}`);
      }

      if (Number(offer.discount_percent) > 0) {
        addText(
          card,
          "p",
          `الخصم: ${Number(offer.discount_percent)}٪`
        );
      }

      if (offer.description) {
        addText(card, "p", offer.description);
      }

      if (Array.isArray(offer.photos) && offer.photos.length) {
        offer.photos.forEach(photo => {
          if (!photo || typeof photo !== "string") return;
          const image = document.createElement("img");
          image.src = photo;
          image.alt = offer.title || "صورة العقار";
          image.loading = "lazy";
          image.className = "offer-photo";
          card.appendChild(image);
        });
      }

      grid.appendChild(card);
    });

    applyFilters();
  }

  function applyFilters() {
    if (!grid) return;

    const query = (searchInput?.value || "").trim().toLocaleLowerCase("ar");
    const type = typeFilter?.value || "";
    const area = areaFilter?.value || "";

    let visibleCount = 0;

    grid.querySelectorAll(".offer-card").forEach(card => {
      const offer = offers.find(item => item.id === card.dataset.offerId);
      if (!offer) {
        card.hidden = true;
        return;
      }

      const searchableText = [
        offer.title,
        offer.property_type,
        offer.area,
        offer.description
      ].join(" ").toLocaleLowerCase("ar");

      const matchesQuery = !query || searchableText.includes(query);
      const matchesType = !type || offer.property_type === type;
      const matchesArea = !area || offer.area === area;
      const matchesKind = !activeKind || offer.property_type === activeKind;

      card.hidden = !(
        matchesQuery && matchesType && matchesArea && matchesKind
      );

      if (!card.hidden) visibleCount++;
    });

    let emptyMessage = document.getElementById("layanNoResults");

    if (visibleCount === 0) {
      if (!emptyMessage && grid) {
        emptyMessage = document.createElement("p");
        emptyMessage.id = "layanNoResults";
        grid.appendChild(emptyMessage);
      }

      if (emptyMessage) {
        emptyMessage.textContent = offers.length
          ? "لا توجد عروض مطابقة للبحث. جرّب كلمات أو فلاتر أخرى."
          : "لا توجد عروض حاليًا.";
        emptyMessage.hidden = false;
      }
    } else if (emptyMessage) {
      emptyMessage.hidden = true;
    }
  }

  function openOfferForm() {
    if (dialog && !dialog.open) dialog.showModal();
  }

  document.getElementById("addOfferTop")
    ?.addEventListener("click", openOfferForm);

  document.getElementById("addOfferBtn")
    ?.addEventListener("click", openOfferForm);

  closeBtn?.addEventListener("click", () => dialog?.close());

  dialog?.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });

  form?.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);

    const offer = {
      id: "offer-" + Date.now(),
      title: String(data.get("title") || "").trim(),
      property_type: String(data.get("property_type") || ""),
      area: String(data.get("area") || "أسيوط"),
      total_price: Number(data.get("total_price") || 0),
      down_payment: Number(data.get("down_payment") || 0),
      paid_amount: Number(data.get("paid_amount") || 0),
      remaining_installments: Number(
        data.get("remaining_installments") || 0
      ),
      transfer_fee: Number(data.get("transfer_fee") || 0),
      discount_percent: Number(data.get("discount_percent") || 0),
      description: String(data.get("description") || "").trim(),
      photos: []
    };

    const photoInput = form.querySelector('[name="photos"]');
    if (photoInput?.files?.length) {
      offer.photos = Array.from(photoInput.files)
        .filter(file => file.type.startsWith("image/"))
        .map(file => URL.createObjectURL(file));
    }

    offers.unshift(offer);
    const saved = saveOffers();

    renderOffers();

    if (status) {
      status.textContent = saved
        ? "تمت إضافة العرض وحفظ بياناته في هذا المتصفح فقط."
        : "تمت إضافة العرض للمعاينة، لكن تعذر حفظه في المتصفح.";
    }

    form.reset();
    dialog?.close();

    document.getElementById("offers")?.scrollIntoView({
      behavior: "smooth"
    });
  });

  document.getElementById("searchBtn")
    ?.addEventListener("click", applyFilters);

  searchInput?.addEventListener("input", applyFilters);
  typeFilter?.addEventListener("change", applyFilters);
  areaFilter?.addEventListener("change", applyFilters);

  document.querySelectorAll("[data-kind]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-kind]").forEach(item => {
        item.classList.remove("active");
      });

      button.classList.add("active");
      activeKind = button.dataset.kind || "";
      applyFilters();
    });
  });

  document.getElementById("loginBtn")
    ?.addEventListener("click", () => {
      alert("تسجيل الدخول سيتم تفعيله في الخطوة التالية.");
    });

  renderOffers();
});
