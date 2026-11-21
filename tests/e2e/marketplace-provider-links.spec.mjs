import { test, expect } from "@playwright/test";

const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const USER_ID = "b2222222-2222-4222-8222-222222222222";
const ENTITY_ID = "c3333333-3333-4333-8333-333333333333";
const LISTING_ID = "a1111111-1111-4111-8111-111111111111";
const USER = {
  id: USER_ID,
  email: "provider-link-owner@example.invalid",
  email_confirmed_at: "2026-11-01T00:00:00Z",
  app_metadata: {},
  user_metadata: {}
};
const SESSION = {
  access_token: "provider-link-e2e-access-token",
  refresh_token: "provider-link-e2e-refresh-token",
  token_type: "bearer",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: USER
};
const ENTITY = {
  id: ENTITY_ID,
  name_ar: "مكتب اختبار التشطيبات",
  name_en: "Test Finishing Office",
  verification_status: "published",
  public_visible: true
};
const SERVICE = {
  id: LISTING_ID,
  category: "مواد البناء والتشطيب",
  listing_type: "خدمة",
  title: "تشطيب شقق ومنازل",
  description: "إعلان خدمة معتمد للاختبار.",
  city: "مدينة أسيوط",
  area: "شرق أسيوط",
  price: 1200,
  price_period: "للمتر",
  contact_phone: "01012345678",
  whatsapp: "01012345678",
  status: "approved",
  admin_notes: null,
  details: {},
  image_urls: [],
  created_at: "2026-11-20T08:00:00Z"
};
const reply = (route, body, status = 200) => route.fulfill({
  status,
  contentType: "application/json",
  body: JSON.stringify(body)
});

test("verified provider owner links an existing published service ad from My Listings", async ({ page }) => {
  const state = { links: [], insertCalls: [] };
  await page.addInitScript(session => {
    sessionStorage.setItem("layanSupabaseSession", JSON.stringify(session));
  }, SESSION);

  await page.route(SUPABASE + "/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const table = path.split("/").pop();
    const method = request.method();

    if (path === "/auth/v1/user") return reply(route, USER);
    if (path === "/auth/v1/token") {
      return reply(route, {
        access_token: SESSION.access_token,
        refresh_token: SESSION.refresh_token,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: USER
      });
    }
    if (path.startsWith("/auth/v1/")) return reply(route, {});
    if (table === "marketplace_listings") {
      if (url.searchParams.has("owner_id")) return reply(route, [SERVICE]);
      return reply(route, []);
    }
    if (table === "property_offers" || table === "supplier_ads") return reply(route, []);
    if (table === "company_entity_managers") {
      return reply(route, [{
        directory_entity_id: ENTITY_ID,
        owner_user_id: USER_ID,
        verified_at: "2026-11-19T09:00:00Z"
      }]);
    }
    if (table === "company_entity_manager_members") return reply(route, []);
    if (table === "directory_entities") return reply(route, [ENTITY]);
    if (table === "marketplace_listing_provider_links") {
      if (method === "POST") {
        const body = request.postDataJSON();
        state.insertCalls.push(body);
        state.links = [{ listing_id: body.listing_id, directory_entity_id: body.directory_entity_id }];
        return reply(route, [], 201);
      }
      return reply(route, state.links);
    }
    if (path.endsWith("/rpc/layan_company_owner_profile")) return reply(route, null);
    if (method === "GET") return reply(route, []);
    if (method === "POST") return reply(route, [], 201);
    return route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/my-listings.html");

  const card = page.locator("[data-kind='service'][data-id='" + LISTING_ID + "']");
  await expect(card).toBeVisible();
  await expect(card).toContainText(SERVICE.title);
  await card.getByRole("button", { name: "ربط الإعلان بملف نشاطك" }).click();

  const picker = page.locator("dialog.my-edit-dialog").filter({ hasText: "ربط الإعلان بملف مقدم الخدمة" });
  await expect(picker).toBeVisible();
  await expect(picker.locator("select[name='provider_entity_id'] option")).toHaveCount(1);
  await expect(picker).toContainText(ENTITY.name_ar);
  await picker.getByRole("button", { name: "تأكيد الربط" }).click();

  await expect.poll(() => state.insertCalls.length).toBe(1);
  expect(state.insertCalls[0]).toEqual({
    listing_id: LISTING_ID,
    directory_entity_id: ENTITY_ID,
    linked_by: USER_ID
  });
  await expect(card).toContainText("مرتبط بملف مقدم الخدمة");
  await expect(card.getByRole("link", { name: /عرض ملف مقدم الخدمة/ })).toHaveAttribute(
    "href",
    "./company.html?entity_id=" + ENTITY_ID
  );
});
