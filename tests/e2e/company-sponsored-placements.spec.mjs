import { test, expect } from "@playwright/test";

const ads = [
  {
    id: "company-ad-later",
    business_name: "شركة الظهور الثاني",
    category: "تطوير عقاري",
    title: "مساحة تعريفية للشركة الثانية",
    description: "إعلان مخصص لدليل الشركات.",
    image_url: null,
    target_url: "https://example.com/second",
    contact_phone: "01098765432",
    placement_keys: ["company_directory"],
    placement_order: { company_directory: 2 },
    created_at: "2026-11-20T10:00:00Z"
  },
  {
    id: "company-ad-first",
    business_name: "شركة الظهور الأول",
    category: "تسويق عقاري",
    title: "مساحة تعريفية للشركة الأولى",
    description: "إعلان مخصص لدليل الشركات.",
    image_url: null,
    target_url: "https://example.com/first",
    contact_phone: "01012345678",
    placement_keys: ["company_directory", "featured"],
    placement_order: { company_directory: 0, featured: 1 },
    created_at: "2026-11-19T10:00:00Z"
  },
  {
    id: "featured-only-ad",
    business_name: "إعلان الإعلانات المميزة فقط",
    category: "خدمات عقارية",
    title: "هذا الإعلان ليس مخصصًا لصفحة الشركات",
    description: "يجب ألا يظهر في دليل الشركات.",
    image_url: null,
    target_url: null,
    contact_phone: "01011112222",
    placement_keys: ["featured"],
    placement_order: { featured: 0 },
    created_at: "2026-11-21T10:00:00Z"
  }
];

async function mockDirectoryApis(page, responseAds) {
  await page.route("**/rest/v1/**", async route => {
    const table = new URL(route.request().url()).pathname.split("/").pop();
    if (table === "public_active_supplier_ads") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(responseAds)
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

test("company directory shows only explicitly targeted sponsored ads in their manual order", async ({ page }) => {
  await mockDirectoryApis(page, ads);
  await page.goto("/companies.html");

  const section = page.locator("#companySponsoredAds");
  const cards = section.locator(".company-directory-sponsored-card");
  await expect(section).toBeVisible();
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("شركة الظهور الأول");
  await expect(cards.nth(1)).toContainText("شركة الظهور الثاني");
  await expect(section).not.toContainText("هذا الإعلان ليس مخصصًا لصفحة الشركات");
});

test("company sponsored section stays hidden when no active ad targets the company directory", async ({ page }) => {
  await mockDirectoryApis(page, ads.filter(ad => !ad.placement_keys.includes("company_directory")));
  await page.goto("/companies.html");

  await expect(page.locator("#companySponsoredAds")).toBeHidden();
});
