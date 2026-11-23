(() => {
  "use strict";
  const root = document.getElementById("adminGuestIntake");
  if (!root) return;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const date = value => value ? new Date(value).toLocaleString("ar-EG-u-nu-latn", { dateStyle:"medium", timeStyle:"short" }) : "—";
  const config = window.LAYAN_CONFIG || {};
  let loaded = false, busy = false, role = "unknown", propertyRows = [], buyerRows = [];
  function status(message) { const el=root.querySelector("[data-guest-status]"); if(el) el.textContent=message; }
  async function call(action, extra = {}) {
    const session = window.LAYAN_SUPABASE?.getSession?.();
    if (!session?.access_token) throw new Error("انتهت جلسة الإدارة. سجّل الدخول بالبريد وكود التحقق.");
    if (!config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY) throw new Error("إعدادات الاتصال غير جاهزة.");
    const response = await fetch(String(config.SUPABASE_URL).replace(/\/$/, "") + "/functions/v1/guest-intake", {
      method:"POST",
      headers:{ apikey:config.SUPABASE_PUBLISHABLE_KEY, Authorization:"Bearer "+session.access_token, "Content-Type":"application/json" },
      body:JSON.stringify({ action, ...extra }),
      redirect:"error"
    });
    const raw=await response.text(); let data=null;
    try { data=raw?JSON.parse(raw):null; } catch { data=null; }
    if(!response.ok) throw new Error(data?.error || "تعذر تنفيذ طلب مراجعة الزوار.");
    return data;
  }
  function propertyCard(row) {
    const p=row.payload||{};
    const images=(row.image_urls||[]).map((url,i)=>'<a class="agi-image" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer"><img src="'+esc(url)+'" alt="صورة العقار '+(i+1)+'" loading="lazy"></a>').join("");
    const docs=(row.document_urls||[]).map((url,i)=>'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">فتح المستند '+(i+1)+'</a>').join(" · ");
    const phone=esc(row.contact_phone||"");
    const fields=[
      ["المساحة بالمتر","area_m2"],["غرف النوم","bedrooms"],["الحمامات","bathrooms"],
      ["فترة الإيجار","rental_period"],["التأثيث","rental_furnishing"],
      ["التأمين","rental_security_deposit"],["الحد الأدنى للإيجار بالشهور","rental_minimum_months"],
      ["المقدم","down_payment"],["إجمالي المدفوع","paid_amount"],["المتبقي","remaining_amount"],
      ["عدد الأقساط المتبقية","remaining_installments"],["القسط الشهري","monthly_installment"],
      ["رسوم التنازل","assignment_fee"],["خصم نقدي","discount_amount"],["نسبة الخصم","discount_percent"],
      ["اسم المطور","developer_name"],["اسم المشروع","project_name"],
      ["جهة ملكية الأرض","land_ownership_authority"],["تفاصيل الترخيص","land_permit_details"],
      ["المرافق","land_utilities"],["اشتراطات البناء","land_zoning"],
      ["خط العرض","latitude"],["خط الطول","longitude"]
    ].filter(([label,key])=>p[key]!==undefined&&p[key]!==null&&p[key]!=="");
    const detailHtml=fields.map(([label,key])=>'<span><b>'+esc(label)+':</b> '+esc(p[key])+'</span>').join("");
    const actions=role==="owner"
      ? '<div class="agi-actions"><button type="button" class="btn btn-gold" data-guest-property-decision="approve" data-id="'+esc(row.id)+'">اعتماد ونشر الإعلان</button><button type="button" class="btn btn-outline-dark" data-guest-property-decision="reject" data-id="'+esc(row.id)+'">رفض الطلب</button></div>'
      : '<p class="agi-note">عرض ومراجعة فقط. اعتماد ونشر إعلان الزائر متاح لمالك المنصة.</p>';
    return '<article class="agi-card" data-guest-property="'+esc(row.id)+'"><div class="agi-card-head"><div><span class="agi-kicker">إعلان زائر · '+esc(date(row.created_at))+'</span><h3>'+esc(p.title||"إعلان بلا عنوان")+'</h3></div><span class="agi-state">بانتظار المراجعة</span></div>'
      +'<p><b>'+esc(p.listing_purpose||"")+'</b> · '+esc(p.property_type||"")+' · '+esc(p.city||"")+' · '+esc(p.area||"")+'</p>'
      +'<details class="agi-review-details"><summary>افتح التفاصيل الكاملة والصور والمستندات قبل المراجعة</summary><div class="agi-review-body">'
      +'<p>'+esc(p.description||"لا يوجد وصف إضافي.")+'</p><div class="agi-details">'+detailHtml+'</div>'
      +'<p>المعلن: '+esc(row.contact_name)+' · <a href="tel:'+phone+'">'+phone+'</a> · موافقة نشر الرقم: '+(row.contact_consent?"نعم":"لا؛ سيظل الرقم خاصًا")+'</p>'
      +'<p>السعر: '+esc(p.price_on_request?"عند التواصل":p.total_price||"—")+'</p>'
      +'<div class="agi-images">'+(images||"<span>لا توجد صور مرفقة</span>")+'</div><p class="agi-docs">'+(docs||"لا توجد مستندات مرفقة")+'</p>'
      +'</div></details>'+actions+'</article>';
  }
  function buyerCard(row) {
    const p=row.payload||{}, phone=esc(row.contact_phone||"");
    return '<article class="agi-card" data-guest-buyer="'+esc(row.id)+'"><div class="agi-card-head"><div><span class="agi-kicker">طلب باحث عن عقار · '+esc(date(row.created_at))+'</span><h3>'+esc(row.contact_name)+'</h3></div><span class="agi-state">بانتظار التواصل</span></div>'
      +'<p>الهاتف: <a href="tel:'+phone+'">'+phone+'</a> · النوع: '+esc(p.property_type||"أي نوع")+'</p>'
      +'<p>المركز: '+esc(p.city||"كل مراكز أسيوط")+' · المنطقة: '+esc(p.area||"غير محددة")+'</p>'
      +'<p>أقصى سعر: '+esc(p.max_total_price||"غير محدد")+' · المبلغ المتاح: '+esc(p.max_upfront||"غير محدد")+' · القسط: '+esc(p.max_monthly_installment||"غير محدد")+'</p>'
      +'<p>تفاصيل: '+esc(p.notes||"لا توجد تفاصيل إضافية.")+'</p>'
      +'<div class="agi-actions"><button type="button" class="btn btn-gold" data-guest-buyer-decision="contacted" data-id="'+esc(row.id)+'">تم التواصل</button><button type="button" class="btn btn-outline-dark" data-guest-buyer-decision="rejected" data-id="'+esc(row.id)+'">إغلاق الطلب</button></div></article>';
  }
  function render() {
    const properties=root.querySelector("[data-guest-properties]"), buyers=root.querySelector("[data-guest-buyers]");
    const pc=root.querySelector("[data-guest-property-count]"), bc=root.querySelector("[data-guest-buyer-count]");
    if(pc) pc.textContent=String(propertyRows.length); if(bc) bc.textContent=String(buyerRows.length);
    const cleanupButton=root.querySelector("[data-guest-cleanup]"); if(cleanupButton) cleanupButton.hidden=role!=="owner";
    if(properties) properties.innerHTML=propertyRows.map(propertyCard).join("")||'<p class="agi-empty">لا توجد إعلانات زوار تنتظر المراجعة.</p>';
    if(buyers) buyers.innerHTML=buyerRows.map(buyerCard).join("")||'<p class="agi-empty">لا توجد طلبات باحثين تنتظر التواصل.</p>';
  }
  async function load(force=false) {
    if(busy || (loaded&&!force)) return;
    busy=true; status("جارٍ تحميل طلبات الزوار...");
    try {
      const data=await call("admin-list");
      role=data.role||"unknown";
      propertyRows=Array.isArray(data.properties)?data.properties:[];
      buyerRows=Array.isArray(data.buyers)?data.buyers:[];
      render(); loaded=true;
      status(role==="owner"?"يمكنك مراجعة الإعلانات ونشر المقبول منها، ومتابعة طلبات الباحثين.":"يمكنك متابعة طلبات الباحثين ومراجعة بيانات الإعلانات؛ النشر النهائي متاح لمالك المنصة.");
    } catch(error) { status(error.message||"تعذر تحميل طلبات الزوار."); }
    finally { busy=false; }
  }
  root.addEventListener("click",async event=>{
    const cleanupButton=event.target.closest("[data-guest-cleanup]");
    if(cleanupButton&&!busy) {
      if(!confirm("تنظيف الملفات الخاصة الأقدم من 7 أيام التي لا ترتبط بطلب عقار ما زال قيد المراجعة؟"))return;
      busy=true; cleanupButton.disabled=true; status("جارٍ فحص الملفات المؤقتة...");
      try {
        const result=await call("admin-cleanup");
        status("تم تنظيف "+Number(result.removed||0)+" ملف مؤقت. الطلبات التي ما زالت قيد المراجعة لم تتأثر.");
      } catch(error) { status(error.message||"تعذر تنظيف الملفات المؤقتة."); }
      finally { busy=false; cleanupButton.disabled=false; }
      return;
    }
    const button=event.target.closest("[data-guest-property-decision], [data-guest-buyer-decision]");
    if(!button||busy)return;
    const id=button.dataset.id, pd=button.dataset.guestPropertyDecision, bd=button.dataset.guestBuyerDecision;
    if(pd&&!button.closest(".agi-card")?.querySelector("details.agi-review-details")?.open){status("افتح التفاصيل الكاملة وراجع البيانات والصور والمستندات قبل اتخاذ القرار.");return;}
    if(pd&&!confirm(pd==="approve"?"اعتماد إعلان الزائر ونشره؟ ستُنقل الصور من التخزين الخاص إلى صور الإعلانات العامة.":"رفض طلب الإعلان وحذف ملفاته المؤقتة؟"))return;
    if(bd&&!confirm(bd==="contacted"?"تأكيد أنه تم التواصل مع الباحث؟":"إغلاق طلب الباحث؟"))return;
    busy=true; button.disabled=true; status("جارٍ تنفيذ قرار المراجعة...");
    try {
      if(pd) {
        const result=await call("admin-review-property",{id,decision:pd});
        status(result.status==="approved"?(result.temporary_file_cleanup_pending?"تم نشر الإعلان، لكن بقيت صور مؤقتة تحتاج تنظيفًا آمنًا.":"تم نشر إعلان الزائر بنجاح."):(result.temporary_file_cleanup_pending?"تم رفض الطلب، لكن بقيت ملفات مؤقتة تحتاج تنظيفًا.":"تم رفض طلب الإعلان."));
      } else {
        await call("admin-review-buyer",{id,decision:bd});
        status(bd==="contacted"?"تم تسجيل التواصل مع الباحث.":"تم إغلاق طلب الباحث.");
      }
      loaded=false; busy=false; await load(true);
    } catch(error) { status(error.message||"تعذر تنفيذ قرار المراجعة."); button.disabled=false; }
    finally { busy=false; }
  });
  window.addEventListener("asyut:admin-view",event=>{if(event.detail?.name==="guest-intake")load();});
  root.querySelector("[data-guest-refresh]")?.addEventListener("click",()=>load(true));
})();
