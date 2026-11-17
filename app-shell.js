// ASYUT AQAR app shell (every public page):
// 1) Bottom navigation on phones for pages that don't have one, so the installed app (which has
//    no browser back button) can always move between sections.
// 2) Keeps the installed app up to date: registers the service worker, checks for a new version
//    when the app comes back to the foreground, and reloads once when a new version takes over.
(() => {
  "use strict";
  if (window.__asyutShell) return;
  window.__asyutShell = true;
  // Load shared type and visual layers on public pages that use the app shell.
  const fontHosts = [
    ["https://fonts.googleapis.com", false],
    ["https://fonts.gstatic.com", true]
  ];
  fontHosts.forEach(([href, crossOrigin]) => {
    if (document.querySelector('link[rel="preconnect"][href="' + href + '"]')) return;
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    if (crossOrigin) link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  });
  if (!document.querySelector('link[data-asyut-font="ibm-plex-arabic"]')) {
    const font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap";
    font.dataset.asyutFont = "ibm-plex-arabic";
    document.head.appendChild(font);
  }
  if (!document.querySelector('link[data-asyut-typography="global"]')) {
    const type = document.createElement("link");
    type.rel = "stylesheet";
    type.href = "/assets/theme/sitewide-typography.css?v=20261116-1";
    type.dataset.asyutTypography = "global";
    document.head.appendChild(type);
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

  // Site-wide warmer, brighter brown palette and lighter surfaces.
  if (!document.querySelector('link[data-asyut-light-theme="global"]')) {
    const lightTheme = document.createElement("link");
    lightTheme.rel = "stylesheet";
    lightTheme.href = "/assets/theme/warm-light-theme.css?v=20261116-4";
    lightTheme.dataset.asyutLightTheme = "global";
    document.head.appendChild(lightTheme);
  }


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

  function rootPrefix() { return /\/(?:areas|ads)\//i.test(location.pathname) ? "../" : "./"; }
  function currentReturnPath() {
    if (location.pathname === "/" || /\/index\.html$/i.test(location.pathname)) return "";
    return location.pathname + location.search + location.hash;
  }
  function authEntryUrl(mode) {
    const returnPath = currentReturnPath();
    return rootPrefix() + "index.html?auth=" + mode + (returnPath ? "&return=" + encodeURIComponent(returnPath) : "");
  }
  function loadAccountScript(src, ready) {
    if (ready()) return Promise.resolve();
    return new Promise(resolve => {
      const script = document.createElement("script");
      script.src = src; script.onload = resolve; script.onerror = resolve; document.head.appendChild(script);
    });
  }
  function ensureAccountProfile() {
    if (window.__asyutAccountProfilePromise) return window.__asyutAccountProfilePromise;
    window.__asyutAccountProfilePromise = (async () => {
      const prefix = rootPrefix();
      if (!window.LAYAN_CONFIG) await loadAccountScript(prefix + "config.js", () => Boolean(window.LAYAN_CONFIG));
      if (!window.LAYAN_SUPABASE) await loadAccountScript(prefix + "gubabase.js", () => Boolean(window.LAYAN_SUPABASE));
      if (!window.__asyutAccountProfile) await loadAccountScript(prefix + "account-profile.js", () => Boolean(window.__asyutAccountProfile));
    })().catch(error => console.warn("Account profile reminder unavailable:", error));
    return window.__asyutAccountProfilePromise;
  }
  function authSession() {
    try { return window.LAYAN_SUPABASE?.getSession?.() || JSON.parse(sessionStorage.getItem("layanSupabaseSession") || "null"); }
    catch (_) { return null; }
  }
  function mountAuthEntry() {
    const header = document.querySelector("header.topbar");
    if (!header) return;
    let actions = header.querySelector(".top-actions");
    if (!actions) { actions = document.createElement("div"); actions.className = "top-actions aa-auth-actions"; header.appendChild(actions); }
    if (!document.querySelector("#loginBtn, #authOpen") && !actions.querySelector("[data-asyut-auth-login]")) {
      const login = document.createElement("a");
      login.className = "btn btn-outline"; login.dataset.asyutAuthLogin = "1"; login.textContent = "تسجيل الدخول";
      actions.appendChild(login);
    }
    if (!actions.querySelector("[data-asyut-auth-signup]")) {
      const signup = document.createElement("a");
      signup.className = "btn btn-gold"; signup.dataset.asyutAuthSignup = "1"; signup.textContent = "إنشاء حساب جديد";
      actions.appendChild(signup);
    }
    const loggedIn = Boolean(authSession()?.access_token);
    const login = actions.querySelector("[data-asyut-auth-login]");
    const signup = actions.querySelector("[data-asyut-auth-signup]");
    if (login) { login.textContent = loggedIn ? "حسابي" : "تسجيل الدخول"; login.href = loggedIn ? rootPrefix() + "my-listings.html" : authEntryUrl("login"); }
    if (signup) { signup.href = authEntryUrl("signup"); signup.hidden = loggedIn; }
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

  const start = () => {
    mountNav(); keepUpdated(); mountMyListings(); mountAuthEntry(); ensureAccountProfile();
    const refresh = () => { mountMyListings(); mountAuthEntry(); };
    window.addEventListener("layan:auth-ready", refresh);
    window.addEventListener("layan-auth-state-changed", refresh);
    window.addEventListener("focus", refresh);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
