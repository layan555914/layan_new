import { test, expect } from "@playwright/test";
import zlib from "node:zlib";

// «إعلاناتي»: an owner edits their own listings (data + photos + cover photo); edits to published
// listings go to the admin, who sees old vs new and approves.
const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const IMG = n => SUPABASE + "/storage/v1/object/public/layan_real_estat/offers/" + USER_ID + "/" + n + ".jpg";

function tinyPng() {
  const crc = buf => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.from([0, 200, 80, 40, 200, 80, 40, 0, 40, 80, 200, 40, 80, 200]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

async function mockBackend(page, { admin = false } = {}) {
  const state = { rpc: [], uploads: 0 };
  const user = { id: USER_ID, email: "owner-edit@example.invalid", email_confirmed_at: "2026-11-01T00:00:00Z", app_metadata: {}, user_metadata: {} };
  const offers = [
    { id: 501, title: "كمبوند أصايلة فيوز", property_type: "شقة", listing_purpose: "بيع", city: "أسيوط الجديدة", area: "", total_price: 1, contact_phone: "01000000000", description: "وصف قديم", image_urls: [IMG("a"), IMG("b")], status: "available", created_at: "2026-11-01T00:00:00Z" },
    { id: 502, title: "شقة لسه في المراجعة", property_type: "شقة", listing_purpose: "إيجار", city: "مدينة أسيوط", total_price: 3000, contact_phone: "01000000001", image_urls: [], status: "pending", created_at: "2026-11-02T00:00:00Z" }
  ];
  const services = [{ id: "11111111-2222-4333-8444-555555555555", category: "تشطيبات", listing_type: "خدمة", title: "تشطيب شقق", description: "وصف", city: "أسيوط", price: null, contact_phone: "0111", status: "approved", image_urls: [], details: {}, created_at: "2026-11-01T00:00:00Z" }];
  const reply = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route(SUPABASE + "/**", async route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
    if (path === "/auth/v1/token") return reply(route, { access_token: "t", refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user });
    if (path === "/auth/v1/user") return reply(route, user);
    if (path.startsWith("/auth/v1/")) return reply(route, {});
    if (path.startsWith("/storage/v1/object/")) { if (req.method() === "POST") state.uploads++; return reply(route, { Key: path }); }
    if (path.startsWith("/rest/v1/rpc/")) {
      const name = path.split("/").pop(); const body = req.postDataJSON?.() || {};
      state.rpc.push({ name, body });
      if (name === "layan_is_admin") return reply(route, admin);
      if (name === "layan_owner_update_offer") return reply(route, body.p_id === 501 ? "pending" : "saved");
      if (name === "layan_owner_set_offer_status") return reply(route, body.p_status);
      if (name.startsWith("layan_owner_delete")) return reply(route, "deleted");
      if (name === "layan_admin_list_pending_edits") return reply(route, [{ kind: "offer", id: "501", title: "كمبوند أصايلة فيوز", owner_email: user.email, current: { total_price: 1, image_urls: [IMG("a")] }, proposed: { total_price: 4500000, image_urls: [IMG("b"), IMG("a")] }, requested_at: "2026-11-08T10:00:00Z" }]);
      if (name === "layan_admin_review_edit") return reply(route, body.p_approve ? "approved" : "rejected");
      return reply(route, null);
    }
    if (path === "/rest/v1/property_offers") return reply(route, url.searchParams.get("owner_id") ? offers : []);
    if (path === "/rest/v1/marketplace_listings") return reply(route, url.searchParams.get("owner_id") ? services : []);
    if (req.method() === "GET") return reply(route, []);
    return route.fulfill({ status: 204, body: "" });
  });
  await page.addInitScript(([u]) => {
    sessionStorage.setItem("layanSupabaseSession", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Math.floor(Date.now() / 1000) + 3600, user: u }));
  }, [user]);
  return state;
}

test("owner edits a published listing: all data, new photo and cover photo go to admin approval", async ({ page }) => {
  const state = await mockBackend(page);
  await page.goto("/my-listings.html");
  await expect(page.locator(".aa-my-listings")).toBeVisible();
  const card = page.locator("[data-kind='offer'][data-id='501']");
  await expect(card.getByRole("button", { name: "تعديل الإعلان" })).toBeVisible();
  await expect(page.locator("[data-kind='offer'][data-id='502']").getByRole("button", { name: "تعديل الإعلان" })).toBeVisible();
  await expect(page.locator("[data-kind='service']").getByRole("button", { name: "تعديل الإعلان" })).toBeVisible();

  await card.getByRole("button", { name: "تعديل الإعلان" }).click();
  const dialog = page.locator(".my-edit-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("هتفضل ظاهرة");
  await dialog.locator("[name='total_price']").fill("4500000");
  await dialog.locator("[name='description']").fill("وصف جديد للفيلات");
  await dialog.locator("[data-cover='1']").click();
  await expect(dialog.locator("figure.is-cover img")).toHaveAttribute("src", IMG("b"));
  await dialog.locator("#myEditFiles").setInputFiles({ name: "screenshot.png", mimeType: "image/png", buffer: tinyPng() });
  await expect(dialog.locator("figure")).toHaveCount(3);
  await dialog.getByRole("button", { name: "حفظ التعديل" }).click();
  await expect(page.locator("#myListingsStatus")).toContainText("تم إرسال التعديل للإدارة");

  const call = state.rpc.find(c => c.name === "layan_owner_update_offer");
  expect(call.body.p_id).toBe(501);
  expect(call.body.p_changes.total_price).toBe(4500000);
  expect(call.body.p_changes.description).toBe("وصف جديد للفيلات");
  expect(call.body.p_changes.image_urls).toHaveLength(3);
  expect(call.body.p_changes.image_urls[0]).toBe(IMG("b"));
  expect(call.body.p_changes.image_urls[1]).toBe(IMG("a"));
  expect(call.body.p_changes.title).toBeUndefined();
  expect(state.uploads).toBe(1);

  await card.getByRole("button", { name: "تم البيع" }).click();
  await expect.poll(() => state.rpc.find(c => c.name === "layan_owner_set_offer_status")?.body.p_status).toBe("sold");

  const del = page.locator("[data-kind='offer'][data-id='502'] [data-act='delete']");
  await del.click();
  expect(state.rpc.some(c => c.name === "layan_owner_delete_offer")).toBe(false);
  await del.click();
  await expect.poll(() => state.rpc.find(c => c.name === "layan_owner_delete_offer")?.body.p_id).toBe(502);
});

test("admin sees published-listing edits side by side and approves", async ({ page }) => {
  const state = await mockBackend(page, { admin: true });
  await page.goto("/admin.html");
  await page.locator("[data-view='review']").click();
  const edit = page.locator("[data-edit-id='501']");
  await expect(edit).toContainText("المنشور حاليًا");
  await expect(edit).toContainText("4500000");
  await expect(edit.locator(".adm-edit-imgs small").first()).toHaveText("الغلاف");
  await edit.locator("[data-edit-action='approve']").click();
  await expect.poll(() => state.rpc.find(c => c.name === "layan_admin_review_edit")?.body).toEqual({ p_kind: "offer", p_id: "501", p_approve: true, p_notes: null });
});
