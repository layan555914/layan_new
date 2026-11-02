import { test, expect } from "@playwright/test";

const SUPABASE = "https://ebyhwqkmhxbgocngpqfe.supabase.co";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EMAIL = "journey-test@example.invalid";
const PASSWORD = "Test-Only-Password-123!";
const FIRST_ID = "101";
const CREATED_ID = "202";

function makeOffer(overrides = {}) {
  return {
    id: FIRST_ID,
    owner_id: USER_ID,
    title: "شقة اختبار أسيوط الجديدة",
    governorate: "أسيوط",
    city: "أسيوط الجديدة",
    area: "الهضبة",
    property_type: "شقة",
    listing_purpose: "تنازل",
    total_price: 900000,
    down_payment: 150000,
    paid_amount: 250000,
    remaining_amount: 650000,
    assignment_fee: 25000,
    monthly_installment: 8000,
    description: "عرض اختباري لقياس رحلة المستخدم من البحث حتى مشاهدة تفاصيل العقار.",
    contact_name: "معلن اختبار",
    contact_phone: "01012345678",
    image_urls: [],
    status: "available",
    verification_status: "verified",
    developer_approval_status: "unknown",
    created_at: "2026-11-02T09:00:00.000Z",
    ...overrides
  };
}

async function installBackendMocks(page) {
  const offers = [makeOffer()];
  const state = { createdPayload: null, adminReviews: [] };
  const user = {
    id: USER_ID,
    email: EMAIL,
    created_at: "2026-11-02T08:00:00.000Z",
    last_sign_in_at: "2026-11-02T09:00:00.000Z",
    email_confirmed_at: "2026-11-02T08:00:00.000Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {}
  };

  const reply = (route, body, status = 200) => route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
  const empty = route => route.fulfill({ status: 204, body: "" });

  await page.route(SUPABASE + "/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;

    // Supabase Auth is simulated locally. No real account is accessed or changed.
    if (path === "/auth/v1/token" && method === "POST") {
      return reply(route, {
        access_token: "e2e-access-token",
        refresh_token: "e2e-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user
      });
    }
    if (path === "/auth/v1/user" && method === "GET") return reply(route, user);
    if (path === "/auth/v1/logout" && method === "POST") return empty(route);
    if (path.startsWith("/auth/v1/")) return reply(route, {});

    if (path.startsWith("/functions/v1/asyut-admin")) return reply(route, { users: [] });
    if (path.startsWith("/functions/v1/asyut-push")) return reply(route, { sent: 0 });

    if (path.startsWith("/rest/v1/rpc/")) {
      const rpc = path.split("/").pop();
      if (rpc === "layan_is_admin") return reply(route, true);
      if (rpc === "layan_admin_review_property_offer" && method === "POST") {
        const body = request.postDataJSON();
        const offer = offers.find(item => String(item.id) === String(body.p_id));
        state.adminReviews.push(body);
        if (offer && body.p_action === "approve") offer.status = "available";
        if (offer && body.p_action === "reject") {
          offer.status = "rejected";
          offer.verification_notes = body.p_notes || "";
        }
        return reply(route, null);
      }
      return reply(route, null);
    }

    if (path === "/rest/v1/property_offers") {
      if (method === "GET") {
        const idFilter = url.searchParams.get("id") || "";
        const statusFilter = url.searchParams.get("status") || "";
        const ownerFilter = url.searchParams.get("owner_id") || "";
        let rows = [...offers];

        if (idFilter.startsWith("eq.")) {
          rows = rows.filter(item => String(item.id) === idFilter.slice(3));
        } else if (idFilter.startsWith("in.(")) {
          const ids = idFilter.slice(4, -1).split(",").map(v => decodeURIComponent(v));
          rows = rows.filter(item => ids.includes(String(item.id)));
        }
        if (ownerFilter.startsWith("eq.")) rows = rows.filter(item => item.owner_id === ownerFilter.slice(3));
        if (statusFilter.startsWith("eq.")) rows = rows.filter(item => item.status === statusFilter.slice(3));
        return reply(route, rows);
      }
      if (method === "POST") {
        const payload = request.postDataJSON();
        state.createdPayload = payload;
        const created = makeOffer({
          ...payload,
          id: CREATED_ID,
          owner_id: USER_ID,
          status: "pending",
          verification_status: "pending",
          created_at: "2026-11-02T10:00:00.000Z"
        });
        offers.push(created);
        return reply(route, [created], 201);
      }
      return empty(route);
    }

    if (path === "/rest/v1/user_favorite_offers") {
      if (method === "GET") return reply(route, []);
      if (method === "POST") return reply(route, [{ user_id: USER_ID, offer_id: FIRST_ID }], 201);
      return empty(route);
    }
    if (path === "/rest/v1/buyer_preferences" && method === "GET") return reply(route, []);
    if (path === "/rest/v1/buyer_offer_alerts" && method === "GET") return reply(route, []);
    if (path === "/rest/v1/buyer_offer_alerts" && method === "POST") return reply(route, [], 201);

    // Other read-only page sections used by the dashboard are empty fixtures.
    if (method === "GET") return reply(route, []);
    return empty(route);
  });

  return { offers, state };
}

