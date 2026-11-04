import { test, expect } from "@playwright/test";

const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";

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


test("directory map searches the selected published area without inventing a location pin", async ({page})=>{
  await mockDirectoryApi(page);
  await page.goto("/directory.html");
  await page.locator("#directoryMapArea").selectOption("area-1");
  const query=encodeURIComponent("أسيوط الجديدة, Assiut, Egypt");
  await expect(page.locator("#directoryMapFrame")).toHaveAttribute(
    "src",
    "https://maps.google.com/maps?q="+query+"&output=embed"
  );
  await expect(page.locator("#directoryMapOpen")).toHaveAttribute(
    "href",
    "https://www.google.com/maps/search/?api=1&query="+query
  );
  await expect(page.locator("#directoryMapNote")).toContainText("بحثًا استرشاديًا");
  await expect(page.locator("#directoryMapNote")).toContainText("ليس دبوسًا جغرافيًا معتمدًا");
  await page.locator("#directoryMapArea").selectOption("");
  await expect(page.locator("#directoryMapOpen")).toContainText("نطاق أسيوط");
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


const adminFixtures = () => ({
  directory_entities: [{
    id:"entity-admin-1",name_ar:"شركة أسيوط التجريبية",name_en:"Assiut Test Company",
    entity_type:"developer",description:"مطور تجريبي",website_url:"https://developer.example",
    public_phone:null,public_email:null,public_address:null,primary_area_id:"area-admin-1",
    verification_status:"needs_review",public_visible:false,last_verified_at:null,next_review_at:null
  }],
  directory_projects: [{
    id:"project-admin-1",name_ar:"مشروع اختبار أسيوط",name_en:"Assiut Test Project",
    project_type:"residential",description:"مشروع تجريبي",location_text:"أسيوط الجديدة",
    project_status:"unknown",area_id:"area-admin-1",verification_status:"draft",public_visible:false
  }],
  directory_areas: [{
    id:"area-admin-1",name_ar:"أسيوط الجديدة",name_en:"New Assiut",slug:"new-assiut",
    area_type:"new_city",parent_id:null,description:"منطقة اختبار",is_active:true,
    verification_status:"published",public_visible:true,notes:null
  }],
  directory_opportunities: [],
  directory_sources: [],
  directory_entity_private: [],
  directory_project_private: [],
  directory_entity_sources: [],
  directory_project_sources: [],
  directory_opportunity_sources: [],
  directory_change_log: []
});

async function mockDirectoryAdmin(page, { isAdmin = true } = {}) {
  const db = adminFixtures();
  await page.route(SUPABASE + "/auth/v1/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/token")) {
      await route.fulfill({
        status:200,contentType:"application/json",
        body:JSON.stringify({
          access_token:"admin-test-token",refresh_token:"admin-test-refresh",
          token_type:"bearer",expires_in:3600,
          user:{id:"admin-user-1",email:"admin@example.test"}
        })
      });
      return;
    }
    await route.fulfill({status:200,contentType:"application/json",body:"{}"});
  });

  await page.route(SUPABASE + "/rest/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split("/").pop();
    const method = request.method();
    if (table === "layan_is_admin") {
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(isAdmin)});
      return;
    }
    if (method === "GET") {
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(db[table] || [])});
      return;
    }
    const body = request.postDataJSON() || {};
    if (method === "POST" && table === "directory_sources") {
      const row = {id:"source-admin-1",accessed_at:"2026-11-03T08:00:00Z",...body};
      db.directory_sources.push(row);
      await route.fulfill({status:201,contentType:"application/json",body:JSON.stringify([row])});
      return;
    }
    if (method === "POST" && table === "directory_entity_sources") {
      db.directory_entity_sources.push(body);
      await route.fulfill({status:201,contentType:"application/json",body:JSON.stringify([body])});
      return;
    }
    if (method === "POST" && table === "directory_change_log") {
      const row = {id:"change-" + (db.directory_change_log.length + 1),created_at:new Date().toISOString(),...body};
      db.directory_change_log.unshift(row);
      await route.fulfill({status:201,contentType:"application/json",body:JSON.stringify([row])});
      return;
    }
    if (method === "PATCH") {
      const id = url.searchParams.get("id")?.replace(/^eq\./, "");
      const row = (db[table] || []).find(item => item.id === id);
      if (!row) {
        await route.fulfill({status:200,contentType:"application/json",body:"[]"});
        return;
      }
      Object.assign(row, body);
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify([row])});
      return;
    }
    await route.fulfill({status:200,contentType:"application/json",body:"[]"});
  });
  return db;
}

