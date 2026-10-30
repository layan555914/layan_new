
(function () {
  "use strict";
  const config = window.LAYAN_CONFIG;
  if (!config?.SUPABASE_URL || !config?.SUPABASE_PUBLISHABLE_KEY) {
    console.error("LAYAN: إعدادات Supabase غير مكتملة.");
    return;
  }
  const url = config.SUPABASE_URL.replace(/\/$/, "");
  const key = config.SUPABASE_PUBLISHABLE_KEY;
  const bucket = "layan_real_estat";
  const SESSION_KEY = "layanSupabaseSession";
  let session = null;
  try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch (_) {}
  if (session?.expires_at && session.expires_at * 1000 < Date.now()) session = null;

  function saveSession(next) {
    session = next || null;
    try {
      if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (_) {}
  }
  function authHeaders() {
    return { apikey: key, Authorization: "Bearer " + (session?.access_token || key) };
  }
  async function readResponse(response) {
    const body = await response.text();
    let data = null;
    try { data = body ? JSON.parse(body) : null; } catch (_) { data = body; }
    if (!response.ok) {
      const message = data?.msg || data?.message || data?.error_description || data?.error || (typeof data === "string" ? data : "");
      throw new Error(message || ("Supabase " + response.status));
    }
    return data;
  }
  async function authRequest(path, payload, token) {
    const headers = { apikey: key, "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    const response = await fetch(url + "/auth/v1/" + path, {
      method: "POST", headers, body: JSON.stringify(payload || {})
    });
    return readResponse(response);
  }
  function normalizeSession(data) {
    if (data?.access_token && data?.user) {
      saveSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token || null,
        token_type: data.token_type || "bearer",
        expires_at: data.expires_at || (data.expires_in ? Math.floor(Date.now()/1000) + data.expires_in : null),
        user: data.user
      });
    }
    return data;
  }

  // A single callback handler below processes signup, magic-link, and recovery returns.
  // Keeping one handler avoids racing two requests against the same one-time auth token.
  function normalizeEmail(email) { return String(email || "").trim().toLowerCase(); }
  async function signUp(email, password) {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) throw new Error("اكتب البريد الإلكتروني بصورة صحيحة.");
    if (String(password || "").length < 6) throw new Error("Password should be at least 6 characters.");
    const redirectTo = window.location.origin + window.location.pathname;
    const data = await authRequest("signup?redirect_to=" + encodeURIComponent(redirectTo), { email: cleanEmail, password });
    normalizeSession(data);
    return { user: data?.user || null, session: session, needsEmailConfirmation: !data?.access_token };
  }
  async function resendConfirmation(email) {
    const redirectTo = window.location.origin + window.location.pathname;
    return authRequest("resend", {
      type: "signup",
      email: normalizeEmail(email),
      options: { emailRedirectTo: redirectTo }
    });
  }
  async function resetPasswordForEmail(email) {
    const redirectTo = window.location.origin + window.location.pathname.replace(/[^/]*$/, "reset-password.html");
    return authRequest("recover?redirect_to=" + encodeURIComponent(redirectTo), { email: normalizeEmail(email) });
  }
  async function signIn(email, password) {
    const data = await authRequest("token?grant_type=password", { email: normalizeEmail(email), password });
    normalizeSession(data);
    if (!session?.access_token) throw new Error("لم يرجع النظام جلسة دخول. راجع إعدادات تأكيد البريد في Supabase.");
    return session.user;
  }
  async function signOut() {
    if (session?.access_token) {
      const response = await fetch(url + "/auth/v1/logout", { method: "POST", headers: authHeaders() });
      if (!response.ok && response.status !== 204) await readResponse(response);
    }
    saveSession(null);
  }
  async function consumeAuthCallback() {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const authError = hash.get("error_description") || hash.get("error");
    if (authError) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
      window.dispatchEvent(new CustomEvent("layan-auth-callback", { detail: { success: false, message: authError } }));
      return;
    }
    if (!accessToken) return;
    try {
      const response = await fetch(url + "/auth/v1/user", {
        headers: { apikey: key, Authorization: "Bearer " + accessToken }
      });
      const user = await readResponse(response);
      saveSession({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: hash.get("token_type") || "bearer",
        expires_at: hash.get("expires_at") ? Number(hash.get("expires_at")) :
          (hash.get("expires_in") ? Math.floor(Date.now()/1000) + Number(hash.get("expires_in")) : null),
        user
      });
      history.replaceState(null, "", window.location.pathname + window.location.search);
      window.dispatchEvent(new CustomEvent("layan-auth-callback", { detail: { success: true } }));
    } catch (error) {
      console.error("LAYAN: تعذر إكمال تأكيد البريد:", error);
      window.dispatchEvent(new CustomEvent("layan-auth-callback", { detail: { success: false, message: error.message } }));
    }
  }
  consumeAuthCallback();
  function getUser() { return session?.user || null; }
  function isAuthenticated() { return Boolean(session?.access_token && session?.user?.id); }

  async function ensureFreshSession() {
    if (!session?.access_token) return;
    const expiresAt = Number(session.expires_at || 0);
    if (expiresAt > Math.floor(Date.now() / 1000) + 60) return;
    if (!session.refresh_token) {
      saveSession(null);
      throw new Error("انتهت جلسة الدخول. سجّل الدخول مرة أخرى.");
    }
    try {
      const refreshed = await authRequest("token?grant_type=refresh_token", { refresh_token: session.refresh_token });
      if (!refreshed?.access_token || !refreshed?.user) throw new Error("تعذر تجديد الجلسة.");
      normalizeSession(refreshed);
    } catch (error) {
      saveSession(null);
      throw new Error("انتهت جلسة الدخول. سجّل الدخول مرة أخرى.");
    }
  }

  async function request(path, options = {}) {
    await ensureFreshSession();
    const response = await fetch(url + "/rest/v1/" + path, {
      ...options,
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    return readResponse(response);
  }
  async function getOffers() {
    const fields = [
      "id","title","governorate","city","area","area_m2","bedrooms","bathrooms","monthly_installment","property_type","description","total_price",
      "down_payment","paid_amount","remaining_amount","assignment_fee",
      "assignment_fee_percentage","discount_amount","developer_name","company_ad_id","image_urls",
      "status","featured_requested","is_featured","featured_until","promotion_status","contact_name","contact_phone","created_at"
    ].join(",");
    const rows = await request("property_offers?select=" + fields + "&status=eq.available&order=created_at.desc");
    return Array.isArray(rows) ? rows : [];
  }
  async function getMyOffers() {
    if (!isAuthenticated()) return [];
    const rows = await request("property_offers?select=id,status,title,created_at&owner_id=eq." +
      encodeURIComponent(session.user.id) + "&order=created_at.desc");
    return Array.isArray(rows) ? rows : [];
  }
  async function uploadImages(files) {
    if (!isAuthenticated()) throw new Error("سجّل الدخول أولًا قبل رفع صور العرض.");
    const uploaded = [];
    for (const file of files || []) {
      // Restrict uploads to real JPEG files; the storage bucket and public-read rules are JPEG-oriented.
      if (file.type !== "image/jpeg" || !/\.jpe?g$/i.test(file.name)) {
        throw new Error("لأمان المنصة، ارفع الصور بصيغة JPG أو JPEG فقط.");
      }
      if (file.size > 5 * 1024 * 1024) throw new Error("حجم الصورة يجب ألا يتجاوز 5 ميجابايت.");
      if (file.size < 4) throw new Error("ملف الصورة غير صالح.");
      const signature = new Uint8Array(await file.slice(0, 3).arrayBuffer());
      if (signature[0] !== 0xFF || signature[1] !== 0xD8 || signature[2] !== 0xFF) {
        throw new Error("محتوى الملف لا يبدو صورة JPEG سليمة.");
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.jpe?g$/i, "") + ".jpg";
      const uniqueId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2);
      const path = "offers/" + session.user.id + "/" + Date.now() + "-" + uniqueId + "-" + safeName;
      const response = await fetch(url + "/storage/v1/object/" + bucket + "/" + path, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": file.type, "x-upsert": "false" },
        body: file
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error("فشل رفع الصورة: " + body);
      }
      uploaded.push(url + "/storage/v1/object/public/" + bucket + "/" + path.split("/").map(encodeURIComponent).join("/"));
    }
    return uploaded;
  }
  async function getOrCreateCompanyAd(businessName) {
    if (!isAuthenticated()) throw new Error("سجّل الدخول أولًا لإنشاء إعلان الشركة.");
    const name = String(businessName || "").trim();
    if (name.length < 2) throw new Error("اكتب اسم الشركة العقارية.");
    const ownerId = session.user.id;
    const existing = await request(
      "company_property_ads?select=id,business_name,plan_code,status,created_at&owner_id=eq." +
      encodeURIComponent(ownerId) + "&order=created_at.desc"
    );
    const matching = (Array.isArray(existing) ? existing : []).find(row =>
      String(row.business_name || "").trim().toLocaleLowerCase() === name.toLocaleLowerCase() &&
      ["pending", "active"].includes(row.status)
    );
    if (matching) {
      const linked = await request(
        "property_offers?select=id&company_ad_id=eq." + encodeURIComponent(matching.id)
      );
      if ((Array.isArray(linked) ? linked.length : 0) >= 3) {
        throw new Error("وصل إعلان الشركة إلى الحد الأقصى: 3 عقارات في الإعلان الواحد. لا يمكن إضافة عقار رابع إلى الإعلان نفسه.");
      }
      return matching.id;
    }
    const created = await request("company_property_ads", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        owner_id: ownerId,
        business_name: name,
        plan_code: "trial_30",
        status: "pending"
      })
    });
    const row = Array.isArray(created) ? created[0] : created;
    if (!row?.id) throw new Error("تعذر إنشاء إعلان الشركة. حاول مرة أخرى.");
    return row.id;
  }

  async function createOffer(offer) {
    if (!isAuthenticated()) throw new Error("سجّل الدخول أو أنشئ حسابًا أولًا لإرسال عرضك.");
    const payload = {
      owner_id: session.user.id,
      ...(offer.company_ad_id ? { company_ad_id: offer.company_ad_id } : {}),
      title: offer.title,
      governorate: "أسيوط",
      city: offer.city || null,
      area: offer.area || null,
      area_m2: Number(offer.area_m2 || 0) || null,
      bedrooms: Number(offer.bedrooms || 0) || null,
      bathrooms: Number(offer.bathrooms || 0) || null,
      monthly_installment: Number(offer.monthly_installment || 0) || null,
      property_type: offer.property_type || "شقة",
      description: offer.description || null,
      total_price: Number(offer.total_price || 0),
      down_payment: Number(offer.down_payment || 0),
      paid_amount: Number(offer.paid_amount || 0),
      remaining_amount: Number(offer.remaining_amount ?? offer.remaining_installments ?? 0),
      assignment_fee: Number(offer.assignment_fee ?? offer.transfer_fee ?? 0),
      assignment_fee_percentage: Number(offer.assignment_fee_percentage ?? offer.transfer_fee_percentage ?? 0),
      discount_amount: Number(offer.discount_amount || 0),
      developer_name: offer.developer_name || null,
      contact_name: offer.contact_name || null,
      discount_percent: Number(offer.discount_percent || 0),
      contact_phone: offer.contact_phone || null,
      image_urls: Array.isArray(offer.image_urls) ? offer.image_urls : [],
      featured_requested: offer.featured_requested === true,
      is_featured: false,
      promotion_status: offer.featured_requested === true ? "requested" : "none",
      status: "pending"
    };
    const rows = await request("property_offers", {
      method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload)
    });
    return Array.isArray(rows) ? rows[0] : rows;
  }
  function getSession() { return session; }
  window.LAYAN_SUPABASE = { signUp, signIn, signOut, getUser, getSession, isAuthenticated, getMyOffers, getOffers, uploadImages, createOffer, getOrCreateCompanyAd, resendConfirmation, resetPasswordForEmail };
  console.log("LAYAN: اتصال Supabase جاهز.");
})();
