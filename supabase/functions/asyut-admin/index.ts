import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set(["https://layan-eg.com", "https://www.layan-eg.com"]);

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(data: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin && !allowedOrigins.has(origin)) return new Response("Origin not allowed", { status: 403 });
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);

  const authorization = req.headers.get("Authorization");
  const publishableKey = (() => {
    try {
      const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
      return keys.default || Deno.env.get("SUPABASE_ANON_KEY") || "";
    } catch { return Deno.env.get("SUPABASE_ANON_KEY") || ""; }
  })();
  const secretKey = (() => {
    try {
      const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
      return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || keys.default || "";
    } catch { return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""; }
  })();
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !publishableKey || !secretKey) {
    return json({ error: "Unauthorized" }, 401, origin);
  }

  try {
    const token = authorization.slice("Bearer ".length);
    const userClient = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) {
      return json({ error: "جلسة الدخول غير صالحة. سجّل الدخول مرة أخرى." }, 401, origin);
    }
    const { data: isAdmin, error: adminCheckError } = await userClient.rpc("layan_is_admin");
    if (adminCheckError || isAdmin !== true) {
      return json({ error: "هذا الحساب غير مخوّل لعرض حسابات المستخدمين." }, 403, origin);
    }

    const body = await req.json().catch(() => ({}));
    if (body?.action !== "list_users") return json({ error: "Unsupported action" }, 400, origin);
    const page = Number.isInteger(body.page) ? Math.max(1, Math.min(body.page, 10000)) : 1;
    const perPage = Number.isInteger(body.perPage) ? Math.max(1, Math.min(body.perPage, 100)) : 100;

    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) return json({ error: "تعذر تحميل حسابات المستخدمين." }, 502, origin);

    const users = (data.users || []).map((user) => ({
      id: user.id,
      email: user.email || null,
      created_at: user.created_at || null,
      last_sign_in_at: user.last_sign_in_at || null,
      email_confirmed_at: user.email_confirmed_at || null,
      banned_until: user.banned_until || null,
    }));
    return json({ users, page, perPage }, 200, origin);
  } catch (_error) {
    return json({ error: "حدث خطأ أثناء تحميل حسابات المستخدمين." }, 500, origin);
  }
});