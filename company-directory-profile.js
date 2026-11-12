document.addEventListener("DOMContentLoaded", async () => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const slug = params.get("listing");
  if (!slug) return;
  const cfg = window.LAYAN_CONFIG || {};
  const base = String(cfg.SUPABASE_URL || "").replace(/\/$/, "");
  const key = cfg.SUPABASE_PUBLISHABLE_KEY || "";
  const root = document.getElementById("companyProfileRoot");
  const auth = window.LAYAN_SUPABASE;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[ch]);
  const safeUrl = value => {
    try { const u = new URL(String(value || "")); return ["https:","http:"].includes(u.protocol) ? u.href : ""; }
    catch (_) { return ""; }
  };
  const servicesText = value => Array.isArray(value) ? value.join("، ") : "";
  let entry = null;
  let session = null;
  let ownClaim = null;

  async function api(path, options = {}) {
    if (!base || !key) throw new Error("إعدادات الاتصال بقاعدة البيانات غير مكتملة.");
    session = auth?.getSession?.() || session;
    const response = await fetch(base + "/rest/v1/" + path, {
      ...options,
      headers: {
        apikey: key,
        Authorization: "Bearer " + (session?.access_token || key),
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    const raw = await response.text();
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch (_) {}
    if (!response.ok) throw new Error(body?.message || body?.details || "تعذر تنفيذ الطلب.");
    return body;
  }

  async function getUser() {
    if (!auth?.requireAuthenticated) throw new Error("نظام تسجيل الدخول غير جاهز. حدّث الصفحة وحاول مرة أخرى.");
    session = await auth.requireAuthenticated();
    session = auth.getSession?.() || session;
    return session?.user || auth.getUser?.() || null;
  }

  function pageUrl() {
    const url = new URL("./company.html", location.href);
    url.searchParams.set("listing", entry.slug);
    return url.href;
  }

  function profileCard() {
    const logo = safeUrl(entry.logo_url);
    const phones = String(entry.public_phone || "").split(/[\s/،,]+/).map(value => value.replace(/[^+0-9]/g, "")).filter(value => value.length >= 7);
    const site = safeUrl(entry.website_url);
    const gallery = (entry.gallery_urls || []).filter(safeUrl);
    const services = Array.isArray(entry.services) ? entry.services : [];
    const claimed = entry.claim_status === "claimed";
    const profileUrl = pageUrl();
    document.title = entry.company_name + " | أسيوط عقار";
    const desc = (entry.description || "ملف تعريفي أولي لشركة محلية على أسيوط عقار.").slice(0,155);
    document.querySelector('meta[name="description"]')?.setAttribute("content", desc);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", entry.company_name + " | أسيوط عقار");
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", desc);
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", profileUrl);
    let schema = document.getElementById("companyDirectoryStructuredData");
    if (!schema) {
      schema = document.createElement("script");
      schema.id = "companyDirectoryStructuredData";
      schema.type = "application/ld+json";
      document.head.appendChild(schema);
    }
    schema.textContent = JSON.stringify({
      "@context":"https://schema.org",
      "@type":"Organization",
      name:entry.company_name,
      url:profileUrl,
      description:desc,
      telephone:entry.public_phone || undefined,
      address:{"@type":"PostalAddress","addressLocality":entry.city || "أسيوط","streetAddress":entry.public_address || undefined,"addressCountry":"EG"}
    });
    root.innerHTML =
      '<section class="company-profile-hero"><div class="company-profile-logo">' +
      (logo ? '<img src="' + esc(logo) + '" alt="شعار ' + esc(entry.company_name) + '">' : esc(entry.company_name.slice(0,1))) +
      '</div><div><span class="eyebrow">' + esc(entry.category) + '</span><h1>' + esc(entry.company_name) +
      '</h1><p>' + esc(desc) + '</p><div class="company-card-meta"><span>' + esc(entry.city || "أسيوط") +
      '</span>' + (entry.public_address ? '<span>' + esc(entry.public_address) + '</span>' : '') +
      '</div><div class="company-contact-actions">' +
      (phones.length ? phones.map((phone,index) => '<a class="company-contact-primary" href="tel:' + esc(phone) + '">' + (phones.length > 1 ? 'اتصال ' + (index+1) : 'اتصال') + '</a>').join('') : '') +
      (site ? '<a class="company-contact-secondary" target="_blank" rel="noopener noreferrer" href="' + esc(site) + '">الموقع الإلكتروني</a>' : '') +
      '<a class="company-contact-secondary" href="./companies.html">كل الشركات</a></div></div></section>' +
      (claimed
        ? '<div class="company-directory-claimed">تم استلام الصفحة من ممثل الشركة بعد مراجعة الإدارة</div>'
        : '<div class="company-directory-unclaimed-note"><strong>صفحة تعريفية أولية — غير مستلمة من الشركة.</strong><br>هذه المعلومات جُمعت من مصادر عامة، ولم تؤكد الشركة ملكيتها أو تعتمد محتوى الصفحة بعد. أسيوط عقار لا تزعم وجود شراكة أو اعتماد تجاري. يمكنك التواصل مع الشركة مباشرة لتأكيد البيانات.</div>') +
      (services.length ? '<section class="company-profile-section"><h2>الخدمات والتخصصات</h2><ul class="company-service-list">' + services.map(x => '<li>' + esc(x) + '</li>').join("") + '</ul></section>' : '') +
      (gallery.length ? '<section class="company-profile-section"><h2>معرض الأعمال المنشور</h2><div class="company-gallery">' + gallery.map((url,i) => '<img src="' + esc(url) + '" alt="صورة منشورة للشركة ' + (i+1) + '" loading="lazy">').join("") + '</div></section>' : '') +
      '<p class="company-directory-source">مصدر البيانات: <a href="' + esc(safeUrl(entry.source_url)) + '" target="_blank" rel="noopener noreferrer">' + esc(entry.source_label) + '</a> · تاريخ الاطلاع: ' + esc(entry.source_checked_at || "غير مسجل") + '</p>' +
      '<div id="companyDirectoryClaimArea"></div>';
  }

  async function refreshOwnClaim(user) {
    const rows = await api("company_directory_claim_requests?select=id,status,admin_notes,created_at&entry_id=eq." +
      encodeURIComponent(entry.id) + "&claimant_id=eq." + encodeURIComponent(user.id) + "&order=created_at.desc&limit=1");
    ownClaim = Array.isArray(rows) && rows.length ? rows[0] : null;
    return ownClaim;
  }

  function renderClaimForm(message = "") {
    const area = document.getElementById("companyDirectoryClaimArea");
    if (!area) return;
    area.innerHTML = '<section class="company-directory-claim"><h2>استلم صفحتك مجانًا</h2>' +
      '<p>الصفحة التعريفية مجانية. نتحقق من صفتك كممثل للشركة قبل ربطها بحسابك أو السماح بتعديل بياناتها.</p>' +
      '<form id="companyDirectoryClaimForm" class="company-directory-form">' +
      '<label>اسم مقدم الطلب *<input name="claimant_name" required minlength="2" maxlength="120"></label>' +
      '<label>الصفة داخل الشركة *<input name="claimant_role" required minlength="2" maxlength="120" placeholder="مالك، مدير، مسؤول تسويق..."></label>' +
      '<label>رقم التواصل الرسمي *<input name="contact_phone" required type="tel" minlength="7" maxlength="30"></label>' +
      '<label>طريقة التحقق من صفتك *<textarea name="proof_note" rows="3" required minlength="10" maxlength="1200" placeholder="مثال: يمكن للإدارة الاتصال برقم الشركة المنشور أو مراجعة صفحة الشركة الرسمية."></textarea></label>' +
      '<label>رابط موقع أو صفحة رسمية (اختياري)<input name="proof_url" type="url" placeholder="https://"></label>' +
      '<p class="company-review-note">لن تظهر بيانات طلب الاستلام للعامة. إرسال الطلب لا يمنحك ملكية الصفحة تلقائيًا؛ الموافقة بعد مراجعة الإدارة.</p>' +
      '<p class="company-directory-form-status" role="status">' + esc(message) + '</p>' +
      '<button type="submit">إرسال طلب الاستلام للمراجعة</button></form></section>';
    document.getElementById("companyDirectoryClaimForm")?.addEventListener("submit", submitClaim);
  }

  async function submitClaim(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const status = form.querySelector(".company-directory-form-status");
    if (!form.reportValidity()) return;
    button.disabled = true;
    status.textContent = "جارٍ التحقق من تسجيل الدخول وإرسال الطلب...";
    try {
      const user = await getUser();
      if (!user?.id) throw new Error("تعذر تحديد حسابك. سجّل الدخول ثم أعد فتح صفحة الشركة.");
      const formData = new FormData(form);
      const proofUrl = safeUrl(formData.get("proof_url"));
      if (formData.get("proof_url") && !proofUrl) throw new Error("رابط الإثبات يجب أن يبدأ بـ https:// أو http://.");
      const payload = {
        entry_id: entry.id,
        claimant_id: user.id,
        claimant_name: String(formData.get("claimant_name") || "").trim(),
        claimant_role: String(formData.get("claimant_role") || "").trim(),
        contact_phone: String(formData.get("contact_phone") || "").trim(),
        proof_note: String(formData.get("proof_note") || "").trim(),
        proof_url: proofUrl || null,
        status: "pending"
      };
      const saved = await api("company_directory_claim_requests", {
        method:"POST",
        headers:{"Prefer":"return=representation"},
        body:JSON.stringify(payload)
      });
      if (!Array.isArray(saved) || saved.length !== 1) throw new Error("لم يؤكد النظام حفظ طلب الاستلام.");
      ownClaim = saved[0];
      renderClaimForm("تم إرسال الطلب بنجاح. ستراجعه إدارة أسيوط عقار قبل تسليم الصفحة.");
    } catch (error) {
      status.textContent = error.message || "تعذر إرسال الطلب. حاول مرة أخرى.";
      button.disabled = false;
    }
  }

  async function renderOwnerState() {
    const area = document.getElementById("companyDirectoryClaimArea");
    if (!area) return;
    area.innerHTML = '<section class="company-directory-claim"><h2>استلام الصفحة</h2><p>تم استلام هذه الصفحة من ممثل الشركة بعد مراجعة الإدارة.</p><p class="company-directory-form-status">جارٍ التحقق من حالة حسابك...</p></section>';
    try {
      const user = await getUser();
      if (!user?.id) throw new Error("لإدارة الصفحة، سجّل الدخول بالحساب الذي تم اعتماد طلبه.");
      const claim = await refreshOwnClaim(user);
      if (claim?.status === "approved") {
        renderOwnerEditForm();
      } else {
        area.innerHTML = '<section class="company-directory-claim"><h2>الصفحة مستلمة بالفعل</h2><p>تم ربط الصفحة بممثل معتمد. لو كنت الممثل المعتمد، افتحها من نفس الحساب الذي قدم طلب الاستلام.</p></section>';
      }
    } catch (_) {
      area.innerHTML = '<section class="company-directory-claim"><h2>الصفحة مستلمة بالفعل</h2><p>إدارة الصفحة متاحة فقط للحساب الذي وافقت الإدارة على طلب استلامه. سجّل الدخول بالحساب المعتمد.</p></section>';
    }
  }

  function renderOwnerEditForm(message = "") {
    const area = document.getElementById("companyDirectoryClaimArea");
    if (!area) return;
    area.innerHTML = '<section class="company-directory-owner-edit"><h2>إدارة صفحتك على أسيوط عقار</h2>' +
      '<p>يمكنك تحديث البيانات ورفع روابط صور الأعمال. لا يمكنك تغيير حالة الاستلام أو بيانات الملكية.</p>' +
      '<form id="companyDirectoryOwnerForm" class="company-directory-form">' +
      '<label>اسم الشركة *<input name="company_name" required minlength="2" maxlength="160" value="' + esc(entry.company_name) + '"></label>' +
      '<label>النشاط *<input name="category" required minlength="2" maxlength="140" value="' + esc(entry.category) + '"></label>' +
      '<label>نبذة تعريفية<textarea name="description" rows="4" maxlength="1800">' + esc(entry.description || "") + '</textarea></label>' +
      '<label>المدينة / المركز<input name="city" maxlength="100" value="' + esc(entry.city || "أسيوط") + '"></label>' +
      '<label>العنوان<input name="public_address" maxlength="240" value="' + esc(entry.public_address || "") + '"></label>' +
      '<label>رقم التواصل<input name="public_phone" type="tel" maxlength="80" value="' + esc(entry.public_phone || "") + '"></label>' +
      '<label>الموقع أو الصفحة الرسمية<input name="website_url" type="url" maxlength="1000" value="' + esc(entry.website_url || "") + '"></label>' +
      '<label>رابط الشعار<input name="logo_url" type="url" maxlength="1000" value="' + esc(entry.logo_url || "") + '"></label>' +
      '<label>الخدمات (افصل بينها بفاصلة)<input name="services" maxlength="600" value="' + esc(servicesText(entry.services)) + '"></label>' +
      '<label>روابط صور الأعمال (رابط في كل سطر)<textarea name="gallery_urls" rows="3">' + esc((entry.gallery_urls || []).join("\n")) + '</textarea></label>' +
      '<p class="company-directory-form-status" role="status">' + esc(message) + '</p><button type="submit">حفظ تحديثات الصفحة</button></form></section>';
    document.getElementById("companyDirectoryOwnerForm")?.addEventListener("submit", saveOwnerChanges);
  }

  async function saveOwnerChanges(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const status = form.querySelector(".company-directory-form-status");
    if (!form.reportValidity()) return;
    button.disabled = true;
    status.textContent = "جارٍ حفظ التعديلات...";
    try {
      await getUser();
      const d = new FormData(form);
      const website = safeUrl(d.get("website_url"));
      const logo = safeUrl(d.get("logo_url"));
      if ((d.get("website_url") && !website) || (d.get("logo_url") && !logo)) {
        throw new Error("تحقق من روابط الموقع والشعار.");
      }
      const gallery = String(d.get("gallery_urls") || "").split(/\n+/).map(x => x.trim()).filter(Boolean);
      if (gallery.some(x => !safeUrl(x))) throw new Error("يوجد رابط صورة غير صحيح في المعرض.");
      const patch = {
        company_name:String(d.get("company_name") || "").trim(),
        category:String(d.get("category") || "").trim(),
        description:String(d.get("description") || "").trim(),
        city:String(d.get("city") || "أسيوط").trim(),
        public_address:String(d.get("public_address") || "").trim() || null,
        public_phone:String(d.get("public_phone") || "").trim() || null,
        website_url:website || null,
        logo_url:logo || null,
        services:String(d.get("services") || "").split(/[،,]/).map(x => x.trim()).filter(Boolean),
        gallery_urls:gallery,
        updated_at:new Date().toISOString()
      };
      const saved = await api("company_directory_entries?slug=eq." + encodeURIComponent(entry.slug) + "&select=id,slug,company_name,category,description,city,public_address,public_phone,website_url,logo_url,gallery_urls,services,source_label,source_url,source_checked_at,is_published,claim_status,created_at,updated_at", {
        method:"PATCH",
        headers:{"Prefer":"return=representation"},
        body:JSON.stringify(patch)
      });
      if (!Array.isArray(saved) || saved.length !== 1) throw new Error("لم يؤكد النظام حفظ التعديلات.");
      entry = {...entry, ...saved[0]};
      const hero = root.querySelector(".company-profile-hero");
      if (hero) {
        hero.querySelector("h1").textContent = entry.company_name;
        hero.querySelector(".eyebrow").textContent = entry.category;
        hero.querySelector("p").textContent = entry.description || "";
      }
      renderOwnerEditForm("تم حفظ بيانات صفحتك بنجاح.");
    } catch (error) {
      status.textContent = error.message || "تعذر حفظ التحديثات.";
    } finally {
      button.disabled = false;
    }
  }

  try {
    if (!base || !key) throw new Error("إعدادات الاتصال بقاعدة البيانات غير مكتملة.");
    const rows = await api("company_directory_entries?select=id,slug,company_name,category,description,city,public_address,public_phone,website_url,logo_url,gallery_urls,services,source_label,source_url,source_checked_at,claim_status,is_published&slug=eq." +
      encodeURIComponent(slug) + "&is_published=eq.true&limit=1");
    entry = Array.isArray(rows) ? rows[0] : null;
    if (!entry) {
      root.innerHTML = '<p class="company-directory-state">الصفحة غير متاحة أو تم إخفاؤها للمراجعة.</p>';
      return;
    }
    profileCard();
    if (entry.claim_status === "unclaimed") {
      const current = auth?.getSession?.();
      if (current?.user?.id) {
        try { await refreshOwnClaim(current.user); } catch (_) {}
      }
      if (ownClaim?.status === "pending") {
        const area = document.getElementById("companyDirectoryClaimArea");
        if (area) area.innerHTML = '<section class="company-directory-claim"><h2>طلب استلام صفحتك قيد المراجعة</h2><p>استلمنا طلبك بتاريخ ' + esc(ownClaim.created_at ? new Date(ownClaim.created_at).toLocaleDateString("ar-EG") : "قريب") + '. ستتواصل الإدارة معك بعد مراجعة إثبات الصفة.</p></section>';
      } else {
        renderClaimForm(ownClaim?.status === "rejected" ? "تم رفض طلب سابق. يمكنك تقديم طلب جديد بعد استكمال الإثبات." : "");
      }
    } else {
      const current = auth?.getSession?.();
      if (current?.user?.id) {
        renderOwnerState();
      } else {
        const area = document.getElementById("companyDirectoryClaimArea");
        if (area) area.innerHTML = '<section class="company-directory-claim"><h2>الصفحة مستلمة بالفعل</h2><p>تم ربط الصفحة بممثل معتمد من الإدارة. إدارة الصفحة متاحة فقط للحساب الذي وافقت الإدارة على طلب استلامه. <a href="./">سجّل الدخول بالحساب المعتمد</a>.</p></section>';
      }
    }
  } catch (error) {
    root.innerHTML = '<p class="company-directory-state">' + esc(error.message || "تعذر تحميل صفحة الشركة.") + '</p>';
    console.warn("Company directory profile:", error);
  }
});