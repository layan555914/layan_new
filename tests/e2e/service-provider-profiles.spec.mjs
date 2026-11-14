import { test, expect } from "@playwright/test";

const ENTITY_ID = "c1111111-1111-4111-8111-111111111401";
const USER_ID = "f7f77640-ae97-4722-8adb-5a88191eb401";
const USER = {
  id: USER_ID,
  email: "service-provider-test@example.invalid",
  email_confirmed_at: "2026-11-01T00:00:00Z",
  app_metadata: {},
  user_metadata: {}
};
const SESSION = {
  access_token: "service-provider-e2e-access-token",
  refresh_token: "service-provider-e2e-refresh-token",
  token_type: "bearer",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: USER
};
const ENTITY = {
  id: ENTITY_ID,
  name_ar: "شركة اختبار خدمات التشطيب",
  name_en: "Service Provider Test",
  entity_type: "other",
  service_category: "building_materials",
  description: "ملف تجريبي لخدمات مواد البناء والتشطيب.",
  website_url: "https://service-provider.example.invalid",
  public_phone: "01012345678",
  public_whatsapp: "01012345678",
  public_email: "service-provider@example.invalid",
  public_address: "شارع الجمهورية، أسيوط",
  public_logo_url: null,
  public_services: ["سيراميك", "أدوات صحية"],
  public_gallery_urls: ["https://assets.example.invalid/work-1.jpg"],
  public_business_hours: "من 10 صباحًا إلى 10 مساءً",
  public_coverage_areas: ["مدينة أسيوط"],
  primary_area_id: null,
  verification_status: "published",
  public_visible: true
};
const reply = (route, body, status = 200) => route.fulfill({
  status,
  contentType: "application/json",
  body: JSON.stringify(body)
});
async function seedAuthenticatedSession(page) {
  await page.addInitScript(session => {
    sessionStorage.setItem("layanSupabaseSession", JSON.stringify(session));
  }, SESSION);
}

test("marketplace displays approved service provider profiles separately from submitted service ads", async ({ page }) => {
  const serviceAd = {
    id: "ad-service-test-1",
    category: "مواد البناء والتشطيب",
    listing_type: "خدمة",
    title: "إعلان اختبار توريد مواد بناء",
    description: "إعلان مستقل أرسله مقدم خدمة.",
    city: "مدينة أسيوط",
    area: "شرق أسيوط",
    price: null,
    price_period: null,
    contact_phone: "01012345678",
    whatsapp: "01012345678",
    image_urls: [],
    details: {},
    latitude: null,
    longitude: null,
    created_at: "2026-11-14T08:00:00Z",
    is_featured: false
  };

  await page.route("**/rest/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split("/").pop();

    if (table === "marketplace_categories") return reply(route, []);
    if (table === "directory_entities") return reply(route, [ENTITY]);
    if (table === "marketplace_listings") return reply(route, [serviceAd]);
    if (request.method() === "POST") return reply(route, [], 201);
    return reply(route, []);
  });

  await page.goto("/marketplace.html");

  const profiles = page.locator("#marketplaceServiceProfiles .mk-profile-card");
  const ads = page.locator("#marketplaceListings .mk-card");
  await expect(profiles).toHaveCount(1);
  await expect(profiles).toContainText(ENTITY.name_ar);
  await expect(profiles).toContainText("ملف تعريفي مجاني");
  await expect(profiles).toHaveAttribute("href", "./company.html?entity_id=" + ENTITY_ID);
  await expect(ads).toHaveCount(1);
  await expect(ads).toContainText(serviceAd.title);
  await expect(page.locator("#marketplaceServiceProfiles")).not.toContainText(serviceAd.title);

  await page.locator("#marketplaceCategoryFilter").selectOption({ label: "مواد البناء والتشطيب" });
  await expect(profiles).toHaveCount(1);
  await expect(ads).toHaveCount(1);
});

