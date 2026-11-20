import { test, expect } from "@playwright/test";

const reply = (route, body, status = 200) => route.fulfill({
  status,
  contentType: "application/json",
  body: JSON.stringify(body)
});

test("company directory separates marketing firms from developers and excludes service providers", async ({ page }) => {
  const profiles = [
    {
      id: "profile-marketing-1",
      company_name: "شركة اختبار التسويق العقاري",
      category: "شركات عقارية",
      description: "تسويق ووساطة وبيع العقارات",
      services: ["تسويق عقاري", "إعادة بيع"],
      city: "مدينة أسيوط",
      logo_url: null
    },
    {
      id: "profile-developer-1",
      company_name: "شركة اختبار التطوير العقاري",
      category: "شركات تطوير ومشروعات عقارية",
      description: "تطوير المشروعات السكنية",
      services: ["تطوير عقاري"],
      city: "أسيوط الجديدة",
      logo_url: null
    },
    {
      id: "profile-service-1",
      company_name: "مؤسسة اختبار التشطيبات",
      category: "مقاولات وتشطيبات",
      description: "مقاولات وتشطيبات فقط",
      services: ["تشطيب"],
      city: "مدينة أسيوط",
      logo_url: null
    }
  ];
  const entities = [
    {
      id: "entity-marketing-1",
      name_ar: "مكتب اختبار وساطة عقارية",
      entity_type: "brokerage",
      service_category: "real_estate_brokerage",
      description: "وساطة وتسويق عقاري",
      public_visible: true,
      verification_status: "published",
      public_services: ["وساطة عقارية"]
    },
    {
      id: "entity-developer-1",
      name_ar: "مطور اختبار أسيوط",
      entity_type: "developer",
      service_category: "real_estate_development",
      description: "تطوير مشروعات سكنية",
      public_visible: true,
      verification_status: "published",
      public_services: ["تطوير عقاري"]
    },
    {
      id: "entity-service-1",
      name_ar: "مقدم اختبار الصيانة",
      entity_type: "other",
      service_category: "maintenance_property_management",
      description: "صيانة وإدارة عقارات",
      public_visible: true,
      verification_status: "published",
      public_services: ["صيانة"]
    }
  ];

  await page.route("**/rest/v1/**", async route => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").pop();
    if (table === "company_profiles_public") return reply(route, profiles);
    if (table === "directory_entities") return reply(route, entities);
    if (route.request().method() === "POST") return reply(route, [], 201);
    return reply(route, []);
  });

  await page.goto("/companies.html");

  const marketing = page.locator("#marketingCompaniesGrid");
  const developers = page.locator("#developmentCompaniesGrid");
  await expect(marketing).toContainText("شركة اختبار التسويق العقاري");
  await expect(marketing).toContainText("مكتب اختبار وساطة عقارية");
  await expect(marketing).not.toContainText("شركة اختبار التطوير العقاري");
  await expect(marketing).not.toContainText("مقدم اختبار الصيانة");

  await expect(developers).toContainText("شركة اختبار التطوير العقاري");
  await expect(developers).toContainText("مطور اختبار أسيوط");
  await expect(developers).not.toContainText("شركة اختبار التسويق العقاري");
  await expect(developers).not.toContainText("مقدم اختبار الصيانة");

  await expect(page.locator('.company-topbar a[href="./company-dashboard.html"]')).toHaveCount(0);
  await expect(marketing.locator('a[href="./company.html?id=profile-marketing-1"]')).toHaveCount(1);
  await expect(developers.locator('a[href="./company.html?id=profile-developer-1"]')).toHaveCount(1);
  await expect(marketing.locator('a[href="./company.html?entity_id=entity-marketing-1"]')).toContainText("عرض الملف واستلامه من داخله");
  await expect(developers.locator('a[href="./company.html?entity_id=entity-developer-1"]')).toContainText("عرض الملف واستلامه من داخله");

  await page.locator("#companyCategoryFilter").selectOption("developers");
  await expect(page.locator("#marketingCompaniesSection")).toBeHidden();
  await expect(page.locator("#developmentCompaniesSection")).toBeVisible();
});

