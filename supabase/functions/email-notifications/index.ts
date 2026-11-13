import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const SITE_URL = "https://www.asyutq.com";
const ALLOWED_ORIGINS = new Set([
  "https://asyutq.com",
  "https://www.asyutq.com",
  "https://layan-eg.com",
  "https://www.layan-eg.com"
]);

type Announcement = {
  title: string;
  category: string;
  description: string;
  location: string;
  href: string;
};

const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
      ...(origin && ALLOWED_ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin } : {})
    }
  });

function readJsonEnv(name: string): string {
  try {
    const parsed = JSON.parse(Deno.env.get(name) || "{}");
    return String(parsed.default || "");
  } catch {
    return "";
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch] || ch);
}

function validEmail(value: unknown): value is string {
  return typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function clients(authorization?: string) {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const publishable = readJsonEnv("SUPABASE_PUBLISHABLE_KEYS") ||
    Deno.env.get("SUPABASE_ANON_KEY") || "";
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    readJsonEnv("SUPABASE_SECRET_KEYS");
  if (!url || !publishable || !secret) throw new Error("Supabase server configuration is incomplete.");
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const user = authorization ? createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } }
  }) : null;
  return { admin, user };
}

async function requireAccount(req: Request, userClient: ReturnType<typeof createClient>) {
  const header = req.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) throw new Error("يلزم تسجيل الدخول.");
  const token = header.slice(7);
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) throw new Error("جلسة الدخول غير صالحة. سجّل الدخول مرة أخرى.");
  return data.user;
}

async function sendEmail(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
  textBody: string,
  idempotencyKey: string
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey
    },
    body: JSON.stringify({ from, to: [to], subject, html, text: textBody })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(data.message || data.name || "Resend rejected the email.").slice(0, 300));
  return String(data.id || "");
}

