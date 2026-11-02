(() => {
  "use strict";
  const banner = document.getElementById("installAppBanner");
  const installButton = document.getElementById("installAppBtn");
  const dismissButton = document.getElementById("dismissInstallBtn");
  let installPrompt = null;
  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { scope: "./" })
        .catch(error => console.error("ASYUT AQAR: تعذر تفعيل وضع التطبيق:", error));
    });
  }

  const dismissed = () => {
    try { return sessionStorage.getItem("layanInstallBannerDismissed") === "1"; }
    catch (_) { return false; }
  };
  const showBanner = () => {
    if (banner && !isStandalone() && !dismissed()) banner.hidden = false;
  };
  if (isStandalone() && banner) banner.hidden = true;
  else showBanner();

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    showBanner();
  });

  installButton?.addEventListener("click", async () => {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      if (banner) banner.hidden = true;
      return;
    }
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    alert(isIOS
      ? "لتثبيت أسيوط عقار: اضغط زر المشاركة في المتصفح، ثم اختر «إضافة إلى الشاشة الرئيسية»."
      : "لتثبيت أسيوط عقار: افتح قائمة المتصفح ⋮ ثم اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».");
  });

  dismissButton?.addEventListener("click", () => {
    if (banner) banner.hidden = true;
    try { sessionStorage.setItem("layanInstallBannerDismissed", "1"); } catch (_) {}
  });

  window.addEventListener("appinstalled", () => {
    if (banner) banner.hidden = true;
    installPrompt = null;
  });
})();
