import { test, expect } from "@playwright/test";

// Shared header (site-nav.js): «لوحة الإدارة» shows only when the server says the signed-in user is an admin.
const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const USER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

async function mock(page) {
  const state = { sponsors: [
    { id: "s1", name: "Rahma Builders", tier: "official", kicker: "الراعي الرسمي لمنصة أسيوط عقار", tagline: "مقاولات وتشطيبات فاخرة", subline: "Since 2001", logo_url: "./assets/brand/golden-ratio-logo.svg?v=1", link_url: "https://example.com/rahma", link_label: "زيارة الموقع", sort_order: 0, is_active: true },
    { id: "s2", name: "Nile Tiles", tier: "partner", tagline: "سيراميك وبورسلين", logo_url: "./assets/brand/golden-ratio-logo.svg?v=1", link_url: null, sort_order: 1, is_active: true }
  ], ads: [
    { id: "a1", owner_id: USER_ID, business_name: "layan", category: "سيراميك وبورسلين", title: "معرض سيراميك asuit", description: "أحدث موديلات السيراميك والبورسلين بأسعار المصنع.", image_url: null, target_url: null, contact_phone: "01012345678", status: "active", price: 0, created_at: "2026-11-09T10:00:00Z" }
  ], rpc: [], patches: [], posts: [] };
  const user = { id: USER_ID, email: "sponsor-admin@example.invalid", email_confirmed_at: "2026-11-01T00:00:00Z", app_metadata: {}, user_metadata: {} };
  const reply = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route(SUPABASE + "/**", async route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname; const method = req.method();
    if (path === "/auth/v1/token") return reply(route, { access_token: "t", refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user });
    if (path === "/auth/v1/user") return reply(route, user);
    if (path.startsWith("/auth/v1/")) return reply(route, {});
    if (path.startsWith("/rest/v1/rpc/")) {
      const name = path.split("/").pop(); const body = req.postDataJSON?.() || {}; state.rpc.push({ name, body });
      if (name === "layan_is_admin") return reply(route, globalThis.__isAdmin === true);
      if (name === "layan_admin_delete_sponsor") { state.sponsors = state.sponsors.filter(s => s.id !== body.p_id); return reply(route, "done"); }
      if (name === "layan_activate_supplier_ad") { const ad = state.ads.find(a => a.id === body.p_ad_id); if (ad) ad.status = "active"; return reply(route, { success: true }); }
      return reply(route, null);
    }
    if (path === "/rest/v1/platform_sponsors") {
      if (method === "POST") { const row = { id: "s" + (state.sponsors.length + 10), ...req.postDataJSON() }; state.posts.push(row); state.sponsors.push(row); return route.fulfill({ status: 201, body: "" }); }
      if (method === "PATCH") { const id = url.searchParams.get("id").replace("eq.", ""); const body = req.postDataJSON(); state.patches.push({ id, ...body }); Object.assign(state.sponsors.find(s => s.id === id) || {}, body); return route.fulfill({ status: 204, body: "" }); }
      return reply(route, state.sponsors);
    }
    if (path === "/rest/v1/public_active_supplier_ads") return reply(route, state.ads.filter(a => a.status === "active"));
    if (path === "/rest/v1/supplier_ads") {
      if (method === "POST") { const row = { id: "a" + (state.ads.length + 10), created_at: new Date().toISOString(), ...req.postDataJSON() }; state.ads.push(row); return reply(route, [{ id: row.id }], 201); }
      if (method === "PATCH") { const id = url.searchParams.get("id").replace("eq.", ""); Object.assign(state.ads.find(a => a.id === id) || {}, req.postDataJSON()); return route.fulfill({ status: 204, body: "" }); }
      return reply(route, state.ads);
    }
    if (method === "GET") return reply(route, []);
    return route.fulfill({ status: 204, body: "" });
  });
  return state;
}


const login = page => page.addInitScript(() => sessionStorage.setItem("layanSupabaseSession", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Math.floor(Date.now()/1000)+3600, user: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", email: "user@example.invalid" } })));
test("regular signed-in user never sees admin entry", async ({ page }) => {
  globalThis.__isAdmin = false; await mock(page); await login(page);
  for (const p of ["/", "/offers.html", "/featured.html", "/marketplace.html", "/company.html?id=x"]) {
    await page.goto(p); await page.waitForTimeout(1500);
    const vis = await page.evaluate(() => { const a = document.getElementById("adminDashboardLink"); return !!a && !a.hidden && a.offsetParent !== null; });
    expect(vis).toBe(false);
  }
});
test("admin sees it; visitor does not", async ({ page }) => {
  globalThis.__isAdmin = true; await mock(page);
  await page.goto("/featured.html"); await page.waitForTimeout(1200);
  expect(await page.locator("#adminDashboardLink").isVisible()).toBe(false);
  await login(page); await page.goto("/featured.html"); await page.waitForTimeout(1500);
  await expect(page.locator("nav #adminDashboardLink")).toBeVisible();
});
