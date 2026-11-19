import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const SITE_URL = "https://asyutq.com";
const PRODUCTION_ORIGINS = new Set([
  "https://asyutq.com",
  "https://www.asyutq.com"
]);
// Only this project's own Vercel preview deployments use the isolated TEST Supabase project.
const PREVIEW_ORIGIN_PATTERN = /^https:\/\/(?:layannew-git-[a-z0-9-]+|layan-[a-z0-9-]+)-mostafa-6511\.vercel\.app$/i;

function isAllowedOrigin(origin: string | null): origin is string {
  return Boolean(origin && (
    PRODUCTION_ORIGINS.has(origin) ||
    PREVIEW_ORIGIN_PATTERN.test(origin)
  ));
}

function siteUrlForOrigin(origin: string | null): string {
  return isAllowedOrigin(origin) ? origin : SITE_URL;
}
const SUPPORTED_RECORD_TYPES = new Set([
  "property_offer",
  "marketplace_listing",
  "company_profile",
  "company_ad",
  "supplier_ad",
  "directory_entity",
  "directory_entity_update",
  "directory_project",
  "directory_opportunity"
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
      ...(isAllowedOrigin(origin) ? { "Access-Control-Allow-Origin": origin } : {})
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

async function requireAccount(req: Request, userClient: any) {
  const header = req.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) throw new Error("يلزم تسجيل الدخول.");
  const token = header.slice(7);
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) throw new Error("جلسة الدخول غير صالحة. سجّل الدخول مرة أخرى.");
  return data.user;
}

const FALLBACK_EMAIL_FROM = "Asyut Aqar <notifications@notify.asyutq.com>";

