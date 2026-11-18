import { test, expect } from "@playwright/test";

const SUPABASE = "https://asyut-aqar-test.supabase.co";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EDITOR_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ENTITY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROJECT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const AREA_UNIT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const OFFER_ID = 701;
const UNIT_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const REQUEST_ID = "99999999-9999-4999-8999-999999999999";

async function installAuth(page, mode = "session") {
  await page.route("**/config.js*", route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: 'window.LAYAN_CONFIG = { SUPABASE_URL: "' + SUPABASE + '", SUPABASE_PUBLISHABLE_KEY: "test-key" };'
  }));
  if (mode === "admin") {
    await page.route("**/gubabase.js*", route => route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: 'let testSession = null; window.LAYAN_SUPABASE = { getSession: () => testSession, requireAuthenticated: async () => testSession, signIn: async () => { testSession = { user: { id: "' + USER_ID + '" }, access_token: "test-token", expires_at: Math.floor(Date.now()/1000)+3600 }; }, signOut: async () => { testSession = null; }, authedFetch: (url,options) => fetch(url,options) };'
    }));
  } else {
    await page.route("**/gubabase.js*", route => route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: 'window.LAYAN_SUPABASE = { requireAuthenticated: async () => ({ user: { id: "' + USER_ID + '" } }), authedFetch: (url, options) => fetch(url, options) };'
    }));
  }
}

function unitRecord() {
  return {
    id: UNIT_ID,
    project_id: PROJECT_ID,
    unit_ref: "عمارة 2 - شقة 12",
    unit_type: "apartment",
    building_label: "عمارة 2",
    floor_label: "الثالث",
    unit_number: "12",
    area_m2: 145,
    bedrooms: 3,
    bathrooms: 2,
    finishing: "نصف تشطيب",
    description: "وحدة منشورة بعد مراجعة الإدارة",
    verification_status: "published",
    public_visible: true
  };
}

test("verified company owner can request a unit and it remains under review", async ({ page }) => {
  let submitted = null;
  let requests = [];
  await installAuth(page);
  await page.route(SUPABASE + "/rest/v1/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/rest/v1/","");
    const json = data => route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(data) });

    if (path === "company_entity_managers") return json([{ directory_entity_id:ENTITY_ID, verified_at:"2026-11-18T01:00:00Z" }]);
    if (path === "company_entity_manager_members") return json([]);
    if (path === "directory_project_entities") return json([{ project_id:PROJECT_ID,entity_id:ENTITY_ID,relation_type:"developer" }]);
    if (path === "directory_entities") return json([{ id:ENTITY_ID,name_ar:"شركة أسيوط التجريبية",public_visible:true,verification_status:"published" }]);
    if (path === "directory_projects") return json([{ id:PROJECT_ID,name_ar:"مشروع النخيل",public_visible:true,verification_status:"published" }]);
    if (path === "directory_areas") return json([]);
    if (path === "rpc/company_project_unit_requests_mine") return json(requests);
    if (path === "rpc/company_project_unit_request_submit") {
      submitted = route.request().postDataJSON();
      requests = [{
        request_id:REQUEST_ID,
        project_id:PROJECT_ID,
        project_name:"مشروع النخيل",
        entity_name:"شركة أسيوط التجريبية",
        unit_payload:submitted.p_unit_payload,
        status:"pending",
        created_at:"2026-11-18T01:00:00Z"
      }];
      return json(REQUEST_ID);
    }
    return json([]);
  });

  await page.goto("/company-dashboard.html");
  const root = page.locator("#cdProjectUnitsRoot");
  const form = root.locator(".cd-project-unit-form");
  await expect(form).toBeVisible();
  await form.locator("select").nth(0).selectOption(PROJECT_ID);
  await form.locator("select").nth(1).selectOption("apartment");
  await form.locator('input[placeholder="مثال: عمارة 2 - الدور 3 - شقة 12"]').fill("عمارة 2 - شقة 12");
  await form.locator('input[placeholder="مثال: عمارة 2"]').fill("عمارة 2");
  await form.locator('input[placeholder="مثال: الثالث"]').fill("الثالث");
  await form.locator('input[placeholder="مثال: 12"]').fill("12");
  await form.locator('input[placeholder="مثال: 145"]').fill("145");
  await form.locator('input[placeholder="مثال: 3"]').fill("3");
  await form.locator('input[placeholder="مثال: 2"]').fill("2");
  await form.locator('input[placeholder="مثال: نصف تشطيب"]').fill("نصف تشطيب");
  await form.locator('textarea[placeholder*="تفاصيل"]').fill("وحدة اختبار في مشروع النخيل.");
  await form.locator('input[placeholder="https://..."]').fill("https://example.com/unit");
  await form.locator('textarea[placeholder*="مصدر البيانات"]').fill("بيانات الوحدة من سجل المشروع ومرفق الإثبات.");

  await form.locator('button[type="submit"]').click();
  await expect(page.locator("#cdProjectUnitRequestsList")).toContainText("عمارة 2 - شقة 12");
  await expect(page.locator("#cdProjectUnitRequestsList")).toContainText("قيد مراجعة الإدارة");
  expect(submitted.p_project_id).toBe(PROJECT_ID);
  expect(submitted.p_unit_payload.unit_ref).toBe("عمارة 2 - شقة 12");
  expect(submitted.p_unit_payload.public_visible).toBeUndefined();
});

