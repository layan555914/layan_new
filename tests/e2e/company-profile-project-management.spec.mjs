import { test, expect } from "@playwright/test";

const SUPABASE = "https://company-profile-project-test.supabase.co";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ENTITY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROJECT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const AREA_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const UNIT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const OFFER_ID = 701;

const reply = (route, body, status = 200) => route.fulfill({
  status,
  contentType: "application/json",
  body: JSON.stringify(body)
});

function makeEntity(type = "developer") {
  return {
    id: ENTITY_ID,
    name_ar: type === "developer" ? "شركة اختبار التطوير" : "شركة اختبار التسويق",
    entity_type: type,
    service_category: type === "developer" ? "real_estate_development" : "real_estate_marketing",
    description: "ملف شركة منشور ومعتمد للاختبار داخل أسيوط عقار.",
    website_url: null,
    public_phone: "01012345678",
    public_email: null,
    public_address: "أسيوط",
    public_whatsapp: null,
    public_logo_url: null,
    public_services: [],
    public_gallery_urls: [],
    public_business_hours: null,
    public_coverage_areas: [],
    primary_area_id: null,
    latitude: null,
    longitude: null,
    location_public: false,
    location_precision: null,
    location_source_id: null,
    location_verified_at: null,
    verification_status: "published",
    representative_verified_at: "2026-11-18T10:00:00Z",
    public_visible: true
  };
}

