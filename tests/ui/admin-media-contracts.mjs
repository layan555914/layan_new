import assert from "node:assert/strict";
import fs from "node:fs";

const edge = fs.readFileSync("supabase/functions/admin-media/index.ts", "utf8");
const ui = fs.readFileSync("admin-ad-manager.js", "utf8");
const config = fs.readFileSync("supabase/config.toml", "utf8");
const workflow = fs.readFileSync(".github/workflows/validate-static.yml", "utf8");

assert.match(edge, /auth\.getUser\(token\)/, "admin-media must validate the caller's JWT");
assert.match(edge, /rpc\("layan_is_admin"\)/, "admin-media must require an admin role");
assert.match(edge, /rpc\("layan_admin_whoami"\)/, "admin-media must inspect the exact administrative role");
assert.match(edge, /role !== "owner"/, "non-owner administrators must not bypass owner-only storage policies");
assert.match(edge, /auth\.admin\.getUserById\(ownerId\)/, "admin-media must verify the target customer account");
assert.match(edge, /bytes\.length > MAX_BYTES/, "admin-media must enforce the upload size limit");
assert.match(edge, /bytes\[0\] !== 0xff[\s\S]*bytes\[2\] !== 0xff/, "admin-media must validate JPEG file signatures");
assert.match(edge, /upsert:\s*false/, "admin-media must never overwrite an existing object");
assert.match(edge, /offers\//, "admin-media must constrain files to the offers namespace");
assert.match(edge, /storage\.from\(BUCKET\)\.upload/, "admin-media must upload using the server-side client");
assert.match(edge, /storage\.from\(BUCKET\)\.remove/, "admin-media must delete using the server-side client");
assert.match(config, /\[functions\.admin-media\]\s*verify_jwt = false/, "manual JWT verification must be enabled in the function config");
assert.match(ui, /functions\/v1\/admin-media\?action=upload/, "admin UI must upload through admin-media");
assert.match(ui, /functions\/v1\/admin-media\?action=delete/, "admin UI must delete through admin-media");
assert.doesNotMatch(ui, /storage\/v1\/object\/layan_real_estat\//, "admin UI must not bypass the authorized Edge Function for writes");
assert.match(workflow, /supabase\/functions\/admin-media\/index\.ts/, "CI must type-check admin-media");

console.log("Admin media security contract passed.");
