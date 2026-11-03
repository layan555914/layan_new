import { test, expect } from "@playwright/test";

const STAGING_URL = String(process.env.STAGING_SUPABASE_URL || "").replace(/\/$/, "");
const STAGING_KEY = String(process.env.STAGING_SUPABASE_PUBLISHABLE_KEY || "");
const enabled = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(STAGING_URL)
  && STAGING_KEY.startsWith("sb_publishable_");

test.describe("Hosted staging — real public pages and Auth rejection", () => {
  test.skip(!enabled, "Hosted staging credentials are supplied only in the dedicated CI job.");

  test.beforeEach(async ({ page }) => {
    const configSource = [
      "window.LAYAN_CONFIG = {",
      "  SUPABASE_URL: " + JSON.stringify(STAGING_URL) + ",",
      "  SUPABASE_PUBLISHABLE_KEY: " + JSON.stringify(STAGING_KEY),
      "};"
    ].join("\n");

    // Override only the browser config for this test page. No repository or
    // production config file is changed.
    await page.route("**/config.js*", route => route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: configSource
    }));
  });

  test("homepage lists the two synthetic offers and opens property details", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator("#offersGrid .offer-card");
    await expect(cards).toHaveCount(2);
    await expect(page.locator("#offersGrid")).toContainText("اختبار واجهة — شقة وهمية");
    await expect(page.locator("#offersGrid")).toContainText("اختبار واجهة — محل تجاري وهمي");

    await cards.filter({ hasText: "اختبار واجهة — شقة وهمية" })
      .getByRole("link", { name: "عرض التفاصيل" }).click();

    await expect(page).toHaveURL(/property\.html\?id=[1-9][0-9]*/);
    await expect(page.locator("#propertyDetailsRoot"))
      .toContainText("اختبار واجهة — شقة وهمية");
    await expect(page.locator("#propertyDetailsRoot"))
      .toContainText("بيانات اصطناعية");
  });

  test("marketplace loads all 11 database categories and the approved synthetic card", async ({ page }) => {
    await page.goto("/marketplace.html");
    const categories = page.locator(".category-grid .category-tile");
    await expect(categories).toHaveCount(11);
    await expect(categories.first().locator("span"))
      .toContainText("بيانات اختبار اصطناعية");

    const cards = page.locator("#marketplaceListings .listing-card");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("اختبار واجهة — إعلان تنازل وهمي");

    await page.locator("#marketplaceCategoryFilter").selectOption("التنازلات العقارية");
    await expect(page.locator("#marketplaceListings .listing-card")).toHaveCount(1);
  });

  test("directory renders only the published synthetic entity, project, area and opportunity", async ({ page }) => {
    await page.goto("/directory.html");

    const results = page.locator("#directoryResults");
    await expect(results.locator(".directory-card")).toHaveCount(1);
    await expect(results).toContainText("شركة تطوير افتراضية — سجل اختبار");

    await page.locator('.directory-tabs button[data-view="projects"]').click();
    await expect(results.locator(".directory-card")).toHaveCount(1);
    await expect(results).toContainText("مشروع سكني افتراضي — سجل اختبار");

    await page.locator('.directory-tabs button[data-view="areas"]').click();
    await expect(results.locator(".directory-card")).toHaveCount(3);
    await expect(results).toContainText("منطقة اختبار 01");

    await page.locator('.directory-tabs button[data-view="opportunities"]').click();
    await expect(results.locator(".directory-card")).toHaveCount(1);
    await expect(results).toContainText("فرصة افتراضية — سجل اختبار");
  });

  test("login dialog is usable and rejects a deliberately nonexistent test identity", async ({ page }) => {
    await page.goto("/marketplace.html");
    await page.locator("#authOpen").click();

    await expect(page.locator("#authDialog")).toBeVisible();
    await expect(page.locator("#forgotPassword")).toBeVisible();

    const email = "nonexistent-staging-check-" + Date.now() + "@example.invalid";
    await page.locator("#authForm input[name='email']").fill(email);
    await page.locator("#authForm input[name='password']").fill("Not-A-Real-Account-Password-987!");
    const authResponsePromise = page.waitForResponse(response =>
      response.url().includes("/auth/v1/token") && response.request().method() === "POST"
    );
    await page.locator("#authSubmit").click();

    const authResponse = await authResponsePromise;
    expect([400, 401]).toContain(authResponse.status());
    await expect(page.locator("#authStatus")).not.toBeEmpty();
    await expect(page.locator("#authDialog")).toBeVisible();
  });
});
