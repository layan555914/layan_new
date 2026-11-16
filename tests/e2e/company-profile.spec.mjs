import { test, expect } from "@playwright/test";

const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const COMPANY_ID = "c1111111-1111-4111-8111-111111111111";

const approvedCompany = {
  id: COMPANY_ID,
  company_name: "شركة اختبار أسيوط",
  category: "شركات عقارية",
  description: "شركة تجريبية لاختبار عرض ملفات الشركات المعتمدة داخل المنصة.",
  services: ["تسويق عقاري", "استشارات هندسية"],
  city: "أسيوط",
  logo_url: null,
  address: "شارع الجمهورية - أسيوط",
  phone: "01012345678",
  whatsapp: "01012345678",
  website: "https://example.com",
  gallery_urls: ["https://assets.example.invalid/company-work.jpg"],
  projects: [{ title: "مشروع تجريبي", description: "وصف مشروع لاختبار ملف الشركة." }]
};

async function mockApprovedCompanyView(page) {
  await page.route(SUPABASE + "/rest/v1/directory_entities**", async route => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });
  await page.route(SUPABASE + "/rest/v1/company_profiles_public**", async route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.searchParams.get("id") === "eq." + COMPANY_ID) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([approvedCompany]) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([approvedCompany]) });
  });
}

test("approved company profile page reads public contact and portfolio fields from the public view", async ({ page }) => {
  await mockApprovedCompanyView(page);
  await page.goto("/company.html?id=" + COMPANY_ID);

  await expect(page.locator("#companyProfileRoot h1")).toHaveText(approvedCompany.company_name);
  await expect(page.locator("#companyProfileRoot")).toContainText("استشارات هندسية");
  await expect(page.locator("#companyProfileRoot")).toContainText("مشروع تجريبي");
  await expect(page.locator("#companyProfileRoot")).toContainText("شارع الجمهورية");
  await expect(page.locator("#companyProfileRoot a.company-contact-primary[href='tel:01012345678']")).toBeVisible();
  await expect(page.locator("#companyProfileRoot a.company-contact-secondary[href='https://wa.me/01012345678']")).toBeVisible();
  await expect(page.locator("#companyProfileRoot a.company-contact-secondary[href='https://example.com/']")).toBeVisible();
  await expect(page.locator("#companyProfileRoot .company-gallery img").first()).toHaveAttribute("src", approvedCompany.gallery_urls[0]);
});

test("company directory continues to render approved profiles from the public view", async ({ page }) => {
  await mockApprovedCompanyView(page);
  await page.goto("/companies.html");

  const companyCard = page.locator("#marketingCompaniesGrid .company-directory-card").filter({ hasText: approvedCompany.company_name });
  await expect(companyCard).toHaveCount(1);
  await expect(companyCard).toContainText(approvedCompany.company_name);
  await expect(page.locator("#companyDirectoryCount")).toContainText("1 ملفًا متاحًا");
});


const DIRECTORY_ENTITY_ID = "d2222222-2222-4222-8222-222222222222";
const publicDirectoryEntity = {
  id: DIRECTORY_ENTITY_ID,
  name_ar: "مكتب اختبار أسيوط",
  name_en: "Assiut Test Office",
  entity_type: "contractor",
  service_category: "contracting_construction",
  description: "جهة تجريبية لاختبار وضوح ملف الدليل وأزرار التواصل على الهاتف.",
  website_url: "https://example.com",
  public_phone: "01023456789",
  public_email: null,
  public_address: "شارع الجمهورية - أسيوط",
  public_whatsapp: "01023456789",
  public_logo_url: null,
  public_services: ["مقاولات", "تشطيبات"],
  public_gallery_urls: [],
  public_business_hours: null,
  public_coverage_areas: ["أسيوط"],
  primary_area_id: null,
  latitude: null,
  longitude: null,
  location_public: false,
  location_precision: null,
  location_source_id: null,
  location_verified_at: null,
  verification_status: "published",
  representative_verified_at: null,
  public_visible: true
};

