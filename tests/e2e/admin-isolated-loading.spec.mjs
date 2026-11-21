import { test, expect } from "@playwright/test";

const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const ADMIN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

async function mockAdminWithOneBrokenSection(page) {
  const state = { companyProfileListCalls: 0, loadedEndpoints: [] };
  const user = {
    id: ADMIN_ID,
    email: "admin-stability@example.invalid",
    email_confirmed_at: "2026-11-01T00:00:00Z",
    app_metadata: {},
    user_metadata: {}
  };
  const reply = (route, body, status = 200) => route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  });

  await page.route(SUPABASE + "/**", async route => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();

    if (path === "/auth/v1/otp") return reply(route, {});
    if (path === "/auth/v1/verify") return reply(route, {
      access_token: "admin-test-token",
      refresh_token: "admin-test-refresh",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user
    });
    if (path === "/auth/v1/user") return reply(route, user);
    if (path.startsWith("/auth/v1/")) return reply(route, {});

    if (path.startsWith("/rest/v1/rpc/")) {
      const name = path.split("/").pop();
      state.loadedEndpoints.push(name);
      if (name === "layan_is_admin") return reply(route, true);
      if (name === "layan_admin_list_company_profiles") {
        state.companyProfileListCalls += 1;
        return reply(route, { message: "simulated company-list outage" }, 503);
      }
      if (name === "layan_admin_activity_summary") {
        return reply(route, {
          visitors: 0, visits: 0, contacts: 0, new_users: 0,
          by_region: [], by_page: [], top_listings: [], by_day: []
        });
      }
      return reply(route, []);
    }

    if (path === "/functions/v1/asyut-admin") {
      state.loadedEndpoints.push("asyut-admin-list-users");
      return reply(route, { users: [] });
    }

    if (method === "GET") {
      state.loadedEndpoints.push(path);
      return reply(route, []);
    }
    return route.fulfill({ status: 204, body: "" });
  });

  return state;
}

test("admin console stays available when one review section fails and offers a retry", async ({ page }) => {
  const state = await mockAdminWithOneBrokenSection(page);

  await page.goto("/admin.html");
  await expect(page.locator("#adminConsole")).toBeHidden();
  await page.locator("#adminEmail").fill("admin-stability@example.invalid");
  await page.locator("#adminLoginSubmit").click();
  await expect(page.locator("#adminOtpCode")).toBeVisible();
  await page.locator("#adminOtpCode").fill("123456");
  await page.locator("#adminLoginSubmit").click();

  await expect(page.locator("#adminConsole")).toBeVisible();
  await page.locator("[data-view='review']").click();

  await expect(page.locator("#pendingCompanyProfiles")).toContainText("تعذر تحميل ملفات الشركات");
  await expect(page.locator("#pendingCompanyProfiles button")).toHaveText("إعادة المحاولة");
  await expect(page.locator("#pendingPropertyOffers")).toContainText("لا توجد إعلانات عقارية معلقة.");
  await expect(page.locator("#pendingMarketplaceListings")).not.toContainText("جارٍ التحميل");

  expect(state.loadedEndpoints).toContain("/rest/v1/property_offers");
  expect(state.loadedEndpoints).toContain("/rest/v1/marketplace_listings");
  expect(state.companyProfileListCalls).toBe(1);

  await page.locator("#pendingCompanyProfiles button").click();
  await expect.poll(() => state.companyProfileListCalls).toBe(2);
  await expect(page.locator("#pendingCompanyProfiles button")).toHaveText("إعادة المحاولة");
  await expect(page.locator("#adminConsole")).toBeVisible();
});
