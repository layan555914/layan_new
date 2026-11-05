
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
  // Production callbacks stay on the production domain; preview/local callbacks stay in TEST.
  const AUTH_REDIRECT_URL = config.ENVIRONMENT === "production"
    ? "https://layan-eg.com/"
    : (window.location.origin.replace(/\/$/, "") + "/");
  const PROJECT_KEY_SUFFIX = new URL(url).hostname.split(".")[0];
  const RECOVERY_PKCE_STORAGE_KEY = "layanRecoveryCodeVerifier:" + PROJECT_KEY_SUFFIX;
  const SIGNUP_PKCE_STORAGE_KEY = "layanSignupCodeVerifier:" + PROJECT_KEY_SUFFIX;

  function base64UrlEncode(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  async function codeChallengeForVerifier(verifier, context) {
    if (!window.crypto?.subtle) {
      throw new Error("المتصفح لا يدعم التحقق الآمن لـ" + context + ". حدّث Chrome وحاول مرة أخرى.");
    }
    const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return base64UrlEncode(new Uint8Array(digest));
  }

  async function createPkceChallenge(storageKey, context, reuseExisting = false) {
    if (!window.crypto?.getRandomValues || !window.crypto?.subtle) {
      throw new Error("المتصفح لا يدعم التحقق الآمن لـ" + context + ". حدّث Chrome وحاول مرة أخرى.");
    }
    if (reuseExisting) {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
        if (typeof saved?.code_verifier === "string" &&
            /^[A-Za-z0-9_-]{43,128}$/.test(saved.code_verifier) &&
            Number(saved?.created_at || 0) > 0) {
          return {
            codeChallenge: await codeChallengeForVerifier(saved.code_verifier, context),
            reusedExisting: true
          };
        }
      } catch (_) {}
    }
    const random = new Uint8Array(32);
    window.crypto.getRandomValues(random);
    const verifier = base64UrlEncode(random);
    const codeChallenge = await codeChallengeForVerifier(verifier, context);
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        code_verifier: verifier,
        created_at: Date.now()
      }));
    } catch (_) {
      throw new Error("تعذر حفظ بيانات التحقق الآمن على هذا المتصفح. اسمح بالتخزين المحلي ثم حاول مرة أخرى.");
    }
    return { codeChallenge, reusedExisting: false };
  }

  async function createRecoveryPkceChallenge() {
    const result = await createPkceChallenge(RECOVERY_PKCE_STORAGE_KEY, "استعادة كلمة المرور", false);
    return result.codeChallenge;
  }
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
  // Read the "exp" claim from a JWT access token; returns seconds since epoch or null.
  function jwtExpiry(token) {
    try {
      const part = String(token || "").split(".")[1];
      if (!part) return null;
      const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=")));
      const exp = Number(json?.exp);
      return Number.isFinite(exp) && exp > 0 ? exp : null;
    } catch (_) {
      return null;
    }
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
    const pkce = await createPkceChallenge(SIGNUP_PKCE_STORAGE_KEY, "تأكيد البريد الإلكتروني", true);
    const redirectTo = AUTH_REDIRECT_URL;
    try {
      const data = await authRequest("signup?redirect_to=" + encodeURIComponent(redirectTo), {
        email: cleanEmail,
        password,
        code_challenge: pkce.codeChallenge,
        code_challenge_method: "s256"
      });
      normalizeSession(data);
      const needsEmailConfirmation = !data?.access_token;
      if (!needsEmailConfirmation) {
        try { localStorage.removeItem(SIGNUP_PKCE_STORAGE_KEY); } catch (_) {}
      }
      return { user: data?.user || null, session: session, needsEmailConfirmation };
    } catch (error) {
      if (!pkce.reusedExisting) {
        try { localStorage.removeItem(SIGNUP_PKCE_STORAGE_KEY); } catch (_) {}
      }
      throw error;
    }
  }
  async function resendConfirmation(email) {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) throw new Error("اكتب البريد الإلكتروني بصورة صحيحة.");
    // Supabase's resend endpoint reuses the signup flow already stored for the user.
    // Keep the original verifier and pass the redirect as the REST redirect_to query.
    const redirectTo = AUTH_REDIRECT_URL;
    return authRequest("resend?redirect_to=" + encodeURIComponent(redirectTo), {
      type: "signup",
      email: cleanEmail
    });
  }
  async function resetPasswordForEmail(email) {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) throw new Error("اكتب البريد الإلكتروني بصورة صحيحة.");
    const redirectTo = AUTH_REDIRECT_URL + "reset-password.html";
    const codeChallenge = await createRecoveryPkceChallenge();
    const query = "recover?redirect_to=" + encodeURIComponent(redirectTo);
    try {
      return await authRequest(query, {
        email: cleanEmail,
        code_challenge: codeChallenge,
        code_challenge_method: "s256"
      });
    } catch (error) {
      try { localStorage.removeItem(RECOVERY_PKCE_STORAGE_KEY); } catch (_) {}
      throw error;
    }
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
  function emitAuthCallback(detail) {
    window.LAYAN_AUTH_CALLBACK_RESULT = detail;
    window.dispatchEvent(new CustomEvent("layan-auth-callback", { detail }));
  }
  function cleanAuthCallbackUrl(removeQueryKeys = []) {
    const cleaned = new URL(window.location.href);
    removeQueryKeys.forEach(name => cleaned.searchParams.delete(name));
    cleaned.hash = "";
    history.replaceState(null, "", cleaned.pathname + cleaned.search);
  }
  async function consumeAuthCallback() {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get("code");
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const authError = hash.get("error_description") || hash.get("error") ||
      params.get("error_description") || params.get("error");
    if (authError) {
      cleanAuthCallbackUrl(["code", "error", "error_description", "error_code"]);
      emitAuthCallback({ success: false, message: authError });
      return;
    }

    // Signup/email confirmation PKCE callback. Recovery is handled by reset-password.html.
    if (authCode) {
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(SIGNUP_PKCE_STORAGE_KEY) || "null"); } catch (_) {}
      const verifier = typeof saved?.code_verifier === "string" ? saved.code_verifier : "";
      cleanAuthCallbackUrl(["code"]);
      if (!verifier || Number(saved?.created_at || 0) <= 0) {
        try { localStorage.removeItem(SIGNUP_PKCE_STORAGE_KEY); } catch (_) {}
        emitAuthCallback({
          success: false,
          message: "وصل رابط التأكيد الآمن، لكن بيانات التحقق الخاصة بالمتصفح غير موجودة أو انتهت. اطلب إعادة إرسال رسالة التأكيد وافتحها في نفس المتصفح الذي أنشأت منه الحساب."
        });
        return;
      }
      try {
        const response = await fetch(url + "/auth/v1/token?grant_type=pkce", {
          method: "POST",
          headers: { apikey: key, "Content-Type": "application/json" },
          body: JSON.stringify({ auth_code: authCode, code_verifier: verifier })
        });
        const data = await readResponse(response);
        if (!data?.access_token || !data?.user) {
          throw new Error("لم يرجع خادم المصادقة جلسة صالحة بعد تأكيد البريد.");
        }
        normalizeSession(data);
        try { localStorage.removeItem(SIGNUP_PKCE_STORAGE_KEY); } catch (_) {}
        emitAuthCallback({ success: true, type: "signup" });
        return;
      } catch (error) {
        // Keep the original verifier so a resend/retry can complete this same signup flow.
        emitAuthCallback({ success: false, message: error.message || "تعذر إكمال تأكيد البريد." });
        return;
      }
    }

    // Legacy implicit confirmation links remain supported for accounts created before PKCE.
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
          (hash.get("expires_in") ? Math.floor(Date.now()/1000) + Number(hash.get("expires_in")) : jwtExpiry(accessToken)),
        user
      });
      cleanAuthCallbackUrl();
      emitAuthCallback({ success: true, type: "legacy" });
    } catch (error) {
      console.error("LAYAN: تعذر إكمال تأكيد البريد:", error);
      emitAuthCallback({ success: false, message: error.message });
    }
  }
  consumeAuthCallback();
  function getUser() { return session?.user || null; }
  function isAuthenticated() { return Boolean(session?.access_token && session?.user?.id); }

  async function ensureFreshSession() {
    if (!session?.access_token) return;
    const expiresAt = Number(session.expires_at || 0) || jwtExpiry(session.access_token) || 0;
    // Unknown expiry is not the same as expired: let the server reject an invalid token
    // instead of forcing a refresh that logs out a freshly confirmed user.
    if (!expiresAt) return;
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

  async function requireAuthenticated() {
    if (!session?.access_token) throw new Error("سجّل الدخول أولًا قبل تقديم طلب تسجيل شركة.");
    await ensureFreshSession();
    try {
      const response = await fetch(url + "/auth/v1/user", {
        method: "GET",
        headers: { apikey: key, Authorization: "Bearer " + session.access_token }
      });
      const user = await readResponse(response);
      if (!user?.id || user.id !== session?.user?.id) {
        saveSession(null);
        throw new Error("تعذر التحقق من الحساب. سجّل الدخول مرة أخرى.");
      }
      session = { ...session, user };
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (_) {}
      return session;
    } catch (error) {
      if (/401|403|invalid|expired|JWT/i.test(String(error.message || error))) saveSession(null);
      throw new Error("جلسة الدخول غير صالحة أو انتهت. سجّل الدخول مرة أخرى.");
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
      "id","title","governorate","listing_purpose","land_ownership_authority","land_permit_details","land_utilities","land_zoning","city","area","area_m2","bedrooms","bathrooms","monthly_installment","property_type","description","total_price",
      "down_payment","paid_amount","remaining_amount","assignment_fee","project_name",
      "assignment_fee_percentage","discount_amount","developer_name","company_ad_id","image_urls",
      "status","featured_requested","is_featured","featured_until","promotion_status","contact_phone","latitude","longitude","created_at"
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
  // Stamp the ASYUT AQAR mark on listing photos before upload so copies keep the source,
  // and cap very large photos at 2000px to keep pages fast. Falls back to the original file.
  async function watermarkJpeg(file) {
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const unit = Math.max(12, Math.round(Math.min(width, height) * 0.026));
    const pad = Math.round(unit * 0.9);
    const label = "أسيوط عقار · layan-eg.com";
    ctx.font = "700 " + unit + "px Alexandria, Tahoma, Arial, sans-serif";
    const textWidth = ctx.measureText(label).width;
    const markSize = Math.round(unit * 1.5);
    const boxWidth = textWidth + markSize + pad * 2.6;
    const boxHeight = markSize + pad;
    const x = pad;
    const y = height - boxHeight - pad;
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#2B211B";
    if (typeof ctx.roundRect === "function") { ctx.beginPath(); ctx.roundRect(x, y, boxWidth, boxHeight, unit * 0.4); ctx.fill(); }
    else ctx.fillRect(x, y, boxWidth, boxHeight);
    ctx.globalAlpha = 0.85;
    const mark = new Path2D("M32 4.5L61.5 58H2.5ZM32 23L47 39.5V58H17V39.5Z");
    ctx.save();
    ctx.translate(x + pad * 0.7, y + (boxHeight - markSize) / 2);
    ctx.scale(markSize / 64, markSize / 64);
    ctx.fillStyle = "#F3ECE1";
    ctx.fill(mark, "evenodd");
    ctx.fillStyle = "#C98A64";
    ctx.fill(new Path2D("M26.8 58V49.6a5.2 5.2 0 0 1 10.4 0V58Z"));
    ctx.restore();
    ctx.fillStyle = "#F3ECE1";
    ctx.textBaseline = "middle";
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.fillText(label, x + boxWidth - pad * 0.8, y + boxHeight / 2);
    ctx.globalAlpha = 1;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.86));
    return blob && blob.size > 4 ? blob : file;
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
        headers: { ...authHeaders(), "Content-Type": "image/jpeg", "x-upsert": "false" },
        body: await watermarkJpeg(file).catch(() => file)
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error("فشل رفع الصورة: " + body);
      }
      uploaded.push(url + "/storage/v1/object/public/" + bucket + "/" + path.split("/").map(encodeURIComponent).join("/"));
    }
    return uploaded;
  }
  async function deleteUploadedImages(publicUrls) {
    if (!isAuthenticated() || !Array.isArray(publicUrls) || !publicUrls.length) return;
    const prefix = url.replace(/\/$/, "") + "/storage/v1/object/public/" + bucket + "/";
    for (const publicUrl of publicUrls) {
      if (typeof publicUrl !== "string" || !publicUrl.startsWith(prefix)) continue;
      const encodedPath = publicUrl.slice(prefix.length);
      let objectPath;
      try { objectPath = encodedPath.split("/").map(part => decodeURIComponent(part)).join("/"); }
      catch { continue; }
      if (!objectPath || !objectPath.startsWith("offers/" + session.user.id + "/")) continue;
      try {
        const response = await fetch(url + "/storage/v1/object/" + bucket + "/" + objectPath.split("/").map(encodeURIComponent).join("/"), {
          method: "DELETE",
          headers: authHeaders()
        });
        if (!response.ok) console.warn("تعذر تنظيف صورة غير مرتبطة بإعلان:", await response.text());
      } catch (error) {
        console.warn("تعذر تنظيف صورة غير مرتبطة بإعلان:", error);
      }
    }
  }

  async function uploadPropertyDocuments(files) {
    if (!isAuthenticated()) throw new Error("سجّل الدخول أولًا قبل رفع مستندات العقار.");
    const uploaded = [];
    for (const file of files || []) {
      if (!["application/pdf","image/jpeg","image/png"].includes(file.type)) throw new Error("المستندات المسموحة PDF أو JPG أو PNG فقط.");
      if (file.size < 8 || file.size > 10 * 1024 * 1024) throw new Error("حجم كل مستند يجب ألا يتجاوز 10 ميجابايت.");
      const head = new Uint8Array(await file.slice(0,8).arrayBuffer());
      const validPdf = file.type === "application/pdf" && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
      const validJpeg = file.type === "image/jpeg" && head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF;
      const validPng = file.type === "image/png" && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47;
      if (!validPdf && !validJpeg && !validPng) throw new Error("محتوى أحد الملفات لا يطابق نوع المستند المسموح.");
      const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
      const safeName = String(file.name || "document").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,70).replace(/\.[^.]+$/,"") + "." + ext;
      const uid = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2);
      const path = "documents/" + session.user.id + "/" + uid + "-" + safeName;
      const response = await fetch(url + "/storage/v1/object/layan-property-documents/" + path.split("/").map(encodeURIComponent).join("/"), {
        method:"POST", headers:{...authHeaders(),"Content-Type":file.type,"x-upsert":"false"}, body:file
      });
      if (!response.ok) throw new Error("فشل رفع مستند العقار: " + await response.text());
      uploaded.push(path);
    }
    return uploaded;
  }
  async function deleteUploadedPropertyDocuments(paths) {
    if (!isAuthenticated() || !Array.isArray(paths)) return;
    for (const path of paths) {
      if (typeof path !== "string" || !path.startsWith("documents/" + session.user.id + "/")) continue;
      try {
        const response = await fetch(url + "/storage/v1/object/layan-property-documents/" + path.split("/").map(encodeURIComponent).join("/"), {method:"DELETE",headers:authHeaders()});
        if (!response.ok) console.warn("تعذر حذف مستند مؤقت:", await response.text());
      } catch (error) { console.warn("تعذر حذف مستند مؤقت:", error); }
    }
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
      listing_purpose: offer.listing_purpose || "تنازل",
      land_ownership_authority: offer.land_ownership_authority || null,
      land_permit_details: offer.land_permit_details || null,
      land_utilities: offer.land_utilities || null,
      land_zoning: offer.land_zoning || null,
      governorate: "أسيوط",
      city: offer.city || null,
      area: offer.area || null,
      latitude: offer.latitude == null ? null : Number(offer.latitude),
      longitude: offer.longitude == null ? null : Number(offer.longitude),
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
      project_name: offer.project_name || null,
      document_urls: Array.isArray(offer.document_urls) ? offer.document_urls : [],
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
  async function getFavoriteOfferIds() {
    if (!isAuthenticated()) return [];
    const rows = await request("user_favorite_offers?select=offer_id&user_id=eq." + encodeURIComponent(session.user.id) + "&order=created_at.desc");
    return Array.isArray(rows) ? rows.map(row => String(row.offer_id)) : [];
  }
  async function addFavoriteOffer(offerId) {
    if (!isAuthenticated()) return false;
    const rows = await request("user_favorite_offers", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
      body: JSON.stringify({ user_id: session.user.id, offer_id: Number(offerId) })
    });
    return Array.isArray(rows) ? Boolean(rows[0]) || true : true;
  }
  async function removeFavoriteOffer(offerId) {
    if (!isAuthenticated()) return false;
    await request("user_favorite_offers?user_id=eq." + encodeURIComponent(session.user.id) + "&offer_id=eq." + encodeURIComponent(offerId), {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });
    return true;
  }
  async function syncFavoriteOffers(offerIds) {
    if (!isAuthenticated()) return [];
    const ids = [...new Set((offerIds || []).map(v => Number(v)).filter(Number.isFinite))];
    for (const offerId of ids) await addFavoriteOffer(offerId);
    return getFavoriteOfferIds();
  }

  async function getBuyerAlerts(limit = 20) {
    if (!isAuthenticated()) return [];
    const rows = await request("buyer_offer_alerts?select=id,offer_id,title_snapshot,city_snapshot,area_snapshot,price_snapshot,created_at,read_at&user_id=eq." +
      encodeURIComponent(session.user.id) + "&order=created_at.desc&limit=" + Math.max(1, Math.min(50, Number(limit) || 20)));
    return Array.isArray(rows) ? rows : [];
  }
  async function addBuyerAlerts(offers) {
    if (!isAuthenticated() || !Array.isArray(offers) || !offers.length) return [];
    const payload = offers.filter(o => Number.isFinite(Number(o.id))).map(o => ({
      user_id: session.user.id,
      offer_id: Number(o.id),
      title_snapshot: String(o.title || "عرض عقاري").slice(0, 180),
      city_snapshot: String(o.city || "أسيوط").slice(0, 120),
      area_snapshot: o.area ? String(o.area).slice(0, 120) : null,
      price_snapshot: Number(o.total_price || 0)
    }));
    if (!payload.length) return [];
    const inserted = await request("buyer_offer_alerts?on_conflict=user_id,offer_id", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(payload)
    });
    return Array.isArray(inserted) ? inserted : [];
  }
  async function markBuyerAlertsRead() {
    if (!isAuthenticated()) return false;
    await request("buyer_offer_alerts?user_id=eq." + encodeURIComponent(session.user.id) + "&read_at=is.null", {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ read_at: new Date().toISOString() })
    });
    return true;
  }

  function getSession() { return session; }
  window.LAYAN_SUPABASE = { signUp, signIn, signOut, getUser, getSession, isAuthenticated, requireAuthenticated, getMyOffers, getOffers, uploadImages, deleteUploadedImages, uploadPropertyDocuments, deleteUploadedPropertyDocuments, createOffer, getOrCreateCompanyAd, resendConfirmation, resetPasswordForEmail, getFavoriteOfferIds, addFavoriteOffer, removeFavoriteOffer, syncFavoriteOffers, getBuyerAlerts, addBuyerAlerts, markBuyerAlertsRead };
  console.log("LAYAN: اتصال Supabase جاهز.");
})();
