// ASYUT AQAR app shell (every public page):
// 1) Bottom navigation on phones for pages that don't have one, so the installed app (which has
//    no browser back button) can always move between sections.
// 2) Keeps the installed app up to date: registers the service worker, checks for a new version
//    when the app comes back to the foreground, and reloads once when a new version takes over.
(() => {
  "use strict";
  if (window.__asyutShell) return;
  window.__asyutShell = true;

  const ITEMS = [
    { href: "./", match: /^\/?(index\.html)?$/, icon: "⌂", label: "الرئيسية" },
    { href: "./offers.html", match: /offers|property|advertiser|areas\/|ads\//, icon: "▦", label: "العقارات" },
    { href: "./marketplace.html", match: /marketplace|companies|company|directory/, icon: "◇", label: "الخدمات" },
    { href: "./favorites.html", match: /favorites|my-listings/, icon: "☆", label: "المفضلة" }
  ];

  function mountNav() {
    if (document.querySelector(".mobile-nav") || document.body.classList.contains("no-appnav")) return;
    const path = location.pathname.replace(/^\/+/, "");
    const nav = document.createElement("nav");
    nav.className = "mobile-nav aa-appnav";
    nav.setAttribute("aria-label", "التنقل السريع");
    nav.innerHTML = ITEMS.map(item => {
      const current = item.match.test(path);
      return `<a href="${item.href}"${current ? ' aria-current="page" class="is-current"' : ""}><span aria-hidden="true">${item.icon}</span><small>${item.label}</small></a>`;
    }).join("") + '<button type="button" class="aa-appnav-add"><span aria-hidden="true">＋</span><small>أضف عرضك</small></button>';
    nav.querySelector(".aa-appnav-add").addEventListener("click", () => {
      const opener = document.querySelector("#addOfferTop, [data-open-add-offer], #heroAdd");
      if (opener) opener.click(); else location.href = "./?add=1";
    });
    document.body.appendChild(nav);
    document.body.classList.add("has-appnav");
  }

  function keepUpdated() {
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // A new version took over: reload once so the page uses the new files.
      if (!hadController || reloaded) return;
      reloaded = true;
      location.reload();
    });
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).then(registration => {
      const check = () => registration.update().catch(() => {});
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
      setInterval(check, 30 * 60 * 1000);
    }).catch(() => {});
  }

  // «إعلاناتي» beside the top menu for signed-in users (index.html has its own button).
  function signedIn() {
    try {
      const s = JSON.parse(sessionStorage.getItem("layanSupabaseSession") || "null");
      return Boolean(s && s.access_token && (!s.expires_at || s.expires_at * 1000 > Date.now() - 7 * 24 * 3600 * 1000));
    } catch (_) { return false; }
  }
  function mountMyListings() {
    const nav = document.querySelector(".topbar nav, header nav");
    if (!nav) return;
    let link = document.querySelector(".aa-my-listings");
    const show = signedIn() && !document.getElementById("myListingsLink");
    if (!show) { if (link) link.hidden = true; return; }
    if (!link) {
      link = document.createElement("a");
      link.className = "aa-my-listings";
      link.href = "./my-listings.html";
      link.textContent = "إعلاناتي";
      if (/my-listings/.test(location.pathname)) link.setAttribute("aria-current", "page");
      nav.insertAdjacentElement("afterend", link);
    }
    link.hidden = false;
  }

  const start = () => { mountNav(); keepUpdated(); mountMyListings(); window.addEventListener("layan:auth-ready", mountMyListings); window.addEventListener("layan-auth-state-changed", mountMyListings); window.addEventListener("focus", mountMyListings); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
