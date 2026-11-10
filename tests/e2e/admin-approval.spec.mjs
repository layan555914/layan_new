import { test, expect } from "@playwright/test";

// Added admins (مشرف): every change becomes a request; the owner (مدير) approves and it is performed then.
const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const USER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

async function mock(page) {
  const state = { sponsors: [
    { id: "s1", name: "Rahma Builders", tier: "official", kicker: "الراعي الرسمي لمنصة أسيوط عقار", tagline: "مقاولات وتشطيبات فاخرة", subline: "Since 2001", logo_url: "./assets/brand/golden-ratio-logo.svg?v=1", link_url: "https://example.com/rahma", link_label: "زيارة الموقع", sort_order: 0, is_active: true },
    { id: "s2", name: "Nile Tiles", tier: "partner", tagline: "سيراميك وبورسلين", logo_url: "./assets/brand/golden-ratio-logo.svg?v=1", link_url: null, sort_order: 1, is_active: true }
  ], ads: [
    { id: "a1", owner_id: USER_ID, business_name: "layan", category: "سيراميك وبورسلين", title: "معرض سيراميك asuit", description: "أحدث موديلات السيراميك والبورسلين بأسعار المصنع.", image_url: null, target_url: null, contact_phone: "01012345678", status: "active", price: 0, created_at: "2026-11-09T10:00:00Z" }
  ], rpc: [], patches: [], posts: [], changes: [], finished: [] };
  const user = { id: USER_ID, email: "sponsor-admin@example.invalid", email_confirmed_at: "2026-11-01T00:00:00Z", app_metadata: {}, user_metadata: {} };
  const reply = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route(SUPABASE + "/**", async route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname; const method = req.method();
    if (path === "/auth/v1/token") return reply(route, { access_token: "t", refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user });
    if (path === "/auth/v1/user") return reply(route, user);
    if (path.startsWith("/auth/v1/")) return reply(route, {});
    if (path.startsWith("/rest/v1/rpc/")) {
      const name = path.split("/").pop(); const body = req.postDataJSON?.() || {}; state.rpc.push({ name, body });
      if (name === "layan_is_admin") return reply(route, true);
      if (name === "layan_admin_whoami") return reply(route, globalThis.__role || "owner");
      if (name === "layan_admin_request_change") { state.changes.push(body); return reply(route, "pending"); }
      if (name === "layan_admin_finish_change") { state.finished.push(body); return reply(route, body.p_ok ? "approved" : "failed"); }
      if (name === "layan_admin_list_requests") return reply(route, state.changes.map((c, i) => ({ id: i + 1, action: "change", target: "chg-" + i, target_label: c.p_label, requested_by_email: "helper@example.invalid", status: "pending", created_at: "2026-11-10T10:00:00Z", can_decide: (globalThis.__role || "owner") === "owner", payload: c.p_payload })));
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


async function login(page) {
  await page.goto("/admin.html");
  await page.locator("#adminEmail").fill("sponsor-admin@example.invalid");
  await page.locator("#adminPassword").fill("Test-Only-Password-123!");
  await page.locator("#adminLogin button[type='submit']").click();
}

test("added admin change goes to the owner, owner approves and it is performed", async ({ page }) => {
  page.on("dialog", d => d.accept());
  globalThis.__role = "admin";
  const state = await mock(page);
  await login(page);
  await page.locator("[data-view='sponsors']").click();
  await expect(page.locator("#adminSponsorsList")).toContainText("Rahma Builders");
  await page.locator("[data-sponsor-id='s1'] [data-sp='toggle']").click();
  await expect.poll(() => state.changes.length).toBe(1);
  expect(state.patches.length).toBe(0); // nothing written directly
  expect(state.changes[0].p_payload).toMatchObject({ method: "PATCH", body: { is_active: false } });
  expect(state.changes[0].p_payload.path).toContain("/rest/v1/platform_sponsors?id=eq.s1");
  expect(state.changes[0].p_label).toContain("الرعاة الرسميين");
  await expect(page.locator("#asyutApprovalToast")).toContainText("للموافقة");

  // Owner approves the same request.
  globalThis.__role = "owner";
  const page2 = await page.context().newPage();
  page2.on("dialog", d => d.accept());
  await mock(page2).then(s2 => { s2.changes.push(...state.changes); Object.assign(state, { owner: s2 }); });
  await login(page2);
  await page2.locator("[data-view='requests']").first().click();
  const row = page2.locator("[data-request-action='change']").first();
  await expect(row).toContainText("الرعاة الرسميين");
  await row.locator("[data-request-decide='1']").click();
  await expect.poll(() => state.owner.finished.length).toBe(1);
  expect(state.owner.finished[0]).toMatchObject({ p_id: 1, p_ok: true });
  expect(state.owner.patches.find(p => p.id === "s1")).toMatchObject({ is_active: false });
});
