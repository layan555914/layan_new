import { test, expect } from "@playwright/test";

const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const RECOVERY_KEY = "layanRecoveryCodeVerifier:wisnmlbefdrkcbbqvdlg";

test("password recovery request sends a PKCE challenge and stores its verifier", async ({ page }) => {
  let requestPayload = null;
  let redirectTarget = null;

  await page.route(SUPABASE + "/auth/v1/recover**", async route => {
    const request = route.request();
    requestPayload = request.postDataJSON();
    redirectTarget = new URL(request.url()).searchParams.get("redirect_to");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({})
    });
  });
  await page.route(SUPABASE + "/rest/v1/**", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/");
  const result = await page.evaluate(async () => {
    await window.LAYAN_SUPABASE.resetPasswordForEmail("  TEST@example.invalid  ");
    return true;
  });

  expect(result).toBe(true);
  expect(requestPayload).toMatchObject({
    email: "test@example.invalid",
    code_challenge_method: "s256"
  });
  expect(requestPayload.code_challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(redirectTarget).toBe(new URL("/reset-password.html", page.url()).href);

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || "null"), RECOVERY_KEY);
  expect(saved.code_verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(saved.created_at).toBeGreaterThan(0);
});

test("PKCE recovery callback exchanges the one-time code and updates the password", async ({ page }) => {
  const verifier = "test-only-code-verifier-0123456789-abcdefghijklmnopqrstuvwxyz";
  await page.addInitScript(({ key, verifier }) => {
    localStorage.setItem(key, JSON.stringify({ code_verifier: verifier, created_at: Date.now() }));
  }, { key: RECOVERY_KEY, verifier });

  let exchangePayload = null;
  let updatePayload = null;

  await page.route(SUPABASE + "/auth/v1/token?grant_type=pkce", async route => {
    exchangePayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "fixture-recovery-access-token",
        refresh_token: "fixture-recovery-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        user: { id: "11111111-1111-4111-8111-111111111111" }
      })
    });
  });

  await page.route(SUPABASE + "/auth/v1/user", async route => {
    expect(route.request().method()).toBe("PUT");
    expect(route.request().headers().authorization).toBe("Bearer fixture-recovery-access-token");
    updatePayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "11111111-1111-4111-8111-111111111111" })
    });
  });

  await page.goto("/reset-password.html?code=single-use-fixture-code");
  await expect(page.locator("#status")).toContainText("تم التحقق من رابط الاستعادة الآمن");
  await expect(page).toHaveURL(/\/reset-password\.html$/);
  expect(exchangePayload).toEqual({
    auth_code: "single-use-fixture-code",
    code_verifier: verifier
  });

  await page.locator("#password").fill("A-New-Test-Password-123!");
  await page.locator("#confirmPassword").fill("A-New-Test-Password-123!");
  await page.locator("#submitBtn").click();

  await expect(page.locator("#status")).toContainText("تم تغيير كلمة المرور بنجاح");
  await expect(page.locator("#resetForm")).toBeHidden();
  expect(updatePayload).toEqual({ password: "A-New-Test-Password-123!" });
  expect(await page.evaluate(key => localStorage.getItem(key), RECOVERY_KEY)).toBeNull();
});

test("legacy token_hash recovery links remain supported", async ({ page }) => {
  let verifiedPayload = null;
  let updatePayload = null;

  await page.route(SUPABASE + "/auth/v1/verify", async route => {
    verifiedPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access_token: "fixture-legacy-recovery-token" })
    });
  });
  await page.route(SUPABASE + "/auth/v1/user", async route => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "11111111-1111-4111-8111-111111111111" })
      });
      return;
    }
    updatePayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "11111111-1111-4111-8111-111111111111" })
    });
  });

  await page.goto("/reset-password.html?token_hash=fixture-token-hash&type=recovery");
  await expect(page.locator("#status")).toContainText("تم التحقق من الرابط");
  expect(verifiedPayload).toEqual({ token_hash: "fixture-token-hash", type: "recovery" });

  await page.locator("#password").fill("Legacy-Test-Password-123!");
  await page.locator("#confirmPassword").fill("Legacy-Test-Password-123!");
  await page.locator("#submitBtn").click();

  await expect(page.locator("#status")).toContainText("تم تغيير كلمة المرور بنجاح");
  expect(updatePayload).toEqual({ password: "Legacy-Test-Password-123!" });
});

test("PKCE recovery code without the same-browser verifier is rejected safely", async ({ page }) => {
  await page.goto("/reset-password.html?code=code-without-verifier");

  await expect(page.locator("#status")).toContainText("بيانات التحقق الخاصة بالمتصفح غير موجودة");
  await expect(page.locator("#submitBtn")).toBeDisabled();
  await expect(page).toHaveURL(/\/reset-password\.html$/);
});

test("expired or already-used recovery links offer a fresh link that works in any browser", async ({ page }) => {
  let payload = null;
  let redirectTarget = null;
  await page.route(SUPABASE + "/auth/v1/recover**", async route => {
    payload = route.request().postDataJSON();
    redirectTarget = new URL(route.request().url()).searchParams.get("redirect_to");
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto("/reset-password.html#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  await expect(page.locator("#status")).toContainText("استُخدم من قبل أو انتهت صلاحيته");
  await expect(page.locator("#resetForm")).toBeHidden();
  await expect(page.locator("#newLinkForm")).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");

  await page.locator("#newLinkEmail").fill("  User@Example.invalid ");
  await page.locator("#newLinkBtn").click();
  await expect(page.locator("#status")).toContainText("ستصلك رسالة");
  expect(payload).toEqual({ email: "user@example.invalid" });
  expect(redirectTarget).toBe(new URL("/reset-password.html", page.url()).href);
});

test("a recovery link opened in another browser (no PKCE verifier) also offers a fresh link", async ({ page }) => {
  await page.goto("/reset-password.html?code=code-from-another-browser");
  await expect(page.locator("#newLinkForm")).toBeVisible();
  await expect(page.locator("#submitBtn")).toBeHidden();
});

test("on an http page (no crypto.subtle) recovery and signup emails are still sent without PKCE", async ({ page }) => {
  const payloads = {};
  for (const name of ["recover", "signup"]) {
    await page.route(SUPABASE + "/auth/v1/" + name + "**", async route => {
      payloads[name] = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(name === "signup" ? { user: { id: "u" } } : {}) });
    });
  }
  await page.route(SUPABASE + "/rest/v1/**", route => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.addInitScript(() => { Object.defineProperty(window.crypto, "subtle", { get: () => undefined, configurable: true }); });
  await page.goto("/");
  await page.evaluate(async () => {
    await window.LAYAN_SUPABASE.resetPasswordForEmail("http-user@example.invalid");
    await window.LAYAN_SUPABASE.signUp("http-user@example.invalid", "Test-Only-123!", { full_name: "x" });
  });
  expect(payloads.recover).toEqual({ email: "http-user@example.invalid" });
  expect(payloads.signup.email).toBe("http-user@example.invalid");
  expect(payloads.signup.code_challenge).toBeUndefined();
});
