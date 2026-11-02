import { test, expect } from "@playwright/test";

const SUPABASE = "https://ebyhwqkmhxbgocngpqfe.supabase.co";

const fixtures = {
  directory_entities: [
    { id:"entity-1",name_ar:"شركة اختبار التطوير",entity_type:"developer",description:"مطور عقاري تجريبي",website_url:"https://developer.example",primary_area_id:"area-1",verification_status:"published",public_visible:true },
    { id:"entity-2",name_ar:"هيئة اختبار عامة",entity_type:"public_authority",description:"جهة عامة تجريبية",website_url:"https://authority.example",primary_area_id:"area-1",verification_status:"published",public_visible:true },
    { id:"entity-3",name_ar:"مكتب استشارات تجريبي",entity_type:"consultant",description:"استشارات عقارية",website_url:"",primary_area_id:"area-1",verification_status:"published",public_visible:true }
  ],
  directory_projects: [
    { id:"project-1",name_ar:"مشروع اختبار النخيل",project_type:"residential",description:"مشروع سكني تجريبي",location_text:"أسيوط الجديدة",project_status:"unknown",area_id:"area-1",verification_status:"published",public_visible:true }
  ],
  directory_areas: [
    { id:"area-1",slug:"new-asyut",name_ar:"أسيوط الجديدة",name_en:"New Assiut",area_type:"new_city",parent_id:null,verification_status:"published",public_visible:true,is_active:true }
  ],
  directory_sources: [
    { id:"source-1",title:"المصدر الرسمي التجريبي",publisher:"جهة اختبار",source_type:"مصدر رسمي",source_url:"https://example.org/source",accessed_at:"2026-11-02",is_public:true }
  ],
  directory_opportunities: [
    { id:"opportunity-1",name_ar:"طرح مخازن تجارية بأسيوط الجديدة",city:"أسيوط الجديدة",activity:"مخازن تجارية",size_description:"مساحة تجريبية",terms_as_published:"تفاصيل الطرح التجريبي",announcement_date:"2026-11-01",opportunity_type:"طرح حكومي",source_claimed_status:"معلن",verification_status:"published",public_visible:true }
  ],
  directory_entity_sources:[{entity_id:"entity-1",source_id:"source-1",claim_key:"company"}],
  directory_project_sources:[{project_id:"project-1",source_id:"source-1",claim_key:"project"}],
  directory_opportunity_sources:[{opportunity_id:"opportunity-1",source_id:"source-1",claim_key:"opportunity"}]
};

async function mockDirectoryApi(page) {
  await page.route(SUPABASE + "/rest/v1/**", async route => {
    const url=new URL(route.request().url());
    const table=url.pathname.split("/").pop();
    await route.fulfill({
      status:200,
      contentType:"application/json",
      body:JSON.stringify(fixtures[table]||[])
    });
  });
}

test("directory labels and complete entity classification filter work", async ({page})=>{
  await mockDirectoryApi(page);
  await page.goto("/directory.html");
  await expect(page.locator(".directory-tabs button[data-view='entities']")).toHaveText("الجهات والشركات");
  await expect(page.locator("#directoryResults .directory-card")).toHaveCount(3);
  const options=await page.locator("#directoryTypeFilter option").allTextContents();
  for(const expected of ["مطور عقاري","مطور عقاري","جهة حكومية / عامة","مكتب مبيعات","مقاولات","استشارات عقارية"]) {
    expect(options.join(" ")).toContain(expected);
  }
  await page.locator("#directoryTypeFilter").selectOption("public_authority");
  await expect(page.locator("#directoryResults .directory-card")).toHaveCount(1);
  await expect(page.locator("#directoryResults")).toContainText("هيئة اختبار عامة");
  await page.locator("#directoryTypeFilter").selectOption("consultant");
  await expect(page.locator("#directoryResults .directory-card")).toHaveCount(1);
  await expect(page.locator("#directoryResults")).toContainText("مكتب استشارات تجريبي");
});

test("all five directory tabs search, filter and open sources correctly", async ({page})=>{
  await mockDirectoryApi(page);
  await page.goto("/directory.html");

  await page.locator("[data-view='projects']").click();
  await expect(page.locator("#directoryResults .directory-card")).toHaveCount(1);
  await page.locator("#directoryAreaFilter").selectOption("area-1");
  await expect(page.locator("#directoryResults")).toContainText("مشروع اختبار النخيل");

  await page.locator("[data-view='areas']").click();
  await page.locator("#directorySearch").fill("أسيوط الجديدة");
  await expect(page.locator("#directoryResults .directory-card")).toHaveCount(1);

  await page.locator("#directorySearch").fill("");
  await page.locator("[data-view='opportunities']").click();
  await page.locator("#directorySearch").fill("مخازن تجارية");
  await expect(page.locator("#directoryResults .directory-card")).toHaveCount(1);
  await expect(page.locator("#directoryResults")).toContainText("أسيوط الجديدة");
  await page.locator("#directorySearch").fill("");
  await page.locator("#directoryAreaFilter").selectOption("area-1");
  await expect(page.locator("#directoryResults .directory-card")).toHaveCount(1);

  await page.locator("[data-view='sources']").click();
  await page.locator("#directorySearch").fill("المصدر الرسمي التجريبي");
  await expect(page.locator("#directoryResults .directory-card")).toHaveCount(1);
  await expect(page.locator("#directoryResults a[href='https://example.org/source']")).toBeVisible();
});

test("directory layout has no horizontal overflow on mobile", async ({page})=>{
  await mockDirectoryApi(page);
  await page.goto("/directory.html");
  const dimensions=await page.evaluate(()=>({
    clientWidth:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth+1);
});
