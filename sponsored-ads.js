// ASYUT AQAR — premium sponsored-ad card + official sponsors section (home page).
// Shared by sponsor.js (home/offers grid) and featured.js. Data only from admin-approved rows:
//   public_active_supplier_ads (status active, not expired) and platform_sponsors (active, in date range).
(function () {
  "use strict";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const httpUrl = value => {
    try { const u = new URL(String(value || "")); return ["https:", "http:"].includes(u.protocol) ? u.href : ""; } catch (_) { return ""; }
  };
  const initial = name => (String(name || "").trim().match(/[\p{L}\p{N}]/u) || ["★"])[0].toUpperCase();
  const phoneNumbers = value => [...new Set(String(value || "").split(/[;,،|\/\r\n]+/u)
    .map(phone => phone.trim().replace(/[^+0-9]/g, ""))
    .filter(phone => {
      const digits = phone.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15;
    }))];
  const telNumber = phone => {
    let digits = String(phone || "").replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("0") && digits.length === 11) digits = "2" + digits;
    return digits.startsWith("20") ? "+" + digits : digits;
  };
  const waNumber = phone => {
    const tel = telNumber(phone).replace(/\D/g, "");
    return tel.length >= 10 ? tel : "";
  };

  function renderAd(ad, options = {}) {
    const image = httpUrl(ad.image_url);
    const target = httpUrl(ad.target_url);
    const phones = phoneNumbers(ad.contact_phone);
    const description = String(ad.description || "")
      .replace(/\s*(?:للتواصل|للاتصال)\s*[:：]?\s*(?:[+＋]?[\d٠-٩\s().,،;\/|-]+)?[.!،]?\s*$/u, "")
      .trim();
    const phoneActions = phones.length
      ? '<div class="sp-ad-phone-list" aria-label="أرقام التواصل">' + phones.map(phone => {
          const tel = telNumber(phone);
          const wa = waNumber(phone);
          const displayPhone = esc(phone.replace(/[^+0-9]/g, ""));
          const call = tel ? '<a class="sp-ad-btn sp-ad-call-btn" href="tel:' + esc(tel) + '">اتصال <bdi dir="ltr">' + displayPhone + '</bdi></a>' : "";
          const whatsapp = wa ? '<a class="sp-ad-btn sp-ad-btn-wa" href="https://wa.me/' + wa + '?text=' + encodeURIComponent("مرحبًا، شاهدت إعلانكم «" + (ad.title || ad.business_name || "إعلان ممول") + "» على أسيوط عقار.") + '" target="_blank" rel="noopener noreferrer" aria-label="واتساب ' + esc(ad.business_name || ad.title || "إعلان ممول") + ' — ' + displayPhone + '">واتساب</a>' : "";
          return '<div class="sp-ad-phone-row">' + call + whatsapp + '</div>';
        }).join("") + '</div>'
      : "";
    const name = ad.business_name || ad.title || "إعلان ممول";
    const media = image
      ? '<img src="' + esc(image) + '" alt="' + esc(name) + '" loading="lazy" referrerpolicy="no-referrer">'
      : '<div class="sp-ad-monogram" aria-hidden="true"><span>' + esc(initial(name)) + '</span><small>' + esc(name) + '</small></div>';
    const actions = [
      target ? '<a class="sp-ad-btn sp-ad-btn-primary" href="' + esc(target) + '" target="_blank" rel="noopener noreferrer sponsored">اعرف التفاصيل</a>' : "",
      phoneActions
    ].filter(Boolean).join("");
    const extraClass = options.className ? " " + options.className : "";
    const extraAttr = options.attr ? " " + options.attr : "";
    return '<article class="offer-card sponsor-card sp-ad' + extraClass + '" data-sponsor-card="' + esc(ad.id) + '"' + extraAttr + '>' +
      '<div class="sp-ad-media">' + media + '<span class="sp-ad-badge"><i aria-hidden="true">★</i> إعلان مميز</span></div>' +
      '<div class="sp-ad-body">' +
        '<div class="sp-ad-brand"><span class="sp-ad-avatar" aria-hidden="true">' + esc(initial(name)) + '</span>' +
          '<div><strong>' + esc(name) + '</strong><small>' + esc(ad.category || "إعلانات الأنشطة") + ' · <b>مساحة إعلانية</b></small></div></div>' +
        '<h3>' + esc(ad.title || ad.business_name || "إعلان ممول") + '</h3>' +
        (description ? '<p class="sp-ad-desc">' + esc(description).replace(/\r?\n/g, "<br>") + '</p>' : "") +
        '<div class="sp-ad-actions">' + (actions || '<a class="sp-ad-btn sp-ad-btn-primary" href="./advertise.html">تفاصيل الإعلان</a>') + '</div>' +
      '</div></article>';
  }

  // ---------- Official sponsors (home page) ----------
  function logoSrc(value) {
    const v = String(value || "");
    if (/^\.\/assets\/[\w./?=-]+$/.test(v)) return v;
    return httpUrl(v);
  }
  function officialCard(s, index) {
    const link = httpUrl(s.link_url);
    const logo = logoSrc(s.logo_url);
    const label = s.link_label || "زيارة صفحة الراعي";
    const logoHtml = logo ? '<img src="' + esc(logo) + '" alt="شعار ' + esc(s.name) + '" width="150" height="150" loading="' + (index ? "lazy" : "eager") + '" referrerpolicy="no-referrer">' : '<span class="official-sponsor-monogram">' + esc(initial(s.name)) + '</span>';
    const logoBox = link
      ? '<a class="osx-logo" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(label) + '">' + logoHtml + '</a>'
      : '<div class="osx-logo">' + logoHtml + '</div>';
    return '<article class="osx-card os-premium" data-sponsor-id="' + esc(s.id) + '">' +
      logoBox +
      '<div class="osx-copy">' +
        '<span class="osx-kicker"><i aria-hidden="true">★</i>' + esc(s.kicker || "الراعي الرسمي لمنصة أسيوط عقار") + '</span>' +
        '<h2' + (index ? "" : ' id="officialSponsorTitle"') + '>' + esc(s.name) + '</h2>' +
        (s.tagline ? '<p>' + esc(s.tagline) + '</p>' : "") +
        (s.subline ? '<span class="osx-sub">' + esc(s.subline) + '</span>' : "") +
      '</div>' +
      (link ? '<div class="osx-cta"><a class="osx-link" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + ' <span aria-hidden="true">↗</span></a><small>شكرًا لدعمكم مسيرة أسيوط عقار</small></div>' : "") +
    '</article>';
  }
  const sectionHead = '<header class="osx-head"><span class="osx-eyebrow">بدعم ورعاية</span></header>';
  function partnerChip(s) {
    const link = httpUrl(s.link_url);
    const logo = logoSrc(s.logo_url);
    const inner = '<span class="os-partner-logo">' + (logo ? '<img src="' + esc(logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : esc(initial(s.name))) + '</span>' +
      '<span class="os-partner-text"><strong>' + esc(s.name) + '</strong>' + (s.tagline ? '<small>' + esc(s.tagline) + '</small>' : "") + '</span>';
    return link ? '<a class="os-partner" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>' : '<div class="os-partner">' + inner + '</div>';
  }
  async function loadOfficialSponsors() {
    const section = document.getElementById("official-sponsor");
    const cfg = window.LAYAN_CONFIG || {};
    const base = String(cfg.SUPABASE_URL || "").replace(/\/$/, ""), key = cfg.SUPABASE_PUBLISHABLE_KEY || "";
    if (!section || !base || !key) return;
    try {
      const r = await fetch(base + "/rest/v1/platform_sponsors?select=id,name,tier,kicker,tagline,subline,logo_url,link_url,link_label,sort_order&order=sort_order.asc,created_at.asc", {
        headers: { apikey: key, Authorization: "Bearer " + key }
      });
      if (!r.ok) return; // table not deployed yet: keep the static sponsor already in the page
      const rows = await r.json();
      if (!Array.isArray(rows)) return;
      const officials = rows.filter(s => s.tier !== "partner");
      const partners = rows.filter(s => s.tier === "partner");
      if (!officials.length && !partners.length) { section.hidden = true; return; }
      section.hidden = false;
      section.innerHTML = (officials.length ? sectionHead : "") + officials.map(officialCard).join("") +
        (partners.length ? '<div class="os-partners"><p class="os-partners-title"><span>شركاء النجاح</span></p><div class="os-partners-row">' + partners.map(partnerChip).join("") + '</div></div>' : "");
      section.classList.add("is-live", "osx-section");
    } catch (_) { /* keep static fallback */ }
  }

  window.AsyutSponsoredAd = { render: renderAd };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadOfficialSponsors);
  else loadOfficialSponsors();
})();
