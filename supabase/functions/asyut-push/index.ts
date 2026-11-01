import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import webpush from "npm:web-push@3.6.7";

const allowedOrigins = new Set(["https://layan-eg.com", "https://www.layan-eg.com"]);
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
const normalize = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase()
  .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
  .replace(/[\u064B-\u065F\u0670]/g, "").replace(/[ـ]/g, "").replace(/\s+/g, " ");

function allowedPushEndpoint(value: string) { try { const host = new URL(value).hostname.toLowerCase(); return host === "fcm.googleapis.com" || host.endsWith(".push.services.mozilla.com") || host === "web.push.apple.com" || host.endsWith(".push.apple.com") || host === "notify.windows.com" || host.endsWith(".notify.windows.com"); } catch { return false; } }

function getKeys(name: string) {
  try {
    const values = JSON.parse(Deno.env.get(name) || "{}");
    return values.default || "";
  } catch { return ""; }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin && !allowedOrigins.has(origin)) return new Response("Origin not allowed", { status: 403 });
    return json({ ok: true }, 200, origin);
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const url = Deno.env.get("SUPABASE_URL") || "";
  const publishableKey = getKeys("SUPABASE_PUBLISHABLE_KEYS") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const secretKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || getKeys("SUPABASE_SECRET_KEYS");
  if (!token || !url || !publishableKey || !secretKey) return json({ error: "Unauthorized" }, 401, origin);

  try {
    const userClient = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "سجّل الدخول مرة أخرى." }, 401, origin);

    const adminClient = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    async function loadVapidConfig() {
      const { data, error } = await adminClient.from("buyer_push_vapid_config").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      if (data) return data;
      const keys = webpush.generateVAPIDKeys();
      const fresh = {
        id: 1,
        public_key: keys.publicKey,
        private_key: keys.privateKey,
        subject: "https://layan-eg.com/",
        updated_at: new Date().toISOString(),
      };
      const { data: created, error: insertError } = await adminClient.from("buyer_push_vapid_config").insert(fresh).select("*").single();
      if (!insertError && created) return created;
      const { data: raced, error: reloadError } = await adminClient.from("buyer_push_vapid_config").select("*").eq("id", 1).maybeSingle();
      if (reloadError || !raced) throw insertError || reloadError || new Error("Unable to initialize VAPID keys");
      return raced;
    }

    const body = await req.json().catch(() => ({}));
    if (body?.action === "get_public_key") {
      const config = await loadVapidConfig();
      return json({ publicKey: config.public_key }, 200, origin);
    }

    if (body?.action === "subscription_status") { const endpoint = String(body.endpoint || ""); if (!allowedPushEndpoint(endpoint)) return json({ error: "Invalid push endpoint" }, 400, origin); const { data, error } = await adminClient.from("buyer_push_subscriptions").select("id").eq("user_id", userData.user.id).eq("endpoint", endpoint).maybeSingle(); if (error) throw error; return json({ subscribed: Boolean(data) }, 200, origin); }
    if (body?.action === "save_subscription") { const endpoint = String(body.subscription?.endpoint || ""); const p256dh = String(body.subscription?.keys?.p256dh || ""); const authSecret = String(body.subscription?.keys?.auth || ""); let parsedEndpoint: URL; try { parsedEndpoint = new URL(endpoint); } catch { return json({ error: "Invalid push endpoint" }, 400, origin); } if (parsedEndpoint.protocol !== "https:" || !allowedPushEndpoint(endpoint) || endpoint.length > 2048 || !p256dh || !authSecret) return json({ error: "Invalid push subscription" }, 400, origin); const { data: existing, error: lookupError } = await adminClient.from("buyer_push_subscriptions").select("id,user_id").eq("endpoint", endpoint).maybeSingle(); if (lookupError) throw lookupError; if (existing && existing.user_id !== userData.user.id) return json({ error: "This device is linked to another account. Unsubscribe it from the previous account first." }, 409, origin); if (existing) { const { error: updateError } = await adminClient.from("buyer_push_subscriptions").update({ p256dh, auth: authSecret, updated_at: new Date().toISOString(), failure_count: 0 }).eq("id", existing.id).eq("user_id", userData.user.id); if (updateError) throw updateError; } else { const { error: insertError } = await adminClient.from("buyer_push_subscriptions").insert({ user_id: userData.user.id, endpoint, p256dh, auth: authSecret, updated_at: new Date().toISOString() }); if (insertError) throw insertError; } return json({ ok: true }, 200, origin); }
    if (body?.action === "delete_subscription") { const endpoint = String(body.endpoint || ""); if (!endpoint.startsWith("https://") || endpoint.length > 2048) return json({ error: "Invalid push endpoint" }, 400, origin); const { error: deleteError } = await adminClient.from("buyer_push_subscriptions").delete().eq("user_id", userData.user.id).eq("endpoint", endpoint); if (deleteError) throw deleteError; return json({ ok: true }, 200, origin); }
    if (body?.action !== "send_offer_push") return json({ error: "Unsupported action" }, 400, origin);
    const { data: isAdmin, error: adminError } = await userClient.rpc("layan_is_admin");
    if (adminError || isAdmin !== true) return json({ error: "غير مصرح بتنفيذ الإجراء." }, 403, origin);

    const offerId = Number(body.offer_id);
    if (!Number.isSafeInteger(offerId) || offerId <= 0) return json({ error: "رقم الإعلان غير صحيح." }, 400, origin);
    const { data: offer, error: offerError } = await adminClient.from("property_offers")
      .select("id,title,city,area,property_type,total_price,paid_amount,assignment_fee,monthly_installment,bedrooms,status")
      .eq("id", offerId).eq("status", "available").maybeSingle();
    if (offerError || !offer) return json({ error: "الإعلان غير منشور أو غير متاح." }, 404, origin);

    const { data: preferences, error: preferenceError } = await adminClient.from("buyer_preferences")
      .select("owner_id,property_type,city,area,max_total_price,max_upfront,max_monthly_installment,min_bedrooms,notifications_enabled")
      .eq("notifications_enabled", true);
    if (preferenceError) throw preferenceError;
    const matchedUsers = (preferences || []).filter((p: any) => {
      if (p.property_type !== "أي نوع" && p.property_type !== offer.property_type) return false;
      if (p.city && normalize(p.city) !== normalize(offer.city)) return false;
      if (p.area && !normalize(offer.area).includes(normalize(p.area))) return false;
      if (Number(p.max_total_price || 0) > 0 && Number(offer.total_price || 0) > Number(p.max_total_price)) return false;
      const upfront = Number(offer.paid_amount || 0) + Number(offer.assignment_fee || 0);
      if (Number(p.max_upfront || 0) > 0 && upfront > Number(p.max_upfront)) return false;
      const monthly = Number(offer.monthly_installment || 0);
      if (Number(p.max_monthly_installment || 0) > 0 && monthly > 0 && monthly > Number(p.max_monthly_installment)) return false;
      if (Number(p.min_bedrooms || 0) > 0 && Number(offer.bedrooms || 0) < Number(p.min_bedrooms)) return false;
      return true;
    });
    const userIds = [...new Set(matchedUsers.map((p: any) => p.owner_id).filter(Boolean))];
    if (!userIds.length) return json({ matchedUsers: 0, alertsCreated: 0, sent: 0, failed: 0 }, 200, origin);

    const alertRows = userIds.map(userId => ({
      user_id: userId,
      offer_id: offer.id,
      title_snapshot: String(offer.title || "عرض عقاري").slice(0, 180),
      city_snapshot: String(offer.city || "أسيوط").slice(0, 120),
      area_snapshot: offer.area ? String(offer.area).slice(0, 120) : null,
      price_snapshot: Number(offer.total_price || 0),
    }));
    const { data: newlyInserted, error: alertError } = await adminClient.from("buyer_offer_alerts")
      .upsert(alertRows, { onConflict: "user_id,offer_id", ignoreDuplicates: true })
      .select("user_id,offer_id");
    if (alertError) throw alertError;
    const newUserIds = [...new Set((newlyInserted || []).map((row: any) => row.user_id))];
    if (!newUserIds.length) return json({ matchedUsers: userIds.length, alertsCreated: 0, sent: 0, failed: 0 }, 200, origin);

    const { data: subscriptions, error: subscriptionError } = await adminClient.from("buyer_push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth")
      .in("user_id", newUserIds);
    if (subscriptionError) throw subscriptionError;
    const config = await loadVapidConfig();
    webpush.setVapidDetails(config.subject || "https://layan-eg.com/", config.public_key, config.private_key);
    const payload = JSON.stringify({
      title: "أسيوط عقار: عرض جديد يناسبك",
      body: String(offer.title || "ظهر عقار جديد يناسب طلبك"),
      url: "/?offer=" + encodeURIComponent(String(offer.id)),
      tag: "asyut-aqar-offer-" + String(offer.id),
      icon: "https://layan-eg.com/icon.svg",
    });
    let sent = 0, failed = 0;
    for (const subscription of subscriptions || []) {
      try {
        if (!allowedPushEndpoint(subscription.endpoint)) { await adminClient.from("buyer_push_subscriptions").delete().eq("id", subscription.id); failed++; continue; }
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, payload, { TTL: 3600, urgency: "normal" });
        sent++;
        await adminClient.from("buyer_push_subscriptions").update({ last_success_at: new Date().toISOString(), failure_count: 0 })
          .eq("id", subscription.id);
      } catch (pushError: any) {
        failed++;
        const code = Number(pushError?.statusCode || 0);
        if (code === 404 || code === 410) {
          await adminClient.from("buyer_push_subscriptions").delete().eq("id", subscription.id);
        } else {
          await adminClient.from("buyer_push_subscriptions").update({ failure_count: Number((subscription as any).failure_count || 0) + 1 })
            .eq("id", subscription.id);
        }
      }
    }
    return json({ matchedUsers: userIds.length, alertsCreated: newlyInserted?.length || 0, subscriptions: subscriptions?.length || 0, sent, failed }, 200, origin);
  } catch (error) {
    console.error("asyut-push error:", error);
    return json({ error: "تعذر إكمال إعداد أو إرسال إشعارات العروض." }, 500, origin);
  }
});