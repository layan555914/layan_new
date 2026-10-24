
document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const grid = $("offersGrid");
  const form = $("offerForm");
  const dialog = $("offerDialog");
  const status = $("statusMessage");
  const photosInput = $("photosInput");
  const areaFilter = $("areaFilter");

  let offers = [];
  let activeKind = "";

  const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const money = (value) =>
    num(value).toLocaleString("ar-EG") + " ج.م";

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function normalize(row) {
    let images = row.image_urls ?? row.photos ?? [];

    if (typeof images === "string") {
      try {
        images = JSON.parse(images);
      } catch {
        images = [];
      }
    }

    if (!Array.isArray(images)) images = [];

    return {
      ...row,
      title: row.title || "عرض عقاري",
      area: row.area || row.city || "",
      property_type: row.property_type || "شقة",
      total_price: num(row.total_price),
      down_payment: num(row.down_payment),
      paid_amount: num(row.paid_amount),
      remaining_amount: num(
        row.remaining_amount ?? row.remaining_installments
      ),
      monthly_installment: num(row.monthly_installment),
      assignment_fee: num(row.assignment_fee ?? row.transfer_fee),
      assignment_fee_percentage: num(row.assignment_fee_percentage),
      discount_amount: num(row.discount_amount),
      discount_percent: num(row.discount_percent),
      bedrooms: num(row.bedrooms),
      bathrooms: num(row.bathrooms),
      area_m2: num(row.area_m2),
      description: row.description || "",
      image_urls: images,
      developer_name: row.developer_name || "",
      contact_name: row.contact_name || "",
      contact_phone: row.contact_phone || "",
      status: row.status || "available"
    };
  }

  function updateAreaFilter() {
    if (!areaFilter) return;

    const current = areaFilter.value;
    const areas = [...new Set(
      offers.map((o) => o.area.trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "ar"));

    areaFilter.innerHTML =
      '<option value="">كل المناطق</option>' +
      areas.map((area) =>
        `<option value="${esc(area)}">${esc(area)}</option>`
      ).join("");

    if (areas.includes(current)) areaFilter.value = current;
  }

  function render() {
    if (!grid) return;

    const search = ($("searchInput")?.value || "")
      .trim().toLowerCase();
    const type = $("typeFilter")?.value || "";
    const area = areaFilter?.value || "";

    const filtered = offers.filter((o) => {
      const searchable = [
        o.title,
        o.area,
        o.property_type,
        o.description,
        o.developer_name
      ].join(" ").toLowerCase();

      return (!search || searchable.includes(search)) &&
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
      const image = o.image_urls.find(
        (p) => typeof p === "string" &&
          /^https?:\/\//i.test(p)
      );

      return `
        <article class="offer-card">
          ${image
            ? `<img class="offer-image"
                src="${esc(image)}"
                alt="${esc(o.title)}"
                loading="lazy">`
            : `<div class="offer-image offer-image-placeholder">
                LAYAN
              </div>`}

          <div class="offer-card-content">
            <span class="offer-type">${esc(o.property_type)}</span>
            <h3>${esc(o.title)}</h3>
            <p>${esc(o.area || "أسيوط")}</p>

            <div class="offer-details">
              <div>
                <span>السعر الإجمالي</span>
                <strong>${money(o.total_price)}</strong>
              </div>
              <div>
                <span>المقدم المطلوب</span>
                <strong>${money(o.down_payment)}</strong>
              </div>
              <div>
                <span>المبلغ المدفوع</span>
                <strong>${money(o.paid_amount)}</strong>
              </div>
              <div>
                <span>المبلغ المتبقي</span>
                <strong>${money(o.remaining_amount)}</strong>
              </div>
              <div>
                <span>القسط الشهري</span>
                <strong>${money(o.monthly_installment)}</strong>
              </div>
              <div>
                <span>رسوم التنازل</span>
                <strong>${money(o.assignment_fee)}</strong>
              </div>
              <div>
                <span>نسبة رسوم التنازل</span>
                <strong>${o.assignment_fee_percentage}٪</strong>
              </div>
              <div>
                <span>قيمة الخصم</span>
                <strong>${money(o.discount_amount)}</strong>
              </div>
              ${o.discount_percent
                ? `<div><span>نسبة الخصم</span>
                    <strong>${o.discount_percent}٪</strong></div>`
                : ""}
              ${o.area_m2
                ? `<div><span>المساحة</span>
                    <strong>${o.area_m2} م²</strong></div>`
                : ""}
              ${o.bedrooms
                ? `<div><span>غرف النوم</span>
                    <strong>${o.bedrooms}</strong></div>`
                : ""}
              ${o.bathrooms
                ? `<div><span>الحمامات</span>
                    <strong>${o.bathrooms}</strong></div>`
                : ""}
            </div>

            ${o.developer_name
              ? `<p>المطور: ${esc(o.developer_name)}</p>`
              : ""}
            ${o.description
              ? `<p class="offer-description">
                  ${esc(o.description)}
                </p>`
              : ""}
            <p class="form-note">
              تحقق من شروط المطور قبل إتمام التنازل.
            </p>
          </div>
        </article>`;
    }).join("");
  }

  async function loadOffers() {
    setStatus("جارٍ تحميل العروض...");

    try {
      if (!window.LAYAN_SUPABASE?.getOffers) {
        throw new Error("اتصال Supabase غير جاهز.");
      }

      const rows = await window.LAYAN_SUPABASE.getOffers();

      if (!Array.isArray(rows)) {
        throw new Error("استجابة غير متوقعة.");
      }

      offers = rows.map(normalize);
      updateAreaFilter();
      render();

      setStatus(offers.length
        ? `تم تحميل ${offers.length} عرض من قاعدة البيانات.`
        : "لا توجد عروض في قاعدة البيانات حتى الآن.");
    } catch (error) {
      console.error("خطأ تحميل العروض:", error);
      offers = [];
      updateAreaFilter();
      render();
      setStatus(
        "تعذر تحميل العروض. راجع إعدادات الاتصال وصلاحيات القراءة."
      );
    }
  }

  function openDialog() {
    if (dialog && !dialog.open && dialog.showModal) {
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
  areaFilter?.addEventListener("change", render);
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
    const get = (name) => data.get(name);
    const text = (name) => String(get(name) || "").trim();

    const offer = {
      title: text("title"),
      governorate: "أسيوط",
      area: text("area"),
      property_type: text("property_type") || "شقة",
      total_price: num(get("total_price")),
      down_payment: num(get("down_payment")),
      paid_amount: num(get("paid_amount")),
      remaining_amount: num(get("remaining_installments")),
      assignment_fee: num(get("transfer_fee")),
      discount_percent: num(get("discount_percent")),
      description: text("description"),
      image_urls: []
    };

    if (!offer.title) {
      setStatus("اكتب عنوان العرض أولًا.");
      return;
    }

    const files = Array.from(photosInput?.files || []);

    if (files.some((file) => !file.type.startsWith("image/"))) {
      setStatus("اختر ملفات صور فقط.");
      return;
    }

    if (files.some((file) => file.size > 10 * 1024 * 1024)) {
      setStatus("حجم الصورة الواحدة يجب ألا يتجاوز 10 ميجابايت.");
      return;
    }

    const button = form.querySelector('[type="submit"]');
    if (button) button.disabled = true;

    try {
      if (!window.LAYAN_SUPABASE?.createOffer) {
        throw new Error("وظيفة حفظ العروض غير جاهزة.");
      }

      // رفع الصور أولًا إذا اختار المستخدم صورًا.
      if (files.length) {
        if (!window.LAYAN_SUPABASE.uploadImages) {
          throw new Error(
            "رفع الصور لم يُفعّل بعد في ملف gubabase.js."
          );
        }

        setStatus("جارٍ رفع صور الوحدة...");

        offer.image_urls =
          await window.LAYAN_SUPABASE.uploadImages(files);
      }

      setStatus("جارٍ حفظ العرض...");

      const saved = await window.LAYAN_SUPABASE.createOffer(offer);

      if (!saved) {
        throw new Error("لم يتم إرجاع العرض المحفوظ.");
      }

      offers.unshift(normalize(saved));
      updateAreaFilter();
      form.reset();
      closeDialog();
      render();

      setStatus("تم حفظ العرض بنجاح.");
    } catch (error) {
      console.error("فشل حفظ العرض:", error);
      setStatus(
        error.message ||
        "فشل الحفظ. راجع إعدادات قاعدة البيانات والتخزين."
      );
    } finally {
      if (button) button.disabled = false;
    }
  });

  $("loginBtn")?.addEventListener("click", () => {
    alert("ميزة تسجيل الدخول قيد التجهيز.");
  });

  await loadOffers();
});
