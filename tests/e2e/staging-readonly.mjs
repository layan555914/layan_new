#!/usr/bin/env node
/**
 * Public HTTP smoke tests against the isolated hosted ASYUT AQAR staging project.
 * Uses only its public publishable key. No Auth session, service-role key, writes
 * that are allowed to persist, test accounts, or Storage object changes are used.
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


async function expectRows(path, label, expectedCount) {
  const { response, body } = await request("/rest/v1/" + path);
  assert.equal(response.status, 200, label + " should be publicly readable; got HTTP " + response.status);
  assert.ok(Array.isArray(body), label + " must return a JSON array");
  assert.equal(body.length, expectedCount, label + " expected " + expectedCount + " staging fixture rows; got " + body.length);
  console.log("PASS: staging fixture read — " + label + " (" + body.length + " rows).");
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
  // The project contains only explicitly labelled synthetic test fixtures.
  // Exact counts ensure pages read the intended fixture rows and nothing else.
  await expectRows("marketplace_categories?select=name,is_active,description&is_active=eq.true&order=display_order.asc", "active marketplace categories", 11);
  await expectRows("property_offers?select=id,title,status&status=eq.available", "available staging property offers", 2);
  await expectRows("marketplace_listings?select=id,title,status&status=eq.approved", "approved staging marketplace listings", 1);
  await expectRows("directory_areas?select=id,name_ar&public_visible=eq.true&verification_status=eq.published&is_active=eq.true", "published staging areas", 3);
  await expectRows("directory_entities?select=id,name_ar&public_visible=eq.true&verification_status=eq.published", "published staging entities", 1);
  await expectRows("directory_projects?select=id,name_ar&public_visible=eq.true&verification_status=eq.published", "published staging projects", 1);
  await expectRows("directory_opportunities?select=id,name_ar&public_visible=eq.true&verification_status=eq.published", "published staging opportunities", 1);
  await expectRows("directory_sources?select=id,title&is_public=eq.true", "public synthetic directory sources", 1);

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


  // Public bucket means public downloads, not public uploads. An anonymous write
  // attempt must be rejected; no object is created by this check.
  const anonymousUpload = await request("/storage/v1/object/layan_real_estat/staging-smoke/anonymous-denied-20261103.jpg", {
    method: "POST",
    headers: {
      "Content-Type": "image/jpeg",
      "x-upsert": "false"
    },
    body: Buffer.from([0xff, 0xd8, 0xff, 0xd9])
  });
  const uploadErrorText = JSON.stringify(anonymousUpload.body || {});
  assert.ok([400, 401, 403].includes(anonymousUpload.response.status)
      && /unauthorized|row-level security|accessdenied/i.test(uploadErrorText),
    "Anonymous image upload must be rejected by Storage RLS; got HTTP " + anonymousUpload.response.status +
      " with body " + uploadErrorText);
  console.log("PASS: anonymous upload to public image bucket is rejected by Storage RLS (HTTP " +
    anonymousUpload.response.status + "; " + uploadErrorText.slice(0, 240) + ").");

  const edge = await request("/functions/v1/asyut-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "list_users", page: 1, perPage: 1 }),
  });
  assert.equal(edge.response.status, 401,
    "The asyut-admin Edge Function must reject requests without a user JWT; got HTTP " + edge.response.status);
  console.log("PASS: asyut-admin Edge Function rejects requests without a user JWT (HTTP 401).");

  console.log("PASS: hosted staging HTTP smoke tests completed. Only anonymous denied-upload was attempted; no Auth sessions or successful Storage writes were used.");
}

main().catch((error) => {
  console.error("FAIL: " + (error?.stack || error));
  process.exitCode = 1;
});
