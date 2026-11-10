// ASYUT AQAR admin — «الرعاة والإعلانات الممولة»
// 1) Official sponsors (public.platform_sponsors): add, edit, show/hide, order, delete.
// 2) Sponsored ads (public.supplier_ads): add on behalf of a business, activate/pause/renew, edit, delete.
// Rights are enforced by the database (RLS + admin RPCs). Deletions by added admins wait for owner approval.
(() => {
  "use strict";
  let A = null;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const req = (path, opt = {}) => A.request("/rest/v1/" + path, opt);
  const rpc = (name, body = {}) => req("rpc/" + name, { method: "POST", body: JSON.stringify(body) });
  const say = msg => A?.setStatus?.(msg);
  const httpUrl = v => { try { const u = new URL(String(v || "")); return ["https:", "http:"].includes(u.protocol) ? u.href : ""; } catch (_) { return ""; } };
  const logoSrc = v => (/^\.\/assets\/[\w./?=-]+$/.test(String(v || "")) ? v : httpUrl(v));
  const fmtDate = v => v ? new Date(v).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" }) : "";
  const toLocalInput = v => { if (!v) return ""; const d = new Date(v); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const notReady = e => /platform_sponsors|PGRST20[02]|404|does not exist|Could not find/i.test(String(e?.message || ""));
  const MIGRATION_NOTE = '<p class="admin-empty admin-pending">تحتاج هذه الخاصية تطبيق تحديث قاعدة البيانات «الرعاة والإعلانات الممولة» (20261110120000).</p>';

  // ---------- Image upload (no watermark; JPEG into the admin's own folder, publicly readable) ----------
  async function uploadImage(file, prefix) {
    const cfg = window.LAYAN_CONFIG || {}, auth = window.LAYAN_SUPABASE;
    const session = auth?.getSession?.();
    if (!session?.access_token || !session?.user?.id) throw new Error("انتهت جلسة الدخول. سجّل الدخول مرة أخرى.");
    if (file.size > 10 * 1024 * 1024) throw new Error("حجم الصورة يجب ألا يتجاوز 10 ميجابايت.");
    const jpg = typeof window.LAYAN_TO_JPEG === "function" ? await window.LAYAN_TO_JPEG(file) : file;
    if (jpg.type !== "image/jpeg") throw new Error("تعذر تحويل الصورة إلى JPG. جرّب صورة أخرى.");
    const base = String(cfg.SUPABASE_URL || "").replace(/\/$/, "");
    const id = (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2));
    const path = "offers/" + session.user.id + "/" + prefix + "-" + id + ".jpg";
    const target = base + "/storage/v1/object/layan_real_estat/" + path;
    const r = typeof auth.authedFetch === "function"
      ? await auth.authedFetch(target, { method: "POST", headers: { "Content-Type": "image/jpeg", "x-upsert": "false" }, body: jpg })
      : await fetch(target, {
          method: "POST",
          headers: { apikey: cfg.SUPABASE_PUBLISHABLE_KEY, Authorization: "Bearer " + session.access_token, "Content-Type": "image/jpeg", "x-upsert": "false" },
          body: jpg
        });
    if (!r.ok) { const t = await r.text(); throw new Error("تعذر رفع الصورة: " + (t.match(/"message":"([^"]+)/)?.[1] || r.status)); }
    return base + "/storage/v1/object/public/layan_real_estat/" + path;
  }

  // ===================== Official sponsors =====================
  let sponsors = [];
  function sponsorRow(s, i) {
    const logo = logoSrc(s.logo_url);
    const live = s.is_active && (!s.starts_at || new Date(s.starts_at) <= new Date()) && (!s.ends_at || new Date(s.ends_at) > new Date());
    const period = (s.starts_at || s.ends_at) ? '<small>' + (s.starts_at ? "من " + fmtDate(s.starts_at) : "") + (s.ends_at ? " حتى " + fmtDate(s.ends_at) : "") + '</small>' : "";
    return '<article class="as-item" data-sponsor-id="' + esc(s.id) + '">' +
      '<span class="as-logo">' + (logo ? '<img src="' + esc(logo) + '" alt="" loading="lazy">' : esc(s.name.slice(0, 1))) + '</span>' +
      '<div class="as-info"><strong>' + esc(s.name) + '</strong>' +
        '<span class="as-chips"><b class="as-chip ' + (s.tier === "partner" ? "is-partner" : "is-official") + '">' + (s.tier === "partner" ? "شريك" : "راعٍ رسمي") + '</b>' +
        '<b class="as-chip ' + (live ? "is-live" : "is-off") + '">' + (live ? "ظاهر للزوار" : (s.is_active ? "مجدول / منتهي" : "مخفي")) + '</b></span>' +
        (s.tagline ? '<small>' + esc(s.tagline) + '</small>' : "") + period + '</div>' +
      '<div class="as-actions">' +
        '<button type="button" class="as-icon" data-sp="up" ' + (i === 0 ? "disabled" : "") + ' aria-label="لأعلى">▲</button>' +
        '<button type="button" class="as-icon" data-sp="down" ' + (i === sponsors.length - 1 ? "disabled" : "") + ' aria-label="لأسفل">▼</button>' +
        '<button type="button" class="btn btn-outline-dark" data-sp="toggle">' + (s.is_active ? "إخفاء" : "إظهار") + '</button>' +
        '<button type="button" class="btn btn-gold" data-sp="edit">تعديل</button>' +
        '<button type="button" class="btn as-danger" data-sp="delete">حذف</button>' +
      '</div></article>';
  }
  async function loadSponsors() {
    const box = $("adminSponsorsList");
    if (!box) return;
    try {
      sponsors = await req("platform_sponsors?select=*&order=sort_order.asc,created_at.asc") || [];
      box.innerHTML = sponsors.length ? sponsors.map(sponsorRow).join("") : '<p class="admin-empty">لا يوجد رعاة. أضف أول راعٍ رسمي من الزر أعلاه.</p>';
    } catch (e) { box.innerHTML = notReady(e) ? MIGRATION_NOTE : '<p class="admin-empty">' + esc(e.message) + "</p>"; }
  }

  const sponsorDialog = document.createElement("dialog");
  sponsorDialog.className = "as-dialog";
  sponsorDialog.innerHTML = '<form class="as-form" novalidate>' +
    '<div class="as-dialog-head"><h2 data-title>إضافة راعٍ رسمي</h2><button type="button" class="as-close" data-close aria-label="إغلاق">×</button></div>' +
    '<div class="as-grid">' +
      '<label class="is-wide">اسم الراعي *<input name="name" required minlength="2" maxlength="80"></label>' +
      '<label>نوع الرعاية<select name="tier"><option value="official">راعٍ رسمي (البطاقة الكبيرة)</option><option value="partner">شريك نجاح (شريط الشركاء)</option></select></label>' +
      '<label>الترتيب<input name="sort_order" type="number" step="1" value="0"></label>' +
      '<label class="is-wide">العبارة فوق الاسم<input name="kicker" maxlength="80" placeholder="الراعي الرسمي لمنصة أسيوط عقار"></label>' +
      '<label class="is-wide">وصف مختصر<input name="tagline" maxlength="220" placeholder="شركة مصرية تقدم حلولًا هندسية متكاملة."></label>' +
      '<label class="is-wide">سطر إضافي (اختياري)<input name="subline" maxlength="160" placeholder="Integrated Engineering Solutions · Eng. ..."></label>' +
      '<label>رابط الراعي<input name="link_url" type="url" maxlength="1000" placeholder="https://"></label>' +
      '<label>نص زر الرابط<input name="link_label" maxlength="60" placeholder="زيارة صفحة الشركة"></label>' +
      '<label>يبدأ الظهور (اختياري)<input name="starts_at" type="date"></label>' +
      '<label>ينتهي الظهور (اختياري)<input name="ends_at" type="date"></label>' +
      '<div class="as-logo-field is-wide"><span class="as-logo-preview" data-logo-preview>—</span><div>' +
        '<label class="as-upload">رفع الشعار (صورة)<input type="file" accept="image/*" data-logo-file></label>' +
        '<label>أو رابط الشعار<input name="logo_url" maxlength="1000" placeholder="https:// أو ./assets/..."></label>' +
        '<small>يفضّل شعار مربع بخلفية فاتحة. يظهر داخل دائرة بيضاء.</small></div></div>' +
      '<label class="as-check is-wide"><input type="checkbox" name="is_active" checked> ظاهر للزوار</label>' +
    '</div>' +
    '<p class="as-status" data-status role="status"></p>' +
    '<div class="as-foot"><button type="submit" class="btn btn-gold">حفظ</button><button type="button" class="btn btn-outline-dark" data-close>إلغاء</button></div></form>';
  document.body.appendChild(sponsorDialog);
  const sForm = sponsorDialog.querySelector("form");
  let editingSponsor = null, pendingLogoFile = null;
  const paintLogo = src => { sponsorDialog.querySelector("[data-logo-preview]").innerHTML = src ? '<img src="' + esc(src) + '" alt="">' : "—"; };
  sponsorDialog.addEventListener("click", e => { if (e.target.closest("[data-close]") || e.target === sponsorDialog) sponsorDialog.close(); });
  sponsorDialog.querySelector("[data-logo-file]").addEventListener("change", e => {
    pendingLogoFile = e.target.files?.[0] || null;
    if (pendingLogoFile) paintLogo(URL.createObjectURL(pendingLogoFile));
  });
  sForm.logo_url.addEventListener("input", () => { if (!pendingLogoFile) paintLogo(logoSrc(sForm.logo_url.value)); });

  function openSponsor(s) {
    editingSponsor = s || null; pendingLogoFile = null;
    sForm.reset();
    sponsorDialog.querySelector("[data-title]").textContent = s ? "تعديل: " + s.name : "إضافة راعٍ رسمي";
    if (s) {
      ["name", "tier", "kicker", "tagline", "subline", "link_url", "link_label", "logo_url"].forEach(k => { sForm[k].value = s[k] ?? ""; });
      sForm.sort_order.value = s.sort_order ?? 0;
      sForm.starts_at.value = toLocalInput(s.starts_at); sForm.ends_at.value = toLocalInput(s.ends_at);
      sForm.is_active.checked = !!s.is_active;
    } else {
      sForm.sort_order.value = sponsors.length ? Math.max(...sponsors.map(x => x.sort_order || 0)) + 1 : 0;
      sForm.kicker.value = "الراعي الرسمي لمنصة أسيوط عقار";
    }
    paintLogo(s ? logoSrc(s.logo_url) : "");
    sponsorDialog.querySelector("[data-status]").textContent = "";
    sponsorDialog.showModal();
  }
  sForm.addEventListener("submit", async e => {
    e.preventDefault();
    const status = sponsorDialog.querySelector("[data-status]"), btn = sForm.querySelector('[type="submit"]');
    const name = sForm.name.value.trim();
    if (name.length < 2) { status.textContent = "اكتب اسم الراعي."; return; }
    const link = sForm.link_url.value.trim();
    if (link && !httpUrl(link)) { status.textContent = "رابط الراعي غير صحيح."; return; }
    btn.disabled = true;
    try {
      let logo = sForm.logo_url.value.trim();
      if (pendingLogoFile) { status.textContent = "جارٍ رفع الشعار..."; logo = await uploadImage(pendingLogoFile, "sponsor-logo"); }
      if (!logoSrc(logo)) throw new Error("ارفع شعار الراعي أو اكتب رابطه.");
      const day = (v, end) => v ? new Date(v + (end ? "T23:59:59" : "T00:00:00")).toISOString() : null;
      const row = {
        name, tier: sForm.tier.value, kicker: sForm.kicker.value.trim() || null, tagline: sForm.tagline.value.trim() || null,
        subline: sForm.subline.value.trim() || null, link_url: link || null, link_label: sForm.link_label.value.trim() || null,
        logo_url: logo, sort_order: Number(sForm.sort_order.value) || 0, is_active: sForm.is_active.checked,
        starts_at: day(sForm.starts_at.value), ends_at: day(sForm.ends_at.value, true)
      };
      status.textContent = "جارٍ الحفظ...";
      if (editingSponsor) await req("platform_sponsors?id=eq." + encodeURIComponent(editingSponsor.id), { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
      else await req("platform_sponsors", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
      sponsorDialog.close();
      say(editingSponsor ? "تم تحديث بيانات الراعي." : "تمت إضافة الراعي، ويظهر في الصفحة الرئيسية فورًا.");
      loadSponsors();
    } catch (err) { status.textContent = notReady(err) ? "طبّق تحديث قاعدة البيانات أولًا (20261110120000)." : (err.message || "تعذر الحفظ."); }
    finally { btn.disabled = false; }
  });

  async function sponsorAction(btn) {
    const item = btn.closest("[data-sponsor-id]"); const s = sponsors.find(x => x.id === item?.dataset.sponsorId); if (!s) return;
    const act = btn.dataset.sp;
    if (act === "edit") return openSponsor(s);
    btn.disabled = true;
    try {
      if (act === "toggle") {
        await req("platform_sponsors?id=eq." + s.id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ is_active: !s.is_active }) });
        say(s.is_active ? "تم إخفاء الراعي من الموقع." : "الراعي ظاهر الآن في الموقع.");
      } else if (act === "up" || act === "down") {
        const i = sponsors.indexOf(s), j = act === "up" ? i - 1 : i + 1; const other = sponsors[j]; if (!other) return;
        const a = Number.isFinite(s.sort_order) ? s.sort_order : i, b = Number.isFinite(other.sort_order) ? other.sort_order : j;
        const [na, nb] = a === b ? [j, i] : [b, a];
        await req("platform_sponsors?id=eq." + s.id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ sort_order: na }) });
        await req("platform_sponsors?id=eq." + other.id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ sort_order: nb }) });
      } else if (act === "delete") {
        if (!window.confirm("حذف الراعي «" + s.name + "» نهائيًا؟ (يمكنك بدلًا من ذلك «إخفاء»)")) return;
        const r = await rpc("layan_admin_delete_sponsor", { p_id: s.id });
        say(r === "pending" ? "تم إرسال طلب الحذف لاعتماد المدير." : "تم حذف الراعي.");
      }
      await loadSponsors();
    } catch (err) { say(err.message || "تعذر تنفيذ الإجراء."); }
    finally { btn.disabled = false; }
  }

  // ===================== Sponsored ads =====================
  let ads = [];
  const STATUS = { pending: ["بانتظار التفعيل", "is-wait"], active: ["منشور", "is-live"], paused: ["موقوف مؤقتًا", "is-off"], expired: ["منتهي", "is-off"], rejected: ["مرفوض", "is-off"] };
  function adState(a) {
    if (a.status === "active" && a.ends_at && new Date(a.ends_at) <= new Date()) return "expired";
    return a.status;
  }
  function adRow(a) {
    const st = adState(a), [label, cls] = STATUS[st] || [st, ""];
    const img = httpUrl(a.image_url);
    const buttons = [];
    if (st === "pending") buttons.push('<button type="button" class="btn btn-gold" data-ad="activate">تفعيل ونشر</button>', '<button type="button" class="btn btn-outline-dark" data-ad="reject">رفض</button>');
    if (st === "active") buttons.push('<button type="button" class="btn btn-outline-dark" data-ad="pause">إيقاف مؤقت</button>', '<button type="button" class="btn btn-outline-dark" data-ad="extend">تمديد المدة</button>');
    if (st === "paused") buttons.push('<button type="button" class="btn btn-gold" data-ad="resume">إعادة النشر</button>');
    if (st === "expired" || st === "rejected") buttons.push('<button type="button" class="btn btn-gold" data-ad="renew">تجديد ونشر</button>');
    buttons.push('<button type="button" class="btn btn-outline-dark" data-ad="edit">تعديل</button>', '<button type="button" class="btn as-danger" data-ad="delete">حذف</button>');
    return '<article class="as-item as-ad" data-ad-id="' + esc(a.id) + '">' +
      '<span class="as-thumb">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : esc(String(a.business_name || "؟").slice(0, 1))) + '</span>' +
      '<div class="as-info"><strong>' + esc(a.title) + '</strong><span class="as-chips"><b class="as-chip ' + cls + '">' + esc(label) + '</b><b class="as-chip">' + esc(a.category) + '</b></span>' +
        '<small>' + esc(a.business_name) + ' · <span dir="ltr">' + esc(a.contact_phone) + '</span></small>' +
        '<small>' + (a.starts_at ? "من " + fmtDate(a.starts_at) : "أُرسل " + fmtDate(a.created_at)) + (a.ends_at ? " حتى " + fmtDate(a.ends_at) : "") + (Number(a.price) ? " · " + Number(a.price).toLocaleString("ar-EG") + " جنيه" : "") + '</small></div>' +
      '<div class="as-actions">' + buttons.join("") + '</div></article>';
  }
  async function loadAds() {
    const box = $("adminSponsoredAdsList");
    if (!box) return;
    try {
      ads = await req("supplier_ads?select=id,owner_id,business_name,category,title,description,image_url,target_url,contact_phone,status,price,starts_at,ends_at,created_at&order=created_at.desc") || [];
      const order = { active: 0, pending: 1, paused: 2, expired: 3, rejected: 4 };
      ads.sort((x, y) => (order[adState(x)] ?? 9) - (order[adState(y)] ?? 9));
      box.innerHTML = ads.length ? ads.map(adRow).join("") : '<p class="admin-empty">لا توجد إعلانات ممولة بعد. أضف إعلانًا من الزر أعلاه.</p>';
    } catch (e) { box.innerHTML = '<p class="admin-empty">' + esc(e.message) + "</p>"; }
  }

  const CATEGORIES = ["مواد بناء", "تشطيبات", "سيراميك وبورسلين", "دهانات", "أبواب وشبابيك", "مطابخ وأثاث", "ستائر ومفروشات", "أدوات صحية", "كهرباء وسباكة", "مقاولات", "مطور عقاري / مشروع", "أخرى"];
  const adDialog = document.createElement("dialog");
  adDialog.className = "as-dialog";
  adDialog.innerHTML = '<form class="as-form" novalidate>' +
    '<div class="as-dialog-head"><h2 data-title>إضافة إعلان ممول</h2><button type="button" class="as-close" data-close aria-label="إغلاق">×</button></div>' +
    '<div class="as-grid">' +
      '<label>اسم النشاط *<input name="business_name" required minlength="2" maxlength="120"></label>' +
      '<label>المجال *<select name="category" required>' + CATEGORIES.map(c => "<option>" + c + "</option>").join("") + '</select></label>' +
      '<label class="is-wide">عنوان الإعلان *<input name="title" required minlength="3" maxlength="140"></label>' +
      '<label class="is-wide">الوصف *<textarea name="description" required minlength="5" maxlength="500" rows="3"></textarea></label>' +
      '<label>رقم التواصل *<input name="contact_phone" type="tel" dir="ltr" required minlength="7" maxlength="30"></label>' +
      '<label>رابط النشاط (اختياري)<input name="target_url" type="url" maxlength="1000" placeholder="https://"></label>' +
      '<div class="as-logo-field is-wide"><span class="as-logo-preview as-wide-preview" data-ad-preview>—</span><div>' +
        '<label class="as-upload">رفع صورة الإعلان<input type="file" accept="image/*" data-ad-file></label>' +
        '<label>أو رابط الصورة<input name="image_url" type="url" maxlength="1000" placeholder="https://"></label>' +
        '<small>صورة عرضية (16:10) تظهر أعلى البطاقة. بدونها يظهر تصميم بحرف النشاط.</small></div></div>' +
      '<label data-new-only>مدة النشر (أيام) *<input name="days" type="number" min="1" max="365" value="30"></label>' +
      '<label data-new-only>المبلغ المتفق عليه (جنيه)<input name="price" type="number" min="0" value="0"></label>' +
    '</div>' +
    '<p class="as-status" data-status role="status"></p>' +
    '<div class="as-foot"><button type="submit" class="btn btn-gold">حفظ</button><button type="button" class="btn btn-outline-dark" data-close>إلغاء</button></div></form>';
  document.body.appendChild(adDialog);
  const aForm = adDialog.querySelector("form");
  let editingAd = null, pendingAdFile = null;
  const paintAd = src => { adDialog.querySelector("[data-ad-preview]").innerHTML = src ? '<img src="' + esc(src) + '" alt="">' : "—"; };
  adDialog.addEventListener("click", e => { if (e.target.closest("[data-close]") || e.target === adDialog) adDialog.close(); });
  adDialog.querySelector("[data-ad-file]").addEventListener("change", e => { pendingAdFile = e.target.files?.[0] || null; if (pendingAdFile) paintAd(URL.createObjectURL(pendingAdFile)); });
  aForm.image_url.addEventListener("input", () => { if (!pendingAdFile) paintAd(httpUrl(aForm.image_url.value)); });

  function openAd(a) {
    editingAd = a || null; pendingAdFile = null; aForm.reset();
    adDialog.querySelector("[data-title]").textContent = a ? "تعديل إعلان: " + a.title : "إضافة إعلان ممول";
    adDialog.querySelectorAll("[data-new-only]").forEach(n => { n.hidden = !!a; });
    if (a) {
      ["business_name", "title", "description", "contact_phone", "target_url", "image_url"].forEach(k => { aForm[k].value = a[k] ?? ""; });
      if (![...aForm.category.options].some(o => o.value === a.category)) aForm.category.insertAdjacentHTML("afterbegin", "<option>" + esc(a.category) + "</option>");
      aForm.category.value = a.category;
    }
    paintAd(a ? httpUrl(a.image_url) : "");
    adDialog.querySelector("[data-status]").textContent = "";
    adDialog.showModal();
  }
  aForm.addEventListener("submit", async e => {
    e.preventDefault();
    const status = adDialog.querySelector("[data-status]"), btn = aForm.querySelector('[type="submit"]');
    if (!aForm.reportValidity()) return;
    const target = aForm.target_url.value.trim();
    if (target && !httpUrl(target)) { status.textContent = "رابط النشاط غير صحيح."; return; }
    btn.disabled = true;
    try {
      let image = aForm.image_url.value.trim();
      if (pendingAdFile) { status.textContent = "جارٍ رفع الصورة..."; image = await uploadImage(pendingAdFile, "sponsored-ad"); }
      if (image && !httpUrl(image)) throw new Error("رابط الصورة غير صحيح.");
      const row = {
        business_name: aForm.business_name.value.trim(), category: aForm.category.value, title: aForm.title.value.trim(),
        description: aForm.description.value.trim(), contact_phone: aForm.contact_phone.value.trim(),
        target_url: target || null, image_url: image || null
      };
      if (editingAd) {
        await req("supplier_ads?id=eq." + editingAd.id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }) });
        say("تم تحديث الإعلان الممول.");
      } else {
        const days = Math.round(Number(aForm.days.value)), price = Math.max(0, Number(aForm.price.value) || 0);
        if (!(days >= 1 && days <= 365)) throw new Error("مدة النشر من يوم إلى 365 يومًا.");
        const uid = window.LAYAN_SUPABASE?.getSession?.()?.user?.id;
        status.textContent = "جارٍ إنشاء الإعلان...";
        const created = await req("supplier_ads?select=id", { method: "POST", headers: { Prefer: "return=representation" },
          body: JSON.stringify({ ...row, owner_id: uid, status: "pending", plan_code: "custom", requested_days: days, requested_price: price, price: 0 }) });
        const id = Array.isArray(created) ? created[0]?.id : created?.id;
        try {
          await rpc("layan_activate_supplier_ad", { p_ad_id: id, p_days: days, p_price: price });
          say("تم نشر الإعلان الممول لمدة " + days + " يومًا، ويظهر للزوار الآن.");
        } catch (err) {
          say("تم حفظ الإعلان، وينتظر تفعيل أحد المُلّاك (" + (err.message || "") + ").");
        }
      }
      adDialog.close();
      loadAds();
    } catch (err) { status.textContent = err.message || "تعذر الحفظ."; }
    finally { btn.disabled = false; }
  });

  async function adAction(btn) {
    const item = btn.closest("[data-ad-id]"); const a = ads.find(x => x.id === item?.dataset.adId); if (!a) return;
    const act = btn.dataset.ad;
    if (act === "edit") return openAd(a);
    const patch = body => req("supplier_ads?id=eq." + a.id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }) });
    const askDays = (msg, def) => { const v = window.prompt(msg, String(def)); if (v === null) return null; const n = Math.round(Number(v)); if (!(n >= 1 && n <= 365)) { say("المدة من يوم إلى 365 يومًا."); return null; } return n; };
    btn.disabled = true;
    try {
      if (act === "activate") {
        const days = askDays("مدة نشر الإعلان بالأيام:", 30); if (!days) return;
        const priceText = window.prompt("المبلغ المتفق عليه بالجنيه (0 لو مجاني):", "0"); if (priceText === null) return;
        await rpc("layan_activate_supplier_ad", { p_ad_id: a.id, p_days: days, p_price: Math.max(0, Number(priceText) || 0) });
        say("تم تفعيل الإعلان ونشره.");
      } else if (act === "reject") {
        const reason = window.prompt("سبب الرفض:"); if (!reason || reason.trim().length < 3) return;
        await rpc("layan_reject_supplier_ad", { p_ad_id: a.id, p_reason: reason.trim() });
        say("تم رفض الإعلان.");
      } else if (act === "pause") {
        await patch({ status: "paused" }); say("تم إيقاف الإعلان مؤقتًا.");
      } else if (act === "resume") {
        if (a.ends_at && new Date(a.ends_at) <= new Date()) { const d = askDays("انتهت المدة. مدة النشر الجديدة بالأيام:", 30); if (!d) return; await patch({ status: "active", ends_at: new Date(Date.now() + d * 864e5).toISOString() }); }
        else await patch({ status: "active" });
        say("الإعلان منشور الآن.");
      } else if (act === "extend" || act === "renew") {
        const d = askDays("عدد الأيام" + (act === "extend" ? " الإضافية:" : " للنشر من اليوم:"), 30); if (!d) return;
        const from = act === "extend" && a.ends_at && new Date(a.ends_at) > new Date() ? new Date(a.ends_at).getTime() : Date.now();
        await patch({ status: "active", starts_at: act === "renew" ? new Date().toISOString() : a.starts_at || new Date().toISOString(), ends_at: new Date(from + d * 864e5).toISOString() });
        say("تم " + (act === "extend" ? "تمديد" : "تجديد") + " الإعلان.");
      } else if (act === "delete") {
        if (!window.confirm("حذف الإعلان الممول «" + a.title + "» نهائيًا؟")) return;
        const r = await rpc("layan_admin_delete_supplier_ad", { p_id: a.id });
        say(r === "pending" ? "تم إرسال طلب الحذف لاعتماد المدير." : "تم حذف الإعلان.");
      }
      await loadAds();
    } catch (err) {
      say(/Could not find|PGRST202/.test(err.message || "") ? "تحتاج هذه الخاصية تطبيق تحديث قاعدة البيانات (20261110120000)." : (err.message || "تعذر تنفيذ الإجراء."));
    } finally { btn.disabled = false; }
  }

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-sp]"); if (b && b.closest("#adminSponsorsList")) return sponsorAction(b);
    const c = e.target.closest("[data-ad]"); if (c && c.closest("#adminSponsoredAdsList")) return adAction(c);
    if (e.target.closest("#addSponsorBtn")) return openSponsor(null);
    if (e.target.closest("#addSponsoredAdBtn")) return openAd(null);
    if (e.target.closest("#adminRefreshAll")) setTimeout(() => { loadSponsors(); loadAds(); }, 400);
  });
  window.addEventListener("asyut:admin-ready", () => { A = window.AsyutAdmin; loadSponsors(); loadAds(); });
})();
