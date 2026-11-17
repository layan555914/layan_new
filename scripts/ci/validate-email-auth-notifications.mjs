import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");
const client = read("gubabase.js");
const app = read("app.js");
const marketplace = read("marketplace.js");
const admin = read("admin.js");
const edge = read("supabase/functions/email-notifications/index.ts");
const migration = read("supabase/migrations/20261116193000_email_notification_subscriptions.sql");
const template = read("supabase/email-templates/magic-link.html");
const unsubscribe = read("email-unsubscribe.html");
const config = read("supabase/config.toml");

assert.match(client, /async function requestEmailOtp\(/, "shared Auth client must request email OTPs");
assert.match(client, /create_user: options\.shouldCreateUser === true/, "normal sign-in must not create a new user by default");
assert.match(client, /async function verifyEmailOtp\(/, "shared Auth client must verify six-digit email OTPs");
assert.match(client, /async function syncEmailNotificationSubscription\(/, "shared Auth client must sync email subscription preferences");
assert.match(client, /email_notifications: profile\.email_notifications === true/, "legacy sign-up must preserve the opt-in choice");

assert.match(app, /authOtpCodeField/, "main platform dialog must include the OTP verification field");
assert.match(app, /requestEmailOtp\(email, options\)/, "main platform dialog must call shared OTP");
assert.match(app, /account_type: accountType/, "new main-platform users must retain their account type");
assert.match(app, /email_notifications: emailOptIn\.checked === true/, "new main-platform users must preserve email opt-in");
assert.match(app, /api\.syncEmailNotificationSubscription/, "main platform must sync email preferences after authentication");

assert.match(marketplace, /requestEmailOtp\(email,options\)/, "services marketplace must use OTP login");
assert.match(marketplace, /verifyEmailOtp\(pendingMarketplaceOtp\.email/, "services marketplace must verify OTP");
assert.match(marketplace, /syncEmailNotificationSubscription/, "services marketplace must sync email preferences");

assert.match(template, /\{\{ \.Token \}\}/, "Magic Link template must render the six-digit OTP");
assert.doesNotMatch(template, /\{\{ \.ConfirmationURL \}\}/, "OTP template must not expose a link-only confirmation URL");

assert.match(edge, /SUPPORTED_RECORD_TYPES/, "email function must enforce an explicit record-type allowlist");
assert.match(edge, /layan-\[a-z0-9-\]\+-mostafa-6511\\.vercel\\.app/, "email function must allow only this project's isolated Vercel preview origin pattern");
assert.match(edge, /siteUrlForOrigin\(origin\)/, "preview email and unsubscribe links must stay on the originating preview host");
assert.match(edge, /user\.rpc\("layan_is_admin"\)/, "dispatch must be restricted to platform admins");
assert.match(edge, /RESEND_API_KEY/, "email provider key must be read only by the server function");
assert.match(edge, /email_notification_deliveries/, "email dispatch must keep an idempotent delivery ledger");
assert.match(edge, /unsubscribe_token/, "every subscription must support self-service unsubscribe");
assert.match(edge, /status", "available"/, "property announcement must re-check published status");
assert.match(edge, /status", "approved"/, "service announcement must re-check approved status");
assert.match(edge, /status", "active"/, "commercial announcement must re-check active status");

for (const type of ["property_offer", "marketplace_listing", "company_profile", "company_ad", "supplier_ad"]) {
  assert.ok(admin.includes('tryEmailAnnouncement("' + type + '"'), "admin approval flow must dispatch " + type);
}
assert.match(migration, /enable row level security/gi, "notification tables must have RLS enabled");
assert.match(migration, /revoke all on table public\.email_notification_subscriptions from anon, authenticated/, "subscription rows must not be exposed to browser roles");
assert.match(migration, /unique \(source_table, source_id, recipient_user_id\)/, "delivery ledger must prevent duplicate notifications");
assert.match(unsubscribe, /functions\/v1\/email-notifications/, "unsubscribe page must call the server function");
assert.match(config, /\[functions\.email-notifications\][\s\S]*verify_jwt = false/, "the function must handle its own authentication for the public unsubscribe endpoint");

console.log("Email OTP and notification contract validation passed.");
