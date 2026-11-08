// ASYUT AQAR admin — «تعديلات على إعلانات منشورة»: owners' edits to published listings.
// Shows the current (published) value next to the proposed one; approve applies it, reject keeps
// the published version and sends the reason back to the owner. Server checks admin rights.
(() => {
  "use strict";
  const LABELS = {
    title: "العنوان", listing_purpose: "نوع الإعلان", property_type: "نوع العقار", city: "المدينة / المركز", area: "الحي / المنطقة",
    area_m2: "المساحة م²", bedrooms: "غرف النوم", bathrooms: "الحمامات", total_price: "السعر", down_payment: "المقدم", paid_amount: "المدفوع",
    remaining_amount: "المتبقي", monthly_installment: "القسط الشهري", remaining_installments: "الأقساط المتبقية", assignment_fee: "رسوم التنازل",
    discount_amount: "الخصم", developer_name: "المطور", project_name: "المشروع", contact_name: "اسم التواصل", contact_phone: "رقم التواصل",
    land_area_m2: "مساحة الأرض", land_zoning: "استخدام الأرض", description: "الوصف", image_urls: "الصور", category: "القسم", listing_type: "نوع الخدمة",
    price: "السعر", price_period: "فترة السعر", whatsapp: "واتساب", details: "تفاصيل القسم", latitude: "خط العرض", longitude: "خط الطول"
  };
  let A = null;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rpc = (name, body = {}) => A.request("/rest/v1/rpc/" + name, { method: "POST", body: JSON.stringify(body) });

  function value(k, v) {
    if (v == null || v === "") return '<span class="adm-edit-none">—</span>';
    if (k === "image_urls" && Array.isArray(v)) {
      return '<div class="adm-edit-imgs">' + v.filter(u => typeof u === "string").map((u, i) => '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" alt="صورة ' + (i + 1) + '" loading="lazy">' + (i === 0 ? "<small>الغلاف</small>" : "") + "</a>").join("") + "</div>";
    }
    if (typeof v === "object") return esc(Object.entries(v).map(([a, b]) => a.replace(/_/g, " ") + ": " + b).join(" · "));
    return esc(v);
  }

  function card(r) {
    const keys = Object.keys(r.proposed || {});
    return '<article class="admin-ad adm-edit" data-edit-kind="' + esc(r.kind) + '" data-edit-id="' + esc(r.id) + '"><div>' +
      '<span class="admin-chip">' + (r.kind === "offer" ? "عقار" : "خدمة") + " · كود " + esc(r.id).slice(0, 8) + "</span><h2>" + esc(r.title) + "</h2>" +
      "<p><strong>صاحب الإعلان:</strong> " + esc(r.owner_email || "—") + " · <strong>أُرسل:</strong> " + (r.requested_at ? new Date(r.requested_at).toLocaleString("ar-EG") : "—") + "</p>" +
      '<div class="admin-table-wrap"><table class="admin-table adm-edit-table"><thead><tr><th>الخانة</th><th>المنشور حاليًا</th><th>التعديل المطلوب</th></tr></thead><tbody>' +
      keys.map(k => '<tr><td data-label="الخانة">' + esc(LABELS[k] || k) + '</td><td data-label="المنشور حاليًا">' + value(k, (r.current || {})[k]) + '</td><td data-label="التعديل المطلوب" class="is-new">' + value(k, r.proposed[k]) + "</td></tr>").join("") +
      "</tbody></table></div></div>" +
      '<div class="admin-actions"><button type="button" class="btn btn-gold" data-edit-action="approve">اعتماد التعديل ونشره</button><button type="button" class="btn btn-outline-dark" data-edit-action="reject">رفض مع السبب</button></div></article>';
  }

  async function load() {
    const box = document.getElementById("pendingListingEdits");
    if (!box || !A) return;
    box.innerHTML = '<p class="admin-empty">جارٍ التحميل...</p>';
    try {
      const rows = await rpc("layan_admin_list_pending_edits") || [];
      box.innerHTML = rows.length ? rows.map(card).join("") : '<p class="admin-empty">لا توجد تعديلات تنتظر الاعتماد.</p>';
      const stat = document.getElementById("statPendingEdits"); if (stat) stat.textContent = rows.length;
    } catch (e) {
      box.innerHTML = /PGRST202|Could not find|404/.test(String(e.message)) ? '<p class="admin-empty admin-pending">هذه الخاصية تحتاج تطبيق تحديث قاعدة البيانات «تعديلات أصحاب الإعلانات» (20261108200000).</p>' : '<p class="admin-empty">' + esc(e.message) + "</p>";
    }
  }

  document.addEventListener("click", async e => {
    const btn = e.target.closest("[data-edit-action]"); if (!btn || !A) return;
    const art = btn.closest("[data-edit-id]"), approve = btn.dataset.editAction === "approve";
    let notes = null;
    if (!approve) { notes = prompt("سبب رفض التعديل (يصل لصاحب الإعلان):"); if (!notes || !notes.trim()) return; }
    btn.disabled = true;
    try {
      await rpc("layan_admin_review_edit", { p_kind: art.dataset.editKind, p_id: art.dataset.editId, p_approve: approve, p_notes: notes });
      A.setStatus(approve ? "تم اعتماد التعديل ونشره." : "تم رفض التعديل وإبلاغ صاحب الإعلان بالسبب. النسخة المنشورة لم تتغير.");
      load();
    } catch (err) { A.setStatus(err.message || "تعذر تنفيذ الإجراء."); btn.disabled = false; }
  });

  window.addEventListener("asyut:admin-ready", () => { A = window.AsyutAdmin; load(); });
  document.addEventListener("click", e => { if (e.target.closest("#adminRefreshAll")) setTimeout(load, 400); });
})();
