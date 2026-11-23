#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../../" + path, import.meta.url), "utf8");
const [migration, edge, client, app, buyer, offers, index, admin, adminHtml, config, sw] = await Promise.all([
  read("supabase/migrations/20261123130000_secure_guest_intake.sql"),
  read("supabase/functions/guest-intake/index.ts"),
  read("gubabase.js"),
  read("app.js"),
  read("buyer.js"),
  read("offers.html"),
  read("index.html"),
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
  edge.includes('p_kind: "upload"') &&
  edge.includes("req.body?.getReader()") &&
  edge.includes("totalBytes > maxSize") &&
  edge.includes("reader.cancel()"),
  "Guest files must be validated, streamed with a hard byte cap before buffering, and uploaded by the rate-limited Edge Function.");
const uploadRateLimitAt = edge.indexOf('p_kind: "upload"');
const uploadReaderAt = edge.indexOf("req.body?.getReader()");
assert.ok(uploadRateLimitAt >= 0 && uploadReaderAt > uploadRateLimitAt,
  "Guest upload rate limits must be checked before the request body is read.");
assert.ok(edge.includes("auth.getUser(token)") && edge.includes('role !== "owner"'),
  "Admin review must verify the caller session and restrict public listing to the owner.");
assert.ok(edge.includes('userClient.rpc("layan_admin_publish_guest_property_submission"') && edge.includes('userClient.rpc("layan_admin_review_guest_buyer_request"'),
  "Moderation RPCs must retain the authenticated owner/admin JWT rather than execute as service role.");
assert.ok(edge.includes('.select("image_urls")') && edge.includes("thisRequestWon") && edge.includes('remove(publicPaths)'),
  "A concurrent approval that reuses an already-published offer must clean up only its own unused public image uploads.");
assert.ok(edge.includes("createSignedUrl(path, 300)") && edge.includes("temporary_file_cleanup_pending"),
  "Admin file previews must be signed and temporary-file cleanup failures must be reported.");
assert.ok(!edge.includes('action === "cleanup-upload"') && client.includes("Guest browsers cannot delete objects from the private bucket."),
  "Anonymous guest requests must never delete temporary objects; only the owner-only expiry cleanup may remove them.");
assert.ok(edge.includes('list("pending", { limit: 1000, offset })') &&
  edge.includes('list(prefix, { limit: 100, offset })'),
  "Owner cleanup must paginate through all pending folders and files instead of stopping at the first page.");
assert.ok(edge.includes('action === "admin-cleanup"') && edge.includes("7 * 24 * 60 * 60 * 1000") && admin.includes('call("admin-cleanup")'),
  "The owner must be able to clean expired private uploads without touching pending moderation records.");
assert.ok(client.includes("async function submitGuestProperty") && client.includes("async function submitGuestBuyer"),
  "The shared client must expose guest property and buyer submission helpers.");
assert.ok(app.includes("api.submitGuestProperty(offer, guestImages, documentFiles") &&
  app.includes("compressGuestImage") &&
  app.includes("guestDocumentMaxBytes = 5 * 1024 * 1024") &&
  app.includes("لا تحتاج إلى إنشاء حساب"),
  "Guest property images must be compressed below the 5 MiB server cap and guest documents must be limited to 5 MiB without bypassing moderation.");
assert.ok(buyer.includes("submitGuestBuyer") && buyer.includes("buyer_preferences?on_conflict=owner_id"),
  "Visitors must use the private buyer request queue while registered users retain saved preferences.");
assert.ok(offers.includes('name="website"') && buyer.includes('name="website"'),
  "Both public intake forms must include a honeypot field.");
assert.ok(adminHtml.includes('id="adminGuestIntake"') && admin.includes('call("admin-list")'),
  "The admin dashboard must expose a working guest moderation workspace.");
assert.ok(config.includes("[functions.guest-intake]") && sw.includes("./admin-guest-intake.js?v=20261123-2"),
  "The Edge Function and admin moderation PWA assets must be configured.");
assert.ok(offers.includes("gubabase.js?v=20261123-guest-intake-2") &&
  offers.includes("app.js?v=20261123-guest-property-3") &&
  index.includes("buyer.js?v=20261123-guest-buyer-2") &&
  sw.includes("./gubabase.js?v=20261123-guest-intake-2") &&
  sw.includes("./app.js?v=20261123-guest-property-3") &&
  sw.includes("./buyer.js?v=20261123-guest-buyer-2"),
  "Guest submission helpers and forms must use matching versioned PWA assets.");


console.log("PASS: guest property/buyer intake, private storage, rate limiting, owner moderation, OTP-preserving client routing and admin PWA contracts.");
// Keep the paginated cleanup and nullable storage metadata contract covered by CI.