function resolveEmailFrom(): string {
  const configured = String(Deno.env.get("EMAIL_FROM") || "").trim();
  const match = configured.match(/<([^<>\\s]+@[^<>\\s]+)>$/);
  const address = match ? match[1] : configured;
  const validAddress = /^[^<>\\s@]+@[^<>\\s@]+\\.[^<>\\s@]+$/.test(address);
  const validDisplay = !match || /^[^<>\\r\\n]{1,78}\\s*<[^<>\\s@]+@[^<>\\s@]+>$/.test(configured);
  const verifiedDomain = address.split("@")[1]?.toLowerCase() === "notify.asyutq.com";
  return validAddress && validDisplay && verifiedDomain ? configured : FALLBACK_EMAIL_FROM;
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

async function sendWelcome(admin: any, userId: string, email: string, token: string, siteUrl: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const from = resolveEmailFrom();
  if (!apiKey || !from) return false;
  const unsubscribeUrl = siteUrl + "/email-unsubscribe.html?token=" + encodeURIComponent(token);
  const html = `
    <div dir="rtl" lang="ar" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#102746;max-width:620px;margin:auto;padding:24px">
      <h2>أهلًا بك في أسيوط عقار</h2>
      <p>تم تفعيل اشتراكك في إشعارات البريد الإلكتروني.</p>
      <p>سنرسل لك رسالة عندما تعتمد الإدارة عقارًا أو خدمة أو شركة جديدة وتنشرها على المنصة.</p>
      <p><a href="${siteUrl}">تصفح أسيوط عقار</a></p>
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

async function loadPublishedDirectoryEntity(admin: any, id: string, siteUrl: string): Promise<Announcement | null> {
  const { data, error } = await admin.from("directory_entities")
    .select("id,name_ar,name_en,entity_type,service_category,description,public_address,public_visible,verification_status")
    .eq("id", id).eq("public_visible", true).eq("verification_status", "published").maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    title: String(data.name_ar || data.name_en || "جهة جديدة في دليل أسيوط العقاري"),
    category: "جهة جديدة في دليل أسيوط العقاري · " + String(data.service_category || data.entity_type || "دليل الشركات والخدمات"),
    description: String(data.description || "").slice(0, 500),
    location: String(data.public_address || "أسيوط"),
    href: siteUrl + "/company.html?entity_id=" + encodeURIComponent(String(data.id))
  };
}

async function loadAnnouncement(admin: any, type: string, id: string, siteUrl: string): Promise<Announcement | null> {
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
      href: siteUrl + "/property.html?id=" + encodeURIComponent(String(data.id))
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
      href: siteUrl + "/marketplace.html"
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
      href: siteUrl + "/company.html?id=" + encodeURIComponent(String(data.id))
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
      href: siteUrl + "/companies.html"
    };
  }
  if (type === "directory_entity") {
    return loadPublishedDirectoryEntity(admin, id, siteUrl);
  }
  if (type === "directory_entity_update") {
    const { data: update, error: updateError } = await admin.from("company_entity_profile_update_requests")
      .select("id,directory_entity_id,status")
      .eq("id", id).eq("status", "approved").maybeSingle();
    if (updateError) throw updateError;
    if (!update) return null;
    return loadPublishedDirectoryEntity(admin, String(update.directory_entity_id), siteUrl);
  }
  if (type === "directory_project") {
    const { data, error } = await admin.from("directory_projects")
      .select("id,name_ar,name_en,project_type,description,location_text,project_status,public_visible,verification_status")
      .eq("id", id).eq("public_visible", true).eq("verification_status", "published").maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      title: String(data.name_ar || data.name_en || "مشروع عقاري جديد"),
      category: "مشروع جديد في دليل أسيوط العقاري · " + String(data.project_type || "مشروعات عقارية"),
      description: [data.description, data.project_status ? "الحالة: " + data.project_status : ""].filter(Boolean).join(" · ").slice(0, 500),
      location: String(data.location_text || "أسيوط"),
      href: siteUrl + "/project.html?id=" + encodeURIComponent(String(data.id))
    };
  }
  if (type === "directory_opportunity") {
    const { data, error } = await admin.from("directory_opportunities")
      .select("id,name_ar,city,activity,size_description,terms_as_published,announcement_date,opportunity_type,public_visible,verification_status")
      .eq("id", id).eq("public_visible", true).eq("verification_status", "published").maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      title: String(data.name_ar || "فرصة جديدة"),
      category: "فرصة جديدة في دليل أسيوط العقاري · " + String(data.opportunity_type || "فرص استثمارية"),
      description: [data.activity, data.size_description, data.terms_as_published].filter(Boolean).join(" · ").slice(0, 500),
      location: String(data.city || "أسيوط"),
      href: siteUrl + "/directory.html?view=opportunities"
    };
  }
  if (type === "supplier_ad") {
    const { data, error } = await admin.from("supplier_ads")
      .select("id,business_name,category,title,description,target_url,status")
      .eq("id", id).eq("status", "active").maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const target = /^https?:\/\//i.test(String(data.target_url || "")) ? String(data.target_url) : siteUrl + "/";
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

async function dispatchAnnouncement(admin: any, type: string, id: string, siteUrl: string) {
  const announcement = await loadAnnouncement(admin, type, id, siteUrl);
  if (!announcement) throw new Error("العرض غير موجود أو لم يحصل على اعتماد الإدارة والنشر.");

  const subscribers: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin.from("email_notification_subscriptions")
      .select("user_id,email,unsubscribe_token,email_confirmed_at,is_enabled,unsubscribed_at")
      .is("unsubscribed_at", null)
      .or("is_enabled.eq.true,email_confirmed_at.is.null")
      .order("created_at", { ascending: true })
      .range(offset, offset + 499);
    if (error) throw error;
    subscribers.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  const eligible = subscribers.filter(row =>
    validEmail(row.email) && row.user_id && row.unsubscribe_token &&
    row.unsubscribed_at == null
  );
  if (!eligible.length) return { subscribers: 0, sent: 0, failed: 0 };

  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const from = resolveEmailFrom();
  if (!apiKey || !from) {
    throw new Error("خدمة البريد لم تكتمل بعد: يلزم ضبط RESEND_API_KEY و EMAIL_FROM من أسرار Supabase.");
  }

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
      const unsubscribeUrl = siteUrl + "/email-unsubscribe.html?token=" +
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


async function dispatchWeeklyDigest(admin: any, siteUrl: string) {
  const now = new Date();
  const localParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const part = (name: string) => localParts.find(item => item.type === name)?.value || "";
  const digestKey = part("year") + "-" + part("month") + "-" + part("day");
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const queries = await Promise.all([
    admin.from("property_offers").select("id,title,city,area,property_type,total_price,price_on_request,created_at")
      .eq("status", "available").gte("created_at", since).order("created_at", { ascending: false }).limit(8),
    admin.from("marketplace_listings").select("id,title,description,city,area,category,created_at")
      .eq("status", "approved").gte("created_at", since).order("created_at", { ascending: false }).limit(8),
    admin.from("company_profiles").select("id,company_name,description,city,category,created_at")
      .eq("status", "active").gte("created_at", since).order("created_at", { ascending: false }).limit(8),
    admin.from("company_property_ads").select("id,business_name,created_at")
      .eq("status", "active").gte("created_at", since).order("created_at", { ascending: false }).limit(8),
    admin.from("supplier_ads").select("id,business_name,category,title,description,target_url,created_at")
      .eq("status", "active").gte("created_at", since).order("created_at", { ascending: false }).limit(8),
    admin.from("directory_entities").select("id,name_ar,name_en,entity_type,service_category,description,public_address,created_at")
      .eq("public_visible", true).eq("verification_status", "published").gte("created_at", since)
      .order("created_at", { ascending: false }).limit(8),
    admin.from("directory_projects").select("id,name_ar,name_en,project_type,description,location_text,created_at")
      .eq("public_visible", true).eq("verification_status", "published").gte("created_at", since)
      .order("created_at", { ascending: false }).limit(8),
    admin.from("directory_opportunities").select("id,name_ar,city,activity,opportunity_type,created_at")
      .eq("public_visible", true).eq("verification_status", "published").gte("created_at", since)
      .order("created_at", { ascending: false }).limit(8)
  ]);
  for (const result of queries) if (result.error) throw result.error;

  const items: Announcement[] = [];
  const add = (rows: any[], make: (row: any) => Announcement) => {
    for (const row of rows || []) items.push(make(row));
  };
  add(queries[0].data, row => ({
    title: String(row.title || "عرض عقاري جديد"),
    category: "عقار جديد",
    description: [row.property_type, row.price_on_request ? "السعر عند التواصل" :
      (row.total_price ? Number(row.total_price).toLocaleString("en-US") + " جنيه" : "")].filter(Boolean).join(" · "),
    location: [row.city || "أسيوط", row.area].filter(Boolean).join(" — "),
    href: siteUrl + "/property.html?id=" + encodeURIComponent(String(row.id))
  }));
  add(queries[1].data, row => ({
    title: String(row.title || "خدمة جديدة"),
    category: "خدمة جديدة · " + String(row.category || "سوق الخدمات"),
    description: String(row.description || "").slice(0, 250),
    location: [row.city || "أسيوط", row.area].filter(Boolean).join(" — "),
    href: siteUrl + "/marketplace.html"
  }));
  add(queries[2].data, row => ({
    title: String(row.company_name || "شركة جديدة"),
    category: "شركة جديدة · " + String(row.category || "الشركات"),
    description: String(row.description || "").slice(0, 250),
    location: String(row.city || "أسيوط"),
    href: siteUrl + "/company.html?id=" + encodeURIComponent(String(row.id))
  }));
  add(queries[3].data, row => ({
    title: String(row.business_name || "إعلان شركة جديد"),
    category: "إعلان شركة معتمد",
    description: "تم تفعيل إعلان الشركة على أسيوط عقار.",
    location: "أسيوط",
    href: siteUrl + "/companies.html"
  }));
  add(queries[4].data, row => ({
    title: String(row.title || row.business_name || "إعلان جديد"),
    category: "إعلان ممول · " + String(row.category || "خدمات"),
    description: String(row.description || "").slice(0, 250),
    location: String(row.business_name || "أسيوط"),
    href: /^https?:\/\//i.test(String(row.target_url || "")) ? String(row.target_url) : siteUrl + "/"
  }));
  add(queries[5].data, row => ({
    title: String(row.name_ar || row.name_en || "جهة جديدة في الدليل"),
    category: "جهة جديدة في دليل أسيوط العقاري · " + String(row.service_category || row.entity_type || ""),
    description: String(row.description || "").slice(0, 250),
    location: String(row.public_address || "أسيوط"),
    href: siteUrl + "/company.html?entity_id=" + encodeURIComponent(String(row.id))
  }));
  add(queries[6].data, row => ({
    title: String(row.name_ar || row.name_en || "مشروع عقاري جديد"),
    category: "مشروع جديد · " + String(row.project_type || "مشروعات عقارية"),
    description: String(row.description || "").slice(0, 250),
    location: String(row.location_text || "أسيوط"),
    href: siteUrl + "/project.html?id=" + encodeURIComponent(String(row.id))
  }));
  add(queries[7].data, row => ({
    title: String(row.name_ar || "فرصة جديدة"),
    category: "فرصة جديدة · " + String(row.opportunity_type || "فرص استثمارية"),
    description: String(row.activity || "").slice(0, 250),
    location: String(row.city || "أسيوط"),
    href: siteUrl + "/directory.html?view=opportunities"
  }));

  const latest = items.slice(0, 40);
  const { data: subscribers, error: subscribersError } = await admin.from("email_notification_subscriptions")
    .select("user_id,email,unsubscribe_token,email_confirmed_at,is_enabled,unsubscribed_at")
    .is("unsubscribed_at", null)
    .or("is_enabled.eq.true,email_confirmed_at.is.null")
    .order("created_at", { ascending: true });
  if (subscribersError) throw subscribersError;
  const eligible = (subscribers || []).filter((row: any) =>
    validEmail(row.email) && row.user_id && row.unsubscribe_token
  );
  if (!eligible.length) return { subscribers: 0, sent: 0, failed: 0, items: latest.length };

  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const from = resolveEmailFrom();
  if (!apiKey) throw new Error("مفتاح خدمة البريد RESEND_API_KEY غير مضبوط.");

  const { data: priorRows, error: priorError } = await admin.from("email_notification_deliveries")
    .select("recipient_user_id,status")
    .eq("source_table", "weekly_digest")
    .eq("source_id", digestKey);
  if (priorError) throw priorError;
  const sentUsers = new Set((priorRows || [])
    .filter((row: any) => row.status === "sent")
    .map((row: any) => row.recipient_user_id));
  const candidates = eligible.filter((row: any) => !sentUsers.has(row.user_id));
  if (!candidates.length) return { subscribers: eligible.length, sent: 0, failed: 0, items: latest.length, already_sent: true };

  const queue = candidates.map((row: any) => ({
    source_table: "weekly_digest",
    source_id: digestKey,
    recipient_user_id: row.user_id,
    recipient_email: String(row.email).trim().toLowerCase(),
    status: "queued",
    updated_at: new Date().toISOString()
  }));
  const { data: queued, error: queueError } = await admin.from("email_notification_deliveries")
    .upsert(queue, { onConflict: "source_table,source_id,recipient_user_id" })
    .select("id,recipient_user_id,recipient_email");
  if (queueError) throw queueError;
  const byUser = new Map(candidates.map((row: any) => [row.user_id, row]));
  const work = (queued || []).map((delivery: any) => ({
    delivery,
    subscriber: byUser.get(delivery.recipient_user_id)
  })).filter((item: any) => item.subscriber);

  const cards = latest.map(item =>
    '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin:12px 0">' +
    '<div style="color:#A93636;font-size:12px;font-weight:bold">' + escapeHtml(item.category) + '</div>' +
    '<h3 style="margin:5px 0 8px">' + escapeHtml(item.title) + '</h3>' +
    (item.description ? '<p style="margin:4px 0">' + escapeHtml(item.description) + '</p>' : '') +
    (item.location ? '<p style="margin:4px 0;color:#687386;font-size:13px">' + escapeHtml(item.location) + '</p>' : '') +
    '<a href="' + escapeHtml(item.href) + '">شاهد التفاصيل</a></div>'
  ).join("");
  const digestHtml = '<div dir="rtl" lang="ar" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#24364b;max-width:650px;margin:auto;padding:22px">' +
    '<div style="border-bottom:3px solid #C8963E;padding-bottom:12px"><strong style="font-size:23px">أسيوط عقار</strong><div>كل اللي بتدور عليه في مكان واحد</div></div>' +
    '<h2>أحدث ما نُشر على المنصة هذا الأسبوع</h2>' +
    '<p>جمعنالك أحدث العقارات والخدمات والشركات والإعلانات والدليل العقاري في رسالة واحدة.</p>' +
    (cards || '<p>تابع المنصة باستمرار؛ يتم إضافة عروض وخدمات جديدة أولًا بأول.</p>') +
    '<p><a href="' + siteUrl + '" style="display:inline-block;background:#C8963E;color:#102746;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">افتح أسيوط عقار</a></p>' +
    '<hr><p style="font-size:12px;color:#687386">وصلتك الرسالة لأن بريدك سُجّل على منصة أسيوط عقار. إذا لم تكن أنت من سجّل هذا البريد، يمكنك إلغاء الرسائل من الرابط التالي: <a href="{{UNSUBSCRIBE_URL}}">إلغاء الاشتراك</a>.</p>' +
    '<p style="font-size:12px">لو حسابك لم يُفعّل بعد، افتح المنصة وأكمل تأكيد بريدك للاستفادة من خدمات الحساب.</p></div>';

  let sent = 0;
  let failed = 0;
  for (let offset = 0; offset < work.length; offset += 10) {
    const group = work.slice(offset, offset + 10);
    const results = await Promise.all(group.map(async (item: any) => {
      const subscriber = item.subscriber;
      const unsubscribeUrl = siteUrl + "/email-unsubscribe.html?token=" + encodeURIComponent(subscriber.unsubscribe_token);
      const html = digestHtml.replace("{{UNSUBSCRIBE_URL}}", escapeHtml(unsubscribeUrl));
      const textBody = "أحدث ما نُشر على أسيوط عقار هذا الأسبوع\n" +
        latest.map(item => item.category + " — " + item.title + "\n" + item.href).join("\n\n") +
        "\n\nتصفح المنصة: " + siteUrl + "\nإلغاء الاشتراك: " + unsubscribeUrl;
      try {
        const providerId = await sendEmail(
          apiKey, from, item.delivery.recipient_email,
          "جديد أسيوط عقار هذا الأسبوع",
          html, textBody,
          "asyutq-weekly-digest-" + digestKey + "-" + item.delivery.recipient_user_id
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
  return { subscribers: eligible.length, sent, failed, items: latest.length, skipped: eligible.length - work.length };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin && !isAllowedOrigin(origin)) return new Response("Origin not allowed", { status: 403 });
    return json({ ok: true }, 200, origin);
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (origin && !isAllowedOrigin(origin)) return json({ error: "Origin not allowed" }, 403, origin);

  try {
    const siteUrl = siteUrlForOrigin(origin);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const authorization = req.headers.get("Authorization") || "";
    const { admin, user } = clients(authorization || undefined);

    if (action === "weekly_digest") {
      const cronToken = req.headers.get("x-asyut-cron-secret") || "";
      if (!cronToken) return json({ error: "غير مصرح بتنفيذ الإجراء." }, 403, origin);
      const { data: cronAllowed, error: cronAuthError } = await admin.rpc(
        "verify_email_digest_cron_token",
        { p_token: cronToken }
      );
      if (cronAuthError || cronAllowed !== true) {
        return json({ error: "غير مصرح بتنفيذ الإجراء." }, 403, origin);
      }
      return json({ ok: true, ...(await dispatchWeeklyDigest(admin, siteUrl)) }, 200, origin);
    }

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
              existing.unsubscribe_token,
              siteUrl
            );
          } catch (welcomeError) {
            console.warn("Welcome email retry failed:", welcomeError);
          }
        }
        return json({ ok: true, enabled: existing.is_enabled, already_registered: true, welcome_sent: welcomeSent }, 200, origin);
      }

      // Newly confirmed accounts are subscribed by default. Existing rows are
      // returned above unchanged, so a user's explicit unsubscribe is respected.
      const enabled = action === "set_subscription"
        ? body?.enabled === true
        : true;
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
        try { welcomeSent = await sendWelcome(admin, account.id, email, saved.unsubscribe_token, siteUrl); }
        catch (welcomeError) { console.warn("Welcome email failed:", welcomeError); }
      }
      return json({ ok: true, enabled, welcome_sent: welcomeSent }, 200, origin);
    }

    if (action === "dispatch") {
      const { data: isAdmin, error: adminError } = await user.rpc("layan_is_admin");
      if (adminError || isAdmin !== true) return json({ error: "غير مصرح بتنفيذ الإجراء." }, 403, origin);
      const type = String(body?.record_type || "");
      const id = String(body?.record_id || "").trim();
      if (!SUPPORTED_RECORD_TYPES.has(type) || !id || id.length > 80 ||
          (type === "property_offer" && !/^\d+$/.test(id))) {
        return json({ error: "نوع الإعلان أو معرّفه غير مدعوم." }, 400, origin);
      }
      return json({ ok: true, ...(await dispatchAnnouncement(admin, type, id, siteUrl)) }, 200, origin);
    }

    return json({ error: "إجراء غير مدعوم." }, 400, origin);
  } catch (error) {
    const message = String((error as Error)?.message || "تعذر إكمال إجراء إشعارات البريد.").slice(0, 300);
    console.error("email-notifications error:", message);
    return json({ error: message }, 500, origin);
  }
});
