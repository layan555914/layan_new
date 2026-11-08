// Organizes the add-listing form into clear numbered sections and adds a first step
// "what do you want to add?" (property / service / company). Only moves existing fields:
// names, IDs and submit logic in app.js stay exactly the same.
(() => {
  "use strict";
  const form = document.getElementById("offerForm");
  const dialog = document.getElementById("offerDialog");
  if (!form || !dialog || form.dataset.organized) return;
  form.dataset.organized = "1";

  const field = name => form.querySelector(`[name="${name}"]`)?.closest("label, fieldset, details") || null;
  const byId = id => document.getElementById(id);
  const section = (step, title, hint, nodes, extraClass = "") => {
    const box = document.createElement("fieldset");
    box.className = "lf-section " + extraClass;
    box.innerHTML = `<legend><span class="lf-step">${step}</span>${title}</legend>${hint ? `<p class="lf-hint">${hint}</p>` : ""}<div class="lf-grid"></div>`;
    const grid = box.querySelector(".lf-grid");
    nodes.filter(Boolean).forEach(node => grid.appendChild(node));
    return box;
  };

  // Step 0: choose what to add. Services and companies have their own reviewed forms.
  const chooser = document.createElement("div");
  chooser.className = "lf-chooser";
  chooser.innerHTML = `
    <p class="lf-chooser-title">ماذا تريد أن تضيف؟</p>
    <div class="lf-choices">
      <button type="button" class="lf-choice is-active" data-lf-kind="property"><b>عقار</b><small>بيع · إيجار · تنازل · أرض</small></button>
      <a class="lf-choice" href="./marketplace.html?add=1"><b>خدمة أو منتج</b><small>تشطيب · أثاث · مواد بناء · صيانة</small></a>
      <a class="lf-choice" href="./companies.html?resumeCompanyRegistration=1"><b>ملف شركة</b><small>شركة عقارية · مكتب · مطوّر</small></a>
    </div>`;

  const status = byId("formStatusMessage");
  const submit = form.querySelector('button[type="submit"]');
  const sections = [
    section(1, "نوع الإعلان والعقار", "اختر نوع المعاملة ونوع العقار، واكتب عنوانًا واضحًا مثل: شقة 145 م² تشطيب كامل.",
      [field("listing_purpose"), field("property_type"), field("title"), field("account_type"), byId("companyNameField")]),
    section(2, "الموقع", "المدينة أو المركز والحي. موقع الخريطة اختياري.",
      [field("city"), field("area"), form.querySelector("details.location-coordinates")]),
    section(3, "المواصفات", "",
      [field("area_m2"), field("bedrooms"), field("bathrooms"), field("developer_name"), field("project_name"), byId("landDetailsFields")]),
    section(4, "السعر وطريقة الدفع", "اكتب الأرقام بالجنيه بدون فواصل. في التنازل اكتب المقدم والمدفوع والمتبقي والقسط.",
      [field("total_price"), field("down_payment"), field("paid_amount"), field("remaining_installments"), field("monthly_installment"), field("transfer_fee"), field("discount_amount"), field("discount_percent")], "lf-money"),
    section(5, "الصور والمستندات", "صور واضحة نهارًا. يمكنك التصوير مباشرة بالكاميرا. المستندات خاصة للإدارة فقط.",
      [field("photos"), field("documents")]),
    section(6, "التواصل والوصف", "",
      [field("contact_name"), field("contact_phone"), field("contact_consent"), field("description"), field("promotion_plan")])
  ];
  form.prepend(chooser);
  if (status) chooser.after(status);
  let anchor = status || chooser;
  sections.forEach(box => { anchor.after(box); anchor = box; });
  // Anything not placed above (future fields) stays at the end, before the submit button.
  if (submit) form.appendChild(submit);
  submit?.classList.add("lf-submit");

  // Show assignment-only money fields when the deal is an assignment.
  const purpose = form.querySelector('[name="listing_purpose"]');
  const assignmentOnly = ["paid_amount", "remaining_installments", "transfer_fee"].map(field).filter(Boolean);
  const paintPurpose = () => {
    const isAssignment = /تنازل/.test(purpose?.value || "");
    assignmentOnly.forEach(node => node.classList.toggle("lf-muted", !isAssignment));
  };
  purpose?.addEventListener("change", paintPurpose);
  paintPurpose();

  const title = dialog.querySelector(".dialog-header h2");
  if (title) title.textContent = "أضف إعلانك مجانًا";
})();
