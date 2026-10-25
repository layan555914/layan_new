document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const config = window.LAYAN_CONFIG;
  const root = document.createElement("section");
  root.id = "buyerMatchSection";
  root.className = "buyer-match-section";
  root.innerHTML = `
    <div class="buyer-match-wrap">
      <div class="section-heading"><div><span class="eyebrow">بحث ذكي حسب احتياجك</span><h2>خلّي ليان تلاقي لك عقارك</h2>
      <p>حدد نوع الوحدة والمنطقة وميزانيتك، وسنطابق طلبك مع العروض المنشورة المتاحة.</p></div></div>
      <div class="buyer-match-layout">
        <form id="buyerPreferenceForm" class="buyer-preference-form">
          <p class="buyer-login-note" id="buyerLoginNote">سجّل الدخول لحفظ طلبك ومتابعة العروض المناسبة لك.</p>
          <label>إيه نوع العقار اللي بتدور عليه؟
            <select name="property_type" required><option value="أي نوع">أي نوع</option><option value="شقة">شقة</option><option value="فيلا">فيلا</option><option value="محل">محل تجاري</option><option value="أرض">أرض</option></select>
          </label>
          <label>المنطقة المفضلة
            <input name="area" type="text" maxlength="100" placeholder="مثال: أسيوط الجديدة (اختياري)">
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
          <div class="buyer-notify-choice"><label><input name="notifications_enabled" type="checkbox" checked> نبّهني لما يظهر عرض مناسب وأنا فاتح المنصة</label></div>
          <button class="btn btn-gold" type="submit">احفظ طلبي وابحث عن المناسب</button>
          <button class="btn btn-outline-dark" id="buyerNotificationPermission" type="button">تفعيل إشعارات المتصفح</button>
          <p id="buyerMatchStatus" role="status" aria-live="polite"></p>
        </form>
        <div class="buyer-match-results">
          <div class="buyer-results-heading"><h3>العروض المناسبة لك</h3><span id="buyerMatchCount">0 عرض</span></div>
          <div id="buyerMatchCards"><div class="buyer-empty">املأ بياناتك وسنبحث في العروض المنشورة.</div></div>
        </div>
      </div>
      <p class="buyer-privacy-note">بيانات الميزانية والاحتياج خاصة بحسابك ولا تظهر لأصحاب الإعلانات. المطابقة استرشادية؛ راجع تفاصيل العرض وتحقق من الالتزامات قبل الاتفاق.</p>
    </div>`;
  const offersSection = document.getElementById("offers");
  if (offersSection) offersSection.parentNode.insertBefore(root, document.getElementById("calculator") || offersSection.nextSibling);
  else document.querySelector("main")?.appendChild(root);

  const $ = (id) => document.getElementById(id);
  const form = $("buyerPreferenceForm");
  const status = $("buyerMatchStatus");
  const cards = $("buyerMatchCards");
  const count = $("buyerMatchCount");
  const loginNote = $("buyerLoginNote");
  const money = n => Number(n || 0).toLocaleString("ar-EG", {maximumFractionDigits:0}) + " ج.م";
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const getSession = () => { try { return JSON.parse(sessionStorage.getItem("layanSupabaseSession") || "null"); } catch { return null; } };
  const auth = () => { const s=getSession(); return s?.access_token && s?.user?.id ? s : null; };
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
    return {property_type:String(d.get("property_type")||"أي نوع"), area:String(d.get("area")||"").trim(), max_total_price:Number(d.get("max_total_price")||0), max_upfront:Number(d.get("max_upfront")||0), max_monthly_installment:Number(d.get("max_monthly_installment")||0), min_bedrooms:Number(d.get("min_bedrooms")||0), notes:String(d.get("notes")||"").trim(), notifications_enabled:d.get("notifications_enabled")==="on"};
  };
  function matches(o,p) {
    if (p.property_type!=="أي نوع" && o.property_type!==p.property_type) return false;
    if (p.area && !String(o.area||"").toLocaleLowerCase().includes(p.area.toLocaleLowerCase())) return false;
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
    cards.innerHTML=rows.map(o=>`<article class="buyer-match-card"><span class="buyer-match-type">${esc(o.property_type||"عقار")}</span><h4>${esc(o.title||"عرض عقاري")}</h4><p>📍 ${esc(o.area||o.governorate||"أسيوط")}</p><div class="buyer-match-price"><span>السعر الإجمالي</span><strong>${money(o.total_price)}</strong></div><div class="buyer-match-price"><span>المدفوع + رسوم التنازل</span><strong>${money(Number(o.paid_amount||0)+Number(o.assignment_fee||0))}</strong></div>${Number(o.monthly_installment||0)>0?`<div class="buyer-match-price"><span>القسط الشهري المسجل</span><strong>${money(o.monthly_installment)}</strong></div>`:""}<a class="btn btn-gold" href="#offers" data-buyer-offer="${esc(o.id)}">شوف العرض في القائمة</a></article>`).join("");
  }
  let saved = null;
  let knownMatches = new Set();
  let checkInProgress = false;
  async function loadOffers() {
    return await request("/rest/v1/property_offers?select=id,title,governorate,area,property_type,total_price,paid_amount,assignment_fee,monthly_installment,bedrooms,status,created_at&status=eq.available&order=created_at.desc");
  }
  async function refreshMatches(notify=false) {
    if (!saved || checkInProgress) return;
    checkInProgress=true;
    try {
      const offers=await loadOffers();
      const matched=offers.filter(o=>matches(o,saved));
      if (notify && saved.notifications_enabled) {
        const fresh=matched.filter(o=>!knownMatches.has(String(o.id)));
        if (fresh.length && knownMatches.size && "Notification" in window && Notification.permission==="granted") {
          new Notification("ليان عقار: ظهر عرض مناسب لك", {body:fresh.length===1?fresh[0].title:"ظهر "+fresh.length+" عروض تناسب طلبك", icon:"./assets/icon-192.png", tag:"layan-buyer-match"});
        }
      }
      knownMatches=new Set(matched.map(o=>String(o.id)));
      render(matched,saved);
    } catch(e) { status.textContent=e.message; }
    finally { checkInProgress=false; }
  }
  async function loadSaved() {
    const s=auth();
    loginNote.hidden=Boolean(s);
    if (!s) return;
    try {
      const rows=await request("/rest/v1/buyer_preferences?select=property_type,area,max_total_price,max_upfront,max_monthly_installment,min_bedrooms,notes,notifications_enabled&owner_id=eq."+encodeURIComponent(s.user.id)+"&limit=1");
      if (!Array.isArray(rows)||!rows.length) return;
      saved=rows[0];
      for (const [k,v] of Object.entries(saved)) { const el=form.elements.namedItem(k); if (el) { if (el.type==="checkbox") el.checked=Boolean(v); else el.value=v ?? ""; } }
      await refreshMatches(false);
    } catch(e) { status.textContent="تعذر تحميل طلبك المحفوظ: "+e.message; }
  }
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const s=auth();
    if (!s) { status.textContent="سجّل الدخول أولًا لحفظ طلبك ومتابعة العروض المناسبة."; document.getElementById("loginBtn")?.click(); return; }
    saved=values();
    status.textContent="جارٍ حفظ طلبك والبحث عن العروض...";
    try {
      await request("/rest/v1/buyer_preferences?on_conflict=owner_id",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates,return=representation"},body:JSON.stringify({...saved,owner_id:s.user.id,updated_at:new Date().toISOString()})});
      await refreshMatches(false);
      status.textContent="تم حفظ طلبك والبحث في العروض المنشورة. سنعرض المطابقات الجديدة أثناء فتح المنصة.";
    } catch(e) { status.textContent="تعذر حفظ الطلب: "+e.message; }
  });
  $("buyerNotificationPermission").addEventListener("click",async()=>{
    if (!("Notification" in window)) { status.textContent="المتصفح لا يدعم إشعارات النظام."; return; }
    const permission=await Notification.requestPermission();
    status.textContent=permission==="granted"?"تم تفعيل إشعارات المتصفح. ستظهر عند وجود عروض مطابقة أثناء فتح المنصة.":"لم يتم السماح بالإشعارات؛ ستظل العروض المطابقة ظاهرة داخل المنصة.";
  });
  cards.addEventListener("click",e=>{
    const a=e.target.closest("[data-buyer-offer]"); if(!a) return;
    const target=document.querySelector(`[data-offer-index]`);
    const offersGrid=document.getElementById("offersGrid");
    if(offersGrid) offersGrid.scrollIntoView({behavior:"smooth",block:"start"});
    const search=document.getElementById("searchInput");
    if(search) search.value="";
  });
  loadSaved().then(()=>{ if(saved) refreshMatches(false); });
  window.addEventListener("focus",()=>{if(saved)refreshMatches(true);});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&saved)refreshMatches(true);});
  window.setInterval(()=>{if(saved&&!document.hidden)refreshMatches(true);},60000);
});