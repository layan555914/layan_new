import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../config.js", import.meta.url), "utf8");
const context = { window: {} };
vm.runInNewContext(source, context, { timeout: 1000 });

const config = context.window.LAYAN_CONFIG || {};
const base = String(config.SUPABASE_URL || "").replace(/\/$/, "");
const key = String(config.SUPABASE_PUBLISHABLE_KEY || "");
if (!base.startsWith("https://") || !key.startsWith("sb_publishable_")) {
  throw new Error("Production Supabase URL or publishable key is missing from config.js");
}

async function read(path) {
  const response = await fetch(base + "/rest/v1/" + path, {
    method: "GET",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(15000)
  });
  const body = await response.text();
  let data;
  try { data = body ? JSON.parse(body) : null; } catch { data = body; }
  return { response, data };
}

const publicOffers = await read("property_offers?select=id,status&status=eq.available&limit=1");
if (!publicOffers.response.ok || !Array.isArray(publicOffers.data)) {
  throw new Error("Public property_offers read failed (HTTP " + publicOffers.response.status + ")");
}
console.log("PASS: production public property_offers endpoint is reachable (HTTP " + publicOffers.response.status + ").");

const categories = await read("marketplace_categories?select=name,is_active&is_active=eq.true&order=display_order.asc");
if (!categories.response.ok || !Array.isArray(categories.data) || categories.data.length !== 11) {
  throw new Error("Expected 11 active marketplace categories; received HTTP " + categories.response.status +
    " and " + (Array.isArray(categories.data) ? categories.data.length : "non-array") + " rows.");
}
console.log("PASS: production marketplace categories are publicly readable (11 active categories).");

for (const [table, columns] of [
  ["user_favorite_offers", "user_id,offer_id"],
  ["buyer_preferences", "owner_id"]
]) {
  const result = await read(table + "?select=" + columns + "&limit=1");
  if (![401, 403].includes(result.response.status)) {
    throw new Error("Expected anonymous access to " + table + " to be denied with HTTP 401/403; got HTTP " +
      result.response.status + ". Recheck grants and RLS before release.");
  }
  console.log("PASS: anonymous read of " + table + " is denied (HTTP " + result.response.status + ").");
}

console.log("PASS: all live Supabase read-only integration checks passed. No writes were issued.");
