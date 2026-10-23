
document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  const STORAGE_KEY = "layan_property_offers_v1";
  const $ = (id) => document.getElementById(id);

  const grid = $("offersGrid");
  const form = $("offerForm");
  const dialog = $("offerDialog");
  const status = $("statusMessage");

  let offers = [];
  let activeKind = "";

  const demoOffers = [
    {
      id: "demo-1",
      title: "شقة سكنية في أسيوط الجديدة",
      area: "أسيوط الجديدة",
      property_type: "شقة",
      total_price: 850000,
      down_payment: 200000,
      paid_amount: 180000,
      remaining_installments: 500000,
      transfer_fee: 0,
      discount_percent: 0,
      description: "عرض تجريبي للتوضيح فقط.",
      photos: []
    },
    {
      id: "demo-2",
      title: "شقة للتنازل في حي غرب",
      area: "حي غرب",
      property_type: "شقة",
      total_price: 650000,
      down_payment: 150000,
      paid_amount: 120000,
      remaining_installments: 400000,
      transfer_fee: 5000,
      discount_percent: 5,
      description: "عرض تجريبي للتوضيح فقط.",
      photos: []
    },
    {
      id: "demo-3",
      title: "وحدة سكنية في مدينة ناصر",
      area: "مدينة ناصر",
      property_type: "وحدة سكنية",
      total_price: 950000,
      down_payment: 250000,
      paid_amount: 220000,
      remaining_installments: 600000,
      transfer_fee: 0,
      discount_percent: 0,
      description: "عرض تجريبي للتوضيح فقط.",
      photos: []
    }
  ];

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function money(value) {
    return number(value).toLocaleString("ar-EG") + " ج.م";
  }

  function normalize(row) {
    return {
      ...row,
      title: row.title || "عرض عقاري",
      area: row.area || "",
      property_type: row.property_type || "شقة",
      total_price: number(row.total_price),
      down_payment: number(row.down_payment),
      paid_amount: number(row.paid_amount),
      remaining_installments: number(row.remaining_installments),
      transfer_fee: number(row.transfer_fee),
      discount_percent: number(row.discount_percent),
      description: row.description || "",
      photos: Array.isArray(row.photos) ? row.photos : []
    };
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(offers));
    } catch (error) {
      console.error("تعذر الحفظ المحلي:", error);
    }
  }

  function render() {
    if (!grid) return;

    const search = ($("searchInput")?.value || "").trim().toLowerCase();
    const type = $("typeFilter")?.value || "";
    const area = $("areaFilter")?.value || "";

    const filtered = offers.filter((o) => {
      const text = [
        o.title, o.area, o.property_type, o.description
      ].join(" ").toLowerCase();

      return (!search || text.includes(search)) &&
        (!type || o.property_type === type) &&
        (!area || o.area === area) &&
        (!activeKind || o.property_type === activeKind);
    });

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>لا توجد عروض مطابقة</h3>
          <p>غيّر البحث أو أضف عرضًا جديدًا.</p>
        </div>`;
      return;
    }

    grid.innerHTML = filtered.map((o) => {
      const image = o.photos.find(
        (p) => typeof p === "string" && /^https?:\/\//i.test(p)
      );

      return `
        <article class="offer-card">
          ${image
            ? `<img class="offer-image" src="${escapeHTML(image)}" alt="${escapeHTML(o.title)}" loading="lazy">`
            : `<div class="offer-image offer-image-placeholder">LAYAN</div>`}
          <div class="offer-card-content">
            <span class="offer-type">${escapeHTML(o.property_type)}</span>
            <h3>${escapeHTML(o.title)}</h3>
            <p>${escapeHTML(o.area || "أسيوط")}</p>
            <div class="offer-details">
              <div><span>السعر الإجمالي</span><strong>${money(o.total_price)}</strong></div>
              <div><span>المقدم المطلوب</span><strong>${money(o.down_payment)}</strong></div>
              <div><span>المبلغ المدفوع</span><strong>${money(o.paid_amount)}</strong></div>
              <div><span>الأقساط المتبقية</span><strong>${money(o.remaining_installments)}</strong></div>
              <div><span>رسوم التنازل</span><strong>${money(o.transfer_fee)}</strong></div>
              <div><span>نسبة الخصم</span><strong>${number(o.discount_percent)}٪</strong></div>
            </div>
            ${o.description
              ? `<p class="offer-description">${escapeHTML(o.description)}</p>`
              : ""}
            <p class="form-note">تحقق من شروط المطور قبل إتمام التنازل.</p>
          </div>
        </article>`;
    }).join("");
  }

  async function loadOffers() {
    setStatus("جارٍ تحميل العروض...");

    try {
      const api = window.LAYAN_SUPABASE;

      if (!api || typeof api.getOffers !== "function") {
        throw new Error("إعداد الاتصال بقاعدة البيانات غير جاهز.");
      }

      const rows = await api.getOffers();

      if (!Array.isArray(rows)) {
        throw new Error("استجابة قاعدة البيانات غير متوقعة.");
      }

      offers = rows.map(normalize);
      render();

      setStatus(offers.length
        ? `تم تحميل ${offers.length} عرض من قاعدة البيانات.`
        : "لا توجد عروض في قاعدة البيانات حتى الآن.");
      return;
    } catch (error) {
      console.error("خطأ تحميل Supabase:", error);
    }

    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

      offers = Array.isArray(saved) && saved.length
        ? saved.map(normalize)
        : demoOffers.map(normalize);
    } catch {
      offers = demoOffers.map(normalize);
    }

    render();
    setStatus("تعذر تحميل قاعدة البيانات؛ المعروض بيانات محلية أو تجريبية.");
  }

  function openDialog() {
    if (dialog && typeof dialog.showModal === "function") {
      dialog.showModal();
    }
  }

  function closeDialog() {
    if (dialog?.open) dialog.close();
  }

  $("addOfferTop")?.addEventListener("click", openDialog);
  $("addOfferBtn")?.addEventListener("click", openDialog);
  $("closeDialog")?.addEventListener("click", closeDialog);

  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });

  $("searchInput")?.addEventListener("input", render);
  $("typeFilter")?.addEventListener("change", render);
  $("areaFilter")?.addEventListener("change", render);
  $("searchBtn")?.addEventListener("click", render);

  document.querySelectorAll("[data-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      activeKind = button.dataset.kind || "";

      document.querySelectorAll("[data-kind]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });

      render();
    });
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const files = $("photosInput")?.files;

    if (files?.length) {
      setStatus("تنبيه: رفع الصور إلى الإنترنت لم يُفعّل بعد.");
    }

    const offer = normalize({
      title: String(data.get("title") || "").trim(),
      governorate: "أسيوط",
      area: String(data.get("area") || "").trim(),
      property_type: String(data.get("property_type") || "شقة"),
      total_price: data.get("total_price"),
      down_payment: data.get("down_payment"),
      paid_amount: data.get("paid_amount"),
      remaining_installments: data.get("remaining_installments"),
      transfer_fee: data.get("transfer_fee"),
      discount_percent: data.get("discount_percent"),
      description: String(data.get("description") || "").trim(),
      photos: []
    });

    if (!offer.title) {
      setStatus("اكتب عنوان العرض أولًا.");
      return;
    }

    const submitButton = form.querySelector('[type="submit"]');

    if (submitButton) submitButton.disabled = true;
    setStatus("جارٍ حفظ العرض في قاعدة البيانات...");

    try {
      const api = window.LAYAN_SUPABASE;

      if (!api || typeof api.createOffer !== "function") {
        throw new Error("وظيفة حفظ العروض غير متاحة.");
      }

      const savedOffer = await api.createOffer(offer);

      if (!savedOffer) {
        throw new Error("لم تُرجع قاعدة البيانات العرض المحفوظ.");
      }

      offers.unshift(normalize(savedOffer));
      closeDialog();
      form.reset();
      render();

      setStatus("تم حفظ العرض في قاعدة البيانات بنجاح.");
    } catch (error) {
      console.error("فشل حفظ العرض:", error);

      setStatus(
        "فشل حفظ العرض في قاعدة البيانات. لم يتم نشره. " +
        "راجع صلاحيات INSERT وRLS وأعمدة الجدول."
      );
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  $("loginBtn")?.addEventListener("click", () => {
    alert("ميزة تسجيل الدخول قيد التجهيز.");
  });

  await loadOffers();
});
