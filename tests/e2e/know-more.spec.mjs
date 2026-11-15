import { test, expect } from "@playwright/test";

test("know more guide exposes the Asyut buyer and seller resources without invented price claims", async ({ page }) => {
  await page.goto("/know-more.html");
  await expect(page.getByRole("heading", { name: "اعرف أكثر قبل ما تاخد قرارك" })).toBeVisible();
  await expect(page.getByRole("link", { name: "تصفح العقارات" }).first()).toHaveAttribute("href", "./offers.html");
  await expect(page.locator("#areas a")).toHaveCount(13);
  await expect(page.locator("#valuationForm")).toBeVisible();
  await expect(page.locator("body")).toContainText("لا تنتج المنصة سعرًا آليًا أو تقييمًا معتمدًا");
  await expect(page.locator("#buyer")).toContainText("تحقق من الملكية");
  await expect(page.locator("#seller")).toContainText("صور واضحة وحديثة");
});

test("valuation inquiry builds a WhatsApp message from entered property details", async ({ page }) => {
  await page.goto("/know-more.html");
  await page.locator("#valuationForm select[name='type']").selectOption({ label: "شقة" });
  await page.locator("#valuationForm select[name='city']").selectOption({ label: "مدينة أسيوط" });
  await page.locator("#valuationForm input[name='area']").fill("120");
  await page.locator("#valuationForm input[name='condition']").fill("نصف تشطيب");
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "إرسال البيانات عبر واتساب" }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/wa\.me\/201007044265\?text=/);
  await expect(popup).toHaveURL(/%D8%B4%D9%82%D8%A9|%D9%85%D8%AF%D9%8A%D9%86%D8%A9/);
});
