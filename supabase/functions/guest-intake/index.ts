import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const BUCKET = "asyut-guest-intake";
const PUBLIC_BUCKET = "layan_real_estat";
const allowedOrigins = new Set(["https://asyutq.com", "https://www.asyutq.com"]);
const json = (body: unknown, status = 200, origin: string | null = null) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    ...(origin && allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  },
});
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const phonePattern = /^[0-9+() -]{7,20}$/;
const cleanString = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const extFor = (mime: string) => mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : mime === "application/pdf" ? "pdf" : "";

function publicKeyFromEnv() {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    return keys.default || Deno.env.get("SUPABASE_ANON_KEY") || "";
  } catch {
    return Deno.env.get("SUPABASE_ANON_KEY") || "";
  }
}
function serviceKeyFromEnv() {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || keys.default || "";
  } catch {
    return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  }
}
async function fingerprint(req: Request, secret: string) {
  const forwarded = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const userAgent = cleanString(req.headers.get("user-agent"), 180);
  const source = forwarded ? forwarded : "no-ip:" + userAgent;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(source));
  return [...new Uint8Array(signature)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function nonNegative(p: Record<string, unknown>, key: string, max = 1000000000) {
  if (p[key] === undefined || p[key] === null || p[key] === "") return true;
  const n = Number(p[key]);
  return Number.isFinite(n) && n >= 0 && n <= max;
}
function validPropertyPayload(p: Record<string, unknown>) {
  const project = /مشروع/.test(String(p.property_type || ""));
  const priceOnRequest = p.price_on_request === true;
  const numericOk = ["area_m2","bedrooms","bathrooms","monthly_installment","rental_security_deposit",
    "rental_minimum_months","total_price","down_payment","paid_amount","remaining_amount",
    "remaining_installments","assignment_fee","assignment_fee_percentage","discount_amount","discount_percent"]
    .every(key => nonNegative(p,key));
  const lat = p.latitude == null || p.latitude === "" ? null : Number(p.latitude);
  const lng = p.longitude == null || p.longitude === "" ? null : Number(p.longitude);
  return cleanString(p.title, 180).length >= 5
    && String(p.title || "").length <= 180
    && ["بيع", "إيجار", "تنازل"].includes(String(p.listing_purpose))
    && cleanString(p.property_type, 80).length >= 2
    && cleanString(p.city, 100).length >= 2
    && cleanString(p.area, 100).length >= 2
    && cleanString(p.contact_name, 120).length >= 2
    && phonePattern.test(cleanString(p.contact_phone, 20))
    && typeof p.contact_consent === "boolean"
    && String(p.description || "").length <= 3000
    && numericOk
    && (priceOnRequest || project || Number(p.total_price) > 0)
    && (p.listing_purpose !== "تنازل" || Number(p.paid_amount || 0) >= Number(p.down_payment || 0))
    && ((lat === null && lng === null) || (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180));
}
function validBuyerPayload(p: Record<string, unknown>) {
  return cleanString(p.contact_name, 120).length >= 2
    && phonePattern.test(cleanString(p.contact_phone, 20))
    && cleanString(p.property_type, 80).length >= 2
    && cleanString(p.city, 100).length <= 100
    && cleanString(p.area, 100).length <= 100
    && String(p.notes || "").length <= 500
    && ["max_total_price","max_upfront","max_monthly_installment","min_bedrooms"].every(key => nonNegative(p,key,1000000000));
}
function allowedPath(path: string, id: string, kind: "images" | "documents") {
  const ext = kind === "images" ? "jpg" : "(pdf|jpg|png)";
  return new RegExp("^pending/" + id + "/" + kind + "/[0-9a-f-]{36}\\." + ext + "$", "i").test(path);
}
async function adminContext(req: Request, supabaseUrl: string, publicKey: string) {
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("سجّل الدخول بحساب الإدارة أولًا.");
  const userClient = createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const token = authorization.slice(7);
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) throw new Error("جلسة الإدارة غير صالحة.");
  const { data: role, error: roleError } = await userClient.rpc("layan_admin_whoami");
  if (roleError || !["owner", "admin"].includes(String(role))) throw new Error("هذا الحساب غير مخوّل لإدارة طلبات الزوار.");
  return { userClient, role: String(role) };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin && !allowedOrigins.has(origin)) return new Response("Origin not allowed", { status: 403 });
    return new Response("ok", { headers: { "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", ...(origin ? { "Access-Control-Allow-Origin": origin } : {}) } });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);
  if (Number(req.headers.get("content-length") || 0) > 1024 * 1024) return json({ error: "حجم الطلب أكبر من المسموح." }, 413, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publicKey = publicKeyFromEnv();
  const serviceKey = serviceKeyFromEnv();
  if (!supabaseUrl || !publicKey || !serviceKey || req.headers.get("apikey") !== publicKey) {
    return json({ error: "تعذر التحقق من إعدادات الاتصال." }, 401, origin);
  }
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const input = await req.json();
    const action = String(input?.action || "");
    const id = String(input?.submission_id || input?.id || "");
    const fp = await fingerprint(req, serviceKey);

    if (action === "upload-ticket") {
      if (!uuidPattern.test(id)) return json({ error: "رقم الطلب غير صالح." }, 400, origin);
      if (!["images", "documents"].includes(String(input.kind))) return json({ error: "نوع الملف غير صالح." }, 400, origin);\n      const kind = input.kind as "images" | "documents";
      const mime = String(input.content_type || "");
      const ext = extFor(mime);
      const size = Number(input.size || 0);
      const maxSize = kind === "images" ? 15 * 1024 * 1024 : 10 * 1024 * 1024;
      if (!ext || (kind === "images" && mime !== "image/jpeg") || size < (kind === "images" ? 4 : 8) || size > maxSize) {
        return json({ error: "نوع الملف أو حجمه غير مسموح." }, 400, origin);
      }
      const { data: allowed, error: limitError } = await service.rpc("layan_guest_take_rate_slot", {
        p_kind: "upload", p_fingerprint_hash: fp, p_limit: 15, p_window_minutes: 60,
      });
      if (limitError || allowed !== true) return json({ error: "تم تجاوز عدد محاولات رفع الملفات. حاول لاحقًا." }, 429, origin);
      const path = "pending/" + id + "/" + kind + "/" + crypto.randomUUID() + "." + ext;
      const { data, error } = await service.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false });
      if (error || !data?.signedUrl || !data?.token) return json({ error: "تعذر تجهيز رفع الملف المؤقت." }, 500, origin);
      return json({ path, signedUrl: data.signedUrl, token: data.token }, 200, origin);
    }

    if (action === "submit-property") {
      if (!uuidPattern.test(id) || cleanString(input.honeypot, 200) !== "" || !input.payload || typeof input.payload !== "object" || Array.isArray(input.payload) || !validPropertyPayload(input.payload)) {
        return json({ error: "راجع بيانات العقار وبيانات التواصل قبل الإرسال." }, 400, origin);
      }
      const imagePaths = Array.isArray(input.image_paths) ? input.image_paths.map(String) : [];
      const documentPaths = Array.isArray(input.document_paths) ? input.document_paths.map(String) : [];
      if (imagePaths.length > 8 || documentPaths.length > 5
          || imagePaths.some((p: string) => !allowedPath(p, id, "images"))
          || documentPaths.some((p: string) => !allowedPath(p, id, "documents"))) {
        return json({ error: "قائمة الصور أو المستندات غير صالحة." }, 400, origin);
      }
      for (const [kind, paths] of [["images", imagePaths], ["documents", documentPaths]] as const) {
        if (!paths.length) continue;
        const { data: files, error } = await service.storage.from(BUCKET).list("pending/" + id + "/" + kind, { limit: 20 });
        if (error) return json({ error: "تعذر التحقق من الملفات المرفوعة." }, 500, origin);
        const found = new Set((files || []).map((file: { name: string }) => "pending/" + id + "/" + kind + "/" + file.name));
        if (paths.some(path => !found.has(path))) return json({ error: "لم يكتمل رفع إحدى الصور أو المستندات." }, 400, origin);
      }
      const { data: allowed, error: limitError } = await service.rpc("layan_guest_take_rate_slot", {
        p_kind: "property", p_fingerprint_hash: fp, p_limit: 3, p_window_minutes: 60,
      });
      if (limitError || allowed !== true) return json({ error: "تم تجاوز عدد إعلانات الزوار المسموح به مؤقتًا." }, 429, origin);
      const { data, error } = await service.rpc("layan_guest_submit_property", {
        p_id: id, p_payload: input.payload, p_image_paths: imagePaths,
        p_document_paths: documentPaths, p_fingerprint_hash: fp,
      });
      if (error) return json({ error: error.message || "تعذر استقبال الإعلان." }, 400, origin);
      return json({ id: data, status: "pending" }, 201, origin);
    }

    if (action === "submit-buyer") {
      if (!uuidPattern.test(id) || cleanString(input.honeypot, 200) !== "" || !input.payload || typeof input.payload !== "object" || Array.isArray(input.payload) || !validBuyerPayload(input.payload)) {
        return json({ error: "أكمل بيانات طلب البحث ووسيلة التواصل." }, 400, origin);
      }
      const { data: allowed, error: limitError } = await service.rpc("layan_guest_take_rate_slot", {
        p_kind: "buyer", p_fingerprint_hash: fp, p_limit: 5, p_window_minutes: 60,
      });
      if (limitError || allowed !== true) return json({ error: "تم تجاوز عدد طلبات البحث المسموح به مؤقتًا." }, 429, origin);
      const { data, error } = await service.rpc("layan_guest_submit_buyer", {
        p_id: id, p_payload: input.payload, p_fingerprint_hash: fp,
      });
      if (error) return json({ error: error.message || "تعذر استقبال طلب البحث." }, 400, origin);
      return json({ id: data, status: "pending" }, 201, origin);
    }

    if (action === "admin-list") {
      const { userClient, role } = await adminContext(req, supabaseUrl, publicKey);
      const [properties, buyers] = await Promise.all([
        userClient.rpc("layan_admin_list_guest_property_submissions", { p_limit: 100 }),
        userClient.rpc("layan_admin_list_guest_buyer_requests", { p_limit: 100 }),
      ]);
      if (properties.error || buyers.error) return json({ error: "تعذر تحميل طلبات الزوار." }, 500, origin);
      const propertyRows = await Promise.all((properties.data || []).map(async (row: Record<string, unknown>) => {
        const imagePaths = Array.isArray(row.image_paths) ? row.image_paths as string[] : [];
        const documentPaths = Array.isArray(row.document_paths) ? row.document_paths as string[] : [];
        const [images, documents] = await Promise.all([
          Promise.all(imagePaths.map(async path => {
            const { data } = await service.storage.from(BUCKET).createSignedUrl(path, 300);
            return data?.signedUrl || null;
          })),
          Promise.all(documentPaths.map(async path => {
            const { data } = await service.storage.from(BUCKET).createSignedUrl(path, 300);
            return data?.signedUrl || null;
          })),
        ]);
        return { ...row, image_urls: images.filter(Boolean), document_urls: documents.filter(Boolean) };
      }));
      return json({ role, properties: propertyRows, buyers: buyers.data || [] }, 200, origin);
    }

    if (action === "admin-review-property") {
      const { userClient, role } = await adminContext(req, supabaseUrl, publicKey);
      if (role !== "owner" || !uuidPattern.test(id) || !["approve", "reject"].includes(String(input.decision))) {
        return json({ error: "مراجعة إعلانات الزوار متاحة لمالك المنصة فقط." }, 403, origin);
      }
      const { data: rows, error: getError } = await service.rpc("layan_guest_get_property_submission", { p_id: id });
      const submission = Array.isArray(rows) ? rows[0] : null;
      if (getError || !submission) return json({ error: "الطلب غير موجود." }, 404, origin);
      if (submission.status === "approved" && submission.published_offer_id) {
        return json({ status: "approved", offer_id: submission.published_offer_id, already_processed: true }, 200, origin);
      }
      if (submission.status !== "pending") return json({ error: "الطلب تمت مراجعته بالفعل." }, 409, origin);
      if (input.decision === "reject") {
        const { error } = await userClient.rpc("layan_admin_reject_guest_property_submission", { p_id: id, p_note: cleanString(input.note, 300) || null });
        if (error) return json({ error: error.message }, 400, origin);
      } else {
        const publicPaths: string[] = [];
        const publicUrls: string[] = [];
        try {
          for (const privatePath of (submission.image_paths || []) as string[]) {
            const { data: file, error: downloadError } = await service.storage.from(BUCKET).download(privatePath);
            if (downloadError || !file) throw new Error("تعذر قراءة صورة مؤقتة للمراجعة.");
            const bytes = new Uint8Array(await file.arrayBuffer());
            if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error("إحدى الصور المرفوعة ليست JPEG سليمة.");
            const publicPath = "offers/guest/" + id + "/" + crypto.randomUUID() + ".jpg";
            const { error: uploadError } = await service.storage.from(PUBLIC_BUCKET).upload(publicPath, bytes, {
              contentType: "image/jpeg", upsert: false,
            });
            if (uploadError) throw new Error("تعذر تجهيز صورة الإعلان للنشر.");
            publicPaths.push(publicPath);
            publicUrls.push(service.storage.from(PUBLIC_BUCKET).getPublicUrl(publicPath).data.publicUrl);
          }
          const { data: offerId, error: publishError } = await userClient.rpc("layan_admin_publish_guest_property_submission", {
            p_id: id, p_image_urls: publicUrls,
          });
          if (publishError) throw new Error(publishError.message || "تعذر نشر إعلان الزائر.");
          const { error: cleanupError } = await service.storage.from(BUCKET).remove((submission.image_paths || []) as string[]);
          return json({ status: "approved", offer_id: offerId, temporary_image_cleanup_pending: Boolean(cleanupError) }, 200, origin);
        } catch (error) {
          const { data: latestRows } = await service.rpc("layan_guest_get_property_submission", { p_id: id });
          const latest = Array.isArray(latestRows) ? latestRows[0] : null;
          if (latest?.status === "approved" && latest?.published_offer_id) {
            return json({ status: "approved", offer_id: latest.published_offer_id, recovered_after_connection_error: true }, 200, origin);
          }
          if (publicPaths.length) await service.storage.from(PUBLIC_BUCKET).remove(publicPaths);
          return json({ error: String(error instanceof Error ? error.message : error) }, 400, origin);
        }
      }
      const paths = [...(submission.image_paths || []), ...(submission.document_paths || [])] as string[];
      const { error: cleanupError } = paths.length
        ? await service.storage.from(BUCKET).remove(paths)
        : { error: null };
      return json({ status: "rejected", temporary_file_cleanup_pending: Boolean(cleanupError) }, 200, origin);
    }

    if (action === "admin-review-buyer") {
      const { userClient, role } = await adminContext(req, supabaseUrl, publicKey);
      if (role !== "owner" && role !== "admin") return json({ error: "غير مخوّل." }, 403, origin);
      if (!uuidPattern.test(id) || !["contacted", "rejected"].includes(String(input.decision))) return json({ error: "قرار المراجعة غير صالح." }, 400, origin);
      const { error } = await userClient.rpc("layan_admin_review_guest_buyer_request", {
        p_id: id, p_status: input.decision, p_note: cleanString(input.note, 300) || null,
      });
      if (error) return json({ error: error.message }, 400, origin);
      return json({ status: input.decision }, 200, origin);
    }

    return json({ error: "Action not allowed" }, 400, origin);
  } catch (error) {
    return json({ error: String(error instanceof Error ? error.message : error).slice(0, 300) }, 400, origin);
  }
});
