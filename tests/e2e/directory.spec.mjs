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
    if (method === "POST" && table === "directory_admin_mutate_with_audit") {
      const { p_table_name, p_operation, p_record_id, p_data, p_reason } = body;
      if (p_reason === "force audit failure") {
        await route.fulfill({
          status:500,
          contentType:"application/json",
          body:JSON.stringify({message:"forced audit insert failure"})
        });
        return;
      }

      let record;
      let recordId = p_record_id || null;
      let oldValues = {};
      if (p_operation === "insert" && p_table_name === "directory_projects") {
        record = {
          id:"project-admin-new",
          project_status:"unknown",
          verification_status:"draft",
          public_visible:false,
          ...p_data
        };
        db.directory_projects.push(record);
        recordId = record.id;
      } else if (p_operation === "insert" && p_table_name === "directory_sources") {
        record = {
          id:"source-admin-1",
          accessed_at:"2026-11-03T08:00:00Z",
          ...p_data
        };
        db.directory_sources.push(record);
        recordId = record.id;
      } else if (p_operation === "insert" &&
          (p_table_name === "directory_entity_sources" || p_table_name === "directory_project_sources")) {
        record = { ...p_data };
        const linkTable = p_table_name === "directory_entity_sources"
          ? db.directory_entity_sources : db.directory_project_sources;
        linkTable.push(record);
      } else if (p_operation === "update") {
        record = (db[p_table_name] || []).find(item => item.id === p_record_id);
        if (!record) {
          await route.fulfill({status:404,contentType:"application/json",body:JSON.stringify({message:"record not found"})});
          return;
        }
        oldValues = Object.fromEntries(Object.keys(p_data).map(key => [key, record[key] ?? null]));
        Object.assign(record, p_data);
      } else {
        await route.fulfill({status:400,contentType:"application/json",body:JSON.stringify({message:"unsupported test mutation"})});
        return;
      }

      const audit = {
        id:"change-" + (db.directory_change_log.length + 1),
        created_at:new Date().toISOString(),
        table_name:p_table_name,
        record_id:recordId,
        changed_by:"admin-user-1",
        old_values:oldValues,
        new_values:p_operation === "insert" ? record : { ...p_data },
        reason:p_reason
      };
      db.directory_change_log.unshift(audit);
      await route.fulfill({
        status:200,
        contentType:"application/json",
        body:JSON.stringify({record,audit_id:audit.id})
      });
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

  const untouchedEntity = page.locator("#dirAdminRecords [data-kind=entities]");
  await untouchedEntity.locator('[data-field="name_ar"]').fill("اسم يجب ألا يُحفظ");
  await untouchedEntity.locator("[data-reason]").fill("force audit failure");
  await untouchedEntity.locator("[data-save]").click();
  await expect(page.locator("#dirAdminStatus")).toContainText("forced audit insert failure");
  expect(db.directory_entities[0].name_ar).toBe("شركة أسيوط التجريبية");
  expect(db.directory_change_log).toHaveLength(0);

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


test("directory admin creates a draft project, links a source and records both audit events", async ({page}) => {
  const db = await mockDirectoryAdmin(page,{isAdmin:true});
  await page.goto("/directory-admin.html");
  await page.locator("#dirAdminEmail").fill("admin@example.test");
  await page.locator("#dirAdminPassword").fill("admin-test-password");
  await page.locator("#dirAdminLogin button[type=submit]").click();
  await expect(page.locator("#dirAdminPanel")).toBeVisible();

  await page.locator("[data-view=sources]").click();
  await page.locator("#dirAdminSourceForm [name=title]").fill("مرجع المشروع الرسمي");
  await page.locator("#dirAdminSourceForm [name=publisher]").fill("جهة اختبار");
  await page.locator("#dirAdminSourceForm [name=source_type]").fill("موقع رسمي");
  await page.locator("#dirAdminSourceForm [name=source_url]").fill("https://example.org/project");
  await page.locator("#dirAdminSourceForm [name=confidence_level]").selectOption("official");
  await page.locator("#dirAdminSourceForm [name=is_public]").check();
  await page.locator("#dirAdminSourceForm button[type=submit]").click();
  await expect(page.locator("#dirAdminRecords [data-kind=sources]")).toHaveCount(1);

  await page.locator("[data-view=projects]").click();
  await expect(page.locator("#dirAdminProjectsPanel")).toBeVisible();
  await page.locator("#dirAdminProjectForm [name=name_ar]").fill("مشروع جديد للاختبار");
  await page.locator("#dirAdminProjectForm [name=name_en]").fill("New Assiut Test Project");
  await page.locator("#dirAdminProjectForm [name=project_type]").selectOption("residential");
  await page.locator("#dirAdminProjectForm [name=project_status]").selectOption("under_construction");
  await page.locator("#dirAdminProjectForm [name=area_id]").selectOption("area-admin-1");
  await page.locator("#dirAdminProjectForm [name=location_text]").fill("أسيوط الجديدة");
  await page.locator("#dirAdminProjectForm [name=size_value]").fill("1250");
  await page.locator("#dirAdminProjectForm [name=size_unit]").fill("متر مربع");
  await page.locator("#dirAdminProjectForm [name=unit_count]").fill("24");
  await page.locator("#dirAdminProjectForm [name=description]").fill("وصف تجريبي لا يمثل مشروعًا حقيقيًا.");
  await page.locator("#dirAdminProjectForm [name=reason]").fill("اختبار إدخال مسودة");
  await page.locator("#dirAdminProjectForm button[type=submit]").click();

  await expect(page.locator("#dirAdminStatus")).toContainText("تمت إضافة المشروع كمسودة");
  const project = page.locator('#dirAdminRecords [data-kind="projects"][data-id="project-admin-new"]');
  await expect(project).toBeVisible();
  await expect(project).toContainText("مشروع جديد للاختبار");
  expect(db.directory_projects).toHaveLength(2);
  expect(db.directory_projects.find(item => item.id === "project-admin-new").verification_status).toBe("draft");
  expect(db.directory_projects.find(item => item.id === "project-admin-new").public_visible).toBe(false);
  expect(db.directory_change_log).toHaveLength(2);

  await project.locator("[data-link-source]").selectOption("source-admin-1");
  await project.locator("[data-link-record]").click();
  await expect(page.locator("#dirAdminStatus")).toContainText("تم ربط المصدر بالسجل وتسجيل العملية.");
  expect(db.directory_project_sources).toHaveLength(1);
  expect(db.directory_project_sources[0]).toMatchObject({
    project_id:"project-admin-new",source_id:"source-admin-1",claim_key:"general"
  });
  expect(db.directory_change_log).toHaveLength(3);

  await page.locator("[data-view=history]").click();
  await expect(page.locator(".dir-admin-log")).toHaveCount(3);
  await expect(page.locator("#dirAdminRecords")).toContainText("إضافة مشروع للاختبار");
  await expect(page.locator("#dirAdminRecords")).toContainText("ربط مصدر بالسجل");
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
