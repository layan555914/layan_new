// ASYUT AQAR admin layout: one view at a time, in the order of the daily workflow
// (1 today → 2 review → 3 owner approvals → 4 published → 5 customers → 6 visitors → 7 team).
// Data loading stays in admin.js / admin-console.js; this file only switches views.
(() => {
  "use strict";
  const shell = document.getElementById("adminConsole");
  if (!shell) return;
  const buttons = [...shell.querySelectorAll("[data-view]")];
  const views = Object.fromEntries([...shell.querySelectorAll("[data-view-panel]")].map(v => [v.dataset.viewPanel, v]));
  const TAB_OF = { today: "overview", requests: "requests", published: "listings", customers: "users", activity: "activity", team: "admins" };

  function show(name, anchor) {
    if (!views[name]) name = "today";
    Object.entries(views).forEach(([key, view]) => { view.hidden = key !== name; });
    buttons.forEach(b => b.toggleAttribute("aria-current", b.dataset.view === name));
    shell.querySelector(`[data-view="${name}"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
    if (TAB_OF[name] && window.AsyutConsole?.open) window.AsyutConsole.open(TAB_OF[name]);
    try { history.replaceState(null, "", "#" + name); } catch (_) {}
    const target = anchor && document.getElementById(anchor);
    (target || document.querySelector(".adm-main")).scrollIntoView({ behavior: "smooth", block: "start" });
  }

  shell.addEventListener("click", event => {
    const nav = event.target.closest("[data-view]");
    if (nav) { event.preventDefault(); show(nav.dataset.view); return; }
    const go = event.target.closest("[data-goto]");
    if (go) { show(go.dataset.goto, go.dataset.gotoAnchor); return; }
    const jump = event.target.closest(".adm-jump a");
    if (jump) { event.preventDefault(); document.querySelector(jump.getAttribute("href"))?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  });

  // Counters on the side navigation from the "today" numbers.
  const paintCounts = () => {
    const num = id => Number(document.getElementById(id)?.textContent) || 0;
    const review = ["statPendingProperties", "statPendingDocuments", "statPendingMarketplace", "statPendingEdits", "statPendingCompanies", "statPendingCompanyClaims", "statPendingCompanyEntityUpdates", "statPendingSupplierAds", "statPendingCompanyAds"].reduce((total, id) => total + num(id), 0);
    const badge = shell.querySelector('[data-count="review"]');
    if (badge) { badge.textContent = review; badge.hidden = !review; }
  };
  new MutationObserver(paintCounts).observe(document.getElementById("adminStats") || shell, { subtree: true, characterData: true, childList: true });

  // Phones: each table cell gets its column title so tables can show as stacked cards.
  const labelTables = () => shell.querySelectorAll("table").forEach(table => {
    const heads = [...table.querySelectorAll("thead th, tr:first-child th")].map(th => th.textContent.trim());
    if (!heads.length) return;
    table.querySelectorAll("tbody tr").forEach(tr => [...tr.children].forEach((td, i) => { if (td.tagName === "TD" && !td.hasAttribute("data-label")) td.setAttribute("data-label", heads[i] || ""); }));
  });
  let labelQueued = false;
  new MutationObserver(() => { if (labelQueued) return; labelQueued = true; requestAnimationFrame(() => { labelQueued = false; labelTables(); }); })
    .observe(shell, { childList: true, subtree: true });

  // Status messages show briefly as a toast, then clear themselves.
  const status = document.getElementById("adminStatus");
  let statusTimer;
  if (status) new MutationObserver(() => {
    if (!status.textContent.trim()) return;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { status.textContent = ""; }, 6000);
  }).observe(status, { childList: true, characterData: true, subtree: true });

  window.addEventListener("asyut:admin-ready", () => {
    document.body.classList.add("adm-signed-in");
    paintCounts();
    // Count published items for «لوحة اليوم» without opening the published view.
    window.AsyutConsole?.open && setTimeout(async () => {
      const el = document.querySelector("[data-published-total]");
      if (!el || el.textContent !== "—") return;
      try {
        const head = async path => { const r = await window.AsyutAdmin.request(path); return Array.isArray(r) ? r.length : 0; };
        const [o, m, c] = await Promise.all([
          head("/rest/v1/property_offers?select=id&status=in.(available,reserved,sold)").catch(() => 0),
          head("/rest/v1/marketplace_listings?select=id&status=eq.approved").catch(() => 0),
          head("/rest/v1/company_profiles_public?select=id").catch(() => 0)]);
        if (el.textContent === "—") el.textContent = o + m + c;
      } catch (_) {}
    }, 800);
    const start = (location.hash || "").slice(1);
    setTimeout(() => show(views[start] ? start : "today"), 0);
  });
  document.getElementById("adminLogout")?.addEventListener("click", () => {
    document.body.classList.remove("adm-signed-in");
    shell.hidden = true;
  });
})();
