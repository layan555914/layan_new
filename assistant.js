// ASYUT AQAR site assistant (مساعد أسيوط عقار)
// Answers questions about the platform from a built-in knowledge base and turns
// property requests ("شقة إيجار في ديروط بمقدم 200 ألف") into filtered results.
// Keeps deterministic local answers and property filters, with optional server-side Gemini for open questions. The API key never enters the browser.
(() => {
  "use strict";
  if (window.AsyutAssistant) return;

  const WA = "https://wa.me/201007044265";
  const CENTERS = ["مدينة أسيوط", "أسيوط الجديدة", "ديروط", "القوصية", "منفلوط", "أبنوب", "الفتح", "ساحل سليم", "البداري", "أبو تيج", "صدفا", "الغنايم"];
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toLatinDigits = s => String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
  const norm = s => toLatinDigits(String(s || "")).toLowerCase()
    .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[ً-ٰٟـ]/g, "")
    .replace(/[؟?!،,.]/g, " ").replace(/\s+/g, " ").trim();
  const money = n => Math.round(n).toLocaleString("en-US") + " ج.م";
  const link = (href, label) => `<a class="aa-chat-link" href="${esc(href)}">${esc(label)}</a>`;
  const ext = (href, label) => `<a class="aa-chat-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;

  // Knowledge base: [keywords (normalized fragments), answer html]
  const KB = [
    [["عموله", "عمولة", "رسوم النشر", "بكام النشر", "النشر بفلوس", "مجاني", "مجانا", "تكلفه", "سعر الاعلان", "اسعار الاعلان", "بفلوس"],
      `النشر العادي على أسيوط عقار <b>مجاني</b>، و<b>لا توجد عمولة</b> على إتمام البيع أو التنازل. التواصل مباشر بينك وبين صاحب الإعلان.<br>التمييز والإعلانات التجارية خدمات اختيارية تُتفق تفاصيلها مع الإدارة عبر واتساب. ${link("./payment.html", "الإعلانات المميزة")}`],
    [["اضيف", "اضافه اعلان", "انشر", "اعرض شقتي", "اعرض عقاري", "اعلن عن", "ابيع شقتي", "اضيف عقار", "نزل اعلان", "انزل اعلان", "ازاي اعلن", "اعرض وحدتي"],
      `لإضافة إعلانك:<br>1. سجّل الدخول أو أنشئ حسابًا.<br>2. اضغط «أضف عرضك» واملأ النوع والمكان والسعر والمقدم والمتبقي، وأضف صورًا واضحة.<br>3. يُراجع الإعلان ثم يظهر للزوار، وتتابع حالته من «إعلاناتي».<br>${link("./?add=1", "أضف إعلانك الآن")} · ${link("./guide.html", "نصائح لإعلان يبيع")}`],
    [["مراجعه", "امتي يظهر", "امتى يظهر", "اتنشر", "معلق", "حاله اعلاني", "اعلاني فين", "مش ظاهر", "اتقبل", "اترفض", "مرفوض"],
      `كل إعلان يُراجع من الإدارة قبل ظهوره للزوار حفاظًا على جودة المنصة. تابع حالة إعلانك (قيد المراجعة / منشور / مرفوض مع السبب) من ${link("./my-listings.html", "إعلاناتي")}. لو تأخرت المراجعة ${ext(WA, "راسل الإدارة على واتساب")}.`],
    [["تعديل", "اعدل", "احذف", "حذف", "اوقف", "ايقاف", "اتباع", "بعت الشقه", "اتباعت"],
      `لتعديل إعلان أو إيقافه بعد البيع افتح ${link("./my-listings.html", "إعلاناتي")}، أو ${ext(WA, "راسل الإدارة على واتساب")} بكود الإعلان (مثل ASY-0012) وسنحدّثه لك.`],
    [["تنازل", "رسوم التنازل", "المتبقي", "حاسبه", "احسب"],
      `<b>التنازل</b> يعني أن صاحب الوحدة أو الأرض يتنازل لك عن تعاقده مع الجهة أو المطوّر: تدفع له ما دفعه (المقدم والأقساط المدفوعة) وتكمل أنت الأقساط المتبقية، وقد تفرض الجهة <b>رسوم تنازل</b>.<br>راجع دائمًا العقد وجدول الأقساط وموافقة الجهة المختصة قبل الدفع. ${link("./offers.html#calculator", "حاسبة التنازل")} · ${link("./offers.html?purpose=" + encodeURIComponent("تنازل"), "عروض التنازل")}`],
    [["موثق", "توثيق", "موثوق", "شاره", "علامه التوثيق"],
      `شارة <b>«مالك موثّق»</b> تعني أن الإدارة تحققت من ملكية المعلن، و<b>«شركة موثّقة»</b> تعني أن الإدارة تحققت من الشركة. الشارة تضعها الإدارة فقط ولا يستطيع المعلن إضافتها لنفسه. ومع ذلك تحقق من المستندات بنفسك قبل أي دفع.`],
    [["نصب", "امان", "اضمن", "عربون", "احتيال", "ادفع", "تحويل فلوس", "مضمون"],
      `نصائح للأمان قبل أي اتفاق:<br>• عاين العقار بنفسك وقابل صاحبه.<br>• اطلب أصل العقد أو مستند الملكية وجدول الأقساط.<br>• في التنازل تأكد من موافقة الجهة أو المطوّر وقيمة الرسوم.<br>• لا تحوّل أي مبلغ قبل التحقق، والأفضل التعاقد عند محامٍ.<br>أسيوط عقار منصة إعلانات ولا تحصّل ثمن العقار. لو لاحظت إعلانًا مريبًا اضغط «الإبلاغ عن الإعلان» في صفحته.`],
    [["تواصل", "رقم", "واتساب", "الاداره", "اكلم", "اتصل بيكم", "خدمه العملاء", "دعم"],
      `تواصل مع إدارة أسيوط عقار: ${ext(WA, "واتساب 01007044265")} أو اتصال هاتفي على 01007044265. وللتواصل مع صاحب إعلان استخدم زري «اتصال» و«واتساب» في صفحة الإعلان.`],
    [["كلمه السر", "كلمه المرور", "نسيت", "الباسورد", "باسورد"],
      `لو نسيت كلمة المرور: اضغط «تسجيل الدخول» ثم «نسيت كلمة المرور؟» واكتب بريدك، وسيصلك رابط لتعيين كلمة جديدة. تأكد من مجلد الرسائل غير المرغوبة (Spam).`],
    [["تاكيد", "الايميل", "البريد", "رساله التفعيل", "مجاش", "ماوصلش", "موصلش", "تفعيل"],
      `بعد التسجيل يصلك بريد لتأكيد الحساب. لو لم يصل خلال دقائق: راجع مجلد Spam، ثم أعد طلب رسالة التأكيد من نافذة الدخول. لو استمرت المشكلة ${ext(WA, "راسل الإدارة")}.`],
    [["تسجيل", "حساب", "اسجل", "اعمل اكونت", "اكونت", "دخول"],
      `إنشاء الحساب مجاني: اضغط «تسجيل الدخول» ثم «إنشاء حساب»، واكتب بريدك وكلمة مرور، ثم أكّد البريد من الرسالة التي تصلك. بالحساب تقدر تضيف إعلانات وتحفظ العقارات وتطلب تنبيهات.`],
    [["مفضله", "احفظ", "حفظ", "محفوظ"],
      `اضغط «☆ حفظ» على أي عقار ليظهر في ${link("./favorites.html", "المفضلة")}. ولو سجّلت الدخول تُحفظ المفضلة في حسابك على كل أجهزتك.`],
    [["قارن", "مقارنه"],
      `اضغط «＋ قارن» على عقارين أو أكثر ثم «قارن العقارات» لترى السعر والمقدم والمتبقي والأقساط والمساحة جنبًا إلى جنب. ${link("./offers.html", "اذهب للعقارات")}`],
    [["خريطه", "مكان العقار", "اللوكيشن", "لوكيشن"],
      `في ${link("./offers.html", "صفحة العقارات")} اضغط «عرض الخريطة» لرؤية العقارات التي أضاف أصحابها موقعًا على الخريطة، وفي صفحة كل إعلان زر «عرض الموقع» إن وُجد.`],
    [["نبهني", "تنبيه", "لما ينزل", "ابلغني", "اشعار", "اشعارات"],
      `استخدم «خلّي أسيوط عقار تلاقي لك عقارك»: حدّد النوع والمكان والميزانية، وسنبلغك عند نشر عقار مناسب. ${link("./offers.html#buyerMatchSection", "اطلب عقارك")}`],
    [["سجل شركتي", "شركتي", "ملف شركه", "دليل الشركات", "شركه عقاريه", "مكتب عقاري"],
      `الشركات ومقدمو الخدمات ينشئون ملفًا تعريفيًا مجانيًا من ${link("./companies.html", "دليل الشركات")} بزر «سجّل شركتك»، ويظهر الملف بعد مراجعة الإدارة.`],
    [["اعلان ممول", "مساحه اعلانيه", "اعلن معاكم", "اعلن عندكم", "اعلان لشركتي", "ترويج", "اعلان مميز", "تمييز"],
      `للشركات: إعلانك يظهر بين نتائج العقارات، وداخل صفحات الإعلانات، وفي الصفحة الرئيسية وسوق الخدمات. التفاصيل تُتفق مع الإدارة. ${link("./advertise.html", "أعلن معنا")} · ${ext(WA, "واتساب الإدارة")}`],
    [["تشطيب", "اثاث", "صيانه", "نقل", "سباك", "كهربائي", "ديكور", "مواد بناء", "سيراميك", "دهانات", "خدمات"],
      `تجد مقدمي التشطيب والأثاث والصيانة ومواد البناء في ${link("./marketplace.html", "سوق الخدمات")} و${link("./companies.html", "دليل الشركات")}.`],
    [["مطور", "مشروع", "مشروعات", "طروحات", "حكوميه", "الدليل العقاري", "كمبوند"],
      `${link("./directory.html", "الدليل العقاري")} يجمع المطورين والمشروعات والمناطق والطروحات الحكومية في أسيوط بمعلومات مرتبطة بمصادرها.`],
    [["مناطق", "مراكز", "فين بتغطوا", "المحافظه كلها", "انهي مناطق"],
      `نغطي كل مراكز محافظة أسيوط: ${CENTERS.map(c => esc(c)).join("، ")}. اختر مركزًا من الصفحة الرئيسية أو اكتب لي مثلًا «شقة إيجار في ديروط».`],
    [["خصوصيه", "بياناتي", "رقمي هيظهر"],
      `رقمك يظهر فقط في إعلانك المنشور ليتواصل معك المهتمون، وبريدك لا يظهر لأحد. التفاصيل في ${link("./privacy.html", "سياسة الخصوصية")}.`],
    [["مين انتم", "ايه الموقع", "عن الموقع", "اسيوط عقار ايه", "مين حضرتكم"],
      `أسيوط عقار منصة عقارية لمحافظة أسيوط: بيع وإيجار وتنازل وأراضٍ، وسوق خدمات ودليل شركات ودليل عقاري. النشر مجاني ولا عمولة على البيع أو التنازل. ${link("./about.html", "عن أسيوط عقار")}`],
    [["شكرا", "متشكر", "تسلم", "جزاك"], `العفو! لو احتجت أي شيء آخر أنا هنا.`],
    [["السلام", "اهلا", "مرحبا", "هاي", "صباح", "مساء"], `أهلًا بك في أسيوط عقار! اسألني عن أي شيء في الموقع، أو اكتب طلبك مثل: «شقة للبيع في أسيوط الجديدة حدود مليون ونص».`]
  ];

  // ---- Property request parsing ----
  const TYPES = [
    [/شقه|شقق|دوبلكس|روف|استوديو/, "شقة"], [/فيلا|فلل|فله|تاون|توين|بيت|منزل/, "فيلا"], [/محل|محلات/, "محل"],
    [/مكتب|اداري/, "مكتب إداري"], [/عياده|طبي/, "عيادة طبية"], [/مخزن|مخازن/, "مخزن"], [/معرض/, "معرض"], [/ارض|اراضي|قطعه/, "أرض"]
  ];
  const PURPOSE = [[/تنازل/, "تنازل"], [/ايجار|اجار|استاجر|للايجار|مفروش/, "إيجار"], [/بيع|شراء|اشتري|للبيع|تمليك/, "بيع"]];

  function parseAmounts(text) {
    // Returns [{value, context}] for numbers like "300 الف", "1.5 مليون", "مليون ونص", "2500000".
    const t = text.replace(/مليون و ?نص/g, "1.5 مليون").replace(/نص مليون/g, "0.5 مليون").replace(/مليونين/g, "2 مليون").replace(/ربع مليون/g, "0.25 مليون");
    const out = [];
    const re = /(\d+(?:[.,]\d+)?)\s*(الف|الاف|ك|k|مليون|ملايين)?/g;
    let m;
    while ((m = re.exec(t))) {
      let n = parseFloat(m[1].replace(",", "."));
      const unit = m[2] || "";
      if (/مليون|ملايين/.test(unit)) n *= 1e6; else if (/الف|الاف|ك|k/.test(unit)) n *= 1e3;
      else if (n < 20) continue; // a bare small number is a room count, not money
      const context = t.slice(Math.max(0, m.index - 22), m.index);
      out.push({ value: n, context });
    }
    if (!out.length && /مليون/.test(t)) out.push({ value: 1e6, context: t.slice(0, t.indexOf("مليون")) });
    return out;
  }

  function parseRequest(raw) {
    const t = norm(raw);
    const f = {};
    for (const [re, v] of PURPOSE) if (re.test(t)) { f.purpose = v; break; }
    for (const [re, v] of TYPES) if (re.test(t)) { f.type = v; break; }
    if (f.type === "أرض") f.type = f.purpose === "تنازل" ? "أرض تنازل" : "أرض مطروحة للبناء";
    const city = CENTERS.find(c => t.includes(norm(c))) || (/(اسيوط الجديده|الجديده)/.test(t) ? "أسيوط الجديدة" : "");
    if (city) f.city = city;
    const beds = t.match(/(\d)\s*(غرف|غرفه|اوض|اوضه|اوضتين)/) || (/(غرفتين|اوضتين)/.test(t) ? [0, "2"] : null);
    if (beds) f.beds = String(Math.min(4, Number(beds[1])));
    for (const { value, context } of parseAmounts(t)) {
      if (/مقدم|اول|كاش|معايا|ادفع/.test(context)) f.down = value;
      else if (/قسط|شهري|شهريا|في الشهر/.test(context)) f.monthly = value;
      else if (!f.max) f.max = value;
    }
    const isSearch = Boolean(f.type || f.purpose || f.city || f.max || f.down || f.monthly) &&
      (Boolean(f.type) || /عايز|محتاج|ابحث|دور|ادور|فيه|في|عاوز|اريد|نفسي|ممكن/.test(t));
    return isSearch ? f : null;
  }

  function describe(f) {
    const parts = [];
    if (f.type) parts.push(f.type);
    if (f.purpose) parts.push(f.purpose);
    parts.push(f.city ? f.city : "كل مراكز أسيوط");
    if (f.max) parts.push((f.purpose === "إيجار" ? "إيجار حتى " : "السعر حتى ") + money(f.max));
    if (f.down) parts.push("مقدم حتى " + money(f.down));
    if (f.monthly) parts.push("قسط حتى " + money(f.monthly));
    if (f.beds) parts.push(f.beds + " غرف أو أكثر");
    return parts.join(" · ");
  }

  function offersUrl(f) {
    const p = new URLSearchParams();
    if (f.purpose) p.set("purpose", f.purpose);
    if (f.type) p.set("type", f.type);
    if (f.city) p.set("city", f.city);
    if (f.max) p.set("max", String(Math.round(f.max)));
    if (f.down) p.set("down", String(Math.round(f.down)));
    if (f.monthly) p.set("monthly", String(Math.round(f.monthly)));
    if (f.beds) p.set("beds", f.beds);
    return "./offers.html" + (p.toString() ? "?" + p : "");
  }

  // On the offers page apply the filters in place and report how many results are shown.
  function applyOnPage(f) {
    const grid = document.getElementById("offersGrid");
    if (!document.body.classList.contains("page-offers") || !grid) return null;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v == null ? "" : String(v); };
    set("searchInput", "");
    set("purposeFilter", f.purpose || "");
    set("typeFilter", f.type || "");
    set("cityFilter", f.city || "");
    set("areaFilter", "");
    set("totalPriceMaxFilter", f.max ? Math.round(f.max) : "");
    set("downPaymentMaxFilter", f.down ? Math.round(f.down) : "");
    set("monthlyMaxFilter", f.monthly ? Math.round(f.monthly) : "");
    set("minBedroomsFilter", f.beds || "");
    (document.getElementById("searchBtn") || document.getElementById("purposeFilter"))?.dispatchEvent(new Event(document.getElementById("searchBtn") ? "click" : "change", { bubbles: true }));
    const count = grid.querySelectorAll(".offer-card:not([data-sponsor-inline])").length;
    document.getElementById("offers")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return count;
  }

  function reply(message) {
    const text = norm(message);
    if (!text) return { html: "اكتب سؤالك أو طلبك وأنا أساعدك." };
    const filters = parseRequest(message);
    // A question about the platform wins over a weak search guess.
    let best = null, bestScore = 0;
    for (const [keys, answer] of KB) {
      const score = keys.reduce((s, k) => s + (text.includes(norm(k)) ? norm(k).length : 0), 0);
      if (score > bestScore) { best = answer; bestScore = score; }
    }
    const ownerIntent = /(اعرض|اضيف|انشر|اعلن عن|ابيع شقتي|ابيع عقاري|انزل اعلان|نزل اعلان)/.test(text);
    const question = /(ازاي|ازاى|ايه|هل|يعني|ليه|امتي|امتى|كيف|ماذا|ما هو|ما هي|اعمل ايه)/.test(text);
    if (best && (ownerIntent || question)) return { html: best };
    if (filters) {
      const count = applyOnPage(filters);
      const summary = `فهمت طلبك: <b>${esc(describe(filters))}</b>.`;
      if (count === null) return { html: `${summary}<br>${link(offersUrl(filters), "اعرض العقارات المطابقة")}<br><small>لو لم تجد ما يناسبك ${link("./offers.html#buyerMatchSection", "اطلب عقارك")} وسنبلغك عند نشر عقار مناسب.</small>`, action: offersUrl(filters) };
      return { html: count
        ? `${summary}<br>ظهر لك <b>${count}</b> عرض مطابق في النتائج بالأسفل.`
        : `${summary}<br>لا توجد عروض مطابقة الآن. جرّب توسيع الميزانية أو المكان، أو ${link("#buyerMatchSection", "اطلب عقارك")} وسنبلغك عند نشر عقار مناسب.` };
    }
    if (best) return { html: best };
    return { html: `أنا مساعد أسيوط عقار، أساعدك في: البحث عن عقار (اكتب مثلًا «شقة إيجار في ديروط»)، إضافة إعلانك، التنازل ورسومه، التوثيق، الحساب، وسوق الخدمات والشركات. لو سؤالك يحتاج الإدارة ${ext(WA, "راسلنا على واتساب")}.` };
  }

  function hasLocalAnswer(message) {
    if (parseRequest(message)) return true;
    const text = norm(message);
    let bestScore = 0;
    for (const [keys] of KB) {
      const score = keys.reduce((sum, key) => sum + (text.includes(norm(key)) ? norm(key).length : 0), 0);
      if (score > bestScore) bestScore = score;
    }
    const ownerIntent = /(اعرض|اضيف|انشر|اعلن عن|ابيع شقتي|ابيع عقاري|انزل اعلان|نزل اعلان)/.test(text);
    const question = /(ازاي|ازاى|ايه|هل|يعني|ليه|امتي|امتى|كيف|ماذا|ما هو|ما هي|اعمل ايه)/.test(text);
    return bestScore > 0 && (ownerIntent || question);
  }

  async function askGemini(message) {
    const config = window.LAYAN_CONFIG || {};
    const base = String(config.SUPABASE_URL || "").replace(/\/$/, "");
    const publishableKey = String(config.SUPABASE_PUBLISHABLE_KEY || "");
    if (!base || !publishableKey) return null;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(base + "/functions/v1/asyut-gemini", {
        method: "POST",
        credentials: "omit",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          apikey: publishableKey
        },
        body: JSON.stringify({ message, website: "" })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.answer !== "string") return null;
      return data.answer.trim().slice(0, 2400) || null;
    } catch {
      return null;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function formatGeminiAnswer(answer) {
    return esc(String(answer || "").replace(/\r\n?/g, "\n")).replace(/\n/g, "<br>");
  }

  const SUGGESTIONS = ["إزاي أضيف إعلاني؟", "هل فيه عمولة؟", "شقة إيجار في ديروط", "يعني إيه تنازل؟", "إزاي أتواصل مع الإدارة؟", "ساعدني أكتب وصفًا لعقاري"];
  window.AsyutAssistant = { reply, parseRequest, SUGGESTIONS };

  // ---- Floating chat widget on every page ----
  function mountWidget() {
    if (document.getElementById("aaChat") || document.body.classList.contains("no-assistant")) return;
    const root = document.createElement("div");
    root.id = "aaChat";
    root.className = "aa-chat";
    root.innerHTML = `
      <button type="button" class="aa-chat-toggle" aria-expanded="false" aria-controls="aaChatPanel" aria-label="اسأل مساعد أسيوط عقار" title="اسأل مساعد أسيوط عقار"><span class="aa-chat-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5c0 4.1-3.6 7.5-8 7.5-1.1 0-2.2-.2-3.1-.6L4 20l1.3-3.8C4.5 14.8 4 13.2 4 11.5 4 7.4 7.6 4 12 4s8 3.4 8 7.5z"/><path d="M12 8.2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="currentColor" stroke="none"/></svg><i class="aa-chat-dot"></i></span><span class="aa-chat-label">اسأل المساعد</span></button>
      <section class="aa-chat-panel" id="aaChatPanel" hidden aria-label="مساعد أسيوط عقار">
        <header class="aa-chat-head"><div><b>مساعد أسيوط عقار</b><small>مساعد عقاري ذكي لمنصة أسيوط عقار</small></div><button type="button" class="aa-chat-close" aria-label="إغلاق المساعد">×</button></header>
        <div class="aa-chat-log" role="log" aria-live="polite"></div>
        <div class="aa-chat-chips">${SUGGESTIONS.map(s => `<button type="button">${esc(s)}</button>`).join("")}</div>
        <form class="aa-chat-form"><input type="text" maxlength="400" placeholder="اكتب سؤالك أو طلبك..." aria-label="اكتب سؤالك لمساعد أسيوط عقار"><button type="submit" class="btn btn-gold">إرسال</button></form>
      </section>`;
    document.body.appendChild(root);
    const toggle = root.querySelector(".aa-chat-toggle");
    let lastY = window.scrollY;
    window.addEventListener("scroll", () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY) < 12) return;
      root.classList.toggle("is-compact", y > 320 && y > lastY);
      lastY = y;
    }, { passive: true });
    const panel = root.querySelector(".aa-chat-panel");
    const log = root.querySelector(".aa-chat-log");
    const input = root.querySelector("input");
    const add = (who, html) => {
      const item = document.createElement("div");
      item.className = "aa-chat-msg aa-chat-" + who;
      item.innerHTML = html;
      log.appendChild(item);
      log.scrollTop = log.scrollHeight;
      return item;
    };
    const open = state => {
      panel.hidden = !state;
      toggle.setAttribute("aria-expanded", String(state));
      root.classList.toggle("is-open", state);
      if (state && !log.children.length) add("bot", "أهلًا بك! أنا مساعد أسيوط عقار. اسألني عن أي شيء في الموقع، أو اكتب العقار الذي تبحث عنه.");
      if (state) input.focus();
    };
    let isAsking = false;
    const submitButton = root.querySelector(".aa-chat-form button[type='submit']");
    const ask = async text => {
      const q = String(text || "").trim();
      if (!q || isAsking) return;
      add("user", esc(q));
      input.value = "";
      isAsking = true;
      input.disabled = true;
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "جارٍ التفكير...";
      }
      try {
        const localReply = reply(q);
        if (hasLocalAnswer(q)) {
          add("bot", localReply.html);
          return;
        }
        const waiting = add("bot", "جارٍ تجهيز رد المساعد الذكي...");
        const answer = await askGemini(q);
        waiting.remove();
        add("bot", answer ? formatGeminiAnswer(answer) : localReply.html);
      } finally {
        isAsking = false;
        input.disabled = false;
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "إرسال";
        }
        input.focus();
      }
    };
    toggle.addEventListener("click", () => open(panel.hidden));
    root.querySelector(".aa-chat-close").addEventListener("click", () => open(false));
    root.querySelector(".aa-chat-chips").addEventListener("click", e => { const b = e.target.closest("button"); if (b) ask(b.textContent); });
    root.querySelector("form").addEventListener("submit", e => { e.preventDefault(); ask(input.value); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) open(false); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountWidget); else mountWidget();
})();
