// Advertiser page header (advertiser.html?id=<owner>): name, listings count and contact buttons
// built from the advertiser's published listings. The grid itself is filtered by app.js.
(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const id = String(params.get("id") || "").trim();
  const brandName = String(params.get("name") || "").trim().replace(/\s+/g, " ");
  const key = n => String(n || "").trim().replace(/\s+/g, " ").toLowerCase();
  const nameOf = o => String(o.contact_name || o.developer_name || "").trim().replace(/\s+/g, " ");
  const $ = x => document.getElementById(x);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const paint = () => {
    // Same account AND same advertiser name: one account that posts for several companies gets one page per company.
    const rows = (window.ASYUT_OFFERS || []).filter(o => String(o.owner_id || "") === id && (!brandName || key(nameOf(o)) === key(brandName)));
    if (!id || !rows.length) {
      $("advertiserName").textContent = "لا توجد إعلانات منشورة لهذا المعلن";
      $("advertiserMeta").innerHTML = 'ربما بيعت العقارات أو أُوقفت الإعلانات. <a href="./offers.html">تصفح كل العقارات</a>';
      return;
    }
    const name = brandName || nameOf(rows.find(o => nameOf(o)) || {}) || "معلن على أسيوط عقار";
    const phone = String(rows.find(o => o.contact_phone)?.contact_phone || "").replace(/[^0-9]/g, "");
    const since = rows.map(o => new Date(o.created_at || 0)).filter(d => !isNaN(d)).sort((a, b) => a - b)[0];
    const badge = rows.find(o => o.trust_badge)?.trust_badge;
    document.title = name + " | إعلانات المعلن | أسيوط عقار";
    $("advertiserName").textContent = name;
    const avatar = $("advertiserAvatar");
    if (!avatar.classList.contains("has-logo")) avatar.textContent = name.replace(/^ال/, "").charAt(0) || "أ";
    avatar.setAttribute("data-owner-avatar", id);
    avatar.setAttribute("data-brand", name);
    $("advertiserMeta").innerHTML = `<b>${rows.length}</b> ${rows.length === 1 ? "إعلان منشور" : "إعلانات منشورة"}` +
      (since ? ` · على أسيوط عقار منذ ${esc(since.toLocaleDateString("ar-EG-u-nu-latn", { month: "long", year: "numeric" }))}` : "") +
      (badge === "owner" ? ' · <span class="trust-badge">مالك موثّق</span>' : badge === "company" ? ' · <span class="trust-badge trust-badge-company">شركة موثّقة</span>' : "");
    if (/^01[0125][0-9]{8}$/.test(phone)) {
      $("advertiserActions").innerHTML = `<a class="btn btn-gold" href="tel:${phone}" data-contact="call">اتصال</a><a class="btn btn-outline" href="https://wa.me/2${phone}?text=${encodeURIComponent("مرحبًا، رأيت إعلاناتك على أسيوط عقار.")}" target="_blank" rel="noopener noreferrer" data-contact="whatsapp">واتساب</a>`;
    }
  };
  window.addEventListener("asyut:offers-loaded", paint);
  if (window.ASYUT_OFFERS) paint();
})();
