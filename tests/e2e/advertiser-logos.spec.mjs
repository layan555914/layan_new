import { test, expect } from "@playwright/test";
import zlib from "node:zlib";

// Advertiser = account + advertiser name. Logo in the circle next to the name (per name), advertiser page per name,
// and logos uploaded from «إعلاناتي» as a centred square JPEG (any size/shape fits the circle).
const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const OWNER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LOGO = SUPABASE + "/storage/v1/object/public/layan_real_estat/offers/" + OWNER + "/logo-test.jpg";

function png(w, h) {
  const crc = buf => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 120)]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
function jpegSize(buf) {
  for (let i = 2; i < buf.length - 9;) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xC0 && m <= 0xC3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

async function mock(page, state) {
  const reply = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  const user = { id: OWNER, email: "logo-owner@example.invalid", email_confirmed_at: "2026-11-01T00:00:00Z", app_metadata: {}, user_metadata: {} };
  await page.route(SUPABASE + "/**", async route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname; const method = req.method();
    if (path === "/auth/v1/user") return reply(route, user);
    if (path.startsWith("/auth/v1/")) return reply(route, {});
    if (path.startsWith("/storage/v1/object/public/")) return route.fulfill({ status: 200, contentType: "image/png", body: png(40, 40) });
    if (path.startsWith("/storage/v1/object/") && method === "POST") { state.uploads.push({ path, type: req.headers()["content-type"], body: req.postDataBuffer() }); return reply(route, { Key: path }); }
    if (path === "/rest/v1/rpc/layan_advertiser_logos") { const items = req.postDataJSON().p_items || []; state.asked.push(...items); return reply(route, items.map(i => ({ owner_id: i.o, brand_key: i.n.trim().toLowerCase(), logo_url: i.n.trim().toLowerCase() === "hayah city" ? LOGO : null }))); }
    if (path === "/rest/v1/rpc/layan_my_advertiser_logos") return reply(route, state.mine);
    if (path === "/rest/v1/rpc/layan_admin_whoami") return reply(route, "none");
    if (path === "/rest/v1/rpc/layan_set_my_advertiser_logo") { const b = req.postDataJSON(); state.set.push(b); state.mine = [{ brand_key: b.p_brand.toLowerCase(), brand_name: b.p_brand, logo_url: null, pending_logo_url: b.p_url }]; return reply(route, "pending"); }
    if (path === "/rest/v1/property_offers" && url.searchParams.get("select") === "contact_name,developer_name") return reply(route, [{ contact_name: "Hayah City" }, { contact_name: "مباني أدريس" }, { contact_name: "Hayah  City" }]);
    const offer = (id, name) => ({ id, title: "إعلان " + name, governorate: "أسيوط", city: "مدينة أسيوط", area: "الحمراء", property_type: "شقة", listing_purpose: "بيع",
      total_price: 1500000, area_m2: 120, bedrooms: 3, bathrooms: 2, status: "available", image_urls: [], contact_name: name, owner_id: OWNER,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    if (path === "/rest/v1/property_offers" && method === "GET") return reply(route, (url.searchParams.get("status") || "") === "eq.available" ? [offer(501, "Hayah City"), offer(502, "مباني أدريس")] : []);
    if (method === "GET") return reply(route, []);
    return reply(route, null);
  });
}

test("listing card shows the advertiser's approved logo in the circle", async ({ page }) => {
  const state = { uploads: [], set: [], mine: [], asked: [] };
  await mock(page, state);
  await page.goto("/offers.html");
  const avatar = page.locator(`[data-owner-avatar='${OWNER}'][data-brand='Hayah City']`).first();
  await expect(avatar).toHaveClass(/has-logo/, { timeout: 15000 });
  await expect(avatar.locator("img.adv-logo-img")).toHaveAttribute("src", LOGO);
  const box = await avatar.boundingBox();
  const img = await avatar.locator("img").boundingBox();
  expect(Math.round(img.width)).toBe(Math.round(box.width));
  // The same account's other company keeps its own (letter) avatar — logos are per advertiser name.
  await expect(page.locator(`[data-owner-avatar='${OWNER}'][data-brand='مباني أدريس']`)).not.toHaveClass(/has-logo/);
  // «كل إعلانات المعلن» opens a page for that name only.
  const href = await page.locator(".listing-card", { hasText: "إعلان Hayah City" }).locator(".listing-advertiser a").getAttribute("href");
  expect(href).toContain("name=Hayah%20City");
  await page.goto(href);
  await expect(page.locator("#advertiserName")).toHaveText("Hayah City");
  await expect(page.locator(".listing-card", { hasText: "إعلان Hayah City" })).toBeVisible();
  await expect(page.locator(".listing-card", { hasText: "إعلان مباني أدريس" })).toHaveCount(0);
});

test("a large, wide image is shrunk to fit a 512×512 JPEG (whole logo kept) and sent for approval", async ({ page }) => {
  const state = { uploads: [], set: [], mine: [], asked: [] };
  await mock(page, state);
  await page.addInitScript(o => sessionStorage.setItem("layanSupabaseSession", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: o, email: "logo-owner@example.invalid" } })), OWNER);
  await page.goto("/my-listings.html");
  await expect(page.locator("#myLogoCard")).toBeVisible();
  // one row per advertiser name used in my listings (duplicates with extra spaces merged)
  await expect(page.locator("[data-brand-row]")).toHaveCount(2);
  await page.locator("[data-brand-row='مباني أدريس'] [data-logo-input]").setInputFiles({ name: "wide-logo.png", mimeType: "image/png", buffer: png(1600, 500) });
  await expect.poll(() => state.set.length).toBe(1);
  expect(state.uploads).toHaveLength(1);
  expect(state.uploads[0].type).toBe("image/jpeg");
  expect(state.uploads[0].path).toContain("/offers/" + OWNER + "/logo-");
  expect(jpegSize(state.uploads[0].body)).toEqual({ w: 512, h: 512 });
  expect(state.set[0].p_brand).toBe("مباني أدريس");
  expect(state.set[0].p_url).toContain("/storage/v1/object/public/layan_real_estat/offers/" + OWNER + "/logo-");
  await expect(page.locator("[data-brand-row='مباني أدريس'] .my-logo-status")).toContainText("بانتظار مراجعة الإدارة");
});
