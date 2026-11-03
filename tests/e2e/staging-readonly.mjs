#!/usr/bin/env node
/**
 * Read-only HTTP smoke tests against the isolated hosted ASYUT AQAR staging project.
 * Uses only its public publishable key. No Auth session, service-role key, writes,
 * test accounts, or Storage object changes are used.
 */
import assert from "node:assert/strict";

const base = String(process.env.STAGING_SUPABASE_URL || "").replace(/\/$/, "");
const publishableKey = String(process.env.STAGING_SUPABASE_PUBLISHABLE_KEY || "");

assert.match(base, /^https:\/\/[a-z0-9-]+\.supabase\.co$/i, "STAGING_SUPABASE_URL must be the staging Supabase HTTPS URL");
assert.ok(publishableKey.startsWith("sb_publishable_"), "A public staging publishable key is required");

const timeoutMs = 15000;

function headers(extra = {}) {
  return {
    apikey: publishableKey,
    Authorization: "Bearer " + publishableKey,
    Accept: "application/json",
    ...extra,
  };
}

async function request(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: headers(options.headers || {}),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const raw = await response.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
  return { response, body };
}

async function expectPublicRead(path, label) {
  const { response, body } = await request("/rest/v1/" + path);
  assert.equal(response.status, 200, label + " should be publicly readable; got HTTP " + response.status);
  assert.ok(Array.isArray(body), label + " must return a JSON array");
  console.log("PASS: staging public read — " + label + " (HTTP 200, " + body.length + " rows).");
}

async function expectDenied(path, label) {
  const { response } = await request("/rest/v1/" + path);
  assert.ok([401, 403].includes(response.status),
    label + " must reject anonymous access with HTTP 401/403; got HTTP " + response.status);
  console.log("PASS: staging protects private data — " + label + " (HTTP " + response.status + ").");
}

async function expectRpcDenied(name, payload) {
  const { response } = await request("/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.ok([401, 403].includes(response.status),
    "Anonymous execution of " + name + " must be denied; got HTTP " + response.status);
  console.log("PASS: anonymous RPC denied — " + name + " (HTTP " + response.status + ").");
}

async function main() {
  // This project is intentionally data-empty. The test verifies that its published
  // endpoints and PostgREST API remain reachable without requiring fixture rows.
  await expectPublicRead("marketplace_categories?select=name,is_active&limit=2", "marketplace_categories");
  await expectPublicRead("property_offers?select=id,status&status=eq.available&limit=2", "available property offers");
  await expectPublicRead("marketplace_listings?select=id,status&status=eq.approved&limit=2", "approved marketplace listings");
  await expectPublicRead("directory_areas?select=id,name_ar&limit=2", "directory areas");
  await expectPublicRead("directory_entities?select=id,name_ar&limit=2", "directory entities");
  await expectPublicRead("directory_projects?select=id,name_ar&limit=2", "directory projects");
  await expectPublicRead("directory_opportunities?select=id,name_ar&limit=2", "directory opportunities");
  await expectPublicRead("directory_sources?select=id,title&limit=2", "public directory sources");

  await expectDenied("directory_entity_private?select=entity_id&limit=1", "directory_entity_private");
  await expectDenied("directory_project_private?select=project_id&limit=1", "directory_project_private");
  await expectDenied("buyer_push_vapid_config?select=id&limit=1", "buyer_push_vapid_config");
  await expectDenied("buyer_push_subscriptions?select=id&limit=1", "buyer_push_subscriptions");
  await expectDenied("buyer_preferences?select=id&limit=1", "buyer_preferences");
  await expectDenied("user_favorite_offers?select=user_id&limit=1", "user_favorite_offers");

  await expectRpcDenied("layan_activate_supplier_ad", {
    p_ad_id: "00000000-0000-4000-8000-000000000001", p_days: 30, p_price: 0,
  });
  await expectRpcDenied("layan_reject_supplier_ad", {
    p_ad_id: "00000000-0000-4000-8000-000000000002", p_reason: "رفض اختبار مجهول",
  });
  await expectRpcDenied("layan_approve_free_trial_ad", {
    p_ad_id: "00000000-0000-4000-8000-000000000003",
  });

  const edge = await request("/functions/v1/asyut-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "list_users", page: 1, perPage: 1 }),
  });
  assert.equal(edge.response.status, 401,
    "The asyut-admin Edge Function must reject requests without a user JWT; got HTTP " + edge.response.status);
  console.log("PASS: asyut-admin Edge Function rejects requests without a user JWT (HTTP 401).");

  console.log("PASS: hosted staging HTTP smoke tests completed. No writes, Auth sessions, or Storage changes were issued.");
}

main().catch((error) => {
  console.error("FAIL: " + (error?.stack || error));
  process.exitCode = 1;
});
