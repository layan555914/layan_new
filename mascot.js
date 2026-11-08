// ASYUT AQAR mascot (تميمة أسيوط عقار): bottom-left helper that welcomes first-time
// visitors and opens quick actions: WhatsApp, login, free signup, share, assistant.
(() => {
  "use strict";
  if (window.__asyutMascot || document.body.classList.contains("no-mascot")) return;
  window.__asyutMascot = true;

  const WA = "https://wa.me/201007044265?text=" + encodeURIComponent("مرحبًا، عندي استفسار عن منصة أسيوط عقار.");
  const SEEN_KEY = "asyutMascotWelcomed";
  const read = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };
  const loggedIn = () => { try { return Boolean(window.LAYAN_SUPABASE?.isAuthenticated?.()); } catch (_) { return false; } };

  // Pages with the main login dialog (home/offers) open it in place; others go to the home page.
  const openAuth = mode => {
    if (typeof window.AsyutOpenAuth === "function") { window.AsyutOpenAuth(mode); return; }
    window.location.href = "./?auth=" + mode;
  };
  const share = async () => {
    const data = { title: document.title, url: window.location.href.split("#")[0] };
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(data.url);
      toast("تم نسخ رابط الصفحة");
    } catch (_) {}
  };
  let toastTimer;
  const toast = text => {
    let node = document.getElementById("aaMascotToast");
    if (!node) { node = document.createElement("div"); node.id = "aaMascotToast"; node.className = "aa-mascot-toast"; node.setAttribute("role", "status"); document.body.appendChild(node); }
    node.textContent = text; node.classList.add("is-on");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove("is-on"), 2200);
  };

  function mount() {
    const root = document.createElement("div");
    root.className = "aa-mascot";
    root.innerHTML = `
      <div class="aa-mascot-bubble" role="status" hidden>
        <button type="button" class="aa-mascot-bubble-close" aria-label="إغلاق الترحيب">×</button>
        <b>أهلًا بيك في أسيوط عقار! 👋</b>
        <span>أنا هنا أساعدك تلاقي عقارك أو تعرض عقارك مجانًا.</span>
      </div>
      <div class="aa-mascot-menu" id="aaMascotMenu" hidden>
        <b class="aa-mascot-menu-title">إزاي أقدر أساعدك؟</b>
        <a class="aa-mascot-action is-wa" href="${WA}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">✆</span>تواصل معنا على واتساب</a>
        <button type="button" class="aa-mascot-action" data-mascot="signup"><span aria-hidden="true">＋</span>إنشاء حساب مجاني</button>
        <button type="button" class="aa-mascot-action" data-mascot="login"><span aria-hidden="true">⇥</span>تسجيل الدخول</button>
        <a class="aa-mascot-action" href="./?add=1"><span aria-hidden="true">⌂</span>أضف إعلانك مجانًا</a>
        <button type="button" class="aa-mascot-action" data-mascot="assistant"><span aria-hidden="true">✦</span>اسأل مساعد أسيوط عقار</button>
        <button type="button" class="aa-mascot-action" data-mascot="share"><span aria-hidden="true">⤴</span>مشاركة الصفحة</button>
      </div>
      <button type="button" class="aa-mascot-button" aria-expanded="false" aria-controls="aaMascotMenu" aria-label="تميمة أسيوط عقار: افتح قائمة المساعدة">
        <picture><source srcset="./assets/brand/mascot.webp" type="image/webp"><img src="./assets/brand/mascot.png" alt="" width="313" height="360" decoding="async"></picture>
      </button>`;
    document.body.appendChild(root);
    const button = root.querySelector(".aa-mascot-button");
    const menu = root.querySelector(".aa-mascot-menu");
    const bubble = root.querySelector(".aa-mascot-bubble");
    const paintAuth = () => {
      const signedIn = loggedIn();
      root.querySelector('[data-mascot="login"]').hidden = signedIn;
      root.querySelector('[data-mascot="signup"]').hidden = signedIn;
    };
    const setOpen = state => {
      menu.hidden = !state;
      bubble.hidden = true;
      button.setAttribute("aria-expanded", String(state));
      root.classList.toggle("is-open", state);
      if (state) paintAuth();
    };
    button.addEventListener("click", () => setOpen(menu.hidden));
    root.querySelector(".aa-mascot-bubble-close").addEventListener("click", () => { bubble.hidden = true; });
    menu.addEventListener("click", event => {
      const action = event.target.closest("[data-mascot]")?.dataset.mascot;
      if (!action) return;
      setOpen(false);
      if (action === "login" || action === "signup") openAuth(action);
      else if (action === "share") share();
      else if (action === "assistant") document.querySelector(".aa-chat-toggle")?.click();
    });
    document.addEventListener("click", event => { if (!menu.hidden && !root.contains(event.target)) setOpen(false); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !menu.hidden) { setOpen(false); button.focus(); } });

    // Welcome once per visitor, then stay quietly in the corner.
    if (!read(SEEN_KEY)) {
      root.classList.add("is-welcoming");
      setTimeout(() => { bubble.hidden = false; }, 900);
      setTimeout(() => { bubble.hidden = true; root.classList.remove("is-welcoming"); }, 9000);
      write(SEEN_KEY, new Date().toISOString());
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
