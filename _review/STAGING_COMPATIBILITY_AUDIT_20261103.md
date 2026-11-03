# ASYUT AQAR — layan-claude-test compatibility audit

**Date:** 2026-11-03  
**User decision:** Approved temporary use of `layan-claude-test` as a candidate test environment, with explicit preservation of its existing user, migrations, Edge Function, and all existing data.  
**Execution status:** Two reviewed, staging-only migrations applied. Production was not changed.
**Audit mode:** Initial review was read-only; subsequent schema changes were limited to the approved test project. No data, Auth identities, admin memberships, Edge Function code, secrets or Storage objects were copied or changed.

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
| Application constraints | 7 |
| Secondary application indexes | 3 |
| Application routines (functions/procedures) | 9 |
| Application views | 0 |
| Application triggers | 0 |
| Edge Functions | 1 active: `asyut-admin` (JWT verification enabled) |

The single public application table is `marketplace_listings`. The production project currently has 28 application tables (26 public and 2 private), plus 59 migration records in its migration history. The test project therefore lacks 27 of the current production application tables.


### Additional object-level comparison

The test project currently exposes 9 routines across `public` and `private`, 7 application constraints, and 3 secondary indexes; it has no application views or triggers. The current production baseline expects 20 routines, 135 constraints, 32 secondary indexes, 2 public views and 7 application triggers. The existing marketplace table also has a distinct column definition and must be reconciled field by field.

The checked-in production baseline is a clean-stack rehearsal script, not an additive migration. It contains 28 `CREATE TABLE` statements, including a second `marketplace_listings` creation, 22 `CREATE OR REPLACE` definitions, and a broad set of grants and policies. It therefore must not be applied directly to this populated test project.

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
## Applied staging-only schema work

The original baseline SQL was not run directly. A separate additive migration was prepared, rehearsed inside a transaction with rollback, and then applied to this project only:

- `20261103093854 staging_additive_compatibility_20261103`
- `20261103094114 staging_cleanup_duplicate_marketplace_checks_20261103`

Tracked SQL files:
- `_review/STAGING_ADDITIVE_COMPATIBILITY_20261103.sql`
- `_review/STAGING_COMPATIBILITY_CLEANUP_20261103.sql`

The migration created the 27 missing application tables and preserved the existing `public.marketplace_listings` table. It added three missing columns to that existing table and aligned its effective validation with production while keeping its pre-existing checks and policies. The cleanup removed only six redundant check constraints created by the first compatibility draft.

### Verified post-application inventory

| Object | Staging after migration | Production snapshot |
|---|---:|---:|
| Public application tables | 26 | 26 |
| Private application tables | 2 | 2 |
| Application constraints | 137 | 135 |
| Secondary indexes | 33 | 32 |
| Functions/procedures | 21 | 20 |
| Public views | 2 | 2 |
| Application triggers | 7 | 7 |
| Application RLS policies | 81 | 80 |
| App tables missing RLS | 0 | 0 |

The small count differences are deliberately retained test-project objects:
- Two additional constraints on `marketplace_listings`: the pre-existing details-object check and a stricter compatibility check retained under a separate name. The original weaker description check was not dropped.
- One pre-existing test-only `marketplace_listings_public_idx` index.
- One test-only `private.asyut_aqar_is_admin()` routine.
- One extra pre-existing marketplace RLS policy. No existing policy was removed or rewritten.

The three production marketplace columns `featured_until`, `latitude`, and `longitude` now exist in staging. Its column-name list matches the production snapshot.

### Preserved data and service boundaries

- Auth users: 1 before and after.
- Auth identities: 1 before and after.
- `private.layan_admins`: 0 rows; no account was granted administrator status.
- `public.marketplace_listings`: 0 rows.
- Directory entities and sources: 0 rows.
- Storage objects: 0; no file bytes or object records were transferred.
- Storage object policies: 6 before and after.
- Edge Function `asyut-admin`: still ACTIVE, version 1, JWT verification enabled. Its source and settings were not changed.
- The read-only admin check returns `false` for an identity not present in the admin allowlist.

### Remaining compatibility gaps

1. The photo bucket `layan_real_estat` still accepts JPEG only in staging. Production accepts JPEG, PNG and WebP. The Storage bucket was intentionally not changed because no supported Storage management action is available in this connected toolset; do not change bucket metadata by direct SQL.
2. Two existing staging public functions were preserved rather than replaced:
   - `public.layan_activate_supplier_ad(uuid, integer, numeric)` returns `void` in staging versus `jsonb` in production, and the definitions differ.
   - `public.layan_reject_supplier_ad(uuid, text)` returns `void` in staging versus `jsonb` in production, and the definitions differ.
   The current admin UI calls both RPCs but does not consume their return bodies. Their actual admin action behavior remains untested because no administrator identity was assigned.
3. Supabase security advisors still report four RLS-enabled/no-policy tables (`private.layan_admins`, `private.project_decisions`, `public.buyer_push_subscriptions`, and `public.buyer_push_vapid_config`). These are preserved deny-all boundaries; no public policies were added.
4. Leaked-password protection remains disabled. It was not changed.
5. Performance advisors report 31 unused indexes and four multiple-permissive-policy findings. The index notices are expected on empty/new tables; policies were not weakened or removed.

### Test coverage and limitations

- The full additive DDL was executed once inside a transaction with assertions for table counts, RLS coverage, policies, routines, views, triggers, marketplace compatibility columns, unchanged Auth row counts and absence of admin assignments. The transaction was rolled back, and a subsequent read-only check confirmed the test project returned to its original one-table state before the permanent migration.
- The actual staging migrations then applied successfully and their versions appeared in Supabase migration history.
- Post-application read-only checks confirmed all 28 application tables, 0 missing-RLS tables, 2 views, 7 triggers, 81 policies, 21 routines, preserved Auth counts, zero data import, and the six original Storage policies.
- A later attempt to run synthetic directory insert/update trigger tests was blocked by the tool's safety checks before execution. No such test data was inserted.
- No browser E2E, Storage HTTP upload, administrator action, or load test has been run against this hosted test project.
- GitHub Actions results for the current PR head are not visible through the connected status lookup; CI is **not claimed as passed**.

## Current status and decision

- Temporary test environment: retained and now schema-expanded.
- Additive compatibility migrations: applied to `layan-claude-test` only.
- Existing Auth account, identity, Edge Function, existing marketplace rows/policies/indexes/functions, and Storage bucket settings: preserved.
- Production database and Storage: untouched.
- No production rows or files copied.
- PR #42 remains Draft and unmerged; no deployment performed.

**Decision:** The test project is now a useful schema-level staging environment, but not yet a complete behavioral clone of production. Resolve the two function-definition differences and photo-bucket MIME configuration before claiming full feature parity.
