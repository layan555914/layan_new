document.addEventListener("DOMContentLoaded",()=>{"use strict";
const cfg=window.LAYAN_CONFIG||{},base=String(cfg.SUPABASE_URL||"").replace(/\/$/,""),key=cfg.SUPABASE_PUBLISHABLE_KEY||"";
const $=id=>document.getElementById(id),grid=$("marketplaceListings"),count=$("marketplaceCount"),filter=$("marketplaceCategoryFilter"),dialog=$("marketplaceListingDialog"),form=$("marketplaceListingForm"),status=$("marketplaceFormStatus");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=v=>{try{const u=new URL(String(v||""));return ["https:","http:"].includes(u.protocol)?u.href:""}catch(_){return ""}};
const session=()=>window.LAYAN_SUPABASE?.getSession?.()||null;

const categoryFields=$("marketplaceCategoryFields");
const categorySpecs={
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
"الاستشارات والخدمات العقارية":[["نوع الاستشارة","consultation_kind","text"],["مقدم الخدمة","provider","text"],["طريقة تقديم الخدمة","delivery_method","text"],["التخصص أو المؤهل","qualification","text"]]
};
function renderCategoryFields(){
 const category=form?.querySelector('[name="category"]')?.value||"";
 const specs=categorySpecs[category]||[];
 if(!categoryFields)return;
 if(!specs.length){categoryFields.innerHTML='<p>اختر القسم لإظهار البيانات المناسبة لنوع إعلانك.</p>';return;}
 const fields=specs.map(function(spec){
  const label=spec[0],name=spec[1],type=spec[2],opts=spec[3]||"";
  let control="";
  if(type==="select"){
   control='<select name="detail_'+name+'"><option value="">اختر</option>'+opts.split("|").map(v=>'<option>'+esc(v)+'</option>').join("")+'</select>';
  }else{
   control='<input name="detail_'+name+'" type="'+type+'" '+(type==="number"?'min="0" step="0.01"':'maxlength="240"')+'>';
  }
  return '<label>'+label+control+'</label>';
 }).join("");
 categoryFields.innerHTML='<h3>تفاصيل خاصة بالقسم</h3>'+fields;
}
form?.querySelector('[name="category"]')?.addEventListener("change",renderCategoryFields);
document.querySelectorAll("[data-market-category]").forEach(tile=>tile.addEventListener("click",()=>{filter.value=tile.dataset.marketCategory;render();document.querySelector(".marketplace-page-listings")?.scrollIntoView({behavior:"smooth"});}));

async function api(path,options={}){if(!base||!key)throw Error("إعدادات قاعدة البيانات غير مكتملة.");const s=session();const r=await fetch(base+"/rest/v1/"+path,{...options,headers:{apikey:key,Authorization:"Bearer "+(s?.access_token||key),"Content-Type":"application/json",...(options.method==="POST"?{Prefer:"return=representation"}:{}),...(options.headers||{})}});const raw=await r.text();let d=null;try{d=raw?JSON.parse(raw):null}catch(_){}if(!r.ok)throw Error(d?.message||d?.details||"تعذر تنفيذ الطلب.");return d}
let rows=[];
function render(){const category=filter.value;const found=rows.filter(x=>!category||x.category===category);count.textContent=found.length+" إعلان معتمد";grid.innerHTML=found.length?found.map(x=>{const image=safeUrl(x.image_urls?.[0]);const phone=String(x.whatsapp||x.contact_phone||"").replace(/[^+0-9]/g,"");const price=x.price!==null&&x.price!==undefined?Number(x.price).toLocaleString("ar-EG")+" جنيه"+(x.price_period?" "+esc(x.price_period):""):"السعر عند التواصل";return '<article class="marketplace-listing-card">'+(image?'<img src="'+esc(image)+'" alt="'+esc(x.title)+'" loading="lazy">':'')+'<div class="marketplace-listing-body"><small>'+esc(x.category)+' · '+esc(x.listing_type)+'</small><h3>'+esc(x.title)+'</h3><p>'+esc(x.description)+'</p><div class="marketplace-listing-meta"><span>'+esc(x.city)+(x.area?" · "+esc(x.area):"")+'</span><strong>'+price+'</strong></div>'+(phone?'<p><a class="btn btn-gold" href="https://wa.me/'+esc(phone.replace(/^\+/,""))+'" target="_blank" rel="noopener noreferrer">تواصل عبر واتساب</a></p>':"")+'</div></article>'}).join(""):'<p class="company-directory-state">لا توجد إعلانات معتمدة في هذا القسم حاليًا. يمكنك إرسال إعلانك مجانًا ليُراجع قبل النشر.</p>'}
async function load(){try{rows=await api("marketplace_listings?select=id,category,listing_type,title,description,city,area,price,price_period,contact_phone,whatsapp,image_urls,created_at&status=eq.approved&order=is_featured.desc,created_at.desc&limit=60")||[];render()}catch(e){grid.innerHTML='<p>تعذر تحميل الإعلانات حاليًا. حاول مرة أخرى لاحقًا.</p>';count.textContent="تعذر التحميل";console.warn(e)}}
function open(){if(!session()?.user?.id){status.textContent="لإرسال إعلان، سجّل الدخول أولًا من الصفحة الرئيسية ثم ارجع إلى سوق الخدمات.";dialog.showModal();return}dialog.showModal()}
$("openListingForm")?.addEventListener("click",open);$("closeListingForm")?.addEventListener("click",()=>dialog.close());dialog?.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});filter?.addEventListener("change",render);
form?.addEventListener("submit",async e=>{e.preventDefault();status.textContent="جارٍ إرسال الإعلان للمراجعة...";const s=session();if(!s?.user?.id){status.textContent="سجّل الدخول من الصفحة الرئيسية أولًا، ثم أعد المحاولة.";return}const f=new FormData(form);const price=String(f.get("price")||"").trim();const imageFiles=Array.from(form.querySelector('[name="images"]')?.files||[]);if(imageFiles.length>6){status.textContent="يمكن رفع 6 صور كحد أقصى للإعلان الواحد.";return}if(imageFiles.some(file=>file.type!=="image/jpeg"||file.size>5*1024*1024)){status.textContent="ارفع صور JPG/JPEG فقط، بحد أقصى 5 ميجابايت للصورة.";return}let uploadedImages=[];if(imageFiles.length){if(typeof window.LAYAN_SUPABASE?.uploadImages!=="function"){status.textContent="رفع الصور غير متاح حاليًا.";return}try{uploadedImages=await window.LAYAN_SUPABASE.uploadImages(imageFiles)}catch(uploadError){status.textContent=uploadError.message||"تعذر رفع الصور.";return}}const payload={owner_id:s.user.id,category:f.get("category"),listing_type:f.get("listing_type"),title:String(f.get("title")||"").trim(),description:String(f.get("description")||"").trim(),city:String(f.get("city")||"أسيوط").trim(),area:String(f.get("area")||"").trim()||null,property_type:String(f.get("property_type")||"").trim()||null,price:price?Number(price):null,price_period:String(f.get("price_period")||"").trim()||null,contact_phone:String(f.get("contact_phone")||"").trim(),whatsapp:String(f.get("whatsapp")||"").trim()||null,image_urls:uploadedImages,details:Object.fromEntries(Array.from(form.querySelectorAll("[name^=detail_]")).map(el=>[el.name.slice(7),String(el.value||"").trim()]).filter(([,v])=>v)),status:"pending"};try{await api("marketplace_listings",{method:"POST",body:JSON.stringify(payload)});status.textContent="تم استلام إعلانك وإرساله للمراجعة. سيظهر للزوار بعد اعتماده من الإدارة.";form.reset();dialog.close();alert("تم إرسال الإعلان للمراجعة بنجاح.");}catch(err){if(uploadedImages.length&&typeof window.LAYAN_SUPABASE?.deleteUploadedImages==="function"){try{await window.LAYAN_SUPABASE.deleteUploadedImages(uploadedImages)}catch(cleanupError){console.warn("تعذر تنظيف الصور المرفوعة بعد فشل الإعلان",cleanupError)}}status.textContent=err.message||"تعذر إرسال الإعلان. تأكد من تسجيل الدخول وحاول مرة أخرى."}});
renderCategoryFields();load();
});