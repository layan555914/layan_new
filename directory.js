(()=>{"use strict";
const $=s=>document.querySelector(s);
const state={data:null,view:"entities",query:"",area:"",type:""};
const labels={
 developer:"مطور عقاري",marketing:"تسويق عقاري",brokerage:"وساطة ومكتب عقاري",
 contractor:"مقاولات",public_authority:"جهة عامة",sales_office:"مكتب مبيعات",
 consultant:"استشارات",other:"جهة أخرى",residential:"سكني",commercial:"تجاري",
 administrative:"إداري",medical:"طبي",educational:"تعليمي",mixed_use:"متعدد الاستخدامات",
 land:"أراضٍ",service:"خدمي",governorate:"محافظة",center:"مركز",city:"مدينة",
 new_city:"مدينة جديدة",district:"حي",neighborhood:"منطقة/حي",zone:"نطاق",
 industrial_zone:"منطقة صناعية",announced:"معلن عنه",planned:"مخطط / معتمد تخطيطيًا",
 under_construction:"تحت التنفيذ وفق المصدر",partially_delivered:"تسليم مرحلي",
 completed:"مكتمل",operating:"يعمل",stalled:"متوقف",unknown:"الحالة غير محددة"
};
const setStatus=m=>{const el=$("#directoryStatus");if(el)el.textContent=m;};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=v=>{try{const u=new URL(v);return["https:","http:"].includes(u.protocol)?u.href:"";}catch(_){return"";}};
async function staticData(){
 const r=await fetch("./directory-public.json",{cache:"no-cache"});
 if(!r.ok)throw Error("static");
 return r.json();
}
async function table(name,query){
 const c=window.LAYAN_CONFIG||{};
 if(!c.SUPABASE_URL||!c.SUPABASE_PUBLISHABLE_KEY)return null;
 try{
  const r=await fetch(c.SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/"+name+"?"+query,{
   headers:{apikey:c.SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+c.SUPABASE_PUBLISHABLE_KEY}
  });
  if(!r.ok)return null;
  const v=await r.json();
  return Array.isArray(v)?v:null;
 }catch(_){return null;}
}
async function refresh(){
 const button=$("#directoryRefresh");
 if(button)button.disabled=true;
 setStatus("جارٍ تحميل السجلات العامة...");
 try{
  const d=await staticData();
  const [e,p,a,s,o,es,ps,os]=await Promise.all([
   table("directory_entities","select=id,name_ar,entity_type,description,website_url,primary_area_id,verification_status,public_visible&public_visible=eq.true&verification_status=eq.published&order=name_ar.asc"),
   table("directory_projects","select=id,name_ar,project_type,description,location_text,project_status,area_id,verification_status,public_visible&public_visible=eq.true&verification_status=eq.published&order=name_ar.asc"),
   table("directory_areas","select=id,slug,name_ar,name_en,area_type,parent_id,verification_status,public_visible,is_active&public_visible=eq.true&verification_status=eq.published&is_active=eq.true&order=name_ar.asc"),
   table("directory_sources","select=id,title,publisher,source_type,source_url,accessed_at,is_public&is_public=eq.true&order=accessed_at.desc"),
   table("directory_opportunities","select=id,name_ar,city,activity,size_description,terms_as_published,announcement_date,opportunity_type,source_claimed_status,verification_status,public_visible&public_visible=eq.true&verification_status=eq.published&order=announcement_date.desc"),
   table("directory_entity_sources","select=entity_id,source_id,claim_key"),
   table("directory_project_sources","select=project_id,source_id,claim_key"),
   table("directory_opportunity_sources","select=opportunity_id,source_id,claim_key")
  ]);
  d.entities=e??d.entities??[];
  d.projects=p??d.projects??[];
  d.areas=a??d.areas??[];
  d.sources=s??d.sources??[];
  d.opportunities=o??d.opportunities??[];
  d.entitySources=es??d.entitySources??[];
  d.projectSources=ps??d.projectSources??[];
  d.opportunitySources=os??d.opportunitySources??[];
  state.data=d;
  stats();
  areaOptions();
  render();
 }catch(_){
  setStatus("تعذر تحميل الدليل. أعد المحاولة لاحقًا.");
 }finally{
  if(button)button.disabled=false;
 }
}
function stats(){
 const c=state.data.researchCounts||{};
 $("#statEntities").textContent=c.entities??0;
 $("#statProjects").textContent=c.projects??0;
 $("#statAreas").textContent=c.areas??state.data.areas.length;
 $("#statSources").textContent=c.sources??state.data.sources.length;
}
function areaOptions(){
 const select=$("#directoryAreaFilter"),selected=select.value;
 select.innerHTML="";
 const first=document.createElement("option");
 first.value="";first.textContent="كل مناطق أسيوط";select.append(first);
 state.data.areas.forEach(a=>{
  const option=document.createElement("option");
  option.value=String(a.id||a.slug||a.name_ar);
  option.textContent=a.name_ar;
  select.append(option);
 });
 if([...select.options].some(o=>o.value===selected))select.value=selected;
}
function searchableText(x){
 return [
  x.name_ar,x.name_en,x.title,x.description,x.publisher,x.source_type,x.source_url,
  x.location_text,x.area_name,x.city,x.activity,x.terms_as_published,x.size_description,
  x.source_claimed_status,x.website_url
 ].filter(Boolean).join(" ").toLocaleLowerCase("ar");
}
function matches(x,kind){
 const q=state.query.trim().toLocaleLowerCase("ar");
 const hay=searchableText(x);
 if(q&&!hay.includes(q))return false;
 if(state.area){
  const area=state.data.areas.find(a=>String(a.id||a.slug||a.name_ar)===state.area);
  const name=area?.name_ar||"";
  if(kind==="areas"){
   if(String(x.id||x.slug||x.name_ar)!==state.area&&!hay.includes(name))return false;
  }else if(kind!=="sources"){
   const linkedArea=String(x.area_id||x.primary_area_id||"");
   if(linkedArea!==state.area&&x.area_name!==name&&(!name||!hay.includes(name)))return false;
  }
 }
 if(state.type&&kind==="entities"&&x.entity_type!==state.type)return false;
 return true;
}
function linkedSources(id,kind){
 const links=kind==="entities"?(state.data.entitySources||[]):kind==="projects"?(state.data.projectSources||[]):(state.data.opportunitySources||[]);
 const key=kind==="entities"?"entity_id":kind==="projects"?"project_id":"opportunity_id";
 const ids=links.filter(x=>String(x[key])===String(id)).map(x=>String(x.source_id));
 return state.data.sources.filter(s=>ids.includes(String(s.id))).map(s=>{
  const u=safeUrl(s.source_url);
  return u?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title||s.publisher||"مصدر")+'</a>':"";
 }).filter(Boolean).join(" · ");
}
function card(title,desc,tag,detail,url,refs,recordId){
 const u=safeUrl(url);
 const recordKey=recordId==null?"":String(recordId);
 const shareUrl=recordKey?new URL("#directory-record-"+encodeURIComponent(recordKey),location.href).href:"";
 return '<article class="directory-card"'+(recordKey?' id="directory-record-'+esc(encodeURIComponent(recordKey))+'" data-share-url="'+esc(shareUrl)+'"':"")+'><div class="directory-card-meta">'+(tag?'<span class="directory-tag">'+esc(tag)+'</span>':"")+'</div><h3>'+esc(title)+'</h3>'+(desc?'<p>'+esc(desc)+'</p>':"")+(detail?'<small>'+esc(detail)+'</small>':"")+(u?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">زيارة الموقع الرسمي ↗</a>':"")+(refs?'<div class="directory-linked-sources"><strong>مراجع السجل:</strong> '+refs+'</div>':"")+'</article>';
}
function setFilterAvailability(){
 $("#directoryTypeFilter").disabled=state.view!=="entities";
 $("#directoryAreaFilter").disabled=state.view==="sources";
}
function render(){
 if(!state.data)return;
 const areaNames=new Map(state.data.areas.map(a=>[String(a.id||a.slug||a.name_ar),a.name_ar]));
 let rows=[],out="";
 if(state.view==="entities"){
  rows=state.data.entities.filter(x=>matches(x,"entities"));
  out=rows.map(x=>card(x.name_ar,x.description,labels[x.entity_type]||x.entity_type,areaNames.get(String(x.primary_area_id))||x.area_name||"معلومات عامة منشورة",x.website_url,linkedSources(x.id,"entities"),x.id)).join("");
 }else if(state.view==="projects"){
  rows=state.data.projects.filter(x=>matches(x,"projects"));
  out=rows.map(x=>card(x.name_ar,x.description,labels[x.project_type]||x.project_type,[x.location_text,labels[x.project_status]].filter(Boolean).join(" · "),null,linkedSources(x.id,"projects"),x.id)).join("");
 }else if(state.view==="areas"){
  rows=state.data.areas.filter(x=>matches(x,"areas"));
  out=rows.map(x=>card(x.name_ar,x.name_en,labels[x.area_type]||"نطاق جغرافي","قاعدة المناطق الجغرافية للمحافظة",null,null,x.id)).join("");
 }else if(state.view==="opportunities"){
  rows=(state.data.opportunities||[]).filter(x=>matches(x,"opportunities"));
  out=rows.map(x=>card(x.name_ar,x.activity,x.opportunity_type||"طرح حكومي",[x.city,x.size_description,x.terms_as_published,x.announcement_date,x.source_claimed_status].filter(Boolean).join(" · "),null,linkedSources(x.id,"opportunities"),x.id)).join("");
 }else{
  rows=state.data.sources.filter(x=>matches(x,"sources"));
  out=rows.map(x=>card(x.title,x.publisher,x.source_type||"مصدر عام",x.id||"مرجع عام",x.source_url,null,x.id)).join("");
 }
 $("#directoryResults").innerHTML=out;
 const sharedRecord=decodeURIComponent(location.hash.slice(1));
 if(sharedRecord.startsWith("directory-record-")){
  requestAnimationFrame(()=>document.getElementById(sharedRecord)?.scrollIntoView({behavior:"smooth",block:"center"}));
 }
 $("#directoryEmpty").hidden=rows.length>0;
 setFilterAvailability();
 if(rows.length===0){
  const messages={
   entities:"لا توجد جهات أو شركات منشورة للعامة حاليًا؛ البيانات الأولية محفوظة للمراجعة الداخلية فقط.",
   projects:"لا توجد مشروعات منشورة للعامة حاليًا؛ لن تظهر المشروعات قبل مراجعة مصادرها واعتمادها.",
   areas:"لا توجد مناطق مطابقة للبحث الحالي.",
   opportunities:"لا توجد طروحات منشورة للعامة حاليًا؛ السجلات المؤرشفة لا تعني توافر الفرص حاليًا.",
   sources:"لا توجد مصادر مطابقة للبحث الحالي."
  };
  setStatus(messages[state.view]||"لا توجد نتائج.");
 }else{
  setStatus("عدد النتائج: "+rows.length+" · السجلات المعروضة منشورة ومعتمدة فقط.");
 }
}
document.querySelectorAll(".directory-tabs button").forEach(b=>b.addEventListener("click",()=>{
 document.querySelectorAll(".directory-tabs button").forEach(t=>{
  const on=t===b;t.classList.toggle("is-active",on);t.setAttribute("aria-selected",String(on));
 });
 state.view=b.dataset.view;
 render();
}));
$("#directorySearch").addEventListener("input",e=>{state.query=e.target.value;render();});
$("#directoryAreaFilter").addEventListener("change",e=>{state.area=e.target.value;render();});
$("#directoryTypeFilter").addEventListener("change",e=>{state.type=e.target.value;render();});
$("#directoryRefresh").addEventListener("click",refresh);
refresh();
})();