test("company editor cannot access project unit submission form", async ({ page }) => {
  await installAuth(page);
  await page.route(SUPABASE + "/rest/v1/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/rest/v1/","");
    const json = data => route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(data) });
    if (path === "company_entity_managers") return json([]);
    if (path === "company_entity_manager_members") {
      return json([{ directory_entity_id:ENTITY_ID,member_role:"editor" }]);
    }
    if (path === "rpc/company_project_unit_requests_mine") return json([]);
    return json([]);
  });
  await page.goto("/company-dashboard.html");
  await expect(page.locator("#cdProjectUnitsRoot")).toContainText("إدارة وحدات المشروع متاحة للمالك المعتمد");
  await expect(page.locator("#cdProjectUnitsRoot .cd-project-unit-form")).toHaveCount(0);
});

test("property owner can request a reviewed association between an available ad and a published unit", async ({ page }) => {
  let submitted = null;
  let requests = [];
  await installAuth(page);
  await page.route(SUPABASE + "/rest/v1/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/rest/v1/","");
    const json = data => route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(data) });

    if (path === "property_offers") {
      if (url.searchParams.get("select")?.includes("project_unit_id")) {
        return json([{ request_id:REQUEST_ID,offer_id:OFFER_ID,offer_title:"شقة الاختبار",project_unit_id:UNIT_ID,unit_ref:"عمارة 2 - شقة 12",project_id:PROJECT_ID,project_name:"مشروع النخيل",status:"pending" }]);
      }
      return json([{ id:OFFER_ID,title:"شقة الاختبار",listing_purpose:"بيع",status:"available",project_name:"مشروع النخيل" }]);
    }
    if (path === "directory_project_units") return json([unitRecord()]);
    if (path === "directory_projects") return json([{ id:PROJECT_ID,name_ar:"مشروع النخيل",public_visible:true,verification_status:"published" }]);
    if (path === "marketplace_listings" || path === "supplier_ads") return json([]);
    if (path === "rpc/layan_company_owner_profile") return json(null);
    if (path === "rpc/property_offer_project_unit_requests_mine") return json(requests);
    if (path === "rpc/property_offer_project_unit_request_submit") {
      submitted = route.request().postDataJSON();
      requests = [{
        request_id:REQUEST_ID,offer_id:OFFER_ID,offer_title:"شقة الاختبار",
        project_unit_id:UNIT_ID,unit_ref:"عمارة 2 - شقة 12",
        project_id:PROJECT_ID,project_name:"مشروع النخيل",status:"pending"
      }];
      return json(REQUEST_ID);
    }
    return json([]);
  });

  await page.goto("/my-listings.html");
  const form = page.locator("#myProjectUnitLinkFormRoot .my-project-unit-link-form");
  await expect(form).toBeVisible();
  await form.locator("select").nth(0).selectOption(String(OFFER_ID));
  await form.locator("select").nth(1).selectOption(UNIT_ID);
  await form.locator('input[type="url"]').fill("https://example.com/proof");
  await form.locator("textarea").fill("الإعلان يخص الوحدة المذكورة في مستندات المالك المرفقة.");
  await form.locator('button[type="submit"]').click();

  await expect(page.locator("#myProjectUnitLinkRequests")).toContainText("قيد مراجعة الإدارة");
  expect(submitted.p_offer_id).toBe(OFFER_ID);
  expect(submitted.p_project_unit_id).toBe(UNIT_ID);
  expect(submitted.p_evidence_description).toContain("مستندات المالك");
});

