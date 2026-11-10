// ASYUT AQAR — admin pages: changes made by an added admin (مشرف) go to the owners (المدير) for approval.
// The database already blocks added admins from writing directly (migration 20261110170000); this layer turns
// their write into a clear approval request instead of a failed save:
//   * owners: nothing changes, every request goes straight through.
//   * added admins: any add / edit / delete request to the database is saved as a request
//     (layan_admin_request_change) and the page shows «أُرسل للمدير للموافقة».
// Must be loaded right after config.js, before the other admin scripts.
(function () {
  "use strict";
  if (window.__asyutApprovalGate) return;
  window.__asyutApprovalGate = true;
  const cfg = window.LAYAN_CONFIG || {};
  const base = String(cfg.SUPABASE_URL || "").replace(/\/$/, "");
  const key = cfg.SUPABASE_PUBLISHABLE_KEY || "";
  const nativeFetch = window.fetch.bind(window);
  if (!base || !key) return;

  // RPCs that only read, or already have their own owner-approval flow, or are owner-only on the server.
  const PASS_RPC = /^(layan_is_admin|layan_admin_whoami|layan_admin_list_[a-z_]+|layan_admin_activity(_summary)?|layan_admin_pending_[a-z_]+|layan_track_event|layan_admin_request_change|layan_admin_finish_change|layan_admin_decide_request|layan_admin_delete_[a-z_]+|layan_admin_set_user_suspended|layan_admin_set_admin|layan_list_[a-z_]+|layan_get_[a-z_]+|directory_admin_list[a-z_]*)$/;
  const TABLES = {
    platform_sponsors: "الرعاة الرسميين", supplier_ads: "الإعلانات الممولة", property_offers: "إعلانات العقارات",
    marketplace_listings: "خدمات السوق", company_profiles: "ملفات الشركات", company_property_ads: "إعلانات الشركات",
    partner_ad_slots: "مساحات الإعلانات", directory_sources: "مصادر الدليل العقاري", directory_change_log: "سجل الدليل العقاري"
  };
  const RPCS = {
    layan_admin_review_property_offer: "مراجعة إعلان عقار", layan_activate_supplier_ad: "تفعيل إعلان ممول",
    layan_reject_supplier_ad: "رفض إعلان ممول", layan_admin_set_offer_trust_badge: "توثيق معلن",
    layan_review_company_profile: "مراجعة ملف شركة", layan_admin_review_edit: "مراجعة تعديل على إعلان",
    directory_admin_mutate_with_audit: "تعديل في الدليل العقاري", layan_approve_free_trial_ad: "اعتماد إعلان تجريبي"
  };
  const VERB = { POST: "إضافة", PATCH: "تعديل", DELETE: "حذف", PUT: "تعديل" };

  function describe(method, path, body) {
    const clean = path.replace(/^\/rest\/v1\//, "");
    const name = clean.split("?")[0];
    let title;
    if (name.startsWith("rpc/")) title = RPCS[name.slice(4)] || ("إجراء: " + name.slice(4));
    else title = (VERB[method] || "تعديل") + " — " + (TABLES[name] || (name.startsWith("directory_") ? "الدليل العقاري" : name));
    const id = (clean.match(/[?&]id=eq\.([^&]+)/) || [])[1];
    if (id) title += " #" + decodeURIComponent(id).slice(0, 40);
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const parts = Object.entries(body).slice(0, 4).map(([k, v]) => k + ": " + (typeof v === "object" ? JSON.stringify(v) : String(v)).slice(0, 40));
      if (parts.length) title += " (" + parts.join("، ") + ")";
    }
    return title.slice(0, 200);
  }

  const roles = new Map();
  function roleFor(auth) {
    if (!auth || auth === "Bearer " + key) return Promise.resolve("none");
    if (!roles.has(auth)) {
      roles.set(auth, nativeFetch(base + "/rest/v1/rpc/layan_admin_whoami", {
        method: "POST", headers: { apikey: key, Authorization: auth, "Content-Type": "application/json" }, body: "{}"
      }).then(r => r.ok ? r.json() : "owner") // not deployed yet: behave exactly as before
        .catch(() => "owner"));
    }
    return roles.get(auth);
  }
  function headerOf(headers, name) {
    if (!headers) return "";
    if (headers instanceof Headers) return headers.get(name) || "";
    const hit = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
    return hit ? String(headers[hit]) : "";
  }
  function toast(text) {
    let el = document.getElementById("asyutApprovalToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "asyutApprovalToast";
      el.setAttribute("role", "status");
      el.style.cssText = "position:fixed;inset-inline:16px;bottom:20px;z-index:9999;max-width:520px;margin-inline:auto;padding:14px 18px;border-radius:14px;background:#2B211B;color:#FFF8F0;border:1px solid #E9B08F;box-shadow:0 18px 40px rgba(0,0,0,.3);font:700 14px/1.7 Alexandria,Tahoma,sans-serif;text-align:center";
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.hidden = true; }, 6000);
  }

  let lastAuth = "";
  window.fetch = async function (input, init = {}) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const method = String(init.method || (input && input.method) || "GET").toUpperCase();
    if (url.startsWith(base + "/rest/v1/")) {
      const a = headerOf(init.headers, "Authorization");
      if (a && a !== "Bearer " + key) lastAuth = a;
    }
    if (!url.startsWith(base + "/rest/v1/") || !["POST", "PATCH", "DELETE", "PUT"].includes(method)) return nativeFetch(input, init);
    const path = url.slice(base.length);
    const rpcName = (path.match(/^\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1];
    if (rpcName && PASS_RPC.test(rpcName)) return nativeFetch(input, init);
    const auth = headerOf(init.headers, "Authorization");
    const role = await roleFor(auth);
    if (role !== "admin") return nativeFetch(input, init);

    let body = null;
    try { body = init.body ? JSON.parse(init.body) : null; } catch (_) { body = init.body ? String(init.body) : null; }
    const payload = { method, path, body, prefer: headerOf(init.headers, "Prefer") || null };
    const label = describe(method, path, body);
    const r = await nativeFetch(base + "/rest/v1/rpc/layan_admin_request_change", {
      method: "POST",
      headers: { apikey: key, Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ p_label: label, p_payload: payload })
    });
    const message = r.ok
      ? "تم إرسال طلبك إلى المدير للموافقة: " + label + ". سيُنفَّذ بعد موافقته."
      : "تعذر إرسال الطلب للمدير. حاول مرة أخرى.";
    toast(message);
    window.dispatchEvent(new CustomEvent("asyut:approval-requested", { detail: { label, ok: r.ok } }));
    return new Response(JSON.stringify({ code: "PENDING_APPROVAL", message }), {
      status: r.ok ? 409 : 500, headers: { "Content-Type": "application/json" }
    });
  };

  // Owner side: perform an approved change exactly as requested, with the owner's own session.
  window.AsyutApproval = {
    describe,
    async perform(payload, authHeader) {
      const auth = authHeader || lastAuth;
      if (!auth) throw new Error("سجّل الدخول مرة أخرى ثم أعد المحاولة.");
      const headers = { apikey: key, Authorization: auth, "Content-Type": "application/json" };
      headers.Prefer = payload.prefer || "return=minimal";
      const res = await nativeFetch(base + payload.path, {
        method: payload.method,
        headers,
        body: payload.body == null ? undefined : (typeof payload.body === "string" ? payload.body : JSON.stringify(payload.body))
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = text;
        try { const j = JSON.parse(text); msg = j.message || j.error || text; } catch (_) {}
        throw new Error(String(msg || ("HTTP " + res.status)).slice(0, 280));
      }
      return text;
    }
  };
})();