async function installProfileMocks(page, { type = "developer", role = "owner" } = {}) {
  const entity = makeEntity(type);
  const relationType = type === "developer" ? "developer" : "marketing_agent";
  let projectRequests = [];
  let unitRequests = [];
  let offerRequests = [];
  let submittedProject = null;
  let submittedUnit = null;
  let submittedOfferLink = null;

  const project = {
    id: PROJECT_ID,
    name_ar: "مشروع النخيل للاختبار",
    project_type: "residential",
    project_status: "under_construction",
    public_visible: true,
    verification_status: "published"
  };
  const unit = {
    id: UNIT_ID,
    project_id: PROJECT_ID,
    unit_ref: "عمارة 2 - شقة 12",
    unit_type: "apartment",
    area_m2: 145,
    verification_status: "published",
    public_visible: true
  };

  await page.route("**/config.js*", route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: 'window.LAYAN_CONFIG = { SUPABASE_URL: "' + SUPABASE + '", SUPABASE_PUBLISHABLE_KEY: "test-key" };'
  }));
  await page.route("**/gubabase.js*", route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: 'window.LAYAN_SUPABASE = {' +
      'isAuthenticated: () => true,' +
      'requireAuthenticated: async () => ({ user: { id: "' + USER_ID + '" }, access_token: "test-token" }),' +
      'authedFetch: (url, options) => fetch(url, options)' +
    '};'
  }));

  await page.route(SUPABASE + "/rest/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/rest/v1/", "");
    const method = request.method();

    if (path === "directory_entities") return reply(route, [entity]);
    if (path === "directory_entity_sources") return reply(route, []);
    if (path === "directory_sources") return reply(route, []);
    if (path === "directory_project_entities") return reply(route, [
      { project_id: PROJECT_ID, entity_id: ENTITY_ID, relation_type: relationType }
    ]);
    if (path === "directory_projects") return reply(route, [project]);
    if (path === "directory_areas") return reply(route, [{
      id: AREA_ID,
      name_ar: "مدينة أسيوط",
      is_active: true,
      public_visible: true,
      verification_status: "published"
    }]);
    if (path === "directory_project_units") return reply(route, type === "developer" ? [unit] : []);
    if (path === "company_entity_managers") {
      return reply(route, role === "owner"
        ? [{ directory_entity_id: ENTITY_ID, owner_user_id: USER_ID, verified_at: "2026-11-18T10:00:00Z" }]
        : []);
    }
    if (path === "company_entity_manager_members") {
      return reply(route, ["manager", "editor"].includes(role)
        ? [{ directory_entity_id: ENTITY_ID, user_id: USER_ID, member_role: role, revoked_at: null }]
        : []);
    }
    if (path === "company_entity_profile_update_requests") return reply(route, []);
    if (path === "company_claim_requests") return reply(route, []);
    if (path === "property_offers") {
      return reply(route, [{
        id: OFFER_ID,
        title: "شقة اختبار للبيع",
        listing_purpose: "بيع",
        status: "available"
      }]);
    }
    if (path === "rpc/company_project_request_submit" && method === "POST") {
      submittedProject = request.postDataJSON();
      projectRequests = [{
        request_id: "11111111-1111-4111-8111-111111111111",
        directory_entity_id: ENTITY_ID,
        entity_name: entity.name_ar,
        request_type: submittedProject.p_request_type,
        project_id: submittedProject.p_project_id,
        project_name: submittedProject.p_project_payload?.name_ar || project.name_ar,
        requested_relation_type: submittedProject.p_relation_type,
        status: "pending",
        created_at: "2026-11-20T00:00:00Z"
      }];
      return reply(route, "11111111-1111-4111-8111-111111111111");
    }
    if (path === "rpc/company_project_requests_mine") return reply(route, projectRequests);
    if (path === "rpc/company_project_unit_request_submit" && method === "POST") {
      submittedUnit = request.postDataJSON();
      unitRequests = [{
        request_id: "22222222-2222-4222-8222-222222222222",
        project_id: PROJECT_ID,
        project_name: project.name_ar,
        directory_entity_id: ENTITY_ID,
        entity_name: entity.name_ar,
        unit_payload: submittedUnit.p_unit_payload,
        status: "pending",
        created_at: "2026-11-20T00:00:00Z"
      }];
      return reply(route, "22222222-2222-4222-8222-222222222222");
    }
    if (path === "rpc/company_project_unit_requests_mine") return reply(route, unitRequests);
    if (path === "rpc/property_offer_project_unit_request_submit" && method === "POST") {
      submittedOfferLink = request.postDataJSON();
      offerRequests = [{
        request_id: "33333333-3333-4333-8333-333333333333",
        offer_id: OFFER_ID,
        offer_title: "شقة اختبار للبيع",
        project_unit_id: UNIT_ID,
        unit_ref: unit.unit_ref,
        project_id: PROJECT_ID,
        project_name: project.name_ar,
        status: "pending"
      }];
      return reply(route, "33333333-3333-4333-8333-333333333333");
    }
    if (path === "rpc/property_offer_project_unit_requests_mine") return reply(route, offerRequests);
    if (path === "rpc/company_claim_requests") return reply(route, []);
    return reply(route, []);
  });

  return {
    getSubmittedProject: () => submittedProject,
    getSubmittedUnit: () => submittedUnit,
    getSubmittedOfferLink: () => submittedOfferLink
  };
}

