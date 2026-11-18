import { test, expect } from "@playwright/test";

const SUPABASE = "https://asyut-aqar-test.supabase.co";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ENTITY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROJECT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

async function installUnitDashboard(page, role = "manager", initialOffers = []) {
  let offers = initialOffers.slice();
  let submitted = null;
  let lastStatusChange = null;
  let lastUpdate = null;

  await page.route("**/config.js*", route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: 'window.LAYAN_CONFIG = { SUPABASE_URL: "' + SUPABASE + '", SUPABASE_PUBLISHABLE_KEY: "test-key" };'
  }));
  await page.route("**/gubabase.js*", route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: 'window.LAYAN_SUPABASE = { requireAuthenticated: async () => ({ user: { id: "' + USER_ID + '" } }), authedFetch: (url, options) => fetch(url, options), uploadImages: async () => [], deleteUploadedImages: async () => {} };'
  }));
  for (const script of ["company-dashboard.js", "company-project-management.js", "app-shell.js", "site-nav.js"]) {
    await page.route("**/" + script + "*", route => route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: ""
    }));
  }

  await page.route(SUPABASE + "/rest/v1/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/rest/v1/", "");
    const json = data => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data)
    });

    if (path === "company_entity_managers") {
      return json(role === "owner"
        ? [{ directory_entity_id: ENTITY_ID, verified_at: "2026-11-17T10:00:00Z" }]
        : []);
    }
    if (path === "company_entity_manager_members") {
      return json(role === "manager" || role === "editor"
        ? [{ directory_entity_id: ENTITY_ID, member_role: role }]
        : []);
    }
    if (path === "directory_entities") {
      return json([{
        id: ENTITY_ID,
        name_ar: "شركة أسيوط التجريبية",
        public_visible: true,
        verification_status: "published"
      }]);
    }
    if (path === "directory_project_entities") {
      return json([{
        project_id: PROJECT_ID,
        entity_id: ENTITY_ID,
        relation_type: "developer"
      }]);
    }
    if (path === "directory_projects") {
      return json([{
        id: PROJECT_ID,
        name_ar: "مشروع النخيل التجريبي",
        project_type: "residential",
        public_visible: true,
        verification_status: "published"
      }]);
    }
    if (path === "property_offers") return json(offers);
    if (path === "rpc/company_project_offer_submit") {
      submitted = route.request().postDataJSON();
      offers = [{
        id: 991,
        title: submitted.p_payload.title,
        property_type: submitted.p_payload.property_type,
        listing_purpose: submitted.p_payload.listing_purpose,
        city: submitted.p_payload.city,
        area: submitted.p_payload.area,
        area_m2: submitted.p_payload.area_m2,
        total_price: submitted.p_payload.total_price,
        price_on_request: submitted.p_payload.price_on_request,
        status: "pending",
        verification_status: "pending",
        directory_project_id: PROJECT_ID,
        directory_entity_id: ENTITY_ID
      }];
      return json(991);
    }
    if (path === "rpc/company_project_offer_set_status") {
      lastStatusChange = route.request().postDataJSON();
      offers = offers.map(row => ({ ...row, status: lastStatusChange.p_status }));
      return json(lastStatusChange.p_status);
    }
    if (path === "rpc/company_project_offer_update") {
      lastUpdate = route.request().postDataJSON();
      return json("pending");
    }
    return json([]);
  });

  await page.goto("/company-dashboard.html");
  return {
    getSubmitted: () => submitted,
    getLastStatusChange: () => lastStatusChange,
    getLastUpdate: () => lastUpdate
  };
}

test("verified company manager submits a project unit for admin approval", async ({ page }) => {
  const mocks = await installUnitDashboard(page, "manager");
  const root = page.locator("#cdProjectUnitsRoot");
  await expect(root).toContainText("إضافة وحدة إلى مشروع");

  const form = root.locator(".cd-unit-form");
  await form.getByLabel("ملف الشركة والمشروع").selectOption("0");
  await form.getByLabel(/عنوان الوحدة أو رقمها/).fill("شقة 12 — عمارة A");
  await form.getByLabel("المدينة / المركز *").fill("مدينة أسيوط");
  await form.getByLabel("الحي / المنطقة *").fill("حي الجامعة");
  await form.getByLabel(/سعر البيع/).fill("1250000");
  await form.locator('button[type="submit"]').click();

  await expect(page.locator("#cdProjectUnitsList")).toContainText("شقة 12 — عمارة A");
  await expect(page.locator("#cdProjectUnitsList")).toContainText("بانتظار مراجعة الإدارة");
  const body = mocks.getSubmitted();
  expect(body.p_directory_entity_id).toBe(ENTITY_ID);
  expect(body.p_project_id).toBe(PROJECT_ID);
  expect(body.p_payload.title).toBe("شقة 12 — عمارة A");
  expect(body.p_payload.listing_purpose).toBe("بيع");
  expect(body.p_payload.price_on_request).toBe(false);
  expect(body.p_payload.public_visible).toBeUndefined();
  expect(body.p_payload.contact_consent).toBe(false);
});

