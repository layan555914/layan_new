import { test, expect } from "@playwright/test";

// Official sponsors and sponsored ads come from the database and are managed from the admin page.
const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const USER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

async function mock(page) {
  const state = { authRequests: [], sponsors: [
    { id: "s1", name: "Rahma Builders", tier: "official", kicker: "الراعي الرسمي لمنصة أسيوط عقار", tagline: "مقاولات وتشطيبات فاخرة", subline: "Since 2001", logo_url: "./assets/brand/golden-ratio-logo.svg?v=1", link_url: "https://example.com/rahma", link_label: "زيارة الموقع", sort_order: 0, is_active: true },
    { id: "s2", name: "Nile Tiles", tier: "partner", tagline: "سيراميك وبورسلين", logo_url: "./assets/brand/golden-ratio-logo.svg?v=1", link_url: null, sort_order: 1, is_active: true }
  ], ads: [
    { id: "a1", owner_id: USER_ID, business_name: "layan", category: "سيراميك وبورسلين", title: "معرض سيراميك asuit", description: "أحدث موديلات السيراميك والبورسلين بأسعار المصنع.", image_url: null, target_url: null, contact_phone: "01012345678", placement_keys: ["home", "offers", "marketplace", "featured"], status: "active", price: 0, created_at: "2026-11-09T10:00:00Z" }
  ], rpc: [], patches: [], adPatches: [], posts: [] };
  const user = { id: USER_ID, email: "sponsor-admin@example.invalid", email_confirmed_at: "2026-11-01T00:00:00Z", app_metadata: {}, user_metadata: {} };
  const reply = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route(SUPABASE + "/**", async route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname; const method = req.method();
    if (path === "/auth/v1/otp") {
      state.authRequests.push({ path, body: req.postDataJSON?.() || {} });
      return reply(route, {});
    }
    if (path === "/auth/v1/verify") {
      state.authRequests.push({ path, body: req.postDataJSON?.() || {} });
      return reply(route, { access_token: "t", refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user });
    }
    if (path === "/auth/v1/user") return reply(route, user);
    if (path.startsWith("/auth/v1/")) return reply(route, {});
    if (path.startsWith("/rest/v1/rpc/")) {
      const name = path.split("/").pop(); const body = req.postDataJSON?.() || {}; state.rpc.push({ name, body });
      if (name === "layan_is_admin") return reply(route, true);
      if (name === "layan_admin_delete_sponsor") { state.sponsors = state.sponsors.filter(s => s.id !== body.p_id); return reply(route, "done"); }
      if (name === "layan_activate_supplier_ad") { const ad = state.ads.find(a => a.id === body.p_ad_id); if (ad) ad.status = "active"; return reply(route, { success: true }); }
      return reply(route, null);
    }
    if (path === "/rest/v1/platform_sponsors") {
      if (method === "POST") { const row = { id: "s" + (state.sponsors.length + 10), ...req.postDataJSON() }; state.posts.push(row); state.sponsors.push(row); return route.fulfill({ status: 201, body: "" }); }
      if (method === "PATCH") { const id = url.searchParams.get("id").replace("eq.", ""); const body = req.postDataJSON(); state.patches.push({ id, ...body }); Object.assign(state.sponsors.find(s => s.id === id) || {}, body); return route.fulfill({ status: 204, body: "" }); }
      return reply(route, state.sponsors);
    }
    if (path === "/rest/v1/property_offers") return reply(route, [{
      id: 101, title: "شقة اختبار في أسيوط", listing_purpose: "بيع", property_type: "شقة",
      city: "أسيوط", area: "حي شرق", area_m2: 120, total_price: 1500000,
      price_on_request: false, description: "تفاصيل عقار لاختبار موضع الإعلان المميز.",
      image_urls: [], contact_phone: "01012345678", is_featured: false,
      created_at: "2026-11-20T10:00:00Z", updated_at: "2026-11-20T10:00:00Z"
    }]);
    if (path === "/rest/v1/public_active_supplier_ads") return reply(route, state.ads.filter(a => a.status === "active"));
    if (path === "/rest/v1/supplier_ads") {
      if (method === "POST") { const row = { id: "a" + (state.ads.length + 10), created_at: new Date().toISOString(), ...req.postDataJSON() }; state.ads.push(row); return reply(route, [{ id: row.id }], 201); }
      if (method === "PATCH") { const id = url.searchParams.get("id").replace("eq.", ""); const body = req.postDataJSON(); state.adPatches.push({ id, ...body }); Object.assign(state.ads.find(a => a.id === id) || {}, body); return route.fulfill({ status: 204, body: "" }); }
      return reply(route, state.ads);
    }
    if (method === "GET") return reply(route, []);
    return route.fulfill({ status: 204, body: "" });
  });
  return state;
}

test("home page shows the sponsors and the premium sponsored ad from the database", async ({ page }) => {
  await mock(page);
  await page.goto("/");
  const section = page.locator("#official-sponsor");
  await expect(section.locator(".os-premium h2")).toHaveText("Rahma Builders");
  await expect(section).toContainText("مقاولات وتشطيبات فاخرة");
  await expect(section.locator(".os-partner")).toContainText("Nile Tiles");
  const ad = page.locator(".sp-ad").first();
  await expect(ad).toContainText("معرض سيراميك asuit");
  // The shared premium ad component labels this placement as featured, not a paid "sponsored" disclosure.
  await expect(ad.locator(".sp-ad-badge")).toContainText("إعلان مميز");
  await expect(ad.locator(".sp-ad-monogram")).toBeVisible();
  await expect(ad.locator("a[href^='tel:']")).toBeVisible();
});

