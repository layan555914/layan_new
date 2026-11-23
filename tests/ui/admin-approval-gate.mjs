#!/usr/bin/env node
/**
 * Browser-wrapper regression tests for admin-approval.js.
 * Runs with mocked fetch only; no network, credentials, or hosted Supabase access.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../../admin-approval.js", import.meta.url), "utf8");
const base = "https://supabase.test";

async function scenario({ role = "owner", roleStatus = 200, roleThrows = false } = {}) {
  const calls = [];
  const elements = new Map();
  const document = {
    getElementById(id) { return elements.get(id) || null; },
    createElement() {
      return {
        id: "",
        hidden: false,
        style: {},
        setAttribute() {},
        textContent: "",
      };
    },
    body: {
      appendChild(element) { elements.set(element.id, element); },
    },
  };
  const nativeFetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/rest/v1/rpc/layan_admin_whoami")) {
      if (roleThrows) throw new Error("mock role lookup network error");
      return new Response(roleStatus === 200 ? JSON.stringify(role) : "role lookup unavailable", {
        status: roleStatus,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (String(url).endsWith("/rest/v1/rpc/layan_admin_request_change")) {
      return new Response('"pending"', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response('{"ok":true}', {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const window = {
    __asyutApprovalGate: false,
    LAYAN_CONFIG: { SUPABASE_URL: base, SUPABASE_PUBLISHABLE_KEY: "public-key" },
    fetch: nativeFetch,
    dispatchEvent() {},
  };
  class MockCustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  }
  vm.runInNewContext(source, {
    window,
    document,
    Headers,
    Response,
    CustomEvent: MockCustomEvent,
    clearTimeout() {},
    setTimeout() { return 1; },
  }, { filename: "admin-approval.js" });

  const result = await window.fetch(base + "/rest/v1/rpc/layan_admin_crm_save_lead", {
    method: "POST",
    headers: { Authorization: "Bearer test-session", "Content-Type": "application/json" },
    body: JSON.stringify({ p_name: "CRM wrapper test" }),
  });
  return { result, body: await result.json(), calls };
}

const unavailable = await scenario({ roleStatus: 503 });
assert.equal(unavailable.result.status, 503, "Role lookup HTTP failures must stop the attempted write.");
assert.equal(unavailable.body.code, "ROLE_CHECK_FAILED");
assert.equal(unavailable.calls.length, 1, "No write or approval request may be sent after role lookup fails.");

const networkFailure = await scenario({ roleThrows: true });
assert.equal(networkFailure.result.status, 503, "Role lookup network failures must stop the attempted write.");
assert.equal(networkFailure.body.code, "ROLE_CHECK_FAILED");
assert.equal(networkFailure.calls.length, 1, "No write or approval request may be sent after role lookup throws.");

const addedAdmin = await scenario({ role: "admin" });
assert.equal(addedAdmin.result.status, 409, "An added administrator's change must become an approval request.");
assert.equal(addedAdmin.body.code, "PENDING_APPROVAL");
assert.equal(addedAdmin.calls.length, 2);
assert.ok(addedAdmin.calls[1].url.endsWith("/rest/v1/rpc/layan_admin_request_change"));
const queued = JSON.parse(addedAdmin.calls[1].init.body);
assert.equal(queued.p_payload.path, "/rest/v1/rpc/layan_admin_crm_save_lead");

const owner = await scenario({ role: "owner" });
assert.equal(owner.result.status, 200, "An owner should continue to perform the write directly.");
assert.equal(owner.calls.length, 2);
assert.ok(owner.calls[1].url.endsWith("/rest/v1/rpc/layan_admin_crm_save_lead"));

console.log("PASS: admin approval wrapper fails closed on HTTP/network role lookup errors; added-admin writes are queued; owner writes remain direct.");
