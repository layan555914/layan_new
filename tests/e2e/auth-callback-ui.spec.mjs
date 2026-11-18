import { test, expect } from "@playwright/test";

test("callback results are replayed when the main UI attaches", async ({ page }) => {
  await page.addInitScript(() => {
    window.LAYAN_AUTH_CALLBACK_RESULT = { success: true, type: "legacy" };
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
          window.__authCallbackUiWasUpdated = true;
          observer.disconnect();
        }
      });
      observer.observe(status, { childList: true, subtree: true, characterData: true });
    });
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__authCallbackUiWasUpdated === true);
});
