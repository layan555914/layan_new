import { test, expect } from "@playwright/test";

const STAGING_URL = String(process.env.STAGING_SUPABASE_URL || "").replace(/\/$/, "");
const STAGING_KEY = String(process.env.STAGING_SUPABASE_PUBLISHABLE_KEY || "");
const enabled = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(STAGING_URL)
  && STAGING_KEY.startsWith("sb_publishable_");
const RUN_TAG = String(process.env.GITHUB_RUN_ID || "manual-" + Date.now());
const TEST_EMAIL = "layan-staging-owner-" + RUN_TAG + "@example.invalid";
const TEST_PASSWORD = "Staging-E2E-Only-2026!";

test.describe("Hosted staging — create a disposable real Auth account", () => {
  test.use({ serviceWorkers: "block" });
  test.skip(!enabled, "Staging credentials are supplied only in the dedicated CI job.");

  test("real platform signup creates one isolated temporary account", async ({ page }) => {
    const configSource = [
      "window.LAYAN_CONFIG = {",
      "  SUPABASE_URL: " + JSON.stringify(STAGING_URL) + ",",
      "  SUPABASE_PUBLISHABLE_KEY: " + JSON.stringify(STAGING_KEY),
      "};"
    ].join("\n");

    await page.route("**/config.js*", route => route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: configSource
    }));

    const productionUrl = "https://ebyhwqkmhxbgocngpqfe.supabase.co";
    await page.route(productionUrl + "/**", route => route.continue({
      url: route.request().url().replace(productionUrl, STAGING_URL)
    }));

    await page.goto("/");
    await page.locator("#loginBtn").click();
    await expect(page.locator("#authDialog")).toBeVisible();
    await page.locator("#authToggle").click();
    await expect(page.locator("#authSubmit")).toHaveText("إنشاء الحساب");
    await expect(page.locator("#forgotPasswordBtn")).toBeHidden();

    await page.locator("#authEmail").fill(TEST_EMAIL);
    await page.locator("#authPassword").fill(TEST_PASSWORD);

    const signupResponsePromise = page.waitForResponse(response =>
      response.url().includes("/auth/v1/signup") && response.request().method() === "POST"
    );
    await page.locator("#authSubmit").click();
    const signupResponse = await signupResponsePromise;
    const responseBody = await signupResponse.json().catch(() => ({}));

    console.log("STAGING_AUTH_SIGNUP_HTTP:", signupResponse.status());
    console.log("STAGING_AUTH_SIGNUP_RESPONSE:", JSON.stringify(responseBody).slice(0, 1600));
    console.log("STAGING_AUTH_TEST_EMAIL:", TEST_EMAIL);
    console.log("STAGING_AUTH_TEST_USER_ID:", responseBody?.user?.id || responseBody?.id || "LOOKUP_BY_EMAIL");

    expect(signupResponse.status(), "Staging Auth signup should accept the disposable test identity").toBe(200);
    await expect(page.locator("#authStatus"))
      .toContainText("تم إنشاء الحساب بنجاح");
  });
});
