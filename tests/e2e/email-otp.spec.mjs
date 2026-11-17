import { test, expect } from "@playwright/test";

const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const USER_ID = "9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a";

const reply = (route, body, status = 200) => route.fulfill({
  status,
  contentType: "application/json",
  body: JSON.stringify(body)
});

async function installAuthMocks(page) {
  const state = { otpRequests: [], syncRequests: [], verifyRequests: 0, profileUpdates: [] };
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
      created_at: state.otpRequests.at(-1)?.create_user ? "2026-11-15T10:00:00.000Z" : "2026-11-16T10:00:00.000Z",
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
  await page.route(SUPABASE + "/auth/v1/user", async route => {
    const body = route.request().postDataJSON();
    state.profileUpdates.push({ method: route.request().method(), body });
    await reply(route, { id: USER_ID, email: "signup@example.invalid", user_metadata: body.data || {} });
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

test("new accounts use email + OTP only; optional profile completion is separate", async ({ page }) => {
  const state = await installAuthMocks(page);
  await page.goto("/");
  await page.locator("#loginBtn").click();
  await page.locator("#authToggle").click();
  await expect(page.locator("#authEmail")).toBeVisible();
  await expect(page.locator("#authOtpCode")).toBeVisible();
  await expect(page.locator("#authOtpCode")).toBeDisabled();
  await expect(page.locator("#authFullName")).toHaveCount(0);
  await expect(page.locator("#authPhone")).toHaveCount(0);
  await expect(page.locator("#authTerms")).toHaveCount(0);
  await page.locator("#authEmail").fill("signup@example.invalid");
  await page.locator("#authSubmit").click();
  await expect(page.locator("#authOtpCode")).toBeEnabled();
  expect(state.otpRequests[0]).toEqual({ email: "signup@example.invalid", create_user: true });

  await page.locator("#authOtpCode").fill("654321");
  await page.locator("#authVerifyOtpBtn").click();
  await page.waitForFunction(() => window.LAYAN_SUPABASE.isAuthenticated());
  await expect(page.locator("#asyutProfileReminder")).toHaveCount(0);
  await page.evaluate(userId => {
    localStorage.setItem("asyutAqarNewAccount:" + userId, String(Date.now() - 25 * 60 * 60 * 1000));
    window.dispatchEvent(new CustomEvent("layan-auth-state-changed"));
  }, "9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a");
  await expect(page.locator("#asyutProfileReminder")).toBeVisible();
  await page.locator("#asyutProfileStart").click();
  await page.locator("#asyutProfileName").fill("مستخدم اختبار");
  await page.locator("#asyutProfilePhone").fill("01012345678");
  await page.locator("#asyutProfileType").selectOption("company");
  await page.locator("#asyutProfileSave").click();
  await expect.poll(() => state.profileUpdates.length).toBe(1);
  expect(state.profileUpdates[0]).toMatchObject({
    method: "PUT",
    body: { data: { full_name: "مستخدم اختبار", phone: "01012345678", account_type: "company" } }
  });
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

  await page.locator("#marketplaceOtpInput").fill("112233");
  await page.locator("#marketplaceOtpVerify").click();
  await page.waitForFunction(() => window.LAYAN_SUPABASE.isAuthenticated());
  expect(state.syncRequests).toEqual([{ action: "sync_subscription" }]);
});

test("all public account access is email OTP only with no password or recovery controls", async ({ page }) => {
  await installAuthMocks(page);
  await page.goto("/");
  await page.locator("#loginBtn").click();
  await expect(page.locator("#authEmail")).toBeVisible();
  await expect(page.locator("#authOtpCode")).toBeVisible();
  await expect(page.locator("#authOtpCode")).toBeDisabled();
  await expect(page.locator("#authToggle")).toBeVisible();
  await expect(page.locator("#authPassword")).toHaveCount(0);
  await expect(page.locator("#forgotPasswordBtn")).toHaveCount(0);
  await expect(page.locator("#authSubmit")).toHaveText("إرسال كود الدخول");
  await page.goto("/marketplace.html");
  await page.locator("#authOpen").click();
  await expect(page.locator('#authForm input[name="password"]')).toHaveCount(0);
  await expect(page.locator("#marketplaceOtpInput")).toBeVisible();
  await expect(page.locator("#marketplaceOtpInput")).toBeDisabled();
  await expect(page.locator("#switchAuth")).toBeVisible();
  await expect(page.locator("#forgotPassword")).toHaveCount(0);
});

test("marketplace can create an account with email + OTP only", async ({ page }) => {
  const state = await installAuthMocks(page);
  await page.goto("/marketplace.html");
  await page.locator("#authOpen").click();
  await page.locator("#switchAuth").click();
  await page.locator('#authForm input[name="email"]').fill("new-provider@example.invalid");
  await page.locator("#authSubmit").click();
  await expect(page.locator("#marketplaceOtpInput")).toBeEnabled();
  expect(state.otpRequests[0]).toEqual({ email: "new-provider@example.invalid", create_user: true });
});

test("legacy accounts without the new-signup marker are never interrupted by the profile reminder", async ({ page }) => {
  await installAuthMocks(page);
  await page.goto("/");
  await page.locator("#loginBtn").click();
  await page.locator("#authEmail").fill("legacy@example.invalid");
  await page.locator("#authSubmit").click();
  await page.locator("#authOtpCode").fill("123456");
  await page.locator("#authVerifyOtpBtn").click();
  await page.waitForFunction(() => window.LAYAN_SUPABASE.isAuthenticated());
  await expect(page.locator("#asyutProfileReminder")).toHaveCount(0);
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith("asyutAqarNewAccount:")))).toBe(false);
});
