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
  const pendingNote = '<p class="admin-empty admin-pending">هذه الأداة تحتاج تطبيق تحديث قاعدة البيانات «مركز التحكم» (20261108120000) بعد موافقة المالك. باقي أقسام الإدارة تعمل كالمعتاد.</p>';
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
          <section><h3>الزوار حسب المنطقة</h3><ul class="admin-bars">${bar(s.by_region || [], "region", "visitors")}</ul></section>
          <section><h3>أكثر الصفحات زيارة</h3><ul class="admin-bars">${bar(s.by_page || [], "page", "views")}</ul></section>
          <section><h3>أكثر الإعلانات تواصلًا</h3><ul class="admin-bars">${bar((s.top_listings || []).map(x => ({ ...x, label: "ASY-" + String(x.listing_id).padStart(4, "0") + " · " + x.views + " مشاهدة" })), "label", "contacts")}</ul></section>
          <section><h3>الزوار يوميًا</h3><ul class="admin-bars">${bar((s.by_day || []).slice(-14), "day", "visitors")}</ul></section>
        </div>
        <p class="admin-note">المنطقة تقريبية من إعدادات المتصفح (المنطقة الزمنية واللغة)، ولا تُجمع عناوين IP أو مواقع دقيقة.</p>`;
    } catch (error) {
      panel.innerHTML = needsMigration(error) ? pendingNote : `<p class="admin-empty">${esc(error.message)}</p>`;
    }
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
      const contacts = events.filter(e => /^contact_/.test(e.event_type));
      box.innerHTML = `<header><h3>ملف العميل: ${esc(user.full_name || user.email)}</h3><button type="button" class="btn btn-outline-dark" data-export="profile" data-user-id="${esc(id)}">تنزيل Excel</button></header>
        <div class="admin-kpis"><div><strong>${events.length}</strong><span>حركة مسجلة</span></div><div><strong>${contacts.length}</strong><span>مرة تواصل</span></div><div><strong>${esc(user.listings_count)}</strong><span>إعلانات</span></div><div><strong>${esc(ACCOUNT[user.account_type] || "—")}</strong><span>نوع الحساب</span></div></div>
        <p><b>البريد:</b> ${esc(user.email)} · <b>الموبايل:</b> <span dir="ltr">${esc(user.phone || "—")}</span> · <b>التسجيل:</b> ${date(user.created_at)} · <b>آخر نشاط:</b> ${date(user.last_seen)}</p>
        <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>الوقت</th><th>الحركة</th><th>الصفحة</th><th>الإعلان</th><th>التفاصيل</th><th>المنطقة</th></tr></thead><tbody>${events.slice(0, 300).map(e => `<tr><td>${date(e.created_at)}</td><td>${esc(TYPES[e.event_type] || e.event_type)}</td><td>${esc(e.page || "")}</td><td>${e.listing_id ? "ASY-" + String(e.listing_id).padStart(4, "0") : ""}</td><td>${esc(e.target || "")}</td><td>${esc(e.region || "")}</td></tr>`).join("") || '<tr><td colspan="6">لا توجد حركة مسجلة لهذا العميل بعد.</td></tr>'}</tbody></table></div>`;
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
      panel.innerHTML = toolbar(`<label>النوع <select data-activity-type><option value="contact" ${type === "contact" ? "selected" : ""}>التواصل فقط (اتصال / واتساب)</option><option value="all" ${type === "all" ? "selected" : ""}>كل الحركة</option>${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${type === k ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>الفترة <select data-activity-days>${[1, 7, 30, 90, 365].map(d => `<option value="${d}" ${d === days ? "selected" : ""}>آخر ${d} يوم</option>`).join("")}</select></label><button class="btn btn-gold" type="button" data-export="activity">تنزيل Excel</button><span class="admin-pill">${activityCache.length} حركة</span>`) +
        `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>الوقت</th><th>الحركة</th><th>العميل</th><th>الإعلان</th><th>الصفحة</th><th>التفاصيل</th><th>الجهاز</th><th>المنطقة</th></tr></thead><tbody>` +
        activityCache.slice(0, 1000).map(e => { const u = users.get(e.user_id); return `<tr><td>${date(e.created_at)}</td><td>${esc(TYPES[e.event_type] || e.event_type)}</td><td>${u ? esc(u.full_name || u.email) : e.user_id ? "حساب مسجل" : "زائر"}</td><td>${e.listing_id ? `<a href="./property.html?id=${esc(e.listing_id)}" target="_blank">ASY-${String(e.listing_id).padStart(4, "0")}</a>` : ""}</td><td>${esc(e.page || "")}</td><td>${esc(e.target || "")}</td><td>${esc(e.device || "")}</td><td>${esc(e.region || "")}</td></tr>`; }).join("") +
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
      const offers = await A.request("/rest/v1/property_offers?select=id,title,listing_purpose,property_type,city,area,total_price,contact_name,contact_phone,owner_id,status,created_at&order=created_at.desc&limit=1000") || [];
      const services = await A.request("/rest/v1/marketplace_listings?select=id,title,category,city,area,contact_phone,status,created_at&order=created_at.desc&limit=1000").catch(() => []) || [];
      listingsCache = [...offers.map(o => ({ kind: "عقار", ...o })), ...services.map(s => ({ kind: "خدمة", ...s }))];
      panel.innerHTML = toolbar(`<button class="btn btn-gold" type="button" data-export="listings">تنزيل Excel</button><span class="admin-pill">${offers.length} عقار · ${services.length} خدمة</span>`) +
        `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>النوع</th><th>الكود</th><th>العنوان</th><th>القسم</th><th>المكان</th><th>المعلن</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th></tr></thead><tbody>` +
        listingsCache.map(x => `<tr data-listing="${esc(x.id)}" data-kind="${x.kind === "عقار" ? "offer" : "service"}"><td>${x.kind}</td><td>${x.kind === "عقار" ? "ASY-" + String(x.id).padStart(4, "0") : "#" + esc(x.id)}</td><td>${esc(x.title)}</td><td>${esc(x.property_type ? x.property_type + " · " + (x.listing_purpose || "") : x.category || "")}</td><td>${esc([x.city, x.area].filter(Boolean).join("، "))}</td><td>${esc(x.contact_name || "")} <span dir="ltr">${esc(x.contact_phone || "")}</span></td><td>${esc(x.status)}</td><td>${date(x.created_at)}</td>
          <td class="admin-actions-cell">${x.kind === "عقار" ? `<a href="./property.html?id=${esc(x.id)}" target="_blank">فتح</a>` : ""}<button type="button" class="is-danger" data-listing-delete>حذف</button></td></tr>`).join("") +
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
      panel.innerHTML = `<p>الحساب العادي لا يدخل لوحة الإدارة أبدًا. أضف هنا حسابات مسجلة بالفعل لتصبح «إدارة»، أو أزل الصلاحية. حسابات المالك ثابتة ولا تُزال من هنا، ومنح الصلاحية أو إزالتها للمالك فقط. المدير المضاف يراجع ويطلب الحذف، والمالك يعتمد.</p>` +
        toolbar(`<input type="email" data-admin-email placeholder="بريد الحساب المسجل"><button class="btn btn-gold" type="button" data-admin-add>منح صلاحية الإدارة</button>`) +
        `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>البريد</th><th>تاريخ المنح</th><th>إجراء</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.email)}</td><td>${date(r.added_at)}</td><td><button type="button" class="is-danger" data-admin-remove="${esc(r.email)}">إزالة الصلاحية</button></td></tr>`).join("") || '<tr><td colspan="3">لا توجد حسابات إدارة إضافية. المالك الأساسي فقط.</td></tr>'}</tbody></table></div>`;
    } catch (error) {
      panel.innerHTML = needsMigration(error) ? pendingNote : `<p class="admin-empty">${esc(error.message)}</p>`;
    }
  }

  // ---- Owner approval requests ----
  const ACTIONS = { delete_user: "حذف حساب", suspend_user: "إيقاف حساب", unsuspend_user: "إعادة تفعيل حساب", delete_offer: "حذف إعلان عقار", delete_service: "حذف خدمة" };
  const STATES = { pending: "بانتظار المالك", approved: "تم الاعتماد والتنفيذ", rejected: "مرفوض", failed: "تعذر التنفيذ" };
  const done = (result, doneText) => result === "pending"
    ? "تم إرسال الطلب إلى المالك للاعتماد. سيُنفَّذ بعد موافقته."
    : doneText;
  async function refreshRequestsBadge() {
    try {
      const rows = await rpc("layan_admin_list_requests", { p_status: "pending" }) || [];
      const badge = root.querySelector("[data-requests-count]");
      if (badge) { badge.textContent = rows.length; badge.hidden = !rows.length; }
    } catch (_) {}
  }
  async function loadRequests() {
    const panel = panels.requests;
    panel.innerHTML = '<p class="admin-empty">جارٍ تحميل الطلبات...</p>';
    try {
      const status = panel.dataset.status ?? "pending";
      const rows = await rpc("layan_admin_list_requests", { p_status: status || null }) || [];
      const isOwner = rows.some(r => r.can_decide);
      panel.innerHTML = `<p>حذف الحسابات والإعلانات وإيقاف الحسابات بواسطة أي مدير مضاف يصل هنا أولًا، ولا يُنفَّذ إلا بعد اعتماد المالك. ما ينفذه المالك بنفسه يُنفَّذ مباشرة.</p>` +
        toolbar(`<label>العرض <select data-requests-status>${[["pending", "بانتظار الاعتماد"], ["", "كل الطلبات"], ["approved", "المعتمدة"], ["rejected", "المرفوضة"]].map(([v, l]) => `<option value="${v}" ${v === status ? "selected" : ""}>${l}</option>`).join("")}</select></label>`) +
        `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>الطلب</th><th>العنصر</th><th>مقدم الطلب</th><th>التاريخ</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${rows.map(r => `<tr data-request="${esc(r.id)}"><td>${esc(ACTIONS[r.action] || r.action)}</td><td>${esc(r.target_label || r.target)}</td><td>${esc(r.requested_by_email || "")}</td><td>${date(r.created_at)}</td><td>${esc(STATES[r.status] || r.status)}${r.note ? `<br><small>${esc(r.note)}</small>` : ""}</td><td>${r.can_decide ? `<button type="button" class="btn btn-gold" data-request-decide="1">اعتماد وتنفيذ</button> <button type="button" class="is-danger" data-request-decide="0">رفض</button>` : (r.status === "pending" ? "بانتظار المالك" : (r.decided_by_email ? esc(r.decided_by_email) : ""))}</td></tr>`).join("") || '<tr><td colspan="6">لا توجد طلبات.</td></tr>'}</tbody></table></div>` +
        (isOwner || !rows.length ? "" : '<p class="admin-empty">الاعتماد متاح لحسابات المالك فقط.</p>');
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
        const r = await rpc(lrow.dataset.kind === "offer" ? "layan_admin_delete_property_offer" : "layan_admin_delete_marketplace_listing", { p_id: lrow.dataset.kind === "offer" ? Number(lrow.dataset.listing) : String(lrow.dataset.listing) });
        A.setStatus(done(r, "تم حذف الإعلان.")); loadListings(); refreshRequestsBadge();
      } catch (e) { A.setStatus(needsMigration(e) ? "حذف الإعلانات يحتاج تطبيق تحديث قاعدة البيانات أولًا." : e.message); }
      return;
    }
    const dec = t.closest("[data-request-decide]");
    if (dec) {
      const approve = dec.dataset.requestDecide === "1";
      const id = Number(dec.closest("[data-request]").dataset.request);
      if (!confirm(approve ? "اعتماد الطلب وتنفيذه الآن؟ الحذف لا يمكن التراجع عنه." : "رفض هذا الطلب؟")) return;
      const note = approve ? null : (prompt("سبب الرفض (اختياري)") || null);
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

  window.addEventListener("asyut:admin-ready", () => {
    A = window.AsyutAdmin;
    root.hidden = false;
    const current = root.querySelector('[data-admin-tab][aria-selected="true"]')?.dataset.adminTab || "overview";
    loaded.clear();
    openTab(current);
    refreshRequestsBadge();
  });
})();
