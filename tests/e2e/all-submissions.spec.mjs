import { test, expect } from "@playwright/test";
import zlib from "node:zlib";

// Every kind of listing a visitor can send must arrive in the admin review queue as "pending":
// all property types and purposes (shops, offices, land, rent, sale, assignment) and services.
const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// A real 2x2 PNG (what an iPhone screenshot gives) — must be converted to JPEG, not rejected.
function tinyPng() {
  const crc = buf => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.from([0, 200, 80, 40, 200, 80, 40, 0, 40, 80, 200, 40, 80, 200]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

async function mockBackend(page) {
  const state = { offers: [], services: [], uploads: [] };
  const user = { id: USER_ID, email: "all-types@example.invalid", email_confirmed_at: "2026-11-01T00:00:00Z", app_metadata: {}, user_metadata: {} };
  const reply = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route(SUPABASE + "/**", async route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname; const method = req.method();
    if (path === "/auth/v1/token") return reply(route, { access_token: "t", refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user });
    if (path === "/auth/v1/user") return reply(route, user);
    if (path.startsWith("/auth/v1/")) return reply(route, {});
    if (path.startsWith("/storage/v1/object/")) {
      const body = req.postDataBuffer();
      state.uploads.push({ type: req.headers()["content-type"], jpeg: !!body && body[0] === 0xFF && body[1] === 0xD8 && body[2] === 0xFF });
      return reply(route, { Key: path });
    }
    if (path.startsWith("/rest/v1/rpc/")) return reply(route, path.endsWith("layan_is_admin") ? true : null);
    if (path === "/rest/v1/property_offers") {
      if (method === "POST") { const p = req.postDataJSON(); const row = { ...p, id: 300 + state.offers.length, created_at: new Date().toISOString() }; state.offers.push(row); return reply(route, [row], 201); }
      const s = url.searchParams.get("status") || "";
      return reply(route, s === "eq.pending" ? state.offers.filter(o => o.status === "pending") : []);
    }
    if (path === "/rest/v1/marketplace_listings") {
      if (method === "POST") { const p = req.postDataJSON(); state.services.push({ ...p, id: "svc-" + state.services.length, created_at: new Date().toISOString() }); return reply(route, [], 201); }
      const s = url.searchParams.get("status") || "";
      return reply(route, s === "eq.pending" ? state.services : []);
    }
    if (method === "GET") return reply(route, []);
    return route.fulfill({ status: 204, body: "" });
  });
  return state;
}

async function login(page) {
  await page.locator("#addOfferTop").click();
  await page.locator("#authEmail").fill("all-types@example.invalid");
  await page.locator("#authPassword").fill("Test-Only-Password-123!");
  await page.locator("#authSubmit").click();
  await expect(page.locator("#authDialog")).not.toBeVisible();
}

const KINDS = [
  ["شقة", "بيع"], ["شقة", "إيجار"], ["شقة", "تنازل"], ["فيلا", "بيع"],
  ["محل تجاري", "إيجار"], ["محل تجاري", "بيع"], ["مكتب إداري", "إيجار"], ["عيادة طبية", "بيع"],
  ["مخزن", "إيجار"], ["معرض", "بيع"], ["أرض مطروحة للبناء", "بيع"], ["أرض تنازل", "تنازل"]
];

test("every property type and purpose reaches the admin review queue as pending", async ({ page }) => {
  test.setTimeout(120000);
  const state = await mockBackend(page);
  await page.goto("/");
  await login(page);
  const png = tinyPng();
  for (const [type, purpose] of KINDS) {
    await page.locator("#addOfferTop").click();
    const form = page.locator("#offerForm");
    await expect(page.locator("#offerDialog")).toBeVisible();
    await form.locator("[name='account_type']").selectOption("individual");
    await form.locator("[name='listing_purpose']").selectOption(purpose);
    await form.locator("[name='property_type']").selectOption(type);
    await form.locator("[name='title']").fill(`${type} ${purpose} اختبار`);
    await form.locator("[name='city']").fill("مدينة أسيوط");
    await form.locator("[name='total_price']").fill(purpose === "إيجار" ? "6000" : "900000");
    await form.locator("[name='photos']").setInputFiles({ name: "IMG_0001.PNG", mimeType: "image/png", buffer: png });
    const before = state.offers.length;
    await page.evaluate(() => { document.getElementById("statusMessage").textContent = ""; });
    await form.locator("button[type='submit']").click();
    await expect.poll(() => state.offers.length, { message: `${type} / ${purpose} was not sent`, timeout: 15000 }).toBe(before + 1);
    await expect(page.locator("#statusMessage")).toContainText("للمراجعة", { timeout: 15000 });
  }
  expect(state.offers).toHaveLength(KINDS.length);
  KINDS.forEach(([type, purpose], i) => {
    expect(state.offers[i]).toMatchObject({ listing_purpose: purpose, status: "pending", owner_id: USER_ID });
    expect(type.startsWith(state.offers[i].property_type)).toBe(true);
    expect(state.offers[i].image_urls).toHaveLength(1);
  });
  // PNG photos were converted and uploaded as real JPEG files.
  expect(state.uploads.length).toBe(KINDS.length);
  expect(state.uploads.every(u => u.type === "image/jpeg" && u.jpeg)).toBe(true);

  await page.goto("/admin.html");
  for (const offer of state.offers) await expect(page.locator(`[data-property-offer-id='${offer.id}']`)).toContainText(offer.title);
});

test("a service listing reaches the admin review queue as pending", async ({ page }) => {
  const state = await mockBackend(page);
  await page.goto("/marketplace.html");
  await page.evaluate(() => {
    localStorage.setItem("layan-supabase-session", "x");
  });
  // Sign in through the main site, then open the service form.
  await page.goto("/");
  await login(page);
  await page.goto("/marketplace.html?add=1");
  const form = page.locator("#marketplaceListingForm");
  await expect(page.locator("#marketplaceListingDialog")).toBeVisible();
  await form.locator("[name='category']").selectOption("مواد البناء والتشطيب");
  await form.locator("[name='title']").fill("مكتب تشطيبات اختبار");
  await form.locator("[name='description']").fill("تشطيب كامل للشقق والمحلات");
  await form.locator("[name='city']").selectOption({ index: 1 }).catch(async () => form.locator("[name='city']").fill("مدينة أسيوط"));
  await form.locator("[name='contact_phone']").fill("01012345678");
  await form.locator("[name='images']").setInputFiles({ name: "shot.png", mimeType: "image/png", buffer: tinyPng() });
  await form.locator("button[type='submit']").click();
  await expect(page.locator("#marketplaceFormStatus")).toContainText("تم استلام إعلانك", { timeout: 15000 });
  expect(state.services).toHaveLength(1);
  expect(state.services[0]).toMatchObject({ category: "مواد البناء والتشطيب", status: "pending", owner_id: USER_ID });

  await page.goto("/admin.html");
  await expect(page.locator("[data-marketplace-id='svc-0']")).toContainText("مكتب تشطيبات اختبار");
});
