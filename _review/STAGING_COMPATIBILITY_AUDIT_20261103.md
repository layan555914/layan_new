# ASYUT AQAR — layan-claude-test compatibility audit

**Date:** 2026-11-03  
**User decision:** Approved temporary use of `layan-claude-test` as a candidate test environment, with explicit preservation of its existing user, migrations, Edge Function, and all existing data.  
**Audit mode:** Read-only. No schema, data, Auth, Storage, RLS, function, secret, or project-setting changes were made.

## Executive result

The project is healthy, but **not yet compatible with the current production application schema**. Keep it intact. Do not run the production baseline SQL directly against this project, and do not mark it as ready for full-platform testing yet.

## Verified inventory

| Item | Current test project |
|---|---:|
| Supabase project state | ACTIVE_HEALTHY |
| PostgreSQL | 17.11 |
| Migration records | 19 |
| Public application base tables | 1 |
| Private application base tables | 0 |
| Auth users | 1 |
| Auth identities | 1 |
| `marketplace_listings` rows | 0 |
| Storage object rows | 0 |
| Storage buckets | 2 |
| Storage object RLS policies | 6 |
| Public application RLS policies | 5 |
| Edge Functions | 1 active: `asyut-admin` (JWT verification enabled) |

The single public application table is `marketplace_listings`. The production project currently has 28 application tables (26 public and 2 private), plus 59 migration records in its migration history. The test project therefore lacks 27 of the current production application tables.

## Blocking compatibility differences

1. **Migration history divergence.** The test project has a separate 19-entry migration history. The production history has 59 entries. Some migration names overlap, but the histories cannot be assumed to be interchangeable. Never insert guessed rows into `supabase_migrations.schema_migrations` or replay a guessed sequence.

2. **Admin allowlist table missing.** The test project has no `private.layan_admins` table. Its `public.layan_is_admin()` wrapper calls `private.asyut_aqar_is_admin()`, which queries that missing table. The current `asyut-admin` Edge Function checks this RPC before its privileged user-list operation. As a result, the admin authorization path is not ready for an authenticated functional test. Do not grant admin status to the existing Auth user by assumption.

3. **Application schema absent.** Directory, offers, company profile, advertising, promotion, buyer preference/favorites/alerts and private admin/decision tables are missing from the test project's current schema. The test project's existing `marketplace_listings` table must be preserved and compared rather than replaced.

4. **Photo bucket configuration differs.** The test bucket `layan_real_estat` currently accepts JPEG only (5 MB, public). Production accepts JPEG, PNG and WebP (5 MB, public). The private documents bucket matches the production file-size and MIME constraints. No Storage objects exist in the test project. Do not update bucket metadata by direct SQL; use the Storage API/configuration route after approval and verification.

5. **Security/performance observations.** Supabase advisors report leaked-password protection disabled and multiple permissive RLS policies on `public.marketplace_listings` (three warning findings). The two marketplace secondary indexes are currently reported unused. These are review findings, not automatic change instructions. Do not weaken RLS or remove indexes merely to clear notices.

## Edge Function review

The deployed `asyut-admin` function:
- is active, version 1, and has JWT verification enabled;
- accepts POST and OPTIONS;
- restricts browser origins to the configured LAYAN domains;
- validates the bearer token through Supabase Auth;
- checks `public.layan_is_admin()` before calling Auth Admin APIs.

Only source logic was inspected. Runtime invocation was not attempted because it requires an authorized admin session. No environment variables or secret values were read or copied.

## Safe execution sequence

1. Preserve this project as-is, including its existing Auth user, 19 migration records, active Edge Function and Storage buckets.
2. Build and verify the current production schema in a **disposable local Supabase stack** using the repository's baseline rehearsal script and rollback-only assertions. This is not a migration into the hosted test project.
3. Compare the existing test `marketplace_listings` definition, indexes, constraints, grants and RLS policies against the production baseline before designing any additive reconciliation.
4. Prepare an additive, reviewed staging migration which avoids dropping/replacing existing objects and does not create or assign admin identities. Run it only after a separate change review.
5. Resolve the admin allowlist identity with the project owner before any admin membership change. Test the Edge Function only with an explicitly authorized admin account.
6. Apply Storage bucket MIME configuration only through the supported Storage API/configuration workflow, then verify with harmless test uploads and cleanup through the Storage API.
7. Run app-level and two-user RLS/Storage checks. Keep all production data and files out of the test project unless separately approved.

## Current status and boundaries

- Temporary candidate staging environment: approved by user.
- Compatibility audit: completed read-only.
- Hosted test-project migrations: **not applied**.
- Auth user or admin membership: unchanged.
- Edge Function: unchanged.
- Storage buckets and objects: unchanged.
- Production database and Storage: untouched.
- PR #42: remains Draft and unmerged; no deployment performed.

**Decision:** Keep `layan-claude-test`, but do not load the production baseline into it as-is. First complete the disposable local rehearsal and produce an additive compatibility migration that preserves its existing objects and account.
