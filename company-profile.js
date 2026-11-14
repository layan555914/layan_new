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
 function categoryLabel(type,serviceCategory){
  const labels={
   contracting_construction:"مقاولات وإنشاءات",real_estate_marketing:"تسويق عقاري",
   real_estate_brokerage:"وساطة ومكتب عقاري",building_materials:"مواد بناء وتشطيب",
   finishing_decoration:"تشطيب وديكور",furniture_furnishings:"أثاث وفرش وتجهيز وحدات",
   engineering_design:"مكاتب هندسية وتصميم معماري",maintenance_property_management:"صيانة وإدارة عقارات",
   real_estate_consultancy:"استشارات عقارية",real_estate_development:"تطوير ومشروعات عقارية",
   real_estate_sales:"مبيعات عقارية",other_real_estate_services:"خدمات عقارية مساندة"
  };
  if(serviceCategory&&labels[serviceCategory])return labels[serviceCategory];
  return ({developer:"مطور عقاري",marketing:"تسويق عقاري",brokerage:"وساطة ومكتب عقاري",
   contractor:"مقاولات وإنشاءات",public_authority:"جهة عامة",sales_office:"مكتب مبيعات",
   consultant:"استشارات عقارية",other:"جهة عقارية"})[type]||"جهة عقارية";
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
  const extended="directory_entities?select=id,name_ar,name_en,entity_type,service_category,description,website_url,public_phone,public_email,public_address,public_whatsapp,public_logo_url,public_services,public_gallery_urls,public_business_hours,public_coverage_areas,primary_area_id,verification_status,public_visible&id=eq."+encodeURIComponent(entityId)+"&public_visible=eq.true&verification_status=eq.published";
  const core="directory_entities?select=id,name_ar,name_en,entity_type,service_category,description,website_url,public_phone,public_email,public_address,public_whatsapp,primary_area_id,verification_status,public_visible&id=eq."+encodeURIComponent(entityId)+"&public_visible=eq.true&verification_status=eq.published";
  const basic="directory_entities?select=id,name_ar,name_en,entity_type,description,website_url,public_phone,public_email,public_address,primary_area_id,verification_status,public_visible&id=eq."+encodeURIComponent(entityId)+"&public_visible=eq.true&verification_status=eq.published";
  let rows;
  try{rows=await api(extended)}catch(_){try{rows=await api(core)}catch(__){rows=await api(basic)}}
  const entity=Array.isArray(rows)?rows[0]:null;
  if(!entity){renderError("هذا السجل غير متاح للعامة أو لم يعد منشورًا في الدليل.");return;}
  const SERVICE_PROVIDER_CATEGORIES=new Set(["contracting_construction","building_materials","finishing_decoration","furniture_furnishings","engineering_design","maintenance_property_management","real_estate_consultancy","other_real_estate_services"]);
  const isServiceProvider=SERVICE_PROVIDER_CATEGORIES.has(String(entity.service_category||""));
  const profileSubject=isServiceProvider?"مقدم الخدمة":"الجهة";
  const profileRepresentative=isServiceProvider?"ممثل مقدم الخدمة":"ممثل الجهة";
  const name=entity.name_ar||entity.name_en||"جهة عقارية";
  const logo=safeUrl(entity.public_logo_url)||ENTITY_LOGO_ASSETS[entity.id]||"";
  const type=categoryLabel(entity.entity_type,entity.service_category);
  const website=safeUrl(entity.website_url);
  const phone=digits(entity.public_phone);
  const whatsapp=digits(entity.public_whatsapp);
  const services=Array.isArray(entity.public_services)?entity.public_services:[];
  const gallery=Array.isArray(entity.public_gallery_urls)?entity.public_gallery_urls.filter(safeUrl):[];
  const coverage=Array.isArray(entity.public_coverage_areas)?entity.public_coverage_areas:[];
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
  document.title=name+" | ملف "+profileSubject+" – أسيوط عقار";
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
  if(whatsapp){const wa=whatsapp.startsWith("0")?"2"+whatsapp.slice(1):whatsapp;contact.push('<a class="company-contact-secondary" href="https://wa.me/'+esc(wa)+'" target="_blank" rel="noopener noreferrer">واتساب</a>');}
  if(entity.public_email)contact.push('<a class="company-contact-secondary" href="mailto:'+esc(entity.public_email)+'">البريد الإلكتروني</a>');
  if(website){const isFacebook=/^(?:www\.)?facebook\.com$/i.test(new URL(website).hostname);const websiteLabel=isFacebook?"صفحة الشركة على فيسبوك ↗":"الموقع الإلكتروني ↗";contact.push('<a class="company-contact-secondary" href="'+esc(website)+'" target="_blank" rel="noopener noreferrer">'+websiteLabel+'</a>');}
  if(mapUrl)contact.push('<a class="company-contact-secondary" href="'+esc(mapUrl)+'" target="_blank" rel="noopener noreferrer">بحث العنوان على الخريطة ↗</a>');
  root.innerHTML=
   '<section class="company-profile-hero company-directory-entity-hero"><div class="company-profile-logo company-directory-entity-monogram">'+(logo?'<img src="'+esc(logo)+'" alt="شعار '+esc(name)+'">':esc(name.trim().slice(0,1)))+'</div><div><span class="eyebrow">سجل منشور من الدليل العقاري</span><h1>'+esc(name)+'</h1><p>'+esc(description)+'</p><div class="company-card-meta"><span>'+esc(type)+'</span><span>محافظة أسيوط</span></div><div class="company-contact-actions">'+contact.join("")+'</div></div></section>'+
   '<section class="company-profile-section company-source-note"><h2>طبيعة هذا الإدراج</h2><p>هذا ملف تعريفي مجاني للجهة، وليس إعلانًا مدفوعًا أو شراكة أو تزكية أو شهادة ترخيص من أسيوط عقار. راجع المصادر وتواصل مع الجهة للتحقق من التفاصيل.</p>'+(address?'<p><strong>العنوان المنشور:</strong> '+esc(address)+'</p>':'')+(entity.public_business_hours?'<p><strong>مواعيد العمل:</strong> '+esc(entity.public_business_hours)+'</p>':'')+(coverage.length?'<p><strong>نطاق الخدمة:</strong> '+coverage.map(esc).join('، ')+'</p>':'')+'</section>'+
   (services.length?'<section class="company-profile-section"><h2>الخدمات والتخصصات</h2><ul class="company-service-list">'+services.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></section>':'')+
   (gallery.length?'<section class="company-profile-section"><h2>معرض أعمال الجهة</h2><div class="company-gallery">'+gallery.map((u,i)=>'<img src="'+esc(u)+'" alt="صورة من أعمال '+esc(name)+' رقم '+(i+1)+'" loading="lazy">').join('')+'</div></section>':'')+
   '<section class="company-profile-section"><h2>مصادر المعلومات</h2>'+sourceLinks(sources)+'</section>'+
   '<section class="company-claim-panel"><div><span class="eyebrow">'+profileRepresentative+'؟</span><h2>اطلب استلام وإدارة ملف '+profileSubject+' مجانًا</h2><p>املأ بياناتك وصفتك داخل الجهة. سيُرسل الطلب إلى إدارة أسيوط عقار للمراجعة اليدوية والتحقق من التفويض. إرسال الطلب لا يمنحك صلاحية تعديل الملف تلقائيًا.</p></div><button class="btn btn-gold" type="button" id="companyClaimOpen">ابدأ طلب استلام الملف</button></section>'+
   '<dialog class="company-claim-dialog" id="companyClaimDialog" aria-labelledby="companyClaimTitle"><div class="company-claim-dialog-head"><div><span class="eyebrow">طلب استلام ملف جهة</span><h2 id="companyClaimTitle">بيانات '+profileRepresentative+'</h2></div><button type="button" id="companyClaimClose" aria-label="إغلاق">×</button></div><p class="company-claim-dialog-note">إرسال الطلب يتطلب تسجيل الدخول إلى حسابك على أسيوط عقار. بعد الإرسال تراجع الإدارة هويتك وصفَتك وتفويض الجهة قبل اعتماد الاستلام.</p><p class="company-claim-status" id="companyClaimStatus" role="status" aria-live="polite" hidden></p><a class="company-claim-login-link" id="companyClaimLoginLink" href="./index.html" hidden>اذهب للصفحة الرئيسية لتسجيل الدخول</a><a class="company-claim-login-link" id="companyClaimContactLink" href="https://wa.me/201007044265" target="_blank" rel="noopener noreferrer" hidden>تواصل مع إدارة أسيوط عقار لمتابعة الطلب</a><form id="companyClaimForm" class="company-claim-form"><label>اسم '+profileRepresentative+' *<input name="representative_name" required minlength="3" maxlength="120" autocomplete="name"></label><label>الصفة داخل الجهة *<select name="representative_role" required><option value="">اختر الصفة</option><option>المالك</option><option>شريك</option><option>مدير النشاط</option><option>مدير الفرع</option><option>مسؤول تسويق أو مبيعات</option><option>موظف مفوض</option><option>وكيل / ممثل قانوني</option><option>صفة أخرى</option></select></label><label>رقم الهاتف / واتساب *<input name="representative_phone" type="tel" required minlength="7" maxlength="30" autocomplete="tel"></label><label>البريد الإلكتروني (اختياري)<input name="representative_email" type="email" maxlength="160" autocomplete="email"></label><label>معلومات إضافية (اختياري)<textarea name="representative_notes" rows="3" maxlength="600" placeholder="مثال: أنا مدير فرع أسيوط ومستعد لإرسال التفويض"></textarea></label><p class="company-claim-dialog-note">جهّز ما يثبت صفتك وموافقة الجهة. لا ترسل مستندات هوية حساسة إلا بعد أن تطلبها الإدارة عبر قناة مناسبة.</p><button class="btn btn-gold" type="submit">إرسال طلب الاستلام</button></form></dialog>';
  const claimDialog=document.getElementById("companyClaimDialog");
  document.getElementById("companyClaimOpen")?.addEventListener("click",()=>{claimDialog?.showModal();refreshMyClaimStatus();});
  document.getElementById("companyClaimClose")?.addEventListener("click",()=>claimDialog?.close());
  claimDialog?.addEventListener("click",event=>{if(event.target===claimDialog)claimDialog.close();});
  const claimStatus=document.getElementById("companyClaimStatus");
  const claimLoginLink=document.getElementById("companyClaimLoginLink");
  const claimContactLink=document.getElementById("companyClaimContactLink");
  const claimForm=document.getElementById("companyClaimForm");
  const claimPanel=root.querySelector(".company-claim-panel");
  const showClaimStatus=(message,isError=false)=>{
   if(!claimStatus)return;
   claimStatus.textContent=message;
   claimStatus.dataset.state=isError?"error":"success";
   claimStatus.hidden=false;
  };
  async function refreshMyClaimStatus(){
   const auth=window.LAYAN_SUPABASE;
   if(!auth?.isAuthenticated?.()||!entity?.id)return;
   try{
    const session=await auth.requireAuthenticated();
    const query=new URLSearchParams({
     select:"id,status,admin_notes,created_at,reviewed_at",
     directory_entity_id:"eq."+entity.id,
     requester_user_id:"eq."+session.user.id,
     order:"created_at.desc",
     limit:"1"
    }).toString();
    const response=await auth.authedFetch(base+"/rest/v1/company_claim_requests?"+query,{method:"GET"});
    const raw=await response.text();
    let rows=null;
    try{rows=raw?JSON.parse(raw):null;}catch(_){}
    if(!response.ok)throw new Error("تعذر تحميل حالة طلب الاستلام.");
    const row=Array.isArray(rows)?rows[0]:null;
    if(!row)return;
    if(row.status==="pending"){
     showClaimStatus("طلبك قيد المراجعة لدى إدارة أسيوط عقار."+(row.admin_notes?" ملاحظة الإدارة: "+row.admin_notes:""),false);
     if(claimForm)claimForm.hidden=true;
     if(claimContactLink)claimContactLink.hidden=false;
    }else if(row.status==="approved"){
     showClaimStatus("تم اعتماد طلبك وربط حسابك بملف الجهة. تعديل بيانات الدليل يظل خاضعًا لمراجعة الإدارة.",false);
     if(claimForm)claimForm.hidden=true;
     if(claimContactLink)claimContactLink.hidden=true;
    }else if(row.status==="rejected"){
     showClaimStatus("تم رفض طلب الاستلام."+(row.admin_notes?" السبب أو ملاحظة الإدارة: "+row.admin_notes:"")+" يمكنك إعادة الإرسال بعد استكمال المطلوب.",true);
     if(claimForm)claimForm.hidden=false;
     if(claimContactLink)claimContactLink.hidden=false;
    }
   }catch(error){
    console.warn("Company claim status unavailable:",error);
   }
  }
  async function mountManagerEditor(){
   const auth=window.LAYAN_SUPABASE;
   if(!auth?.isAuthenticated?.()||!entity?.id)return;
   try{
    const session=await auth.requireAuthenticated();
    const managerUrl=base+"/rest/v1/company_entity_managers?select=directory_entity_id&directory_entity_id=eq."+encodeURIComponent(entity.id)+"&owner_user_id=eq."+encodeURIComponent(session.user.id);
    const managerResponse=await auth.authedFetch(managerUrl,{method:"GET"});
    const managerRows=await managerResponse.json().catch(()=>[]);
    if(!managerResponse.ok||!Array.isArray(managerRows)||!managerRows.length)return;
    if(claimPanel)claimPanel.hidden=true;

    const statusUrl=base+"/rest/v1/company_entity_profile_update_requests?select=id,status,admin_notes,created_at&directory_entity_id=eq."+encodeURIComponent(entity.id)+"&requester_user_id=eq."+encodeURIComponent(session.user.id)+"&order=created_at.desc&limit=1";
    const statusResponse=await auth.authedFetch(statusUrl,{method:"GET"});
    const statusRows=await statusResponse.json().catch(()=>[]);
    if(!statusResponse.ok)throw new Error("تعذر تحميل حالة تعديلات الملف.");
    const latest=Array.isArray(statusRows)?statusRows[0]:null;
    const target=document.createElement("section");
    target.className="company-manager-panel company-profile-section";
    const list=values=>Array.isArray(values)?values.join("\n"):"";
    target.innerHTML=
     '<div><span class="eyebrow">إدارة الملف بعد الاستلام</span><h2>تحديث بيانات شركتك أو خدماتك</h2><p>أي تعديل ترسله يمر بمراجعة الإدارة. تظل البيانات المعتمدة الحالية ظاهرة للزوار حتى اعتماد التعديل الجديد.</p></div>'+
     '<p class="company-manager-status" id="companyManagerStatus" role="status" aria-live="polite"></p>'+
     '<form class="company-manager-form" id="companyManagerForm">'+
      '<label>اسم الجهة<input name="name_ar" required minlength="2" maxlength="180" value="'+esc(entity.name_ar||"")+'"></label>'+
      '<label>مجال الخدمة<select name="service_category" required><option value="">اختر المجال</option>'+
       '<option value="contracting_construction">مقاولات وإنشاءات</option><option value="real_estate_marketing">تسويق عقاري</option><option value="real_estate_brokerage">وساطة ومكتب عقاري</option><option value="building_materials">مواد بناء وتشطيب</option><option value="finishing_decoration">تشطيب وديكور</option><option value="furniture_furnishings">أثاث وفرش وتجهيز وحدات</option><option value="engineering_design">مكاتب هندسية وتصميم معماري</option><option value="maintenance_property_management">صيانة وإدارة عقارات</option><option value="real_estate_consultancy">استشارات عقارية</option><option value="real_estate_development">تطوير ومشروعات عقارية</option><option value="real_estate_sales">مبيعات عقارية</option><option value="other_real_estate_services">خدمات عقارية مساندة</option></select></label>'+
      '<label class="wide">وصف النشاط والخدمات<textarea name="description" rows="3" maxlength="2000">'+esc(entity.description||"")+'</textarea></label>'+
      '<label>رقم الهاتف<input name="public_phone" type="tel" maxlength="30" value="'+esc(entity.public_phone||"")+'"></label>'+
      '<label>واتساب<input name="public_whatsapp" type="tel" maxlength="30" value="'+esc(entity.public_whatsapp||"")+'"></label>'+
      '<label>البريد الإلكتروني<input name="public_email" type="email" maxlength="160" value="'+esc(entity.public_email||"")+'"></label>'+
      '<label>الموقع الإلكتروني<input name="website_url" type="url" maxlength="500" value="'+esc(entity.website_url||"")+'"></label>'+
      '<label class="wide">العنوان<input name="public_address" maxlength="240" value="'+esc(entity.public_address||"")+'"></label>'+
      '<label>رابط الشعار<input name="public_logo_url" type="url" maxlength="500" value="'+esc(entity.public_logo_url||"")+'"></label>'+
      '<label>مواعيد العمل<input name="public_business_hours" maxlength="240" value="'+esc(entity.public_business_hours||"")+'"></label>'+
      '<label class="wide">الخدمات والتخصصات (كل خدمة في سطر)<textarea name="public_services" rows="3">'+esc(list(entity.public_services))+'</textarea></label>'+
      '<label class="wide">مناطق التغطية (كل منطقة في سطر)<textarea name="public_coverage_areas" rows="2">'+esc(list(entity.public_coverage_areas))+'</textarea></label>'+
      '<label class="wide">روابط صور الأعمال (رابط https في كل سطر)<textarea name="public_gallery_urls" rows="3">'+esc(list(entity.public_gallery_urls))+'</textarea></label>'+
      '<button class="btn btn-gold" type="submit">إرسال التعديل لمراجعة الإدارة</button></form>';
    root.appendChild(target);
    const form=target.querySelector("#companyManagerForm");
    const status=target.querySelector("#companyManagerStatus");
    form.elements.service_category.value=entity.service_category||"";
    if(latest?.status==="pending"){
     status.textContent="لديك تعديل قيد المراجعة. لا تحتاج لإرسال طلب جديد الآن.";
     form.querySelector('button[type="submit"]').disabled=true;
    }else if(latest?.status==="needs_changes"){
     status.textContent="طلبت الإدارة استكمال البيانات: "+(latest.admin_notes||"راجع البيانات ثم أعد الإرسال.");
    }else if(latest?.status==="rejected"){
     status.textContent="تم رفض آخر تعديل: "+(latest.admin_notes||"يمكنك مراجعة البيانات وإرسال طلب جديد.");
    }else if(latest?.status==="approved"){
     status.textContent="تم اعتماد آخر تعديل وإظهاره في ملف الجهة.";
    }else{
     status.textContent="تم التحقق من استلامك للملف. يمكنك إرسال بياناتك لتحديث الصفحة العامة.";
    }
    form.addEventListener("submit",async event=>{
     event.preventDefault();
     if(!form.reportValidity())return;
     const data=new FormData(form);
     const value=name=>String(data.get(name)||"").trim();
     const validateUrl=(input)=>{if(!input)return null;const url=safeUrl(input);if(!url)throw Error("روابط الموقع والشعار والصور يجب أن تبدأ بـ http:// أو https://.");return url;};
     const lines=name=>value(name).split(/\n+/).map(x=>x.trim()).filter(Boolean);
     let payload;
     try{
      payload={
       name_ar:value("name_ar"),service_category:value("service_category"),
       description:value("description")||null,public_phone:value("public_phone")||null,
       public_whatsapp:value("public_whatsapp")||null,public_email:value("public_email")||null,
       website_url:validateUrl(value("website_url")),public_address:value("public_address")||null,
       public_logo_url:validateUrl(value("public_logo_url")),
       public_business_hours:value("public_business_hours")||null,
       public_services:lines("public_services"),public_coverage_areas:lines("public_coverage_areas"),
       public_gallery_urls:lines("public_gallery_urls").map(validateUrl)
      };
     }catch(error){status.textContent=error.message;return;}
     const button=form.querySelector('button[type="submit"]');
     button.disabled=true;status.textContent="جارٍ إرسال التعديل لمراجعة الإدارة...";
     try{
      const response=await auth.authedFetch(base+"/rest/v1/rpc/company_entity_profile_update_submit",{
       method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({p_directory_entity_id:entity.id,p_payload:payload})
      });
      const result=await response.json().catch(()=>null);
      if(!response.ok)throw Error(result?.message||result?.details||"تعذر إرسال التعديل.");
      status.textContent="تم إرسال التعديل بنجاح. سيظل الملف الحالي ظاهرًا حتى مراجعة الإدارة واعتماد النسخة الجديدة.";
      button.textContent="التعديل قيد المراجعة";
      button.disabled=true;
     }catch(error){status.textContent=error.message||"تعذر إرسال التعديل.";button.disabled=false;}
    });
   }catch(error){console.warn("Company manager editor unavailable:",error);}
  }
  mountManagerEditor();
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
    showClaimStatus("سجّل الدخول أولًا من الصفحة الرئيسية، ثم ارجع إلى ملف الجهة وأرسل الطلب.",true);
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
    await refreshMyClaimStatus();
   }catch(error){
    const message=String(error?.message||"");
    showClaimStatus(/company_claim_requests_one_pending_per_user_entity|duplicate key|unique constraint/i.test(message)
     ?"لديك طلب استلام مفتوح بالفعل لهذا الملف. تواصل مع الإدارة لمتابعته."
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