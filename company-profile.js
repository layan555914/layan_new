document.addEventListener("DOMContentLoaded",async()=>{"use strict";const cfg=window.LAYAN_CONFIG||{},base=String(cfg.SUPABASE_URL||"").replace(/\/$/,""),key=cfg.SUPABASE_PUBLISHABLE_KEY||"",root=document.getElementById("companyProfileRoot");const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));const safe=v=>{try{const u=new URL(String(v||""));return ["https:","http:"].includes(u.protocol)?u.href:""}catch(_){return ""}};
const params=new URLSearchParams(location.search),showcaseSlug=params.get("showcase");
if(showcaseSlug){
 try{
  if(!/^[a-z0-9-]{2,100}$/i.test(showcaseSlug))throw Error("رابط ملف الشركة غير صحيح.");
  const response=await fetch("./companies-showcase.json?v=20261113-1",{cache:"no-cache"});
  if(!response.ok)throw Error("تعذر تحميل ملفات الشركات.");
  const data=await response.json();
  const c=(Array.isArray(data.companies)?data.companies:[]).find(item=>item.slug===showcaseSlug);
  if(!c){root.innerHTML='<p class="company-directory-state">ملف الشركة غير متاح حاليًا.</p>';return}
  const phoneList=(Array.isArray(c.phones)?c.phones:(c.phone?[c.phone]:[])).map(value=>String(value||"").replace(/[^+0-9]/g,"")).filter(Boolean);const phone=phoneList[0]||"";
  const website=safe(c.website),map=safe(c.map_url),source=safe(c.source_url);
  const services=Array.isArray(c.services)?c.services:[];
  const adminNumber=String(data.adminWhatsapp||"").replace(/\D/g,"");
  const claimText="مرحبًا، أنا أمثل شركة "+c.name+" وأرغب في طلب إدارة الصفحة التعريفية للشركة على منصة أسيوط عقار. أرجو توضيح خطوات التحقق وتفعيل إدارة الملف.";
  const claimUrl=adminNumber?"https://wa.me/"+adminNumber+"?text="+encodeURIComponent(claimText):"";
  const profileUrl=new URL("./company.html",location.href);profileUrl.searchParams.set("showcase",c.slug);
  document.title=String(c.name||"ملف الشركة")+" | أسيوط عقار";
  document.querySelector('meta[name="description"]')?.setAttribute("content",String(c.description||"ملف تعريفي على منصة أسيوط عقار.").slice(0,155));
  document.querySelector('meta[property="og:title"]')?.setAttribute("content",String(c.name||"ملف الشركة")+" | أسيوط عقار");
  document.querySelector('meta[property="og:description"]')?.setAttribute("content",String(c.description||"تعرف على الشركة ووسائل التواصل المنشورة.").slice(0,155));
  const canonical=document.querySelector('link[rel="canonical"]');if(canonical)canonical.href=profileUrl.href;
  let schema=document.getElementById("companyStructuredData");
  if(!schema){schema=document.createElement("script");schema.id="companyStructuredData";schema.type="application/ld+json";document.head.appendChild(schema);}
  schema.textContent=JSON.stringify({"@context":"https://schema.org","@type":"Organization","name":c.name,"description":c.description||undefined,"url":profileUrl.href,"telephone":c.phone||undefined,"address":c.address?{"@type":"PostalAddress","streetAddress":c.address,"addressLocality":c.city||"أسيوط","addressCountry":"EG"}:{"@type":"PostalAddress","addressLocality":c.city||"أسيوط","addressCountry":"EG"}});
  root.innerHTML=
   '<section class="company-profile-hero company-showcase-profile-hero">'+
    '<div class="company-profile-logo company-showcase-profile-logo"><span>'+esc(c.monogram||String(c.name||"ش").slice(0,2))+'</span></div>'+
    '<div><span class="eyebrow">'+esc(c.kind||c.category||"شركة")+'</span>'+
    '<h1>'+esc(c.name)+'</h1><p>'+esc(c.description||"")+'</p>'+
    '<div class="company-showcase-flags"><span>ملف تعريفي أولي</span><span>متاح مجانًا للتحديث من ممثل الشركة بعد التحقق</span></div>'+
    '<div class="company-contact-actions">'+
     phoneList.map((value,index)=>'<a class="company-contact-primary" href="tel:'+esc(value)+'">'+(index===0?"اتصال ":"رقم إضافي ")+esc(value)+'</a>').join("")+
     (website?'<a class="company-contact-secondary" href="'+esc(website)+'" target="_blank" rel="noopener noreferrer">الموقع الرسمي</a>':"")+
     (map?'<a class="company-contact-secondary" href="'+esc(map)+'" target="_blank" rel="noopener noreferrer">عرض الموقع على الخريطة</a>':"")+
    '</div></div></section>'+
    (services.length?'<section class="company-profile-section"><h2>مجالات العمل</h2><ul class="company-service-list">'+services.map(v=>'<li>'+esc(v)+'</li>').join("")+'</ul></section>':"")+
    '<section class="company-profile-section company-showcase-claim"><h2>هل أنت صاحب الشركة أو ممثلها؟</h2><p>يمكنك طلب استلام وإدارة هذه الصفحة مجانًا. تتواصل مع إدارة أسيوط عقار للتحقق من صفتك، وبعد الموافقة يتم استكمال ربط الملف بحسابك.</p>'+
     (claimUrl?'<a class="company-contact-primary" href="'+esc(claimUrl)+'" target="_blank" rel="noopener noreferrer">أنا ممثل الشركة – اطلب إدارة الصفحة</a>':"")+
    '</section>'+
    '<section class="company-showcase-notice"><strong>ملاحظة مهمة:</strong> '+esc(c.source_note||data.notice||"هذه بطاقة تعريفية أولية.")+' '+esc(data.notice||"الإدراج لا يعني شراكة أو تزكية من أسيوط عقار.")+
     (source?'<p><a href="'+esc(source)+'" target="_blank" rel="noopener noreferrer">عرض مصدر المعلومات ↗</a></p>':"")+
    '</section>';
  return;
 }catch(error){
  root.innerHTML='<p class="company-directory-state">تعذر تحميل الملف التعريفي. حاول تحديث الصفحة لاحقًا.</p>';
  console.warn("Company showcase profile:",error);
  return;
 }
}
const id=new URLSearchParams(location.search).get("id");if(!id||!/^[0-9a-f-]{36}$/i.test(id)){root.innerHTML='<p class="company-directory-state">رابط ملف الشركة غير صحيح.</p>';return}try{const r=await fetch(base+"/rest/v1/company_profiles_public?select=id,company_name,category,description,services,city,logo_url,address,phone,whatsapp,website,gallery_urls,projects&id=eq."+encodeURIComponent(id)+"",{headers:{apikey:key,Authorization:"Bearer "+key}});if(!r.ok)throw Error("تعذر تحميل الملف");const rows=await r.json();const c=rows[0];if(!c){root.innerHTML='<p class="company-directory-state">ملف الشركة غير متاح أو لم يحصل على اعتماد الإدارة بعد.</p>';return}const logo=safe(c.logo_url),phone=String(c.phone||"").replace(/[^+0-9]/g,""),wa=String(c.whatsapp||c.phone||"").replace(/[^+0-9]/g,"");
document.title=String(c.company_name||"ملف الشركة")+" | أسيوط عقار";
const profileUrl=new URL("./company.html",location.href);profileUrl.searchParams.set("id",c.id);
document.querySelector('meta[name="description"]')?.setAttribute("content",String(c.description||"ملف شركة معتمد على منصة أسيوط عقار.").slice(0,155));
document.querySelector('meta[property="og:title"]')?.setAttribute("content",String(c.company_name||"ملف الشركة")+" | أسيوط عقار");
document.querySelector('meta[property="og:description"]')?.setAttribute("content",String(c.description||"تعرف على خدمات الشركة ووسائل الاتصال المباشر.").slice(0,155));
let canonical=document.querySelector('link[rel="canonical"]');if(canonical)canonical.href=profileUrl.href;
let schema=document.getElementById("companyStructuredData");if(!schema){schema=document.createElement("script");schema.id="companyStructuredData";schema.type="application/ld+json";document.head.appendChild(schema);}
schema.textContent=JSON.stringify({"@context":"https://schema.org","@type":"Organization","name":c.company_name,"description":c.description||undefined,"url":profileUrl.href,"telephone":c.phone||undefined,"image":safe(c.logo_url)||undefined,"address":{"@type":"PostalAddress","addressLocality":c.city||"أسيوط","addressCountry":"EG"}});
const gallery=(c.gallery_urls||[]).filter(safe);const projects=Array.isArray(c.projects)?c.projects:[];const services=Array.isArray(c.services)?c.services:[];root.innerHTML='<section class="company-profile-hero"><div class="company-profile-logo">'+(logo?'<img src="'+esc(logo)+'" alt="شعار '+esc(c.company_name)+'">':esc(c.company_name.slice(0,1)))+'</div><div><span class="eyebrow">'+esc(c.category)+'</span><h1>'+esc(c.company_name)+'</h1><p>'+esc(c.description)+'</p><div class="company-card-meta"><span>'+esc(c.city||"أسيوط")+'</span>'+(c.address?'<span>'+esc(c.address)+'</span>':"")+'</div><div class="company-contact-actions">'+(phone?'<a class="company-contact-primary" href="tel:'+esc(phone)+'">اتصال بالشركة</a>':"")+(wa?'<a class="company-contact-secondary" target="_blank" rel="noopener noreferrer" href="https://wa.me/'+esc(wa.replace(/^\+/,""))+'">واتساب</a>':"")+(safe(c.website)?'<a class="company-contact-secondary" target="_blank" rel="noopener noreferrer" href="'+esc(safe(c.website))+'">الموقع الإلكتروني</a>':"")+'</div></div></section>'+(services.length?'<section class="company-profile-section"><h2>الخدمات والتخصصات</h2><ul class="company-service-list">'+services.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul></section>':"")+(projects.length?'<section class="company-profile-section"><h2>المشروعات والأعمال السابقة</h2><div class="company-project-list">'+projects.map(p=>'<article class="company-project"><h3>'+esc(p.title||"عمل سابق")+'</h3><p>'+esc(p.description||"")+'</p></article>').join("")+'</div></section>':"")+(gallery.length?'<section class="company-profile-section"><h2>معرض الأعمال</h2><div class="company-gallery">'+gallery.map((u,i)=>'<img src="'+esc(safe(u))+'" alt="صورة من أعمال '+esc(c.company_name)+' رقم '+(i+1)+'" loading="lazy">').join("")+'</div></section>':"") }catch(e){root.innerHTML='<p class="company-directory-state">حدث خطأ أثناء تحميل ملف الشركة. حاول مرة أخرى لاحقًا.</p>';console.warn(e)}});