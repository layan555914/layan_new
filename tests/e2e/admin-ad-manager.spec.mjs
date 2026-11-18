import { test, expect } from "@playwright/test";

const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const ADMIN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CUSTOMER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

async function mockAdmin(page) {
  const state = { requests: [], offers: [] };
  const user = {
    id: ADMIN_ID,
    email: "sponsor-admin@example.invalid",
    email_confirmed_at: "2026-11-01T00:00:00Z",
    app_metadata: {},
    user_metadata: {}
  };
  const reply = (route, body, status = 200) => route.fulfill({
    status, contentType: "application/json", body: JSON.stringify(body)
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
      const body = req.postDataJSON?.() || {};
      state.requests.push({ kind: "rpc", name, body });
      if (name === "layan_is_admin") return reply(route, true);
      if (name === "layan_admin_resolve_user") return reply(route, CUSTOMER_ID);
      return reply(route, null);
    }

    if (path.startsWith("/storage/v1/object/layan_real_estat")) {
      state.requests.push({ kind: "storage", method, path, body: req.postDataJSON?.() || null });
      return reply(route, {});
    }

    if (path === "/rest/v1/property_offers") {
      if (method === "POST") {
        const body = req.postDataJSON?.() || {};
        const row = { id: 701, created_at: new Date().toISOString(), ...body };
        state.offers.push(row);
        state.requests.push({ kind: "insert", body });
        return reply(route, [row], 201);
      }
      if (method === "PATCH") {
        const id = Number((url.searchParams.get("id") || "").replace("eq.", ""));
        const body = req.postDataJSON?.() || {};
        const row = state.offers.find(x => x.id === id);
        if (!row) return reply(route, []);
        Object.assign(row, body);
        state.requests.push({ kind: "update", id, body });
        return reply(route, [row]);
      }
      return reply(route, state.offers);
    }

    if (path === "/rest/v1/marketplace_listings" ||
        path === "/rest/v1/supplier_ads" ||
        path === "/rest/v1/company_property_ads" ||
        path === "/rest/v1/partner_ad_slots" ||
        path === "/rest/v1/platform_sponsors" ||
        path === "/rest/v1/company_profiles" ||
        path === "/rest/v1/company_claim_requests") {
      return reply(route, []);
    }

    if (method === "GET") return reply(route, []);
    return route.fulfill({ status: 204, body: "" });
  });

  return state;
}

async function loginAsAdmin(page) {
  await page.goto("/admin.html");
  await expect(page.locator("#adminConsole")).toBeHidden();
  await page.locator("#adminEmail").fill("sponsor-admin@example.invalid");
  await page.locator("#adminLoginSubmit").click();
  await expect(page.locator("#adminOtpCode")).toBeVisible();
  await page.locator("#adminOtpCode").fill("123456");
  await page.locator("#adminLoginSubmit").click();
  await expect(page.locator("#adminConsole")).toBeVisible();
  await page.locator("[data-view='published']").click();
  await expect(page.locator("#adminAdManagerList")).toBeVisible();
}

test("admin creates and edits a property ad while keeping it owned by the customer", async ({ page }) => {
  const state = await mockAdmin(page);
  await loginAsAdmin(page);

  await page.locator("#adminAdCreateType").selectOption("property_offer");
  await page.locator("#adminAdManagerCreate").click();

  const dialog = page.locator("#adminAdManagerDialog[open]");
  await dialog.locator("[name='owner_email']").fill("customer@example.invalid");
  await dialog.locator("[data-field='title']").fill("شقة اختبار في الهلالي");
  await dialog.locator("[data-field='property_type']").selectOption("شقة");
  await dialog.locator("[data-field='listing_purpose']").selectOption("بيع");
  await dialog.locator("[data-field='city']").fill("مدينة أسيوط");
  await dialog.locator("[data-field='area']").fill("الهلالي");
  await dialog.locator("[data-field='area_m2']").fill("105");
  await dialog.locator("[data-field='total_price']").fill("3150000");
  await dialog.locator("[data-field='latitude']").fill("27.1809");
  await dialog.locator("[data-field='longitude']").fill("31.1837");
  await dialog.locator("button[type='submit']").click();

  await expect.poll(() => state.offers.length).toBe(1);
  expect(state.offers[0]).toMatchObject({
    owner_id: CUSTOMER_ID,
    title: "شقة اختبار في الهلالي",
    status: "pending",
    verification_status: "pending",
    city: "مدينة أسيوط",
    area: "الهلالي",
    area_m2: 105,
    total_price: 3150000,
    latitude: 27.1809,
    longitude: 31.1837,
    is_featured: false
  });
  expect(state.offers[0].featured_requested).toBe(false);

  const item = page.locator("[data-record-kind='property_offer'][data-record-id='701']");
  await item.locator("[data-record-edit]").click();
  const edit = page.locator("#adminAdManagerDialog[open]");
  await edit.locator("[data-field='title']").fill("شقة الهلالي بعد التعديل");
  await edit.locator("button[type='submit']").click();

  await expect.poll(() => state.offers[0].title).toBe("شقة الهلالي بعد التعديل");
  const update = state.requests.find(x => x.kind === "update");
  expect(update).toBeTruthy();
  expect(update.body).not.toHaveProperty("owner_id");
  expect(state.offers[0].owner_id).toBe(CUSTOMER_ID);
});