test("directory admin blocks an authenticated account without the admin role", async ({page}) => {
  await mockDirectoryAdmin(page,{isAdmin:false});
  await page.goto("/directory-admin.html");
  await page.locator("#dirAdminEmail").fill("member@example.test");
  await page.locator("#dirAdminPassword").fill("not-a-real-password");
  await page.locator("#dirAdminLogin button[type=submit]").click();
  await expect(page.locator("#dirAdminLoginPanel")).toBeVisible();
  await expect(page.locator("#dirAdminPanel")).toBeHidden();
  await expect(page.locator("#dirAdminStatus")).toContainText("غير مخوّل");
});

test("directory admin reviews, sources, publication and audit history", async ({page}) => {
  const db = await mockDirectoryAdmin(page,{isAdmin:true});
  await page.goto("/directory-admin.html");
  await page.locator("#dirAdminEmail").fill("admin@example.test");
  await page.locator("#dirAdminPassword").fill("admin-test-password");
  await page.locator("#dirAdminLogin button[type=submit]").click();
  await expect(page.locator("#dirAdminPanel")).toBeVisible();
  await expect(page.locator("#dirAdminRecords [data-kind=entities]")).toHaveCount(1);
  await expect(page.locator("#dirAdminRecords")).toContainText("شركة أسيوط التجريبية");

  await page.locator("#dirAdminAreaFilter").selectOption("area-admin-1");
  await expect(page.locator("#dirAdminRecords [data-kind=entities]")).toHaveCount(1);
  await page.locator("#dirAdminSearch").fill("اسم غير موجود");
  await expect(page.locator("#dirAdminRecords .dir-admin-empty")).toBeVisible();
  await page.locator("#dirAdminSearch").fill("");

  await page.locator("[data-view=sources]").click();
  await expect(page.locator("#dirAdminSourceForm")).toBeVisible();
  await page.locator("#dirAdminSourceForm [name=title]").fill("الموقع الرسمي التجريبي");
  await page.locator("#dirAdminSourceForm [name=publisher]").fill("جهة اختبار");
  await page.locator("#dirAdminSourceForm [name=source_type]").fill("موقع رسمي");
  await page.locator("#dirAdminSourceForm [name=source_url]").fill("https://example.org/official");
  await page.locator("#dirAdminSourceForm [name=confidence_level]").selectOption("official");
  await page.locator("#dirAdminSourceForm [name=is_public]").check();
  await page.locator("#dirAdminSourceForm button[type=submit]").click();
  await expect(page.locator("#dirAdminRecords [data-kind=sources]")).toHaveCount(1);
  expect(db.directory_change_log).toHaveLength(1);

  await page.locator("[data-view=entities]").click();
  const entity = page.locator("#dirAdminRecords [data-kind=entities]");
  await entity.locator("[data-link-source]").selectOption("source-admin-1");
  await entity.locator("[data-link-record]").click();
  await expect(page.locator("#dirAdminStatus")).toContainText("تم ربط المصدر بالسجل وتسجيل العملية.");
  await expect(entity.locator(".dir-admin-sources")).toContainText("الموقع الرسمي التجريبي");
  expect(db.directory_entity_sources).toHaveLength(1);

  page.on("dialog",dialog => dialog.accept());
  await entity.locator("[data-confirm]").check();
  await entity.locator("[data-publish]").click();
  await expect(page.locator("#dirAdminRecords [data-kind=entities]")).toContainText("منشور");
  expect(db.directory_change_log).toHaveLength(3);

  await page.locator("[data-view=history]").click();
  await expect(page.locator(".dir-admin-log")).toHaveCount(3);
  await expect(page.locator("#dirAdminRecords")).toContainText("اعتماد ونشر سجل");
});

test("directory admin page has no horizontal overflow on a phone viewport", async ({page}) => {
  await mockDirectoryAdmin(page,{isAdmin:true});
  await page.setViewportSize({width:375,height:812});
  await page.goto("/directory-admin.html");
  const dimensions = await page.evaluate(() => ({
    clientWidth:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
});