test("services marketplace excludes marketing offices and developers from service cards and categories", async ({ page }) => {
  const categoryNames = [
    "الشركات والمكاتب العقارية",
    "المشروعات والمطورون العقاريون",
    "مواد البناء والتشطيب",
    "الأثاث والفرش وتجهيز الوحدات",
    "الصيانة وإدارة العقارات",
    "الاستشارات والخدمات العقارية",
    "مكاتب التصميم الهندسي",
    "مهندسو الديكور والتصميم الداخلي",
    "السيراميك والبورسلين والأدوات الصحية",
    "الإضاءة ووحدات الإنارة",
    "الستائر والمفروشات"
  ];
  const profiles = [
    {
      id: "entity-marketing-2",
      name_ar: "مكتب تسويق للاختبار",
      entity_type: "marketing",
      service_category: "real_estate_marketing",
      marketplace_category: "الشركات والمكاتب العقارية",
      description: "تسويق ووساطة",
      public_visible: true,
      verification_status: "published"
    },
    {
      id: "entity-developer-2",
      name_ar: "شركة تطوير للاختبار",
      entity_type: "developer",
      service_category: "real_estate_development",
      marketplace_category: "المشروعات والمطورون العقاريون",
      description: "تطوير مشروعات",
      public_visible: true,
      verification_status: "published"
    },
    {
      id: "entity-service-2",
      name_ar: "شركة صيانة للاختبار",
      entity_type: "other",
      service_category: "maintenance_property_management",
      marketplace_category: "الصيانة وإدارة العقارات",
      description: "صيانة وإدارة عقارات",
      public_visible: true,
      verification_status: "published"
    }
  ];
  await page.route("**/rest/v1/**", async route => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").pop();
    if (table === "marketplace_categories") {
      return reply(route, categoryNames.map((name, index) => ({
        name, description: "قسم اختباري", display_order: index + 1, is_active: true
      })));
    }
    if (table === "directory_entities") return reply(route, profiles);
    if (table === "marketplace_listings") return reply(route, []);
    if (route.request().method() === "POST") return reply(route, [], 201);
    return reply(route, []);
  });

  await page.goto("/marketplace.html");

  const options = await page.locator("#marketplaceCategoryFilter option").allTextContents();
  expect(options).not.toContain("الشركات والمكاتب العقارية");
  expect(options).not.toContain("المشروعات والمطورون العقاريون");
  await expect(page.locator("#marketplaceServiceProfiles .mk-profile-card")).toHaveCount(1);
  await expect(page.locator("#marketplaceServiceProfiles")).toContainText("شركة صيانة للاختبار");
  await expect(page.locator("#marketplaceServiceProfiles")).not.toContainText("مكتب تسويق للاختبار");
  await expect(page.locator("#marketplaceServiceProfiles")).not.toContainText("شركة تطوير للاختبار");
  await expect(page.locator("#marketplaceServiceProfiles")).toContainText("مقدم خدمة");
});

test("verified company owner is sent from the companies page to the existing company profile", async ({ page }) => {
  const SUPABASE = "https://company-profile-owner.test.supabase.co";
  const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const COMPANY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const COMPANY = {
    id: COMPANY_ID,
    company_name: "شركة اختبار إدارة ملف التطوير",
    category: "شركات التطوير العقاري",
    description: "ملف شركة تجريبي لاختبار إدارة الملف من داخله.",
    services: ["تطوير عقاري"],
    city: "أسيوط",
    address: "أسيوط",
    phone: "01012345678",
    status: "active",
    verified_at: "2026-11-17T10:00:00Z",
    logo_url: null,
    gallery_urls: [],
    projects: []
  };

  await page.route("**/config.js*", route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: 'window.LAYAN_CONFIG = { SUPABASE_URL: "' + SUPABASE + '", SUPABASE_PUBLISHABLE_KEY: "test-publishable-key" };'
  }));
  await page.route("**/gubabase.js*", route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: 'window.LAYAN_SUPABASE = {' +
      'getSession: () => ({ access_token: "test-token", user: { id: "' + USER_ID + '" } }),' +
      'requireAuthenticated: async () => ({ user: { id: "' + USER_ID + '" } }),' +
      'isAuthenticated: () => true,' +
      'authedFetch: (url, options) => fetch(url, options)' +
    '};'
  }));
  await page.route(SUPABASE + "/rest/v1/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/rest/v1/", "");
    if (path === "rpc/layan_company_owner_profile") return reply(route, COMPANY);
    if (path === "company_profiles_public") return reply(route, [COMPANY]);
    if (path === "directory_entities") return reply(route, []);
    if (path === "company_profile_manager_members") return reply(route, []);
    return reply(route, []);
  });

  await page.goto("/companies.html");
  await page.locator("#companyRegisterOpen").click();
  await page.waitForURL("**/company.html?id=" + COMPANY_ID);

  await expect(page).toHaveURL(new URL("./company.html?id=" + COMPANY_ID, page.url()).href);
  await expect(page.locator(".company-topbar a[href='./company-dashboard.html']")).toHaveCount(0);
});
