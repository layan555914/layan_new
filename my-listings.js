// ASYUT AQAR — «إعلاناتي»: the signed-in owner sees only their own listings and can edit them.
// - Not yet published: the edit goes straight into the request under review.
// - Already published: the published version stays visible; the edit waits for admin approval.
// - Owner actions that apply at once: mark sold/rented (or show again) and delete.
// Ownership is enforced on the server (layan_owner_* RPCs); this page only offers the controls.
document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const $ = id => document.getElementById(id);
  const grid = $("myListingsGrid"), propertyGrid = $("myPropertyOffersGrid"), status = $("myListingsStatus");
  const cfg = window.LAYAN_CONFIG || {}, base = String(cfg.SUPABASE_URL || "").replace(/\/$/, ""), key = cfg.SUPABASE_PUBLISHABLE_KEY || "";
  const auth = window.LAYAN_SUPABASE;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = v => v == null || v === "" ? "—" : Number(v).toLocaleString("ar-EG-u-nu-latn") + " جنيه";
  const MAX_OFFER_PHOTOS = 10, MAX_SERVICE_PHOTOS = 5;
  let offers = [], services = [];

  async function api(path, options = {}) {
    const session = await auth.requireAuthenticated();
    const r = await fetch(base + "/rest/v1/" + path, { ...options, headers: { apikey: key, Authorization: "Bearer " + session.access_token, "Content-Type": "application/json", ...(options.headers || {}) } });
    const raw = await r.text(); let data = null; try { data = raw ? JSON.parse(raw) : null; } catch (_) {}
    if (!r.ok) { const e = Error(data?.message || data?.details || "تعذر تنفيذ الطلب."); e.code = data?.code; e.status = r.status; throw e; }
    return data;
  }
  const rpc = (name, body) => api("rpc/" + name, { method: "POST", body: JSON.stringify(body) });
  const notReady = e => e && (e.code === "PGRST202" || e.status === 404);
  const say = text => { status.textContent = text; status.scrollIntoView({ block: "nearest", behavior: "smooth" }); };

  const OFFER_STATUS = { pending: "قيد المراجعة — لم يُنشر بعد", available: "منشور", reserved: "محجوز", sold: "تم البيع / التأجير" };
  const SERVICE_STATUS = { pending: "قيد المراجعة — لم يُنشر بعد", approved: "منشور", rejected: "مرفوض — عدّل البيانات وأعد الإرسال" };

  function editState(x) {
    if (x.update_status === "pending") return '<p class="my-listing-flag is-pending">✎ يوجد تعديل مُرسل للإدارة — يظهر النسخة المنشورة الحالية حتى يتم الاعتماد.</p>';
    if (x.update_status === "rejected") return '<p class="my-listing-note"><strong>لم يُعتمد آخر تعديل:</strong> ' + esc(x.update_notes || "راجع البيانات وأعد الإرسال.") + "</p>";
    return "";
  }
  function photos(list) {
    const imgs = (Array.isArray(list) ? list : []).filter(v => typeof v === "string" && /^(https:|data:image\/)/.test(v)).slice(0, 6);
    return imgs.length ? '<div class="my-listing-photos">' + imgs.map(src => '<img src="' + esc(src) + '" alt="" loading="lazy">').join("") + "</div>" : "";
  }

  function offerCard(x) {
    const published = ["available", "reserved", "sold"].includes(x.status);
    const rent = String(x.listing_purpose || "").includes("إيجار");
    const actions = ['<button type="button" class="btn btn-gold" data-act="edit">تعديل الإعلان</button>'];
    if (x.status === "available") actions.push('<button type="button" class="btn btn-outline" data-act="sold">' + (rent ? "تم التأجير" : "تم البيع") + "</button>");
    if (x.status === "sold" || x.status === "reserved") actions.push('<button type="button" class="btn btn-outline" data-act="available">إعادة النشر</button>');
    actions.push('<button type="button" class="btn btn-danger-soft" data-act="delete">حذف</button>');
    return '<article class="my-listing-card" data-kind="offer" data-id="' + esc(x.id) + '">' +
      '<div class="my-listing-top"><span class="my-listing-status status-' + esc(x.status) + '">' + esc(OFFER_STATUS[x.status] || x.status || "غير محدد") + "</span><small>" + esc(x.property_type || "عقار") + " · " + esc(x.listing_purpose || "تنازل") + "</small></div>" +
      "<h2>" + esc(x.title) + "</h2>" + photos(x.image_urls) +
      '<p><strong>الموقع:</strong> ' + esc(x.city || "أسيوط") + (x.area ? " · " + esc(x.area) : "") + "</p>" +
      "<p><strong>" + (rent ? "قيمة الإيجار" : "السعر") + ":</strong> " + money(x.total_price) + (x.area_m2 ? " · <strong>المساحة:</strong> " + esc(x.area_m2) + " م²" : "") + "</p>" +
      (x.contact_phone ? '<p><strong>رقم التواصل:</strong> <span dir="ltr">' + esc(x.contact_phone) + "</span></p>" : "") +
      (x.verification_notes ? '<p class="my-listing-note"><strong>ملاحظة المراجعة:</strong> ' + esc(x.verification_notes) + "</p>" : "") +
      editState(x) +
      (published ? "" : '<p class="my-listing-hint">الإعلان لسه في المراجعة — أي تعديل هيتحفظ في نفس الطلب.</p>') +
      '<div class="my-listing-actions">' + actions.join("") + "</div></article>";
  }

  function serviceCard(x) {
    const details = Object.entries(x.details || {}).filter(([, v]) => String(v ?? "").trim()).slice(0, 10);
    return '<article class="my-listing-card" data-kind="service" data-id="' + esc(x.id) + '">' +
      '<div class="my-listing-top"><span class="my-listing-status status-' + esc(x.status) + '">' + esc(SERVICE_STATUS[x.status] || x.status) + "</span><small>" + esc(x.category) + " · " + esc(x.listing_type) + "</small></div>" +
      "<h2>" + esc(x.title) + "</h2>" + photos(x.image_urls) + "<p>" + esc(x.description) + "</p>" +
      "<p><strong>الموقع:</strong> " + esc(x.city) + (x.area ? " · " + esc(x.area) : "") + "</p>" +
      "<p><strong>السعر:</strong> " + (x.price == null ? "عند التواصل" : money(x.price) + " " + esc(x.price_period || "")) + "</p>" +
      (details.length ? '<div class="my-listing-detail-chips">' + details.map(([k, v]) => "<span>" + esc(k.replace(/_/g, " ")) + ": " + esc(v) + "</span>").join("") + "</div>" : "") +
      (x.admin_notes ? '<p class="my-listing-note"><strong>ملاحظة الإدارة:</strong> ' + esc(x.admin_notes) + "</p>" : "") +
      editState(x) +
      '<div class="my-listing-actions"><button type="button" class="btn btn-gold" data-act="edit">تعديل الإعلان</button><button type="button" class="btn btn-danger-soft" data-act="delete">حذف</button></div></article>';
  }

  // ---------- Edit dialog ----------
  const OFFER_FIELDS = [
    ["title", "عنوان الإعلان", "text", { required: true, maxlength: 160, wide: true }],
    ["listing_purpose", "نوع الإعلان", "select", { options: [["تنازل", "تنازل عقاري"], ["بيع", "بيع مباشر"], ["إيجار", "إيجار"]] }],
    ["property_type", "نوع العقار", "select", { options: ["شقة", "فيلا", "محل", "مكتب إداري", "عيادة طبية", "مخزن", "معرض", "مشروع عقاري", "أرض مطروحة للبناء", "أرض تنازل"].map(v => [v, v]) }],
    ["city", "المدينة / المركز", "text", { list: "asyut-centers" }],
    ["area", "الحي / المنطقة", "text"],
    ["area_m2", "المساحة (م²)", "number"],
    ["bedrooms", "غرف النوم", "int"],
    ["bathrooms", "الحمامات", "int"],
    ["total_price", "السعر / قيمة الإيجار (جنيه)", "number"],
    ["down_payment", "المقدم", "number"],
    ["paid_amount", "إجمالي المدفوع", "number"],
    ["remaining_amount", "المبلغ المتبقي", "number"],
    ["monthly_installment", "القسط الشهري", "number"],
    ["remaining_installments", "عدد الأقساط المتبقية", "int"],
    ["assignment_fee", "رسوم التنازل", "number"],
    ["discount_amount", "قيمة الخصم", "number"],
    ["developer_name", "المطور / الشركة", "text"],
    ["project_name", "اسم المشروع", "text"],
    ["contact_name", "اسم التواصل", "text"],
    ["contact_phone", "رقم التواصل", "tel", { required: true, maxlength: 30 }],
    ["land_area_m2", "مساحة الأرض (م²) — للأراضي", "number"],
    ["land_zoning", "استخدام الأرض — للأراضي", "text"],
    ["description", "الوصف", "textarea", { maxlength: 3000, wide: true }]
  ];
  const SERVICE_FIELDS = [
    ["title", "عنوان الإعلان", "text", { required: true, maxlength: 160, wide: true }],
    ["city", "المدينة / المركز", "text", { list: "asyut-centers" }],
    ["area", "الحي / المنطقة", "text"],
    ["price", "السعر بالجنيه (اتركه فارغًا = عند التواصل)", "number"],
    ["price_period", "فترة السعر (مثال: شهريًا)", "text"],
    ["contact_phone", "رقم التواصل", "tel", { required: true, maxlength: 30 }],
    ["whatsapp", "واتساب", "tel", { maxlength: 30 }],
    ["description", "الوصف", "textarea", { required: true, maxlength: 3000, wide: true }]
  ];

  const dialog = document.createElement("dialog");
  dialog.className = "my-edit-dialog";
  dialog.innerHTML = '<form method="dialog" class="my-edit-form" novalidate><div class="my-edit-head"><h2 id="myEditTitle">تعديل الإعلان</h2><button type="button" class="my-edit-close" data-close aria-label="إغلاق">×</button></div>' +
    '<p class="my-edit-intro" id="myEditIntro"></p><div class="my-edit-fields" id="myEditFields"></div>' +
    '<fieldset class="my-edit-photos"><legend>الصور</legend><div class="my-edit-photo-list" id="myEditPhotos"></div>' +
    '<label class="my-edit-add">＋ إضافة صور جديدة<input type="file" id="myEditFiles" accept="image/*" multiple data-camera-ready="1"></label><small id="myEditPhotoHint"></small></fieldset>' +
    '<p class="my-edit-status" id="myEditStatus" role="status" aria-live="polite"></p>' +
    '<div class="my-edit-foot"><button type="submit" class="btn btn-gold" id="myEditSave">حفظ التعديل</button><button type="button" class="btn btn-outline" data-close>إلغاء</button></div></form>' +
    '<datalist id="asyut-centers">' + ["مدينة أسيوط", "أسيوط الجديدة", "ديروط", "القوصية", "منفلوط", "أبنوب", "الفتح", "ساحل سليم", "البداري", "أبو تيج", "صدفا", "الغنايم"].map(v => '<option value="' + v + '">').join("") + "</datalist>";
  document.body.appendChild(dialog);
  const form = dialog.querySelector("form"), fieldsBox = $("myEditFields"), photoBox = $("myEditPhotos"), filesInput = $("myEditFiles"), editStatus = $("myEditStatus");
  let editing = null; // { kind, row, fields, items:[{src, url?|file?|data?}] } — items[0] is the cover photo

  function fieldHtml([name, label, type, opt = {}], value) {
    const req = opt.required ? " required" : "", max = opt.maxlength ? ' maxlength="' + opt.maxlength + '"' : "";
    let control;
    if (type === "select") {
      const opts = opt.options.slice();
      if (value && !opts.some(([v]) => v === value)) opts.unshift([value, value]);
      control = '<select name="' + name + '"' + req + ">" + opts.map(([v, t]) => '<option value="' + esc(v) + '"' + (v === value ? " selected" : "") + ">" + esc(t) + "</option>").join("") + "</select>";
    } else if (type === "textarea") {
      control = '<textarea name="' + name + '" rows="4"' + req + max + ">" + esc(value) + "</textarea>";
    } else {
      const inputType = type === "int" || type === "number" ? "number" : type;
      const step = type === "int" ? ' step="1" min="0"' : type === "number" ? ' step="any" min="0" inputmode="decimal"' : "";
      control = '<input name="' + name + '" type="' + inputType + '"' + step + req + max + (opt.list ? ' list="' + opt.list + '"' : "") + (type === "tel" ? ' dir="ltr" inputmode="tel"' : "") + ' value="' + esc(value) + '">';
    }
    return '<label class="' + (opt.wide ? "is-wide" : "") + '" data-field="' + name + '">' + esc(label) + control + "</label>";
  }

  function renderPhotos() {
    const max = editing.kind === "offer" ? MAX_OFFER_PHOTOS : MAX_SERVICE_PHOTOS;
    const all = editing.items;
    photoBox.innerHTML = all.length ? all.map((p, i) => '<figure class="' + (i === 0 ? "is-cover" : "") + '"><img src="' + esc(p.src) + '" alt="">' +
      '<button type="button" class="my-edit-remove" data-remove="' + i + '" aria-label="حذف الصورة">×</button>' +
      (i === 0 ? '<figcaption class="my-edit-cover-tag">★ صورة الغلاف</figcaption>' : '<button type="button" class="my-edit-cover" data-cover="' + i + '">اجعلها الغلاف</button>') +
      (p.url ? "" : '<span class="my-edit-new">جديدة</span>') + "</figure>").join("") : '<p class="my-edit-empty">لا توجد صور.</p>';
    $("myEditPhotoHint").textContent = all.length + " / " + max + " صور — «صورة الغلاف» هي اللي بتظهر في مربع الإعلان الخارجي. اضغط «اجعلها الغلاف» لتغييرها، و× للحذف.";
    filesInput.disabled = all.length >= max;
  }

  // Bedrooms only for homes; bathrooms not for land/projects (same rule as the add form).
  function syncTypeFields() {
    const typeSel = fieldsBox.querySelector('[name="property_type"]');
    if (!typeSel) return;
    const t = String(typeSel.value || "");
    const kind = window.LAYAN_PROPERTY_KIND ? window.LAYAN_PROPERTY_KIND(t)
      : /مشروع|كمبوند|طرح/.test(t) ? "project" : /أرض|ارض/.test(t) ? "land"
      : /شقة|فيلا|دوبلكس|دوبليكس|روف|استوديو|ستوديو|منزل|بيت|شاليه|سكني/.test(t) ? "residential" : "commercial";
    const bed = fieldsBox.querySelector('[data-field="bedrooms"]'), bath = fieldsBox.querySelector('[data-field="bathrooms"]');
    if (bed) bed.hidden = kind !== "residential";
    if (bath) bath.hidden = kind === "land" || kind === "project";
    const land = fieldsBox.querySelectorAll('[data-field="land_area_m2"], [data-field="land_zoning"]');
    land.forEach(n => { n.hidden = kind !== "land"; });
  }
  fieldsBox.addEventListener("change", e => { if (e.target.name === "property_type") syncTypeFields(); });

  function openEdit(kind, row) {
    const fields = kind === "offer" ? OFFER_FIELDS : SERVICE_FIELDS;
    const source = row.update_status === "pending" && row.pending_update ? { ...row, ...row.pending_update } : row;
    editing = { kind, row, fields, items: (Array.isArray(source.image_urls) ? source.image_urls : []).filter(v => typeof v === "string").map(u => ({ src: u, url: u })) };
    $("myEditTitle").textContent = "تعديل: " + (row.title || "الإعلان");
    const published = kind === "offer" ? ["available", "reserved", "sold"].includes(row.status) : row.status === "approved";
    $("myEditIntro").textContent = published
      ? "إعلانك منشور. التعديل هيتبعت للإدارة للمراجعة، والنسخة الحالية هتفضل ظاهرة للناس لحد ما يتم الاعتماد."
      : "إعلانك لسه في المراجعة. التعديل هيتحفظ في نفس الطلب قبل النشر.";
    fieldsBox.innerHTML = fields.map(f => fieldHtml(f, source[f[0]] ?? "")).join("");
    editStatus.textContent = "";
    filesInput.value = "";
    renderPhotos();
    syncTypeFields();
    $("myEditSave").disabled = false;
    dialog.showModal();
  }

  async function serviceDataUrl(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
    if (typeof window.LAYAN_WATERMARK === "function") window.LAYAN_WATERMARK(ctx, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", .68);
    if (data.length > 380000) throw Error("إحدى الصور كبيرة بعد الضغط؛ اختر صورة أصغر.");
    return data;
  }

  filesInput.addEventListener("change", async () => {
    if (!editing) return;
    const max = editing.kind === "offer" ? MAX_OFFER_PHOTOS : MAX_SERVICE_PHOTOS;
    const files = Array.from(filesInput.files || []);
    filesInput.value = "";
    for (const file of files) {
      if (editing.items.length >= max) { editStatus.textContent = "وصلت للحد الأقصى (" + max + " صور)."; break; }
      if (file.size > 15 * 1024 * 1024) { editStatus.textContent = "حجم الصورة يجب ألا يتجاوز 15 ميجابايت."; continue; }
      try {
        if (editing.kind === "offer") {
          const jpg = typeof window.LAYAN_TO_JPEG === "function" ? await window.LAYAN_TO_JPEG(file) : file;
          editing.items.push({ file: jpg, src: URL.createObjectURL(jpg) });
        } else {
          const data = await serviceDataUrl(file);
          editing.items.push({ data, src: data });
        }
      } catch (e) { editStatus.textContent = e.message || "تعذر قراءة الصورة. جرّب صورة أخرى."; }
    }
    renderPhotos();
  });
  photoBox.addEventListener("click", e => {
    if (!editing) return;
    const rm = e.target.closest("[data-remove]"), cv = e.target.closest("[data-cover]");
    if (rm) editing.items.splice(Number(rm.dataset.remove), 1);
    else if (cv) editing.items.unshift(editing.items.splice(Number(cv.dataset.cover), 1)[0]);
    else return;
    renderPhotos();
  });
  dialog.addEventListener("click", e => { if (e.target.closest("[data-close]")) dialog.close(); });

  function readChanges() {
    const fd = new FormData(form), changes = {};
    for (const [name, label, type, opt = {}] of editing.fields) {
      let v = String(fd.get(name) ?? "").trim();
      if (opt.required && !v) throw Error("املأ خانة «" + label + "».");
      if (type === "number" || type === "int") {
        if (v === "") v = null;
        else { const n = Number(v); if (!Number.isFinite(n) || n < 0) throw Error("قيمة غير صحيحة في «" + label + "»."); v = type === "int" ? Math.round(n) : n; }
      } else if (v === "" && !opt.required) v = null;
      const old = editing.row[name];
      const same = (old ?? null) === v || (old != null && v != null && String(old) === String(v));
      if (!same) changes[name] = v;
    }
    if (changes.title !== undefined && String(changes.title).length < 3) throw Error("العنوان قصير جدًا.");
    return changes;
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!editing) return;
    const button = $("myEditSave");
    let uploaded = [];
    try {
      const changes = readChanges();
      button.disabled = true;
      if (editing.kind === "offer") {
        const fresh = editing.items.filter(it => it.file);
        if (fresh.length) {
          editStatus.textContent = "جارٍ رفع الصور الجديدة...";
          uploaded = await auth.uploadImages(fresh.map(it => it.file));
        }
        let n = 0;
        const images = editing.items.map(it => it.url || (it.file ? uploaded[n++] : null)).filter(Boolean);
        if (JSON.stringify(images) !== JSON.stringify(editing.row.image_urls || [])) changes.image_urls = images;
      } else {
        const images = editing.items.map(it => it.url || it.data).filter(Boolean);
        if (JSON.stringify(images) !== JSON.stringify(editing.row.image_urls || [])) changes.image_urls = images;
      }
      if (!Object.keys(changes).length) { editStatus.textContent = "لم تغيّر أي بيانات."; button.disabled = false; return; }
      editStatus.textContent = "جارٍ حفظ التعديل...";
      const result = editing.kind === "offer"
        ? await rpc("layan_owner_update_offer", { p_id: Number(editing.row.id), p_changes: changes })
        : await rpc("layan_owner_update_service", { p_id: editing.row.id, p_changes: changes });
      dialog.close();
      say(result === "pending"
        ? "تم إرسال التعديل للإدارة ✓ — النسخة المنشورة هتفضل ظاهرة لحد ما يتم الاعتماد."
        : result === "unchanged" ? "لم تتغير أي بيانات." : "تم حفظ التعديل ✓ — الإعلان في انتظار المراجعة قبل النشر.");
      await load();
    } catch (err) {
      if (uploaded.length) auth.deleteUploadedImages?.(uploaded).catch(() => {});
      editStatus.textContent = notReady(err) ? "خاصية التعديل قيد التفعيل الآن — جرّب بعد قليل." : (err.message || "تعذر حفظ التعديل.");
      button.disabled = false;
    }
  });

  // ---------- Card actions ----------
  async function onAction(e) {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const card = btn.closest("[data-id]"), kind = card.dataset.kind, id = card.dataset.id;
    const row = (kind === "offer" ? offers : services).find(x => String(x.id) === id);
    if (!row) return;
    const act = btn.dataset.act;
    if (act === "edit") return openEdit(kind, row);
    if (act === "delete" && btn.dataset.confirm !== "1") {
      btn.dataset.confirm = "1"; btn.textContent = "اضغط مرة تانية لتأكيد الحذف";
      setTimeout(() => { if (btn.isConnected) { btn.dataset.confirm = ""; btn.textContent = "حذف"; } }, 5000);
      return;
    }
    btn.disabled = true;
    try {
      if (act === "delete") {
        await rpc(kind === "offer" ? "layan_owner_delete_offer" : "layan_owner_delete_service", { p_id: kind === "offer" ? Number(id) : id });
        say("تم حذف الإعلان.");
      } else {
        await rpc("layan_owner_set_offer_status", { p_id: Number(id), p_status: act });
        say(act === "sold" ? "تم تعليم الإعلان «تم البيع / التأجير» واختفى من العروض المتاحة." : "تمت إعادة نشر الإعلان.");
      }
      await load();
    } catch (err) {
      say(notReady(err) ? "هذه الخاصية قيد التفعيل الآن — جرّب بعد قليل." : (err.message || "تعذر تنفيذ الطلب."));
      btn.disabled = false;
    }
  }
  grid.addEventListener("click", onAction);
  propertyGrid?.addEventListener("click", onAction);

  // ---------- Loading ----------
  const EXTRA = ",pending_update,update_status,update_notes";
  const SERVICE_COLS = "id,category,listing_type,title,description,city,area,price,price_period,contact_phone,whatsapp,status,admin_notes,details,image_urls,created_at";
  const OFFER_COLS = "id,title,property_type,listing_purpose,city,area,area_m2,bedrooms,bathrooms,total_price,down_payment,paid_amount,remaining_amount,monthly_installment,remaining_installments,assignment_fee,discount_amount,developer_name,project_name,contact_name,contact_phone,land_area_m2,land_zoning,description,image_urls,status,verification_notes,created_at";
  async function fetchMine(table, cols, owner) {
    const q = c => table + "?select=" + c + "&owner_id=eq." + owner + "&order=created_at.desc";
    try { return await api(q(cols + EXTRA)); }
    catch (e) { if (e.code === "42703" || e.status === 400) return api(q(cols)); throw e; } // before the edit columns exist
  }
  async function load() {
    try {
      const session = await auth.requireAuthenticated();
      const owner = encodeURIComponent(session.user.id);
      [services, offers] = await Promise.all([fetchMine("marketplace_listings", SERVICE_COLS, owner), fetchMine("property_offers", OFFER_COLS, owner)]);
      grid.innerHTML = services.length ? services.map(serviceCard).join("") : '<p class="my-listings-empty">لا توجد إعلانات في سوق الخدمات حتى الآن. <a href="./marketplace.html">أضف خدمة</a></p>';
      if (propertyGrid) propertyGrid.innerHTML = offers.length ? offers.map(offerCard).join("") : '<p class="my-listings-empty">لا توجد إعلانات عقارية مرتبطة بحسابك حتى الآن. <a href="./?add=1">أضف عقارك</a></p>';
      if (!/✓|تم /.test(status.textContent)) status.textContent = "دي إعلاناتك أنت بس — تقدر تعدّلها أو تحذفها في أي وقت.";
    } catch (e) {
      status.textContent = e.message || "سجّل الدخول من الصفحة الرئيسية ثم افتح إعلاناتي مرة أخرى.";
      grid.innerHTML = '<a class="btn btn-gold" href="./">تسجيل الدخول</a>';
      if (propertyGrid) propertyGrid.innerHTML = "";
    }
  }

  async function loadBusinessRequests() {
    const companyGrid = $("myCompanyRequestsGrid"), supplierGrid = $("mySupplierRequestsGrid");
    if (!companyGrid && !supplierGrid) return;
    try {
      const session = await auth.requireAuthenticated(), owner = encodeURIComponent(session.user.id);
      const [companyProfile, suppliers] = await Promise.all([
        companyGrid ? api("rpc/layan_company_owner_profile", { method: "POST", body: "{}" }) : null,
        supplierGrid ? api("supplier_ads?select=id,business_name,category,title,status,created_at&owner_id=eq." + owner + "&order=created_at.desc") : null
      ]);
      const companies = companyProfile ? [companyProfile] : [];
      const labels = { pending: "قيد المراجعة", active: "منشور", approved: "منشور", needs_changes: "مطلوب استكمال البيانات", rejected: "مرفوض", paused: "موقوف" };
      if (companyGrid) companyGrid.innerHTML = companies.length ? companies.map(x => '<article class="my-listing-card"><div class="my-listing-top"><span class="my-listing-status">' + esc(labels[x.status] || x.status || "غير محدد") + "</span><small>" + esc(x.category || "") + "</small></div><h2>" + esc(x.company_name) + "</h2>" +
        (x.admin_notes ? '<p class="my-listing-note"><strong>ملاحظة الإدارة:</strong> ' + esc(x.admin_notes) + "</p>" : "") +
        (x.update_status ? '<p class="my-listing-flag is-pending">حالة التعديلات: ' + esc(labels[x.update_status] || x.update_status) + "</p>" : "") +
        (x.update_notes ? '<p class="my-listing-note"><strong>ملاحظات التعديلات:</strong> ' + esc(x.update_notes) + "</p>" : "") +
        '<div class="my-listing-actions"><a class="btn btn-gold" href="./companies.html?edit=1">تعديل ملف الشركة</a></div></article>').join("") : '<p class="my-listings-empty">لا يوجد ملف شركة مرتبط بحسابك. <a href="./companies.html">سجّل شركتك</a></p>';
      if (supplierGrid) supplierGrid.innerHTML = suppliers?.length ? suppliers.map(x => '<article class="my-listing-card"><div class="my-listing-top"><span class="my-listing-status">' + esc(labels[x.status] || x.status || "غير محدد") + "</span><small>" + esc(x.category || "") + "</small></div><h2>" + esc(x.title) + "</h2><p><strong>النشاط:</strong> " + esc(x.business_name) + "</p></article>").join("") : '<p class="my-listings-empty">لا توجد طلبات إعلانات موردين مرتبطة بحسابك.</p>';
    } catch (e) {
      const message = '<p class="my-listings-empty">تعذر تحميل طلبات الشركات الآن. ' + esc(e.message || "حاول تحديث الصفحة.") + "</p>";
      if (companyGrid) companyGrid.innerHTML = message; if (supplierGrid) supplierGrid.innerHTML = message;
    }
  }

  load();
  loadBusinessRequests();
});
