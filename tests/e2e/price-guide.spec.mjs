import { test, expect } from "@playwright/test";

const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";

function offer(id, purpose, price, rentalPeriod = null) {
  return {
    id,
    listing_purpose: purpose,
    city: "أسيوط",
    area: "المعلمين",
    property_type: "شقة",
    total_price: price,
    price_on_request: false,
    area_m2: 100,
    rental_period: rentalPeriod,
    status: "available",
    title: "إعلان عقاري",
    description: "عرض منشور لاختبار فصل مؤشرات الأسعار."
  };
}

const rows = [
  offer(1, "بيع", 900000),
  offer(2, "بيع", 950000),
  offer(3, "بيع", 1000000),
  offer(4, "تنازل", 700000),
  offer(5, "تنازل", 750000),
  offer(6, "تنازل", 800000),
  offer(7, "إيجار", 6000, "شهري"),
  offer(8, "إيجار", 6500, "شهري"),
  offer(9, "إيجار", 7000, "شهري"),
  offer(10, "إيجار", 60000, "سنوي"),
  offer(11, "إيجار", 66000, "سنوي"),
  offer(12, "إيجار", 72000, "سنوي"),
  offer(13, "إيجار", 300, "يومي"),
  offer(14, "إيجار", 350, "يومي")
];

async function mockPriceGuideOffers(page) {
  let requestedFields = "";
  await page.route(SUPABASE + "/rest/v1/property_offers**", async route => {
    const url = new URL(route.request().url());
    requestedFields = url.searchParams.get("select") || "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(rows)
    });
  });
  await page.goto("/price-guide.html");
  await expect.poll(() => requestedFields).not.toBe("");
  expect(requestedFields.split(",")).toContain("rental_period");
}

test("rent guide keeps daily, monthly and annual asking prices in separate groups", async ({ page }) => {
  await mockPriceGuideOffers(page);

  await page.getByRole("button", { name: "إيجار" }).click();

  const cards = page.locator(".price-guide-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("دورية الإيجار:");
  const annualListingsLink = page.locator(".price-guide-card").filter({ hasText: "سنوي" }).getByRole("link", { name: "عرض إعلانات المنطقة" });
  await expect(annualListingsLink).toHaveAttribute("href", /rental_period=%D8%B3%D9%86%D9%88%D9%8A/);
  await expect(page.locator("#priceGuideRentalPeriodField")).toBeVisible();
  await expect(page.locator("#priceGuideRentalPeriod option")).toHaveCount(4);
  await expect(page.locator("#priceGuideResults")).toContainText("جنيه / م² شهريًا");
  await expect(page.locator("#priceGuideResults")).toContainText("جنيه / م² سنويًا");
  await expect(page.locator("#priceGuideResults")).not.toContainText("جنيه / م² يوميًا");
  await expect(page.locator("#priceGuideSummary")).toContainText("2 مناطق ونوع عقار لديها عينة كافية");
});

test("rent period filter shows only the selected rental cadence", async ({ page }) => {
  await mockPriceGuideOffers(page);

  await page.getByRole("button", { name: "إيجار" }).click();
  await page.locator("#priceGuideRentalPeriod").selectOption("شهري");

  await expect(page.locator(".price-guide-card")).toHaveCount(1);
  await expect(page.locator("#priceGuideResults")).toContainText("جنيه / م² شهريًا");
  await expect(page.locator("#priceGuideResults")).not.toContainText("سنويًا");
});

test("sale and assignment indicators remain separate and assignment uses its total announced value", async ({ page }) => {
  await mockPriceGuideOffers(page);

  await expect(page.locator(".price-guide-card")).toHaveCount(1);
  await expect(page.locator(".price-guide-card")).toContainText("من سعر البيع الإجمالي");

  await page.getByRole("button", { name: "تنازل" }).click();
  await expect(page.locator(".price-guide-card")).toHaveCount(1);
  await expect(page.locator(".price-guide-card")).toContainText("من القيمة الإجمالية المعلنة للتنازل");
  await expect(page.locator("#priceGuideRentalPeriodField")).toBeHidden();
});
