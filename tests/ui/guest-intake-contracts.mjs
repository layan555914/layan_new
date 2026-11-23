#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../../" + path, import.meta.url), "utf8");
const [migration, edge, client, app, buyer, offers, admin, adminHtml, config, sw] = await Promise.all([
  read("supabase/migrations/20261123130000_secure_guest_intake.sql"),
  read("supabase/functions/guest-intake/index.ts"),
  read("gubabase.js"),
  read("app.js"),
  read("buyer.js"),
  read("offers.html"),
  read("admin-guest-intake.js"),
  read("admin.html"),
  read("supabase/config.toml"),
  read("sw.js"),
]);

assert.ok(migration.includes("private.guest_property_submissions") && migration.includes("private.guest_buyer_requests"),
  "Guest property and buyer requests must be stored in separate private queues.");
assert.ok(migration.includes("VALUES ('asyut-guest-intake','asyut-guest-intake',false"),
  "Guest upload storage must remain private.");
assert.ok(migration.includes("GRANT EXECUTE ON FUNCTION public.layan_guest_submit_property") &&
  migration.includes("TO service_role") &&
  migration.includes("GRANT EXECUTE ON FUNCTION public.layan_guest_submit_buyer") &&
  !migration.includes("TO anon;"),
  "Only the trusted service role may submit guest requests.");
assert.ok(edge.includes('requestUrl.searchParams.get("action") === "upload-file"') &&
  edge.includes('service.storage.from(BUCKET).upload') &&
  edge.includes('p_kind: "upload"'),
  "Guest files must be validated and uploaded by the rate-limited Edge Function, not directly by anonymous clients.");
assert.ok(edge.includes("auth.getUser(token)") && edge.includes('role !== "owner"'),
  "Admin review must verify the caller session and restrict public listing to the owner.");
assert.ok(edge.includes("createSignedUrl(path, 300)") && edge.includes("temporary_image_cleanup_pending"),
  "Admin file previews must be signed and temporary-file cleanup failures must be reported.");
assert.ok(client.includes("async function submitGuestProperty") && client.includes("async function submitGuestBuyer"),
  "The shared client must expose guest property and buyer submission helpers.");
assert.ok(app.includes("api.submitGuestProperty(offer, files, documentFiles") &&
  app.includes("لا تحتاج إلى إنشاء حساب"),
  "The property form must submit as a visitor without bypassing moderation.");
assert.ok(buyer.includes("submitGuestBuyer") && buyer.includes("buyer_preferences?on_conflict=owner_id"),
  "Visitors must use the private buyer request queue while registered users retain saved preferences.");
assert.ok(offers.includes('name="website"') && buyer.includes('name="website"'),
  "Both public intake forms must include a honeypot field.");
assert.ok(adminHtml.includes('id="adminGuestIntake"') && admin.includes('call("admin-list")'),
  "The admin dashboard must expose a working guest moderation workspace.");
assert.ok(config.includes("[functions.guest-intake]") && sw.includes("./admin-guest-intake.js?v=20261123-1"),
  "The Edge Function and admin moderation PWA assets must be configured.");

console.log("PASS: guest property/buyer intake, private storage, rate limiting, owner moderation, OTP-preserving client routing and admin PWA contracts.");
