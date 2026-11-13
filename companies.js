document.addEventListener("DOMContentLoaded",()=>{"use strict";
const cfg=window.LAYAN_CONFIG||{},base=String(cfg.SUPABASE_URL||"").replace(/\/$/,""),key=cfg.SUPABASE_PUBLISHABLE_KEY||"";
const $=id=>document.getElementById(id),grid=$("companyDirectoryGrid"),count=$("companyDirectoryCount"),dialog=$("companyRegisterDialog"),form=$("companyRegisterForm"),status=$("companyRegisterStatus");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=v=>{try{const u=new URL(String(v||""));return ["https:","http:"].includes(u.protocol)?u.href:""}catch(_){return ""}};
function session(){return window.LAYAN_SUPABASE?.getSession?.()||null}
async function verifiedSession(){const auth=window.LAYAN_SUPABASE;if(!auth?.requireAuthenticated)throw Error("تعذر تحميل نظام تسجيل الدخول. حدّث الصفحة وحاول مرة أخرى.");return await auth.requireAuthenticated()}
async function api(path,options={}){if(!base||!key)throw Error("إعدادات الاتصال بقاعدة البيانات غير مكتملة.");const s=session();const r=await fetch(base+"/rest/v1/"+path,{...options,headers:{apikey:key,Authorization:"Bearer "+(s?.access_token||key),"Content-Type":"application/json",...(options.headers||{})}});const raw=await r.text();let d=null;try{d=raw?JSON.parse(raw):null}catch(_){}if(!r.ok)throw Error(d?.message||d?.details||"تعذر تنفيذ الطلب.");return d}
let companies=[],directoryEntities=[],existingProfileId=null,existingStatus=null,supportsDraft=false,submissionSaved=false,profileLookupComplete=false;
function entityCategory(entity){
 const map={
  developer:"شركات تطوير ومشروعات عقارية",
  marketing:"شركات عقارية",
  brokerage:"شركات عقارية",
  sales_office:"شركات عقارية",
  contractor:"مقاولات وتشطيبات",
  consultant:"استشارات قانونية وعقود عقارية",
  other:"خدمات عقارية أخرى"
 };
 return map[entity.entity_type]||"خدمات عقارية أخرى";
}
function normalizeName(value){
 return String(value||"").normalize("NFKC").toLocaleLowerCase("ar")
  .replace(/[\u064B-\u065F\u0670\u0640]/g,"")
  .replace(/[أإآ]/g,"ا").replace(/ة/g,"ه")
  .replace(/[^\p{L}\p{N}]/gu,"");
}
function card(c){
 const logo=safeUrl(c.logo_url);
 const href="./company.html?id="+encodeURIComponent(c.id);
 const services=Array.isArray(c.services)?c.services.slice(0,3):[];
 return '<article class="company-directory-card company-directory-card--owner"><a href="'+href+'"><div class="company-card-cover">'+(logo?'<img src="'+esc(logo)+'" alt="شعار '+esc(c.company_name)+'" loading="lazy">':esc(c.company_name.slice(0,1)))+'</div><div class="company-directory-card-body"><span class="company-source-label company-source-label--owner">ملف مقدم من الشركة ومعتمد من الإدارة</span><div class="company-card-meta"><span>'+esc(c.category)+'</span><span>'+esc(c.city||"أسيوط")+'</span></div><h3>'+esc(c.company_name)+'</h3><p>'+esc(c.description||"")+'</p><div class="company-card-meta">'+services.map(esc).join(" · ")+'</div><span class="company-card-open">عرض ملف الشركة ←</span></div></a></article>';
}
function directoryCard(c){
 const href="./company.html?entity_id="+encodeURIComponent(c.id);
 const name=String(c.name_ar||c.name_en||"جهة عقارية");
 const category=entityCategory(c);
 const description=String(c.description||"بيانات تعريفية منشورة في الدليل العقاري. راجع المصادر داخل الملف لمعرفة تفاصيل الإدراج.");
 const contact=c.public_phone?'<span>'+esc(c.public_phone)+'</span>':"";
 const address=c.public_address?'<span>'+esc(c.public_address)+'</span>':"";
 return '<article class="company-directory-card company-directory-card--directory"><a href="'+href+'"><div class="company-card-cover company-card-cover--directory"><span>'+esc(name.trim().slice(0,1))+'</span><small>ASYUT AQAR DIRECTORY</small></div><div class="company-directory-card-body"><span class="company-source-label company-source-label--directory">سجل منشور من الدليل العقاري · ليس إعلان شراكة</span><div class="company-card-meta"><span>'+esc(category)+'</span><span>محافظة أسيوط</span></div><h3>'+esc(name)+'</h3><p>'+esc(description)+'</p><div class="company-card-meta">'+contact+address+'</div><span class="company-card-open">عرض البيانات والمصادر وطلب إدارة الملف ←</span></div></a></article>';
}
function render(){
 const q=($( "companyDirectorySearch")?.value||"").trim().toLocaleLowerCase("ar");
 const cat=$("companyCategoryFilter")?.value||"";
 const profileKeys=new Set(companies.map(c=>normalizeName(c.company_name)));
 const profileMatches=companies.filter(c=>(!cat||c.category===cat)&&(!q||[c.company_name,c.description,c.city,c.category,...(c.services||[])].join(" ").toLocaleLowerCase("ar").includes(q)));
 const entityMatches=directoryEntities.filter(c=>{
  if(c.entity_type==="public_authority")return false;
  if(profileKeys.has(normalizeName(c.name_ar))||profileKeys.has(normalizeName(c.name_en)))return false;
  const category=entityCategory(c);
  return (!cat||category===cat)&&(!q||[c.name_ar,c.name_en,c.description,c.public_address,c.public_phone,c.public_email,c.website_url,category].join(" ").toLocaleLowerCase("ar").includes(q));
 });
 const items=[
  ...profileMatches.map(c=>({name:c.company_name,html:card(c)})),
  ...entityMatches.map(c=>({name:c.name_ar||c.name_en,html:directoryCard(c)}))
 ].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ar"));
 grid.innerHTML=items.length?items.map(x=>x.html).join(""):'<p class="company-directory-state">لا توجد شركات أو جهات منشورة تطابق البحث حاليًا.</p>';
 count.textContent=items.length+" ملفًا متاحًا";
}
async function load(){
 const results=await Promise.allSettled([
  api("company_profiles_public?select=id,company_name,category,description,services,city,logo_url&order=company_name.asc"),
  api("directory_entities?select=id,name_ar,name_en,entity_type,description,website_url,public_phone,public_email,public_address,primary_area_id&public_visible=eq.true&verification_status=eq.published&order=name_ar.asc")
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
async function loadMyProfile(){
 profileLookupComplete=false;existingProfileId=null;existingStatus=null;supportsDraft=false;
 try{await verifiedSession()}catch(_){return false}
 try{
  // The owner RPC returns only the current account's profile and owner-facing review state.
  const c=await api("rpc/layan_company_owner_profile",{method:"POST",body:"{}"});
  if(!c){profileLookupComplete=true;return true}
  if(typeof c!=="object"||Array.isArray(c)||!c.id)throw Error("تعذر قراءة بيانات ملف الشركة بصيغة صحيحة.");
  profileLookupComplete=true;existingProfileId=c.id;existingStatus=c.status;supportsDraft=Object.prototype.hasOwnProperty.call(c,"pending_update");
  const draft=(supportsDraft&&c.pending_update&&typeof c.pending_update==="object")?c.pending_update:null;const src=draft?{...c,...draft}:c;
  const values={company_name:src.company_name,category:src.category,description:src.description,services:(src.services||[]).join("، "),city:src.city,address:src.address||"",phone:src.phone,whatsapp:src.whatsapp||"",website:src.website||"",logo_url:src.logo_url||"",gallery_urls:(src.gallery_urls||[]).join("\n"),projects:(src.projects||[]).map(p=>(p.title||"")+" — "+(p.description||"")).join("\n")};
  for(const [name,value] of Object.entries(values)){const field=form.elements.namedItem(name);if(field)field.value=value;}
  const draftStatus=supportsDraft?c.update_status:null;const noteText=draftStatus?c.update_notes:c.admin_notes;const needsChanges=c.status==="needs_changes"||draftStatus==="needs_changes";
  if(needsChanges){status.textContent="طلبت إدارة أسيوط عقار استكمال البيانات التالية قبل النشر: "+(noteText||"يرجى مراجعة بيانات الشركة وإكمال الناقص.")+". بعد التعديل أرسل الطلب للمراجعة من جديد.";}
  else if(draftStatus==="rejected"){status.textContent="رفضت إدارة أسيوط عقار التعديلات الأخيرة: "+(noteText||"لم تُسجَّل ملاحظات")+". ملفك المعتمد السابق ما زال ظاهرًا. يمكنك تعديل البيانات وإعادة الإرسال.";}
  else if(draftStatus==="pending"){status.textContent="تعديلاتك قيد المراجعة. ملفك المعتمد الحالي ما زال ظاهرًا للزوار حتى تعتمد الإدارة التعديلات.";}
  else if(c.status==="pending"){status.textContent="طلب شركتك قيد المراجعة لدى إدارة أسيوط عقار.";}
  else if(c.status==="rejected"){status.textContent="تم رفض طلب شركتك: "+(c.admin_notes||"لم تُسجَّل ملاحظات")+". يمكنك تعديل البيانات وإعادة إرسال الطلب للمراجعة.";}
  else if(c.status==="paused"){status.textContent="ملف شركتك موقوف مؤقتًا من إدارة أسيوط عقار. تواصل مع الإدارة لمعرفة السبب.";}
  else if(c.status==="active"){status.textContent="ملف شركتك منشور حاليًا. أي تعديل ترسله يخضع للمراجعة، وتظل النسخة المعتمدة الحالية ظاهرة حتى تعتمد الإدارة التعديلات.";}
  $("companyRegisterOpen").textContent=needsChanges?"استكمال البيانات":"تحديث ملف شركتك";$("companyRegisterOpenBottom").textContent=needsChanges?"استكمال بيانات الشركة":"تحديث بيانات الشركة";const submitButton=form.querySelector('button[type="submit"]');if(submitButton)submitButton.textContent=needsChanges?"إرسال البيانات المستكملة للمراجعة":"إرسال للمراجعة";
  return true;
 }catch(e){status.textContent="تعذر التأكد من وجود ملف شركة سابق. لن نسمح بإنشاء طلب جديد قبل حل المشكلة. "+(e.message||"");console.warn("Company profile lookup:",e);return false}
}
async function open(){try{await verifiedSession();if(!profileLookupComplete){const ok=await loadMyProfile();if(!ok){dialog.showModal();return}}dialog.showModal()}catch(_){sessionStorage.setItem("layanCompanyRegistrationPending","1");window.location.href="./?company-register=1"}}
$("companyRegisterOpen")?.addEventListener("click",open);if(new URLSearchParams(location.search).get("edit")==="1")setTimeout(open,300);$("companyRegisterOpenBottom")?.addEventListener("click",open);$("companyDialogClose")?.addEventListener("click",()=>dialog.close());dialog?.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});$("companyDirectorySearch")?.addEventListener("input",render);$("companyCategoryFilter")?.addEventListener("change",render);
form?.addEventListener("submit",async e=>{
e.preventDefault();if(!form.reportValidity())return;
try{await verifiedSession()}catch(err){status.textContent=err.message||"سجّل الدخول أولًا ثم أعد المحاولة.";return}
if(!profileLookupComplete){const lookupOk=await loadMyProfile();if(!lookupOk||!profileLookupComplete){status.textContent="لا يمكن إرسال الطلب قبل التأكد من عدم وجود ملف شركة سابق. حدّث الصفحة وحاول مرة أخرى.";return}}
if(existingProfileId&&existingStatus==="paused"){status.textContent="ملف شركتك موقوف مؤقتًا. لا يمكن إرسال تعديلات قبل مراجعة الإدارة.";return}
const d=new FormData(form);const website=safeUrl(d.get("website")),logo=safeUrl(d.get("logo_url"));if(d.get("website")&&!website||d.get("logo_url")&&!logo){status.textContent="تحقق من روابط الموقع والشعار؛ يجب أن تبدأ بـ https:// أو http://.";return}
const gallery=String(d.get("gallery_urls")||"").split(/\n+/).map(x=>x.trim()).filter(Boolean);if(gallery.some(x=>!safeUrl(x))){status.textContent="يوجد رابط صورة غير صحيح في معرض الأعمال.";return}
const projects=String(d.get("projects")||"").split(/\n+/).map(x=>x.trim()).filter(Boolean).map(line=>{const p=line.split("—");return {title:(p.shift()||"عمل سابق").trim(),description:p.join("—").trim()}});
const payload={company_name:String(d.get("company_name")).trim(),category:String(d.get("category")),description:String(d.get("description")).trim(),services:String(d.get("services")||"").split(/[،,]/).map(x=>x.trim()).filter(Boolean),city:String(d.get("city")||"أسيوط").trim(),address:String(d.get("address")||"").trim()||null,phone:String(d.get("phone")).trim(),whatsapp:String(d.get("whatsapp")||"").trim()||null,website:website||null,logo_url:logo||null,gallery_urls:gallery.map(safeUrl),projects};
const wasExistingProfile=Boolean(existingProfileId);const btn=form.querySelector('button[type="submit"]');btn.disabled=true;status.textContent="جارٍ إرسال ملف الشركة للمراجعة...";
try{
 const saved=await api("rpc/layan_submit_company_profile",{method:"POST",body:JSON.stringify({p_payload:payload})});
 if(!saved||typeof saved!=="object"||Array.isArray(saved)||!saved.id)throw Error("لم يؤكد النظام حفظ الطلب. حدّث الصفحة وتحقق من حالة ملف الشركة قبل إعادة الإرسال.");
 const usedDraft=saved.status==="active"&&saved.update_status==="pending";
 existingProfileId=saved.id;existingStatus=saved.status;supportsDraft=Object.prototype.hasOwnProperty.call(saved,"pending_update");profileLookupComplete=true;
 submissionSaved=true;btn.disabled=true;btn.textContent="تم الإرسال للمراجعة";
 const ref=" رقم الطلب: "+saved.id+".";
 status.textContent=(wasExistingProfile?"تم استلام تحديث ملف شركتك بنجاح.":"تم إرسال طلبك بنجاح.")+" طلب الشركة الآن قيد مراجعة إدارة أسيوط عقار، ولن تظهر البيانات الجديدة في الدليل قبل الاعتماد."+(usedDraft?" ملفك المعتمد الحالي يبقى ظاهرًا حتى اعتماد التعديلات.":"")+ref+" احتفظ بهذه الصفحة لمتابعة الطلب.";
}catch(err){status.textContent=err.message||"تعذر إرسال الطلب."}finally{if(!submissionSaved)btn.disabled=false}
});

form?.addEventListener("input",()=>{if(!submissionSaved)return;submissionSaved=false;const btn=form.querySelector('button[type="submit"]');if(btn){btn.disabled=false;btn.textContent="إرسال التعديلات للمراجعة";}status.textContent="تم تعديل البيانات بعد آخر إرسال. أرسل التعديلات مرة أخرى لتصل إلى إدارة أسيوط عقار."});
load();loadMyProfile().finally(async()=>{if(new URLSearchParams(location.search).get("resumeCompanyRegistration")==="1"){history.replaceState(null,"",location.pathname);try{await verifiedSession();dialog.showModal()}catch(_){sessionStorage.setItem("layanCompanyRegistrationPending","1");window.location.href="./?company-register=1";}}});
});