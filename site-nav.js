// ASYUT AQAR — shared header behaviour for every public page (2026-11-10).
// 1) Same main menu on every page (the current page is highlighted).
// 2) "لوحة الإدارة" appears at the start of the main menu for admins only (checked server-side by layan_is_admin).
// 3) The header never lets links and buttons overlap: on narrower desktops it first tightens spacing,
//    then moves the menu to its own row under the logo and buttons.
(function () {
  "use strict";
  // ---------- 0) unified typography on every page using the shared navigation script ----------
  const fontPreconnect = "https://fonts.googleapis.com";
  const fontOrigin = "https://fonts.gstatic.com";
  if (!document.querySelector('link[rel="preconnect"][href="' + fontPreconnect + '"]')) {
    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = fontPreconnect;
    document.head.appendChild(preconnect);
  }
  if (!document.querySelector('link[rel="preconnect"][href="' + fontOrigin + '"]')) {
    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = fontOrigin;
    preconnect.crossOrigin = "anonymous";
    document.head.appendChild(preconnect);
  }
  if (!document.querySelector('link[data-asyut-font="ibm-plex-arabic"]')) {
    const font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap";
    font.dataset.asyutFont = "ibm-plex-arabic";
    document.head.appendChild(font);
  }
  if (!document.querySelector('link[data-asyut-typography="global"]')) {
    const typography = document.createElement("link");
    typography.rel = "stylesheet";
    typography.href = "/assets/theme/sitewide-typography.css?v=20261116-1";
    typography.dataset.asyutTypography = "global";
    document.head.appendChild(typography);
  }
  if (!document.querySelector('link[data-asyut-visual="global"]')) {
    const visual = document.createElement("link");
    visual.rel = "stylesheet";
    visual.href = "/assets/theme/visual-refresh.css?v=20261116-1";
    visual.dataset.asyutVisual = "global";
    document.head.appendChild(visual);
  }

  // Shared licensed stock-photo covers (decorative only; never used as listing/company proof photos).
  if (!document.querySelector('link[data-asyut-photos="covers"]')) {
    const photos = document.createElement("link");
    photos.rel = "stylesheet";
    photos.href = "/assets/theme/photo-covers.css?v=20261116-2";
    photos.dataset.asyutPhotos = "covers";
    document.head.appendChild(photos);
  }
  if (!document.querySelector('link[rel="preconnect"][href="https://images.pexels.com"]')) {
    const photoOrigin = document.createElement("link");
    photoOrigin.rel = "preconnect";
    photoOrigin.href = "https://images.pexels.com";
    photoOrigin.crossOrigin = "anonymous";
    document.head.appendChild(photoOrigin);
  }

  // Temporary approved homepage-villa fallback for empty brown image slots only.
  if (!document.querySelector('link[data-asyut-empty-photo-fallback="global"]')) {
    const emptyPhotoFallback = document.createElement("link");
    emptyPhotoFallback.rel = "stylesheet";
    emptyPhotoFallback.href = "/assets/theme/empty-image-villa-fallback.css?v=20261116-1";
    emptyPhotoFallback.dataset.asyutEmptyPhotoFallback = "global";
    document.head.appendChild(emptyPhotoFallback);
  }

  // Site-wide warmer, brighter brown palette and lighter surfaces.
  if (!document.querySelector('link[data-asyut-light-theme="global"]')) {
    const lightTheme = document.createElement("link");
    lightTheme.rel = "stylesheet";
    lightTheme.href = "/assets/theme/warm-light-theme.css?v=20261116-5";
    lightTheme.dataset.asyutLightTheme = "global";
    document.head.appendChild(lightTheme);
  }

  // Shared brighter clarity layer across every page using the common navigation script.
  if (!document.querySelector('link[data-asyut-clarity="global"]')) {
    const clarity = document.createElement("link");
    clarity.rel = "stylesheet";
    clarity.href = "/assets/theme/unified-bright-clarity.css?v=20261118-brand-identity-1";
    clarity.dataset.asyutClarity = "global";
    document.head.appendChild(clarity);
  }
  // Shared component foundation is intentionally loaded last.
  if (!document.querySelector('link[data-asyut-design-foundation="global"]')) {
    const designSystem = document.createElement("link");
    designSystem.rel = "stylesheet";
    designSystem.href = "/assets/theme/design-system.css?v=20261118-brand-identity-1";
    designSystem.dataset.asyutDesignFoundation = "global";
    document.head.appendChild(designSystem);
  }

  // Final platform-wide colour layer: loaded after page styles and shared components.
  if (!document.querySelector('link[data-asyut-unified-theme="global"]')) {
    const platformTheme = document.createElement("link");
    platformTheme.rel = "stylesheet";
    platformTheme.href = "/assets/theme/platform-unified-theme.css?v=20261118-1";
    platformTheme.dataset.asyutUnifiedTheme = "global";
    document.head.appendChild(platformTheme);
  }

  const header = document.querySelector("header.topbar");
  if (!header) return;
  const nav = header.querySelector("nav");
  if (!nav) return;

  // Final brighter villa identity: same brand family, shared background, typography and photo fallbacks.
  if (!document.querySelector('link[data-asyut-villa-bright="global"]')) {
    const villaBright = document.createElement("link");
    villaBright.rel = "stylesheet";
    villaBright.href = "/assets/theme/villa-bright-unified.css?v=20261120-1";
    villaBright.dataset.asyutVillaBright = "global";
    document.head.appendChild(villaBright);
  }

  // ---------- 1) unified menu ----------
  const firstHref = (nav.querySelector("a") || {}).getAttribute?.("href") || "./";
  const prefix = /^\.\.\//.test(firstHref) ? "../" : "./";
  const LINKS = [
    ["", "الرئيسية", ["", "index.html"]],
    ["offers.html", "العقارات", ["offers.html", "property.html"]],
    ["marketplace.html", "سوق الخدمات", ["marketplace.html"]],
    ["companies.html", "الشركات العقارية", ["companies.html", "company.html"]],
    ["featured.html", "الإعلانات المميزة", ["featured.html"]],
    ["directory.html", "الدليل العقاري", ["directory.html"]],
    ["know-more.html", "اعرف أكثر", ["know-more.html"]],
    ["favorites.html", "المفضلة", ["favorites.html"]]
  ];
  const inAreas = /\/areas\//.test(location.pathname);
  const page = inAreas ? "areas" : (location.pathname.split("/").pop() || "");
  const existingActive = nav.querySelector("a.active, a[aria-current='page']");
  const activeHref = existingActive ? (existingActive.getAttribute("href") || "").replace(/^\.\.?\//, "") : null;
  const frag = document.createDocumentFragment();
  LINKS.forEach(([href, label, pages]) => {
    const a = document.createElement("a");
    a.href = prefix + href;
    a.textContent = label;
    const isActive = activeHref !== null ? activeHref === href : pages.includes(page);
    if (isActive) { a.className = "active"; a.setAttribute("aria-current", "page"); }
    frag.appendChild(a);
  });
  nav.replaceChildren(frag);

  // ---------- 2) admin entry at the start of the main menu ----------
  let admin = document.getElementById("adminDashboardLink");
  if (!admin) {
    admin = document.createElement("a");
    admin.id = "adminDashboardLink";
    admin.hidden = true;
  }
  admin.className = "nav-admin";
  admin.href = prefix + "admin.html";
  admin.innerHTML = '<i aria-hidden="true">★</i>لوحة الإدارة';
  nav.prepend(admin);
  // admin-entry.js (on some pages) may also reveal it; both use the same server check.

  const cfg = window.LAYAN_CONFIG || {};
  const base = String(cfg.SUPABASE_URL || "").replace(/\/$/, "");
  const key = cfg.SUPABASE_PUBLISHABLE_KEY || "";
  function readSession() {
    try { const s = window.LAYAN_SUPABASE?.getSession?.(); if (s?.access_token) return s; } catch (_) {}
    for (const storage of [window.localStorage, window.sessionStorage]) {
      try { const s = JSON.parse(storage.getItem("layanSupabaseSession") || "null"); if (s?.access_token) return s; } catch (_) {}
    }
    return null;
  }
  let checking = null;
  async function refreshAdmin() {
    const s = readSession();
    const uid = s?.user?.id;
    if (!uid || !base || !key) { admin.hidden = true; fit(); return; }
    const cacheKey = "layanIsAdmin:" + uid;
    let cached = null;
    try { cached = sessionStorage.getItem(cacheKey); } catch (_) {}
    if (cached === "1") { admin.hidden = false; fit(); }
    if (checking) return checking;
    checking = (async () => {
      try {
        const r = await fetch(base + "/rest/v1/rpc/layan_is_admin", {
          method: "POST",
          headers: { apikey: key, Authorization: "Bearer " + s.access_token, "Content-Type": "application/json" },
          body: "{}"
        });
        if (!r.ok) return;
        const ok = (await r.json()) === true;
        admin.hidden = !ok;
        try { sessionStorage.setItem(cacheKey, ok ? "1" : "0"); } catch (_) {}
      } catch (_) { /* keep current state */ }
      finally { checking = null; fit(); }
    })();
    return checking;
  }
  window.addEventListener("layan-auth-state-changed", refreshAdmin);
  window.addEventListener("layan:auth-ready", refreshAdmin);

  // ---------- 3) overlap-free fit ----------
  const DESKTOP = window.matchMedia("(min-width: 1181px)");
  function overlaps(a, b) {
    return !(a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1);
  }
  function crowded() {
    const actions = header.querySelector(".top-actions");
    const brand = header.querySelector(".brand");
    if (header.scrollWidth > header.clientWidth + 1 || nav.scrollWidth > nav.clientWidth + 1) return true;
    const navR = nav.getBoundingClientRect();
    const others = [brand, actions].filter(el => el && el.offsetParent !== null).map(el => el.getBoundingClientRect());
    if (others.some(r => overlaps(navR, r))) return true;
    const visibleLinks = [...nav.children].filter(el => el.offsetParent !== null);
    for (const el of visibleLinks) {
      const r = el.getBoundingClientRect();
      if (r.left < navR.left - 1 || r.right > navR.right + 1) return true;
    }
    return false;
  }
  let raf = 0;
  function fit() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      header.classList.remove("is-compact", "is-stacked");
      if (!DESKTOP.matches) return;
      if (!crowded()) return;
      header.classList.add("is-compact");
      if (!crowded()) return;
      header.classList.add("is-stacked");
    });
    // Keep elements positioned under the header (install banner, full-height hero) aligned with its real height.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const root = document.documentElement.style;
      if (header.classList.contains("is-stacked")) root.setProperty("--aa-topbar-h", header.offsetHeight + "px");
      else root.removeProperty("--aa-topbar-h");
    }));
  }
  window.addEventListener("resize", fit, { passive: true });
  DESKTOP.addEventListener?.("change", fit);
  if (document.fonts?.ready) document.fonts.ready.then(fit);
  window.addEventListener("load", fit);
  // Buttons appear/disappear after sign-in (إعلاناتي, تسجيل الخروج, ...): re-check the fit.
  new MutationObserver(fit).observe(header, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["hidden"] });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { refreshAdmin(); fit(); });
  else { refreshAdmin(); fit(); }
})();
