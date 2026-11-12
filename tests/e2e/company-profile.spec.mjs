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
  await expect(page.locator("#companyProfileRoot a[href='tel:01012345678']")).toBeVisible();
  await expect(page.locator("#companyProfileRoot a[href='https://wa.me/01012345678']")).toBeVisible();
  await expect(page.locator("#companyProfileRoot a[href='https://example.com/']")).toBeVisible();
  await expect(page.locator("#companyProfileRoot .company-gallery img").first()).toHaveAttribute("src", approvedCompany.gallery_urls[0]);
});

test("company directory continues to render approved profiles from the public view", async ({ page }) => {
  await mockApprovedCompanyView(page);
  await page.goto("/companies.html");

  await expect(page.locator("#companyDirectoryGrid .company-directory-card")).toHaveCount(2);
  await expect(page.locator("#companyDirectoryGrid")).toContainText(approvedCompany.company_name);
  await expect(page.locator("#companyDirectoryGrid")).toContainText("البناء العربي استار");
  const seededCard = page.locator("#companyDirectoryGrid a[href='./company-albenaa-arabi-star.html']");
  await expect(seededCard).toBeVisible();
  await expect(seededCard.locator("img")).toHaveAttribute("src", "./assets/companies/albenaa-arabi-star.webp");
  await expect(seededCard).toContainText("ملف تعريفي");
  await expect(page.locator("#companyDirectoryCount")).toContainText("2 شركة / ملف تعريفي");
});
