import { test, expect } from "@playwright/test";

const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const offer = (id, overrides = {}) => ({
  city: "مدينة أسيوط",
  area: "الهضبة",
  property_type: "شقة",
  listing_purpose: "بيع",
  area_m2: 100,
  total_price: 1000000 + (id * 100000),
  price_on_request: false,
  created_at: "2026-11-10T10:00:00.000Z",
  updated_at: "2026-11-15T10:00:00.000Z",
  ...overrides
});

async function mockOffers(page, rows, checkRequest = () => {}) {
  await page.route(SUPABASE + "/rest/v1/property_offers?*", async route => {
    const url = new URL(route.request().url());
    checkRequest(url);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(rows)
    });
  });
}

test("price guide loads only public available and verified fields and hides estimates for small samples", async ({ page }) => {
  const rows = [offer(1), offer(2), offer(3), offer(4)];
  await mockOffers(page, rows, url => {
    expect(url.searchParams.get("status")).toBe("eq.available");
    expect(url.searchParams.get("verification_status")).toBe("eq.verified");
    const fields = url.searchParams.get("select") || "";
    expect(fields).toContain("total_price");
    expect(fields).toContain("area_m2");
    expect(fields).not.toContain("contact_phone");
    expect(fields).not.toContain("owner_id");
  });

  await page.goto("/market-prices.html");
  await expect(page.locator(".mp-card")).toHaveCount(1);
  await expect(page.locator("#mpTotal")).toHaveText("4");
  await expect(page.locator(".mp-indicator")).toContainText("العينة غير كافية حتى الآن");
  await expect(page.locator(".mp-indicator")).toContainText("4 من 5");
  await expect(page.locator(".mp-indicator")).not.toContainText("جنيه/م²");
});

test("price guide shows median per square metre only after five comparable sale listings", async ({ page }) => {
  await mockOffers(page, [1, 2, 3, 4, 5].map(id => offer(id, { total_price: 1000000 + (id * 100000) })));
  await page.goto("/market-prices.html");
  await expect(page.locator(".mp-indicator.is-ready")).toContainText("13,000 جنيه/م²");
  await expect(page.locator(".mp-indicator.is-ready")).toContainText("5 إعلانات مكتملة");
});

test("price guide does not combine rental amounts before rental periods are standardized", async ({ page }) => {
  const rows = [1, 2, 3, 4, 5].map(id => offer(id, {
    listing_purpose: "إيجار",
    total_price: 5000 + (id * 100),
    price_period: undefined
  }));
  await mockOffers(page, rows);
  await page.goto("/market-prices.html");
  await expect(page.locator(".mp-indicator")).toContainText("مدة الإيجار غير موحدة");
  await expect(page.locator(".mp-indicator")).not.toContainText("جنيه/م²");
});

test("price guide filters by city, property type and transaction", async ({ page }) => {
  await mockOffers(page, [
    ...[1, 2, 3, 4, 5].map(id => offer(id)),
    offer(6, { city: "ديروط", area: "وسط البلد", property_type: "محل", total_price: 750000 })
  ]);
  await page.goto("/market-prices.html");
  await page.locator("#mpCity").selectOption({ label: "ديروط" });
  await page.locator("#mpType").selectOption({ label: "محل" });
  await page.locator("#mpPurpose").selectOption("بيع");
  await expect(page.locator(".mp-card")).toHaveCount(1);
  await expect(page.locator(".mp-card")).toContainText("ديروط");
  await expect(page.locator(".mp-card")).toContainText("محل");
});