async function sendWelcome(admin: ReturnType<typeof createClient>, userId: string, email: string, token: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const from = Deno.env.get("EMAIL_FROM") || "";
  if (!apiKey || !from) return false;
  const unsubscribeUrl = SITE_URL + "/email-unsubscribe.html?token=" + encodeURIComponent(token);
  const html = `
    <div dir="rtl" lang="ar" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#102746;max-width:620px;margin:auto;padding:24px">
      <h2>أهلًا بك في أسيوط عقار</h2>
      <p>تم تفعيل اشتراكك في إشعارات البريد الإلكتروني.</p>
      <p>سنرسل لك رسالة عندما تعتمد الإدارة عقارًا أو خدمة أو شركة جديدة وتنشرها على المنصة.</p>
      <p><a href="${SITE_URL}">تصفح أسيوط عقار</a></p>
      <hr>
      <p style="font-size:12px">يمكنك <a href="${unsubscribeUrl}">إلغاء الاشتراك</a> في أي وقت.</p>
    </div>`;
  const id = await sendEmail(
    apiKey, from, email,
    "تم تفعيل اشتراك إشعارات أسيوط عقار",
    html,
    "تم تفعيل اشتراكك في إشعارات البريد. إلغاء الاشتراك: " + unsubscribeUrl,
    "asyutq-welcome-" + userId
  );
  if (id) {
    await admin.from("email_notification_subscriptions").update({
      welcome_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq("user_id", userId);
  }
  return Boolean(id);
}

async function loadAnnouncement(admin: ReturnType<typeof createClient>, type: string, id: string): Promise<Announcement | null> {
  if (type === "property_offer") {
    const { data, error } = await admin.from("property_offers")
      .select("id,title,city,area,property_type,total_price,price_on_request,status")
      .eq("id", Number(id)).eq("status", "available").maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      title: String(data.title || "عرض عقاري جديد"),
      category: "عقار جديد",
      description: [data.property_type, data.price_on_request ? "السعر عند التواصل" :
        (data.total_price ? Number(data.total_price).toLocaleString("en-US") + " جنيه" : "")].filter(Boolean).join(" · "),
      location: [data.city || "أسيوط", data.area].filter(Boolean).join(" — "),
      href: SITE_URL + "/property.html?id=" + encodeURIComponent(String(data.id))
    };
  }
  if (type === "marketplace_listing") {
    const { data, error } = await admin.from("marketplace_listings")
      .select("id,title,description,city,area,category,status")
      .eq("id", id).eq("status", "approved").maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      title: String(data.title || "خدمة جديدة"),
      category: "خدمة جديدة · " + String(data.category || "سوق الخدمات"),
      description: String(data.description || "").slice(0, 500),
      location: [data.city || "أسيوط", data.area].filter(Boolean).join(" — "),
      href: SITE_URL + "/marketplace.html"
    };
  }
  if (type === "company_profile") {
    const { data, error } = await admin.from("company_profiles")
      .select("id,company_name,description,city,category,status")
      .eq("id", id).eq("status", "active").maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      title: String(data.company_name || "شركة جديدة"),
      category: "شركة جديدة · " + String(data.category || "الشركات"),
      description: String(data.description || "").slice(0, 500),
      location: String(data.city || "أسيوط"),
      href: SITE_URL + "/company.html?id=" + encodeURIComponent(String(data.id))
    };
  }
  if (type === "company_ad") {
    const { data, error } = await admin.from("company_property_ads")
      .select("id,business_name,status")
      .eq("id", id).eq("status", "active").maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      title: String(data.business_name || "إعلان شركة جديد"),
      category: "إعلان شركة معتمد",
      description: "تم اعتماد إعلان الشركة وتفعيله على منصة أسيوط عقار.",
      location: "أسيوط",
      href: SITE_URL + "/companies.html"
    };
  }
  if (type === "supplier_ad") {
    const { data, error } = await admin.from("supplier_ads")
      .select("id,business_name,category,title,description,target_url,status")
      .eq("id", id).eq("status", "active").maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const target = /^https?:\/\//i.test(String(data.target_url || "")) ? String(data.target_url) : SITE_URL + "/";
    return {
      title: String(data.title || data.business_name || "إعلان جديد"),
      category: "إعلان ممول · " + String(data.category || "خدمات"),
      description: String(data.description || "").slice(0, 500),
      location: String(data.business_name || "أسيوط"),
      href: target
    };
  }
  throw new Error("نوع الإعلان غير مدعوم.");
}

