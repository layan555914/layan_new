import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20261123212148_secure_directory_media.sql", "utf8");
const media = fs.readFileSync("directory-media.js", "utf8");
const admin = fs.readFileSync("directory-media-admin.js", "utf8");
const company = fs.readFileSync("company-profile.js", "utf8");
const project = fs.readFileSync("project.js", "utf8");
const companyHtml = fs.readFileSync("company.html", "utf8");
const projectHtml = fs.readFileSync("project.html", "utf8");
const adminHtml = fs.readFileSync("directory-media-admin.html", "utf8");
const workflow = fs.readFileSync(".github/workflows/validate-static.yml", "utf8");

assert.match(migration, /VALUES\s*\(\s*'asyut-directory-media',\s*'asyut-directory-media',\s*false/s,
  "directory media bucket must remain private");
assert.match(migration, /CREATE POLICY directory_media_verified_manager_insert[\s\S]*company_entity_manager_access[\s\S]*IN \('owner','manager'\)/,
  "only verified owners and managers may upload metadata");
assert.match(migration, /CREATE POLICY directory_media_public_approved_read[\s\S]*status = 'approved'[\s\S]*public_visible = true[\s\S]*verification_status = 'published'/,
  "public metadata reads must require approval and published records");
assert.match(migration, /CREATE POLICY directory_media_storage_review_read[\s\S]*m\.status = 'approved'/,
  "public storage reads must require approved metadata");
assert.match(media, /10 \* 1024 \* 1024/, "uploader must enforce the 10 MB image limit");
assert.match(media, /directory_media_assets/, "uploader must create metadata records");
const uploadBlock = media.slice(media.indexOf("for (const file of files) {"));
assert.ok(
  uploadBlock.indexOf('request("/rest/v1/directory_media_assets"') < uploadBlock.indexOf('fetch(base + "/storage/v1/object/" + bucket'),
  "pending metadata must be created before storage upload so failed metadata cannot orphan an object"
);
assert.match(media, /directory_media_assets\?storage_path=eq\./,
  "failed storage uploads must remove their pending metadata row");
assert.match(media, /storage\/v1\/object\/sign/, "public gallery must use signed URLs for private storage");
assert.match(media, /status:"eq\.approved"/, "public gallery must request approved media only");
assert.ok(!media.includes('<option value=\\"entity_cover\\">'), "upload form must not offer a cover until cover rendering exists");
assert.ok(media.includes('root.querySelector(".company-gallery")'), "approved company media must reuse the existing gallery");
assert.ok(media.includes("existingGallery.appendChild(image)"), "approved company media must merge into the existing gallery");
assert.ok(media.includes("async function cleanupPendingUpload"), "failed uploads must share one cleanup path");
assert.ok(media.includes('method:"DELETE"'), "failed uploads must attempt to remove the storage object");
assert.ok(media.includes("Keeping pending media metadata so the object remains traceable"), "metadata must remain when storage cleanup cannot be confirmed");
assert.match(media, /relation_type=in\.\(developer,land_owner\)/, "project uploads must be restricted to developer/land-owner relationships");
assert.match(admin, /rpc\/layan_is_admin/, "moderation page must verify admin authorization");
assert.match(admin, /status:nextStatus/, "moderation must record approval or rejection");
assert.ok(admin.includes("&offset="), "review queue must support paginated offsets");
assert.ok(admin.includes("mediaAdminLoadMore"), "review queue must expose a load-more control");
assert.ok(admin.includes("pendingOffset = Math.max(0, pendingOffset - 1)"), "review actions must keep the offset aligned");
assert.match(admin, /reviewed_by:session\.user\.id/, "moderation must record the reviewing administrator");
assert.match(company, /AsyutDirectoryMedia\.mountManager/, "company profile must expose the verified manager uploader");
assert.doesNotMatch(company, /public_gallery_urls:gallery/, "managers must not bypass moderation with direct public image URLs");
assert.match(company, /AsyutDirectoryMedia\.renderGallery/, "company profile must show approved media");
assert.ok(company.includes("رفع الصور متاح للمالك الأساسي أو مدير الملف المفوض"), "editor role copy must match actual upload permissions");
assert.match(project, /AsyutDirectoryMedia\.renderGallery/, "project profile must show approved media");
assert.match(companyHtml, /directory-media\.js/, "company page must load directory media client");
assert.match(projectHtml, /directory-media\.js/, "project page must load directory media client");
assert.match(adminHtml, /directory-media-admin\.js/, "admin review page must load moderation client");
assert.ok(adminHtml.includes("mediaAdminLoadMore"), "admin screen must expose pagination");
assert.ok(workflow.includes("tests/ui/directory-media-contracts.mjs"), "static workflow must run media contracts");

console.log("Directory media upload, review, private storage, and public gallery contracts passed.");