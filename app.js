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
  const LAYAN_PHONE = "201007044265";

  const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
function offerCode(offer) {
  const id = String(offer?.id || "");
  if (!id) return "جارٍ تخصيص الكود";
  return "LAY-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}
  const money = (value) =>
    num(value).toLocaleString("ar-EG", {
      maximumFractionDigits: 2
    }) + " ج.م";

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

  function calculateDiscount(paidAmount, discountPercent) {
    return Math.round(
      num(paidAmount) * num(discountPercent) / 100 * 100
    ) / 100;
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

    const paidAmount = num(row.paid_amount);
    const discountPercent = Math.min(
      100,
      num(row.discount_percent)
    );

    const discountAmount = calculateDiscount(
      paidAmount,
      discountPercent
    );

    return {
      ...row,
      title: row.title || "عرض عقاري",
      area: row.area || row.city || "",
      property_type: row.property_type || "شقة",
      total_price: num(row.total_price),
      down_payment: num(row.down_payment),
      paid_amount: paidAmount,
      remaining_amount: num(
        row.remaining_amount ?? row.remaining_installments
      ),
      monthly_installment: num(row.monthly_installment),
      assignment_fee: num(
        row.assignment_fee ?? row.transfer_fee
      ),
      assignment_fee_percentage: num(
        row.assignment_fee_percentage
      ),
      discount_amount: discountAmount,
      discount_percent: discountPercent,
      net_paid_amount: Math.max(
        0,
        paidAmount - discountAmount
      ),
      bedrooms: num(row.bedrooms),
      bathrooms: num(row.bathrooms),
      area_m2: num(row.area_m2),
      description: row.description || "",
      image_urls: images.filter(
        (image) =>
          typeof image === "string" &&
          /^https?:\/\//i.test(image)
      ),
      developer_name: row.developer_name || "",
      contact_name: row.contact_name || "",
      contact_phone: row.contact_phone || "",
      status: row.status || "available"
    };
  }

  function createDetailsDialog() {
    let detailsDialog = $("detailsDialog");

    if (detailsDialog) return detailsDialog;

    detailsDialog = document.createElement("dialog");
    detailsDialog.id = "detailsDialog";
    detailsDialog.className = "details-dialog";

    detailsDialog.innerHTML = `
      <div class="dialog-header">
        <h2 id="detailsTitle">تفاصيل الوحدة العقارية</h2>
        <button
          id="closeDetailsDialog"
          type="button"
          aria-label="إغلاق"
        >×</button>
      </div>
      <div id="detailsContent"></div>
    `;

    document.body.appendChild(detailsDialog);
    return detailsDialog;
  }

  const detailsDialog = createDetailsDialog();

  function detailRow(label, value) {
    return `
      <div class="detail-item">
        <span>${esc(label)}</span>
        <strong>${esc(value)}</strong>
      </div>
    `;
  }

  function renderDetails(offer) {
    const title = $("detailsTitle");
    const content = $("detailsContent");

    if (!content || !offer) return;
    if (title) title.textContent = offer.title;

    const images = offer.image_urls.length
      ? `
        <div class="details-gallery">
          ${offer.image_urls.map((url) => `
            <img
              src="${esc(url)}"
              alt="${esc(offer.title)}"
              loading="lazy"
            >
          `).join("")}
        </div>
      `
      : `
        <div class="offer-image-placeholder details-placeholder">
          LAYAN AQAR
        </div>
      `;

    const fields = [
      ["نوع العقار", offer.property_type],
      ["المنطقة", offer.area || "أسيوط"],
      ["السعر الإجمالي", money(offer.total_price)],
      ["المقدم المطلوب", money(offer.down_payment)],
      ["المبلغ المدفوع", money(offer.paid_amount)],
      ["المبلغ المتبقي", money(offer.remaining_amount)],
      ["القسط الشهري", money(offer.monthly_installment)],
      ["رسوم التنازل", money(offer.assignment_fee)],
      ["نسبة رسوم التنازل", offer.assignment_fee_percentage + "٪"],
      ["نسبة الخصم", offer.discount_percent + "٪"],
      ["قيمة الخصم المحسوبة", money(offer.discount_amount)],
      ["صافي المبلغ بعد الخصم", money(offer.net_paid_amount)]
    ];

    if (offer.area_m2) {
      fields.push(["المساحة", offer.area_m2 + " م²"]);
    }

    if (offer.bedrooms) {
      fields.push(["غرف النوم", offer.bedrooms]);
    }

    if (offer.bathrooms) {
      fields.push(["الحمامات", offer.bathrooms]);
    }

    if (offer.developer_name) {
      fields.push(["المطور العقاري", offer.developer_name]);
    }

    // التواصل يتجه إلى إدارة ليان فقط.
    // رقم واتساب والاتصال بصيغة دولية مصرية.
    const contact = `
      <section class="details-contact">
        <h3>تواصل مع ليان عقار</h3>
        <p>
          للاستفسار عن هذا العرض والتنسيق مع صاحبه،
          تواصل مع إدارة ليان.
        </p>

        <div class="contact-actions"><p class="offer-code">
  كود الإعلان: <strong>${esc(offerCode(offer))}</strong>
</p>
          <a
            class="contact-button call-button"
            href="tel:+${LAYAN_PHONE}"
          >
            ☎ اتصال بليان
          </a>

          <a
            class="contact-button whatsapp-button"
            href="https://wa.me/${LAYAN_PHONE}?text=${encodeURIComponent(
              "السلام عليكم، أنا مهتم بعرض العقار: " +
              offer.title +
              ". أرجو التواصل معي وتوضيح التفاصيل. كود العرض: " +
              (offer.id || "غير متاح")
            )}"
            target="_blank"
            rel="noopener noreferrer"
          >
            واتساب ليان
          </a>
        </div>
      </section>
    `;

    content.innerHTML = `
      ${images}

      <div class="details-summary">
        <span class="offer-type">${esc(offer.property_type)}</span>
        <h3>${esc(offer.title)}</h3>
        <p>${esc(offer.area || "أسيوط")}</p>
      </div>

      <div class="details-grid">
        ${fields.map(([label, value]) =>
          detailRow(label, value)
        ).join("")}
      </div>

      <section class="details-description">
        <h3>وصف الوحدة</h3>
        <p>${esc(
          offer.description || "لا يوجد وصف مضاف لهذا العرض."
        )}</p>
      </section>

      ${contact}

      <p class="form-note">
        الخصم المعروض محسوب على المبلغ المدفوع وفقًا للنسبة المدخلة.
        تحقق من شروط المطور والمستندات والمبالغ المستحقة قبل إتمام الاتفاق.
      </p>
    `;
  }

  function openDetails(offer) {
    renderDetails(offer);

    if (detailsDialog && !detailsDialog.open) {
      detailsDialog.showModal();
    }
  }

  function closeDetails() {
    if (detailsDialog?.open) detailsDialog.close();
  }

  $("closeDetailsDialog")?.addEventListener(
    "click",
    closeDetails
  );

  detailsDialog.addEventListener("click", (event) => {
    if (event.target === detailsDialog) closeDetails();
  });

  function updateAreaFilter() {
    if (!areaFilter) return;

    const current = areaFilter.value;
    const areas = [...new Set(
      offers.map((offer) => offer.area.trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "ar"));

    areaFilter.innerHTML =
      '<option value="">كل المناطق</option>' +
      areas.map((area) =>
        `<option value="${esc(area)}">${esc(area)}</option>`
      ).join("");

    if (areas.includes(current)) {
      areaFilter.value = current;
    }
  }

  function render() {
    if (!grid) return;

    const search = ($("searchInput")?.value || "")
      .trim()
      .toLowerCase();

    const type = $("typeFilter")?.value || "";
    const area = areaFilter?.value || "";

    const filtered = offers.filter((offer) => {
      const searchable = [
        offer.title,
        offer.area,
        offer.property_type,
        offer.description,
        offer.developer_name
      ].join(" ").toLowerCase();

      return (!search || searchable.includes(search)) &&
        (!type || offer.property_type === type) &&
        (!area || offer.area === area) &&
        (!activeKind || offer.property_type === activeKind);
    });

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>لا توجد عروض مطابقة</h3>
          <p>غيّر البحث أو أضف عرضًا جديدًا.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map((offer) => {
      const image = offer.image_urls[0];

      return `
        <article class="offer-card">
          ${
            image
              ? `
                <img
                  class="offer-image"
                  src="${esc(image)}"
                  alt="${esc(offer.title)}"
                  loading="lazy"
                >
              `
              : `
                <div class="offer-image offer-image-placeholder">
                  LAYAN
                </div>
              `
          }

          <div class="offer-card-content">
            <span class="offer-type">${esc(offer.property_type)}</span>
            <h3>${esc(offer.title)}</h3>
            <p>${esc(offer.area || "أسيوط")}</p>

            <div class="offer-details">
              <div>
                <span>السعر الإجمالي</span>
                <strong>${money(offer.total_price)}</strong>
              </div>
              <div>
                <span>المقدم المطلوب</span>
                <strong>${money(offer.down_payment)}</strong>
              </div>
              <div>
                <span>المبلغ المدفوع</span>
                <strong>${money(offer.paid_amount)}</strong>
              </div>
              <div>
                <span>المبلغ المتبقي</span>
                <strong>${money(offer.remaining_amount)}</strong>
              </div>
              <div>
                <span>القسط الشهري</span>
                <strong>${money(offer.monthly_installment)}</strong>
              </div>
              <div>
                <span>رسوم التنازل</span>
                <strong>${money(offer.assignment_fee)}</strong>
              </div>
              <div>
                <span>نسبة رسوم التنازل</span>
                <strong>${offer.assignment_fee_percentage}٪</strong>
              </div>
              <div>
                <span>نسبة الخصم</span>
                <strong>${offer.discount_percent}٪</strong>
              </div>
              <div>
                <span>قيمة الخصم</span>
                <strong>${money(offer.discount_amount)}</strong>
              </div>
              <div>
                <span>صافي المبلغ بعد الخصم</span>
                <strong>${money(offer.net_paid_amount)}</strong>
              </div>
              ${
                offer.area_m2
                  ? `
                    <div>
                      <span>المساحة</span>
                      <strong>${offer.area_m2} م²</strong>
                    </div>
                  `
                  : ""
              }
            </div>

            ${
              offer.developer_name
                ? `<p>المطور: ${esc(offer.developer_name)}</p>`
                : ""
            }

            ${
              offer.description
                ? `<p class="offer-description">${esc(offer.description)}</p>`
                : ""
            }

            <p class="form-note">
              تحقق من شروط المطور قبل إتمام التنازل.
            </p>

            <button
              class="btn btn-dark full-width"
              type="button"
              data-offer-index="${offers.indexOf(offer)}"
            >
              عرض التفاصيل
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  grid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-offer-index]");
    if (!button) return;

    const index = Number(button.dataset.offerIndex);

    if (Number.isInteger(index) && offers[index]) {
      openDetails(offers[index]);
    }
  });

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

      <span class="offer-type">${esc(offer.property_type)}</span>
<p class="offer-code">
  كود الإعلان: <strong>${esc(offerCode(offer))}</strong>
</p>
<h3>${esc(offer.title)}</h3>

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const get = (name) => data.get(name);
    const text = (name) => String(get(name) || "").trim();

    const paidAmount = num(get("paid_amount"));
    const discountPercent = Math.min(
      100,
      num(get("discount_percent"))
    );

    const discountAmount = calculateDiscount(
      paidAmount,
      discountPercent
    );

    const offer = {
      title: text("title"),
      governorate: "أسيوط",
      area: text("area"),
      property_type: text("property_type") || "شقة",
      total_price: num(get("total_price")),
      down_payment: num(get("down_payment")),
      paid_amount: paidAmount,
      remaining_amount: num(get("remaining_installments")),
      assignment_fee: num(get("transfer_fee")),
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      contact_name: text("contact_name"),
      contact_phone: text("contact_phone"),
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

      if (files.length) {
        if (!window.LAYAN_SUPABASE.uploadImages) {
          throw new Error("رفع الصور غير مفعّل.");
        }

        setStatus("جارٍ رفع صور الوحدة...");

        offer.image_urls =
          await window.LAYAN_SUPABASE.uploadImages(files);
      }

      setStatus("جارٍ حفظ العرض...");

      const saved =
        await window.LAYAN_SUPABASE.createOffer(offer);

      if (!saved) {
        throw new Error("لم يتم إرجاع العرض المحفوظ.");
      }

      offers.unshift(normalize(saved));
      updateAreaFilter();
      form.reset();
      closeDialog();
      render();

      setStatus(
        `تم حفظ العرض بنجاح. قيمة الخصم المحسوبة: ${money(discountAmount)}.`
      );
    } catch (error) {
      console.error("فشل حفظ العرض:", error);
      setStatus(error.message || "فشل الحفظ. حاول مرة أخرى.");
    } finally {
      if (button) button.disabled = false;
    }
  });

  $("loginBtn")?.addEventListener("click", () => {
    alert("ميزة تسجيل الدخول قيد التجهيز.");
  });

  const detailsStyle = document.createElement("style");

  detailsStyle.textContent = `
    #detailsDialog {
      width: min(760px, calc(100% - 24px));
      max-height: 90vh;
      overflow-y: auto;
      padding: 22px;
      color: #1b2c42;
      background: #f8fafc;
      border: 1px solid #c5a15d;
      border-radius: 16px;
      box-shadow: 0 25px 90px #0005;
    }

    #detailsDialog::backdrop {
      background: #071629c9;
      backdrop-filter: blur(3px);
    }

    #detailsDialog .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 18px;
    }

    #detailsDialog .dialog-header h2 {
      margin: 0;
      color: #102746;
      font-size: 21px;
    }

    #closeDetailsDialog {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 42px;
      width: 42px;
      height: 42px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: #a93636;
      color: #fff;
      font-size: 29px;
      cursor: pointer;
    }

    .details-gallery {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      margin-bottom: 18px;
      padding-bottom: 8px;
    }

    .details-gallery img {
      width: min(100%, 360px);
      min-width: 220px;
      height: 230px;
      flex: 0 0 auto;
      object-fit: cover;
      border-radius: 12px;
      background: #e1e7ef;
    }

    .details-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 150px;
      margin-bottom: 16px;
      background: #102746;
      color: #ead9b2;
      border-radius: 12px;
    }

    .details-summary h3 {
      margin: 8px 0;
      color: #102746;
      font-size: 23px;
    }

    .details-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin: 18px 0;
    }

    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 0;
      padding: 12px;
      background: #fff;
      border: 1px solid #e1e7ef;
      border-radius: 10px;
      overflow-wrap: anywhere;
    }

    .detail-item span {
      color: #718096;
      font-size: 12px;
    }

    .detail-item strong {
      color: #102746;
      font-size: 14px;
    }

    .details-description,
    .details-contact {
      margin-top: 14px;
      padding: 14px;
      background: #fff;
      border-radius: 10px;
    }

    .details-description h3,
    .details-contact h3 {
      margin-top: 0;
      color: #102746;
    }

    .details-description p {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .contact-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 12px;
    }

    .contact-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 1 1 140px;
      min-height: 46px;
      padding: 12px 16px;
      border-radius: 9px;
      color: #fff;
      text-decoration: none;
      font-weight: 700;
    }

    .call-button {
      background: #102746;
    }

    .whatsapp-button {
      background: #168548;
    }

    #detailsDialog .form-note {
      margin-top: 16px;
    }

    @media (max-width: 520px) {
      #detailsDialog {
        padding: 14px;
      }

      .details-grid {
        grid-template-columns: minmax(0, 1fr);
      }

      .details-gallery img {
        height: 190px;
      }
    }
  `;

  document.head.appendChild(detailsStyle);

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

      setStatus(
        offers.length
          ? `تم تحميل ${offers.length} عرض من قاعدة البيانات.`
          : "لا توجد عروض في قاعدة البيانات حتى الآن."
      );
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

  await loadOffers();
});
