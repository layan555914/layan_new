
document.addEventListener("DOMContentLoaded", () => {
  const dialog = document.getElementById("offerDialog");
  const form = document.getElementById("offerForm");
  const closeBtn = document.getElementById("closeDialog");
  const status = document.getElementById("statusMessage");
  const grid = document.getElementById("offersGrid");

  // فتح نموذج إضافة العرض
  function openOfferForm() {
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  document.getElementById("addOfferTop")
    ?.addEventListener("click", openOfferForm);

  document.getElementById("addOfferBtn")
    ?.addEventListener("click", openOfferForm);

  // إغلاق النموذج
  closeBtn?.addEventListener("click", () => {
    dialog?.close();
  });

  // إغلاق عند الضغط خارج النافذة
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  // حفظ العرض للمعاينة داخل الصفحة فقط
  form?.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const title = data.get("title");
    const type = data.get("property_type");
    const area = data.get("area") || "أسيوط";
    const price = Number(data.get("total_price") || 0);
    const down = Number(data.get("down_payment") || 0);
    const remaining = Number(
      data.get("remaining_installments") || 0
    );

    const card = document.createElement("article");
    card.className = "offer-card";

    const heading = document.createElement("h3");
    heading.textContent = title;

    const location = document.createElement("p");
    location.textContent = `${type} — ${area}`;

    const priceText = document.createElement("p");
    priceText.textContent =
      `السعر الإجمالي: ${price.toLocaleString("ar-EG")} ج.م`;

    const downText = document.createElement("p");
    downText.textContent =
      `المقدم: ${down.toLocaleString("ar-EG")} ج.م`;

    const remainingText = document.createElement("p");
    remainingText.textContent =
      `المتبقي: ${remaining.toLocaleString("ar-EG")} ج.م`;

    card.append(heading, location, priceText, downText, remainingText);
    grid?.prepend(card);

    if (status) {
      status.textContent =
        "تمت إضافة العرض للمعاينة المحلية فقط. لم يتم حفظه على الإنترنت.";
    }

    form.reset();
    dialog.close();
    document.getElementById("offers")?.scrollIntoView({
      behavior: "smooth"
    });
  });

  // البحث في العروض المعروضة
  document.getElementById("searchBtn")
    ?.addEventListener("click", () => {
      const query = (
        document.getElementById("searchInput")?.value || ""
      ).trim().toLowerCase();

      const type = document.getElementById("typeFilter")?.value || "";
      const area = document.getElementById("areaFilter")?.value || "";

      grid?.querySelectorAll(".offer-card").forEach((card) => {
        const text = card.textContent.toLowerCase();
        const matchesQuery = !query || text.includes(query);
        const matchesType = !type || text.includes(type);
        const matchesArea = !area || text.includes(area);

        card.hidden = !(
          matchesQuery && matchesType && matchesArea
        );
      });
    });

  // تصفية حسب نوع العقار
  document.querySelectorAll("[data-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-kind]").forEach((item) => {
        item.classList.remove("active");
      });

      button.classList.add("active");
      const kind = button.dataset.kind || "";

      grid?.querySelectorAll(".offer-card").forEach((card) => {
        card.hidden = !!kind && !card.textContent.includes(kind);
      });
    });
  });

  // تسجيل الدخول غير مفعّل حتى الآن
  document.getElementById("loginBtn")
    ?.addEventListener("click", () => {
      alert("تسجيل الدخول سيتم تفعيله في الخطوة التالية.");
    });
});
