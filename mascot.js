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

  const CENTERS = ["مدينة أسيوط", "أسيوط الجديدة", "مركز أسيوط", "ديروط", "القوصية", "منفلوط", "أبنوب", "الفتح", "أبو تيج", "ساحل سليم", "البداري", "صدفا", "الغنايم"];
  const GOVS = ["القاهرة", "الجيزة", "الإسكندرية", "سوهاج", "المنيا", "قنا", "الأقصر", "أسوان", "بني سويف", "الفيوم", "الوادي الجديد", "البحر الأحمر", "القليوبية", "الشرقية", "الدقهلية", "الغربية", "المنوفية", "البحيرة", "كفر الشيخ", "دمياط", "بورسعيد", "الإسماعيلية", "السويس", "شمال سيناء", "جنوب سيناء", "مطروح", "خارج مصر"];
  const areaSelect = current => `<select class="aa-mascot-area" aria-label="اختر مركزك أو محافظتك"><option value="">اختر مركزك أو محافظتك</option><optgroup label="محافظة أسيوط">${CENTERS.map(c => `<option value="أسيوط · ${c}" ${current === "أسيوط · " + c ? "selected" : ""}>${c}</option>`).join("")}</optgroup><optgroup label="محافظات أخرى">${GOVS.map(g => `<option value="${g}" ${current === g ? "selected" : ""}>${g}</option>`).join("")}</optgroup></select>`;
  const saveArea = value => { if (!value) return; write("asyutHomeArea", value); window.dispatchEvent(new CustomEvent("asyut:home-area", { detail: value })); toast("شكرًا! هنعرض لك الأقرب ليك."); };

  function mount() {
    const root = document.createElement("div");
    root.className = "aa-mascot";
    root.innerHTML = `
      <div class="aa-mascot-bubble" role="status" hidden>
        <button type="button" class="aa-mascot-bubble-close" aria-label="إغلاق الترحيب">×</button>
        <b>أهلًا بيك في أسيوط عقار! 👋</b>
        <span>اضغط عليّ لو عندك أي سؤال: المساعد الذكي، واتساب، أو إضافة إعلانك مجانًا.</span>
        <label class="aa-mascot-area-label">إنت منين؟ ${areaSelect(read("asyutHomeArea") || "")}</label>
        <button type="button" class="aa-mascot-locate" data-mascot-locate>📍 حدد مكاني تلقائيًا</button>
      </div>
      <div class="aa-mascot-menu" id="aaMascotMenu" hidden>
        <b class="aa-mascot-menu-title">إزاي أقدر أساعدك؟</b>
        <button type="button" class="aa-mascot-action is-primary" data-mascot="assistant"><span aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5c0 4.1-3.6 7.5-8 7.5-1.1 0-2.2-.2-3.1-.6L4 20l1.3-3.8C4.5 14.8 4 13.2 4 11.5 4 7.4 7.6 4 12 4s8 3.4 8 7.5z"/></svg></span><em>اسأل المساعد الذكي<small>إجابة فورية عن العقارات والخدمات والإعلان</small></em></button>
        <a class="aa-mascot-action is-wa" href="${WA}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">✆</span>تواصل معنا على واتساب</a>
        <button type="button" class="aa-mascot-action" data-mascot="signup"><span aria-hidden="true">＋</span>إنشاء حساب مجاني</button>
        <button type="button" class="aa-mascot-action" data-mascot="login"><span aria-hidden="true">⇥</span>تسجيل الدخول</button>
        <a class="aa-mascot-action" href="./?add=1"><span aria-hidden="true">⌂</span>أضف إعلانك مجانًا</a>
        <button type="button" class="aa-mascot-action" data-mascot-locate><span aria-hidden="true">📍</span>حدد مكاني تلقائيًا</button>
        <label class="aa-mascot-action aa-mascot-area-row"><span aria-hidden="true">⌖</span>${areaSelect(read("asyutHomeArea") || "")}</label>
        <button type="button" class="aa-mascot-action" data-mascot="share"><span aria-hidden="true">⤴</span>مشاركة الصفحة</button>
      </div>
      <button type="button" class="aa-mascot-button" aria-expanded="false" aria-controls="aaMascotMenu" aria-label="المساعدة: المساعد الذكي وواتساب والحساب" title="محتاج مساعدة؟">
        <span class="aa-mascot-badge" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5c0 4.1-3.6 7.5-8 7.5-1.1 0-2.2-.2-3.1-.6L4 20l1.3-3.8C4.5 14.8 4 13.2 4 11.5 4 7.4 7.6 4 12 4s8 3.4 8 7.5z"/></svg></span><picture><source srcset="./assets/brand/mascot.webp" type="image/webp"><img src="./assets/brand/mascot.png" alt="" width="313" height="360" decoding="async"></picture>
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
    let keepBubble = false;
    root.addEventListener("change", event => {
      if (!event.target.matches(".aa-mascot-area")) return;
      saveArea(event.target.value);
      root.querySelectorAll(".aa-mascot-area").forEach(sel => { sel.value = event.target.value; });
      if (!bubble.hidden) setTimeout(() => { bubble.hidden = true; }, 900);
    });
    root.addEventListener("click", async event => {
      const btn = event.target.closest("[data-mascot-locate]");
      if (!btn) return;
      event.stopPropagation();
      keepBubble = true;
      if (!window.AsyutLocate) { toast("اختر مركزك من القائمة."); return; }
      btn.disabled = true;
      try {
        const name = await window.AsyutLocate();
        root.querySelectorAll(".aa-mascot-area").forEach(sel => { if ([...sel.options].some(o => o.value === name)) sel.value = name; });
        toast("تم: " + name);
        setTimeout(() => { bubble.hidden = true; }, 900);
      } catch (_) {
        toast("لم نتمكن من تحديد المكان. اختر مركزك من القائمة.");
      } finally { btn.disabled = false; }
    }, true);
    bubble.addEventListener("focusin", () => { keepBubble = true; });
    bubble.addEventListener("pointerdown", () => { keepBubble = true; });
    menu.addEventListener("click", event => {
      if (event.target.closest(".aa-mascot-area-row")) return;
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
      setTimeout(() => { if (!keepBubble) bubble.hidden = true; root.classList.remove("is-welcoming"); }, 12000);
      write(SEEN_KEY, new Date().toISOString());
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
