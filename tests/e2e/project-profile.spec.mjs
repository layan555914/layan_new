import { test, expect } from "@playwright/test";

const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const project = {
  id:"project-1",slug:"test-palms",name_ar:"مشروع اختبار النخيل",name_en:"Test Palms",
  project_type:"residential",description:"مشروع سكني تجريبي في أسيوط الجديدة مع بيانات مرجعية منشورة.",
  location_text:"أسيوط الجديدة",project_status:"announced",area_id:"area-1",
  size_value:12000,size_unit:"م²",unit_count:null,latitude:null,longitude:null,
  location_public:false,location_source_id:null,last_verified_at:"2026-11-05",
  verification_status:"published",public_visible:true
};
const fixtures = {
  directory_projects:[project],
  directory_areas:[{id:"area-1",name_ar:"أسيوط الجديدة",area_type:"new_city",public_visible:true,verification_status:"published"}],
  directory_project_sources:[{project_id:"project-1",source_id:"source-1"}],
  directory_sources:[{id:"source-1",title:"المصدر الرسمي التجريبي",publisher:"جهة اختبار",source_type:"موقع رسمي",source_url:"https://example.org/source",accessed_at:"2026-11-04",confidence_level:"official",is_public:true}],
  directory_project_entities:[{project_id:"project-1",entity_id:"entity-1",relation_type:"developer"}],
  directory_entities:[{id:"entity-1",name_ar:"شركة اختبار التطوير",entity_type:"developer",description:"جهة مطورة تجريبية",website_url:"https://developer.example",public_phone:"01012345678",public_whatsapp:"01012345678",public_visible:true,verification_status:"published"}]
};

async function mockProjectApi(page, overrides={}) {
  const data={...fixtures,...overrides};
  await page.route(SUPABASE + "/rest/v1/**", async route => {
    const url=new URL(route.request().url());
    const table=url.pathname.split("/").pop();
    let rows=data[table] || [];
    if(table==="directory_projects") {
      const id=url.searchParams.get("id")?.replace(/^eq\./,"");
      const slug=url.searchParams.get("slug")?.replace(/^eq\./,"");
      rows=rows.filter(row=>(!id||row.id===id)&&(!slug||row.slug===slug));
    }
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(rows)});
  });
}

test("project cards open their dedicated profile page", async ({page})=>{
  await mockProjectApi(page);
  await page.goto("/directory.html?view=projects");
  const card=page.locator("#directoryResults .directory-card").filter({hasText:"مشروع اختبار النخيل"});
  await expect(card.locator("a.project-profile-link")).toHaveAttribute("href","./project.html?id=project-1");
  await card.locator("a.project-profile-link").click();
  await expect(page).toHaveURL(/project\.html\?id=project-1/);
  await expect(page.locator("#projectProfileRoot h1")).toHaveText("مشروع اختبار النخيل");
});

test("public project profile renders approved data, sources, related entity and an approximate map", async ({page})=>{
  await mockProjectApi(page);
  await page.goto("/project.html?id=project-1");
  await expect(page.locator("#projectProfileRoot h1")).toHaveText("مشروع اختبار النخيل");
  await expect(page.locator("#projectProfileRoot")).toContainText("معلن عنه");
  await expect(page.locator("#projectProfileRoot")).toContainText("أسيوط الجديدة");
  await expect(page.locator("#projectProfileRoot")).toContainText("12,000 م²");
  await expect(page.locator(".project-source-card a")).toHaveAttribute("href","https://example.org/source");
  await expect(page.locator(".project-entity-card")).toContainText("شركة اختبار التطوير");
  await expect(page.locator(".project-entity-card a[href='./company.html?entity_id=entity-1']")).toBeVisible();
  await expect(page.locator("#projectProfileRoot")).toContainText("ليست دبوسًا جغرافيًا مؤكدًا");
  await expect(page.locator("#projectProfileRoot")).toContainText("لا تعرض هذه الصفحة وحدات");
  await expect(page.locator("#projectProfileRoot a[href='./offers.html']")).toBeVisible();
  const dimensions=await page.evaluate(()=>({clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth+1);
});

test("unpublished or unapproved projects are never rendered even if returned by an API fixture", async ({page})=>{
  await mockProjectApi(page,{directory_projects:[{...project,public_visible:false,verification_status:"needs_review"}]});
  await page.goto("/project.html?id=project-1");
  await expect(page.locator("#projectProfileRoot")).toContainText("المشروع غير متاح للنشر العام");
  await expect(page.locator(".project-source-card")).toHaveCount(0);
  await expect(page.locator(".project-entity-card")).toHaveCount(0);
});

test("project profile escapes untrusted text and rejects unsafe source URLs", async ({page})=>{
  const malicious={...project,name_ar:"<img src=x onerror=alert(1)>",description:"<script>alert(1)</script> بيانات غير موثوقة"};
  await mockProjectApi(page,{
    directory_projects:[malicious],
    directory_sources:[{...fixtures.directory_sources[0],source_url:"javascript:alert(1)"}]
  });
  await page.goto("/project.html?id=project-1");
  await expect(page.locator("#projectProfileRoot img")).toHaveCount(0);
  await expect(page.locator("#projectProfileRoot script")).toHaveCount(0);
  await expect(page.locator("#projectProfileRoot h1")).toContainText("<img");
  await expect(page.locator(".project-source-card a")).toHaveCount(0);
});

test("project profile can be opened by its public slug", async ({page})=>{
  await mockProjectApi(page);
  await page.goto("/project.html?slug=test-palms");
  await expect(page.locator("#projectProfileRoot h1")).toHaveText("مشروع اختبار النخيل");
});