test("developer company manages project requests, units and its own ad links inside the company profile", async ({ page }) => {
  const mocks = await installProfileMocks(page, { type: "developer", role: "owner" });

  await page.goto("/company.html?entity_id=" + ENTITY_ID);
  await expect(page.locator("#companyProfileRoot h1")).toHaveText("شركة اختبار التطوير");
  await expect(page.locator(".company-linked-projects")).toContainText("مشروع النخيل للاختبار");

  const tools = page.locator("#companyProfileRoot .company-profile-managed-project-tools");
  await expect(tools).toBeVisible();
  await expect(tools.locator("h3")).toContainText("إدارة المشروعات والوحدات والإعلانات");

  const projectForms = tools.locator("#companyProfileProjectManagementRoot .cd-project-request-form");
  await expect(projectForms).toHaveCount(2);
  const newProject = projectForms.nth(0);
  await newProject.getByLabel(/اسم المشروع بالعربية/).fill("مشروع اختبار جديد");
  await newProject.getByLabel(/نوع المشروع/).selectOption("residential");
  await newProject.getByLabel("صفة الشركة داخل المشروع").selectOption("developer");
  await newProject.getByLabel("رابط عام يثبت العلاقة (اختياري)").fill("https://example.com/project-proof");
  await newProject.locator('button[type="submit"]').click();
  await expect(tools.locator("#companyProfileProjectRequestsRoot")).toContainText("مشروع اختبار جديد");
  expect(mocks.getSubmittedProject()).toMatchObject({
    p_directory_entity_id: ENTITY_ID,
    p_request_type: "new_project",
    p_relation_type: "developer"
  });

  const unitForm = tools.locator("#companyProfileProjectUnitsRoot .cd-project-unit-form");
  await expect(unitForm).toBeVisible();
  await unitForm.locator("select").nth(0).selectOption(PROJECT_ID + "|" + ENTITY_ID);
  await unitForm.locator("select").nth(1).selectOption("apartment");
  await unitForm.locator('input[placeholder="مثال: عمارة 2 - الدور 3 - شقة 12"]').fill("عمارة 2 - شقة 12");
  await unitForm.locator('textarea[placeholder*="مصدر البيانات"]').fill("بيانات الوحدة من ملف المشروع وإثبات علاقة الشركة بها.");
  await unitForm.locator('button[type="submit"]').click();
  await expect(tools.locator("#companyProfileProjectUnitRequestsRoot")).toContainText("عمارة 2 - شقة 12");
  expect(mocks.getSubmittedUnit()).toMatchObject({
    p_project_id: PROJECT_ID,
    p_directory_entity_id: ENTITY_ID
  });

  const offerForm = tools.locator("#companyProfileOfferUnitLinkRoot .my-project-unit-link-form");
  await expect(offerForm).toBeVisible();
  await offerForm.locator("select").nth(0).selectOption(String(OFFER_ID));
  await offerForm.locator("select").nth(1).selectOption(UNIT_ID);
  await offerForm.locator("textarea").fill("الإعلان يخص هذه الوحدة ويوجد تفويض/إثبات من صاحب العلاقة.");
  await offerForm.locator('button[type="submit"]').click();
  await expect(tools.locator("#companyProfileOfferUnitLinkRequestsRoot")).toContainText("قيد مراجعة الإدارة");
  expect(mocks.getSubmittedOfferLink()).toMatchObject({
    p_offer_id: OFFER_ID,
    p_project_unit_id: UNIT_ID
  });
});

test("marketing company can only request a marketing or sales relationship to an existing project", async ({ page }) => {
  await installProfileMocks(page, { type: "marketing", role: "manager" });

  await page.goto("/company.html?entity_id=" + ENTITY_ID);
  const tools = page.locator("#companyProfileRoot .company-profile-managed-project-tools");
  await expect(tools).toBeVisible();

  const forms = tools.locator("#companyProfileProjectManagementRoot .cd-project-request-form");
  await expect(forms).toHaveCount(1);
  await expect(forms.nth(0)).toContainText("طلب ربط الشركة بمشروع منشور");
  const relation = forms.nth(0).getByLabel("صفة الشركة داخل المشروع");
  const values = await relation.locator("option").evaluateAll(options => options.map(option => option.value).filter(Boolean));
  expect(values).toEqual(["marketing_agent", "sales_agent"]);
  await expect(tools.locator("#companyProfileProjectUnitsRoot")).toHaveCount(0);
  await expect(tools).toContainText("إضافة الوحدات ليست من صلاحيات وكيل التسويق أو المبيعات");
  await expect(forms.nth(0).getByLabel("ملف الشركة المخوّل")).toHaveValue(ENTITY_ID);
});

test("a company data editor does not receive project, unit or ad-management controls", async ({ page }) => {
  await installProfileMocks(page, { type: "developer", role: "editor" });

  await page.goto("/company.html?entity_id=" + ENTITY_ID);
  await expect(page.locator("#companyProfileRoot .company-manager-panel")).toBeVisible();
  await expect(page.locator("#companyProfileRoot .company-profile-managed-project-tools")).toHaveCount(0);
  await expect(page.locator("#companyProfileRoot .company-manager-access-note")).toContainText("طلبات إضافة أو ربط المشروعات وإدارة الوحدات");
});
