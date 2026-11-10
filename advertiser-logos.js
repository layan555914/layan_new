// ASYUT AQAR — advertiser logo / photo in the circle next to the advertiser name (2026-11-10).
// * Display: every element with data-owner-avatar="<owner id>" gets the advertiser's approved logo
//   (or the logo of their approved company profile). Without a logo the letter/icon stays as before.
// * Upload (إعلاناتي): any image size/shape is cropped to a centred square and resized to 320×320 JPEG,
//   so it fills the circle neatly. The new logo appears after the admin approves it.
(function () {
  "use strict";
  if (window.AsyutAdvertiserLogos) return;
  const cfg = window.LAYAN_CONFIG || {};
  const base = String(cfg.SUPABASE_URL || "").replace(/\/$/, "");
  const key = cfg.SUPABASE_PUBLISHABLE_KEY || "";
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const cache = new Map(); // owner id -> logo url | ""
  const safe = u => { try { const x = new URL(String(u || "")); return x.protocol === "https:" ? x.href : ""; } catch (_) { return ""; } };

  function paint(el, url) {
    if (!url || el.querySelector("img.adv-logo-img")) return;
    const img = new Image();
    img.className = "adv-logo-img";
    img.alt = "";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.onload = () => { el.textContent = ""; el.appendChild(img); el.classList.add("has-logo"); };
    img.src = url;
  }

  let pending = new Set(), timer = 0;
  async function fetchLogos(ids) {
    if (!base || !key || !ids.length) return;
    try {
      const r = await fetch(base + "/rest/v1/rpc/layan_advertiser_logos", {
        method: "POST",
        headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ p_ids: ids })
      });
      if (!r.ok) { ids.forEach(id => cache.set(id, "")); return; } // not deployed yet: keep letters
      const rows = await r.json();
      ids.forEach(id => cache.set(id, ""));
      (Array.isArray(rows) ? rows : []).forEach(row => cache.set(String(row.owner_id), safe(row.logo_url)));
    } catch (_) { ids.forEach(id => cache.set(id, "")); }
    apply(document);
  }
  function apply(root) {
    (root || document).querySelectorAll("[data-owner-avatar]").forEach(el => {
      const id = String(el.getAttribute("data-owner-avatar") || "").toLowerCase();
      if (!UUID.test(id)) return;
      if (cache.has(id)) paint(el, cache.get(id));
      else pending.add(id);
    });
    if (pending.size && !timer) {
      timer = setTimeout(() => {
        const ids = [...pending].slice(0, 200);
        ids.forEach(id => pending.delete(id));
        timer = 0;
        fetchLogos(ids);
      }, 60);
    }
  }

  // Crop to a centred square and resize, so any photo or wide/tall logo fits the circle.
  async function squareJpeg(file, size = 320) {
    if (!file || !/^image\//.test(file.type || "")) throw new Error("اختر صورة (JPG أو PNG).");
    if (file.size > 15 * 1024 * 1024) throw new Error("حجم الصورة كبير جدًا (الحد 15 ميجابايت).");
    let bitmap;
    try { bitmap = await createImageBitmap(file); }
    catch (_) {
      bitmap = await new Promise((resolve, reject) => {
        const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error("تعذر قراءة الصورة. جرّب صورة JPG أو PNG."));
        i.src = URL.createObjectURL(file);
      });
    }
    const w = bitmap.width, h = bitmap.height;
    if (!w || !h) throw new Error("تعذر قراءة الصورة.");
    const side = Math.min(w, h);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; // transparent logos get a clean white background
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("تعذر تجهيز الصورة.");
    return blob;
  }

  async function uploadMyLogo(file) {
    const api = window.LAYAN_SUPABASE;
    const session = api?.getSession?.();
    if (!session?.user?.id) throw new Error("سجّل الدخول أولًا.");
    const jpg = await squareJpeg(file);
    const id = (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2));
    const path = "offers/" + session.user.id + "/logo-" + id + ".jpg";
    const target = base + "/storage/v1/object/layan_real_estat/" + path;
    const r = await api.authedFetch(target, { method: "POST", headers: { "Content-Type": "image/jpeg", "x-upsert": "false" }, body: jpg });
    if (!r.ok) throw new Error("تعذر رفع الصورة. حاول مرة أخرى.");
    const url = base + "/storage/v1/object/public/layan_real_estat/" + path;
    const s = await api.authedFetch(base + "/rest/v1/rpc/layan_set_my_advertiser_logo", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_url: url })
    });
    if (!s.ok) throw new Error("تعذر حفظ الشعار. حاول مرة أخرى.");
    return url;
  }
  async function removeMyLogo() {
    const r = await window.LAYAN_SUPABASE.authedFetch(base + "/rest/v1/rpc/layan_set_my_advertiser_logo", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_url: null })
    });
    if (!r.ok) throw new Error("تعذر حذف الشعار.");
  }
  async function myLogo() {
    const r = await window.LAYAN_SUPABASE.authedFetch(base + "/rest/v1/rpc/layan_my_advertiser_logo", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
    });
    if (!r.ok) return null;
    return r.json();
  }

  // ---------- «إعلاناتي»: logo card ----------
  function setCircle(el, url) {
    el.classList.toggle("has-logo", !!url);
    el.innerHTML = url ? '<img src="' + url.replace(/"/g, "%22") + '" alt="">' : "▦";
  }
  async function initMyLogoCard() {
    const card = document.getElementById("myLogoCard");
    if (!card || !window.LAYAN_SUPABASE?.isAuthenticated?.()) return;
    const preview = document.getElementById("myLogoPreview");
    const status = document.getElementById("myLogoStatus");
    const input = document.getElementById("myLogoInput");
    const remove = document.getElementById("myLogoRemove");
    card.hidden = false;
    const refresh = async () => {
      const mine = await myLogo().catch(() => null) || {};
      const live = safe(mine.logo_url), waiting = safe(mine.pending_logo_url);
      setCircle(preview, waiting || live);
      remove.hidden = !(live || waiting);
      status.textContent = waiting ? "⏳ الشعار الجديد بانتظار مراجعة الإدارة، وسيظهر على إعلاناتك بعد الاعتماد."
        : live ? "✓ الشعار ظاهر على إعلاناتك." : "لم تضف شعارًا بعد. يظهر حرف اسمك مكانه.";
    };
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      try {
        status.textContent = "جارٍ تجهيز الصورة ورفعها...";
        const local = URL.createObjectURL(await squareJpeg(file));
        setCircle(preview, local);
        await uploadMyLogo(file);
        await refresh();
      } catch (e) { status.textContent = e.message || "تعذر رفع الصورة."; }
    });
    remove.addEventListener("click", async () => {
      if (!confirm("إزالة الشعار من إعلاناتك؟")) return;
      try { await removeMyLogo(); await refresh(); } catch (e) { status.textContent = e.message; }
    });
    refresh();
  }

  window.AsyutAdvertiserLogos = { apply, squareJpeg, uploadMyLogo, removeMyLogo, myLogo };
  const start = () => {
    initMyLogoCard();
    apply(document);
    new MutationObserver(muts => { if (muts.some(m => m.addedNodes.length)) apply(document); })
      .observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
