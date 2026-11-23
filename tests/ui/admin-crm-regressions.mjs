#!/usr/bin/env node
/**
 * Lightweight UI source-contract regression tests for the ASYUT AQAR CRM.
 * Runtime role and data behavior is covered by the disposable local API test.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const [crm, html, migration] = await Promise.all([
  read("admin-crm.js"),
  read("admin.html"),
  read("supabase/migrations/20261123120000_admin_crm_private_atomic.sql"),
]);

assert.ok(crm.includes('data-lead-id="${esc(lead?.id || "")}"'),
  "Editing an existing CRM record must preserve its database ID.");
assert.ok(crm.includes("const id = form.dataset.leadId || null"),
  "The save action must submit the ID of an existing CRM record.");
assert.ok(crm.includes('archivedView ? "layan_admin_list_crm_archived" : "layan_admin_list_crm_leads"'),
  "The archive view must use the dedicated archived-record RPC.");
assert.ok(crm.includes("data-crm-restore") && crm.includes("layan_admin_crm_restore_lead"),
  "Archived CRM records must have a wired restore action.");
assert.ok(crm.includes('if (stage === "converted" || stage === "not_interested") return "";'),
  "Converted and not-interested leads must not be marked as overdue.");
assert.ok(migration.includes("p_due = 'overdue' AND l.stage NOT IN ('converted','not_interested')"),
  "Due filters must exclude terminal lead stages consistently with the summary.");
assert.ok(html.includes('id="crmToggleArchived"'),
  "The admin page must expose the archive switch.");
assert.ok(migration.includes("CREATE OR REPLACE FUNCTION public.layan_admin_list_crm_archived"),
  "The database must include the role-checked archive lookup RPC.");
assert.ok(migration.includes("CREATE OR REPLACE FUNCTION public.layan_admin_crm_restore_lead"),
  "The database must include the owner-only restore RPC.");
assert.ok(crm.includes('if (archivedView) host.querySelector(".admin-crm-activity-form")?.remove()'),
  "Archived CRM records must be read-only; do not show a new activity form.");

console.log("PASS: CRM edit identity, archive switch and restore wiring are present.");
