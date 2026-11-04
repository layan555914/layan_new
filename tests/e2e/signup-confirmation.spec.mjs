import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";

const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const SIGNUP_KEY = "layanSignupCodeVerifier:wisnmlbefdrkcbbqvdlg";

function challengeFor(verifier) {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function mockSignup(page, capture = {}) {
  await page.route(SUPABASE + "/auth/v1/signup**", async route => {
    capture.signupUrl = route.request().url();
    capture.signupBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "22222222-2222-4222-8222-222222222222",
          email: "signup-test@example.invalid",
          email_confirmed_at: null
        },
        session: null
      })
    });
  });
}

test("signup sends an S256 PKCE challenge and stores its verifier", async ({ page }) => {
  const capture = {};
  await mockSignup(page, capture);
  await page.goto("/");

  const result = await page.evaluate(() =>
    window.LAYAN_SUPABASE.signUp("  SIGNUP-TEST@EXAMPLE.INVALID ", "Signup-Test-Password-123!")
  );

  expect(result.needsEmailConfirmation).toBe(true);
  expect(capture.signupBody.email).toBe("signup-test@example.invalid");
  expect(capture.signupBody.password).toBe("Signup-Test-Password-123!");
  expect(capture.signupBody.code_challenge_method).toBe("s256");
  expect(capture.signupBody.code_challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(new URL(capture.signupUrl).searchParams.get("redirect_to")).toBe(new URL("/", page.url()).href);

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || "null"), SIGNUP_KEY);
  expect(saved.code_verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(capture.signupBody.code_challenge).toBe(challengeFor(saved.code_verifier));
  expect(saved.created_at).toBeGreaterThan(0);
});

test("email confirmation PKCE code creates a session and completes the signup callback", async ({ page }) => {
  const capture = {};
  await mockSignup(page, capture);
  await page.goto("/");
  await page.evaluate(() =>
    window.LAYAN_SUPABASE.signUp("signup-test@example.invalid", "Signup-Test-Password-123!")
  );

  const verifier = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).code_verifier, SIGNUP_KEY);
  let exchangeBody = null;
  await page.route(SUPABASE + "/auth/v1/token?grant_type=pkce", async route => {
    exchangeBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "fixture-signup-access-token",
        refresh_token: "fixture-signup-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        user: {
          id: "22222222-2222-4222-8222-222222222222",
          email: "signup-test@example.invalid",
          email_confirmed_at: "2026-11-04T08:00:00.000Z"
        }
      })
    });
  });

  await page.goto("/?code=single-use-signup-fixture-code");
  await page.waitForFunction(() => window.LAYAN_AUTH_CALLBACK_RESULT?.success === true);

  expect(exchangeBody).toEqual({
    auth_code: "single-use-signup-fixture-code",
    code_verifier: verifier
  });
  await expect(page).toHaveURL(/\/$/);
  const callback = await page.evaluate(() => window.LAYAN_AUTH_CALLBACK_RESULT);
  expect(callback).toMatchObject({ success: true, type: "signup" });
  const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem("layanSupabaseSession") || "null"));
  expect(session.access_token).toBe("fixture-signup-access-token");
  expect(session.user.email_confirmed_at).toBeTruthy();
  expect(await page.evaluate(key => localStorage.getItem(key), SIGNUP_KEY)).toBeNull();
});

test("resend confirmation retains the original signup verifier and sends the REST redirect_to query", async ({ page }) => {
  const capture = {};
  await mockSignup(page, capture);
  await page.goto("/");
  await page.evaluate(() =>
    window.LAYAN_SUPABASE.signUp("signup-test@example.invalid", "Signup-Test-Password-123!")
  );
  const before = await page.evaluate(key => localStorage.getItem(key), SIGNUP_KEY);

  let resendUrl = "";
  let resendBody = null;
  await page.route(SUPABASE + "/auth/v1/resend**", async route => {
    resendUrl = route.request().url();
    resendBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.evaluate(() => window.LAYAN_SUPABASE.resendConfirmation("signup-test@example.invalid"));

  expect(resendBody).toEqual({ type: "signup", email: "signup-test@example.invalid" });
  expect(new URL(resendUrl).searchParams.get("redirect_to")).toBe(new URL("/", page.url()).href);
  expect(await page.evaluate(key => localStorage.getItem(key), SIGNUP_KEY)).toBe(before);
});

test("signup PKCE callback without its same-browser verifier is rejected without exchanging the code", async ({ page }) => {
  let exchangeCalled = false;
  await page.route(SUPABASE + "/auth/v1/token?grant_type=pkce", async route => {
    exchangeCalled = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto("/?code=code-without-signup-verifier");
  await page.waitForFunction(() => window.LAYAN_AUTH_CALLBACK_RESULT?.success === false);
  expect(exchangeCalled).toBe(false);
  await expect(page).toHaveURL(/\/$/);
  const result = await page.evaluate(() => window.LAYAN_AUTH_CALLBACK_RESULT);
  expect(result.message).toContain("بيانات التحقق الخاصة بالمتصفح غير موجودة");
});

test("early auth callback results are replayed when the main UI attaches", async ({ page }) => {
  await page.addInitScript(() => {
    window.LAYAN_AUTH_CALLBACK_RESULT = { success: true, type: "signup" };
    document.addEventListener("DOMContentLoaded", () => {
      const status = document.getElementById("statusMessage");
      if (!status) return;
      const successText = "تم تأكيد البريد الإلكتروني وتسجيل الدخول بنجاح";
      const observer = new MutationObserver(records => {
        const sawSuccess = status.textContent.includes(successText) ||
          records.some(record => Array.from(record.addedNodes).some(node =>
            String(node.textContent || "").includes(successText)
          ));
        if (sawSuccess) {
          window.__signupCallbackUiWasUpdated = true;
          observer.disconnect();
        }
      });
      observer.observe(status, { childList: true, subtree: true, characterData: true });
    });
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__signupCallbackUiWasUpdated === true);
});

test("legacy implicit email-confirmation callbacks remain supported", async ({ page }) => {
  await page.route(SUPABASE + "/auth/v1/user", async route => {
    expect(route.request().headers().authorization).toBe("Bearer legacy-confirmation-access");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "22222222-2222-4222-8222-222222222222",
        email: "legacy-test@example.invalid",
        email_confirmed_at: "2026-11-04T08:00:00.000Z"
      })
    });
  });

  await page.goto("/#access_token=legacy-confirmation-access&refresh_token=legacy-refresh-token&token_type=bearer");
  await page.waitForFunction(() => window.LAYAN_AUTH_CALLBACK_RESULT?.success === true);
  await expect(page).toHaveURL(/\/$/);
  const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem("layanSupabaseSession") || "null"));
  expect(session.access_token).toBe("legacy-confirmation-access");
  expect(session.refresh_token).toBe("legacy-refresh-token");
});
