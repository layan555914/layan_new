// ASYUT AQAR — shared header behaviour for every public page (2026-11-10).
// 1) Same main menu on every page (the current page is highlighted).
// 2) "لوحة الإدارة" appears at the start of the main menu for admins only (checked server-side by layan_is_admin).
// 3) The header never lets links and buttons overlap: on narrower desktops it first tightens spacing,
//    then moves the menu to its own row under the logo and buttons.
(function () {
  "use strict";
  const header = document.querySelector("header.topbar");
  if (!header) return;
  const nav = header.querySelector("nav");
  if (!nav) return;

  // ---------- 1) unified menu ----------
  const firstHref = (nav.querySelector("a") || {}).getAttribute?.("href") || "./";
  const prefix = /^\.\.\//.test(firstHref) ? "../" : "./";
  const LINKS = [
    ["", "الرئيسية", ["", "index.html"]],
    ["offers.html", "العقارات", ["offers.html", "property.html"]],
    ["marketplace.html", "سوق الخدمات", ["marketplace.html"]],
    ["companies.html", "الشركات", ["companies.html", "company.html"]],
    ["featured.html", "الإعلانات المميزة", ["featured.html"]],
    ["directory.html", "الدليل العقاري", ["directory.html"]],
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
    try { const s = JSON.parse(sessionStorage.getItem("layanSupabaseSession") || "null"); if (s?.access_token) return s; } catch (_) {}
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