test("directory entity profile clearly labels missing logo and all mobile actions", async ({ page }) => {
  await page.route(SUPABASE + "/rest/v1/directory_entities**", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([publicDirectoryEntity])
    });
  });
  await page.route(SUPABASE + "/rest/v1/directory_entity_sources**", async route => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/company.html?entity_id=" + DIRECTORY_ENTITY_ID);

  await expect(page.locator("#companyProfileRoot h1")).toHaveText(publicDirectoryEntity.name_ar);
  await expect(page.locator(".company-logo-fallback")).toContainText("لا يتوفر شعار موثّق");
  await expect(page.locator(".company-profile-logo img")).toHaveCount(0);
  await expect(page.locator(".company-contact-actions")).not.toContainText("الخط الساخن الرسمي");
  await expect(page.locator(".company-contact-actions a")).toHaveCount(4);
  await expect(page.locator(".company-claim-panel--prominent")).toContainText("استلم ملفك مجانًا");
  await expect(page.locator(".company-claim-panel--prominent button")).toBeVisible();
  await expect(page.locator(".company-contact-details")).toContainText("بيانات التواصل ومقر مقدم الخدمة");
  await expect(page.locator(".company-coverage-section")).toContainText("أسيوط");
  for (const action of await page.locator(".company-contact-actions a").all()) {
    await expect(action).toBeVisible();
    await expect(action).toHaveCSS("min-height", /^(48|50)px$/);
    await expect(action).not.toBeEmpty();
  }

  await page.locator("#companyClaimOpen").click();
  const closeButton = page.locator("#companyClaimClose");
  await expect(closeButton).toBeVisible();
  await expect(closeButton).toContainText("إغلاق");
  await expect(closeButton).toHaveAttribute("aria-label", "إغلاق نافذة طلب استلام الملف");
  await closeButton.click();
  await expect(page.locator("#companyClaimDialog")).not.toBeVisible();
});

test("official company website supplies its verified logo and clearly labeled general hotline when the directory has no phone", async ({ page }) => {
  const primeOffice = {
    ...publicDirectoryEntity,
    id: "d3333333-3333-4333-8333-333333333333",
    name_ar: "برايم للتطوير العقاري – مكتب مبيعات أسيوط",
    entity_type: "sales_office",
    service_category: "real_estate_sales",
    website_url: "https://www.primedev-eg.com/Arabic/",
    public_phone: null,
    public_email: "info@primedev-eg.com",
    public_address: "مكتب مبيعات أسيوط: مول الوطنية، الدور الأرضي",
    public_whatsapp: null,
    public_logo_url: null,
    public_services: [],
    public_gallery_urls: [],
    public_coverage_areas: []
  };

  await page.route(SUPABASE + "/rest/v1/directory_entities**", async route => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([primeOffice]) });
  });
  await page.route(SUPABASE + "/rest/v1/directory_entity_sources**", async route => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/company.html?entity_id=" + primeOffice.id);

  const logo = page.locator(".company-directory-entity-monogram img");
  await expect(logo).toHaveAttribute("src", "https://www.primedev-eg.com/assets/img/logo-prime.png");
  await expect(logo).toHaveAttribute("alt", "شعار " + primeOffice.name_ar);
  await expect(page.locator(".company-contact-actions a[href='tel:+2015898']")).toHaveText("اتصل بالخط الساخن الرسمي");
  await expect(page.locator(".company-contact-details")).toContainText("الخط الساخن الرسمي للشركة");
  await expect(page.locator(".company-contact-details")).toContainText("+20 15898");
  await expect(page.locator(".company-contact-details")).toContainText("مكتب مبيعات أسيوط");
  await expect(page.locator(".company-contact-details")).toContainText("info@primedev-eg.com");
  await expect(page.locator(".company-map-panel")).toContainText("بحث استرشادي");
  await expect(page.locator(".company-claim-panel--prominent")).toContainText("استلم ملفك مجانًا");
});

test("broken public logo and missing contacts show honest fallback content", async ({ page }) => {
  const incompleteProfile = {
    ...publicDirectoryEntity,
    name_ar: "جهة بدون بيانات اتصال",
    website_url: null,
    public_phone: null,
    public_email: null,
    public_address: null,
    public_whatsapp: null,
    public_logo_url: "https://assets.example.invalid/broken-logo.svg",
    public_services: [],
    public_gallery_urls: [],
    public_coverage_areas: []
  };

  await page.route(SUPABASE + "/rest/v1/directory_entities**", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([incompleteProfile])
    });
  });
  await page.route(SUPABASE + "/rest/v1/directory_entity_sources**", async route => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("https://assets.example.invalid/broken-logo.svg", route => route.abort());

  await page.goto("/company.html?entity_id=" + DIRECTORY_ENTITY_ID);

  await expect(page.locator(".company-detail-empty")).toContainText("لم تُنشر بيانات التواصل أو العنوان");
  await expect(page.locator(".company-logo-fallback")).toContainText("تعذر تحميل الشعار الرسمي");
  await expect(page.locator(".company-profile-logo img")).toHaveCount(0);
  await expect(page.locator(".company-contact-actions a")).toHaveCount(0);
  await expect(page.locator(".company-claim-panel--prominent")).toContainText("استلم ملفك مجانًا");
});

test("static provider profile uses the shared profile layout and styled branch actions", async ({ page }) => {
  await page.goto("/company-albenaa-arabi-star.html");

  await expect(page.locator(".company-profile-hero h1")).toHaveText("البناء العربي استار");
  await expect(page.locator(".company-profile-logo img")).toBeVisible();
  await expect(page.locator(".branch .phone").first()).toBeVisible();
  await expect(page.locator(".branch .phone").first()).toHaveCSS("display", "flex");
  await expect(page.getByRole("link", { name: /اتصال: 01012588382/ })).toBeVisible();
});
