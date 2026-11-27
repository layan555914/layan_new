import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const allowedOrigins = new Set([
  "https://asyutq.com",
  "https://www.asyutq.com",
  // Keep the former domain temporarily to avoid breaking any still-active links.
  "https://layan-eg.com",
]);

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const headers = corsHeaders(origin);

  if (origin && !allowedOrigins.has(origin)) {
    return new Response(JSON.stringify({ error: "مصدر الطلب غير مسموح." }), {
      status: 403,
      headers,
    });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") {
    return json({ error: "طريقة الطلب غير مدعومة." }, 405, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";

  if (!supabaseUrl || !anonKey) {
    return json({ error: "إعدادات خدمة المساعد غير مكتملة على الخادم." }, 500, origin);
  }
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "سجّل الدخول أولًا لاستخدام مساعد الإدارة." }, 401, origin);
  }

  // Validate the caller's session with Supabase Auth; never trust browser-supplied role fields.
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authHeader },
  });
  if (!userResponse.ok) {
    return json({ error: "جلسة الدخول غير صالحة. سجّل الدخول مرة أخرى." }, 401, origin);
  }
  const user = await userResponse.json();
  const modeBody = await req.json().catch(() => null);
  const message = typeof modeBody?.message === "string" ? modeBody.message.trim() : "";
  const mode = modeBody?.mode === "admin" ? "admin" : "search";

  if (!message || message.length > 1200) {
    return json({ error: "اكتب سؤالًا لا يتجاوز 1200 حرف." }, 400, origin);
  }
  if (mode === "admin" && user?.app_metadata?.role !== "admin") {
    return json({ error: "مساعد الإدارة متاح لحسابات الإدارة المخوّلة فقط." }, 403, origin);
  }
  if (!openaiKey) {
    return json({
      error: "مساعد الإدارة يحتاج إعداد مفتاح مزوّد الذكاء الاصطناعي على الخادم. مساعد الزوار المجاني يظل متاحًا.",
    }, 503, origin);
  }

  // Give property-search answers only the currently public, available listing fields.
  let listings: unknown[] = [];
  if (mode === "search") {
    const fields = "id,title,governorate,area,property_type,description,total_price,down_payment,paid_amount,remaining_amount,assignment_fee,developer_name,image_urls";
    const offersResponse = await fetch(
      `${supabaseUrl}/rest/v1/property_offers?select=${fields}&status=eq.available&order=created_at.desc&limit=40`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
    );
    if (offersResponse.ok) {
      const rows = await offersResponse.json();
      if (Array.isArray(rows)) listings = rows;
    }
  }

  const systemPrompt = mode === "admin"
    ? "أنت مساعد تشغيل داخلي لمنصة أسيوط عقار (ASYUT AQAR). أجب بالعربية المصرية الواضحة والمختصرة عن تشغيل المنصة ومراجعة الطلبات وإجراءات الأمان. لا تدّع أنك نفذت إجراءً في قاعدة البيانات أو غيّرت إعدادًا. لا تكشف أسرارًا أو بيانات مستخدمين. لا تنفذ أوامر إدارية؛ قدّم إرشادات فقط. إذا كان السؤال عن طلب محدد فلا تزعم الاطلاع عليه ما لم تُمرر بيانات موثقة."
    : "أنت مساعد البحث العقاري في منصة أسيوط عقار (ASYUT AQAR) بمحافظة أسيوط. أجب بالعربية المصرية الواضحة. اعتمد فقط على قائمة العروض المرفقة عند ذكر عرض محدد؛ لا تخترع أسعارًا أو وحدات أو توافرًا. إذا لم تجد ما يطابق الطلب، قل ذلك واقترح تعديل الميزانية أو المنطقة. اذكر أن الأسعار والبيانات تحتاج التحقق المباشر من المعلن، وأن أسيوط عقار منصة إعلانات وليست وسيطًا، ولا تقدم ضمانًا قانونيًا أو ماليًا.";

  const context = mode === "search"
    ? `العروض المنشورة المتاحة (JSON):\\n${JSON.stringify(listings)}`
    : "لا توجد بيانات إدارية خاصة مرفقة بهذا الطلب.";

  const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      max_tokens: 550,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${context}\\n\\nسؤال المستخدم: ${message}` },
      ],
    }),
  });

  if (!aiResponse.ok) {
    const detail = await aiResponse.text();
    console.error("AI provider error", aiResponse.status, detail.slice(0, 500));
    return json({
      error: "خدمة مساعد الإدارة غير متاحة مؤقتًا. مساعد الزوار المجاني يظل متاحًا.",
    }, 502, origin);
  }

  const result = await aiResponse.json();
  const answer = result?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) {
    return json({ error: "لم يصل رد صالح من المساعد. حاول مرة أخرى." }, 502, origin);
  }
  return json({ answer: answer.trim() }, 200, origin);
});
