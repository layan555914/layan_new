(() => {
"use strict";
const config=window.LAYAN_CONFIG||{};
const SUPABASE_URL=String(config.SUPABASE_URL||"").replace(/\/$/,"");
const SUPABASE_KEY=config.SUPABASE_PUBLISHABLE_KEY||"";
const auth=()=>window.LAYAN_SUPABASE||null;
const $=id=>document.getElementById(id);
const authDialog=$("authDialog"),listingDialog=$("marketplaceListingDialog");
const authForm=$("authForm"),listingForm=$("marketplaceListingForm");
const authStatus=$("authStatus"),listingStatus=$("marketplaceFormStatus");
const categoryFilter=$("marketplaceCategoryFilter"),listingGrid=$("marketplaceListings");
let authMode="login",currentSession=null,listings=[],shouldOpenListingAfterAuth=false,marketplacePage=1;const MARKETPLACE_PER_PAGE=12;
let categories=["سوق العقارات","التنازلات العقارية","أراضي للبيع","أراضي التنازلات","إيجار يومي ومفروش","الشركات والمكاتب العقارية","مواد البناء والتشطيب","الأثاث والفرش وتجهيز الوحدات","المشروعات والمطورون العقاريون","الصيانة وإدارة العقارات","الاستشارات والخدمات العقارية","مكاتب التصميم الهندسي","مهندسو الديكور والتصميم الداخلي","السيراميك والبورسلين والأدوات الصحية","الإضاءة ووحدات الإنارة","الستائر والمفروشات"];
const specs={
"سوق العقارات":[["نوع العقار","property_kind","select","شقة|فيلا|محل تجاري|مكتب|عيادة|مخزن|مبنى"],["الغرض","purpose","select","بيع|إيجار"],["المساحة بالمتر","area_m2","number"],["عدد الغرف","bedrooms","number"],["عدد الحمامات","bathrooms","number"],["التشطيب","finishing","text"]],
"التنازلات العقارية":[["اسم المطور","developer","text"],["اسم المشروع","project","text"],["المقدم المطلوب","required_down_payment","number"],["المبلغ المدفوع","paid_amount","number"],["المتبقي","remaining_amount","number"],["القسط الشهري","monthly_installment","number"],["رسوم التنازل","assignment_fee","number"],["الخصم المتاح","discount","number"]],
"أراضي للبيع":[["نوع الأرض","land_kind","select","سكنية|تجارية|زراعية"],["المساحة بالمتر","land_area","number"],["جهة الولاية","authority","text"],["حالة المرافق","utilities","text"],["اشتراطات البناء","building_rules","text"]],
"أراضي التنازلات":[["جهة التخصيص","authority","text"],["نوع التعاقد","contract_type","text"],["المساحة بالمتر","land_area","number"],["المدفوع","paid_amount","number"],["المتبقي","remaining_amount","number"],["شروط التنازل","assignment_terms","text"]],
"إيجار يومي ومفروش":[["نوع الإقامة","stay_type","select","يومي|أسبوعي|شهري"],["عدد الأفراد","guests","number"],["عدد الغرف","bedrooms","number"],["التأمين","deposit","number"],["التجهيزات","amenities","text"],["التوافر","availability","text"]],
"الشركات والمكاتب العقارية":[["اسم النشاط","business_name","text"],["صفة المعلن","advertiser_role","select","شركة|مكتب عقاري|وسيط|مسوق"],["الخدمات","services","text"],["العنوان","business_address","text"]],
"مواد البناء والتشطيب":[["نوع المنتج أو الخدمة","supply_kind","text"],["الوحدة","unit","text"],["الحد الأدنى للطلب","minimum_order","text"],["التوصيل","delivery","text"]],
"الأثاث والفرش وتجهيز الوحدات":[["نوع الأثاث","furniture_kind","text"],["الحالة","condition","select","جديد|مستعمل بحالة جيدة|حسب الطلب"],["التوصيل والتركيب","delivery_installation","text"]],
"المشروعات والمطورون العقاريون":[["اسم المشروع","project_name","text"],["اسم المطور","developer","text"],["نوع المشروع","project_kind","text"],["موقف التنفيذ","construction_status","text"],["أنظمة السداد","payment_plans","text"]],
"الصيانة وإدارة العقارات":[["نوع الخدمة","service_kind","text"],["نطاق التغطية","coverage","text"],["مواعيد العمل","working_hours","text"],["الضمان","warranty","text"]],
"الاستشارات والخدمات العقارية":[["نوع الاستشارة","consultation_kind","text"],["مقدم الخدمة","provider","text"],["طريقة تقديم الخدمة","delivery_method","text"],["التخصص أو المؤهل","qualification","text"]],
"مكاتب التصميم الهندسي":[["نوع التصميم","design_kind","select","معماري|إنشائي|كهرباء|ميكانيكا|تخطيط عمراني"],["خدمات المكتب","engineering_services","text"],["الإشراف الهندسي","supervision","text"],["التراخيص والدراسات","permits_studies","text"]],
"مهندسو الديكور والتصميم الداخلي":[["نوع المشروع","interior_project","select","شقة|فيلا|محل تجاري|مكتب|عيادة"],["خدمات التصميم","interior_services","text"],["التصميم المتاح","design_deliverables","select","2D|3D|2D و3D"],["التنفيذ والتشطيب","fitout_execution","text"]],
"السيراميك والبورسلين والأدوات الصحية":[["نوع المنتج","ceramic_product_kind","select","سيراميك أرضيات|سيراميك حوائط|بورسلين|أطقم حمامات|أحواض|خلاطات|أدوات صحية"],["العلامات التجارية","ceramic_brands","text"],["المقاسات والموديلات","ceramic_sizes_models","text"],["التوصيل والتركيب","ceramic_delivery_installation","text"]],
"الإضاءة ووحدات الإنارة":[["نوع الإضاءة","lighting_kind","select","نجف|أباليك|إضاءة مخفية|سبوتات|إضاءة خارجية|وحدات حديثة"],["الطراز","lighting_style","select","مودرن|كلاسيك|نيو كلاسيك|متنوع"],["التصميم والتوريد","lighting_design_supply","text"],["التركيب","lighting_installation","text"]],
"الستائر والمفروشات":[["نوع الخدمة","curtain_service_kind","select","تفصيل ستائر|ستائر جاهزة|أقمشة|مفروشات|تنجيد"],["نوع الخامات","curtain_fabrics","text"],["التفصيل حسب المقاس","custom_curtains","select","متاح|غير متاح|حسب الطلب"],["المعاينة والتركيب","curtain_measure_install","text"]]
};
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function readSession(){return auth()?.getSession?.()||null}
function saveSession(session){currentSession=session||null;updateAuthButton()}
function updateAuthButton(){const btn=$("authOpen");if(!btn)return;const email=currentSession?.user?.email;btn.textContent=email?"تسجيل الخروج":"تسجيل الدخول";btn.title=email?"مسجّل الدخول باسم "+email+" — اضغط لتسجيل الخروج":"تسجيل الدخول أو إنشاء حساب"}
async function getSession(){const service=auth();if(!service)return null;const stored=service.getSession?.();if(!stored?.access_token)return null;try{const verified=await service.requireAuthenticated();saveSession(verified);return verified}catch(_){saveSession(null);return null}}
async function api(path,options={}){const session=await getSession();const headers={"apikey":SUPABASE_KEY,"Authorization":"Bearer "+(session?.access_token||SUPABASE_KEY),"Content-Type":"application/json","Accept":"application/json",...(options.headers||{})};if(options.method==="POST")headers.Prefer="return=representation";const response=await fetch(SUPABASE_URL+"/rest/v1/"+path,{...options,headers});const raw=await response.text();let data=null;try{data=raw?JSON.parse(raw):null}catch(_){}if(!response.ok){const message=data?.message||data?.details||data?.hint||"تعذر الاتصال بقاعدة البيانات.";throw Error(message)}return data}
function setAuthMode(mode){if(mode==="signup"){/* signup needs account type, name and phone: use the main signup form */window.location.href="./?auth=signup";return}authMode=mode;const signup=mode==="signup";$("authTitle").textContent=signup?"إنشاء حساب جديد":"تسجيل الدخول";$("authSubmit").textContent=signup?"إنشاء الحساب":"دخول";$("switchAuth").textContent=signup?"لديك حساب بالفعل؟ تسجيل الدخول":"إنشاء حساب جديد";$("forgotPassword").hidden=signup;authForm.elements.password.autocomplete=signup?"new-password":"current-password";authStatus.textContent=""}
function openAuth(){authStatus.textContent="";setAuthMode("login");authDialog.showModal()}
async function compressImage(file){if(!/^image\//.test(file.type||"")&&!/\.(jpe?g|png|heic|heif|webp)$/i.test(file.name||""))throw Error("اختر صورة (JPG أو PNG أو HEIC).");if(file.size>15*1024*1024)throw Error("حجم كل صورة يجب ألا يتجاوز 15 ميجابايت.");const bitmap=await createImageBitmap(file);const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();if(typeof window.LAYAN_WATERMARK==="function")window.LAYAN_WATERMARK(ctx,canvas.width,canvas.height);const data=canvas.toDataURL("image/jpeg",.68);if(data.length>380000)throw Error("إحدى الصور كبيرة بعد الضغط؛ اختر صورة أصغر.");return data}
async function loadCategories(){
 try{
  let rows=await api("marketplace_categories?select=name,description,display_order&is_active=eq.true&order=display_order.asc");
  const requiredCategories=["مكاتب التصميم الهندسي","مهندسو الديكور والتصميم الداخلي","السيراميك والبورسلين والأدوات الصحية","الإضاءة ووحدات الإنارة","الستائر والمفروشات"];
  if(!Array.isArray(rows)||!requiredCategories.every(name=>rows.some(row=>row.name===name)))throw Error("قائمة أقسام سوق الخدمات غير مكتملة.");
  categories=rows.map(row=>row.name);
  // The services marketplace lists services only; property categories are handled on offers.html.
  const propertyCategories=["سوق العقارات","التنازلات العقارية","أراضي للبيع","أراضي التنازلات","إيجار يومي ومفروش"];
  rows=rows.filter(row=>!propertyCategories.includes(row.name));
  const directory=document.querySelector(".category-grid");
  if(directory)directory.innerHTML=rows.map((row,index)=>'<button class="category-tile" type="button" data-market-category="'+esc(row.name)+'"><strong>'+String(index+1).padStart(2,"0")+' · '+esc(row.name)+'</strong><span>'+esc(row.description)+'</span></button>').join("");
  [categoryFilter,listingForm.elements.category].forEach(select=>{
   if(!select)return;
   const current=select.value;
   const first=select.options[0];
   select.innerHTML="";
   if(first)select.appendChild(first);
   rows.forEach(row=>{const option=document.createElement("option");option.value=row.name;option.textContent=row.name;select.appendChild(option)});
   if(categories.includes(current))select.value=current;
  });
 }catch(error){console.warn("تعذر تحميل أقسام قاعدة البيانات؛ تم الاحتفاظ بالقائمة الاحتياطية.",error)}
}
function renderCategoryFields(){const category=listingForm.elements.category.value;const target=$("marketplaceCategoryFields");const fields=specs[category]||[];if(!fields.length){target.innerHTML='<p class="muted">اختر القسم لإظهار التفاصيل المناسبة.</p>';return}target.innerHTML="<h3>تفاصيل خاصة بالقسم</h3>"+fields.map(([label,name,type,options])=>{let control;if(type==="select")control='<select name="detail_'+name+'"><option value="">اختر</option>'+options.split("|").map(v=>"<option>"+esc(v)+"</option>").join("")+"</select>";else control='<input name="detail_'+name+'" type="'+type+'" '+(type==="number"?'min="0" step="0.01"':'maxlength="240"')+'>';return "<label>"+esc(label)+control+"</label>"}).join("")}
// Services-only marketplace (reference design): property categories live on offers.html.
const SERVICE_CATEGORIES=["الشركات والمكاتب العقارية","مواد البناء والتشطيب","الأثاث والفرش وتجهيز الوحدات","المشروعات والمطورون العقاريون","الصيانة وإدارة العقارات","الاستشارات والخدمات العقارية","مكاتب التصميم الهندسي","مهندسو الديكور والتصميم الداخلي","السيراميك والبورسلين والأدوات الصحية","الإضاءة ووحدات الإنارة","الستائر والمفروشات"];
const egPhone=v=>{let d=String(v||"").replace(/[^0-9]/g,"");if(d.startsWith("20"))d=d.slice(2);if(d&&!d.startsWith("0"))d="0"+d;return /^01[0125][0-9]{8}$/.test(d)?d:""};
const normText=v=>String(v||"").toLowerCase().replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه");

const SERVICE_PROFILE_CATEGORY_CODES={
 "الشركات والمكاتب العقارية":["real_estate_marketing","real_estate_brokerage","real_estate_sales","real_estate_development"],
 "مواد البناء والتشطيب":["contracting_construction","building_materials"],
 "الأثاث والفرش وتجهيز الوحدات":["furniture_furnishings"],
 "المشروعات والمطورون العقاريون":["real_estate_development"],
 "الصيانة وإدارة العقارات":["maintenance_property_management"],
 "الاستشارات والخدمات العقارية":["real_estate_consultancy","other_real_estate_services"],
 "مكاتب التصميم الهندسي":["engineering_design"],
 "مهندسو الديكور والتصميم الداخلي":["finishing_decoration"],
 "السيراميك والبورسلين والأدوات الصحية":[],
 "الإضاءة ووحدات الإنارة":[],
 "الستائر والمفروشات":[]
};
const SERVICE_PROFILE_LABELS={
 contracting_construction:"مقاولات وإنشاءات",real_estate_marketing:"تسويق عقاري",
 real_estate_brokerage:"وساطة ومكتب عقاري",building_materials:"مواد بناء وتشطيب",
 finishing_decoration:"تصميم داخلي وديكور",furniture_furnishings:"أثاث وفرش وتجهيز وحدات",
 engineering_design:"مكاتب التصميم الهندسي والاستشارات المعمارية",maintenance_property_management:"صيانة وإدارة عقارات",
 real_estate_consultancy:"استشارات عقارية",real_estate_development:"تطوير ومشروعات عقارية",
 real_estate_sales:"مبيعات عقارية",other_real_estate_services:"خدمات عقارية مساندة"
};
const SERVICE_PROFILE_ALLOWED_CODES=new Set(Object.values(SERVICE_PROFILE_CATEGORY_CODES).flat());
// Curated real-estate companies already present in the company directory.
// They are referenced by directory entity ID; no duplicate marketplace listing is created.
const FEATURED_REAL_ESTATE_COMPANY_IDS=new Set([
 "f853fb29-c535-4abf-b5c2-8b58e7bc1d7a", // Home Town Developments — West Gardens, Assiut
 "9a04337c-2b6d-4403-90c8-10cf9c7ebc94", // Madinet Masr — Zahw, West Assiut
 "be32e9e6-5d57-48d7-af81-42462c1647f4", // Amer Group / Porto Assiut
 "2d4d4044-4540-4c2d-8ee4-0d73b77ae5b4", // Tayel Group / Vuvuzela — Hayah City
 "2700ddd4-93aa-4247-b36c-9c078148518e", // Mabany Edris — Asayla, New Assiut
 "fb8b1c41-93f3-4484-8695-9fa44b5a2a95", // Venecia Developments — Assiut New City
 "37c12e5b-eb95-48fc-b43d-7d1ba7a52bed", // Global House — Konoz projects, Assiut
 "c232159a-66fd-432d-9468-1c7ffabb3fb9", // RDF Developments — Paradise, New Assiut
 "83a687c0-eee6-497b-89d9-9fba70d4474f", // Prime Developments — Assiut sales office
 "c1111111-1111-4111-8111-111111111301"  // Test-only synthetic developer fixture
]);
const REAL_ESTATE_COMPANY_CODES=new Set(["real_estate_development","real_estate_sales"]);
let serviceProfiles=[];
function serviceProfileCode(item){
 const legacy={contractor:"contracting_construction",marketing:"real_estate_marketing",brokerage:"real_estate_brokerage",consultant:"real_estate_consultancy",developer:"real_estate_development",sales_office:"real_estate_sales"};
 return item.service_category||legacy[item.entity_type]||"";
}
function renderServiceProfiles(){
 const target=$("marketplaceServiceProfiles");
 const count=$("marketplaceServiceProfilesCount");
 if(!target)return;
 const selected=categoryFilter.value;
 const query=normText($("marketplaceSearch")?.value||"").trim();
 const allowed=selected?SERVICE_PROFILE_CATEGORY_CODES[selected]||[]:null;
 const rows=serviceProfiles.filter(item=>{
  const code=serviceProfileCode(item);
  const isRealEstateCompany=item.entity_type==="developer"||item.entity_type==="sales_office"||REAL_ESTATE_COMPANY_CODES.has(code);
  const isCuratedCompany=FEATURED_REAL_ESTATE_COMPANY_IDS.has(item.id);
  const companyCategoryVisible=!selected||selected==="الشركات والمكاتب العقارية"||selected==="المشروعات والمطورون العقاريون";
  const marketplaceCategory=String(item.marketplace_category||"");
  const categoryVisible=isRealEstateCompany
   ? isCuratedCompany&&companyCategoryVisible
   : marketplaceCategory
     ? (!selected||marketplaceCategory===selected)
     : SERVICE_PROFILE_ALLOWED_CODES.has(code)&&(!allowed||allowed.includes(code));
  const searchable=normText([item.name_ar,item.name_en,item.description,code,marketplaceCategory,item.public_address,(item.public_services||[]).join(" ")].join(" "));
  return categoryVisible&&(!query||searchable.includes(query));
 }).sort((a,b)=>Number(FEATURED_REAL_ESTATE_COMPANY_IDS.has(b.id))-Number(FEATURED_REAL_ESTATE_COMPANY_IDS.has(a.id)));
 if(count)count.textContent=rows.length+" ملف";
 if(!rows.length){
  target.innerHTML='<div class="mk-profile-status">لا توجد ملفات تعريفية منشورة في هذا المجال حتى الآن. يمكنك استكشاف <a href="./companies.html">دليل الشركات</a>.</div>';
  return;
 }
 target.innerHTML=rows.map(item=>{
  const name=String(item.name_ar||item.name_en||"جهة خدمية");
  const rawLogo=String(item.public_logo_url||"");
  const logo=rawLogo.startsWith("https://")||rawLogo.startsWith("http://")?rawLogo:"";
  const category=String(item.marketplace_category||SERVICE_PROFILE_LABELS[serviceProfileCode(item)]||"خدمات عقارية");
  const isCuratedCompany=FEATURED_REAL_ESTATE_COMPANY_IDS.has(item.id);
  const profileLabel=isCuratedCompany
   ? (item.entity_type==="sales_office"?"مكتب مبيعات عقاري من دليل الشركات":"شركة عقارية مختارة من دليل أسيوط عقار")
   : "ملف تعريفي مجاني · "+category;
  const services=Array.isArray(item.public_services)?item.public_services:[];
  const summary=String(item.description||services.slice(0,3).join("، ")||"ملف تعريفي منشور في دليل أسيوط عقار.").slice(0,120);
  const place=String(item.public_address||"محافظة أسيوط");
  const href="./company.html?entity_id="+encodeURIComponent(item.id);
  const visual=logo?'<img src="'+esc(logo)+'" alt="شعار '+esc(name)+'" loading="lazy">':esc(name.trim().slice(0,1));
  return '<a class="mk-profile-card" href="'+href+'"><span class="mk-profile-logo">'+visual+'</span><span class="mk-profile-content"><small>'+esc(profileLabel)+' · '+esc(category)+'</small><strong>'+esc(name)+'</strong><span>'+esc(summary)+'</span><span>⌖ '+esc(place)+'</span></span></a>';
 }).join("");
}
async function loadServiceProfiles(){
 const target=$("marketplaceServiceProfiles");
 if(!target)return;
 const extended="directory_entities?select=id,name_ar,name_en,entity_type,service_category,marketplace_category,description,public_address,public_logo_url,public_services&public_visible=eq.true&verification_status=eq.published&service_category=not.is.null&order=name_ar.asc&limit=150";
 const core="directory_entities?select=id,name_ar,name_en,entity_type,service_category,marketplace_category,description,public_address&public_visible=eq.true&verification_status=eq.published&service_category=not.is.null&order=name_ar.asc&limit=150";
 try{
  let rows;
  try{rows=await api(extended)}catch(_){rows=await api(core)}
  if(!Array.isArray(rows))throw new Error("استجابة ملفات مقدمي الخدمات غير صالحة.");
  serviceProfiles=rows;
  renderServiceProfiles();
 }catch(error){
  serviceProfiles=[];
  if($("marketplaceServiceProfilesCount"))$("marketplaceServiceProfilesCount").textContent="تعذر التحميل";
  target.innerHTML='<div class="mk-profile-status">تعذر تحميل الملفات التعريفية المعتمدة. لم نعرض سجلات غير مصنفة بدلًا منها. تظل إعلانات الخدمات المنشورة أدناه متاحة.</div>';
  console.warn("Service provider profiles unavailable:",error);
 }
}

function renderListings(){
 const selected=categoryFilter.value;
 const query=normText($("marketplaceSearch")?.value||"").trim();
 const city=$("marketplaceCityFilter")?.value||"";
 const rows=listings.filter(item=>SERVICE_CATEGORIES.includes(item.category)&&(!selected||item.category===selected)&&(!city||item.city===city||item.area===city)&&(!query||normText([item.title,item.description,item.category,item.area,item.city,Object.values(item.details||{}).join(" ")].join(" ")).includes(query)));
 const pages=Math.max(1,Math.ceil(rows.length/MARKETPLACE_PER_PAGE));
 marketplacePage=Math.min(Math.max(1,marketplacePage),pages);
 const pageRows=rows.slice((marketplacePage-1)*MARKETPLACE_PER_PAGE,marketplacePage*MARKETPLACE_PER_PAGE);
 $("marketplaceCount").textContent=rows.length+(rows.length===1?" مقدم خدمة":" مقدمي خدمات");
 const pager=$("marketplacePagination");
 if(pager){pager.hidden=rows.length<=MARKETPLACE_PER_PAGE;pager.innerHTML=pager.hidden?"":'<button type="button" data-market-page="prev" '+(marketplacePage===1?"disabled":"")+'>السابق</button><span>صفحة '+marketplacePage+' من '+pages+'</span><button type="button" data-market-page="next" '+(marketplacePage===pages?"disabled":"")+'>التالي</button>';}
 if(!rows.length){listingGrid.innerHTML='<div class="mk-empty"><h3>لا توجد خدمات معتمدة بهذه الاختيارات حاليًا</h3><p>غيّر القسم أو المدينة، أو أضف خدمتك مجانًا لتظهر هنا بعد مراجعة الإدارة.</p></div>';return;}
 listingGrid.innerHTML=pageRows.map(item=>{
  const image=Array.isArray(item.image_urls)?item.image_urls.find(v=>typeof v==="string"&&(v.startsWith("data:image/")||v.startsWith("https://"))):"";
  const phone=egPhone(item.contact_phone);
  const wa=egPhone(item.whatsapp)||phone;
  const summary=String(item.details?.services||item.details?.specialty||item.listing_type||"").trim();
  const desc=String(item.description||"").split(/[.\n،]/)[0].slice(0,90);
  const id=encodeURIComponent(String(item.id));
  return '<article class="mk-card" id="marketplace-listing-'+id+'" data-share-url="'+esc(new URL("#marketplace-listing-"+id,window.location.href).href)+'">'+
   '<div class="mk-card-media">'+(image?'<img src="'+esc(image)+'" alt="'+esc(item.title)+'" loading="lazy">':'<div class="mk-card-placeholder" aria-hidden="true">'+esc(item.category.split(" ")[0])+'</div>')+'<span class="mk-card-label">'+(item.is_featured?'<strong class="mk-featured-label">★ إعلان مميز</strong> · ':'')+esc(item.category)+'</span></div>'+
   '<div class="mk-card-body"><h3>'+esc(item.title)+'</h3><p class="mk-card-desc">'+esc(summary&&summary!=="خدمة"?summary:desc)+'</p><p class="mk-card-place"><span aria-hidden="true">⌖</span>'+esc(item.area||item.city||"أسيوط")+'</p>'+
   '<div class="mk-card-actions">'+(phone?'<a class="mk-btn mk-call" href="tel:'+phone+'" data-contact="call"><span aria-hidden="true">✆</span> اتصال</a>':'')+(wa?'<a class="mk-btn mk-wa" href="https://wa.me/2'+wa+'?text='+encodeURIComponent("مرحبًا، رأيت إعلانك «"+String(item.title||"")+"» على أسيوط عقار.")+'" target="_blank" rel="noopener noreferrer" data-contact="whatsapp"><span aria-hidden="true">◉</span> واتساب</a>':'')+'<button type="button" class="mk-btn mk-more" data-market-details="'+esc(item.id)+'"><span aria-hidden="true">ⓘ</span> التفاصيل</button></div></div></article>';
 }).join("");
 const sharedListingId = decodeURIComponent(window.location.hash.slice(1));
 if (sharedListingId.startsWith("marketplace-listing-")) {
  window.requestAnimationFrame(() => document.getElementById(sharedListingId)?.scrollIntoView({behavior:"smooth",block:"center"}));
 }
}
function openServiceDetails(id){
 const item=listings.find(x=>String(x.id)===String(id));if(!item)return;
 let dialog=$("mkDetailsDialog");
 if(!dialog){dialog=document.createElement("dialog");dialog.id="mkDetailsDialog";dialog.className="mk-details-dialog";document.body.appendChild(dialog);dialog.addEventListener("click",e=>{if(e.target===dialog||e.target.closest("[data-close-mk]"))dialog.close()})}
 const details=Object.entries(item.details||{}).filter(([,v])=>String(v??"").trim()).map(([k,v])=>'<li><span>'+esc(k.replace(/_/g," "))+'</span><b>'+esc(v)+'</b></li>').join("");
 const price=item.price!==null&&item.price!==undefined?Number(item.price).toLocaleString("en-US")+" ج.م"+(item.price_period?" "+esc(item.price_period):""):"السعر عند التواصل";
 const phone=egPhone(item.contact_phone),wa=egPhone(item.whatsapp)||phone;
 const images=(Array.isArray(item.image_urls)?item.image_urls:[]).filter(v=>typeof v==="string"&&(v.startsWith("data:image/")||v.startsWith("https://"))).slice(0,5);
 dialog.innerHTML='<div class="mk-details"><button type="button" class="mk-details-close" data-close-mk aria-label="إغلاق">×</button>'+(images.length?'<div class="mk-details-gallery">'+images.map(src=>'<div class="mk-card-media"><img src="'+esc(src)+'" alt=""></div>').join("")+'</div>':'')+
  '<span class="mk-card-label is-static">'+esc(item.category)+'</span><h2>'+esc(item.title)+'</h2><p class="mk-card-place"><span aria-hidden="true">⌖</span>'+esc([item.city,item.area].filter(Boolean).join("، "))+'</p><p>'+esc(item.description||"")+'</p><p class="mk-details-price">'+price+'</p>'+(details?'<ul class="mk-details-list">'+details+'</ul>':'')+
  (item.latitude!=null&&item.longitude!=null?'<p><a href="https://www.google.com/maps?q='+encodeURIComponent(Number(item.latitude)+","+Number(item.longitude))+'" target="_blank" rel="noopener noreferrer">عرض الموقع على الخريطة</a></p>':'')+
  '<div class="mk-card-actions">'+(phone?'<a class="mk-btn mk-call" href="tel:'+phone+'" data-contact="call">✆ اتصال</a>':'')+(wa?'<a class="mk-btn mk-wa" href="https://wa.me/2'+wa+'" target="_blank" rel="noopener noreferrer" data-contact="whatsapp">◉ واتساب</a>':'')+'</div></div>';
 dialog.showModal();
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-market-details]");if(b)openServiceDetails(b.dataset.marketDetails)});
async function loadListings(){listingGrid.innerHTML='<p class="muted">جارٍ تحميل الإعلانات...</p>';try{listings=await api("marketplace_listings?select=id,category,listing_type,title,description,city,area,price,price_period,contact_phone,whatsapp,image_urls,details,latitude,longitude,created_at,is_featured&status=eq.approved&order=is_featured.desc,created_at.desc&limit=100")||[];renderListings()}catch(error){listingGrid.innerHTML='<p class="muted">تعذر تحميل الإعلانات: '+esc(error.message)+'</p>';$("marketplaceCount").textContent="تعذر التحميل";console.error("Marketplace load error:",error)}}
function openListing(){if(!currentSession?.user?.id){shouldOpenListingAfterAuth=true;openAuth();authStatus.textContent="سجّل الدخول أولًا حتى تتمكن من إرسال إعلان.";return}shouldOpenListingAfterAuth=false;listingStatus.textContent="";listingDialog.showModal()}
async function submitListing(event){event.preventDefault();listingStatus.textContent="جارٍ تجهيز الإعلان وإرساله للمراجعة...";const session=await getSession();if(!session?.user?.id){listingStatus.textContent="انتهت جلسة الدخول. سجّل الدخول ثم أعد المحاولة.";openAuth();return}const formData=new FormData(listingForm);const latitudeText=String(formData.get("latitude")||"").trim(),longitudeText=String(formData.get("longitude")||"").trim();if(Boolean(latitudeText)!==Boolean(longitudeText)){listingStatus.textContent="أدخل خط العرض والطول معًا، أو اترك الاثنين فارغين.";return}const latitude=latitudeText?Number(latitudeText):null,longitude=longitudeText?Number(longitudeText):null;if(latitudeText&&(!Number.isFinite(latitude)||latitude < -90||latitude > 90||!Number.isFinite(longitude)||longitude < -180||longitude > 180)){listingStatus.textContent="إحداثيات الموقع غير صحيحة.";return}const files=Array.from(listingForm.elements.images.files||[]);if(files.length>5){listingStatus.textContent="يمكن إضافة 5 صور كحد أقصى.";return}let imageUrls=[];try{for(const file of files)imageUrls.push(await compressImage(file))}catch(error){listingStatus.textContent=error.message;return}const priceText=String(formData.get("price")||"").trim();const details=Object.fromEntries(Array.from(listingForm.querySelectorAll("[name^=detail_]")).map(el=>[el.name.slice(7),String(el.value||"").trim()]).filter(([,value])=>value));const payload={owner_id:session.user.id,latitude,longitude,category:String(formData.get("category")),listing_type:String(formData.get("listing_type")||"خدمة"),title:String(formData.get("title")||"").trim(),description:String(formData.get("description")||"").trim(),city:String(formData.get("city")||"أسيوط").trim(),area:String(formData.get("area")||"").trim()||null,property_type:String(formData.get("property_type")||"").trim()||null,price:priceText?Number(priceText):null,price_period:String(formData.get("price_period")||"").trim()||null,contact_phone:String(formData.get("contact_phone")||"").trim(),whatsapp:String(formData.get("whatsapp")||"").trim()||null,image_urls:imageUrls,details,status:"pending"};try{await api("marketplace_listings",{method:"POST",body:JSON.stringify(payload)});listingStatus.textContent="تم استلام إعلانك وإرساله للمراجعة. سيظهر بعد اعتماد الإدارة.";listingForm.reset();renderCategoryFields();setTimeout(()=>listingDialog.close(),1400)}catch(error){listingStatus.textContent="لم يتم إرسال الإعلان: "+error.message;console.error("Marketplace insert error:",error)}}
async function init(){currentSession=readSession();updateAuthButton();if(currentSession)await getSession();updateAuthButton();await loadCategories();const requested=new URLSearchParams(location.search).get("category");if(requested&&categories.includes(requested)){categoryFilter.value=requested;listingForm.elements.category.value=requested}renderCategoryFields();await Promise.all([loadListings(),loadServiceProfiles()])}
$("authOpen").addEventListener("click",async()=>{if(currentSession?.user?.id){if(confirm("هل تريد تسجيل الخروج؟")){try{await auth()?.signOut?.()}catch(error){authStatus.textContent=error.message||"تعذر تسجيل الخروج.";return}saveSession(null)}return}shouldOpenListingAfterAuth=false;openAuth()});
$("switchAuth").addEventListener("click",()=>setAuthMode(authMode==="login"?"signup":"login"));
$("forgotPassword").addEventListener("click",async()=>{const email=authForm.elements.email.value.trim();if(!email){authStatus.textContent="اكتب بريدك الإلكتروني أولًا ثم اضغط نسيت كلمة المرور.";return}authStatus.textContent="جارٍ إرسال رابط استعادة كلمة المرور...";try{await auth()?.resetPasswordForEmail?.(email);authStatus.textContent="إذا كان البريد مسجلًا، سيصلك رابط استعادة كلمة المرور."}catch(error){authStatus.textContent=error.message||"تعذر إرسال رابط الاستعادة."}});
authForm.addEventListener("submit",async event=>{event.preventDefault();const email=authForm.elements.email.value.trim();const password=authForm.elements.password.value;authStatus.textContent="جارٍ التحقق...";const submit=$("authSubmit");submit.disabled=true;try{const service=auth();if(!service)throw Error("تعذر تحميل خدمة تسجيل الدخول. حدّث الصفحة وحاول مرة أخرى.");if(authMode==="signup"){const result=await service.signUp(email,password);if(result?.session?.access_token){saveSession(service.getSession?.()||result.session);authDialog.close();if(shouldOpenListingAfterAuth){listingStatus.textContent="تم إنشاء الحساب وتسجيل الدخول. يمكنك الآن إرسال إعلانك.";listingDialog.showModal()}}else{authStatus.textContent="تم إنشاء طلب الحساب. افتح رسالة تأكيد البريد الإلكتروني ثم سجّل الدخول."}}else{await service.signIn(email,password);currentSession=await getSession();if(!currentSession?.user?.id)throw Error("لم يتم التحقق من جلسة الدخول. حاول مرة أخرى.");saveSession(currentSession);authDialog.close();if(shouldOpenListingAfterAuth){listingStatus.textContent="تم تسجيل الدخول. يمكنك الآن إرسال إعلانك.";listingDialog.showModal()}}shouldOpenListingAfterAuth=false}catch(error){authStatus.textContent=error.message||"تعذر تسجيل الدخول."}finally{submit.disabled=false}});
$("openListingForm").addEventListener("click",openListing);$("heroAdd").addEventListener("click",openListing);
document.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>$(button.dataset.close).close()));
listingForm.elements.category.addEventListener("change",renderCategoryFields);
document.querySelector(".category-grid")?.addEventListener("click",event=>{const button=event.target.closest("[data-market-category]");if(!button)return;categoryFilter.value=button.dataset.marketCategory;renderListings();renderServiceProfiles();document.querySelector(".marketplace-page")?.scrollIntoView({behavior:"smooth"})});
categoryFilter.addEventListener("change",()=>{marketplacePage=1;document.querySelectorAll("[data-mk-chip]").forEach(b=>b.classList.toggle("is-active",b.dataset.mkChip===categoryFilter.value));renderListings();renderServiceProfiles()});
$("marketplacePagination")?.addEventListener("click",event=>{const b=event.target.closest("[data-market-page]");if(!b||b.disabled)return;marketplacePage+=b.dataset.marketPage==="next"?1:-1;renderListings();document.querySelector("#marketplaceListings")?.scrollIntoView({behavior:"smooth",block:"start"});});listingForm.addEventListener("submit",submitListing);
[authDialog,listingDialog].forEach(dialog=>dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close()}));
window.addEventListener("layan-auth-callback",async event=>{
 if(event.detail?.success){
  currentSession=await getSession();
  updateAuthButton();
  authStatus.textContent=currentSession?.user?.id?"تم تأكيد البريد وتسجيل الدخول بنجاح.":"تم تأكيد البريد؛ سجّل الدخول للمتابعة.";
 }else if(event.detail?.message){
  authStatus.textContent="تعذر إكمال تأكيد البريد. افتح أحدث رابط وصل إلى بريدك أو سجّل الدخول بعد التأكيد.";
 }
});
// Search, city and category chips for the services marketplace.
$("marketplaceSearch")?.addEventListener("input",()=>{marketplacePage=1;renderListings();renderServiceProfiles()});
$("marketplaceCityFilter")?.addEventListener("change",()=>{marketplacePage=1;renderListings()});
document.querySelectorAll("[data-mk-chip]").forEach(chip=>chip.addEventListener("click",()=>{categoryFilter.value=chip.dataset.mkChip;categoryFilter.dispatchEvent(new Event("change"))}));

// "?add=1" (from the main add-listing chooser) opens the add-service form directly.
if(new URLSearchParams(location.search).get("add")==="1")setTimeout(()=>$("heroAdd")?.click(),300);
init();
})();