test("public project page shows only ads explicitly linked to published units", async ({ page }) => {
  let offerFilter = null;
  await page.route("**/config.js*", route => route.fulfill({
    status:200,
    contentType:"application/javascript",
    body:'window.LAYAN_CONFIG = { SUPABASE_URL: "'+SUPABASE+'", SUPABASE_PUBLISHABLE_KEY:"test-key" };'
  }));
  await page.route(SUPABASE + "/rest/v1/**",async route=>{
    const url=new URL(route.request().url());
    const path=url.pathname.replace("/rest/v1/","");
    const json=data=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
    if(path==="directory_projects") return json([{
      id:PROJECT_ID,slug:"nakheel-test",name_ar:"مشروع النخيل",
      project_type:"residential",description:"ملف مشروع منشور للاختبار.",
      project_status:"operating",area_id:null,public_visible:true,verification_status:"published",
      location_public:false
    }]);
    if(path==="directory_project_units") return json([unitRecord()]);
    if(path==="property_offers"){
      offerFilter = {
        unit: url.searchParams.get("project_unit_id"),
        status: url.searchParams.get("status"),
        hasProjectName: url.searchParams.has("project_name")
      };
      return json([{
        id:OFFER_ID,title:"إعلان الوحدة المرتبط",
        listing_purpose:"بيع",property_type:"شقة",
        total_price:1200000,price_on_request:false,
        area_m2:145,project_unit_id:UNIT_ID,status:"available"
      }]);
    }
    return json([]);
  });
  await page.goto("/project.html?id="+PROJECT_ID);
  await expect(page.locator("#projectProfileRoot")).toContainText("الوحدات العقارية بالمشروع");
  await expect(page.locator("#projectProfileRoot")).toContainText("عمارة 2 - شقة 12");
  await expect(page.locator("#projectProfileRoot")).toContainText("إعلان الوحدة المرتبط");
  expect(offerFilter.unit).toContain(UNIT_ID);
  expect(offerFilter.status).toBe("eq.available");
  expect(offerFilter.hasProjectName).toBe(false);
});

test("administrator can approve publishing a project unit from the dedicated review queue", async ({ page }) => {
  let current = {
    request_id:REQUEST_ID,
    project_id:PROJECT_ID,
    project_name:"مشروع النخيل",
    directory_entity_id:ENTITY_ID,
    entity_name:"شركة أسيوط التجريبية",
    requester_user_id:USER_ID,
    requester_role:"owner",
    unit_payload:{unit_ref:"A-12",unit_type:"apartment",area_m2:145},
    evidence_url:"https://example.com/unit",
    evidence_description:"بيانات الوحدة من ملف المشروع.",
    status:"pending",
    created_at:"2026-11-18T01:00:00Z"
  };
  await installAuth(page,"admin");
  await page.route(SUPABASE + "/rest/v1/**",async route=>{
    const url=new URL(route.request().url());
    const path=url.pathname.replace("/rest/v1/","");
    const json=data=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
    if(path==="rpc/layan_is_admin") return json(true);
    if(path==="rpc/company_project_unit_request_admin_list") return json([current]);
    if(path==="rpc/property_offer_project_unit_request_admin_list") return json([]);
    if(path==="rpc/company_project_unit_request_admin_review"){
      const body=route.request().postDataJSON();
      expect(body.p_action).toBe("approve");
      current={...current,status:"approved",resulting_unit_id:UNIT_ID};
      return json(UNIT_ID);
    }
    return json([]);
  });
  page.on("dialog",dialog=>dialog.accept());
  await page.goto("/project-units-admin.html");
  await page.locator("#puaEmail").fill("admin@example.com");
  await page.locator("#puaPassword").fill("test-password");
  await page.locator("#puaLoginForm button[type=submit]").click();
  await expect(page.locator("#puaRequestsList")).toContainText("A-12");
  await page.locator("#puaRequestsList button").filter({hasText:"اعتماد ونشر الوحدة"}).click();
  await expect(page.locator("#puaStatus")).toContainText("تم اعتماد الوحدة ونشرها");
  await expect(page.locator("#puaRequestsList")).toContainText("تم الاعتماد");
});

