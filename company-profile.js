document.addEventListener("DOMContentLoaded",async()=>{
 "use strict";
 const cfg=window.LAYAN_CONFIG||{};
 const base=String(cfg.SUPABASE_URL||"").replace(/\/$/,"");
 const key=cfg.SUPABASE_PUBLISHABLE_KEY||"";
 const root=document.getElementById("companyProfileRoot");
 const params=new URLSearchParams(location.search);
 const profileId=params.get("id");
 const entityId=params.get("entity_id");
 const ENTITY_LOGO_ASSETS=Object.freeze({
  "8f9371fc-09a8-4f11-afad-d72a4c2d5edf":"./assets/brand/al-benaa-arabi-star.webp"
 });
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const safeUrl=v=>{try{const u=new URL(String(v||""));return["https:","http:"].includes(u.protocol)?u.href:"";}catch(_){return"";}};
 const digits=v=>String(v||"").replace(/[^0-9]/g,"");
 async function api(path){
  if(!base||!key)throw Error("إعدادات الاتصال غير متاحة.");
  const response=await fetch(base+"/rest/v1/"+path,{headers:{apikey:key,Authorization:"Bearer "+key}});
  const raw=await response.text();let data=null;
  try{data=raw?JSON.parse(raw):null;}catch(_){}
  if(!response.ok)throw Error(data?.message||"تعذر تحميل بيانات الملف.");
  return data;
 }
 function setMeta(name,content){
  if(!content)return;
  const el=document.querySelector('meta[name="'+name+'"]');
  if(el)el.setAttribute("content",String(content).slice(0,300));
 }
 function setProperty(property,content){
  if(!content)return;
  const el=document.querySelector('meta[property="'+property+'"]');
  if(el)el.setAttribute("content",String(content).slice(0,300));
 }
 function setSchema(schema){
  let script=document.getElementById("companyStructuredData");
  if(!script){script=document.createElement("script");script.id="companyStructuredData";script.type="application/ld+json";document.head.appendChild(script);}
  script.textContent=JSON.stringify(schema);
 }
 function renderError(message){
  root.innerHTML='<p class="company-directory-state">'+esc(message)+'</p>';
 }
 function categoryLabel(type){
  return ({
   developer:"مطور عقاري",
   marketing:"تسويق عقاري",
   brokerage:"وساطة ومكتب عقاري",
   contractor:"مقاولات وإنشاءات",
   public_authority:"جهة عامة",
   sales_office:"مكتب مبيعات",
   consultant:"استشارات عقارية",
   other:"جهة عقارية"
  })[type]||"جهة عقارية";
 }
 function sourceLinks(sources){
  if(!sources.length)return '<p class="company-source-empty">لا تتوفر مراجع عامة مرتبطة بهذا السجل حاليًا.</p>';
  return '<ul class="company-source-list">'+sources.map(source=>{
   const url=safeUrl(source.source_url);
   if(!url)return "";
   const date=source.accessed_at?new Date(source.accessed_at).toLocaleDateString("ar-EG"):"";
   return '<li><a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(source.title||source.publisher||"مصدر")+' ↗</a><small>'+esc(source.publisher||"مصدر منشور")+(date?" · تاريخ الاطلاع: "+esc(date):"")+'</small></li>';
  }).join("")+'</ul>';
 }
 async function loadDirectoryEntity(){
  if(!/^[0-9a-f-]{36}$/i.test(entityId||"")){renderError("رابط ملف الجهة غير صحيح.");return;}
  const query="directory_entities?select=id,name_ar,name_en,entity_type,description,website_url,public_phone,public_email,public_address,primary_area_id,verification_status,public_visible&id=eq."+encodeURIComponent(entityId)+"&public_visible=eq.true&verification_status=eq.published";
  const rows=await api(query);
  const entity=Array.isArray(rows)?rows[0]:null;
  if(!entity){renderError("هذا السجل غير متاح للعامة أو لم يعد منشورًا في الدليل.");return;}
  const name=entity.name_ar||entity.name_en||"جهة عقارية";
  const logo=ENTITY_LOGO_ASSETS[entity.id]||"";
  const type=categoryLabel(entity.entity_type);
  const website=safeUrl(entity.website_url);
  const phone=digits(entity.public_phone);
  const address=String(entity.public_address||"").trim();
  const mapUrl=address?"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(address+", أسيوط، مصر"):"";
  let sources=[];
  try{
   const links=await api("directory_entity_sources?select=source_id&entity_id=eq."+encodeURIComponent(entity.id));
   const ids=[...new Set((Array.isArray(links)?links:[]).map(x=>x.source_id).filter(Boolean))];
   if(ids.length){
    const filter="("+ids.join(",")+")";
    const rows=await api("directory_sources?select=id,title,publisher,source_url,confidence_level,accessed_at&is_public=eq.true&id=in."+encodeURIComponent(filter)+"&order=accessed_at.desc");
    sources=Array.isArray(rows)?rows:[];
   }
  }catch(error){console.warn("Public source references unavailable:",error);}
  document.title=name+" | دليل الشركات – أسيوط عقار";
  const canonical=new URL("./company.html",location.href);
  canonical.searchParams.set("entity_id",entity.id);
  const canonicalEl=document.querySelector('link[rel="canonical"]');
  if(canonicalEl)canonicalEl.href=canonical.href;
  const description=entity.description||"بيانات تعريفية منشورة في الدليل العقاري بمحافظة أسيوط.";
  setMeta("description",description);
  setProperty("og:title",name+" | أسيوط عقار");
  setProperty("og:description",description);
  const contact=[];
  if(phone)contact.push('<a class="company-contact-primary" href="tel:'+esc(phone)+'">اتصال بالجهة</a>');
  if(entity.public_email)contact.push('<a class="company-contact-secondary" href="mailto:'+esc(entity.public_email)+'">البريد الإلكتروني</a>');
  if(website){const isFacebook=/^(?:www\.)?facebook\.com$/i.test(new URL(website).hostname);const websiteLabel=isFacebook?"صفحة الشركة على فيسبوك ↗":"الموقع الإلكتروني ↗";contact.push('<a class="company-contact-secondary" href="'+esc(website)+'" target="_blank" rel="noopener noreferrer">'+websiteLabel+'</a>');}
  if(mapUrl)contact.push('<a class="company-contact-secondary" href="'+esc(mapUrl)+'" target="_blank" rel="noopener noreferrer">بحث العنوان على الخريطة ↗</a>');
  root.innerHTML=
   '<section class="company-profile-hero company-directory-entity-hero"><div class="company-profile-logo company-directory-entity-monogram">'+(logo?'<img src="'+esc(logo)+'" alt="شعار '+esc(name)+'">':esc(name.trim().slice(0,1)))+'</div><div><span class="eyebrow">سجل منشور من الدليل العقاري</span><h1>'+esc(name)+'</h1><p>'+esc(description)+'</p><div class="company-card-meta"><span>'+esc(type)+'</span><span>محافظة أسيوط</span></div><div class="company-contact-actions">'+contact.join("")+'</div></div></section>'+
   '<section class="company-profile-section company-source-note"><h2>طبيعة هذا الإدراج</h2><p>هذا ملف معلوماتي مبني على مصادر منشورة، وليس إعلانًا مدفوعًا أو إعلان شراكة أو تزكية أو شهادة ترخيص من أسيوط عقار. راجع المصادر وتواصل مع الجهة مباشرة للتحقق من التفاصيل قبل اتخاذ أي قرار.</p>'+(address?'<p><strong>العنوان المنشور:</strong> '+esc(address)+'</p>':'')+'</section>'+
   '<section class="company-profile-section"><h2>مصادر المعلومات</h2>'+sourceLinks(sources)+'</section>'+
   '<section class="company-claim-panel"><div><span class="eyebrow">ممثل الشركة؟</span><h2>اطلب استلام وإدارة الملف التعريفي مجانًا</h2><p>املأ بياناتك وصفَتك بالشركة. سيُرسل الطلب إلى إدارة أسيوط عقار للمراجعة اليدوية والتحقق من التفويض. إرسال الطلب لا يمنحك صلاحية تعديل الملف تلقائيًا.</p></div><button class="btn btn-gold" type="button" id="companyClaimOpen">ابدأ طلب استلام الملف</button></section>'+
   '<dialog class="company-claim-dialog" id="companyClaimDialog" aria-labelledby="companyClaimTitle"><div class="company-claim-dialog-head"><div><span class="eyebrow">طلب إدارة ملف شركة</span><h2 id="companyClaimTitle">بيانات ممثل الشركة</h2></div><button type="button" id="companyClaimClose" aria-label="إغلاق">×</button></div><p class="company-claim-dialog-note">إرسال الطلب يتطلب تسجيل الدخول إلى حسابك على أسيوط عقار. بعد الإرسال تراجع الإدارة هويتك وصفَتك وتفويض الشركة قبل اعتماد الاستلام.</p><p class="company-claim-status" id="companyClaimStatus" role="status" aria-live="polite" hidden></p><a class="company-claim-login-link" id="companyClaimLoginLink" href="./index.html" hidden>اذهب للصفحة الرئيسية لتسجيل الدخول</a><form id="companyClaimForm" class="company-claim-form"><label>اسم ممثل الشركة *<input name="representative_name" required minlength="3" maxlength="120" autocomplete="name"></label><label>الصفة داخل الشركة *<select name="representative_role" required><option value="">اختر الصفة</option><option>مالك الشركة</option><option>شريك</option><option>مدير الشركة</option><option>مدير فرع</option><option>مسؤول تسويق أو مبيعات</option><option>موظف مفوض</option><option>وكيل / ممثل قانوني</option><option>صفة أخرى</option></select></label><label>رقم الهاتف / واتساب *<input name="representative_phone" type="tel" required minlength="7" maxlength="30" autocomplete="tel"></label><label>البريد الإلكتروني (اختياري)<input name="representative_email" type="email" maxlength="160" autocomplete="email"></label><label>معلومات إضافية (اختياري)<textarea name="representative_notes" rows="3" maxlength="600" placeholder="مثال: أنا مدير فرع أسيوط ومستعد لإرسال التفويض"></textarea></label><p class="company-claim-dialog-note">جهّز ما يثبت صفتك وموافقة الشركة. لا ترسل مستندات هوية حساسة إلا بعد أن تطلبها الإدارة عبر قناة مناسبة.</p><button class="btn btn-gold" type="submit">إرسال طلب الاستلام</button></form></dialog>';
  const claimDialog=document.getElementById("companyClaimDialog");
  document.getElementById("companyClaimOpen")?.addEventListener("click",()=>claimDialog?.showModal());
  document.getElementById("companyClaimClose")?.addEventListener("click",()=>claimDialog?.close());
  claimDialog?.addEventListener("click",event=>{if(event.target===claimDialog)claimDialog.close();});
  const claimStatus=document.getElementById("companyClaimStatus");
  const claimLoginLink=document.getElementById("companyClaimLoginLink");
  const showClaimStatus=(message,isError=false)=>{
   if(!claimStatus)return;
   claimStatus.textContent=message;
   claimStatus.dataset.state=isError?"error":"success";
   claimStatus.hidden=false;
  };
  document.getElementById("companyClaimForm")?.addEventListener("submit",async event=>{
   event.preventDefault();
   const form=event.currentTarget;
   if(!form.reportValidity())return;
   const data=new FormData(form);
   const phone=String(data.get("representative_phone")||"").trim();
   if(digits(phone).length<7){
    form.elements.namedItem("representative_phone").setCustomValidity("أدخل رقم هاتف صحيحًا.");
    form.reportValidity();
    form.elements.namedItem("representative_phone").setCustomValidity("");
    return;
   }
   const auth=window.LAYAN_SUPABASE;
   if(!auth?.isAuthenticated?.()){
    showClaimStatus("سجّل الدخول أولًا من الصفحة الرئيسية، ثم ارجع إلى ملف الشركة وأرسل الطلب.",true);
    if(claimLoginLink)claimLoginLink.hidden=false;
    return;
   }
   const submitButton=form.querySelector('button[type="submit"]');
   if(submitButton){submitButton.disabled=true;submitButton.textContent="جارٍ تسجيل الطلب...";}
   try{
    const session=await auth.requireAuthenticated();
    if(!session?.user?.id)throw new Error("تعذر التحقق من حسابك. سجّل الدخول مرة أخرى.");
    const response=await auth.authedFetch(base+"/rest/v1/company_claim_requests",{
     method:"POST",
     headers:{"Content-Type":"application/json","Prefer":"return=representation"},
     body:JSON.stringify({
      directory_entity_id:entity.id,
      requester_user_id:session.user.id,
      representative_name:String(data.get("representative_name")||"").trim(),
      representative_role:String(data.get("representative_role")||"").trim(),
      contact_phone:phone,
      contact_email:String(data.get("representative_email")||"").trim()||null,
      notes:String(data.get("representative_notes")||"").trim()||null
     })
    });
    const raw=await response.text();
    let result=null;
    try{result=raw?JSON.parse(raw):null;}catch(_){}
    if(!response.ok){
     const message=result?.message||result?.details||result?.hint||"تعذر تسجيل طلب الاستلام.";
     throw new Error(message);
    }
    const requestId=Array.isArray(result)?result[0]?.id:null;
    form.reset();
    if(claimLoginLink)claimLoginLink.hidden=true;
    showClaimStatus("تم تسجيل طلبك بنجاح"+(requestId?" — رقم الطلب: "+requestId:"")+"، وسيظهر لدى إدارة أسيوط عقار للمراجعة والتحقق. لا توجد صلاحيات تعديل قبل اعتماد الإدارة.",false);
   }catch(error){
    const message=String(error?.message||"");
    showClaimStatus(/company_claim_requests_one_pending_per_user_entity|duplicate key|unique constraint/i.test(message)
     ?"لديك طلب استلام مفتوح بالفعل لهذه الشركة. تواصل مع الإدارة لمتابعته."
     :(message||"تعذر تسجيل الطلب. حاول مرة أخرى بعد التأكد من تسجيل الدخول."),true);
   }finally{
    if(submitButton){submitButton.disabled=false;submitButton.textContent="إرسال طلب الاستلام";}
   }
  });
  setSchema({
   "@context":"https://schema.org",
   "@type":"Organization",
   "name":name,
   "description":description,
   "url":canonical.href,
   ...(phone?{telephone:entity.public_phone}:{}),
   ...(entity.public_email?{email:entity.public_email}:{}),
   ...(website?{sameAs:[website]}:{}),
   ...(address?{address:{"@type":"PostalAddress","streetAddress":address,"addressRegion":"أسيوط","addressCountry":"EG"}}:{})
  });
 }
 async function loadApprovedCompany(){
  if(!/^[0-9a-f-]{36}$/i.test(profileId||"")){renderError("رابط ملف الشركة غير صحيح.");return;}
  const query="company_profiles_public?select=id,company_name,category,description,services,city,logo_url,address,phone,whatsapp,website,gallery_urls,projects&id=eq."+encodeURIComponent(profileId);
  const rows=await api(query);
  const c=Array.isArray(rows)?rows[0]:null;
  if(!c){renderError("ملف الشركة غير متاح أو لم يحصل على اعتماد الإدارة بعد.");return;}
  const logo=safeUrl(c.logo_url);
  const phone=digits(c.phone);
  const wa=digits(c.whatsapp||c.phone);
  document.title=String(c.company_name||"ملف الشركة")+" | أسيوط عقار";
  const profileUrl=new URL("./company.html",location.href);
  profileUrl.searchParams.set("id",c.id);
  const canonical=document.querySelector('link[rel="canonical"]');
  if(canonical)canonical.href=profileUrl.href;
  const description=String(c.description||"ملف شركة معتمد على منصة أسيوط عقار.");
  setMeta("description",description);
  setProperty("og:title",String(c.company_name||"ملف الشركة")+" | أسيوط عقار");
  setProperty("og:description",description);
  const gallery=(c.gallery_urls||[]).filter(safeUrl);
  const projects=Array.isArray(c.projects)?c.projects:[];
  const services=Array.isArray(c.services)?c.services:[];
  const actions=[];
  if(phone)actions.push('<a class="company-contact-primary" href="tel:'+esc(phone)+'">اتصال بالشركة</a>');
  if(wa)actions.push('<a class="company-contact-secondary" target="_blank" rel="noopener noreferrer" href="https://wa.me/'+esc(wa)+'">واتساب</a>');
  if(safeUrl(c.website))actions.push('<a class="company-contact-secondary" target="_blank" rel="noopener noreferrer" href="'+esc(safeUrl(c.website))+'">الموقع الإلكتروني ↗</a>');
  root.innerHTML=
   '<section class="company-profile-hero"><div class="company-profile-logo">'+(logo?'<img src="'+esc(logo)+'" alt="شعار '+esc(c.company_name)+'">':esc(String(c.company_name||"ش").slice(0,1)))+'</div><div><span class="eyebrow">ملف شركة مقدم من الشركة ومعتمد من الإدارة</span><h1>'+esc(c.company_name)+'</h1><p>'+esc(description)+'</p><div class="company-card-meta"><span>'+esc(c.category)+'</span><span>'+esc(c.city||"أسيوط")+'</span>'+(c.address?'<span>'+esc(c.address)+'</span>':"")+'</div><div class="company-contact-actions">'+actions.join("")+'</div></div></section>'+
   (services.length?'<section class="company-profile-section"><h2>الخدمات والتخصصات</h2><ul class="company-service-list">'+services.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul></section>':"")+
   (projects.length?'<section class="company-profile-section"><h2>المشروعات والأعمال السابقة</h2><div class="company-project-list">'+projects.map(p=>'<article class="company-project"><h3>'+esc(p.title||"عمل سابق")+'</h3><p>'+esc(p.description||"")+'</p></article>').join("")+'</div></section>':"")+
   (gallery.length?'<section class="company-profile-section"><h2>معرض الأعمال</h2><div class="company-gallery">'+gallery.map((u,i)=>'<img src="'+esc(u)+'" alt="صورة من أعمال '+esc(c.company_name)+' رقم '+(i+1)+'" loading="lazy">').join("")+'</div></section>':"");
  setSchema({
   "@context":"https://schema.org","@type":"Organization","name":c.company_name,"description":description,
   "url":profileUrl.href,...(phone?{telephone:c.phone}:{}),
   ...(logo?{image:logo}:{}),...(c.address?{address:{"@type":"PostalAddress","streetAddress":c.address,"addressLocality":c.city||"أسيوط","addressCountry":"EG"}}:{})
  });
 }
 try{
  if(profileId&&entityId){renderError("رابط الملف غير صحيح؛ اختر ملف الشركة أو سجل الدليل فقط.");return;}
  if(entityId)await loadDirectoryEntity();
  else if(profileId)await loadApprovedCompany();
  else renderError("لم يتم تحديد ملف الشركة المطلوب.");
 }catch(error){
  console.warn("Company profile load failed:",error);
  renderError("حدث خطأ أثناء تحميل الملف. حاول مرة أخرى لاحقًا.");
 }
});