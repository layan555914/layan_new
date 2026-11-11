// ASYUT AQAR — app mode (PWA): offline shell + the «تطبيق أسيوط عقار» install bar.
// The bar sits at the very top of the page (scrolls away with it). It shows only from the second page view,
// never inside the installed app, and once closed it stays away for 14 days.
// Android / Chrome: «تثبيت» opens the browser's own install window.
// iPhone / Safari (no install window for websites): «تثبيت» opens a two-step guide.
// Any element with [data-install-app] (for example the footer link) does the same.
(() => {
  "use strict";
  if (window.__asyutPwa) return;
  window.__asyutPwa = true;
  const banner = document.getElementById("installAppBanner");
  const installButton = document.getElementById("installAppBtn");
  const dismissButton = document.getElementById("dismissInstallBtn");
  const DISMISS_KEY = "asyutInstallDismissedAt";
  const VIEWS_KEY = "asyutPageViews";
  const DISMISS_DAYS = 14;
  let installPrompt = null;
  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const read = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { scope: "./" })
        .catch(error => console.error("ASYUT AQAR: تعذر تفعيل وضع التطبيق:", error));
    });
  }

  const views = (Number(read(VIEWS_KEY)) || 0) + 1;
  write(VIEWS_KEY, String(views));
  const recentlyDismissed = () => {
    const at = Number(read(DISMISS_KEY)) || 0;
    return at && Date.now() - at < DISMISS_DAYS * 864e5;
  };
  const canShow = () => banner && !isStandalone() && !recentlyDismissed() && views >= 2;
  const hide = () => { if (banner) banner.hidden = true; };
  const showBanner = () => { if (canShow()) banner.hidden = false; };

  if (isStandalone()) {
    hide();
    document.querySelectorAll("[data-install-app]").forEach(el => { (el.closest("li, p") || el).hidden = true; });
  } else if (isIOS) {
    showBanner(); // Safari never fires beforeinstallprompt; the button opens the guide
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    showBanner();
  });

  function guide() {
    let dialog = document.getElementById("installGuide");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "installGuide";
      dialog.className = "install-guide";
      dialog.setAttribute("aria-labelledby", "installGuideTitle");
      const share = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      const plus = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8.5v7M8.5 12h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      dialog.innerHTML = isIOS
        ? `<div class="install-guide-head"><img src="./assets/brand/icon-192.png" alt="" width="48" height="48"><div><h2 id="installGuideTitle">ثبّت تطبيق أسيوط عقار</h2><p>خطوتين من سفاري، وبعدها يفتح من شاشة موبايلك مباشرة.</p></div></div>
           <ol><li><span class="install-guide-ico">${share}</span><span>اضغط زر <b>المشاركة</b> أسفل الشاشة (أو أعلاها في الآيباد).</span></li>
               <li><span class="install-guide-ico">${plus}</span><span>اختر <b>«إضافة إلى الشاشة الرئيسية»</b> ثم <b>«إضافة»</b>.</span></li></ol>
           <button type="button" class="btn btn-gold" data-close-install-guide>تمام</button>`
        : `<div class="install-guide-head"><img src="./assets/brand/icon-192.png" alt="" width="48" height="48"><div><h2 id="installGuideTitle">ثبّت تطبيق أسيوط عقار</h2><p>من قائمة المتصفح، وبعدها يفتح من شاشة موبايلك مباشرة.</p></div></div>
           <ol><li><span class="install-guide-ico">⋮</span><span>افتح <b>قائمة المتصفح</b> (النقاط الثلاث).</span></li>
               <li><span class="install-guide-ico">${plus}</span><span>اختر <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>.</span></li></ol>
           <button type="button" class="btn btn-gold" data-close-install-guide>تمام</button>`;
      document.body.appendChild(dialog);
      dialog.addEventListener("click", event => {
        if (event.target === dialog || event.target.closest("[data-close-install-guide]")) dialog.close();
      });
    }
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
  }

  async function install() {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      hide();
      return;
    }
    guide();
  }

  installButton?.addEventListener("click", install);
  document.addEventListener("click", event => {
    const trigger = event.target.closest("[data-install-app]");
    if (!trigger) return;
    event.preventDefault();
    install();
  });

  dismissButton?.addEventListener("click", () => {
    hide();
    write(DISMISS_KEY, String(Date.now()));
  });

  window.addEventListener("appinstalled", () => {
    hide();
    installPrompt = null;
  });
})();
