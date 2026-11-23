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
 "810cc5ae-2e02-4418-8ee8-c681668723b6":"./assets/brand/diar-asyut-logo-temp.svg",
  "8f9371fc-09a8-4f11-afad-d72a4c2d5edf":"./assets/brand/al-benaa-arabi-star.webp"
 });
 // Official public brand assets are keyed by an exact company website hostname.
 // Prime publishes 15898 as its shared hotline; it is not a direct Assiut branch number.
 const OFFICIAL_BRAND_PROFILES=Object.freeze({
  "primedev-eg.com":Object.freeze({
   logoUrl:"https://www.primedev-eg.com/assets/img/logo-prime.png",
   hotline:"+20 15898",
   hotlineHref:"tel:+2015898",
   hotlineLabel:"الخط الساخن الرسمي للشركة"
  })
 });
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const safeUrl=v=>{try{const u=new URL(String(v||""));return["https:","http:"].includes(u.protocol)?u.href:"";}catch(_){return"";}};
 const digits=v=>String(v||"").replace(/[^0-9]/g,"");
 function officialBrandProfile(website){
  try{
   const hostname=new URL(website).hostname.toLowerCase().replace(/^www\./,"");
   return OFFICIAL_BRAND_PROFILES[hostname]||null;
  }catch(_){return null;}
 }
 function attachLogoFallback(container,companyName){
  const image=container.querySelector(".company-profile-logo img");
  if(!image)return;
  image.addEventListener("error",()=>{
   const fallback=document.createElement("span");
   fallback.className="company-logo-fallback";
   const initial=document.createElement("strong");
   initial.textContent=String(companyName||"جهة").trim().slice(0,1)||"؟";
   const note=document.createElement("small");
   note.textContent="تعذر تحميل الشعار الرسمي";
   fallback.append(initial,note);
   image.replaceWith(fallback);
  },{once:true});
 }
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
 async function publicProjectsMarkup(directoryEntityId){
  try{
   const relations=await api("directory_project_entities?select=project_id,relation_type&entity_id=eq."+encodeURIComponent(directoryEntityId));
   const rows=Array.isArray(relations)?relations:[];
   const projectIds=[...new Set(rows.map(row=>row.project_id).filter(Boolean))];
   if(!projectIds.length){
    return '<section class="company-profile-section company-linked-projects"><h2>مشروعات مرتبطة بالشركة</h2><p>لا توجد مشروعات منشورة مرتبطة بهذا الملف حتى الآن.</p></section>';
   }
   const projectFilter="("+projectIds.join(",")+")";
   const projects=await api("directory_projects?select=id,name_ar,project_type,project_status&public_visible=eq.true&verification_status=eq.published&id=in."+encodeURIComponent(projectFilter)+"&order=name_ar.asc");
   const roleLabels={
    developer:"المطور العقاري",land_owner:"مالك الأرض",marketing_agent:"وكيل تسويق",
    sales_agent:"وكيل مبيعات",contractor:"مقاول",consultant:"استشاري",
    operator:"جهة تشغيل",public_authority:"جهة عامة",other:"جهة مرتبطة"
   };
   const visible=(Array.isArray(projects)?projects:[]);
   const byProject=new Map(rows.map(row=>[String(row.project_id),row.relation_type]));
   return '<section class="company-profile-section company-linked-projects"><h2>مشروعات مرتبطة بالشركة</h2>'+
    (visible.length
     ?'<div class="company-linked-project-list">'+visible.map(project=>'<article class="company-linked-project"><div><strong>'+esc(project.name_ar||"مشروع عقاري")+'</strong><small>'+esc(roleLabels[byProject.get(String(project.id))]||"علاقة موثقة")+'</small></div><a href="./project.html?id='+encodeURIComponent(project.id)+'">فتح ملف المشروع ←</a></article>').join("")+'</div>'
     :'<p>لا توجد مشروعات منشورة مرتبطة بهذا الملف حتى الآن. الطلبات التي ما زالت قيد المراجعة لا تظهر للعامة.</p>')+
    '</section>';
  }catch(error){
   console.warn("Published company projects unavailable:",error);
   return "";
  }
 }
 async function publicServiceOffersMarkup(directoryEntityId){
  try{
   const links=await api("marketplace_listing_provider_links?select=listing_id&directory_entity_id=eq."+encodeURIComponent(directoryEntityId));
   const ids=(Array.isArray(links)?links:[]).map(row=>row.listing_id).filter(Boolean);
   const offers=ids.length?await api("marketplace_listings?select=id,title,description,category,city,area,price,price_period,created_at&status=eq.approved&id=in.("+ids.join(",")+")&order=created_at.desc&limit=30"):[];
   const cards=offers.map(item=>{
    const price=item.price!==null&&item.price!==undefined?Number(item.price).toLocaleString("ar-EG")+" ج.م"+(item.price_period?" "+esc(item.price_period):""):"السعر عند التواصل";
    const place=[item.city,item.area].filter(Boolean).join("، ")||"أسيوط";
    return '<article class="company-service-offer-card"><div><small>'+esc(item.category||"خدمة")+'</small><h3>'+esc(item.title||"عرض خدمة")+'</h3><p>'+esc(String(item.description||"").slice(0,180))+'</p><span>'+esc(place)+'</span><strong>'+esc(price)+'</strong></div><a href="./marketplace.html#marketplace-listing-'+encodeURIComponent(item.id)+'">تفاصيل العرض ←</a></article>';
   }).join("");
   return '<section class="company-profile-section company-service-offers"><h2>عروض وإعلانات مقدم الخدمة</h2>'+(offers.length?'<div class="company-service-offers-grid">'+cards+'</div>':'<p>لا توجد عروض منشورة مرتبطة بهذا الملف حاليًا. ستظهر هنا العروض بعد اعتمادها وربطها بملف مقدم الخدمة.</p>')+'</section>';
  }catch(error){
   console.warn("Published service provider offers unavailable:",error);
   return '<section class="company-profile-section company-service-offers"><h2>عروض وإعلانات مقدم الخدمة</h2><p>تعذر تحميل العروض حاليًا. يمكنك تصفح <a href="./marketplace.html">سوق الخدمات</a>.</p></section>';
  }
 }
 async function loadDirectoryEntity(){
  if(!/^[0-9a-f-]{36}$/i.test(entityId||"")){renderError("رابط ملف الجهة غير صحيح.");return;}
  const extended="directory_entities?select=id,name_ar,name_en,entity_type,service_category,description,website_url,public_phone,public_email,public_address,public_whatsapp,public_logo_url,public_services,public_gallery_urls,public_business_hours,public_coverage_areas,primary_area_id,latitude,longitude,location_public,location_precision,location_source_id,location_verified_at,verification_status,representative_verified_at,public_visible&id=eq."+encodeURIComponent(entityId)+"&public_visible=eq.true&verification_status=eq.published";
  const core="directory_entities?select=id,name_ar,name_en,entity_type,service_category,description,website_url,public_phone,public_email,public_address,public_whatsapp,primary_area_id,latitude,longitude,location_public,location_precision,location_source_id,location_verified_at,verification_status,representative_verified_at,public_visible&id=eq."+encodeURIComponent(entityId)+"&public_visible=eq.true&verification_status=eq.published";
  const basic="directory_entities?select=id,name_ar,name_en,entity_type,description,website_url,public_phone,public_email,public_address,primary_area_id,latitude,longitude,location_public,location_precision,location_source_id,location_verified_at,verification_status,representative_verified_at,public_visible&id=eq."+encodeURIComponent(entityId)+"&public_visible=eq.true&verification_status=eq.published";
  let rows;
  try{rows=await api(extended)}catch(_){try{rows=await api(core)}catch(__){rows=await api(basic)}}
  const entity=Array.isArray(rows)?rows[0]:null;
  if(!entity){renderError("هذا السجل غير متاح للعامة أو لم يعد منشورًا في الدليل.");return;}
  const serviceCategoryCode=String(entity.service_category||"");
  const isRealEstateCompany=["real_estate_development","real_estate_sales","real_estate_marketing","real_estate_brokerage"].includes(serviceCategoryCode)
   || ["developer","sales_office","marketing","brokerage"].includes(String(entity.entity_type||""));
  const isServiceProvider=!isRealEstateCompany&&(
   Boolean(serviceCategoryCode)||["contractor","consultant"].includes(String(entity.entity_type||""))
  );
  const profileSubject=isServiceProvider?"مقدم الخدمة":isRealEstateCompany?"الشركة":"الجهة";
  const profileRepresentative=isServiceProvider?"ممثل مقدم الخدمة":isRealEstateCompany?"ممثل الشركة":"ممثل الجهة";
  const managedSubject=isRealEstateCompany?"الشركة":"الجهة";
  const name=entity.name_ar||entity.name_en||"جهة عقارية";
  const type=categoryLabel(entity.entity_type,entity.service_category);
  const website=safeUrl(entity.website_url);
  // A promotional social post is separate from the entity's official website.
  let promoUrl="";
  try{
   const promoRows=await api("supplier_ads?select=id,title,promo_url,ends_at&business_name=eq."+encodeURIComponent(name)+"&status=eq.active&order=created_at.desc&limit=10");
   const now=Date.now();
   const promo=(Array.isArray(promoRows)?promoRows:[]).find(row=>{
    const url=safeUrl(row.promo_url);
    if(!url||(row.ends_at&&(!Number.isFinite(Date.parse(row.ends_at))||Date.parse(row.ends_at)<=now)))return false;
    try{return /(^|\.)facebook\.com$/i.test(new URL(url).hostname);}catch(_){return false;}
   });
   promoUrl=safeUrl(promo?.promo_url);
  }catch(error){console.warn("Public promotional link unavailable:",error);}
  const officialBrand=officialBrandProfile(website);
  const logo=safeUrl(entity.public_logo_url)||ENTITY_LOGO_ASSETS[entity.id]||safeUrl(officialBrand?.logoUrl)||"";
  const publishedPhone=String(entity.public_phone||"").trim();
  const phone=digits(publishedPhone||officialBrand?.hotline);
  const phoneHref=publishedPhone?("tel:"+phone):(officialBrand?.hotlineHref||"");
  const phoneActionLabel=publishedPhone?"اتصال بالجهة":(officialBrand?.hotlineLabel?"اتصل بالخط الساخن الرسمي":"اتصال بالجهة");
  const phoneDetailLabel=publishedPhone?"رقم الاتصال":(officialBrand?.hotlineLabel||"رقم الاتصال");
  const whatsapp=digits(entity.public_whatsapp);
  const services=Array.isArray(entity.public_services)?entity.public_services:[];
  const gallery=Array.isArray(entity.public_gallery_urls)?entity.public_gallery_urls.filter(safeUrl):[];
  const coverage=Array.isArray(entity.public_coverage_areas)?entity.public_coverage_areas:[];
  const address=String(entity.public_address||"").trim();
  const latitude=Number(entity.latitude),longitude=Number(entity.longitude);
  const hasVerifiedMapPoint=entity.location_public===true&&Boolean(entity.location_source_id)&&Boolean(entity.location_verified_at)&&entity.latitude!==null&&entity.latitude!==undefined&&entity.longitude!==null&&entity.longitude!==undefined&&Number.isFinite(latitude)&&Number.isFinite(longitude)&&latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180;
  const mapQuery=hasVerifiedMapPoint?String(latitude+","+longitude):(address?address+", محافظة أسيوط، مصر":"");
  const mapUrl=mapQuery?"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(mapQuery):"";
  const mapEmbedUrl=mapQuery?"https://maps.google.com/maps?q="+encodeURIComponent(mapQuery)+"&output=embed":"";
  const mapNote=hasVerifiedMapPoint?"دبوس الموقع مبني على إحداثيات منشورة في الدليل بعد مراجعة مصدرها.":"هذا بحث استرشادي عن العنوان، وليس دبوسًا جغرافيًا معتمدًا للجهة.";
  const mapSubject=isServiceProvider?"مقدم الخدمة":isRealEstateCompany?"الشركة":"الجهة";
  const mapMarkup=mapQuery
   ? '<section class="company-map-panel" aria-labelledby="companyProviderMapTitle"><div><span class="eyebrow">الموقع الجغرافي</span><h2 id="companyProviderMapTitle">موقع '+mapSubject+' على الخريطة</h2><p>'+esc(mapNote)+'</p></div><div class="company-map-frame"><iframe title="خريطة موقع '+mapSubject+'" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="'+esc(mapEmbedUrl)+'"></iframe></div><a href="'+esc(mapUrl)+'" target="_blank" rel="noopener noreferrer">فتح الموقع على خرائط Google ↗</a></section>'
   : "";
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
  const projectSectionMarkup=await publicProjectsMarkup(entity.id);
  const serviceOffersMarkup=isServiceProvider?await publicServiceOffersMarkup(entity.id):"";
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
  if(phone)contact.push('<a class="company-contact-primary" href="'+esc(phoneHref)+'">'+phoneActionLabel+'</a>');
  if(whatsapp){const wa=whatsapp.startsWith("0")?"2"+whatsapp.slice(1):whatsapp;contact.push('<a class="company-contact-secondary" href="https://wa.me/'+esc(wa)+'" target="_blank" rel="noopener noreferrer">واتساب</a>');}
  if(entity.public_email)contact.push('<a class="company-contact-secondary" href="mailto:'+esc(entity.public_email)+'">البريد الإلكتروني</a>');
  if(website){const isFacebook=/^(?:www\.)?facebook\.com$/i.test(new URL(website).hostname);const websiteLabel=isFacebook?"صفحة الجهة على فيسبوك ↗":"الموقع الإلكتروني ↗";contact.push('<a class="company-contact-secondary" href="'+esc(website)+'" target="_blank" rel="noopener noreferrer">'+websiteLabel+'</a>');}
  if(promoUrl)contact.push('<a class="company-contact-secondary company-promo-link" href="'+esc(promoUrl)+'" target="_blank" rel="noopener noreferrer">شاهد إعلان النشاط على فيسبوك ↗</a>');
  if(mapUrl)contact.push('<a class="company-contact-secondary" href="'+esc(mapUrl)+'" target="_blank" rel="noopener noreferrer">بحث العنوان على الخريطة ↗</a>');
  const serviceHighlightsMarkup=services.length
   ?'<div class="company-profile-highlights" aria-label="أبرز الخدمات">'+services.slice(0,4).map(item=>'<span>'+esc(item)+'</span>').join('')+'</div>'
   :"";
  const contactDetails=[];
  if(address)contactDetails.push('<div class="company-detail-item"><strong>'+(isServiceProvider?"عنوان مقدم الخدمة":"العنوان / الفرع الرئيسي")+'</strong><span>'+esc(address)+'</span></div>');
  if(phone)contactDetails.push('<div class="company-detail-item"><strong>'+esc(phoneDetailLabel)+'</strong><a href="'+esc(phoneHref)+'">'+esc(publishedPhone||officialBrand?.hotline||phone)+'</a></div>');
  if(whatsapp){const waNumber=whatsapp.startsWith("0")?"2"+whatsapp.slice(1):whatsapp;contactDetails.push('<div class="company-detail-item"><strong>واتساب</strong><a href="https://wa.me/'+esc(waNumber)+'" target="_blank" rel="noopener noreferrer">مراسلة الشركة أو مقدم الخدمة</a></div>');}
  if(entity.public_email)contactDetails.push('<div class="company-detail-item"><strong>البريد الإلكتروني</strong><a href="mailto:'+esc(entity.public_email)+'">'+esc(entity.public_email)+'</a></div>');
  if(entity.public_business_hours)contactDetails.push('<div class="company-detail-item"><strong>مواعيد العمل</strong><span>'+esc(entity.public_business_hours)+'</span></div>');
  const contactDetailsTitle=isServiceProvider?"بيانات التواصل ومقر مقدم الخدمة":isRealEstateCompany?"بيانات التواصل ومقر الشركة":"بيانات التواصل ومقر الجهة";
  const contactDetailsMarkup=contactDetails.length
   ?'<section class="company-profile-section company-contact-details"><h2>'+contactDetailsTitle+'</h2><div class="company-detail-grid">'+contactDetails.join("")+'</div></section>'
   :'<section class="company-profile-section company-contact-details"><h2>'+contactDetailsTitle+'</h2><p class="company-detail-empty">لم تُنشر بيانات التواصل أو العنوان حتى الآن.</p></section>';
  const coverageMarkup=coverage.length
   ?'<section class="company-profile-section company-coverage-section"><h2>نطاق تقديم الخدمات</h2><div class="company-coverage-list">'+coverage.map(area=>'<span>'+esc(area)+'</span>').join('')+'</div></section>'
   :"";
  const claimPanelMarkup='<section class="company-claim-panel company-claim-panel--prominent"><div><span class="eyebrow">'+profileRepresentative+'؟</span><h2>ملف شركتك أو نشاطك؟ استلمه وأدِره مجانًا</h2><p>قدّم طلب الاستلام باسمك وبصفتك داخل الشركة. تراجع إدارة أسيوط عقار الهوية والتفويض أولًا، ولا تُمنح صلاحية التعديل لمجرد إرسال الطلب.</p></div><button class="btn btn-gold" type="button" id="companyClaimOpen">استلم ملفك مجانًا</button></section>';
  root.innerHTML=
   '<section class="company-profile-hero company-directory-entity-hero"><div class="company-profile-logo company-directory-entity-monogram">'+(logo?'<img src="'+esc(logo)+'" alt="شعار '+esc(name)+'" loading="eager">':'<span class="company-logo-fallback"><strong>'+esc(name.trim().slice(0,1))+'</strong><small>لا يتوفر شعار موثّق</small></span>')+'</div><div><span class="eyebrow">ملف تعريفي منشور في دليل أسيوط عقار</span>'+(entity.representative_verified_at?'<span class="company-card-meta">تم التحقق من هوية ممثل الجهة وصفته · لا يعني ذلك شهادة ترخيص للنشاط</span>':'')+'<h1>'+esc(name)+'</h1><p>'+esc(description)+'</p><div class="company-card-meta"><span>'+esc(type)+'</span><span>محافظة أسيوط</span></div>'+serviceHighlightsMarkup+'<div class="company-contact-actions">'+contact.join("")+'</div></div></section>'+
   claimPanelMarkup+
   projectSectionMarkup+
   serviceOffersMarkup+
   (services.length?'<section class="company-profile-section"><h2>الخدمات والتخصصات</h2><ul class="company-service-list">'+services.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></section>':'')+
   contactDetailsMarkup+
   coverageMarkup+
   mapMarkup+
   (gallery.length?'<section class="company-profile-section"><h2>معرض أعمال الشركة ومقدم الخدمة</h2><div class="company-gallery">'+gallery.map((u,i)=>'<img src="'+esc(u)+'" alt="صورة من أعمال '+esc(name)+' رقم '+(i+1)+'" loading="lazy">').join('')+'</div></section>':'')+
   '<section class="company-profile-section"><h2>مصادر المعلومات</h2>'+sourceLinks(sources)+'</section>'+
   '<section class="company-profile-section company-source-note"><h2>تنويه من أسيوط عقار</h2><p>هذا ملف تعريفي مجاني، ولا يعني الإدراج وجود شراكة أو تزكية أو ضمان أو شهادة ترخيص من المنصة. راجع التفاصيل والعناوين وبيانات الاتصال مباشرة مع الجهة قبل التعاقد.</p></section>'+
   '<dialog class="company-claim-dialog" id="companyClaimDialog" aria-labelledby="companyClaimTitle"><div class="company-claim-dialog-head"><div><span class="eyebrow">طلب استلام ملف '+profileSubject+'</span><h2 id="companyClaimTitle">بيانات '+profileRepresentative+'</h2></div><button type="button" id="companyClaimClose" class="company-claim-close" aria-label="إغلاق نافذة طلب استلام الملف"><span aria-hidden="true">×</span><span>إغلاق</span></button></div><p class="company-claim-dialog-note">إرسال الطلب يتطلب تسجيل الدخول إلى حسابك على أسيوط عقار. بعد الإرسال تراجع الإدارة هويتك وصفَتك وتفويض الجهة قبل اعتماد الاستلام.</p><p class="company-claim-status" id="companyClaimStatus" role="status" aria-live="polite" hidden></p><a class="company-claim-login-link" id="companyClaimLoginLink" href="./index.html" hidden>اذهب للصفحة الرئيسية لتسجيل الدخول</a><a class="company-claim-login-link" id="companyClaimContactLink" href="https://wa.me/201007044265" target="_blank" rel="noopener noreferrer" hidden>تواصل مع إدارة أسيوط عقار لمتابعة الطلب</a><form id="companyClaimForm" class="company-claim-form"><label>اسم '+profileRepresentative+' *<input name="representative_name" required minlength="3" maxlength="120" autocomplete="name"></label><label>الصفة داخل الجهة *<select name="representative_role" required><option value="">اختر الصفة</option><option>المالك</option><option>شريك</option><option>مدير النشاط</option><option>مدير الفرع</option><option>مسؤول تسويق أو مبيعات</option><option>موظف مفوض</option><option>وكيل / ممثل قانوني</option><option>صفة أخرى</option></select></label><label>رقم الهاتف / واتساب *<input name="representative_phone" type="tel" required minlength="7" maxlength="30" autocomplete="tel"></label><label>البريد الإلكتروني (اختياري)<input name="representative_email" type="email" maxlength="160" autocomplete="email"></label><label>معلومات إضافية (اختياري)<textarea name="representative_notes" rows="3" maxlength="600" placeholder="مثال: أنا مدير فرع أسيوط ومستعد لإرسال التفويض"></textarea></label><label>رابط موقع أو صفحة رسمية للجهة (اختياري)<input name="evidence_url" type="url" maxlength="500" placeholder="https://..."></label><label>وصف مختصر لما يثبت صفتك أو علاقتك بالجهة (اختياري)<textarea name="evidence_description" rows="2" maxlength="500" placeholder="مثال: اسمي مدرج كمدير في صفحة الشركة الرسمية."></textarea></label><p class="company-claim-dialog-note">لا ترفع بطاقة هوية أو مستندات حساسة في النموذج. يمكن للإدارة طلب إثبات مناسب عبر قناة آمنة عند الحاجة.</p><button class="btn btn-gold" type="submit">إرسال طلب الاستلام</button></form></dialog>';
  attachLogoFallback(root,name);
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
     showClaimStatus("تم التحقق من هويتك وصفتك وربط حسابك بالملف. يمكنك تحديث بيانات التشغيل مباشرة، أما اسم الجهة ووسائل الاتصال الأساسية فتحتاج موافقة الإدارة.",false);
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
    const userId=session?.user?.id;
    if(!userId)return;
    const managerUrl=base+"/rest/v1/company_entity_managers?select=directory_entity_id,owner_user_id,verified_at,representative_role&directory_entity_id=eq."+encodeURIComponent(entity.id)+"&owner_user_id=eq."+encodeURIComponent(userId);
    const managerResponse=await auth.authedFetch(managerUrl,{method:"GET"});
    const managerRows=await managerResponse.json().catch(()=>[]);
    let accessRole=null;
    const isOwner=managerResponse.ok&&Array.isArray(managerRows)&&managerRows.some(row=>row.verified_at);
    if(isOwner)accessRole="owner";
    else{
     const memberUrl=base+"/rest/v1/company_entity_manager_members?select=member_role&directory_entity_id=eq."+encodeURIComponent(entity.id)+"&user_id=eq."+encodeURIComponent(userId)+"&revoked_at=is.null";
     const memberResponse=await auth.authedFetch(memberUrl,{method:"GET"});
     const memberRows=await memberResponse.json().catch(()=>[]);
     if(memberResponse.ok&&Array.isArray(memberRows)&&memberRows.length)accessRole=memberRows[0].member_role;
    }
    if(!accessRole)return;
    if(claimPanel)claimPanel.hidden=true;

    const target=document.createElement("section");
    target.className="company-manager-panel company-profile-section";
    const list=values=>Array.isArray(values)?values.join("\n"):"";
    const categories=
      '<option value="contracting_construction">مقاولات وإنشاءات</option><option value="real_estate_marketing">تسويق عقاري</option><option value="real_estate_brokerage">وساطة ومكتب عقاري</option><option value="building_materials">مواد بناء وتشطيب</option><option value="finishing_decoration">تشطيب وديكور</option><option value="furniture_furnishings">أثاث وفرش وتجهيز وحدات</option><option value="engineering_design">مكاتب هندسية وتصميم معماري</option><option value="maintenance_property_management">صيانة وإدارة عقارات</option><option value="real_estate_consultancy">استشارات عقارية</option><option value="real_estate_development">تطوير ومشروعات عقارية</option><option value="real_estate_sales">مبيعات عقارية</option><option value="other_real_estate_services">خدمات عقارية مساندة</option>';
    target.innerHTML=
     '<div><span class="eyebrow">إدارة الملف بعد التحقق</span><h2>إدارة ملف '+managedSubject+'</h2><p>صلاحيتك: '+(isOwner?"المالك الأساسي المعتمد":accessRole==="manager"?"مدير ملف مفوض":"محرر ملف مفوض")+'. التعديلات التشغيلية المسموح بها تظهر مباشرة وتسجل في سجل المراجعة. بيانات الهوية والتواصل الأساسي تحتاج اعتماد الإدارة.</p></div>'+
     '<p class="company-manager-status" id="companyManagerStatus" role="status" aria-live="polite"></p>'+
     '<h3>تحديثات تشغيلية تظهر مباشرة</h3><form class="company-manager-form" id="companyManagerDirectForm">'+
      '<label class="wide">وصف النشاط والخدمات<textarea name="description" rows="3" maxlength="2000">'+esc(entity.description||"")+'</textarea></label>'+
      '<label>مواعيد العمل<input name="public_business_hours" maxlength="240" value="'+esc(entity.public_business_hours||"")+'"></label>'+
      '<label class="wide">الخدمات والتخصصات (كل خدمة في سطر)<textarea name="public_services" rows="3">'+esc(list(entity.public_services))+'</textarea></label>'+
      '<label class="wide">مناطق التغطية (كل منطقة في سطر)<textarea name="public_coverage_areas" rows="2">'+esc(list(entity.public_coverage_areas))+'</textarea></label>'+
      '<label class="wide">روابط صور الأعمال (رابط آمن في كل سطر)<textarea name="public_gallery_urls" rows="3">'+esc(list(entity.public_gallery_urls))+'</textarea></label>'+
      '<button class="btn btn-gold" type="submit">حفظ التحديثات مباشرة</button></form>'+
     (isOwner?
      '<h3>تغييرات تتطلب موافقة الإدارة</h3><p>اسم الجهة، مجال النشاط، الهاتف، واتساب، البريد، الموقع، العنوان والشعار لا تتغير للزوار إلا بعد مراجعة الإدارة.</p>'+
      '<p class="company-manager-status" id="companyManagerReviewStatus" role="status" aria-live="polite"></p>'+
      '<form class="company-manager-form" id="companyManagerReviewForm">'+
       '<label>اسم الجهة<input name="name_ar" required minlength="2" maxlength="180" value="'+esc(entity.name_ar||"")+'"></label>'+
       '<label>مجال الخدمة<select name="service_category" required><option value="">اختر المجال</option>'+categories+'</select></label>'+
       '<label>رقم الهاتف<input name="public_phone" type="tel" maxlength="30" value="'+esc(entity.public_phone||"")+'"></label>'+
       '<label>واتساب<input name="public_whatsapp" type="tel" maxlength="30" value="'+esc(entity.public_whatsapp||"")+'"></label>'+
       '<label>البريد الإلكتروني<input name="public_email" type="email" maxlength="160" value="'+esc(entity.public_email||"")+'"></label>'+
       '<label>الموقع الإلكتروني<input name="website_url" type="url" maxlength="500" value="'+esc(entity.website_url||"")+'"></label>'+
       '<label class="wide">العنوان<input name="public_address" maxlength="240" value="'+esc(entity.public_address||"")+'"></label>'+
       '<label>رابط الشعار<input name="public_logo_url" type="url" maxlength="500" value="'+esc(entity.public_logo_url||"")+'"></label>'+
       '<button class="btn btn-outline-dark" type="submit">إرسال التغيير لموافقة الإدارة</button></form>'
      :'<p class="company-manager-status">إدارة الاسم ووسائل الاتصال الأساسية تظل للمالك الأساسي للملف.</p>')+
     (isOwner?
      '<section class="company-manager-team"><h3>فريق إدارة الملف</h3><p>أضف موظفًا لديه حساب مؤكد على أسيوط عقار. المدير المفوض يستطيع تحديث البيانات التشغيلية، والمحرر يستطيع تحديث الخدمات والوصف ومناطق التغطية والصور التشغيلية فقط.</p>'+
      '<form class="company-manager-form" id="companyManagerInviteForm"><label>بريد الموظف الإلكتروني<input name="email" type="email" required maxlength="254"></label><label>الصلاحية<select name="role"><option value="editor">محرر بيانات تشغيلية</option><option value="manager">مدير ملف مفوض</option></select></label><button class="btn btn-outline-dark" type="submit">إضافة إلى فريق الملف</button></form>'+
      '<div id="companyManagerMembers" class="company-manager-status">جارٍ تحميل أعضاء الفريق...</div></section>'
      :"");
    const profileHero=root.querySelector(".company-profile-hero");
    if(profileHero)profileHero.insertAdjacentElement("afterend",target);else root.appendChild(target);

    if(isRealEstateCompany){
     const canManageProjects=isOwner||accessRole==="manager";
     if(canManageProjects){
      const tools=document.createElement("section");
      tools.className="company-profile-managed-project-tools";
      const isDeveloper=entity.entity_type==="developer"||entity.service_category==="real_estate_development";
      const isMarketing=["marketing","brokerage","sales_office"].includes(entity.entity_type)||
       ["real_estate_marketing","real_estate_brokerage","real_estate_sales"].includes(entity.service_category);
      tools.innerHTML=
       '<div class="company-profile-tools-heading"><span class="eyebrow">أدوات ملف الشركة</span><h3>إدارة المشروعات والوحدات والإعلانات</h3><p>كل طلب يخضع لمراجعة إدارة أسيوط عقار، ولا يظهر مشروع أو وحدة أو إعلان داخل المشروع إلا بعد اعتماد العلاقة والبيانات.</p></div>'+
       '<section class="company-profile-tool-section"><h4>إدارة المشروعات</h4><p>'+
        (isDeveloper?"يمكنك طلب إضافة مشروع جديد أو ربط ملف الشركة بمشروع منشور. طلب الإضافة لا ينشر المشروع تلقائيًا.":isMarketing?"يمكنك طلب ربط ملف الشركة بمشروع منشور بصفتك وكيل تسويق أو وكيل مبيعات. لا يتيح ملف التسويق إنشاء سجل مشروع جديد.":"طلبات المشروعات غير متاحة لهذا النوع من الملفات.")+
       '</p><div id="companyProfileProjectManagementRoot"></div><div class="company-profile-tool-subheading"><strong>طلبات المشروعات</strong></div><div id="companyProfileProjectRequestsRoot" aria-live="polite"></div></section>'+
       (isDeveloper
        ?'<section class="company-profile-tool-section"><h4>وحدات المشروعات</h4><p>إضافة الوحدات متاحة للمالك المعتمد أو مدير الملف المفوض عندما تكون الشركة مرتبطة بالمشروع بصفة المطور أو مالك الأرض. تُراجع كل وحدة قبل ظهورها.</p><div id="companyProfileProjectUnitsRoot"></div><div class="company-profile-tool-subheading"><strong>طلبات الوحدات</strong></div><div id="companyProfileProjectUnitRequestsRoot" aria-live="polite"></div></section>'
        :'<section class="company-profile-tool-section"><h4>وحدات المشروعات</h4><p>إضافة الوحدات ليست من صلاحيات وكيل التسويق أو المبيعات؛ يتولاها المطور أو مالك الأرض المعتمد.</p></section>')+
       '<section class="company-profile-tool-section"><h4>ربط إعلان بوحدة منشورة</h4><p>يمكنك طلب ربط إعلان متاح تملكه أنت بوحدة منشورة في أحد مشروعات هذا الملف. لن يظهر الربط إلا بعد مراجعة الإدارة، ولا تُربط إعلانات الموظفين أو الشركة تلقائيًا.</p><div id="companyProfileOfferUnitLinkRoot"></div><div class="company-profile-tool-subheading"><strong>طلبات ربط إعلاناتك</strong></div><div id="companyProfileOfferUnitLinkRequestsRoot" aria-live="polite"></div></section>';
      target.appendChild(tools);
      const projectMount=window.AsyutCompanyProjectManagement?.mount;
      if(typeof projectMount==="function"){
       await projectMount({
        entityId:entity.id,
        root:tools.querySelector("#companyProfileProjectManagementRoot"),
        requestsRoot:tools.querySelector("#companyProfileProjectRequestsRoot")
       });
      }
      if(isDeveloper&&typeof window.AsyutCompanyProjectUnits?.mount==="function"){
       await window.AsyutCompanyProjectUnits.mount({
        entityId:entity.id,
        root:tools.querySelector("#companyProfileProjectUnitsRoot"),
        requestsRoot:tools.querySelector("#companyProfileProjectUnitRequestsRoot")
       });
      }else if(isDeveloper){
       tools.querySelector("#companyProfileProjectUnitsRoot").textContent="أدوات إدارة الوحدات غير محملة. حدّث الصفحة وحاول مرة أخرى.";
      }
      if(typeof window.AsyutMyProjectUnitLink?.mount==="function"){
       await window.AsyutMyProjectUnitLink.mount({
        entityId:entity.id,
        root:tools.querySelector("#companyProfileOfferUnitLinkRoot"),
        requestsRoot:tools.querySelector("#companyProfileOfferUnitLinkRequestsRoot")
       });
      }else{
       tools.querySelector("#companyProfileOfferUnitLinkRoot").textContent="أداة ربط الإعلانات غير محملة. حدّث الصفحة وحاول مرة أخرى.";
      }
     }else{
      const note=document.createElement("section");
      note.className="company-profile-section company-manager-access-note";
      note.innerHTML='<h3>إدارة مشروعات الشركة</h3><p>تحديث بيانات الملف متاح بصلاحيتك الحالية، أما طلبات إضافة أو ربط المشروعات وإدارة الوحدات فتحتاج صفة المالك المعتمد أو مدير الملف المفوض.</p>';
      target.appendChild(note);
     }
    }

    const directForm=target.querySelector("#companyManagerDirectForm");
    const directStatus=target.querySelector("#companyManagerStatus");
    directForm?.addEventListener("submit",async event=>{
     event.preventDefault();
     if(!directForm.reportValidity())return;
     const data=new FormData(directForm);
     const value=name=>String(data.get(name)||"").trim();
     const lines=name=>value(name).split(/\n+/).map(item=>item.trim()).filter(Boolean);
     let gallery;
     try{
      gallery=lines("public_gallery_urls").map(item=>{
       const url=safeUrl(item);
       if(!url)throw new Error("روابط صور الأعمال يجب أن تبدأ بـ http:// أو https://.");
       return url;
      });
     }catch(error){directStatus.textContent=error.message;return;}
     const payload={
      description:value("description")||null,
      public_business_hours:value("public_business_hours")||null,
      public_services:lines("public_services"),
      public_coverage_areas:lines("public_coverage_areas"),
      public_gallery_urls:gallery
     };
     const button=directForm.querySelector('button[type="submit"]');
     button.disabled=true;
     directStatus.textContent="جارٍ حفظ التحديثات...";
     try{
      const response=await auth.authedFetch(base+"/rest/v1/rpc/company_entity_profile_update_direct",{
       method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({p_directory_entity_id:entity.id,p_payload:payload})
      });
      const result=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(result?.message||result?.details||"تعذر حفظ التحديثات.");
      directStatus.textContent="تم حفظ التحديثات مباشرة وتسجيلها في سجل المراجعة. حدّث الصفحة لرؤية النسخة الجديدة.";
     }catch(error){directStatus.textContent=error.message||"تعذر حفظ التحديثات.";}
     finally{button.disabled=false;}
    });

    if(isOwner){
     const reviewForm=target.querySelector("#companyManagerReviewForm");
     const reviewStatus=target.querySelector("#companyManagerReviewStatus");
     const reviewButton=reviewForm.querySelector('button[type="submit"]');
     const statusUrl=base+"/rest/v1/company_entity_profile_update_requests?select=id,status,admin_notes,created_at&directory_entity_id=eq."+encodeURIComponent(entity.id)+"&requester_user_id=eq."+encodeURIComponent(userId)+"&order=created_at.desc&limit=1";
     const statusResponse=await auth.authedFetch(statusUrl,{method:"GET"});
     const statusRows=await statusResponse.json().catch(()=>[]);
     if(!statusResponse.ok)throw new Error("تعذر تحميل حالة التعديلات التي تنتظر الإدارة.");
     const latest=Array.isArray(statusRows)?statusRows[0]:null;
     reviewForm.elements.service_category.value=entity.service_category||"";
     if(latest?.status==="pending"){
      reviewStatus.textContent="لديك تغيير حساس قيد مراجعة الإدارة.";
      reviewButton.disabled=true;
     }else if(latest?.status==="needs_changes"){
      reviewStatus.textContent="طلبت الإدارة استكمال البيانات: "+(latest.admin_notes||"راجع البيانات ثم أعد الإرسال.");
     }else if(latest?.status==="rejected"){
      reviewStatus.textContent="تم رفض آخر تغيير: "+(latest.admin_notes||"راجع البيانات قبل إعادة الإرسال.");
     }else if(latest?.status==="approved"){
      reviewStatus.textContent="تم اعتماد آخر تغيير وإظهاره في الملف.";
     }else{
      reviewStatus.textContent="يمكنك إرسال تغييرات بيانات الهوية والتواصل للمراجعة.";
     }
     reviewForm.addEventListener("submit",async event=>{
      event.preventDefault();
      if(!reviewForm.reportValidity())return;
      const data=new FormData(reviewForm);
      const value=name=>String(data.get(name)||"").trim();
      const validateUrl=input=>{
       if(!input)return null;
       const url=safeUrl(input);
       if(!url)throw new Error("الرابط يجب أن يبدأ بـ http:// أو https://.");
       return url;
      };
      let payload;
      try{
       payload={
        name_ar:value("name_ar"),service_category:value("service_category"),
        public_phone:value("public_phone")||null,public_whatsapp:value("public_whatsapp")||null,
        public_email:value("public_email")||null,website_url:validateUrl(value("website_url")),
        public_address:value("public_address")||null,public_logo_url:validateUrl(value("public_logo_url"))
       };
      }catch(error){reviewStatus.textContent=error.message;return;}
      reviewButton.disabled=true;
      reviewStatus.textContent="جارٍ إرسال التغيير لمراجعة الإدارة...";
      try{
       const response=await auth.authedFetch(base+"/rest/v1/rpc/company_entity_profile_update_submit",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({p_directory_entity_id:entity.id,p_payload:payload})
       });
       const result=await response.json().catch(()=>null);
       if(!response.ok)throw new Error(result?.message||result?.details||"تعذر إرسال التغيير.");
       reviewStatus.textContent="تم إرسال التغيير. ستظل البيانات الحالية ظاهرة حتى موافقة الإدارة.";
       reviewButton.textContent="التغيير قيد المراجعة";
       reviewButton.disabled=true;
      }catch(error){reviewStatus.textContent=error.message||"تعذر إرسال التغيير.";reviewButton.disabled=false;}
     });

     const membersRoot=target.querySelector("#companyManagerMembers");
     async function loadMembers(){
      membersRoot.textContent="جارٍ تحميل أعضاء الفريق...";
      const response=await auth.authedFetch(base+"/rest/v1/rpc/company_entity_manager_member_list",{
       method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({p_directory_entity_id:entity.id})
      });
      const rows=await response.json().catch(()=>[]);
      if(!response.ok)throw new Error("تعذر تحميل فريق الملف.");
      if(!Array.isArray(rows)||!rows.length){
       membersRoot.textContent="لا يوجد موظفون مفوضون حاليًا.";
       return;
      }
      membersRoot.innerHTML=rows.map(row=>
       '<div class="company-manager-member" data-manager-user="'+esc(row.user_id)+'"><strong>'+esc(row.email||"حساب أسيوط عقار")+'</strong> · '+(row.member_role==="manager"?"مدير ملف مفوض":"محرر بيانات تشغيلية")+
       ' <button type="button" class="btn btn-outline-dark" data-manager-revoke>إلغاء الصلاحية</button></div>'
      ).join("");
     }
     const inviteForm=target.querySelector("#companyManagerInviteForm");
     inviteForm.addEventListener("submit",async event=>{
      event.preventDefault();
      if(!inviteForm.reportValidity())return;
      const data=new FormData(inviteForm);
      const button=inviteForm.querySelector('button[type="submit"]');
      button.disabled=true;
      try{
       const response=await auth.authedFetch(base+"/rest/v1/rpc/company_entity_manager_invite",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({p_directory_entity_id:entity.id,p_email:String(data.get("email")||"").trim(),p_role:String(data.get("role")||"editor")})
       });
       const result=await response.json().catch(()=>null);
       if(!response.ok)throw new Error(result?.message||result?.details||"تعذرت إضافة الموظف.");
       inviteForm.reset();
       membersRoot.textContent="تمت إضافة الموظف.";
       await loadMembers();
      }catch(error){membersRoot.textContent=error.message||"تعذرت إضافة الموظف.";}
      finally{button.disabled=false;}
     });
     membersRoot.addEventListener("click",async event=>{
      const button=event.target.closest("[data-manager-revoke]");
      const card=event.target.closest("[data-manager-user]");
      if(!button||!card)return;
      if(!window.confirm("إلغاء صلاحية هذا المستخدم من إدارة الملف؟"))return;
      button.disabled=true;
      try{
       const response=await auth.authedFetch(base+"/rest/v1/rpc/company_entity_manager_revoke",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({p_directory_entity_id:entity.id,p_user_id:card.dataset.managerUser})
       });
       const result=await response.json().catch(()=>null);
       if(!response.ok)throw new Error(result?.message||result?.details||"تعذر إلغاء الصلاحية.");
       await loadMembers();
      }catch(error){membersRoot.textContent=error.message||"تعذر إلغاء الصلاحية.";}
      finally{button.disabled=false;}
     });
     await loadMembers();
    }
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
      notes:String(data.get("representative_notes")||"").trim()||null,
      evidence_url:String(data.get("evidence_url")||"").trim()||null,
      evidence_description:String(data.get("evidence_description")||"").trim()||null
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
    showClaimStatus("تم تسجيل طلبك بنجاح"+(requestId?" — رقم الطلب: "+requestId:"")+"، وستراجع الإدارة وسيلة إثبات الصفة قبل اعتمادك. بعد الاعتماد ستتمكن من إدارة البيانات التشغيلية مباشرة.",false);
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
   ...(phone?{telephone:publishedPhone||officialBrand?.hotline}:{}),
   ...(entity.public_email?{email:entity.public_email}:{}),
   ...(website?{sameAs:[website]}:{}),
   ...(address?{address:{"@type":"PostalAddress","streetAddress":address,"addressRegion":"أسيوط","addressCountry":"EG"}}:{})
  });
 }

 async function mountApprovedCompanyEditor(company){
  const auth=window.LAYAN_SUPABASE;
  if(!auth?.isAuthenticated?.())return;
  try{
   const session=await auth.requireAuthenticated();
   const userId=session?.user?.id;
   if(!userId)return;
   let isOwner=false,accessRole=null;
   try{
    const response=await auth.authedFetch(base+"/rest/v1/rpc/layan_company_owner_profile",{
     method:"POST",headers:{"Content-Type":"application/json"},body:"{}"
    });
    const mine=await response.json().catch(()=>null);
    if(response.ok&&mine?.id===company.id&&mine.verified_at){
     isOwner=true;accessRole="owner";
    }
   }catch(_){}
   if(!isOwner){
    const url=base+"/rest/v1/company_profile_manager_members?select=member_role&company_profile_id=eq."+encodeURIComponent(company.id)+"&user_id=eq."+encodeURIComponent(userId)+"&revoked_at=is.null";
    const response=await auth.authedFetch(url,{method:"GET"});
    const rows=await response.json().catch(()=>[]);
    if(response.ok&&Array.isArray(rows)&&rows.length)accessRole=rows[0].member_role;
   }
   if(!accessRole)return;
   const panel=document.createElement("section");
   panel.className="company-profile-section company-manager-panel";
   const rows=value=>Array.isArray(value)?value.join("\n"):"";
   panel.innerHTML=
    '<span class="eyebrow">إدارة الملف بعد التحقق</span><h2>إدارة ملف الشركة</h2><p>صلاحيتك: '+(isOwner?"المالك الأساسي المعتمد":accessRole==="manager"?"مدير ملف مفوض":"محرر بيانات تشغيلية")+'. تحديث الوصف والخدمات والصور والمشروعات يظهر مباشرة ويسجل في سجل التغييرات. الاسم والتصنيف ووسائل الاتصال الأساسية تحتاج موافقة الإدارة.</p>'+
    '<p id="companyProfileManagerDirectStatus" role="status" aria-live="polite"></p>'+
    '<form class="company-manager-form" id="companyProfileManagerDirectForm">'+
     '<label class="wide">نبذة الشركة<textarea name="description" rows="3" minlength="20" maxlength="1200" required>'+esc(company.description||"")+'</textarea></label>'+
     '<label class="wide">الخدمات والتخصصات (كل خدمة في سطر)<textarea name="services" rows="3">'+esc(rows(company.services))+'</textarea></label>'+
     '<label class="wide">روابط صور الأعمال (رابط آمن في كل سطر)<textarea name="gallery_urls" rows="3">'+esc(rows(company.gallery_urls))+'</textarea></label>'+
     '<label class="wide">المشروعات والأعمال السابقة (اسم المشروع — وصف مختصر، كل مشروع في سطر)<textarea name="projects" rows="3">'+esc((company.projects||[]).map(p=>(p.title||"")+" — "+(p.description||"")).join("\n"))+'</textarea></label>'+
     '<button class="btn btn-gold" type="submit">حفظ التحديثات مباشرة</button></form>'+
    (isOwner?
     '<h3>تغييرات تحتاج موافقة الإدارة</h3><p id="companyProfileManagerReviewStatus" role="status" aria-live="polite"></p><form class="company-manager-form" id="companyProfileManagerReviewForm">'+
      '<label>اسم الشركة<input name="company_name" required minlength="2" maxlength="140" value="'+esc(company.company_name||"")+'"></label>'+
      '<label>مجال الشركة<input name="category" required maxlength="140" value="'+esc(company.category||"")+'"></label>'+
      '<label>المحافظة / المدينة<input name="city" maxlength="100" value="'+esc(company.city||"أسيوط")+'"></label>'+
      '<label>العنوان<input name="address" maxlength="240" value="'+esc(company.address||"")+'"></label>'+
      '<label>رقم الهاتف<input name="phone" type="tel" required minlength="7" maxlength="30" value="'+esc(company.phone||"")+'"></label>'+
      '<label>واتساب<input name="whatsapp" type="tel" maxlength="30" value="'+esc(company.whatsapp||"")+'"></label>'+
      '<label>الموقع الإلكتروني<input name="website" type="url" maxlength="500" value="'+esc(company.website||"")+'"></label>'+
      '<label>رابط الشعار<input name="logo_url" type="url" maxlength="500" value="'+esc(company.logo_url||"")+'"></label>'+
      '<button class="btn btn-outline-dark" type="submit">إرسال التغيير لموافقة الإدارة</button></form>'+
      '<section class="company-manager-team"><h3>فريق إدارة الشركة</h3><p>أضف موظفًا لديه حساب مؤكد على أسيوط عقار، واختر صلاحية مدير ملف أو محرر بيانات تشغيلية.</p>'+
      '<form class="company-manager-form" id="companyProfileTeamInviteForm"><label>بريد الموظف<input name="email" type="email" required maxlength="254"></label><label>الصلاحية<select name="role"><option value="editor">محرر بيانات تشغيلية</option><option value="manager">مدير ملف مفوض</option></select></label><button type="submit" class="btn btn-outline-dark">إضافة الموظف</button></form><div id="companyProfileTeamMembers" role="status" aria-live="polite"></div></section>'
     :"");
   const profileHero=root.querySelector(".company-profile-hero");
   if(profileHero)profileHero.insertAdjacentElement("afterend",panel);else root.appendChild(panel);
   const projectAccessNote=document.createElement("section");
   projectAccessNote.className="company-profile-section company-manager-access-note";
   projectAccessNote.innerHTML='<h3>المشروعات والوحدات التابعة للشركة</h3><p>إدارة المشروعات والوحدات تعتمد على سجل الشركة المنشور في الدليل العقاري والعلاقات الموثقة به. هذا الملف المقدم من الشركة لا يُربط بسجل الدليل لمجرد تشابه الاسم؛ حتى لا ننسب مشروعًا إلى جهة غير مقصودة. يمكن للإدارة مراجعة الربط الصحيح واستكماله عند التحقق.</p>';
   panel.appendChild(projectAccessNote);

   const rpc=async(name,args)=>{
    const response=await auth.authedFetch(base+"/rest/v1/rpc/"+name,{
     method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(args)
    });
    const result=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(result?.message||result?.details||result?.hint||"تعذر تنفيذ التحديث.");
    return result;
   };
   const directForm=panel.querySelector("#companyProfileManagerDirectForm");
   const directStatus=panel.querySelector("#companyProfileManagerDirectStatus");
   directForm.addEventListener("submit",async event=>{
    event.preventDefault();if(!directForm.reportValidity())return;
    const data=new FormData(directForm),value=name=>String(data.get(name)||"").trim();
    const lines=name=>value(name).split(/\n+/).map(x=>x.trim()).filter(Boolean);
    let gallery;
    try{
     gallery=lines("gallery_urls").map(item=>{const url=safeUrl(item);if(!url)throw Error("رابط صورة الأعمال غير صحيح.");return url;});
    }catch(error){directStatus.textContent=error.message;return;}
    const projects=lines("projects").map(line=>{const parts=line.split("—");return {title:(parts.shift()||"عمل سابق").trim(),description:parts.join("—").trim()};});
    const button=directForm.querySelector('button[type="submit"]');button.disabled=true;
    directStatus.textContent="جارٍ حفظ التحديثات...";
    try{
     await rpc("company_profile_update_direct",{
      p_company_profile_id:company.id,
      p_payload:{description:value("description"),services:lines("services"),gallery_urls:gallery,projects}
     });
     directStatus.textContent="تم حفظ التحديثات التشغيلية مباشرة وتسجيلها في سجل التغييرات.";
    }catch(error){directStatus.textContent=error.message||"تعذر حفظ التحديثات.";}
    finally{button.disabled=false;}
   });

   if(isOwner){
    const reviewForm=panel.querySelector("#companyProfileManagerReviewForm");
    const reviewStatus=panel.querySelector("#companyProfileManagerReviewStatus");
    const reviewUrl=base+"/rest/v1/company_profiles?id=eq."+encodeURIComponent(company.id)+"&select=update_status,update_notes,pending_update";
    const reviewResponse=await auth.authedFetch(reviewUrl,{method:"GET"});
    const reviewRows=await reviewResponse.json().catch(()=>[]);
    const pending=reviewResponse.ok&&Array.isArray(reviewRows)?reviewRows[0]:null;
    const reviewButton=reviewForm.querySelector('button[type="submit"]');
    if(pending?.update_status==="pending"){
     reviewStatus.textContent="يوجد تغيير حساس قيد مراجعة الإدارة.";
     reviewButton.disabled=true;
    }else if(pending?.update_status==="needs_changes"){
     reviewStatus.textContent="طلبت الإدارة استكمال البيانات: "+(pending.update_notes||"راجع البيانات ثم أعد الإرسال.");
    }else if(pending?.update_status==="rejected"){
     reviewStatus.textContent="تم رفض آخر تغيير: "+(pending.update_notes||"راجع البيانات قبل إعادة الإرسال.");
    }else{
     reviewStatus.textContent="يمكنك إرسال تغييرات الاسم والتصنيف والتواصل لمراجعة الإدارة.";
    }
    reviewForm.addEventListener("submit",async event=>{
     event.preventDefault();if(!reviewForm.reportValidity())return;
     const data=new FormData(reviewForm),value=name=>String(data.get(name)||"").trim();
     const website=value("website"),logo=value("logo_url");
     if(website&&!safeUrl(website)||logo&&!safeUrl(logo)){reviewStatus.textContent="تحقق من روابط الموقع والشعار.";return;}
     const payload={company_name:value("company_name"),category:value("category"),city:value("city")||"أسيوط",address:value("address")||null,phone:value("phone"),whatsapp:value("whatsapp")||null,website:website||null,logo_url:logo||null};
     reviewButton.disabled=true;reviewStatus.textContent="جارٍ إرسال التغيير لموافقة الإدارة...";
     try{
      await rpc("company_profile_sensitive_update_submit",{p_company_profile_id:company.id,p_payload:payload});
      reviewStatus.textContent="تم إرسال التغيير. النسخة المنشورة الحالية ستظل ظاهرة حتى موافقة الإدارة.";
     }catch(error){reviewStatus.textContent=error.message||"تعذر إرسال التغيير.";reviewButton.disabled=false;}
    });

    const membersRoot=panel.querySelector("#companyProfileTeamMembers");
    async function loadMembers(){
     membersRoot.textContent="جارٍ تحميل فريق الشركة...";
     const rows=await rpc("company_profile_manager_member_list",{p_company_profile_id:company.id});
     if(!Array.isArray(rows)||!rows.length){membersRoot.textContent="لا يوجد موظفون مفوضون حاليًا.";return;}
     membersRoot.innerHTML=rows.map(row=>'<div class="company-manager-member" data-company-member="'+esc(row.user_id)+'"><strong>'+esc(row.email||"حساب أسيوط عقار")+'</strong> · '+(row.member_role==="manager"?"مدير ملف مفوض":"محرر بيانات تشغيلية")+' <button type="button" class="btn btn-outline-dark" data-company-member-revoke>إلغاء الصلاحية</button></div>').join("");
    }
    const inviteForm=panel.querySelector("#companyProfileTeamInviteForm");
    inviteForm.addEventListener("submit",async event=>{
     event.preventDefault();if(!inviteForm.reportValidity())return;
     const data=new FormData(inviteForm),button=inviteForm.querySelector('button[type="submit"]');button.disabled=true;
     try{
      await rpc("company_profile_manager_invite",{p_company_profile_id:company.id,p_email:String(data.get("email")||"").trim(),p_role:String(data.get("role")||"editor")});
      inviteForm.reset();await loadMembers();
     }catch(error){membersRoot.textContent=error.message||"تعذرت إضافة الموظف.";}
     finally{button.disabled=false;}
    });
    membersRoot.addEventListener("click",async event=>{
     const button=event.target.closest("[data-company-member-revoke]");
     const row=event.target.closest("[data-company-member]");
     if(!button||!row)return;
     if(!window.confirm("إلغاء صلاحية هذا الموظف من إدارة الشركة؟"))return;
     button.disabled=true;
     try{await rpc("company_profile_manager_revoke",{p_company_profile_id:company.id,p_user_id:row.dataset.companyMember});await loadMembers();}
     catch(error){membersRoot.textContent=error.message||"تعذر إلغاء الصلاحية.";}
     finally{button.disabled=false;}
    });
    await loadMembers();
   }
  }catch(error){console.warn("Approved company profile editor unavailable:",error);}
 }
 async function loadApprovedCompany(){
  if(!/^[0-9a-f-]{36}$/i.test(profileId||"")){renderError("رابط ملف الشركة غير صحيح.");return;}
  const query="company_profiles_public?select=id,company_name,category,description,services,city,logo_url,address,phone,whatsapp,website,gallery_urls,projects,representative_verified_at&id=eq."+encodeURIComponent(profileId);
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
  const approvedContactDetails=[];
  if(c.address)approvedContactDetails.push('<div class="company-detail-item"><strong>العنوان / الفرع الرئيسي</strong><span>'+esc(c.address)+'</span></div>');
  if(phone)approvedContactDetails.push('<div class="company-detail-item"><strong>رقم الاتصال</strong><a href="tel:'+esc(phone)+'">'+esc(c.phone)+'</a></div>');
  if(wa)approvedContactDetails.push('<div class="company-detail-item"><strong>واتساب</strong><a href="https://wa.me/'+esc(wa)+'" target="_blank" rel="noopener noreferrer">مراسلة الشركة</a></div>');
  if(safeUrl(c.website))approvedContactDetails.push('<div class="company-detail-item"><strong>الموقع الإلكتروني</strong><a href="'+esc(safeUrl(c.website))+'" target="_blank" rel="noopener noreferrer">زيارة الموقع ↗</a></div>');
  root.innerHTML=
   '<section class="company-profile-hero"><div class="company-profile-logo">'+(logo?'<img src="'+esc(logo)+'" alt="شعار '+esc(c.company_name)+'" loading="eager">':'<span class="company-logo-fallback"><strong>'+esc(String(c.company_name||"ش").slice(0,1))+'</strong><small>لا يتوفر شعار موثّق</small></span>')+'</div><div><span class="eyebrow">ملف شركة مقدم من الشركة ومعتمد من الإدارة</span>'+(c.representative_verified_at?'<span class="company-card-meta">تم التحقق من هوية ممثل الشركة وصفته · لا يمثل ذلك شهادة ترخيص</span>':'')+'<h1>'+esc(c.company_name)+'</h1><p>'+esc(description)+'</p><div class="company-card-meta"><span>'+esc(c.category)+'</span><span>'+esc(c.city||"أسيوط")+'</span></div><div class="company-contact-actions">'+actions.join("")+'</div></div></section>'+
   (services.length?'<section class="company-profile-section"><h2>الخدمات والتخصصات</h2><ul class="company-service-list">'+services.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></section>':"")+
   (approvedContactDetails.length?'<section class="company-profile-section company-contact-details"><h2>بيانات التواصل ومقر الشركة</h2><div class="company-detail-grid">'+approvedContactDetails.join("")+'</div></section>':"")+
   (projects.length?'<section class="company-profile-section"><h2>المشروعات والأعمال السابقة</h2><div class="company-project-list">'+projects.map(p=>'<article class="company-project"><h3>'+esc(p.title||"عمل سابق")+'</h3><p>'+esc(p.description||"")+'</p></article>').join('')+'</div></section>':"")+
   (gallery.length?'<section class="company-profile-section"><h2>معرض الأعمال</h2><div class="company-gallery">'+gallery.map((u,i)=>'<img src="'+esc(u)+'" alt="صورة من أعمال '+esc(c.company_name)+' رقم '+(i+1)+'" loading="lazy">').join('')+'</div></section>':"");
  attachLogoFallback(root,c.company_name);
   mountApprovedCompanyEditor(c);
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