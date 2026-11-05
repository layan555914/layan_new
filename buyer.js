document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const config = window.LAYAN_CONFIG;
  const root = document.createElement("section");
  root.id = "buyerMatchSection";
  root.className = "buyer-match-section";
  root.innerHTML = `
    <div class="buyer-match-wrap">
      <div class="section-heading"><div><span class="eyebrow">بحث ذكي حسب احتياجك</span><h2>خلّي أسيوط عقار تلاقي لك عقارك</h2>
      <p>حدد نوع الوحدة والمنطقة وميزانيتك، وسنطابق طلبك مع العروض المنشورة المتاحة.</p></div></div>
      <div class="buyer-match-layout">
        <form id="buyerPreferenceForm" class="buyer-preference-form">
          <p class="buyer-login-note" id="buyerLoginNote">سجّل الدخول لحفظ طلبك ومتابعة العروض المناسبة لك.</p>
          <label>إيه نوع العقار اللي بتدور عليه؟
            <select name="property_type" required><option value="أي نوع">أي نوع</option><option value="شقة">شقة</option><option value="فيلا">فيلا</option><option value="محل">محل تجاري</option><option value="مكتب إداري">مكتب إداري</option><option value="عيادة طبية">عيادة طبية</option><option value="مخزن">مخزن</option><option value="معرض">معرض</option><option value="أرض">أي أرض</option><option value="أرض مطروحة للبناء">أرض مطروحة للبناء</option><option value="أرض تنازل">أرض تنازل</option></select>
          </label>
          <label>المدينة / المركز
            <select name="city">
              <option value="">كل مدن ومراكز أسيوط</option>
              <option value="مدينة أسيوط">مدينة أسيوط</option><option value="أسيوط الجديدة">أسيوط الجديدة</option>
              <option value="ديروط">ديروط</option><option value="القوصية">القوصية</option><option value="منفلوط">منفلوط</option>
              <option value="أبنوب">أبنوب</option><option value="الفتح">الفتح</option><option value="ساحل سليم">ساحل سليم</option>
              <option value="البداري">البداري</option><option value="أبو تيج">أبو تيج</option><option value="صدفا">صدفا</option><option value="الغنايم">الغنايم</option>
            </select>
          </label>
          <label>الحي / المنطقة المفضلة
            <input name="area" type="text" maxlength="100" list="buyerAreaHints" placeholder="اكتب اسم الحي أو المنطقة (اختياري)">
            <datalist id="buyerAreaHints"><option value="الهضبة"></datalist>
          </label>
          <label>أقصى سعر إجمالي تقدر عليه (جنيه)
            <input name="max_total_price" type="number" min="0" step="1000" inputmode="decimal" placeholder="اتركه 0 لو مش شرط">
          </label>
          <label>أقصى مبلغ معاك في البداية (جنيه)
            <input name="max_upfront" type="number" min="0" step="1000" inputmode="decimal" placeholder="المبلغ المدفوع ورسوم التنازل">
          </label>
          <label>أقصى قسط شهري مناسب لك (جنيه)
            <input name="max_monthly_installment" type="number" min="0" step="500" inputmode="decimal" placeholder="اختياري — 0 يعني بدون تحديد">
          </label>
          <label>أقل عدد غرف نوم (للشقق والفلل)
            <select name="min_bedrooms"><option value="0">مش شرط</option><option value="1">غرفة واحدة أو أكثر</option><option value="2">غرفتان أو أكثر</option><option value="3">3 غرف أو أكثر</option><option value="4">4 غرف أو أكثر</option></select>
          </label>
          <label>تفاصيل إضافية عن احتياجك
            <textarea name="notes" rows="3" maxlength="500" placeholder="مثال: دور منخفض، قريب من المواصلات، مناسب للسكن..."></textarea>
          </label>
          <div class="buyer-notify-choice"><label><input name="notifications_enabled" type="checkbox" checked> أرسل لي تنبيهًا عند ظهور عقار يطابق طلبي</label></div>
          <button class="btn btn-gold" type="submit">احفظ طلبي وابحث عن المناسب</button>
          <button class="btn btn-outline-dark" id="buyerPushSubscribe" type="button">تفعيل إشعارات الهاتف حتى عند إغلاق التطبيق</button><button class="btn btn-outline-dark" id="buyerPushUnsubscribe" type="button" hidden>إيقاف إشعارات هذا الجهاز</button><p class="buyer-push-help">يتطلب HTTPS وموافقة المتصفح. على بعض الهواتف يلزم تثبيت أسيوط عقار على الشاشة الرئيسية.</p>
          <p id="buyerMatchStatus" role="status" aria-live="polite"></p>
        </form>
        <div class="buyer-match-results">
          <div class="buyer-results-heading"><h3>العروض المناسبة لك</h3><span id="buyerMatchCount">0 عرض</span></div>
          <div id="buyerMatchCards"><div class="buyer-empty">املأ بياناتك وسنبحث في العروض المنشورة.</div></div>
          <section class="buyer-alerts-panel" aria-labelledby="buyerAlertsTitle">
            <div class="buyer-alerts-heading"><h3 id="buyerAlertsTitle">تنبيهات العروض الجديدة</h3><button id="markBuyerAlertsRead" class="link-btn" type="button" hidden>تحديد الكل كمقروء</button></div>
            <p id="buyerAlertsCount" class="buyer-alerts-count">التنبيهات الجديدة ستظهر هنا بعد تسجيل الدخول وحفظ طلبك.</p>
            <div id="buyerAlertList" aria-live="polite"></div>
          </section>
        </div>
      </div>
      <p class="buyer-privacy-note">بيانات الميزانية والاحتياج خاصة بحسابك ولا تظهر لأصحاب الإعلانات. عند تفعيل إشعارات الهاتف، يمكن تنبيهك عند اعتماد عقار مطابق حتى إذا كانت المنصة مغلقة، بحسب دعم المتصفح ونظام الهاتف. وإن لم تفعّلها فستظل التنبيهات محفوظة داخل حسابك. المطابقة استرشادية؛ راجع تفاصيل العرض وتحقق من الالتزامات قبل الاتفاق.</p>
    </div>`;
  // The home page links to the full buyer-match tool on the offers page instead of embedding it.
  if (document.body.classList.contains("page-home")) return;
  const offersSection = document.getElementById("offers");
  if (offersSection) offersSection.parentNode.insertBefore(root, document.getElementById("calculator") || offersSection.nextSibling);
  else document.querySelector("main")?.appendChild(root);

  const $ = (id) => document.getElementById(id);
  const form = $("buyerPreferenceForm");
  const status = $("buyerMatchStatus");
  const cards = $("buyerMatchCards");
  const count = $("buyerMatchCount");
  const loginNote = $("buyerLoginNote");
  const money = n => Number(n || 0).toLocaleString("ar-EG-u-nu-latn", {maximumFractionDigits:0}) + " ج.م";
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const authService = () => window.LAYAN_SUPABASE || null;
  const getSession = () => authService()?.getSession?.() || null;
  const auth = () => { const s=getSession(); return s?.access_token && s?.user?.id ? s : null; };
  async function requireSession() {
    const service=authService();
    if(!service?.requireAuthenticated) throw new Error("خدمة تسجيل الدخول غير جاهزة. حدّث الصفحة وحاول مرة أخرى.");
    return await service.requireAuthenticated();
  }
  const apiBase = () => String(config?.SUPABASE_URL || "").replace(/\/$/,"");
  const headers = () => { const s=auth(); return { apikey: config?.SUPABASE_PUBLISHABLE_KEY || "", Authorization: "Bearer " + (s?.access_token || config?.SUPABASE_PUBLISHABLE_KEY || ""), "Content-Type":"application/json" }; };
  async function request(path, options={}) {
    if (!apiBase() || !config?.SUPABASE_PUBLISHABLE_KEY) throw new Error("إعدادات الاتصال غير مكتملة.");
    const res = await fetch(apiBase()+path, {...options, headers:{...headers(), ...(options.headers||{})}});
    const raw = await res.text(); let data=null; try { data=raw?JSON.parse(raw):null; } catch { data=raw; }
    if (!res.ok) throw new Error(data?.message || data?.msg || data?.details || "تعذر الاتصال بقاعدة البيانات.");
    return data;
  }
  const values = () => {
    const d = new FormData(form);
    return {property_type:String(d.get("property_type")||"أي نوع"), city:String(d.get("city")||"").trim(), area:String(d.get("area")||"").trim(), max_total_price:Number(d.get("max_total_price")||0), max_upfront:Number(d.get("max_upfront")||0), max_monthly_installment:Number(d.get("max_monthly_installment")||0), min_bedrooms:Number(d.get("min_bedrooms")||0), notes:String(d.get("notes")||"").trim(), notifications_enabled:d.get("notifications_enabled")==="on"};
  };
  const normalizeLocation = value => String(value||"").trim().toLocaleLowerCase().replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/^مدينه\s+/,"").replace(/[\u064B-\u065F\u0670]/g,"").replace(/[ـ]/g,"").replace(/\s+/g," ");
  function matches(o,p) {
    const offerType = String(o.property_type || "").trim();
    const requestedType = String(p.property_type || "أي نوع").trim();
    const typeMatches = requestedType === "أي نوع" ||
      (requestedType === "أرض" ? offerType.includes("أرض") : offerType === requestedType);
    if (!typeMatches) return false;
    if (p.city && normalizeLocation(o.city)!==normalizeLocation(p.city)) return false;
    if (p.area && !normalizeLocation(o.area).includes(normalizeLocation(p.area))) return false;
    if (p.max_total_price>0 && Number(o.total_price||0)>p.max_total_price) return false;
    const upfront = Number(o.paid_amount||0)+Number(o.assignment_fee||0);
    if (p.max_upfront>0 && upfront>p.max_upfront) return false;
    const monthly = Number(o.monthly_installment||0);
    if (p.max_monthly_installment>0 && monthly>0 && monthly>p.max_monthly_installment) return false;
    if (p.min_bedrooms>0 && Number(o.bedrooms||0)<p.min_bedrooms) return false;
    return true;
  }
  function render(rows,p) {
    count.textContent = rows.length + " عرض";
    if (!rows.length) { cards.innerHTML='<div class="buyer-empty">مفيش عرض مطابق لكل الشروط حاليًا. جرّب توسّع الميزانية أو تغيّر المنطقة.</div>'; return; }
    cards.innerHTML=rows.map(o=>`<article class="buyer-match-card"><span class="buyer-match-type">${esc(o.property_type||"عقار")}</span><h4>${esc(o.title||"عرض عقاري")}</h4><p>📍 ${esc([o.city||o.governorate,o.area].filter(Boolean).join(" · ")||"أسيوط")}</p><div class="buyer-match-price"><span>السعر الإجمالي</span><strong>${money(o.total_price)}</strong></div><div class="buyer-match-price"><span>المدفوع + رسوم التنازل</span><strong>${money(Number(o.paid_amount||0)+Number(o.assignment_fee||0))}</strong></div>${Number(o.monthly_installment||0)>0?`<div class="buyer-match-price"><span>القسط الشهري المسجل</span><strong>${money(o.monthly_installment)}</strong></div>`:""}<a class="btn btn-gold" href="./?offer=${encodeURIComponent(o.id)}" data-buyer-title="${esc(o.title||"عرض عقاري")}">شوف العرض في القائمة</a></article>`).join("");
  }
  let saved = null;
  let knownMatches = new Set();
  let baselineReady = false;
  let checkInProgress = false;
  const alertList=$("buyerAlertList"),alertCount=$("buyerAlertsCount"),markAlertsReadButton=$("markBuyerAlertsRead");
  function renderAlerts(rows) {
    const alerts=Array.isArray(rows)?rows:[];
    const unread=alerts.filter(row=>!row.read_at).length;
    alertCount.textContent=unread?unread+" تنبيه غير مقروء":(alerts.length?"لا توجد تنبيهات جديدة غير مقروءة.":"لا توجد تنبيهات حتى الآن.");
    markAlertsReadButton.hidden=unread===0;
    alertList.innerHTML=alerts.length?alerts.map(row=>'<article class="buyer-alert-item '+(row.read_at?"is-read":"is-unread")+'"><a href="./?offer='+encodeURIComponent(row.offer_id)+'"><strong>'+esc(row.title_snapshot)+'</strong><span>'+esc([row.city_snapshot,row.area_snapshot].filter(Boolean).join(" · ")||"أسيوط")+'</span><small>'+new Date(row.created_at).toLocaleString("ar-EG-u-nu-latn")+'</small></a></article>').join(""):'<div class="buyer-empty">عند ظهور عقار جديد يناسب طلبك، سنضيف تنبيهًا هنا.</div>';
  }
  async function loadAlerts() {
    const api=authService();
    if(!api?.isAuthenticated?.()){renderAlerts([]);return;}
    try{renderAlerts(await api.getBuyerAlerts(20));}
    catch(error){alertCount.textContent="تعذر تحميل التنبيهات: "+(error.message||"");}
  }
  async function loadOffers() {
    const rows = await request("/rest/v1/property_offers?select=id,title,governorate,city,area,latitude,longitude,property_type,total_price,paid_amount,assignment_fee,monthly_installment,bedrooms,status,created_at&status=eq.available&order=created_at.desc", {
      headers: { Authorization: "Bearer " + (config?.SUPABASE_PUBLISHABLE_KEY || "") }
    });
    const hints=document.getElementById("buyerAreaHints");
    if(hints) {
      const areas=[...new Set(["الهضبة",...(Array.isArray(rows)?rows:[]).map(row=>String(row.area||"").trim()).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,"ar"));
      hints.innerHTML=areas.map(area=>'<option value="'+esc(area)+'"></option>').join("");
    }
    return rows;
  }
  async function refreshMatches(notify=false) {
    if (!saved || checkInProgress) return;
    checkInProgress=true;
    try {
      const offers=await loadOffers();
      const matched=offers.filter(o=>matches(o,saved));
      const fresh=baselineReady ? matched.filter(o=>!knownMatches.has(String(o.id))) : [];
      if (notify && saved.notifications_enabled && fresh.length) {
        const api=authService();
        let insertedAlerts=[];
        try { insertedAlerts=await api?.addBuyerAlerts?.(fresh)||[]; }
        catch(error) { status.textContent="تعذر حفظ التنبيه داخل حسابك: "+(error.message||""); }
        if (insertedAlerts.length) await loadAlerts();
      }
      knownMatches=new Set(matched.map(o=>String(o.id)));
      baselineReady=true;
      render(matched,saved);
      await loadAlerts();
    } catch(e) { status.textContent=e.message; }
    finally { checkInProgress=false; }
  }
  async function loadSaved() {
    const current=auth();
    loginNote.hidden=Boolean(current);
    if (!current) return;
    try {
      const s=await requireSession();
      const rows=await request("/rest/v1/buyer_preferences?select=property_type,city,area,max_total_price,max_upfront,max_monthly_installment,min_bedrooms,notes,notifications_enabled&owner_id=eq."+encodeURIComponent(s.user.id)+"&limit=1");
      if (!Array.isArray(rows)||!rows.length) return;
      saved=rows[0];
      for (const [k,v] of Object.entries(saved)) { const el=form.elements.namedItem(k); if (el) { if (el.type==="checkbox") el.checked=Boolean(v); else el.value=v ?? ""; } }
      await refreshMatches(false);
    } catch(e) { status.textContent="تعذر تحميل طلبك المحفوظ: "+e.message; }
  }
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    if (!auth()) { status.textContent="سجّل الدخول أولًا لحفظ طلبك ومتابعة العروض المناسبة."; document.getElementById("loginBtn")?.click(); return; }
    saved=values();
    baselineReady=false;
    knownMatches=new Set();
    status.textContent="جارٍ حفظ طلبك والبحث عن العروض...";
    try {
      const s=await requireSession();
      await request("/rest/v1/buyer_preferences?on_conflict=owner_id",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates,return=representation"},body:JSON.stringify({...saved,owner_id:s.user.id,updated_at:new Date().toISOString()})});
      await refreshMatches(false);
      status.textContent="تم حفظ طلبك والبحث في العروض المنشورة. سنعرض المطابقات الجديدة أثناء فتح المنصة.";
    } catch(e) { status.textContent="تعذر حفظ الطلب: "+e.message; }
  });
  const pushSubscribeButton=$("buyerPushSubscribe");
  const pushUnsubscribeButton=$("buyerPushUnsubscribe");
  function decodeVapidKey(value) {
    const padding="=".repeat((4-value.length%4)%4);
    const raw=atob((value+padding).replace(/-/g,"+").replace(/_/g,"/"));
    return Uint8Array.from(raw,char=>char.charCodeAt(0));
  }
  async function invokePush(action,extra={}) {
    const session=await requireSession();
    const response=await fetch(apiBase()+"/functions/v1/asyut-push",{method:"POST",headers:{apikey:config?.SUPABASE_PUBLISHABLE_KEY||"",Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({action,...extra})});
    const raw=await response.text();let data={};try{data=raw?JSON.parse(raw):{}}catch(_){}
    if(!response.ok)throw new Error(data.error||data.message||"تعذر الاتصال بخدمة إشعارات الهاتف.");
    return data;
  }
  async function refreshPushButtons() {
    if(!pushSubscribeButton||!pushUnsubscribeButton)return;
    pushSubscribeButton.hidden=false;pushUnsubscribeButton.hidden=true;
    if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){pushSubscribeButton.disabled=true;pushSubscribeButton.textContent="إشعارات الهاتف غير مدعومة في هذا المتصفح";return;}
    pushSubscribeButton.disabled=false;pushSubscribeButton.textContent="تفعيل إشعارات الهاتف حتى عند إغلاق التطبيق";
    if(!auth())return;
    try {
      const registration=await navigator.serviceWorker.ready;
      const subscription=await registration.pushManager.getSubscription();
      if(!subscription)return;
      const state=await invokePush("subscription_status",{endpoint:subscription.endpoint});
      if(state.subscribed){pushSubscribeButton.hidden=true;pushUnsubscribeButton.hidden=false;}
      else pushSubscribeButton.textContent="ربط إشعارات هذا الجهاز بحسابك";
    } catch(error){console.warn("تعذر فحص اشتراك الإشعارات:",error);}
  }
  pushSubscribeButton.addEventListener("click",async()=>{
    if(!auth()){status.textContent="سجّل الدخول أولًا لتفعيل إشعارات حسابك.";document.getElementById("loginBtn")?.click();return;}
    if(!window.isSecureContext||!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){status.textContent="إشعارات الهاتف تتطلب متصفحًا يدعم Push واتصال HTTPS. جرّب تثبيت المنصة من Chrome.";return;}
    pushSubscribeButton.disabled=true;status.textContent="جارٍ إعداد إشعارات الهاتف...";
    try {
      const permission=await Notification.requestPermission();
      if(permission!=="granted")throw new Error("لم تسمح بإشعارات المتصفح. فعّل الإذن من إعدادات الموقع ثم حاول مجددًا.");
      const configData=await invokePush("get_public_key");
      if(!configData.publicKey)throw new Error("لم يصل مفتاح التفعيل من خادم الإشعارات.");
      const registration=await navigator.serviceWorker.ready;
      let subscription=await registration.pushManager.getSubscription();
      if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapidKey(configData.publicKey)});
      await invokePush("save_subscription",{subscription:subscription.toJSON()});
      status.textContent="تم ربط هذا الجهاز بحسابك. ستصلك تنبيهات العروض المطابقة حتى عند إغلاق المنصة، بحسب دعم المتصفح ونظام الهاتف.";
      await refreshPushButtons();
    } catch(error){status.textContent=error.message||"تعذر تفعيل إشعارات الهاتف.";}
    finally{pushSubscribeButton.disabled=false;}
  });
  pushUnsubscribeButton.addEventListener("click",async()=>{
    if(!auth()){status.textContent="سجّل الدخول لإدارة إشعارات حسابك.";return;}
    pushUnsubscribeButton.disabled=true;
    try {
      const registration=await navigator.serviceWorker.ready;
      const subscription=await registration.pushManager.getSubscription();
      if(subscription){await invokePush("delete_subscription",{endpoint:subscription.endpoint});await subscription.unsubscribe();}
      status.textContent="تم إيقاف إشعارات هذا الجهاز لهذا الحساب.";
      await refreshPushButtons();
    } catch(error){status.textContent=error.message||"تعذر إيقاف إشعارات الهاتف.";}
    finally{pushUnsubscribeButton.disabled=false;}
  });
  refreshPushButtons();
  cards.addEventListener("click",e=>{
    const a=e.target.closest("[data-buyer-title]"); if(!a) return;
    const offersGrid=document.getElementById("offersGrid");
    const search=document.getElementById("searchInput");
    if(search) { search.value=a.dataset.buyerTitle || ""; search.dispatchEvent(new Event("input",{bubbles:true})); }
    if(offersGrid) offersGrid.scrollIntoView({behavior:"smooth",block:"start"});
  });
  markAlertsReadButton.addEventListener("click",async()=>{
    try { await authService()?.markBuyerAlertsRead?.(); await loadAlerts(); }
    catch(error) { status.textContent="تعذر تحديث حالة التنبيهات."; }
  });
  async function reloadBuyerAccountState() {
    refreshPushButtons();
    baselineReady=false;
    knownMatches=new Set();
    saved=null;
    if(auth()) {
      await loadSaved();
      if(saved) await refreshMatches(false);
    } else {
      loginNote.hidden=false;
      renderAlerts([]);
      cards.innerHTML='<div class="buyer-empty">سجّل الدخول واحفظ طلبك لعرض المطابقات والتنبيهات الخاصة بحسابك.</div>';
      count.textContent="0 عرض";
    }
  }
  window.addEventListener("layan-auth-state-changed",event=>{
    if(event.detail?.authenticated) reloadBuyerAccountState();
    else { saved=null; baselineReady=false; knownMatches=new Set(); loginNote.hidden=false; renderAlerts([]); refreshPushButtons(); }
  });
  window.addEventListener("layan-auth-callback",event=>{
    if(event.detail?.success) reloadBuyerAccountState();
  });
  loadSaved().then(()=>{ if(saved) refreshMatches(false); });
  window.addEventListener("focus",()=>{if(saved)refreshMatches(true);});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&saved)refreshMatches(true);});
  window.setInterval(()=>{if(saved&&!document.hidden)refreshMatches(true);},60000);
});