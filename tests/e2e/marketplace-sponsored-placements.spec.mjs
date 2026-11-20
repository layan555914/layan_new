import { test, expect } from "@playwright/test";

const ads = [
  {
    id: "ceramic-ad",
    business_name: "معرض النخبة",
    category: "سيراميك وبورسلين",
    title: "أحدث موديلات السيراميك والبورسلين",
    description: "تشكيلات متنوعة للأرضيات والحوائط.",
    image_url: null,
    target_url: "https://example.com/ceramics",
    contact_phone: "01012345678",
    created_at: "2026-11-20T10:00:00Z"
  },
  {
    id: "furniture-ad",
    business_name: "معرض البيت",
    category: "مطابخ وأثاث",
    title: "مطابخ وأثاث حسب الطلب",
    description: "تصميم وتجهيز الوحدات.",
    image_url: null,
    target_url: null,
    contact_phone: "01098765432",
    created_at: "2026-11-19T10:00:00Z"
  },
  {
    id: "developer-ad",
    business_name: "شركة تطوير",
    category: "مطور عقاري / مشروع",
    title: "مشروع سكني جديد",
    description: "وحدات سكنية متنوعة.",
    image_url: null,
    target_url: null,
    contact_phone: "01011112222",
    created_at: "2026-11-18T10:00:00Z"
  }
];

test("marketplace shows active sponsored ads and filters them by the selected service category", async ({ page }) => {
  await page.route("**/rest/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split("/").pop();
    if (table === "public_active_supplier_ads") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ads) });
    }
    if (table === "marketplace_categories") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    if (table === "directory_entities" || table === "marketplace_listings") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/marketplace.html");

  const sponsoredSection = page.locator("#marketplaceFeaturedAds");
  const cards = sponsoredSection.locator(".mk-sponsored-card");
  await expect(cards).toHaveCount(2);
  await expect(cards).toContainText("معرض النخبة");
  await expect(cards).toContainText("معرض البيت");
  await expect(cards).not.toContainText("شركة تطوير");
  await expect(sponsoredSection).toContainText("إعلانات مميزة في سوق الخدمات");

  await page.locator("#marketplaceCategoryFilter").selectOption({ label: "السيراميك والبورسلين والأدوات الصحية" });
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText("معرض النخبة");
  await expect(cards).not.toContainText("معرض البيت");
  await expect(sponsoredSection).toContainText("إعلانات مميزة في السيراميك والبورسلين والأدوات الصحية");

  await page.locator("#marketplaceCategoryFilter").selectOption({ label: "الأثاث والفرش وتجهيز الوحدات" });
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText("معرض البيت");
  await expect(cards).not.toContainText("معرض النخبة");
});

test("a category without an active ad offers a clear route to request an ad", async ({ page }) => {
  await page.route("**/rest/v1/**", async route => {
    const table = new URL(route.request().url()).pathname.split("/").pop();
    if (table === "public_active_supplier_ads") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ads) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/marketplace.html");
  await page.locator("#marketplaceCategoryFilter").selectOption({ label: "الإضاءة ووحدات الإنارة" });

  const sponsoredSection = page.locator("#marketplaceFeaturedAds");
  await expect(sponsoredSection).toBeVisible();
  await expect(sponsoredSection).toContainText("لا توجد إعلانات مميزة في هذا القسم حاليًا");
  await expect(sponsoredSection.locator("a[href='./advertise.html']")).toBeVisible();
});