test("admin adds, hides and deletes sponsors and publishes a sponsored ad", async ({ page }) => {
  const state = await mock(page);
  page.on("dialog", d => d.accept(d.type() === "prompt" ? "30" : undefined));
  await page.goto("/admin.html");
  await expect(page.locator("#adminConsole")).toBeHidden();
  await expect(page.locator("#adminPassword")).toHaveCount(0);
  await page.locator("#adminEmail").fill("sponsor-admin@example.invalid");
  await page.locator("#adminLoginSubmit").click();
  await expect(page.locator("#adminOtpCode")).toBeVisible();
  await page.locator("#adminOtpCode").fill("123456");
  await page.locator("#adminLoginSubmit").click();
  await expect(page.locator("#adminConsole")).toBeVisible();
  expect(state.authRequests).toEqual([
    { path: "/auth/v1/otp", body: { email: "sponsor-admin@example.invalid", create_user: false } },
    { path: "/auth/v1/verify", body: { email: "sponsor-admin@example.invalid", token: "123456", type: "email" } }
  ]);
  await page.locator("[data-view='sponsors']").click();
  await expect(page.locator("#adminSponsorsList")).toContainText("Rahma Builders");
  await expect(page.locator("#adminSponsoredAdsList")).toContainText("معرض سيراميك asuit");

  await page.locator("#addSponsorBtn").click();
  const dlg = page.locator(".as-dialog[open]");
  await dlg.locator("[name='name']").fill("Delta Paints");
  await dlg.locator("[name='tier']").selectOption("partner");
  await dlg.locator("[name='logo_url']").fill("https://example.com/logo.jpg");
  await dlg.locator("button[type='submit']").click();
  await expect.poll(() => state.posts.length).toBe(1);
  expect(state.posts[0]).toMatchObject({ name: "Delta Paints", tier: "partner", logo_url: "https://example.com/logo.jpg", is_active: true });

  await page.locator("[data-sponsor-id='s1'] [data-sp='toggle']").click();
  await expect.poll(() => state.patches.find(p => p.id === "s1")?.is_active).toBe(false);
  await page.locator("[data-sponsor-id='s2'] [data-sp='delete']").click();
  await expect.poll(() => state.rpc.some(r => r.name === "layan_admin_delete_sponsor" && r.body.p_id === "s2")).toBe(true);

  await page.locator("#addSponsoredAdBtn").click();
  const ad = page.locator(".as-dialog[open]");
  const availableAdCategories = await ad.locator("[name='category'] option").allTextContents();
  expect(availableAdCategories).toEqual(expect.arrayContaining([
    "الإضاءة ووحدات الإنارة",
    "السيراميك والبورسلين والأدوات الصحية",
    "مكاتب التصميم الهندسي"
  ]));
  await ad.locator("[name='category']").selectOption({ label: "السيراميك والبورسلين والأدوات الصحية" });
  await ad.locator("[name='placement_keys'][value='marketplace']").check();
  await ad.locator("[name='placement_keys'][value='featured']").check();
  await ad.locator("[name='business_name']").fill("مصنع النيل");
  await ad.locator("[name='title']").fill("خصم 20% على البورسلين");
  await ad.locator("[name='description']").fill("عرض لفترة محدودة لعملاء أسيوط عقار.");
  await ad.locator("[name='contact_phone']").fill("01098765432");
  await ad.locator("[name='days']").fill("15");
  await ad.locator("button[type='submit']").click();
  await expect.poll(() => state.rpc.find(r => r.name === "layan_activate_supplier_ad")?.body.p_days).toBe(15);
  expect(state.ads.at(-1)).toMatchObject({ business_name: "مصنع النيل", status: "active", owner_id: USER_ID, placement_keys: ["marketplace", "featured"] });
});


test("featured commercial ads only include ads assigned to the featured page", async ({ page }) => {
  const state = await mock(page);
  state.ads[0].placement_keys = ["home", "marketplace"];
  state.ads.push({
    id: "featured-only",
    owner_id: USER_ID,
    business_name: "شركة الظهور المميز",
    category: "مواد البناء والتشطيب",
    title: "إعلان مخصص لصفحة الإعلانات المميزة",
    description: "إعلان اختبار لموضع الصفحة المميزة.",
    image_url: null,
    target_url: null,
    contact_phone: "01022223333",
    placement_keys: ["featured"],
    status: "active",
    price: 0,
    created_at: "2026-11-10T10:00:00Z"
  });

  await page.goto("/featured.html");
  const grid = page.locator("#featuredSponsorsGrid");
  await expect(grid).toContainText("إعلان مخصص لصفحة الإعلانات المميزة");
  await expect(grid).not.toContainText("معرض سيراميك asuit");
});


test("property detail page shows only ads explicitly assigned to the property-details placement", async ({ page }) => {
  const state = await mock(page);
  state.ads.push({
    id: "property-details-only",
    owner_id: USER_ID,
    business_name: "مركز تشطيب أسيوط",
    category: "مواد البناء والتشطيب",
    title: "عرض تشطيب للوحدات الجديدة",
    description: "خدمات تشطيب ومواد بناء لأصحاب الوحدات.",
    image_url: null,
    target_url: null,
    contact_phone: "01033334444",
    placement_keys: ["property_details"],
    status: "active",
    price: 0,
    created_at: "2026-11-20T11:00:00Z"
  });

  await page.goto("/property.html?id=101");
  const section = page.locator("#propertySponsoredAds");
  await expect(section).toBeVisible();
  await expect(section).toContainText("عرض تشطيب للوحدات الجديدة");
  await expect(section).toContainText("مركز تشطيب أسيوط");
  await expect(section).not.toContainText("معرض سيراميك asuit");
});
