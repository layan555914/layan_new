// ASYUT AQAR admin control center: numbers, users (with signup details), activity and
// contact log, published listings (delete), admin access list, and Excel export.
// Everything goes through admin-only RPCs that check private.layan_is_admin() on the server.
// If the 20261108120000 migration is not applied yet, each tab says so instead of failing.
(() => {
  "use strict";
  const root = document.getElementById("adminConsole");
  if (!root) return;
  const panels = Object.fromEntries([...root.querySelectorAll("[data-admin-panel]")].map(p => [p.dataset.adminPanel, p]));
  const loaded = new Set();
  let A = null; // { request, setStatus, esc }
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const date = v => v ? new Date(v).toLocaleString("ar-EG-u-nu-latn", { dateStyle: "medium", timeStyle: "short" }) : "—";
  const TYPES = { page_view: "زيارة صفحة", listing_view: "مشاهدة إعلان", contact_call: "اتصال", contact_whatsapp: "واتساب", search: "بحث", favorite: "حفظ في المفضلة", signup: "إنشاء حساب", login: "تسجيل دخول", add_listing_open: "فتح إضافة إعلان", share: "مشاركة" };
  const ACCOUNT = { seeker: "باحث عن عقار", owner: "مالك عقار", broker: "وسيط عقاري", company: "شركة عقارية" };
  const needsMigration = error => /layan_admin_|layan_activity|function .* does not exist|Could not find the function|PGRST202|404/i.test(String(error?.message || error));
  const pendingNote = '<p class="admin-empty admin-pending">هذه الأداة تحتاج تطبيق تحديث قاعدة البيانات «مركز التحكم» (20261108120000) بعد موافقة المدير. باقي أقسام الإدارة تعمل كالمعتاد.</p>';
  const rpc = (name, body = {}) => A.request("/rest/v1/rpc/" + name, { method: "POST", body: JSON.stringify(body) });

  // ---- Excel export (SheetJS loaded on demand; CSV fallback) ----
  let xlsxPromise = null;
  const loadXlsx = () => xlsxPromise || (xlsxPromise = new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    // Subresource integrity: the browser refuses the file if the CDN copy is ever altered.
    s.integrity = "sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw";
    s.crossOrigin = "anonymous";
    s.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error("xlsx"));
    s.onerror = () => reject(new Error("xlsx"));
    document.head.appendChild(s);
  }));
  async function exportRows(name, rows) {
    if (!rows?.length) { A.setStatus("لا توجد بيانات للتصدير."); return; }
    const stamp = new Date().toISOString().slice(0, 10);
    try {
      const XLSX = await loadXlsx();
      const sheet = XLSX.utils.json_to_sheet(rows);
      sheet["!cols"] = Object.keys(rows[0]).map(() => ({ wch: 22 }));
      const book = XLSX.utils.book_new();
      book.Workbook = { Views: [{ RTL: true }] };
      XLSX.utils.book_append_sheet(book, sheet, name.slice(0, 28));
      XLSX.writeFile(book, `asyut-aqar-${name}-${stamp}.xlsx`);
    } catch (_) {
      const keys = Object.keys(rows[0]);
      const csv = "﻿" + [keys.join(","), ...rows.map(r => keys.map(k => '"' + String(r[k] ?? "").replace(/"/g, '""') + '"').join(","))].join("\r\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      a.download = `asyut-aqar-${name}-${stamp}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  }
  const toolbar = (html) => `<div class="admin-toolbar">${html}</div>`;

  // ---- Overview ----
  async function loadOverview() {
    const panel = panels.overview;
    panel.innerHTML = '<p class="admin-empty">جارٍ تحميل الأرقام...</p>';
    const days = Number(panel.dataset.days || 30);
    try {
      const s = await rpc("layan_admin_activity_summary", { p_days: days });
      const bar = (rows, label, value) => rows.length ? rows.map(r => {
        const max = Math.max(...rows.map(x => Number(x[value]) || 0), 1);
        return `<li><span>${esc(r[label] ?? "—")}</span><i style="--w:${Math.round((Number(r[value]) || 0) / max * 100)}%"></i><b>${esc(r[value])}</b></li>`;
      }).join("") : '<li class="admin-empty">لا توجد بيانات بعد.</li>';
      panel.innerHTML = toolbar(`<label>الفترة <select data-overview-days>${[7, 30, 90, 365].map(d => `<option value="${d}" ${d === days ? "selected" : ""}>آخر ${d} يوم</option>`).join("")}</select></label>`) +
        `<div class="admin-kpis">
          <div><strong>${esc(s.visitors)}</strong><span>زائر (جلسات مختلفة)</span></div>
          <div><strong>${esc(s.visits)}</strong><span>زيارة صفحة</span></div>
          <div><strong>${esc(s.contacts)}</strong><span>تواصل (اتصال + واتساب)</span></div>
          <div><strong>${esc(s.new_users)}</strong><span>حساب جديد</span></div>
        </div>
        <div class="admin-columns">
          <section><h3>الزوار حسب المحافظة</h3><ul class="admin-bars">${bar(byGovernorate(s.by_region || []), "label", "visitors")}</ul></section>
          <section><h3>زوار محافظة أسيوط حسب المركز</h3><ul class="admin-bars">${bar(byCenter(s.by_region || []), "label", "visitors")}</ul></section>
          <section class="adm-span"><h3>المراكز الأكثر طلبًا (صفحات المراكز والبحث بالمدينة)</h3><ul class="admin-bars">${bar(await centerInterest(s, days), "label", "visits")}</ul></section>
          <section><h3>أكثر الصفحات زيارة</h3><ul class="admin-bars">${bar(s.by_page || [], "page", "views")}</ul></section>
          <section><h3>أكثر الإعلانات تواصلًا</h3><ul class="admin-bars">${bar((s.top_listings || []).map(x => ({ ...x, label: "ASY-" + String(x.listing_id).padStart(4, "0") + " · " + x.views + " مشاهدة" })), "label", "contacts")}</ul></section>
          <section><h3>الزوار يوميًا</h3><ul class="admin-bars">${bar((s.by_day || []).slice(-14), "day", "visitors")}</ul></section>
        </div>
        <p class="admin-note">المحافظة والمركز يختارهما الزائر بنفسه بضغطة من التميمة («إنت منين؟»)؛ «غير محدد» = زائر من مصر لم يختر بعد. لا تُجمع عناوين IP أو مواقع GPS. «المراكز الأكثر طلبًا» من زيارات صفحات المراكز والبحث بالمدينة.</p>`;
    } catch (error) {
      panel.innerHTML = needsMigration(error) ? pendingNote : `<p class="admin-empty">${esc(error.message)}</p>`;
    }
  }

  // ---- Readable names for pages and listings ----
  const PAGES_AR = { "index.html": "الرئيسية", "": "الرئيسية", "offers.html": "صفحة العقارات", "property.html": "صفحة إعلان عقار", "advertiser.html": "صفحة معلن", "marketplace.html": "سوق الخدمات", "companies.html": "الشركات", "company.html": "ملف شركة", "directory.html": "الدليل العقاري", "favorites.html": "المفضلة", "my-listings.html": "إعلاناتي", "guide.html": "دليل الاستخدام", "about.html": "من نحن", "privacy.html": "سياسة الخصوصية", "terms.html": "الشروط", "advertise.html": "أعلن معنا", "payment.html": "الدفع", "reset-password.html": "استعادة كلمة المرور" };
  const pageName = page => {
    const p = String(page || "").replace(/^\//, "").split("?")[0];
    const area = p.match(/^areas\/([\w-]+)\.html$/);
    if (area) return "صفحة مركز " + (AREA_PAGES[area[1]] || area[1]);
    const ad = p.match(/^ads\/(\d+)\.html$/);
    if (ad) return "صفحة إعلان ASY-" + ad[1].padStart(4, "0");
    return PAGES_AR[p] || p;
  };
  let listingTitles = null;
  async function titles() {
    if (listingTitles) return listingTitles;
    listingTitles = new Map();
    try { (await A.request("/rest/v1/property_offers?select=id,title,property_type,listing_purpose&limit=2000") || []).forEach(o => listingTitles.set(Number(o.id), [o.property_type, o.listing_purpose, o.title].filter(Boolean).join(" · "))); } catch (_) {}
    return listingTitles;
  }
  const listingCell = (id, map) => id ? `<a href="./property.html?id=${esc(id)}" target="_blank">ASY-${String(id).padStart(4, "0")}</a>${map?.get(Number(id)) ? " · " + esc(map.get(Number(id))) : ""}` : "";
  const detailText = e => {
    const t = String(e.target || "");
    if (!t || t === location.hostname || /(^|\.)(layan-eg|asyutq)\.com$/.test(t)) return "";
    if (e.event_type === "contact_call") return "اتصال بشأن: " + t;
    if (e.event_type === "contact_whatsapp") return "واتساب بشأن: " + t;
    return t;
  };

  // ---- Governorate / center helpers ----
  const AREA_PAGES = { "abnub": "أبنوب", "abu-tig": "أبو تيج", "assiut-city": "مدينة أسيوط", "dairut": "ديروط", "el-badari": "البداري", "el-fath": "الفتح", "el-ghanayem": "الغنايم", "el-qusiya": "القوصية", "manfalut": "منفلوط", "new-assiut": "أسيوط الجديدة", "sahel-selim": "ساحل سليم", "sidfa": "صدفا" };
  const sumBy = (rows, keyFn, valueKey) => {
    const map = new Map();
    rows.forEach(r => { const k = keyFn(r); if (!k) return; map.set(k, (map.get(k) || 0) + (Number(r[valueKey]) || 0)); });
    return [...map.entries()].map(([label, v]) => ({ label, [valueKey]: v })).sort((a, b) => b[valueKey] - a[valueKey]);
  };
  const regionGov = region => {
    const r = String(region || "").trim();
    if (!r || r === "غير معروف") return "غير محدد";
    if (r.startsWith("أسيوط ·")) return "أسيوط";
    if (r === "مصر" || r === "مصر · غير محدد") return "مصر — لم يحدد المحافظة";
    return r;
  };
  const byGovernorate = rows => sumBy(rows, r => regionGov(r.region), "visitors");
  const byCenter = rows => sumBy(rows.filter(r => String(r.region || "").startsWith("أسيوط ·")), r => String(r.region).split("·")[1].trim(), "visitors");
  async function centerInterest(summary, days) {
    const fromPages = (summary.by_page || []).map(p => { const m = String(p.page || "").match(/areas\/([\w-]+)\.html/); return m && AREA_PAGES[m[1]] ? { label: AREA_PAGES[m[1]], visits: Number(p.views) || 0 } : null; }).filter(Boolean);
    let fromSearch = [];
    try {
      const rows = await rpc("layan_admin_activity", { p_days: days, p_user: null, p_type: "search", p_limit: 5000 }) || [];
      fromSearch = rows.map(e => { const m = String(e.target || "").match(/^مركز:\s*(.+)$/); return m ? { label: m[1].trim(), visits: 1 } : null; }).filter(Boolean);
    } catch (_) {}
    return sumBy([...fromPages, ...fromSearch], r => r.label, "visits").slice(0, 13);
  }

  // ---- Users ----
  let usersCache = [];
  async function loadUsers() {
    const panel = panels.users;
    const search = panel.querySelector("[data-user-search]")?.value || "";
    panel.innerHTML = '<p class="admin-empty">جارٍ تحميل المستخدمين...</p>';
    try {
      usersCache = await rpc("layan_admin_list_users", { p_search: search || null, p_limit: 1000, p_offset: 0 }) || [];
      const recent = usersCache.filter(u => Date.now() - new Date(u.created_at) < 7 * 864e5).length;
      panel.innerHTML = toolbar(`<input type="search" data-user-search placeholder="ابحث بالاسم أو البريد أو الموبايل" value="${esc(search)}"><button class="btn btn-outline-dark" type="button" data-user-find>بحث</button><button class="btn btn-gold" type="button" data-export="users">تنزيل Excel</button><span class="admin-pill">${usersCache.length} حساب · ${recent} جديد هذا الأسبوع</span>`) +
        `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>الاسم</th><th>البريد</th><th>الموبايل</th><th>نوع الحساب</th><th>التسجيل</th><th>آخر دخول</th><th>إعلانات</th><th>تواصل</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>` +
        usersCache.map(u => `<tr data-user="${esc(u.id)}" class="${Date.now() - new Date(u.created_at) < 7 * 864e5 ? "is-new" : ""}">
          <td>${esc(u.full_name || "—")}${u.is_admin ? ' <span class="admin-pill">إدارة</span>' : ""}</td><td>${esc(u.email)}</td><td dir="ltr">${esc(u.phone || "—")}</td><td>${esc(ACCOUNT[u.account_type] || u.account_type || "—")}</td>
          <td>${date(u.created_at)}</td><td>${u.last_sign_in_at ? date(u.last_sign_in_at) : "لم يسجل دخولًا"}</td><td>${esc(u.listings_count)}</td><td>${esc(u.contacts_count)}</td>
          <td>${u.banned_until ? '<span class="admin-bad">موقوف</span>' : u.email_confirmed_at ? "نشط" : "غير مؤكد"}</td>
          <td class="admin-actions-cell"><button type="button" data-user-profile>ملف العميل</button><button type="button" data-user-suspend="${u.banned_until ? "0" : "1"}">${u.banned_until ? "تفعيل" : "إيقاف"}</button><button type="button" class="is-danger" data-user-delete>حذف</button></td></tr>`).join("") +
        `</tbody></table></div><div class="admin-profile" data-user-profile-box hidden></div>`;
    } catch (error) {
      panel.innerHTML = needsMigration(error) ? pendingNote + '<p class="admin-empty">قائمة الحسابات الأساسية متاحة أسفل الصفحة في «حسابات المستخدمين».</p>' : `<p class="admin-empty">${esc(error.message)}</p>`;
    }
  }
  async function showProfile(id) {
    const user = usersCache.find(u => u.id === id);
    const box = panels.users.querySelector("[data-user-profile-box]");
    if (!user || !box) return;
    box.hidden = false;
    box.innerHTML = '<p class="admin-empty">جارٍ تحميل ملف العميل...</p>';
    box.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const events = await rpc("layan_admin_activity", { p_days: 365, p_user: id, p_type: null, p_limit: 1000 }) || [];
      const map = await titles();
      const contacts = events.filter(e => /^contact_/.test(e.event_type));
      const views = events.filter(e => e.event_type === "listing_view" && e.listing_id);
      const pagesSeen = new Map(); events.filter(e => e.event_type === "page_view").forEach(e => { const n = pageName(e.page); pagesSeen.set(n, (pagesSeen.get(n) || 0) + 1); });
      const viewed = new Map(); views.forEach(e => viewed.set(e.listing_id, (viewed.get(e.listing_id) || 0) + 1));
      const regions = [...new Set(events.map(e => e.region).filter(Boolean))];
      box.innerHTML = `<header><h3>ملف العميل: ${esc(user.full_name || user.email)}</h3><button type="button" class="btn btn-outline-dark" data-export="profile" data-user-id="${esc(id)}">تنزيل Excel</button></header>
        <div class="admin-kpis"><div><strong>${events.length}</strong><span>حركة مسجلة</span></div><div><strong>${viewed.size}</strong><span>إعلان شاهده</span></div><div><strong>${contacts.length}</strong><span>مرة تواصل</span></div><div><strong>${esc(user.listings_count)}</strong><span>إعلانات أضافها</span></div></div>
        <p><b>البريد:</b> ${esc(user.email)} · <b>الموبايل:</b> <span dir="ltr">${esc(user.phone || "—")}</span> · <b>نوع الحساب:</b> ${esc(ACCOUNT[user.account_type] || "—")} · <b>التسجيل:</b> ${date(user.created_at)} · <b>آخر نشاط:</b> ${date(user.last_seen)} · <b>المنطقة:</b> ${esc(regions.join("، ") || "—")}</p>
        <div class="admin-columns">
          <section><h3>تواصل مع</h3><ul class="admin-list">${contacts.map(e => `<li>${date(e.created_at)} — ${esc(TYPES[e.event_type])}${e.listing_id ? " · " + listingCell(e.listing_id, map) : ""}${detailText(e) ? " · " + esc(detailText(e)) : ""}</li>`).join("") || "<li>لم يتواصل بعد.</li>"}</ul></section>
          <section><h3>الإعلانات التي شاهدها</h3><ul class="admin-list">${[...viewed.entries()].map(([lid, n]) => `<li>${listingCell(lid, map)} — ${n} مرة</li>`).join("") || "<li>لم يفتح إعلانات بعد.</li>"}</ul></section>
          <section class="adm-span"><h3>الصفحات التي زارها</h3><ul class="admin-list">${[...pagesSeen.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `<li>${esc(n)} — ${c} مرة</li>`).join("") || "<li>—</li>"}</ul></section>
        </div>
        <h3>كل التحركات بالترتيب</h3>
        <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>الوقت</th><th>الحركة</th><th>الصفحة</th><th>الإعلان</th><th>التفاصيل</th><th>المنطقة</th></tr></thead><tbody>${events.slice(0, 300).map(e => `<tr><td>${date(e.created_at)}</td><td>${esc(TYPES[e.event_type] || e.event_type)}</td><td>${esc(pageName(e.page))}</td><td>${listingCell(e.listing_id, map)}</td><td>${esc(detailText(e))}</td><td>${esc(e.region || "")}</td></tr>`).join("") || '<tr><td colspan="6">لا توجد حركة مسجلة لهذا العميل بعد.</td></tr>'}</tbody></table></div>`;
      box.dataset.events = JSON.stringify(events);
    } catch (error) {
      box.innerHTML = needsMigration(error) ? pendingNote : `<p class="admin-empty">${esc(error.message)}</p>`;
    }
  }

  // ---- Activity & contacts ----
  let activityCache = [];
  async function loadActivity() {
    const panel = panels.activity;
    const type = panel.querySelector("[data-activity-type]")?.value ?? "contact";
    const days = Number(panel.querySelector("[data-activity-days]")?.value || 30);
    panel.innerHTML = '<p class="admin-empty">جارٍ تحميل الحركة...</p>';
    try {
      const rows = await rpc("layan_admin_activity", { p_days: days, p_user: null, p_type: type === "contact" || type === "all" ? null : type, p_limit: 5000 }) || [];
      activityCache = type === "contact" ? rows.filter(e => /^contact_/.test(e.event_type)) : rows;
      const users = new Map(usersCache.map(u => [u.id, u]));
      const map = await titles();
      panel.innerHTML = toolbar(`<label>النوع <select data-activity-type><option value="contact" ${type === "contact" ? "selected" : ""}>التواصل فقط (اتصال / واتساب)</option><option value="all" ${type === "all" ? "selected" : ""}>كل الحركة</option>${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${type === k ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>الفترة <select data-activity-days>${[1, 7, 30, 90, 365].map(d => `<option value="${d}" ${d === days ? "selected" : ""}>آخر ${d} يوم</option>`).join("")}</select></label><button class="btn btn-gold" type="button" data-export="activity">تنزيل Excel</button><span class="admin-pill">${activityCache.length} حركة</span>`) +
        `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>الوقت</th><th>الحركة</th><th>العميل</th><th>الإعلان</th><th>الصفحة</th><th>التفاصيل</th><th>الجهاز</th><th>المنطقة</th></tr></thead><tbody>` +
        activityCache.slice(0, 1000).map(e => { const u = users.get(e.user_id); return `<tr><td>${date(e.created_at)}</td><td>${esc(TYPES[e.event_type] || e.event_type)}</td><td>${u ? esc(u.full_name || u.email) : e.user_id ? "حساب مسجل" : "زائر"}</td><td>${listingCell(e.listing_id, map)}</td><td>${esc(pageName(e.page))}</td><td>${esc(detailText(e))}</td><td>${esc(e.device || "")}</td><td>${esc(e.region || "")}</td></tr>`; }).join("") +
        `</tbody></table></div>`;
    } catch (error) {
      panel.innerHTML = needsMigration(error) ? pendingNote : `<p class="admin-empty">${esc(error.message)}</p>`;
    }
  }

  // ---- Published listings (delete) ----
  let listingsCache = [];
  async function loadListings() {
    const panel = panels.listings;
    panel.innerHTML = '<p class="admin-empty">جارٍ تحميل الإعلانات المنشورة...</p>';
    try {
      const offers = await A.request("/rest/v1/property_offers?select=id,title,listing_purpose,property_type,city,area,total_price,contact_name,contact_phone,owner_id,status,created_at&status=in.(available,reserved,sold)&order=created_at.desc&limit=1000") || [];
      const services = await A.request("/rest/v1/marketplace_listings?select=id,title,category,city,area,contact_phone,status,created_at&status=eq.approved&order=created_at.desc&limit=1000").catch(() => []) || [];
      let companies = [];
      try { companies = await rpc("layan_admin_list_published_companies") || []; }
      catch (_) {
        // Before the 2026-11-08 database update: read the same public list the companies page shows.
        companies = (await A.request("/rest/v1/company_profiles_public?select=id,company_name,category,city&order=company_name.asc").catch(() => []) || []).map(c => ({ status: "active", ...c }));
      }
      const STATUS = { available: "منشور", reserved: "محجوز", sold: "تم البيع", approved: "منشور", active: "منشور" };
      listingsCache = [
        ...offers.map(o => ({ kind: "عقار", k: "offer", ...o })),
        ...services.map(x => ({ kind: "خدمة", k: "service", ...x })),
        ...companies.map(c => ({ kind: "شركة", k: "company", title: c.company_name, category: c.category, city: c.city, contact_phone: c.phone, ...c }))
      ];
      const published = listingsCache.length;
      document.querySelectorAll("[data-published-total]").forEach(el => { el.textContent = published; });
      panel.innerHTML = toolbar(`<button class="btn btn-gold" type="button" data-export="listings">تنزيل Excel</button><span class="admin-pill">${published} منشور: ${offers.length} عقار · ${services.length} خدمة · ${companies.length} شركة</span>`) +
        `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>النوع</th><th>الكود</th><th>العنوان</th><th>القسم</th><th>المكان</th><th>التواصل</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th></tr></thead><tbody>` +
        listingsCache.map(x => `<tr data-listing="${esc(x.id)}" data-kind="${x.k}"><td>${x.kind}</td><td>${x.k === "offer" ? "ASY-" + String(x.id).padStart(4, "0") : "#" + esc(String(x.id).slice(0, 8))}</td><td>${esc(x.title)}</td><td>${esc(x.property_type ? x.property_type + " · " + (x.listing_purpose || "") : x.category || "")}</td><td>${esc([x.city, x.area].filter(Boolean).join(" · "))}</td><td dir="ltr">${esc(x.contact_phone || "")}</td><td>${esc(STATUS[x.status] || x.status || "")}</td><td>${date(x.created_at)}</td>
          <td class="admin-actions-cell">${x.k === "offer" ? `<a href="./property.html?id=${esc(x.id)}" target="_blank">فتح</a>` : x.k === "company" ? `<a href="./company.html?id=${esc(x.id)}" target="_blank">فتح</a>` : `<a href="./marketplace.html" target="_blank">فتح</a>`}<button type="button" class="is-danger" data-listing-delete>حذف</button></td></tr>`).join("") +
        `</tbody></table></div>`;
    } catch (error) {
      panel.innerHTML = `<p class="admin-empty">${esc(error.message)}</p>`;
    }
  }

  // ---- Admins ----
  async function loadAdmins() {
    const panel = panels.admins;
    panel.innerHTML = '<p class="admin-empty">جارٍ تحميل صلاحيات الإدارة...</p>';
    try {
      const rows = await rpc("layan_admin_list_admins") || [];
      const roleLabel = r => r.role === "owner" ? '<span class="adm-role adm-role-owner">★ مدير</span>' : '<span class="adm-role">مشرف</span>';
      const owners = rows.filter(r => r.role === "owner").length;
      panel.innerHTML = `<p>هؤلاء فقط من يدخلون لوحة الإدارة، وأي حساب عادي لا يراها ولا يستطيع فتحها. <b>المدير</b> صلاحيته كاملة ويعتمد كل شيء. <b>المشرف</b> يرى كل شيء، لكن أي إضافة أو تعديل أو حذف يقوم به يُرسل أولًا للمدير ولا يُنفَّذ إلا بعد موافقته. أي حساب تضيفه هنا يظهر فورًا كمشرف.</p>` +
        `<p class="adm-team-count"><b>${rows.length}</b> حساب له صلاحية الإدارة${owners ? ` — منهم <b>${owners}</b> مدير` : ""}</p>` +
        toolbar(`<input type="email" data-admin-email placeholder="بريد الحساب المسجل"><button class="btn btn-gold" type="button" data-admin-add>منح صلاحية الإدارة</button>`) +
        `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>البريد</th><th>الصفة</th><th>منذ</th><th>إجراء</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.email)}</td><td>${roleLabel(r)}</td><td>${date(r.added_at)}</td><td>${r.role === "owner" ? '<small>ثابت</small>' : `<button type="button" class="is-danger" data-admin-remove="${esc(r.email)}">إزالة الصلاحية</button>`}</td></tr>`).join("") || '<tr><td colspan="4">لا توجد حسابات.</td></tr>'}</tbody></table></div>`;
    } catch (error) {
      panel.innerHTML = needsMigration(error) ? pendingNote : `<p class="admin-empty">${esc(error.message)}</p>`;
    }
  }

  // ---- Owner approval requests ----
  const ACTIONS = { delete_user: "حذف حساب", suspend_user: "إيقاف حساب", unsuspend_user: "إعادة تفعيل حساب", delete_offer: "حذف إعلان عقار", delete_service: "حذف خدمة", delete_company: "حذف ملف شركة", delete_supplier_ad: "حذف إعلان ممول", delete_sponsor: "حذف راعٍ رسمي", change: "إضافة / تعديل" };
  const STATES = { pending: "بانتظار المدير", approved: "تم الاعتماد والتنفيذ", rejected: "مرفوض", failed: "تعذر التنفيذ" };
  const done = (result, doneText) => result === "pending"
    ? "تم إرسال الطلب إلى المدير للاعتماد. سيُنفَّذ بعد موافقته."
    : doneText;
  async function refreshRequestsBadge() {
    try {
      const rows = await rpc("layan_admin_list_requests", { p_status: "pending" }) || [];
      const badge = root.querySelector("[data-requests-count]");
      if (badge) { badge.textContent = rows.length; badge.hidden = !rows.length; }
      root.querySelectorAll("[data-requests-total]").forEach(el => { el.textContent = rows.length; });
    } catch (_) {}
  }
  async function loadRequests() {
    const panel = panels.requests;
    panel.innerHTML = '<p class="admin-empty">جارٍ تحميل الطلبات...</p>';
    try {
      const status = panel.dataset.status ?? "pending";
      const rows = await rpc("layan_admin_list_requests", { p_status: status || null }) || [];
      const isOwner = rows.some(r => r.can_decide);
      panel.innerHTML = `<p>أي إضافة أو تعديل أو حذف أو إيقاف يقوم به مشرف يصل هنا أولًا، ولا يُنفَّذ إلا بعد اعتماد المدير. اضغط «التفاصيل» لترى التعديل المطلوب بالضبط قبل الاعتماد. ما ينفذه المدير بنفسه يُنفَّذ مباشرة.</p>` +
        toolbar(`<label>العرض <select data-requests-status>${[["pending", "بانتظار الاعتماد"], ["", "كل الطلبات"], ["approved", "المعتمدة"], ["rejected", "المرفوضة"]].map(([v, l]) => `<option value="${v}" ${v === status ? "selected" : ""}>${l}</option>`).join("")}</select></label>`) +
        `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>الطلب</th><th>العنصر</th><th>مقدم الطلب</th><th>التاريخ</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${rows.map(r => `<tr data-request="${esc(r.id)}" data-request-action="${esc(r.action)}"><td>${esc(ACTIONS[r.action] || r.action)}</td><td>${esc(r.target_label || r.target)}${r.action === "change" && r.payload ? `<details class="adm-change"><summary>التفاصيل</summary><pre dir="ltr">${esc(r.payload.method + " " + r.payload.path + (r.payload.body != null ? "\n" + JSON.stringify(r.payload.body, null, 2) : ""))}</pre></details>` : ""}</td><td>${esc(r.requested_by_email || "")}</td><td>${date(r.created_at)}</td><td>${esc(STATES[r.status] || r.status)}${r.note ? `<br><small>${esc(r.note)}</small>` : ""}</td><td>${r.can_decide ? `<button type="button" class="btn btn-gold" data-request-decide="1">اعتماد وتنفيذ</button> <button type="button" class="is-danger" data-request-decide="0">رفض</button>` : (r.status === "pending" ? "بانتظار المدير" : (r.decided_by_email ? esc(r.decided_by_email) : ""))}</td></tr>`).join("") || '<tr><td colspan="6">لا توجد طلبات.</td></tr>'}</tbody></table></div>` +
        (isOwner || !rows.length ? "" : '<p class="admin-empty">الاعتماد متاح لحسابات المدير فقط.</p>');
      refreshRequestsBadge();
    } catch (error) {
      panel.innerHTML = needsMigration(error) ? pendingNote : `<p class="admin-empty">${esc(error.message)}</p>`;
    }
  }

  const loaders = { overview: loadOverview, users: loadUsers, activity: loadActivity, listings: loadListings, requests: loadRequests, admins: loadAdmins };
  function openTab(name) {
    root.querySelectorAll("[data-admin-tab]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.adminTab === name)));
    Object.entries(panels).forEach(([k, p]) => { p.hidden = k !== name; });
    if (!loaded.has(name)) { loaded.add(name); loaders[name](); }
  }

  root.addEventListener("click", async event => {
    const t = event.target;
    const tab = t.closest("[data-admin-tab]");
    if (tab) { openTab(tab.dataset.adminTab); return; }
    if (t.closest("[data-user-find]")) { loadUsers(); return; }
    const exp = t.closest("[data-export]");
    if (exp) {
      const kind = exp.dataset.export;
      if (kind === "users") exportRows("users", usersCache.map(u => ({ "الاسم": u.full_name || "", "البريد": u.email, "الموبايل": u.phone || "", "نوع الحساب": ACCOUNT[u.account_type] || u.account_type || "", "تاريخ التسجيل": date(u.created_at), "آخر دخول": date(u.last_sign_in_at), "تأكيد البريد": u.email_confirmed_at ? "مؤكد" : "غير مؤكد", "عدد الإعلانات": u.listings_count, "مرات التواصل": u.contacts_count, "آخر نشاط": date(u.last_seen), "الحالة": u.banned_until ? "موقوف" : "نشط", "إدارة": u.is_admin ? "نعم" : "" })));
      if (kind === "activity") exportRows("activity", activityCache.map(e => ({ "الوقت": date(e.created_at), "الحركة": TYPES[e.event_type] || e.event_type, "المستخدم": e.user_id || "زائر", "الجلسة": e.session_id, "الإعلان": e.listing_id || "", "الصفحة": e.page || "", "التفاصيل": e.target || "", "الجهاز": e.device || "", "المنطقة": e.region || "", "المصدر": e.referrer || "" })));
      if (kind === "listings") exportRows("listings", listingsCache.map(x => ({ "النوع": x.kind, "الكود": x.id, "العنوان": x.title, "القسم": x.property_type ? x.property_type + " " + (x.listing_purpose || "") : x.category || "", "المدينة": x.city || "", "المنطقة": x.area || "", "السعر": x.total_price ?? "", "المعلن": x.contact_name || "", "الهاتف": x.contact_phone || "", "الحالة": x.status, "التاريخ": date(x.created_at) })));
      if (kind === "profile") { const box = panels.users.querySelector("[data-user-profile-box]"); exportRows("customer-" + exp.dataset.userId.slice(0, 8), JSON.parse(box?.dataset.events || "[]").map(e => ({ "الوقت": date(e.created_at), "الحركة": TYPES[e.event_type] || e.event_type, "الإعلان": e.listing_id || "", "الصفحة": e.page || "", "التفاصيل": e.target || "", "المنطقة": e.region || "" }))); }
      return;
    }
    const row = t.closest("[data-user]");
    if (row && t.closest("[data-user-profile]")) { showProfile(row.dataset.user); return; }
    if (row && t.closest("[data-user-suspend]")) {
      const suspend = t.closest("[data-user-suspend]").dataset.userSuspend === "1";
      if (!confirm(suspend ? "إيقاف هذا الحساب؟ لن يستطيع تسجيل الدخول." : "إعادة تفعيل هذا الحساب؟")) return;
      try { const r = await rpc("layan_admin_set_user_suspended", { p_user: row.dataset.user, p_suspended: suspend }); A.setStatus(done(r, suspend ? "تم إيقاف الحساب." : "تم تفعيل الحساب.")); loadUsers(); refreshRequestsBadge(); } catch (e) { A.setStatus(e.message); }
      return;
    }
    if (row && t.closest("[data-user-delete]")) {
      if (!confirm("حذف هذا الحساب نهائيًا؟ لا يمكن التراجع عن الحذف.")) return;
      try { const r = await rpc("layan_admin_delete_user", { p_user: row.dataset.user }); A.setStatus(done(r, "تم حذف الحساب.")); loadUsers(); refreshRequestsBadge(); } catch (e) { A.setStatus(e.message); }
      return;
    }
    const lrow = t.closest("[data-listing]");
    if (lrow && t.closest("[data-listing-delete]")) {
      if (!confirm("حذف هذا الإعلان نهائيًا من المنصة؟ لا يمكن التراجع عن الحذف.")) return;
      try {
        const fn = { offer: "layan_admin_delete_property_offer", service: "layan_admin_delete_marketplace_listing", company: "layan_admin_delete_company_profile" }[lrow.dataset.kind];
        const r = await rpc(fn, { p_id: lrow.dataset.kind === "offer" ? Number(lrow.dataset.listing) : String(lrow.dataset.listing) });
        A.setStatus(done(r, "تم حذف الإعلان.")); loadListings(); refreshRequestsBadge();
      } catch (e) { A.setStatus(needsMigration(e) ? (lrow.dataset.kind === "company" ? "حذف الشركات يعمل بعد تشغيل تحديث قاعدة البيانات الأخير (زر Run في Supabase)." : "حذف الإعلانات يحتاج تطبيق تحديث قاعدة البيانات أولًا.") : e.message); }
      return;
    }
    const dec = t.closest("[data-request-decide]");
    if (dec) {
      const approve = dec.dataset.requestDecide === "1";
      const id = Number(dec.closest("[data-request]").dataset.request);
      if (!confirm(approve ? "اعتماد الطلب وتنفيذه الآن؟ بعض الإجراءات مثل الحذف لا يمكن التراجع عنها." : "رفض هذا الطلب؟")) return;
      const note = approve ? null : (prompt("سبب الرفض (اختياري)") || null);
      const row = dec.closest("[data-request]");
      if (approve && row.dataset.requestAction === "change") {
        try {
          const all = await rpc("layan_admin_list_requests", { p_status: "pending" }) || [];
          const req = all.find(x => Number(x.id) === id);
          if (!req || !req.payload) throw new Error("الطلب غير موجود أو تم البت فيه.");
          let ok = true, err = null;
          try { await window.AsyutApproval.perform(req.payload); } catch (e) { ok = false; err = e.message; }
          await rpc("layan_admin_finish_change", { p_id: id, p_ok: ok, p_note: err });
          A.setStatus(ok ? "تم اعتماد التعديل وتنفيذه." : "تعذر تنفيذ التعديل: " + err);
          loadRequests(); loaded.delete("users"); loaded.delete("listings");
          window.AsyutAdmin?.reload?.();
        } catch (e) { A.setStatus(e.message); }
        return;
      }
      try {
        const r = await rpc("layan_admin_decide_request", { p_id: id, p_approve: approve, p_note: note });
        A.setStatus(r === "approved" ? "تم اعتماد الطلب وتنفيذه." : r === "failed" ? "تعذر التنفيذ: العنصر غير موجود أو حُذف بالفعل." : "تم رفض الطلب.");
        loadRequests(); loaded.delete("users"); loaded.delete("listings");
      } catch (e) { A.setStatus(e.message); }
      return;
    }
    if (t.closest("[data-admin-add]")) {
      const email = panels.admins.querySelector("[data-admin-email]")?.value.trim();
      if (!email) return;
      if (!confirm("منح صلاحية الإدارة الكاملة للحساب " + email + "؟")) return;
      try { await rpc("layan_admin_set_admin", { p_email: email, p_enabled: true }); A.setStatus("تم منح صلاحية الإدارة."); loadAdmins(); } catch (e) { A.setStatus(e.message); }
      return;
    }
    const rm = t.closest("[data-admin-remove]");
    if (rm) {
      if (!confirm("إزالة صلاحية الإدارة من " + rm.dataset.adminRemove + "؟")) return;
      try { await rpc("layan_admin_set_admin", { p_email: rm.dataset.adminRemove, p_enabled: false }); A.setStatus("تمت إزالة الصلاحية."); loadAdmins(); } catch (e) { A.setStatus(e.message); }
    }
  });
  root.addEventListener("change", event => {
    if (event.target.matches("[data-overview-days]")) { panels.overview.dataset.days = event.target.value; loadOverview(); }
    if (event.target.matches("[data-activity-type], [data-activity-days]")) loadActivity();
    if (event.target.matches("[data-requests-status]")) { panels.requests.dataset.status = event.target.value; loadRequests(); }
  });
  root.addEventListener("keydown", event => { if (event.key === "Enter" && event.target.matches("[data-user-search]")) loadUsers(); });

  // "تحديث البيانات" reloads the review queues; the admin-ready event then refreshes the open tab.
  document.getElementById("adminRefreshAll")?.addEventListener("click", () => {
    if (A?.reload) A.reload(); else window.location.reload();
  });

  window.AsyutConsole = { open: name => { if (panels[name]) openTab(name); } };
  window.addEventListener("asyut:admin-ready", () => {
    A = window.AsyutAdmin;
    root.hidden = false;
    const current = root.querySelector('[data-admin-tab][aria-selected="true"]')?.dataset.adminTab || "overview";
    loaded.clear();
    openTab(current);
    refreshRequestsBadge();
  });
})();
