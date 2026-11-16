import { test, expect } from "@playwright/test";

const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const USER_ID = "9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a";

const reply = (route, body, status = 200) => route.fulfill({
  status,
  contentType: "application/json",
  body: JSON.stringify(body)
});

async function installAuthMocks(page) {
  const state = { otpRequests: [], syncRequests: [], verifyRequests: 0 };
  await page.route(SUPABASE + "/rest/v1/**", route => reply(route, []));
  await page.route(SUPABASE + "/auth/v1/otp", async route => {
    state.otpRequests.push(route.request().postDataJSON());
    await reply(route, { message_id: "otp-test-message" });
  });
  await page.route(SUPABASE + "/auth/v1/verify", async route => {
    state.verifyRequests++;
    const body = route.request().postDataJSON();
    const user = {
      id: USER_ID,
      email: body.email,
      email_confirmed_at: "2026-11-16T10:00:00.000Z",
      user_metadata: state.otpRequests.at(-1)?.data || {}
    };
    await reply(route, {
      access_token: "otp-test-access-token",
      refresh_token: "otp-test-refresh-token",
      token_type: "bearer",
      expires_in: 3600,
      user
    });
  });
  await page.route(SUPABASE + "/functions/v1/email-notifications", async route => {
    const body = route.request().postDataJSON();
    state.syncRequests.push(body);
    await reply(route, { ok: true, enabled: body.enabled === true, already_registered: false });
  });
  return state;
}

test("main public login requests and verifies an email OTP without creating a user", async ({ page }) => {
  const state = await installAuthMocks(page);
  await page.goto("/");
  await page.locator("#loginBtn").click();
  await page.locator("#authEmail").fill("existing@example.invalid");
  await page.locator("#authSubmit").click();

  await expect(page.locator("#authOtpCode")).toBeVisible();
  expect(state.otpRequests[0]).toEqual({
    email: "existing@example.invalid",
    create_user: false
  });

  await page.locator("#authOtpCode").fill("123456");
  await page.locator("#authVerifyOtpBtn").click();
  await page.waitForFunction(() => window.LAYAN_SUPABASE.isAuthenticated());
  expect(state.verifyRequests).toBe(1);
  expect(state.syncRequests).toEqual([{ action: "sync_subscription" }]);
});

test("new company account signup keeps profile fields and email opt-in in OTP metadata", async ({ page }) => {
  const state = await installAuthMocks(page);
  await page.goto("/");
  await page.locator("#loginBtn").click();
  await page.locator("#authToggle").click();
  await page.locator("#authEmail").fill("company@example.invalid");
  await page.locator("#authFullName").fill("شركة اختبار أسيوط");
  await page.locator("#authPhone").fill("01012345678");
  await page.locator('input[name="authAccountType"][value="company"]').check();
  await page.locator("#authTerms").check();
  await page.locator("#authEmailAnnouncements").check();
  await page.locator("#authSubmit").click();

  await expect(page.locator("#authOtpCode")).toBeVisible();
  expect(state.otpRequests[0]).toEqual({
    email: "company@example.invalid",
    create_user: true,
    data: {
      full_name: "شركة اختبار أسيوط",
      phone: "01012345678",
      account_type: "company",
      email_notifications: true
    }
  });

  await page.locator("#authOtpCode").fill("654321");
  await page.locator("#authVerifyOtpBtn").click();
  await page.waitForFunction(() => window.LAYAN_SUPABASE.isAuthenticated());
  expect(state.syncRequests).toEqual([{ action: "set_subscription", enabled: true }]);
});

test("services marketplace login uses the same email OTP and notification preference service", async ({ page }) => {
  const state = await installAuthMocks(page);
  await page.goto("/marketplace.html");
  await page.locator("#authOpen").click();
  await page.locator('#authForm input[name="email"]').fill("provider@example.invalid");
  await page.locator("#authSubmit").click();

  await expect(page.locator("#marketplaceOtpInput")).toBeVisible();
  expect(state.otpRequests[0]).toEqual({
    email: "provider@example.invalid",
    create_user: false
  });

  await page.locator("#marketplaceEmailOptIn").check();
  await page.locator("#marketplaceOtpInput").fill("112233");
  await page.locator("#marketplaceOtpVerify").click();
  await page.waitForFunction(() => window.LAYAN_SUPABASE.isAuthenticated());
  expect(state.syncRequests).toEqual([{ action: "set_subscription", enabled: true }]);
});

test("legacy password sign-in remains available as a recovery path for existing accounts", async ({ page }) => {
  const state = await installAuthMocks(page);
  await page.route(SUPABASE + "/auth/v1/token?grant_type=password", async route => {
    await reply(route, {
      access_token: "legacy-access-token",
      refresh_token: "legacy-refresh-token",
      token_type: "bearer",
      expires_in: 3600,
      user: {
        id: USER_ID,
        email: "legacy@example.invalid",
        email_confirmed_at: "2026-11-16T10:00:00.000Z",
        user_metadata: {}
      }
    });
  });
  await page.goto("/");
  await page.locator("#loginBtn").click();
  await page.locator("#authEmail").fill("legacy@example.invalid");
  await page.locator("#authPassword").fill("Legacy-Password-123!");
  await page.locator("#authSubmit").click();
  await page.waitForFunction(() => window.LAYAN_SUPABASE.isAuthenticated());
  expect(state.otpRequests).toHaveLength(0);
});