test("an approved representative submits profile changes for review without directly updating the public entity", async ({ page }) => {
  await seedAuthenticatedSession(page);
  const state = { submitted: [], directEntityPatches: 0 };

  await page.route("**/auth/v1/user", async route => reply(route, USER));
  await page.route("**/rest/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const table = path.split("/").pop();

    if (table === "directory_entities" && request.method() === "PATCH") {
      state.directEntityPatches += 1;
      return reply(route, [ENTITY]);
    }
    if (table === "directory_entities") return reply(route, [ENTITY]);
    if (table === "directory_entity_sources") return reply(route, []);
    if (table === "directory_sources") return reply(route, []);
    if (table === "company_entity_managers") {
      return reply(route, [{ directory_entity_id: ENTITY_ID, owner_user_id: USER_ID }]);
    }
    if (table === "company_entity_profile_update_requests") return reply(route, []);
    if (path.endsWith("/rpc/company_entity_profile_update_submit")) {
      state.submitted.push(request.postDataJSON());
      return reply(route, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb401");
    }
    if (request.method() === "POST") return reply(route, [], 201);
    return reply(route, []);
  });

  await page.goto("/company.html?entity_id=" + ENTITY_ID);

  const form = page.locator("#companyManagerForm");
  await expect(form).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".company-claim-panel")).toBeHidden();
  await form.locator("[name='name_ar']").fill("شركة اختبار خدمات التشطيب بعد التحديث");
  await form.locator("[name='service_category']").selectOption("finishing_decoration");
  await form.locator("[name='description']").fill("خدمات تشطيب وديكور تجريبية.");
  await form.locator("[name='public_services']").fill("تشطيب داخلي\nديكور");
  await form.locator("[name='public_coverage_areas']").fill("مدينة أسيوط\nأسيوط الجديدة");
  await form.locator("button[type='submit']").click();

  await expect(page.locator("#companyManagerStatus")).toContainText("تم إرسال التعديل بنجاح");
  expect(state.submitted).toHaveLength(1);
  expect(state.submitted[0]).toMatchObject({
    p_directory_entity_id: ENTITY_ID,
    p_payload: {
      name_ar: "شركة اختبار خدمات التشطيب بعد التحديث",
      service_category: "finishing_decoration",
      public_services: ["تشطيب داخلي", "ديكور"],
      public_coverage_areas: ["مدينة أسيوط", "أسيوط الجديدة"]
    }
  });
  expect(state.directEntityPatches).toBe(0);
  await expect(form.locator("button[type='submit']")).toBeDisabled();
});

test("admin can approve a service provider profile update from the dedicated review queue", async ({ page }) => {
  await seedAuthenticatedSession(page);
  page.on("dialog", dialog => dialog.accept());
  const pending = {
    id: "cccccccc-cccc-4ccc-8ccc-ccccccccc401",
    directory_entity_id: ENTITY_ID,
    company_name: ENTITY.name_ar,
    entity_type: "other",
    service_category: "building_materials",
    requester_user_id: USER_ID,
    payload: { name_ar: "اسم جديد بعد المراجعة", service_category: "finishing_decoration" },
    status: "pending",
    admin_notes: null,
    created_at: "2026-11-14T08:00:00Z"
  };
  const state = { reviews: [], pending: [pending] };

  await page.route("**/auth/v1/user", async route => reply(route, USER));
  await page.route("**/rest/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith("/rpc/layan_is_admin")) return reply(route, true);
    if (path.endsWith("/rpc/layan_admin_whoami")) return reply(route, "owner");
    if (path.endsWith("/rpc/company_entity_profile_update_admin_list")) return reply(route, state.pending);
    if (path.endsWith("/rpc/company_entity_profile_update_admin_review")) {
      state.reviews.push(request.postDataJSON());
      state.pending = [];
      return reply(route, "approved");
    }
    if (request.method() === "POST") return reply(route, [], 201);
    return reply(route, []);
  });

  await page.goto("/admin.html");
  await page.locator("[data-view='review']").click();

  const card = page.locator("#pendingCompanyEntityUpdates [data-company-entity-update-id]");
  await expect(card).toHaveCount(1, { timeout: 15000 });
  await expect(card).toContainText(ENTITY.name_ar);
  await expect(card).toContainText("اسم جديد بعد المراجعة");
  await card.locator("[data-entity-profile-update-action='approve']").click();

  await expect(page.locator("#adminStatus")).toContainText("تم اعتماد تعديلات الملف");
  expect(state.reviews).toHaveLength(1);
  expect(state.reviews[0]).toMatchObject({
    p_id: pending.id,
    p_action: "approve",
    p_note: null
  });
  await expect(card).toHaveCount(0);
});
