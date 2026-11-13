#!/usr/bin/env node
/**
 * Exercise the private ASYUT AQAR CRM through a disposable local Supabase API.
 * This test refuses to run against any non-loopback Auth, REST or database host.
 */
import { randomUUID, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";

const apiUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!apiUrl || !anonKey || !serviceRoleKey || !databaseUrl) {
  throw new Error("API_URL, ANON_KEY, SERVICE_ROLE_KEY and DATABASE_URL are required.");
}

const api = new URL(apiUrl);
const database = new URL(databaseUrl);
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
if (!localHosts.has(api.hostname) || !localHosts.has(database.hostname)) {
  throw new Error("Refusing to run CRM API tests against a non-local Supabase host.");
}

const runId = randomUUID();
const password = "Crm!9" + randomBytes(24).toString("hex");
const users = [];
let ownerId = null;
let adminId = null;
let leadId = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function authHeaders(apiKey, token, extra = {}) {
  return {
    apikey: apiKey,
    Authorization: "Bearer " + token,
    ...extra,
  };
}

async function request(path, options = {}) {
  const response = await fetch(new URL(path, apiUrl), options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
}

async function createUser(label) {
  const email = "crm-" + label + "-" + runId + "@example.com";
  const { response, body } = await request("/auth/v1/admin/users", {
    method: "POST",
    headers: authHeaders(serviceRoleKey, serviceRoleKey, { "content-type": "application/json" }),
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  assert(response.ok && body?.id, "Could not create a disposable local CRM test user (HTTP " + response.status + ").");
  users.push(body.id);
  return { id: body.id, email };
}

async function signIn(email) {
  const { response, body } = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: authHeaders(anonKey, anonKey, { "content-type": "application/json" }),
    body: JSON.stringify({ email, password }),
  });
  assert(response.ok && body?.access_token, "Could not sign in a disposable local CRM test user (HTTP " + response.status + ").");
  return body.access_token;
}

function runLocalSql(sql) {
  return execFileSync("psql", [databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function safeUuid(value) {
  assert(/^[0-9a-f-]{36}$/i.test(String(value)), "Refusing to interpolate an invalid UUID into local cleanup SQL.");
  return "'" + value + "'::uuid";
}

async function rpc(name, body, token) {
  return request("/rest/v1/rpc/" + name, {
    method: "POST",
    headers: authHeaders(anonKey, token, { "content-type": "application/json" }),
    body: JSON.stringify(body),
  });
}

function leadPayload(id = null, stage = "new") {
  return {
    p_id: id,
    p_category: "potential_sponsor",
    p_name: "CRM Test " + runId.slice(0, 8),
    p_contact_name: "Local Test",
    p_phone: "01000000000",
    p_whatsapp: "01000000000",
    p_email: "crm-contact-" + runId + "@example.com",
    p_website: "https://example.com/",
    p_region: "أسيوط",
    p_source: "اختبار محلي",
    p_interest: "رعاية وإعلان تجاري",
    p_suitable_offer: "عرض راعٍ رسمي",
    p_stage: stage,
    p_assigned_to: adminId,
    p_next_follow_up_at: new Date(Date.now() + 86400000).toISOString(),
    p_notes: "سجل اصطناعي مؤقت لاختبار CRM المحلي.",
  };
}

async function deleteUser(id) {
  if (!id) return;
  const { response } = await request("/auth/v1/admin/users/" + encodeURIComponent(id), {
    method: "DELETE",
    headers: authHeaders(serviceRoleKey, serviceRoleKey),
  });
  assert([200, 204, 404].includes(response.status), "Could not remove a disposable local Auth user (HTTP " + response.status + ").");
}

try {
  const owner = await createUser("owner");
  const admin = await createUser("admin");
  const regular = await createUser("regular");
  ownerId = owner.id;
  adminId = admin.id;

  runLocalSql(
    "INSERT INTO private.layan_admins(user_id) VALUES (" + safeUuid(ownerId) + ") ON CONFLICT DO NOTHING; " +
    "INSERT INTO private.layan_admin_members(user_id, added_by) VALUES (" + safeUuid(adminId) + "," + safeUuid(ownerId) + ") ON CONFLICT DO NOTHING;"
  );

  const [ownerToken, adminToken, regularToken] = await Promise.all([
    signIn(owner.email),
    signIn(admin.email),
    signIn(regular.email),
  ]);

  const listBody = { p_search: "CRM Test " + runId.slice(0, 8), p_stage: null, p_category: null, p_due: "all", p_limit: 50 };

  const anonList = await rpc("layan_admin_list_crm_leads", listBody, anonKey);
  assert(!anonList.response.ok, "Anonymous visitor unexpectedly read internal CRM leads.");

  const regularList = await rpc("layan_admin_list_crm_leads", listBody, regularToken);
  assert(!regularList.response.ok, "A regular platform user unexpectedly read internal CRM leads.");

  const supervisorList = await rpc("layan_admin_list_crm_leads", listBody, adminToken);
  assert(supervisorList.response.ok && Array.isArray(supervisorList.body), "An added administrator could not read the internal CRM lead list.");

  const supervisorWrite = await rpc("layan_admin_crm_save_lead", leadPayload(), adminToken);
  assert(!supervisorWrite.response.ok, "An added administrator wrote a CRM lead without owner approval.");

  const regularWrite = await rpc("layan_admin_crm_save_lead", leadPayload(), regularToken);
  assert(!regularWrite.response.ok, "A regular platform user unexpectedly wrote an internal CRM lead.");

  const created = await rpc("layan_admin_crm_save_lead", leadPayload(), ownerToken);
  assert(created.response.ok && typeof created.body === "string", "The owner could not create a CRM lead: " + JSON.stringify(created.body));
  leadId = created.body;

  const visibleToSupervisor = await rpc("layan_admin_list_crm_leads", listBody, adminToken);
  assert(visibleToSupervisor.response.ok && visibleToSupervisor.body.some(row => row.id === leadId),
    "An added administrator could not see a lead assigned by the owner.");

  const summary = await rpc("layan_admin_list_crm_summary", {}, adminToken);
  assert(summary.response.ok && Number(summary.body?.total) >= 1, "The CRM dashboard summary did not return counts.");

  const updated = await rpc("layan_admin_crm_save_lead", leadPayload(leadId, "negotiation"), ownerToken);
  assert(updated.response.ok && updated.body === leadId, "The owner could not update a CRM lead stage.");

  const logged = await rpc("layan_admin_crm_log_activity", {
    p_lead_id: leadId,
    p_activity_type: "call",
    p_outcome: "تم التواصل",
    p_notes: "اختبار تسجيل مكالمة محلية.",
    p_occurred_at: new Date().toISOString(),
  }, ownerToken);
  assert(logged.response.ok && typeof logged.body === "string", "The owner could not add a CRM activity.");

  const timeline = await rpc("layan_admin_list_crm_activities", { p_lead_id: leadId, p_limit: 50 }, adminToken);
  assert(timeline.response.ok && timeline.body.length >= 3, "The supervisor could not read the CRM activity timeline.");
  assert(timeline.body.some(item => item.activity_type === "stage_change"), "CRM stage changes were not recorded in the activity timeline.");
  assert(timeline.body.some(item => item.activity_type === "call"), "The CRM call activity was not recorded.");

  const directTable = await request("/rest/v1/admin_crm_leads?select=id", {
    headers: authHeaders(anonKey, ownerToken),
  });
  assert(!directTable.response.ok, "The private CRM table is unexpectedly exposed through the public REST schema.");

  const archived = await rpc("layan_admin_crm_archive_lead", { p_id: leadId }, ownerToken);
  assert(archived.response.ok && archived.body === true, "The owner could not archive the temporary CRM lead.");

  const afterArchive = await rpc("layan_admin_list_crm_leads", listBody, adminToken);
  assert(afterArchive.response.ok && !afterArchive.body.some(row => row.id === leadId),
    "An archived CRM lead remained in the active list.");

  console.log("PASS: CRM is hidden from anonymous and regular users; added administrators can read but cannot write directly; owner CRUD, stage history, activity timeline, dashboard summary and archive all work locally.");
} finally {
  if (leadId) {
    try { runLocalSql("DELETE FROM private.admin_crm_leads WHERE id = " + safeUuid(leadId) + ";"); } catch (_) {}
  }
  if (adminId) {
    try { runLocalSql("DELETE FROM private.layan_admin_members WHERE user_id = " + safeUuid(adminId) + ";"); } catch (_) {}
  }
  if (ownerId) {
    try { runLocalSql("DELETE FROM private.layan_admins WHERE user_id = " + safeUuid(ownerId) + ";"); } catch (_) {}
  }
  for (const id of users.reverse()) {
    try { await deleteUser(id); } catch (error) {
      throw new Error("CRM local test cleanup failed: " + error.message);
    }
  }
}
