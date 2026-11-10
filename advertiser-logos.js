// ASYUT AQAR — advertiser logo / photo in the circle next to the advertiser name (2026-11-10).
// * An advertiser = account + advertiser name, so one account posting for several companies has a logo per company.
// * Display: every element with data-owner-avatar="<owner id>" data-brand="<name>" gets that advertiser's approved logo
//   (or the logo of the account's approved company profile with the same name). Otherwise the letter/icon stays.
// * Upload (إعلاناتي): any image size/shape is cropped to a centred square and resized to 320×320 JPEG,
//   so it fills the circle neatly. The new logo appears after the admin approves it.
(function () {
  "use strict";
  if (window.AsyutAdvertiserLogos) return;
  const cfg = window.LAYAN_CONFIG || {};
  const base = String(cfg.SUPABASE_URL || "").replace(/\/$/, "");
  const key = cfg.SUPABASE_PUBLISHABLE_KEY || "";
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const cache = new Map(); // "owner|brand key" -> logo url | ""
  const safe = u => { try { const x = new URL(String(u || "")); return x.protocol === "https:" ? x.href : ""; } catch (_) { return ""; } };
  // An advertiser = account + the advertiser name on the listing (same rule as app.js / the database).
  const brandKey = name => String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
  const cacheKey = (owner, brand) => String(owner).toLowerCase() + "|" + brandKey(brand);

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

  const pending = new Map(); let timer = 0;
  async function fetchLogos(items) {
    if (!base || !key || !items.length) return;
    const keys = items.map(i => cacheKey(i.o, i.n));
    try {
      const r = await fetch(base + "/rest/v1/rpc/layan_advertiser_logos", {
        method: "POST",
        headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ p_items: items })
      });
      keys.forEach(k => cache.set(k, ""));
      if (r.ok) {
        const rows = await r.json();
        (Array.isArray(rows) ? rows : []).forEach(row => cache.set(String(row.owner_id).toLowerCase() + "|" + String(row.brand_key || ""), safe(row.logo_url)));
      } // not deployed yet: keep letters
    } catch (_) { keys.forEach(k => cache.set(k, "")); }
    apply(document);
  }
  function apply(root) {
    (root || document).querySelectorAll("[data-owner-avatar]").forEach(el => {
      const id = String(el.getAttribute("data-owner-avatar") || "").toLowerCase();
      if (!UUID.test(id)) return;
      const brand = el.getAttribute("data-brand") || "";
      const k = cacheKey(id, brand);
      if (cache.has(k)) paint(el, cache.get(k));
      else if (!pending.has(k)) pending.set(k, { o: id, n: brand });
    });
    if (pending.size && !timer) {
      timer = setTimeout(() => {
        const items = [...pending.entries()].slice(0, 200);
        items.forEach(([k]) => pending.delete(k));
        timer = 0;
        fetchLogos(items.map(([, v]) => v));
      }, 60);
    }
  }

  // Crop to a centred square and resize, so any photo or wide/tall logo fits the circle.
  // Fit the WHOLE image inside a square (no cropping, so a wide logo keeps its text), centred on white,
  // and shrink it to 512×512 — any big photo/logo becomes a small, sharp file that fits the circle.
  async function squareJpeg(file, size = 512) {
    if (!file) throw new Error("اختر صورة.");
    const type = String(file.type || "").toLowerCase();
    if (type && !/^image\/(jpeg|jpg|png|webp|gif|bmp)$/.test(type)) {
      throw new Error(/heic|heif/.test(type) ? "صيغة صور الآيفون (HEIC) غير مدعومة في المتصفح. صوّرها لقطة شاشة أو حوّلها إلى JPG ثم ارفعها." : "اختر صورة بصيغة JPG أو PNG.");
    }
    if (file.size > 25 * 1024 * 1024) throw new Error("حجم الصورة كبير جدًا (الحد 25 ميجابايت).");
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
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; // transparent logos get a clean white background
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // 84% of the circle: the corners of a square logo stay inside the round frame.
    const box = size * 0.84;
    const scale = Math.min(box / w, box / h);
    const dw = Math.round(w * scale), dh = Math.round(h * scale);
    ctx.drawImage(bitmap, Math.round((size - dw) / 2), Math.round((size - dh) / 2), dw, dh);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("تعذر تجهيز الصورة.");
    return blob;
  }

  async function uploadMyLogo(brand, file) {
    const api = window.LAYAN_SUPABASE;
    const session = api?.getSession?.();
    if (!session?.user?.id) throw new Error("سجّل الدخول أولًا.");
    const jpg = await squareJpeg(file);
    const id = (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2));
    const path = "offers/" + session.user.id + "/logo-" + id + ".jpg";
    const r = await api.authedFetch(base + "/storage/v1/object/layan_real_estat/" + path, { method: "POST", headers: { "Content-Type": "image/jpeg", "x-upsert": "false" }, body: jpg });
    if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error("تعذر رفع الصورة. حاول مرة أخرى." + (t ? " (" + t.slice(0, 120) + ")" : "")); }
    const url = base + "/storage/v1/object/public/layan_real_estat/" + path;
    const s2 = await api.authedFetch(base + "/rest/v1/rpc/layan_set_my_advertiser_logo", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_brand: brand, p_url: url })
    });
    if (!s2.ok) { const t = await s2.text().catch(() => ""); throw new Error("تعذر حفظ الشعار. اعمل تحديث للصفحة (Ctrl + Shift + R) ثم حاول مرة أخرى." + (t ? " (" + t.slice(0, 120) + ")" : "")); }
    // The owners (المدير) approve logos anyway: their own upload is approved right away.
    try {
      const who = await api.authedFetch(base + "/rest/v1/rpc/layan_admin_whoami", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (who.ok && (await who.json()) === "owner") {
        await api.authedFetch(base + "/rest/v1/rpc/layan_admin_review_logo", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ p_user: session.user.id, p_brand_key: brandKey(brand), p_approve: true })
        });
      }
    } catch (_) { /* stays pending for approval */ }
    return url;
  }
  async function removeMyLogo(brand) {
    const r = await window.LAYAN_SUPABASE.authedFetch(base + "/rest/v1/rpc/layan_set_my_advertiser_logo", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_brand: brand, p_url: null })
    });
    if (!r.ok) throw new Error("تعذر حذف الشعار.");
  }
  async function myLogos() {
    const r = await window.LAYAN_SUPABASE.authedFetch(base + "/rest/v1/rpc/layan_my_advertiser_logos", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
    });
    if (!r.ok) return [];
    const rows = await r.json();
    return Array.isArray(rows) ? rows : [];
  }

  // ---------- «إعلاناتي»: one logo card per advertiser name I post with ----------
  const escHtml = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function setCircle(el, url) {
    el.classList.toggle("has-logo", !!url);
    el.innerHTML = url ? '<img src="' + escHtml(url) + '" alt="">' : "▦";
  }
  async function myAdvertiserNames() {
    const names = new Map();
    try {
      const api = window.LAYAN_SUPABASE;
      const uid = api.getSession()?.user?.id;
      const r = await api.authedFetch(base + "/rest/v1/property_offers?select=contact_name,developer_name&owner_id=eq." + encodeURIComponent(uid) + "&order=created_at.desc&limit=500");
      const offers = r.ok ? await r.json() : [];
      (Array.isArray(offers) ? offers : []).forEach(o => {
        const n = String(o.contact_name || o.developer_name || "").trim().replace(/\s+/g, " ");
        if (n && !names.has(brandKey(n))) names.set(brandKey(n), n);
      });
    } catch (_) {}
    return names;
  }
  async function initMyLogoCard() {
    const card = document.getElementById("myLogoCard");
    if (!card || !window.LAYAN_SUPABASE?.isAuthenticated?.()) return;
    const list = document.getElementById("myLogoList");
    card.hidden = false;
    const render = async () => {
      const [names, rows] = await Promise.all([myAdvertiserNames(), myLogos().catch(() => [])]);
      const byKey = new Map(rows.map(r => [r.brand_key, r]));
      rows.forEach(r => { if (!names.has(r.brand_key)) names.set(r.brand_key, r.brand_name); });
      if (!names.size) {
        list.innerHTML = '<p class="my-logo-empty">أضف أول إعلان باسمك أو باسم شركتك، ثم ارجع هنا لإضافة الشعار.</p>';
        return;
      }
      list.innerHTML = [...names.entries()].map(([k, name]) => {
        const r = byKey.get(k) || {};
        const live = safe(r.logo_url), waiting = safe(r.pending_logo_url);
        const status = waiting ? "⏳ بانتظار مراجعة الإدارة" : live ? "✓ ظاهر على إعلاناتك" : "لا يوجد شعار — يظهر أول حرف من الاسم";
        return '<div class="my-logo-row" data-brand-row="' + escHtml(name) + '">' +
          '<div class="adv-logo-circle my-logo-preview' + ((waiting || live) ? " has-logo" : "") + '" aria-hidden="true">' + ((waiting || live) ? '<img src="' + escHtml(waiting || live) + '" alt="">' : "▦") + '</div>' +
          '<div class="my-logo-info"><strong>' + escHtml(name) + '</strong><small class="my-logo-status">' + status + '</small></div>' +
          '<div class="my-logo-actions"><label class="btn btn-gold my-logo-upload">' + (live || waiting ? "تغيير الشعار" : "رفع شعار / صورة") +
          '<input type="file" accept="image/*" data-camera-ready="1" data-logo-input hidden></label>' +
          ((live || waiting) ? '<button type="button" class="btn btn-outline" data-logo-remove>إزالة</button>' : "") + '</div></div>';
      }).join("");
    };
    list.addEventListener("change", async event => {
      const input = event.target.closest("[data-logo-input]");
      if (!input) return;
      const row = input.closest("[data-brand-row]");
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      const status = row.querySelector(".my-logo-status");
      try {
        status.textContent = "جارٍ تجهيز الصورة ورفعها...";
        setCircle(row.querySelector(".my-logo-preview"), URL.createObjectURL(await squareJpeg(file)));
        await uploadMyLogo(row.dataset.brandRow, file);
        await render();
      } catch (e) { status.textContent = e.message || "تعذر رفع الصورة."; }
    });
    list.addEventListener("click", async event => {
      const btn = event.target.closest("[data-logo-remove]");
      if (!btn) return;
      const row = btn.closest("[data-brand-row]");
      if (!confirm("إزالة شعار «" + row.dataset.brandRow + "» من إعلاناته؟")) return;
      try { await removeMyLogo(row.dataset.brandRow); await render(); } catch (e) { row.querySelector(".my-logo-status").textContent = e.message; }
    });
    render();
  }

  window.AsyutAdvertiserLogos = { apply, squareJpeg, uploadMyLogo, removeMyLogo, myLogos, brandKey };
  const start = () => {
    initMyLogoCard();
    apply(document);
    new MutationObserver(muts => { if (muts.some(m => m.addedNodes.length)) apply(document); })
      .observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