async function dispatchAnnouncement(admin: ReturnType<typeof createClient>, type: string, id: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const from = Deno.env.get("EMAIL_FROM") || "";
  if (!apiKey || !from) {
    throw new Error("خدمة البريد لم تكتمل بعد: يلزم ضبط RESEND_API_KEY و EMAIL_FROM والتحقق من نطاق المرسل.");
  }
  const announcement = await loadAnnouncement(admin, type, id);
  if (!announcement) throw new Error("العرض غير موجود أو لم يحصل على اعتماد الإدارة والنشر.");

  const subscribers: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin.from("email_notification_subscriptions")
      .select("user_id,email,unsubscribe_token")
      .eq("is_enabled", true)
      .order("created_at", { ascending: true })
      .range(offset, offset + 499);
    if (error) throw error;
    subscribers.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  const eligible = subscribers.filter(row =>
    validEmail(row.email) && row.user_id && row.unsubscribe_token
  );
  if (!eligible.length) return { subscribers: 0, sent: 0, failed: 0 };

  const { data: priorRows, error: priorError } = await admin.from("email_notification_deliveries")
    .select("recipient_user_id,status")
    .eq("source_table", type)
    .eq("source_id", id);
  if (priorError) throw priorError;
  const sentUsers = new Set((priorRows || [])
    .filter((row: any) => row.status === "sent")
    .map((row: any) => row.recipient_user_id));
  const candidates = eligible.filter(row => !sentUsers.has(row.user_id));
  if (!candidates.length) return { subscribers: eligible.length, sent: 0, failed: 0 };

  const queue = candidates.map(row => ({
    source_table: type,
    source_id: id,
    recipient_user_id: row.user_id,
    recipient_email: String(row.email).trim().toLowerCase(),
    status: "queued",
    updated_at: new Date().toISOString()
  }));
  const { data: queued, error: queueError } = await admin.from("email_notification_deliveries")
    .upsert(queue, { onConflict: "source_table,source_id,recipient_user_id" })
    .select("id,recipient_user_id,recipient_email");
  if (queueError) throw queueError;
  const byUser = new Map(candidates.map(row => [row.user_id, row]));
  const work = (queued || []).map((row: any) => ({
    delivery: row,
    subscriber: byUser.get(row.recipient_user_id)
  })).filter((item: any) => item.subscriber);

  let sent = 0;
  let failed = 0;
  for (let offset = 0; offset < work.length; offset += 10) {
    const group = work.slice(offset, offset + 10);
    const results = await Promise.all(group.map(async (item: any) => {
      const subscriber = item.subscriber;
      const unsubscribeUrl = SITE_URL + "/email-unsubscribe.html?token=" +
        encodeURIComponent(subscriber.unsubscribe_token);
      const html = `
        <div dir="rtl" lang="ar" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#102746;max-width:620px;margin:auto;padding:24px">
          <div style="border-bottom:3px solid #C8963E;padding-bottom:12px"><strong style="font-size:20px">أسيوط عقار</strong><span style="font-size:12px"> · إشعار عرض جديد</span></div>
          <p style="color:#A93636;font-weight:bold;margin-top:24px">${escapeHtml(announcement.category)}</p>
          <h2>${escapeHtml(announcement.title)}</h2>
          ${announcement.description ? "<p>" + escapeHtml(announcement.description) + "</p>" : ""}
          ${announcement.location ? "<p><strong>الموقع:</strong> " + escapeHtml(announcement.location) + "</p>" : ""}
          <p><a href="${escapeHtml(announcement.href)}" style="display:inline-block;background:#C8963E;color:#102746;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">افتح العرض على المنصة</a></p>
          <hr>
          <p style="font-size:12px;color:#687386">تصلك هذه الرسالة لأنك اشتركت في إشعارات أسيوط عقار. <a href="${unsubscribeUrl}">إلغاء الاشتراك</a>.</p>
        </div>`;
      const textBody = announcement.category + "\n" + announcement.title + "\n" +
        announcement.description + "\n" + announcement.location + "\n" +
        "فتح العرض: " + announcement.href + "\nإلغاء الاشتراك: " + unsubscribeUrl;
      try {
        const providerId = await sendEmail(
          apiKey,
          from,
          item.delivery.recipient_email,
          "عرض جديد على أسيوط عقار: " + announcement.title.slice(0, 120),
          html,
          textBody,
          "asyutq-" + type + "-" + id + "-" + item.delivery.recipient_user_id
        );
        await admin.from("email_notification_deliveries").update({
          status: providerId ? "sent" : "failed",
          provider_message_id: providerId || null,
          last_error: providerId ? null : "لم يرجع مزود البريد معرّف الرسالة.",
          sent_at: providerId ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        }).eq("id", item.delivery.id);
        return providerId ? "sent" : "failed";
      } catch (error) {
        await admin.from("email_notification_deliveries").update({
          status: "failed",
          last_error: String((error as Error)?.message || "تعذر إرسال الرسالة.").slice(0, 300),
          updated_at: new Date().toISOString()
        }).eq("id", item.delivery.id);
        return "failed";
      }
    }));
    for (const result of results) {
      if (result === "sent") sent++;
      else failed++;
    }
  }
  return { subscribers: eligible.length, sent, failed, skipped: eligible.length - work.length };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response("Origin not allowed", { status: 403 });
    return json({ ok: true }, 200, origin);
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const authorization = req.headers.get("Authorization") || "";
    const { admin, user } = clients(authorization || undefined);

    if (action === "unsubscribe") {
      const token = String(body?.token || "").trim();
      if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ error: "رابط إلغاء الاشتراك غير صالح." }, 400, origin);
      const { error } = await admin.from("email_notification_subscriptions")
        .update({ is_enabled: false, unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("unsubscribe_token", token);
      if (error) throw error;
      return json({ ok: true, unsubscribed: true }, 200, origin);
    }

    if (!user) return json({ error: "يلزم تسجيل الدخول." }, 401, origin);
    const account = await requireAccount(req, user);

    if (action === "sync_subscription" || action === "set_subscription") {
      if (!account.email || !account.email_confirmed_at) {
        return json({ error: "يجب تأكيد البريد الإلكتروني أولًا." }, 403, origin);
      }
      const { data: existing, error: lookupError } = await admin.from("email_notification_subscriptions")
        .select("user_id,email,is_enabled,unsubscribe_token,welcome_sent_at")
        .eq("user_id", account.id).maybeSingle();
      if (lookupError) throw lookupError;

      if (action === "sync_subscription" && existing) {
        if (String(existing.email).toLowerCase() !== String(account.email).toLowerCase()) {
          await admin.from("email_notification_subscriptions")
            .update({
              email: String(account.email).trim().toLowerCase(),
              email_confirmed_at: account.email_confirmed_at,
              updated_at: new Date().toISOString()
            }).eq("user_id", account.id);
        }
        let welcomeSent = false;
        if (existing.is_enabled && !existing.welcome_sent_at) {
          try {
            welcomeSent = await sendWelcome(
              admin,
              account.id,
              String(account.email).trim().toLowerCase(),
              existing.unsubscribe_token
            );
          } catch (welcomeError) {
            console.warn("Welcome email retry failed:", welcomeError);
          }
        }
        return json({ ok: true, enabled: existing.is_enabled, already_registered: true, welcome_sent: welcomeSent }, 200, origin);
      }

      const enabled = action === "set_subscription"
        ? body?.enabled === true
        : account.user_metadata?.email_notifications === true;
      const now = new Date().toISOString();
      const email = String(account.email).trim().toLowerCase();
      const { data: saved, error: saveError } = await admin.from("email_notification_subscriptions")
        .upsert({
          user_id: account.id,
          email,
          is_enabled: enabled,
          source: action === "set_subscription" ? "account_preferences" : "account_signup",
          email_confirmed_at: account.email_confirmed_at,
          unsubscribed_at: enabled ? null : now,
          updated_at: now
        }, { onConflict: "user_id" })
        .select("user_id,email,is_enabled,unsubscribe_token,welcome_sent_at").single();
      if (saveError) throw saveError;

      let welcomeSent = false;
      if (enabled && !saved.welcome_sent_at) {
        try { welcomeSent = await sendWelcome(admin, account.id, email, saved.unsubscribe_token); }
        catch (welcomeError) { console.warn("Welcome email failed:", welcomeError); }
      }
      return json({ ok: true, enabled, welcome_sent: welcomeSent }, 200, origin);
    }

    if (action === "dispatch") {
      const { data: isAdmin, error: adminError } = await user.rpc("layan_is_admin");
      if (adminError || isAdmin !== true) return json({ error: "غير مصرح بتنفيذ الإجراء." }, 403, origin);
      const type = String(body?.record_type || "");
      const id = String(body?.record_id || "").trim();
      if (!/^[a-z_]{1,40}$/.test(type) || !id || id.length > 80) {
        return json({ error: "بيانات الإعلان غير صحيحة." }, 400, origin);
      }
      return json({ ok: true, ...(await dispatchAnnouncement(admin, type, id)) }, 200, origin);
    }

    return json({ error: "إجراء غير مدعوم." }, 400, origin);
  } catch (error) {
    const message = String((error as Error)?.message || "تعذر إكمال إجراء إشعارات البريد.").slice(0, 300);
    console.error("email-notifications error:", message);
    return json({ error: message }, 500, origin);
  }
});
