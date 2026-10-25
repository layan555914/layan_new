document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const grid = $("offersGrid");
  const form = $("offerForm");
  const dialog = $("offerDialog");
  const statusBox = $("statusMessage");
  const formStatusBox = $("formStatusMessage");
  const photosInput = $("photosInput");
  const areaFilter = $("areaFilter");

  let offers = [];
  let activeKind = "";
  const LAYAN_PHONE = "201007044265";
  const illustrativeImages = {
    "شقة سكنية عصرية": "assets/layan-property-9.svg",
    "شقة داخل كمبوند": "assets/layan-property-10.svg",
    "شقة فرصة للتنازل": "assets/layan-property-11.svg"
  };

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const money = (v) =>
    num(v).toLocaleString("ar-EG", { maximumFractionDigits: 2 }) + " ج.م";

  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);

  const offerCode = (offer) => {
    const id = String(offer?.id || "");
    return id ? "LAY-" + id.replace(/-/g, "").slice(0, 8).toUpperCase() : "قيد المراجعة";
  };

  function setStatus(message) {
    if (statusBox) statusBox.textContent = message;
    if (formStatusBox) formStatusBox.textContent = message;
  }

  function normalize(row = {}) {
    let images = row.image_urls || [];
    if (typeof images === "string") {
      try { images = JSON.parse(images); } catch { images = []; }
    }
    if (!Array.isArray(images)) images = [];
    const paid = num(row.paid_amount);
    const discount = num(row.discount_amount);
    const validImages = images.filter((url) => typeof url === "string" && /^(https?:\/\/|assets\/)/i.test(url));
    if (!validImages.length && illustrativeImages[row.title]) validImages.push(illustrativeImages[row.title]);

    return {
      ...row,
      title: row.title || "عرض عقاري",
      area: row.area || "",
      property_type: row.property_type || "شقة",
      total_price: num(row.total_price),
      down_payment: num(row.down_payment),
      paid_amount: paid,
      remaining_amount: num(row.remaining_amount ?? row.remaining_installments),
      assignment_fee: num(row.assignment_fee ?? row.transfer_fee),
      assignment_fee_percentage: num(row.assignment_fee_percentage ?? row.transfer_fee_percentage),
      discount_amount: discount,
      description: row.description || "",
      developer_name: row.developer_name || "",
      image_urls: validImages,
      status: row.status || "pending"
    };
  }

  function updateAreaFilter() {
    if (!areaFilter) return;
    const previous = areaFilter.value;
    const areas = [...new Set(offers.map((o) => o.area.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar"));
    areaFilter.innerHTML = '<option value="">كل المناطق</option>' + areas.map((area) => `<option value="${esc(area)}">${esc(area)}</option>`).join("");
    if (areas.includes(previous)) areaFilter.value = previous;
  }

  function render() {
    if (!grid) { console.error("LAYAN: العنصر offersGrid غير موجود في index.html"); return; }
    const search = ($("searchInput")?.value || "").trim().toLowerCase();
    const type = $("typeFilter")?.value || "";
    const area = areaFilter?.value || "";
    const filtered = offers.filter((o) => {
      const text = [o.title, o.area, o.property_type, o.description, o.developer_name].join(" ").toLowerCase();
      return (!search || text.includes(search)) && (!type || o.property_type === type) && (!area || o.area === area) && (!activeKind || o.property_type === activeKind);
    });

    if (!filtered.length) {
      grid.innerHTML = '<div class="empty-state"><h3>لا توجد عروض منشورة حاليًا</h3><p>يمكنك تعديل البحث أو العودة لاحقًا.</p></div>';
      return;
    }

    grid.innerHTML = filtered.map((o) => {
      const index = offers.indexOf(o);
      const image = o.image_urls[0];
      return `<article class="offer-card">
        ${image ? `<img class="offer-image" src="${esc(image)}" alt="${esc(o.title)} - صورة توضيحية" loading="lazy">` : '<div class="offer-image offer-image-placeholder">LAYAN AQAR</div>'}
        <div class="offer-card-content">
          <span class="offer-type">${esc(o.property_type)}</span>
          <p class="offer-code">كود الإعلان: <strong>${esc(offerCode(o))}</strong></p>
          <h3>${esc(o.title)}</h3><p>${esc(o.area || "أسيوط")}</p>
          <div class="offer-details">
            <div><span>السعر الإجمالي</span><strong>${money(o.total_price)}</strong></div>
            <div><span>المقدم</span><strong>${money(o.down_payment)}</strong></div>
            <div><span>المبلغ المدفوع</span><strong>${money(o.paid_amount)}</strong></div>
            <div><span>المبلغ المتبقي</span><strong>${money(o.remaining_amount)}</strong></div>
            <div><span>رسوم التنازل</span><strong>${money(o.assignment_fee)}</strong></div>
          </div>
          <button type="button" class="details-button" data-offer-index="${index}">عرض التفاصيل</button>
        </div>
      </article>`;
    }).join("");
  }

  function openDialog() {
    if (!dialog) { setStatus("نموذج الإضافة غير موجود في الصفحة."); return; }
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }
  function closeDialog() {
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
  }

  function showDetails(o) {
    let d = $("detailsDialog");
    if (!d) {
      d = document.createElement("dialog");
      d.id = "detailsDialog";
      d.innerHTML = '<button id="closeDetailsDialog" type="button">إغلاق ✕</button><div id="detailsContent"></div>';
      document.body.appendChild(d);
      $("closeDetailsDialog").addEventListener("click", () => d.close());
    }
    const content = $("detailsContent");
    const images = o.image_urls.length ? o.image_urls.map((url) => `<img src="${esc(url)}" alt="${esc(o.title)} - صورة توضيحية" style="width:100%;max-height:260px;object-fit:cover">`).join("") : '<div class="offer-image-placeholder">LAYAN AQAR</div>';
    content.innerHTML = `${images}<h2>${esc(o.title)}</h2>
      <p>كود الإعلان: <strong>${esc(offerCode(o))}</strong></p>
      <p>المنطقة: ${esc(o.area || "أسيوط")}</p><p>نوع العقار: ${esc(o.property_type)}</p>
      <p>السعر الإجمالي: ${money(o.total_price)}</p><p>المقدم: ${money(o.down_payment)}</p>
      <p>المبلغ المدفوع: ${money(o.paid_amount)}</p><p>المبلغ المتبقي: ${money(o.remaining_amount)}</p>
      <p>رسوم التنازل: ${money(o.assignment_fee)}</p><p>المطور: ${esc(o.developer_name || "غير محدد")}</p>
      <p>${esc(o.description || "لا يوجد وصف إضافي.")}</p><h3>تواصل مع ليان عقار</h3>
      <a href="tel:+${LAYAN_PHONE}">اتصال بليان</a>
      <a target="_blank" rel="noopener noreferrer" href="https://wa.me/${LAYAN_PHONE}?text=${encodeURIComponent("أنا مهتم بالعرض " + o.title + " - كود " + offerCode(o))}">واتساب ليان</a>`;
    if (!d.open) d.showModal();
  }

  $("addOfferTop")?.addEventListener("click", openDialog);
  $("addOfferBtn")?.addEventListener("click", openDialog);
  $("closeOfferDialog")?.addEventListener("click", closeDialog);
  $("searchInput")?.addEventListener("input", render);
  $("typeFilter")?.addEventListener("change", render);
  areaFilter?.addEventListener("change", render);
  grid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-offer-index]");
    if (button) {
      const index = Number(button.dataset.offerIndex);
      if (offers[index]) showDetails(offers[index]);
    }
  });

  async function loadOffers() {
    try {
      if (!window.LayanSupabase || typeof window.LayanSupabase.getOffers !== "function") throw new Error("Supabase client unavailable");
      const rows = await window.LayanSupabase.getOffers();
      offers = (Array.isArray(rows) ? rows : []).map(normalize);
      updateAreaFilter();
      render();
      setStatus(offers.length ? `تم تحميل ${offers.length} عرض.` : "لا توجد عروض منشورة حاليًا.");
    } catch (error) {
      console.error("خطأ تحميل العروض:", error);
      offers = [];
      updateAreaFilter();
      render();
      setStatus("تعذر تحميل العروض. راجع إعدادات الاتصال والصلاحيات.");
    }
  }

  await loadOffers();
});
