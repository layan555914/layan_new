document.addEventListener("DOMContentLoaded",()=>{"use strict";
const cfg=window.LAYAN_CONFIG||{},base=String(cfg.SUPABASE_URL||"").replace(/\/$/,""),key=cfg.SUPABASE_PUBLISHABLE_KEY||"";
const $=id=>document.getElementById(id),grid=$("companyDirectoryGrid"),count=$("companyDirectoryCount"),marketingGrid=$("marketingCompaniesGrid"),developmentGrid=$("developmentCompaniesGrid"),marketingCount=$("marketingCompaniesCount"),developmentCount=$("developmentCompaniesCount"),dialog=$("companyRegisterDialog"),form=$("companyRegisterForm"),status=$("companyRegisterStatus");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=v=>{try{const u=new URL(String(v||""));return ["https:","http:"].includes(u.protocol)?u.href:""}catch(_){return ""}};
function entityBrandMarkup(name,logo){
 const label=String(name||"جهة").trim();
 const initial=label.slice(0,1)||"؟";
 return '<span class="aq-entity-brand" role="img" aria-label="شعار '+esc(label)+'">'+
  (logo?'<img src="'+esc(logo)+'" alt="" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false">':"")+
  '<span class="aq-entity-brand__fallback"'+(logo?" hidden":"")+'><strong>'+esc(initial)+'</strong><small>الشعار غير متاح</small></span></span>';
}
function session(){return window.LAYAN_SUPABASE?.getSession?.()||null}
async function verifiedSession(){const auth=window.LAYAN_SUPABASE;if(!auth?.requireAuthenticated)throw Error("تعذر تحميل نظام تسجيل الدخول. حدّث الصفحة وحاول مرة أخرى.");return await auth.requireAuthenticated()}
async function api(path,options={}){if(!base||!key)throw Error("إعدادات الاتصال بقاعدة البيانات غير مكتملة.");const s=session();const r=await fetch(base+"/rest/v1/"+path,{...options,headers:{apikey:key,Authorization:"Bearer "+(s?.access_token||key),"Content-Type":"application/json",...(options.headers||{})}});const raw=await r.text();let d=null;try{d=raw?JSON.parse(raw):null}catch(_){}if(!r.ok)throw Error(d?.message||d?.details||"تعذر تنفيذ الطلب.");return d}
let companies=[],directoryEntities=[],existingProfileId=null,existingStatus=null,supportsDraft=false,submissionSaved=false,profileLookupComplete=false,existingProfileSnapshot=null,existingVerifiedAt=null;
const ENTITY_LOGO_ASSETS=Object.freeze({
 "8f9371fc-09a8-4f11-afad-d72a4c2d5edf":"./assets/brand/al-benaa-arabi-star.webp",
 "810cc5ae-2e02-4418-8ee8-c681668723b6":"./assets/brand/diar-asyut-logo-temp.svg"
});
const OFFICIAL_ENTITY_LOGOS=Object.freeze({
 "primedev-eg.com":"https://www.primedev-eg.com/assets/img/logo-prime.png"
});
function officialEntityLogo(website){
 try{const host=new URL(String(website||"")).hostname.toLowerCase().replace(/^www\./,"");return OFFICIAL_ENTITY_LOGOS[host]||""}catch(_){return ""}
}
function entityType(entity){
 const kind=String(entity.entity_type||"");
 const category=String(entity.service_category||"");
 const identity=normalizeName([entity.name_ar,entity.name_en,entity.website_url,entity.description].join(" "));
 // A sales office belonging to a named developer remains in the developer group.
 if(kind==="developer"||category==="real_estate_development"||/تطوير(?:ال)?عقاري|مطور(?:ال)?عقاري|development|developer/.test(identity))return "developers";
 if(["real_estate_marketing","real_estate_brokerage","real_estate_sales"].includes(category))return "marketing";
 const legacyTypes={marketing:"marketing",brokerage:"marketing",sales_office:"marketing"};
 return legacyTypes[kind]||"";
}
function ownerCompanyType(company){
 const category=normalizeName(company.category||"");
 const name=normalizeName(company.company_name||"");
 const description=normalizeName(company.description||"");
 const services=normalizeName((Array.isArray(company.services)?company.services:[]).join(" "));
 const serviceOnly=/مقاولات|تشطيبات|سيراميك|بورسلين|بويات|دهانات|ديكور|اثاث|موبيليا|اضاءه|نجف|ستائر|مفروشات|مطابخ|الوميتال|مكاتبهندسي|مكتب هندسي|تصميممعماري|تصميم معماري|استشارات قانونيه|ادواتصحيه|سباكه|كهرباء|نقل|صيانه|تنظيف|موادبناء|مواد بناء|مستلزماتتشطيب|صيانة|maintenance|contracting|finishing|furniture|lighting/.test(category);
 if(serviceOnly)return "";
 if(/تطوير|مطور|مشروعات|مشروععقاري|تعمير|development|developer/.test(category+" "+name))return "developers";
 if(/تسويق|وساط|سمس|مكتبعقاري|مبيعاتعقاري|marketing|brokerage/.test(category+" "+name))return "marketing";
 if(/تطوير|مطور|مشروعات|تعمير|development|developer/.test(description))return "developers";
 if(/تسويق|وساط|سمس|مبيعاتعقاري|marketing|brokerage/.test(description))return "marketing";
 // Legacy generic company profiles were filed under «شركات عقارية».
 if(/شركاتعقاري|شركهعقاري/.test(category))return "marketing";
 return "";
}
function companyTypeLabel(type){return type==="developers"?"شركات التطوير العقاري":"شركات التسويق والوساطة العقارية";}
function normalizeName(value){
 return String(value||"").normalize("NFKC").toLocaleLowerCase("ar")
  .replace(/[\u064B-\u065F\u0670\u0640]/g,"")
  .replace(/[أإآ]/g,"ا").replace(/ة/g,"ه")
  .replace(/[^\p{L}\p{N}]/gu,"");
}
function card(c,type){
 const logo=safeUrl(c.logo_url);
 const href="./company.html?id="+encodeURIComponent(c.id);
 const services=Array.isArray(c.services)?c.services.slice(0,3):[];
 const label=companyTypeLabel(type);
 return '<article class="company-directory-card company-directory-card--owner"><a href="'+href+'"><div class="company-directory-card-body"><div class="aq-entity-card-head">'+entityBrandMarkup(c.company_name,logo)+'<div class="aq-entity-card-head__content"><span class="company-source-label company-source-label--owner">ملف الشركة</span><div class="company-card-meta"><span>'+esc(label)+'</span><span>'+esc(c.city||"أسيوط")+'</span></div><h3>'+esc(c.company_name)+'</h3></div></div><p>'+esc(c.description||"")+'</p><div class="company-card-meta">'+services.map(esc).join(" · ")+'</div><span class="company-card-open">عرض ملف الشركة ←</span></div></a></article>';
}
function directoryCard(c,type){
 const href="./company.html?entity_id="+encodeURIComponent(c.id);
 const name=String(c.name_ar||c.name_en||"شركة عقارية");
 const logo=safeUrl(c.public_logo_url)||ENTITY_LOGO_ASSETS[c.id]||officialEntityLogo(c.website_url)||"";
 const label=companyTypeLabel(type);
 const description=String(c.description||"تعرّف على الشركة وخدماتها وطرق التواصل معها.");
 const contact=c.public_phone?'<span>'+esc(c.public_phone)+'</span>':"";
 const address=c.public_address?'<span>'+esc(c.public_address)+'</span>':"";
 const services=Array.isArray(c.public_services)?c.public_services.slice(0,3):[];
 return '<article class="company-directory-card company-directory-card--directory"><a href="'+href+'"><div class="company-directory-card-body"><div class="aq-entity-card-head">'+entityBrandMarkup(name,logo)+'<div class="aq-entity-card-head__content"><span class="company-source-label company-source-label--directory">ملف الشركة</span><div class="company-card-meta"><span>'+esc(label)+'</span><span>محافظة أسيوط</span></div><h3>'+esc(name)+'</h3></div></div><p>'+esc(description)+'</p><div class="company-card-meta">'+services.map(esc).join(" · ")+(services.length?' · ':'')+contact+address+'</div><span class="company-card-open">عرض ملف الشركة ←</span></div></a></article>';
}
function renderGroup(type,ownerRows,entityRows,gridElement,countElement,q){
 const owners=ownerRows.filter(c=>!q||normalizeName([c.company_name,c.description,c.city,c.category,...(c.services||[])].join(" ")).includes(q));
 const entities=entityRows.filter(c=>!q||normalizeName([c.name_ar,c.name_en,c.description,c.public_address,c.public_phone,c.public_email,c.website_url,...(c.public_services||[])].join(" ")).includes(q));
 const items=[
  ...owners.map(c=>({name:c.company_name,html:card(c,type)})),
  ...entities.map(c=>({name:c.name_ar||c.name_en,html:directoryCard(c,type)}))
 ].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ar"));
 gridElement.innerHTML=items.length?items.map(x=>x.html).join(""):'<p class="company-directory-state">لا توجد شركات تطابق البحث حاليًا.</p>';
 countElement.textContent=items.length+" ملف";
 return items.length;
}
function render(){
 const q=normalizeName(($("companyDirectorySearch")?.value||"").trim());
 const selected=$("companyCategoryFilter")?.value||"";
 const ownerRows={marketing:[],developers:[]};
 companies.forEach(c=>{const type=ownerCompanyType(c);if(type)ownerRows[type].push(c)});
 const profileKeys=new Set(companies.filter(c=>ownerCompanyType(c)).map(c=>normalizeName(c.company_name)));
 const entityRows={marketing:[],developers:[]};
 directoryEntities.forEach(c=>{
  const type=entityType(c);
  if(!type||c.entity_type==="public_authority")return;
  if(profileKeys.has(normalizeName(c.name_ar))||profileKeys.has(normalizeName(c.name_en)))return;
  entityRows[type].push(c);
 });
 const marketingSection=$("marketingCompaniesSection"),developmentSection=$("developmentCompaniesSection");
 if(marketingSection)marketingSection.hidden=Boolean(selected&&selected!=="marketing");
 if(developmentSection)developmentSection.hidden=Boolean(selected&&selected!=="developers");
 const marketingTotal=renderGroup("marketing",ownerRows.marketing,entityRows.marketing,marketingGrid,marketingCount,q);
 const developmentTotal=renderGroup("developers",ownerRows.developers,entityRows.developers,developmentGrid,developmentCount,q);
 count.textContent=(marketingTotal+developmentTotal)+" ملفًا متاحًا";
}
async function load(){
 const results=await Promise.allSettled([
  api("company_profiles_public?select=id,company_name,category,description,services,city,logo_url&order=company_name.asc"),
  api("directory_entities?select=id,name_ar,name_en,entity_type,service_category,description,website_url,public_phone,public_email,public_address,public_whatsapp,public_logo_url,public_services,public_gallery_urls,public_business_hours,public_coverage_areas,primary_area_id&public_visible=eq.true&verification_status=eq.published&order=name_ar.asc").catch(()=>api("directory_entities?select=id,name_ar,name_en,entity_type,description,website_url,public_phone,public_email,public_address,primary_area_id&public_visible=eq.true&verification_status=eq.published&order=name_ar.asc"))
 ]);
 companies=results[0].status==="fulfilled"?(results[0].value||[]):[];
 directoryEntities=results[1].status==="fulfilled"?(results[1].value||[]):[];
 if(results[0].status==="rejected")console.warn("Approved company profiles unavailable:",results[0].reason);
 if(results[1].status==="rejected")console.warn("Published directory entities unavailable:",results[1].reason);
 if(results.every(x=>x.status==="rejected")){
  grid.innerHTML='<p class="company-directory-state">تعذر تحميل دليل الشركات الآن. حاول تحديث الصفحة لاحقًا.</p>';
  count.textContent="تعذر التحميل";
  return;
 }
 render();
}
async function loadFeaturedCompanyAds(){
 const section=$("companySponsoredAds"),adsGrid=$("companySponsoredAdsGrid");
 if(!section||!adsGrid)return;
 try{
  const rows=await api("public_active_supplier_ads?select=id,business_name,category,title,description,image_url,target_url,contact_phone,created_at,placement_keys,placement_order&order=created_at.desc&limit=100");
  const targeted=(Array.isArray(rows)?rows:[]).filter(ad=>
   Array.isArray(ad.placement_keys)&&ad.placement_keys.includes("company_directory")
  );
  const ordered=window.AsyutSponsoredAd?.sortForPlacement
   ?window.AsyutSponsoredAd.sortForPlacement(targeted,"company_directory")
   :targeted.slice().sort((a,b)=>{
    const ao=Number.isFinite(Number(a.placement_order?.company_directory))?Number(a.placement_order.company_directory):Number.POSITIVE_INFINITY;
    const bo=Number.isFinite(Number(b.placement_order?.company_directory))?Number(b.placement_order.company_directory):Number.POSITIVE_INFINITY;
    return ao-bo||new Date(b.created_at||0)-new Date(a.created_at||0);
   });
  const cards=ordered.map(ad=>window.AsyutSponsoredAd?.render(ad,{className:"company-directory-sponsored-card"})||"").filter(Boolean);
  adsGrid.innerHTML=cards.join("");
  section.hidden=cards.length===0;
 }catch(error){
  section.hidden=true;
  console.warn("Company directory sponsored ads unavailable:",error);
 }
}
async function loadMyProfile(){
 profileLookupComplete=false;existingProfileId=null;existingStatus=null;supportsDraft=false;
 try{await verifiedSession()}catch(_){return false}
 try{
  // The owner RPC returns only the current account's profile and owner-facing review state.
  const c=await api("rpc/layan_company_owner_profile",{method:"POST",body:"{}"});
  if(!c){profileLookupComplete=true;existingProfileSnapshot=null;existingVerifiedAt=null;setRepresentativeProofVisibility(true);return true}
  if(typeof c!=="object"||Array.isArray(c)||!c.id)throw Error("تعذر قراءة بيانات ملف الشركة بصيغة صحيحة.");
  profileLookupComplete=true;existingProfileId=c.id;existingStatus=c.status;existingProfileSnapshot=c;existingVerifiedAt=c.verified_at||null;supportsDraft=Object.prototype.hasOwnProperty.call(c,"pending_update");
  const draft=(supportsDraft&&c.pending_update&&typeof c.pending_update==="object")?c.pending_update:null;const src=draft?{...c,...draft}:c;
  const values={company_name:src.company_name,category:src.category,description:src.description,services:(src.services||[]).join("، "),city:src.city,address:src.address||"",phone:src.phone,whatsapp:src.whatsapp||"",website:src.website||"",logo_url:src.logo_url||"",gallery_urls:(src.gallery_urls||[]).join("\n"),projects:(src.projects||[]).map(p=>(p.title||"")+" — "+(p.description||"")).join("\n"),representative_name:c.representative_name||"",representative_role:c.representative_role||"",evidence_url:c.evidence_url||"",evidence_description:c.evidence_description||""};
  for(const [name,value] of Object.entries(values)){const field=form.elements.namedItem(name);if(field)field.value=value;}
  setRepresentativeProofVisibility(c.status!=="active"&&!c.verified_at);
  const draftStatus=supportsDraft?c.update_status:null;const noteText=draftStatus?c.update_notes:c.admin_notes;const needsChanges=c.status==="needs_changes"||draftStatus==="needs_changes";
  if(needsChanges){status.textContent="طلبت إدارة أسيوط عقار استكمال البيانات التالية قبل النشر: "+(noteText||"يرجى مراجعة بيانات الشركة وإكمال الناقص.")+". بعد التعديل أرسل الطلب للمراجعة من جديد.";}
  else if(draftStatus==="rejected"){status.textContent="رفضت إدارة أسيوط عقار التعديلات الأخيرة: "+(noteText||"لم تُسجَّل ملاحظات")+". ملفك المعتمد السابق ما زال ظاهرًا. يمكنك تعديل البيانات وإعادة الإرسال.";}
  else if(draftStatus==="pending"){status.textContent="تعديلاتك قيد المراجعة. ملفك المعتمد الحالي ما زال ظاهرًا للزوار حتى تعتمد الإدارة التعديلات.";}
  else if(c.status==="pending"){status.textContent="طلب شركتك قيد المراجعة لدى إدارة أسيوط عقار.";}
  else if(c.status==="rejected"){status.textContent="تم رفض طلب شركتك: "+(c.admin_notes||"لم تُسجَّل ملاحظات")+". يمكنك تعديل البيانات وإعادة إرسال الطلب للمراجعة.";}
  else if(c.status==="paused"){status.textContent="ملف شركتك موقوف مؤقتًا من إدارة أسيوط عقار. تواصل مع الإدارة لمعرفة السبب.";}
  else if(c.status==="active"){status.textContent=c.verified_at?"ملف شركتك منشور وممثلها تم التحقق منه. يمكنك تحديث البيانات التشغيلية مباشرة، أما الاسم ووسائل التواصل الأساسية فتحتاج موافقة الإدارة.":"ملف شركتك منشور. يلزم استكمال تحقق الممثل لدى الإدارة قبل تفعيل التحديث المباشر.";}
  $("companyRegisterOpen").textContent=needsChanges?"استكمال البيانات":"تحديث ملف شركتك";$("companyRegisterOpenBottom").textContent=needsChanges?"استكمال بيانات الشركة":"تحديث بيانات الشركة";const submitButton=form.querySelector('button[type="submit"]');if(submitButton)submitButton.textContent=needsChanges?"إرسال البيانات المستكملة":"إرسال الطلب";
  return true;
 }catch(e){status.textContent="تعذر التأكد من وجود ملف شركة سابق. لن نسمح بإنشاء طلب جديد قبل حل المشكلة. "+(e.message||"");console.warn("Company profile lookup:",e);return false}
}

function setRepresentativeProofVisibility(visible){
 const panel=$("companyRepresentativeProof");
 if(panel)panel.hidden=!visible;
 for(const name of ["representative_name","representative_role"]){
  const field=form?.elements.namedItem(name);
  if(field)field.required=Boolean(visible);
 }
}
async function open(){try{await verifiedSession();if(!profileLookupComplete){const ok=await loadMyProfile();if(!ok){dialog.showModal();return}}if(existingProfileId&&existingStatus==="active"&&existingVerifiedAt){window.location.href="./company.html?id="+encodeURIComponent(existingProfileId);return}dialog.showModal()}catch(_){sessionStorage.setItem("layanCompanyRegistrationPending","1");window.location.href="./?company-register=1"}}
$("companyRegisterOpen")?.addEventListener("click",open);if(new URLSearchParams(location.search).get("edit")==="1")setTimeout(open,300);$("companyRegisterOpenBottom")?.addEventListener("click",open);$("companyDialogClose")?.addEventListener("click",()=>dialog.close());dialog?.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});$("companyDirectorySearch")?.addEventListener("input",render);$("companyCategoryFilter")?.addEventListener("change",render);
form?.addEventListener("submit",async e=>{
e.preventDefault();if(!form.reportValidity())return;
try{await verifiedSession()}catch(err){status.textContent=err.message||"سجّل الدخول أولًا ثم أعد المحاولة.";return}
if(!profileLookupComplete){const lookupOk=await loadMyProfile();if(!lookupOk||!profileLookupComplete){status.textContent="لا يمكن إرسال الطلب قبل التأكد من عدم وجود ملف شركة سابق. حدّث الصفحة وحاول مرة أخرى.";return}}
if(existingProfileId&&existingStatus==="paused"){status.textContent="ملف شركتك موقوف مؤقتًا. لا يمكن إرسال تعديلات قبل مراجعة الإدارة.";return}
const d=new FormData(form);const website=safeUrl(d.get("website")),logo=safeUrl(d.get("logo_url"));if(d.get("website")&&!website||d.get("logo_url")&&!logo){status.textContent="تحقق من روابط الموقع والشعار؛ يجب أن تبدأ بـ https:// أو http://.";return}
const gallery=String(d.get("gallery_urls")||"").split(/\n+/).map(x=>x.trim()).filter(Boolean);if(gallery.some(x=>!safeUrl(x))){status.textContent="يوجد رابط صورة غير صحيح في معرض الأعمال.";return}
const projects=String(d.get("projects")||"").split(/\n+/).map(x=>x.trim()).filter(Boolean).map(line=>{const p=line.split("—");return {title:(p.shift()||"عمل سابق").trim(),description:p.join("—").trim()}});
const value=name=>String(d.get(name)||"").trim();
const payload={company_name:value("company_name"),category:value("category"),description:value("description"),services:String(d.get("services")||"").split(/[،,]/).map(x=>x.trim()).filter(Boolean),city:value("city")||"أسيوط",address:value("address")||null,phone:value("phone"),whatsapp:value("whatsapp")||null,website:website||null,logo_url:logo||null,gallery_urls:gallery.map(safeUrl),projects};
const wasExistingProfile=Boolean(existingProfileId);const btn=form.querySelector('button[type="submit"]');btn.disabled=true;status.textContent="جارٍ حفظ بيانات الشركة...";
try{
 if(existingProfileId&&existingStatus==="active"&&existingVerifiedAt){
  const directPayload={description:payload.description,services:payload.services,gallery_urls:payload.gallery_urls,projects:payload.projects};
  await api("rpc/company_profile_update_direct",{method:"POST",body:JSON.stringify({p_company_profile_id:existingProfileId,p_payload:directPayload})});
  const sensitiveKeys=["company_name","category","city","address","phone","whatsapp","website","logo_url"];
  const snapshot=existingProfileSnapshot||{};
  const sensitivePayload={};
  for(const key of sensitiveKeys){
   const next=payload[key]??null;
   const prior=snapshot[key]??null;
   if(String(next??"")!==String(prior??""))sensitivePayload[key]=next;
  }
  if(Object.keys(sensitivePayload).length&&snapshot.update_status!=="pending"){
   await api("rpc/company_profile_sensitive_update_submit",{
    method:"POST",body:JSON.stringify({p_company_profile_id:existingProfileId,p_payload:sensitivePayload})
   });
   status.textContent="تم تحديث الوصف والخدمات والصور والمشروعات مباشرة، وأُرسلت تغييرات الاسم أو التواصل لموافقة الإدارة.";
  }else if(Object.keys(sensitivePayload).length){
   status.textContent="تم تحديث البيانات التشغيلية مباشرة. يوجد تغيير حساس سابق قيد مراجعة الإدارة؛ لم نرسل طلبًا مكررًا.";
  }else{
   status.textContent="تم تحديث البيانات التشغيلية مباشرة وتسجيلها في سجل التغييرات.";
  }
  submissionSaved=true;btn.disabled=true;btn.textContent="تم حفظ التحديثات";existingProfileSnapshot={...snapshot,...directPayload};
 }else{
  const saved=await api("rpc/layan_submit_company_profile",{method:"POST",body:JSON.stringify({p_payload:payload})});
  if(!saved||typeof saved!=="object"||Array.isArray(saved)||!saved.id)throw Error("لم يؤكد النظام حفظ الطلب. حدّث الصفحة وتحقق من حالة ملف الشركة قبل إعادة الإرسال.");
  const representativeName=value("representative_name"),representativeRole=value("representative_role");
  await api("rpc/layan_company_profile_set_representative_details",{
   method:"POST",body:JSON.stringify({
    p_company_profile_id:saved.id,p_representative_name:representativeName,p_representative_role:representativeRole,
    p_evidence_url:value("evidence_url")||null,p_evidence_description:value("evidence_description")||null
   })
  });
  existingProfileId=saved.id;existingStatus=saved.status;existingProfileSnapshot=saved;existingVerifiedAt=saved.verified_at||null;supportsDraft=Object.prototype.hasOwnProperty.call(saved,"pending_update");profileLookupComplete=true;
  submissionSaved=true;btn.disabled=true;btn.textContent="تم إرسال الطلب";
  status.textContent=(wasExistingProfile?"تم استلام تحديث ملف شركتك بنجاح.":"تم إرسال طلب شركتك بنجاح.")+" سيتواصل معك فريق أسيوط عقار لاستكمال التفاصيل.";
 }
}catch(err){status.textContent=err.message||"تعذر إرسال التحديث."}finally{if(!submissionSaved)btn.disabled=false}
});

form?.addEventListener("input",()=>{if(!submissionSaved)return;submissionSaved=false;const btn=form.querySelector('button[type="submit"]');if(btn){btn.disabled=false;btn.textContent="إرسال التعديلات للمراجعة";}status.textContent="تم تعديل البيانات بعد آخر إرسال. أرسل التعديلات مرة أخرى لتصل إلى إدارة أسيوط عقار."});
load();loadFeaturedCompanyAds();loadMyProfile().finally(async()=>{if(new URLSearchParams(location.search).get("resumeCompanyRegistration")==="1"){history.replaceState(null,"",location.pathname);try{await verifiedSession();dialog.showModal()}catch(_){sessionStorage.setItem("layanCompanyRegistrationPending","1");window.location.href="./?company-register=1";}}});
});