test("customer can search, open, save, submit, track and admin-review a property offer", async ({ page }) => {
  const { offers, state } = await installBackendMocks(page);

  // 1. Public discovery and filtering.
  await page.goto("/");
  await expect(page.locator("#offersGrid .offer-card").first()).toContainText("شقة اختبار أسيوط الجديدة");

  await page.locator("#heroPurposeFilter").selectOption("تنازل");
  await page.locator("#heroTypeFilter").selectOption("شقة");
  await page.locator("#heroAreaFilter").selectOption("أسيوط الجديدة");
  await page.locator("#heroBudgetFilter").fill("1000000");
  await page.locator("#heroQuickSearch button[type='submit']").click();
  await expect(page.locator("#offersGrid .offer-card")).toHaveCount(1);
  await expect(page.locator("#offersGrid .offer-card").first()).toContainText("أسيوط الجديدة");

  // 2. The property details route must accept the database's bigint ID.
  await page.locator("#offersGrid .details-button").click();
  await expect(page).toHaveURL(/property\.html\?id=101/);
  await expect(page.locator("#propertyDetailsRoot")).toContainText("شقة اختبار أسيوط الجديدة");
  await expect(page.locator("#propertyDetailsRoot a[href^='tel:']")).toHaveCount(1);

  // 3. Saving an offer is reflected on the dedicated favorites page.
  await page.goto("/");
  await page.locator("#offersGrid [data-favorite-id='101']").click();
  await expect(page.locator("#offersGrid [data-favorite-id='101']")).toHaveAttribute("aria-pressed", "true");
  await page.goto("/favorites.html");
  await expect(page.locator("#favoritesGrid")).toContainText("شقة اختبار أسيوط الجديدة");
  await expect(page.locator("#favoritesCount")).toContainText("1");

  // 4. A simulated user session allows the customer to submit an ordinary free listing.
  await page.goto("/");
  await page.locator("#addOfferTop").click();
  await expect(page.locator("#authDialog")).toBeVisible();
  await page.locator("#authEmail").fill(EMAIL);
  await page.locator("#authPassword").fill(PASSWORD);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#authStatus")).toContainText("تم تسجيل الدخول بنجاح");
  await expect(page.locator("#authDialog")).not.toBeVisible();

  await page.locator("#addOfferTop").click();
  const form = page.locator("#offerForm");
  await expect(page.locator("#offerDialog")).toBeVisible();
  await form.locator("[name='title']").fill("إعلان اختبار رحلة المستخدم");
  await form.locator("[name='listing_purpose']").selectOption("تنازل");
  await form.locator("[name='property_type']").selectOption("شقة");
  await form.locator("[name='city']").fill("أسيوط الجديدة");
  await form.locator("[name='area']").fill("الهضبة");
  await form.locator("[name='total_price']").fill("1200000");
  await form.locator("[name='down_payment']").fill("200000");
  await form.locator("[name='paid_amount']").fill("400000");
  await form.locator("[name='remaining_installments']").fill("800000");
  await form.locator("[name='monthly_installment']").fill("10000");
  await form.locator("[name='contact_phone']").fill("01012345678");
  await form.locator("[name='contact_consent']").check();
  await form.locator("[name='description']").fill("إعلان تجريبي للتأكد من استلام المنصة بيانات العقار وإرساله إلى قائمة مراجعة الإدارة.");
  await form.locator("[name='promotion_plan']").selectOption("standard");
  await form.locator("button[type='submit']").click();

  await expect(page.locator("#statusMessage")).toContainText("تم إرسال العرض للمراجعة");
  expect(state.createdPayload).toBeTruthy();
  expect(state.createdPayload.status).toBe("pending");
  expect(state.createdPayload.owner_id).toBe(USER_ID);
  expect(state.createdPayload.total_price).toBe(1200000);
  expect(state.createdPayload.paid_amount + state.createdPayload.remaining_amount).toBe(1200000);

  // 5. The advertiser sees the pending state in My Listings.
  await page.goto("/my-listings.html");
  await expect(page.locator("#myPropertyOffersGrid")).toContainText("إعلان اختبار رحلة المستخدم");
  await expect(page.locator("#myPropertyOffersGrid")).toContainText("قيد المراجعة");

  // 6. The admin panel checks the server-side allowlist and publishes the pending offer.
  await page.goto("/admin.html");
  await expect(page.locator("#reviewPanel")).toBeVisible();
  const pendingCard = page.locator("[data-property-offer-id='202']");
  await expect(pendingCard).toContainText("إعلان اختبار رحلة المستخدم");
  page.once("dialog", dialog => dialog.accept());
  await pendingCard.locator("[data-property-action='approve']").click();
  await expect(page.locator("#adminStatus")).toContainText("تم اعتماد الإعلان ونشره");
  expect(state.adminReviews).toHaveLength(1);
  expect(state.adminReviews[0].p_id).toBe(202);
  expect(offers.find(item => String(item.id) === CREATED_ID).status).toBe("available");

  // 7. A newly published listing can now be opened from its public details URL.
  await page.goto("/property.html?id=202");
  await expect(page.locator("#propertyDetailsRoot")).toContainText("إعلان اختبار رحلة المستخدم");
});