test("editor can read linked units but cannot create, edit or change availability", async ({ page }) => {
  await installUnitDashboard(page, "editor", [{
    id: 992,
    title: "محل تجاري للاختبار",
    property_type: "محل",
    listing_purpose: "إيجار",
    city: "مدينة أسيوط",
    area: "وسط البلد",
    area_m2: 80,
    total_price: 9000,
    price_on_request: false,
    status: "available",
    verification_status: "verified",
    directory_project_id: PROJECT_ID,
    directory_entity_id: ENTITY_ID
  }]);

  await expect(page.locator("#cdProjectUnitsRoot")).toContainText("صلاحية حسابك تسمح بعرض الوحدات المرتبطة فقط");
  await expect(page.locator("#cdProjectUnitsRoot .cd-unit-form")).toHaveCount(0);
  await expect(page.locator("#cdProjectUnitsList")).toContainText("محل تجاري للاختبار");
  await expect(page.locator("#cdProjectUnitsList button[data-unit-action]")).toHaveCount(0);
});

test("company manager can change an approved linked unit availability", async ({ page }) => {
  const mocks = await installUnitDashboard(page, "manager", [{
    id: 993,
    title: "فيلا منشورة",
    property_type: "فيلا",
    listing_purpose: "بيع",
    city: "مدينة أسيوط",
    area: "الهضبة",
    area_m2: 260,
    total_price: 3800000,
    price_on_request: false,
    status: "available",
    verification_status: "verified",
    directory_project_id: PROJECT_ID,
    directory_entity_id: ENTITY_ID
  }]);

  const sold = page.locator('#cdProjectUnitsList button[data-unit-action="sold"]');
  await expect(sold).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await sold.click();

  expect(mocks.getLastStatusChange()).toEqual({
    p_id: 993,
    p_status: "sold"
  });
  await expect(page.locator("#cdProjectUnitsList")).toContainText("تم البيع / التأجير");
});

test("published project profile lists only its approved available units", async ({ page }) => {
  const seenUnitQuery = [];
  await page.route("**/config.js*", route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: 'window.LAYAN_CONFIG = { SUPABASE_URL: "' + SUPABASE + '", SUPABASE_PUBLISHABLE_KEY: "test-key" };'
  }));
  for (const script of ["app-shell.js", "site-nav.js", "share.js", "assistant.js", "mascot.js", "tracking.js"]) {
    await page.route("**/" + script + "*", route => route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: ""
    }));
  }
  await page.route(SUPABASE + "/rest/v1/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/rest/v1/", "");
    const json = data => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data)
    });
    if (path === "directory_projects") {
      return json([{
        id: PROJECT_ID,
        slug: "palm-project",
        name_ar: "مشروع النخيل التجريبي",
        project_type: "residential",
        project_status: "under_construction",
        description: "مشروع سكني للاختبار",
        public_visible: true,
        verification_status: "published",
        area_id: null,
        latitude: null,
        longitude: null
      }]);
    }
    if (path === "directory_project_entities") return json([]);
    if (path === "directory_project_sources") return json([]);
    if (path === "property_offers") {
      seenUnitQuery.push(url.searchParams.toString());
      return json([{
        id: 994,
        title: "شقة 7",
        property_type: "شقة",
        listing_purpose: "بيع",
        city: "مدينة أسيوط",
        area: "حي الجامعة",
        area_m2: 145,
        bedrooms: 3,
        bathrooms: 2,
        total_price: 1750000,
        price_on_request: false,
        image_urls: [],
        status: "available",
        verification_status: "verified",
        directory_project_id: PROJECT_ID
      }]);
    }
    return json([]);
  });

  await page.goto("/project.html?id=" + PROJECT_ID);
  await expect(page.locator("#projectProfileRoot")).toContainText("الوحدات المنشورة في هذا المشروع");
  await expect(page.locator("#projectProfileRoot")).toContainText("شقة 7");
  await expect(page.locator('#projectProfileRoot a[href="./property.html?id=994"]')).toContainText("عرض تفاصيل الوحدة");
  expect(seenUnitQuery[0]).toContain("directory_project_id=eq." + PROJECT_ID);
  expect(seenUnitQuery[0]).toContain("status=eq.available");
  expect(seenUnitQuery[0]).toContain("verification_status=eq.verified");
});
