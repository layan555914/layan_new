// ASYUT AQAR admin — direct ad creation and editing on behalf of existing customer accounts.
// All writes still pass through Supabase RLS. The database migration grants these paths
// only to layan_is_admin(), and blocks owner_id reassignment after a row is created.
(() => {
  "use strict";
  let A = null;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
  const safeImageUrl = value => { try { const u = new URL(String(value || "")); return ["https:","http:"].includes(u.protocol) ? u.href : ""; } catch (_) { return ""; } };
  const rpc = (name, body = {}) => A.request("/rest/v1/rpc/" + name, { method:"POST", body:JSON.stringify(body) });
  const endpoint = {
    property_offer: "property_offers",
    marketplace_listing: "marketplace_listings",
    supplier_ad: "supplier_ads",
    company_ad: "company_property_ads"
  };
  const labels = {
    property_offer: "عقار",
    marketplace_listing: "إعلان سوق الخدمات",
    supplier_ad: "إعلان ممول",
    company_ad: "طلب إعلان شركة"
  };
  const categories = [
    "سوق العقارات","التنازلات العقارية","أراضي للبيع","أراضي التنازلات","إيجار يومي ومفروش",
    "الشركات والمكاتب العقارية","مواد البناء والتشطيب","الأثاث والفرش وتجهيز الوحدات",
    "المشروعات والمطورون العقاريون","الصيانة وإدارة العقارات","الاستشارات والخدمات العقارية",
    "مكاتب التصميم الهندسي","مهندسو الديكور والتصميم الداخلي","السيراميك والبورسلين والأدوات الصحية",
    "الإضاءة ووحدات الإنارة","الستائر والمفروشات"
  ];
  const propertyTypes = ["شقة","فيلا","محل","أرض","مكتب","عمارة","منزل","مخزن","وحدة تجارية","أخرى"];
  const purposes = ["بيع","إيجار","تنازل"];
  const specs = {
    property_offer: [
      ["title","عنوان الإعلان","text",true],["property_type","نوع العقار","select",true,propertyTypes],
      ["listing_purpose","الغرض","select",true,purposes],["city","المدينة / المركز","text",false],
      ["area","الحي / المنطقة","text",false],["area_m2","المساحة بالمتر","number",false],
      ["bedrooms","عدد الغرف","number",false],["bathrooms","عدد الحمامات","number",false],
      ["land_ownership_authority","جهة ملكية الأرض","text",false],["land_permit_details","تفاصيل الترخيص","text",false],
      ["land_utilities","المرافق","text",false],["land_zoning","الاشتراطات / الاستخدام","text",false],
      ["total_price","السعر الإجمالي","number",false],["price_on_request","السعر عند التواصل","checkbox",false],
      ["down_payment","المقدم","number",false],["paid_amount","المبلغ المدفوع","number",false],
      ["remaining_amount","المتبقي","number",false],["monthly_installment","القسط الشهري","number",false],
      ["assignment_fee","رسوم التنازل","number",false],["assignment_fee_percentage","نسبة رسوم التنازل","number",false],
      ["discount_amount","قيمة الخصم","number",false],["discount_percent","نسبة الخصم","number",false],
      ["developer_name","اسم المطور","text",false],["project_name","اسم المشروع","text",false],
      ["latitude","خط العرض","number",false],["longitude","خط الطول","number",false],
      ["contact_name","اسم المعلن","text",false],["contact_phone","رقم التواصل","tel",false],
      ["description","الوصف","textarea",false]
    ],
    marketplace_listing: [
      ["title","عنوان الإعلان","text",true],["category","القسم","select",true,categories],
      ["listing_type","نوع العرض","select",true,["خدمة","منتج","عرض"]],
      ["description","الوصف","textarea",true],["city","المدينة / المركز","text",false],
      ["area","المنطقة","text",false],["price","السعر","number",false],
      ["price_period","فترة السعر","text",false],["contact_phone","رقم التواصل","tel",true],
      ["whatsapp","رقم واتساب","tel",false]
    ],
    supplier_ad: [
      ["business_name","اسم النشاط","text",true],["category","المجال","text",true],
      ["title","عنوان الإعلان","text",true],["description","الوصف","textarea",true],
      ["contact_phone","رقم التواصل","tel",true],["target_url","رابط النشاط","url",false],
      ["image_url","رابط الصورة الحالية","url",false],["requested_days","مدة النشر المطلوبة","number",false],
      ["requested_price","السعر المتفق عليه","number",false],["price","السعر المحصل","number",false]
    ],
    company_ad: [
      ["business_name","اسم الشركة / النشاط","text",true],
      ["plan_code","نوع الطلب","select",true,["trial_30"]]
    ]
  };
  const selectValue = (value, options) => options.map(x => '<option value="' + esc(x) + '"' + (String(value ?? "") === x ? " selected" : "") + '>' + esc(x) + '</option>').join("");
  function inputFor(spec, value) {
    const [key,label,type,required,options] = spec;
    const req = required ? " required" : "";
    const val = value == null ? "" : String(value);
    if (type === "textarea") return '<label class="as-field is-wide">' + esc(label) + '<textarea name="' + key + '" data-field="' + key + '" rows="3"' + req + '>' + esc(val) + '</textarea></label>';
    if (type === "select") return '<label class="as-field">' + esc(label) + '<select name="' + key + '" data-field="' + key + '"' + req + '>' + selectValue(val || options[0], options) + '</select></label>';
    if (type === "checkbox") return '<label class="as-field as-check"><input name="' + key + '" data-field="' + key + '" type="checkbox"' + (value === true || val === "true" ? " checked" : "") + '> ' + esc(label) + '</label>';
    const numeric = type === "number";
    const signed = key === "latitude" || key === "longitude";
    return '<label class="as-field">' + esc(label) + '<input name="' + key + '" data-field="' + key + '" type="' + type + '"' + (numeric ? (signed ? ' step="any"' : ' min="0" step="any"') : ' maxlength="1000"') + ' value="' + esc(val) + '"' + req + '></label>';
  }
  function displayStatus(row, kind) {
    return kind === "property_offer" ? (row.status + " · " + (row.verification_status || "بدون تحقق")) : row.status;
  }

  const panel = $("adminAdManagerList");
  if (!panel) return;

  const dialog = document.createElement("dialog");
  dialog.className = "as-dialog";
  dialog.id = "adminAdManagerDialog";
  document.body.appendChild(dialog);
  let editing = null;
  let selectedFiles = [];

  function dialogContent(kind, row) {
    const creating = !row;
    const fields = specs[kind].filter(s => creating ? !["status","verification_status","image_url"].includes(s[0]) : true);
    const currentImages = kind === "supplier_ad" ? (row?.image_url ? [row.image_url] : []) : (Array.isArray(row?.image_urls) ? row.image_urls : []);
    return '<form class="as-form" novalidate>' +
      '<div class="as-dialog-head"><h2>' + (creating ? "إضافة " + labels[kind] + " لعميل" : "تعديل " + labels[kind]) + '</h2><button type="button" class="as-close" data-close aria-label="إغلاق">×</button></div>' +
      (creating ? '<label class="as-field is-wide">بريد صاحب الإعلان المسجل *<input type="email" name="owner_email" required value="" placeholder="name@example.com"><small>سيظل الإعلان مربوطًا بهذا الحساب بعد الحفظ.</small></label>' : '<p class="admin-empty">صاحب الإعلان: ' + esc(row.owner_id || "غير محدد") + ' — لن يتم تغيير ملكية الإعلان.</p>') +
      '<div class="as-grid">' + fields.map(s => inputFor(s, row?.[s[0]] ?? (s[0] === "city" ? "أسيوط" : s[0] === "listing_type" ? "خدمة" : s[0] === "down_payment" ? 0 : ""))).join("") +
      (kind === "property_offer" ? '<label class="as-check is-wide"><input type="checkbox" data-contact-consent> تأكدت من موافقة العميل على نشر رقم التواصل إذا تم إدخاله</label>' : "") +
      (kind === "property_offer" && creating ? '<label class="as-check is-wide"><input type="checkbox" name="featured_requested" data-featured-request> طلب إعلان مميز (يظل قيد المراجعة والاتفاق)</label>' : "") +
      (kind !== "company_ad" ? '<div class="as-logo-field is-wide"><div class="as-info"><strong>صور الإعلان</strong><small>JPG فقط بعد التحويل الآمن. الحد الأقصى بعد الضغط 5 ميجابايت للصورة.</small></div><label class="as-upload">إضافة صور<input type="file" accept="image/*" multiple data-image-files></label></div>' : "") +
      (currentImages.length ? '<div class="as-field is-wide"><strong>الصور الحالية — أزل العلامة لإزالة الصورة من الإعلان</strong><div class="adm-edit-imgs">' + currentImages.map((url,i) => '<label><img src="' + esc(url) + '" alt="الصورة ' + (i+1) + '" loading="lazy"><input type="checkbox" data-keep-image value="' + esc(url) + '" checked> الاحتفاظ</label>').join("") + '</div></div>' : "") +
      '<p class="as-status" data-dialog-status role="status"></p><div class="as-foot"><button type="submit" class="btn btn-gold">حفظ التغييرات</button><button type="button" class="btn btn-outline-dark" data-close>إلغاء</button></div></form>';
  }
  function openDialog(kind, row) {
    editing = row ? { kind, row } : { kind, row:null };
    selectedFiles = [];
    dialog.innerHTML = dialogContent(kind, row);
    const form = dialog.querySelector("form");
    form.querySelector("[data-close]")?.addEventListener("click", () => dialog.close());
    form.querySelector("[data-image-files]")?.addEventListener("change", e => { selectedFiles = Array.from(e.target.files || []); });
    form.addEventListener("submit", saveDialog, { once:true });
    dialog.showModal();
  }
  dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });

  async function uploadFile(file, ownerId) {
    if (!file || !String(file.type || "").startsWith("image/")) throw new Error("اختر ملف صورة صالحًا.");
    const auth = window.LAYAN_SUPABASE;
    const cfg = window.LAYAN_CONFIG || {};
    const session = auth?.getSession?.();
    if (!session?.access_token || !session?.user?.id) throw new Error("انتهت جلسة الإدارة. سجّل الدخول مرة أخرى.");
    const jpg = typeof window.LAYAN_TO_JPEG === "function" ? await window.LAYAN_TO_JPEG(file) : file;
    if (jpg.type !== "image/jpeg") throw new Error("تعذر تحويل الصورة إلى JPG.");
    if (jpg.size > 5 * 1024 * 1024) throw new Error("حجم الصورة بعد الضغط أكبر من 5 ميجابايت.");
    const base = String(cfg.SUPABASE_URL || "").replace(/\/$/, "");
    const url = base + "/functions/v1/admin-media?action=upload";
    const headers = { apikey:cfg.SUPABASE_PUBLISHABLE_KEY, "Content-Type":"image/jpeg", "x-owner-id":String(ownerId || "") };
    const options = { method:"POST", headers, body:jpg };
    const response = typeof auth.authedFetch === "function"
      ? await auth.authedFetch(url, options)
      : await fetch(url, { ...options, headers:{ ...headers, Authorization:"Bearer " + session.access_token } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.public_url) throw new Error(data.error || "تعذر رفع صورة الإعلان.");
    return data.public_url;
  }

  async function deleteStoredImage(value) {
    const auth = window.LAYAN_SUPABASE, cfg = window.LAYAN_CONFIG || {};
    const session = auth?.getSession?.();
    if (!session?.access_token) throw new Error("انتهت جلسة الإدارة أثناء حذف الصورة.");
    const base = String(cfg.SUPABASE_URL || "").replace(/\/$/, "");
    const source = new URL(String(value));
    const root = new URL(base);
    if (source.origin !== root.origin) return;
    const marker = "/storage/v1/object/public/layan_real_estat/";
    const index = source.pathname.indexOf(marker);
    if (index < 0) return;
    const path = source.pathname.slice(index + marker.length).split("/").map(decodeURIComponent).join("/");
    if (!/^offers\/[0-9a-f-]{36}\/[a-zA-Z0-9._-]{1,160}\.(jpg|jpeg|png|webp)$/i.test(path)) return;
    const target = base + "/functions/v1/admin-media?action=delete";
    const headers = { apikey:cfg.SUPABASE_PUBLISHABLE_KEY, "Content-Type":"application/json" };
    const options = { method:"POST", headers, body:JSON.stringify({ path }) };
    const response = typeof auth.authedFetch === "function"
      ? await auth.authedFetch(target, options)
      : await fetch(target, { ...options, headers:{ ...headers, Authorization:"Bearer " + session.access_token } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 404) throw new Error(data.error || "تعذر حذف ملف صورة قديم من التخزين.");
  }

  function readForm(form, kind, creating) {
    const data = {};
    for (const spec of specs[kind]) {
      const [key,,type] = spec;
      const el = form.querySelector('[data-field="' + key + '"]');
      if (!el) continue;
      if (type === "number") data[key] = el.value.trim() === "" ? (["down_payment","price","requested_days","requested_price","assignment_fee","assignment_fee_percentage","discount_amount","discount_percent"].includes(key) ? 0 : null) : Number(el.value);
      else if (type === "checkbox") data[key] = el.checked;
      else data[key] = el.value.trim();
    }
    if (creating) {
      if (kind === "property_offer") Object.assign(data, {
        governorate:"أسيوط", status:"pending", verification_status:"pending", developer_approval_status:"unknown",
        verified_at:null, is_featured:false, featured_until:null,
        promotion_status:form.querySelector("[data-featured-request]")?.checked ? "requested" : "none",
        featured_requested:!!form.querySelector("[data-featured-request]")?.checked, image_urls:[], photos:[], document_urls:[]
      });
      if (kind === "marketplace_listing") Object.assign(data, {
        status:"pending", is_featured:false, reviewed_at:null, reviewed_by:null, admin_notes:null, image_urls:[], details:{}
      });
      if (kind === "supplier_ad") Object.assign(data, {
        status:"pending", plan_code:"custom", price:0, requested_days:Number(data.requested_days || 30),
        requested_price:Number(data.requested_price || 0), starts_at:null, ends_at:null
      });
      if (kind === "company_ad") Object.assign(data, { status:"pending" });
    }
    return data;
  }

  async function saveDialog(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector("[data-dialog-status]");
    const button = form.querySelector('[type="submit"]');
    if (!form.reportValidity()) return;
    button.disabled = true;
    try {
      const { kind, row } = editing;
      const creating = !row;
      let ownerId = row?.owner_id;
      if (creating) {
        status.textContent = "جارٍ التحقق من حساب العميل...";
        ownerId = await rpc("layan_admin_resolve_user", { p_email:form.owner_email.value.trim() });
        if (typeof ownerId !== "string" || !ownerId) throw new Error("تعذر تحديد حساب صاحب الإعلان.");
      }
      const body = readForm(form, kind, creating);
      if (kind === "marketplace_listing" && body.description.trim().length < 20) throw new Error("وصف إعلان سوق الخدمات يجب ألا يقل عن 20 حرفًا.");
      if (kind === "supplier_ad" && (body.business_name.trim().length < 2 || body.title.trim().length < 3 || body.description.trim().length < 5 || body.contact_phone.trim().length < 7)) throw new Error("راجع اسم النشاط والعنوان والوصف ورقم التواصل؛ توجد خانات لا تحقق الحد الأدنى المطلوب.");
      if (kind === "company_ad" && body.business_name.trim().length < 2) throw new Error("اسم الشركة يجب ألا يقل عن حرفين.");
      if (kind === "property_offer") {
        if (body.price_on_request) body.total_price = null;
        else if (body.total_price == null || body.total_price <= 0) throw new Error("اكتب سعرًا صحيحًا أو فعّل خيار السعر عند التواصل.");
        if (body.contact_phone && (creating || body.contact_phone !== row.contact_phone) && !form.querySelector("[data-contact-consent]")?.checked) {
          throw new Error("أكد موافقة العميل على نشر رقم التواصل قبل حفظ الإعلان.");
        }
        if ((body.latitude == null) !== (body.longitude == null)) throw new Error("أدخل خط العرض والطول معًا أو اتركهما فارغين.");
        if (body.latitude != null && (body.latitude < -90 || body.latitude > 90 || body.longitude < -180 || body.longitude > 180)) throw new Error("إحداثيات الموقع غير صحيحة.");
      }
      body.owner_id = ownerId;

      if (kind === "supplier_ad" && row?.image_url && !form.querySelector("[data-keep-image]:checked") && body.image_url === row.image_url) body.image_url = null;

      if (kind === "property_offer" || kind === "marketplace_listing") {
        const kept = Array.from(form.querySelectorAll("[data-keep-image]:checked")).map(x => x.value);
        const uploads = [];
        for (let i = 0; i < selectedFiles.length; i++) {
          status.textContent = "جارٍ رفع الصورة " + (i+1) + " من " + selectedFiles.length + "...";
          uploads.push(await uploadFile(selectedFiles[i], ownerId));
        }
        body.image_urls = kept.concat(uploads);
      } else if (kind === "supplier_ad" && selectedFiles.length) {
        status.textContent = "جارٍ رفع صورة الإعلان...";
        body.image_url = await uploadFile(selectedFiles[0], ownerId);
      }

      status.textContent = creating ? "جارٍ إنشاء الإعلان في حالة المراجعة..." : "جارٍ حفظ التعديلات...";
      let result;
      if (creating) {
        result = await A.request("/rest/v1/" + endpoint[kind] + "?select=id", {
          method:"POST", headers:{ Prefer:"return=representation" }, body:JSON.stringify(body)
        });
        if (!Array.isArray(result) || result.length !== 1 || !result[0].id) throw new Error("لم يؤكد النظام إنشاء الإعلان.");
        A.setStatus("تم إنشاء " + labels[kind] + " وربطه بحساب العميل، وأُرسل إلى المراجعة.");
      } else {
        delete body.owner_id;
        body.updated_at = new Date().toISOString();
        result = await A.request("/rest/v1/" + endpoint[kind] + "?id=eq." + encodeURIComponent(row.id), {
          method:"PATCH", headers:{ Prefer:"return=representation" }, body:JSON.stringify(body)
        });
        if (!Array.isArray(result) || result.length !== 1) throw new Error("لم يؤكد النظام حفظ التعديلات. حدّث القائمة وحاول مرة أخرى.");
        const oldImages = kind === "supplier_ad" ? [row.image_url].filter(Boolean) : (Array.isArray(row.image_urls) ? row.image_urls : []);
        const currentImages = kind === "supplier_ad" ? [body.image_url].filter(Boolean) : (Array.isArray(body.image_urls) ? body.image_urls : []);
        const removedImages = oldImages.filter(url => !currentImages.includes(url));
        const cleanup = await Promise.allSettled(removedImages.map(deleteStoredImage));
        const failedCleanup = cleanup.filter(x => x.status === "rejected").length;
        A.setStatus(failedCleanup
          ? "تم تحديث الإعلان مع الحفاظ على ملكية العميل، لكن تعذر حذف " + failedCleanup + " ملف صورة قديم من التخزين."
          : "تم تحديث الإعلان مع الحفاظ على ملكية العميل.");
      }
      dialog.close();
      await load();
    } catch (e) {
      status.textContent = e.message || "تعذر حفظ الإعلان.";
    } finally { button.disabled = false; }
  }

  function card(kind, row) {
    const title = row.title || row.business_name || "إعلان بدون عنوان";
    const sub = kind === "property_offer"
      ? [row.property_type,row.listing_purpose,row.city,row.area].filter(Boolean).join(" · ")
      : kind === "marketplace_listing" ? [row.category,row.city,row.area].filter(Boolean).join(" · ")
      : kind === "supplier_ad" ? [row.business_name,row.category].filter(Boolean).join(" · ")
      : row.plan_code || "طلب إعلان شركة";
    const id = row.id;
    const image = safeImageUrl(kind === "property_offer" ? row.image_urls?.[0] : kind === "marketplace_listing" ? row.image_urls?.[0] : row.image_url);
    return '<article class="as-item" data-record-kind="' + kind + '" data-record-id="' + esc(id) + '">' +
      '<span class="as-thumb">' + (image ? '<img src="' + esc(image) + '" alt="" loading="lazy">' : esc(labels[kind].slice(0,1))) + '</span>' +
      '<div class="as-info"><strong>' + esc(title) + '</strong><span class="as-chips"><b class="as-chip">' + esc(labels[kind]) + '</b><b class="as-chip">' + esc(displayStatus(row,kind)) + '</b></span>' +
      '<small>' + esc(sub || "—") + '</small><small>صاحب الإعلان: ' + esc(String(row.owner_id || "غير محدد")) + '</small></div>' +
      '<div class="as-actions"><button type="button" class="btn btn-gold" data-record-edit>تعديل البيانات والصور</button></div></article>';
  }

  let records = [];
  async function load() {
    if (!A) return;
    panel.innerHTML = '<p class="admin-empty">جارٍ تحميل جميع الإعلانات...</p>';
    try {
      const requests = [
        A.request("/rest/v1/property_offers?select=id,owner_id,title,property_type,listing_purpose,city,area,area_m2,total_price,down_payment,paid_amount,remaining_amount,monthly_installment,contact_name,contact_phone,description,image_urls,status,verification_status,created_at&order=created_at.desc&limit=200"),
        A.request("/rest/v1/marketplace_listings?select=id,owner_id,category,listing_type,title,description,city,area,price,price_period,contact_phone,whatsapp,image_urls,status,created_at&order=created_at.desc&limit=200"),
        A.request("/rest/v1/supplier_ads?select=id,owner_id,business_name,category,title,description,image_url,target_url,contact_phone,status,price,requested_days,requested_price,created_at&order=created_at.desc&limit=200"),
        A.request("/rest/v1/company_property_ads?select=id,owner_id,business_name,plan_code,status,starts_at,ends_at,created_at&order=created_at.desc&limit=200")
      ];
      const [properties, marketplace, suppliers, companies] = await Promise.all(requests);
      records = [];
      for (const r of properties || []) records.push({kind:"property_offer",row:r});
      for (const r of marketplace || []) records.push({kind:"marketplace_listing",row:r});
      for (const r of suppliers || []) records.push({kind:"supplier_ad",row:r});
      for (const r of companies || []) records.push({kind:"company_ad",row:r});
      records.sort((a,b) => new Date(b.row.created_at || 0) - new Date(a.row.created_at || 0));
      render();
    } catch (e) {
      panel.innerHTML = '<p class="admin-empty">' + esc(e.message || "تعذر تحميل الإعلانات.") + '</p>';
    }
  }

  function render() {
    const filter = $("adminAdTypeFilter")?.value || "all";
    const visible = records.filter(x => filter === "all" || x.kind === filter);
    panel.innerHTML = visible.length ? visible.map(x => card(x.kind,x.row)).join("") : '<p class="admin-empty">لا توجد إعلانات في هذا القسم.</p>';
    const count = $("adminAdManagerCount");
    if (count) count.textContent = String(visible.length);
  }

  $("adminAdTypeFilter")?.addEventListener("change", render);
  $("adminAdManagerRefresh")?.addEventListener("click", load);
  $("adminAdManagerCreate")?.addEventListener("click", () => {
    const kind = $("adminAdCreateType")?.value || "property_offer";
    openDialog(kind, null);
  });
  $("adminAdCreateType")?.addEventListener("change", () => {
    const kind = $("adminAdCreateType").value;
    $("adminAdCreateHint").textContent = "سيُنشأ " + labels[kind] + " بحالة قيد المراجعة، مع ربطه بالبريد الذي تحدده.";
  });
  panel.addEventListener("click", e => {
    const btn = e.target.closest("[data-record-edit]");
    if (!btn) return;
    const card = btn.closest("[data-record-kind]");
    const item = records.find(x => x.kind === card.dataset.recordKind && String(x.row.id) === card.dataset.recordId);
    if (item) openDialog(item.kind,item.row);
  });
  document.addEventListener("click", e => { if (e.target.closest("#adminRefreshAll")) setTimeout(load,500); });
  window.addEventListener("asyut:admin-ready", () => { A = window.AsyutAdmin; load(); });
})();