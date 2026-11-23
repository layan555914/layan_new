import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "layan_real_estat";
const MAX_BYTES = 5 * 1024 * 1024;
const allowedOrigins = new Set([
  "https://asyutq.com",
  "https://www.asyutq.com",
  "https://layan-eg.com",
  "https://www.layan-eg.com",
]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function serviceKeyFromEnv() {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || keys.default || "";
  } catch {
    return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  }
}

function response(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-owner-id",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
      ...(origin && allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    },
  });
}

async function requireAdmin(req: Request, url: string, publishableKey: string) {
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("سجّل الدخول بحساب الإدارة أولًا.");
  const userClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const token = authorization.slice(7);
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) throw new Error("جلسة الإدارة غير صالحة.");
  const { data: isAdmin, error: roleError } = await userClient.rpc("layan_is_admin");
  if (roleError || isAdmin !== true) throw new Error("هذا الحساب غير مخوّل لإدارة صور الإعلانات.");
  return data.user;
}

async function verifyOwner(service: ReturnType<typeof createClient>, ownerId: string) {
  if (!uuidPattern.test(ownerId)) throw new Error("معرّف صاحب الإعلان غير صالح.");
  const { data, error } = await service.auth.admin.getUserById(ownerId);
  if (error || !data.user) throw new Error("حساب صاحب الإعلان غير موجود.");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin && !allowedOrigins.has(origin)) return new Response("Origin not allowed", { status: 403 });
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-owner-id",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Vary": "Origin",
        ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
      },
    });
  }
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return response({ error: "Origin not allowed" }, 403, origin);

  const action = new URL(req.url).searchParams.get("action");
  const maxRequestBytes = action === "upload" ? MAX_BYTES : 16 * 1024;
  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (declaredLength > maxRequestBytes) return response({ error: "حجم الطلب أكبر من المسموح." }, 413, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publishableKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = serviceKeyFromEnv();
  if (!supabaseUrl || !publishableKey || !serviceKey) {
    return response({ error: "إعدادات خدمة الصور غير مكتملة." }, 500, origin);
  }

  try {
    await requireAdmin(req, supabaseUrl, publishableKey);
    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (action === "upload") {
      const ownerId = req.headers.get("x-owner-id") || "";
      await verifyOwner(service, ownerId);
      if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "image/jpeg") {
        return response({ error: "يُسمح برفع صور JPG فقط." }, 415, origin);
      }
      const bytes = new Uint8Array(await req.arrayBuffer());
      if (!bytes.length || bytes.length > MAX_BYTES) return response({ error: "حجم الصورة يجب ألا يتجاوز 5 ميجابايت." }, 413, origin);
      if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
        return response({ error: "محتوى الملف ليس صورة JPG سليمة." }, 415, origin);
      }
      const path = "offers/" + ownerId + "/admin-" + crypto.randomUUID() + ".jpg";
      const { error } = await service.storage.from(BUCKET).upload(path, bytes, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false,
      });
      if (error) return response({ error: "تعذر حفظ صورة الإعلان." }, 502, origin);
      const { data } = service.storage.from(BUCKET).getPublicUrl(path);
      return response({ path, public_url: data.publicUrl }, 201, origin);
    }

    if (action === "delete") {
      const body = await req.json().catch(() => null) as { path?: unknown } | null;
      const path = typeof body?.path === "string" ? body.path : "";
      const match = path.match(/^offers\/([0-9a-f-]{36})\/([a-zA-Z0-9._-]{1,160}\.(?:jpg|jpeg|png|webp))$/i);
      if (!match || !uuidPattern.test(match[1])) return response({ error: "مسار الصورة غير صالح." }, 400, origin);
      await verifyOwner(service, match[1]);
      const { error } = await service.storage.from(BUCKET).remove([path]);
      if (error) return response({ error: "تعذر حذف صورة الإعلان." }, 502, origin);
      return response({ deleted: true }, 200, origin);
    }

    return response({ error: "إجراء غير مدعوم." }, 400, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تنفيذ عملية الصورة.";
    const status = /سجّل الدخول|جلسة الإدارة/.test(message) ? 401 : /غير مخوّل/.test(message) ? 403 : 400;
    return response({ error: message }, status, origin);
  }
});
