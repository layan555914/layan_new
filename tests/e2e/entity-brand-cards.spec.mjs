import { test, expect } from "@playwright/test";

const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const ENTITY_ID = "a1111111-1111-4111-8111-111111111111";
const ENTITY = {
  id: ENTITY_ID, name_ar: "شركة شعار الاختبار", name_en: "Brand Test Company",
  entity_type: "contractor", service_category: "building_materials",
  marketplace_category: "مواد البناء والتشطيب",
  description: "ملف اختبار لعرض الشعار الرسمي بنفس التنسيق في الأقسام الثلاثة.",
  website_url: "https://brand-test.example", public_phone: "01012345678",
  public_address: "شارع الجمهورية، أسيوط",
  public_logo_url: "https://assets.example.invalid/brand-test-logo.png",
  public_services: ["سيراميك", "أدوات صحية"], primary_area_id: null,
  verification_status: "published", public_visible: true
};
const PRIME = {
  ...ENTITY, id: "83a687c0-eee6-497b-89d9-9fba70d4474f",
  name_ar: "برايم للتطوير العقاري – مكتب مبيعات أسيوط",
  entity_type: "sales_office", service_category: "real_estate_sales",
  marketplace_category: "الشركات والمكاتب العقارية",
  website_url: "https://www.primedev-eg.com/Arabic/", public_logo_url: null
};
const DEVELOPER = {
  ...ENTITY, id: "d4444444-4444-4444-8444-444444444444",
  name_ar: "شركة اختبار التطوير العقاري",
  entity_type: "developer", service_category: "real_estate_development",
  marketplace_category: "المشروعات والمطورون العقاريون",
  website_url: "https://developer-test.example",
  public_logo_url: "https://assets.example.invalid/developer-logo.png"
};
const OWNER_PROFILE = {
  id: "b2222222-2222-4222-8222-222222222222",
  company_name: "شركة ملف مقدم من المالك", category: "شركات عقارية",
  description: "ملف معتمد من الشركة.", services: ["تسويق عقاري"],
  city: "أسيوط", logo_url: "https://assets.example.invalid/owner-logo.png"
};
const PRIME_LOGO = "https://www.primedev-eg.com/assets/img/logo-prime.png";
const expectedBrandWidth = page => page.viewportSize().width <= 520 ? "72px" : "76px";
const reply = (route, body, status = 200) => route.fulfill({
  status, contentType: "application/json", body: JSON.stringify(body)
});

test("company directory separates company logos from service-provider profiles", async ({ page }) => {
  await page.route(SUPABASE + "/rest/v1/**", async route => {
    const table = new URL(route.request().url()).pathname.split("/").pop();
    if (table === "company_profiles_public") return reply(route, [OWNER_PROFILE]);
    if (table === "directory_entities") return reply(route, [ENTITY, PRIME, DEVELOPER]);
    return reply(route, []);
  });
  await page.goto("/companies.html");
  const marketing = page.locator("#marketingCompaniesGrid");
  const developers = page.locator("#developmentCompaniesGrid");
  const ownerCard = marketing.locator(".company-directory-card--owner");
  const primeCard = marketing.locator(".company-directory-card--directory").filter({ hasText: PRIME.name_ar });
  const developerCard = developers.locator(".company-directory-card--directory").filter({ hasText: DEVELOPER.name_ar });
  await expect(ownerCard.locator(".aq-entity-brand img")).toHaveAttribute("src", OWNER_PROFILE.logo_url);
  await expect(primeCard.locator(".aq-entity-brand img")).toHaveAttribute("src", PRIME_LOGO);
  await expect(developerCard.locator(".aq-entity-brand img")).toHaveAttribute("src", DEVELOPER.public_logo_url);
  await expect(marketing).not.toContainText(ENTITY.name_ar);
  await expect(developers).not.toContainText(ENTITY.name_ar);
  await expect(marketing).not.toContainText(DEVELOPER.name_ar);
  await expect(developers).not.toContainText(PRIME.name_ar);
  await expect(ownerCard.locator(".aq-entity-brand")).toHaveCSS("width", expectedBrandWidth(page));
  await expect(developerCard.locator(".aq-entity-brand")).toHaveCSS("width", expectedBrandWidth(page));
});

test("services marketplace shows provider and official Prime logos in the shared frame", async ({ page }) => {
  await page.route(SUPABASE + "/rest/v1/**", async route => {
    const table = new URL(route.request().url()).pathname.split("/").pop();
    if (table === "directory_entities") return reply(route, [ENTITY, PRIME, DEVELOPER]);
    return reply(route, []);
  });
  await page.goto("/marketplace.html");
  const cards = page.locator("#marketplaceServiceProfiles .mk-profile-card");
  const entityCard = cards.filter({ hasText: ENTITY.name_ar });
  await expect(cards).toHaveCount(1);
  await expect(entityCard.locator(".aq-entity-brand img")).toHaveAttribute("src", ENTITY.public_logo_url);
  await expect(cards).not.toContainText(PRIME.name_ar);
  await expect(cards).not.toContainText(DEVELOPER.name_ar);
  await expect(entityCard.locator(".aq-entity-brand")).toHaveCSS("width", expectedBrandWidth(page));
});

test("real-estate directory displays public and official logos plus a labeled fallback when missing", async ({ page }) => {
  await page.route(SUPABASE + "/rest/v1/**", async route => {
    const table = new URL(route.request().url()).pathname.split("/").pop();
    if (table === "directory_entities") return reply(route, [
      ENTITY, PRIME,
      { ...ENTITY, id: "c3333333-3333-4333-8333-333333333333", name_ar: "مكتب بلا شعار", public_logo_url: null, website_url: null }
    ]);
    return reply(route, []);
  });
  await page.goto("/directory.html");
  const logoCard = page.locator("#directoryResults .directory-card").filter({ hasText: ENTITY.name_ar });
  const primeCard = page.locator("#directoryResults .directory-card").filter({ hasText: PRIME.name_ar });
  const fallbackCard = page.locator("#directoryResults .directory-card").filter({ hasText: "مكتب بلا شعار" });
  await expect(logoCard.locator(".aq-entity-brand img")).toHaveAttribute("src", ENTITY.public_logo_url);
  await expect(primeCard.locator(".aq-entity-brand img")).toHaveAttribute("src", PRIME_LOGO);
  await expect(logoCard.locator(".aq-entity-brand")).toHaveCSS("width", expectedBrandWidth(page));
  await expect(fallbackCard.locator(".aq-entity-brand__fallback")).toBeVisible();
  await expect(fallbackCard.locator(".aq-entity-brand__fallback strong")).toHaveText("م");
});
