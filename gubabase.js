
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
  async function signUp(email, password) {
    const redirectTo = window.location.origin + window.location.pathname;
    const data = await authRequest("signup?redirect_to=" + encodeURIComponent(redirectTo), { email: email.trim(), password });
    normalizeSession(data);
    return { user: data?.user || null, session: session, needsEmailConfirmation: !data?.access_token };
  }
  async function resendConfirmation(email) {
    const redirectTo = window.location.origin + window.location.pathname;
    return authRequest("resend", {
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: redirectTo }
    });
  }
  async function signIn(email, password) {
    const data = await authRequest("token?grant_type=password", { email: email.trim(), password });
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
  function getUser() { return session?.user || null; }
  function isAuthenticated() { return Boolean(session?.access_token && session?.user?.id); }

  async function request(path, options = {}) {
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
      "id","title","governorate","area","property_type","description","total_price",
      "down_payment","paid_amount","remaining_amount","assignment_fee",
      "assignment_fee_percentage","discount_amount","developer_name","image_urls",
      "status","featured_requested","is_featured","featured_until","promotion_status","created_at"
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
      if (!file.type.startsWith("image/")) throw new Error("اختر ملفات صور فقط.");
      if (file.size > 10 * 1024 * 1024) throw new Error("حجم الصورة يجب ألا يتجاوز 10 ميجابايت.");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
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
  async function createOffer(offer) {
    if (!isAuthenticated()) throw new Error("سجّل الدخول أو أنشئ حسابًا أولًا لإرسال عرضك.");
    const payload = {
      owner_id: session.user.id,
      title: offer.title,
      governorate: "أسيوط",
      area: offer.area || null,
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
  window.LAYAN_SUPABASE = { signUp, signIn, signOut, getUser, isAuthenticated, getMyOffers, getOffers, uploadImages, createOffer, resendConfirmation };
  console.log("LAYAN: اتصال Supabase جاهز.");
})();
