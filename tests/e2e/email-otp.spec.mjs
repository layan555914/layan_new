import { test, expect } from "@playwright/test";

const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const USER = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "otp-test@example.invalid",
  email_confirmed_at: "2026-11-14T10:00:00.000Z"
};

async function openHome(page) {
  await page.route(SUPABASE + "/rest/v1/**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "[]"
  }));
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.LAYAN_SUPABASE?.requestEmailOtp &&
    window.LAYAN_SUPABASE?.verifyEmailOtp));
}

test("email OTP request defaults to automatic account creation for new email addresses", async ({ page }) => {
  await openHome(page);
  let payload = null;
  await page.route(SUPABASE + "/auth/v1/otp", async route => {
    payload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message_id: "otp-message-fixture" })
    });
  });

  await page.evaluate(() => window.LAYAN_SUPABASE.requestEmailOtp(" New-User@Example.Invalid "));

  expect(payload).toEqual({
    email: "new-user@example.invalid",
    create_user: true
  });
});

test("callers may explicitly disable automatic account creation when needed", async ({ page }) => {
  await openHome(page);
  let payload = null;
  await page.route(SUPABASE + "/auth/v1/otp", async route => {
    payload = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.evaluate(() => window.LAYAN_SUPABASE.requestEmailOtp(
    "existing@example.invalid",
    { shouldCreateUser: false }
  ));

  expect(payload).toEqual({
    email: "existing@example.invalid",
    create_user: false
  });
});

test("email OTP verification requires six digits before making a request", async ({ page }) => {
  await openHome(page);
  let verifyRequests = 0;
  await page.route(SUPABASE + "/auth/v1/verify", async route => {
    verifyRequests += 1;
    await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ msg: "invalid token" }) });
  });

  const result = await page.evaluate(async () => {
    try {
      await window.LAYAN_SUPABASE.verifyEmailOtp("otp-test@example.invalid", "12A4");
      return { rejected: false };
    } catch (error) {
      return { rejected: true, message: error.message };
    }
  });

  expect(result.rejected).toBe(true);
  expect(result.message).toContain("6 أرقام");
  expect(verifyRequests).toBe(0);
});

test("successful email OTP verification creates the normal authenticated session", async ({ page }) => {
  await openHome(page);
  let payload = null;
  await page.route(SUPABASE + "/auth/v1/verify", async route => {
    payload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "otp-fixture-access-token",
        refresh_token: "otp-fixture-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        user: USER
      })
    });
  });

  await page.evaluate(() => window.LAYAN_SUPABASE.verifyEmailOtp("OTP-TEST@EXAMPLE.INVALID", "١٢٣٤٥٦"));

  const session = await page.evaluate(() => ({
    current: window.LAYAN_SUPABASE.getSession(),
    stored: sessionStorage.getItem("layanSupabaseSession"),
    authenticated: window.LAYAN_SUPABASE.isAuthenticated()
  }));
  expect(payload).toEqual({
    email: "otp-test@example.invalid",
    token: "123456",
    type: "email"
  });
  expect(session.authenticated).toBe(true);
  expect(session.current.access_token).toBe("otp-fixture-access-token");
  expect(session.current.refresh_token).toBe("otp-fixture-refresh-token");
  expect(session.stored).toContain("otp-fixture-access-token");
});

test("login dialog uses one email OTP flow for existing and new users", async ({ page }) => {
  await openHome(page);
  let otpPayload = null;
  await page.route(SUPABASE + "/auth/v1/otp", async route => {
    otpPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message_id: "otp-ui-fixture" })
    });
  });
  await page.route(SUPABASE + "/auth/v1/verify", async route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      access_token: "otp-ui-access-token",
      refresh_token: "otp-ui-refresh-token",
      token_type: "bearer",
      expires_in: 3600,
      user: USER
    })
  }));

  await page.locator("#loginBtn").click();
  await expect(page.locator("#authToggle")).toHaveCount(0);
  await expect(page.locator("#authPassword")).toHaveCount(0);
  await expect(page.locator("#authSubmit")).toHaveCount(0);
  await expect(page.locator(".auth-signup-only")).toHaveCount(0);
  await expect(page.locator("#authOtpRequestBtn")).toBeVisible();
  await page.locator("#authEmail").fill("otp-test@example.invalid");
  await page.locator("#authOtpRequestBtn").click();
  await expect(page.locator("#authOtpCode")).toBeVisible();
  await page.locator("#authOtpCode").fill("123456");
  await page.locator("#authOtpVerifyBtn").click();

  await page.waitForFunction(() => window.LAYAN_SUPABASE.isAuthenticated());
  expect(otpPayload).toEqual({
    email: "otp-test@example.invalid",
    create_user: true
  });
});

test("marketplace login dialog can authenticate with the same automatic email OTP flow", async ({ page }) => {
  await page.route(SUPABASE + "/rest/v1/**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "[]"
  }));
  let otpPayload = null;
  await page.route(SUPABASE + "/auth/v1/otp", async route => {
    otpPayload = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message_id: "market-otp-fixture" }) });
  });
  await page.route(SUPABASE + "/auth/v1/verify", async route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      access_token: "market-otp-access-token",
      refresh_token: "market-otp-refresh-token",
      token_type: "bearer",
      expires_in: 3600,
      user: USER
    })
  }));

  await page.goto("/marketplace.html");
  await page.waitForFunction(() => Boolean(window.LAYAN_SUPABASE?.requestEmailOtp));
  await page.locator("#openListingForm").click();
  await expect(page.locator('#authDialog input[type="password"]')).toHaveCount(0);
  await expect(page.locator("#authDialog #authSubmit")).toHaveCount(0);
  await expect(page.locator("#authDialog #switchAuth")).toHaveCount(0);
  await expect(page.locator("#authDialog")).toBeVisible();
  await page.locator("#marketAuthEmail").fill("otp-test@example.invalid");
  await page.locator("#marketplaceOtpRequest").click();
  await expect(page.locator("#marketplaceOtpInput")).toBeVisible();
  await page.locator("#marketplaceOtpInput").fill("123456");
  await page.locator("#marketplaceOtpInput").press("Enter");

  await expect(page.locator("#authDialog")).toBeHidden();
  await expect(page.locator("#marketplaceListingDialog")).toBeVisible();
  expect(otpPayload).toEqual({
    email: "otp-test@example.invalid",
    create_user: true
  });
  expect(await page.evaluate(() => window.LAYAN_SUPABASE.isAuthenticated())).toBe(true);
});
