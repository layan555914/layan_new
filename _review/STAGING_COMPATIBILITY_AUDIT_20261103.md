# ASYUT AQAR — layan-claude-test compatibility audit

**Date:** 2026-11-03  
**Environment:** Supabase test project `wisnmlbefdrkcbbqvdlg` (`layan-claude-test`)  
**User decision:** Approved temporary use as a test environment, preserving the existing Auth user, identities, private records, Edge Function, existing table/policy objects and Storage configuration.  
**Production:** `ebyhwqkmhxbgocngpqfe` — read-only throughout this work.  
**Current conclusion:** The application schema is now present in staging, but staging is **not yet safe to use for full behavioural parity testing**. Specific marketplace policy and supplier-ad RPC differences remain and require a separate approval before changing permissions or functions.

## Current verified inventory

| Item | Staging now |
|---|---:|
| Project state | ACTIVE_HEALTHY |
| PostgreSQL | 17.11 |
| Migration records | 22 (19 original + 3 staging migrations) |
| Public application tables | 26 |
| Private application tables | 2 |
| Application tables with RLS enabled | 28 / 28 |
| Application constraints | 137 |
| Secondary indexes | 33 |
| Functions/procedures | 21 |
| Public views | 2 |
| Application triggers | 7 |
| RLS policies | 81 |
| Auth users / identities | 1 / 1 |
| Rows in all 28 application tables | 0 |
| Storage objects | 0 |
| Storage buckets | 2 |
| Edge Functions | `asyut-admin` ACTIVE, JWT verification enabled |

The private tables were initially missed by an `information_schema` query because they are not visible through that query context. A direct PostgreSQL catalog check confirmed that both `private.layan_admins` and `private.project_decisions` already existed before the additive public-schema work. Both remain empty and RLS-enabled.

## Staging migrations recorded

The Supabase migration ledger currently contains these three staging-only migrations after the original 19 entries:

- `20261103093854 staging_additive_compatibility_20261103`
- `20261103094114 staging_cleanup_duplicate_marketplace_checks_20261103`
- `20261103094836 align_marketplace_listing_type_default`

The first two restored the missing public application schema while retaining the existing marketplace objects. The third migration aligned the `marketplace_listings.listing_type` default with production. Its exact SQL is recorded separately at `_review/STAGING_ALIGN_MARKETPLACE_LISTING_TYPE_DEFAULT_20261103.sql`.

The final default was verified as `'خدمة'::text`. A read-only structural comparison found 321 application columns in both environments; before the third migration, the only column-level difference was this default.

## Data and identity preservation

Exact row counts were checked for all 28 application tables:

- All 28 application tables: **0 rows**.
- Auth users: **1**; identities: **1**.
- `private.layan_admins`: **0 rows**.
- `private.project_decisions`: **0 rows**.
- `public.marketplace_listings`: **0 rows**.
- Storage objects: **0**.

No Auth user was added/deleted, no administrator was assigned, no production rows were copied, and no Storage object or file bytes were transferred. The deployed Edge Function source/settings were not changed.

## Structural comparison with production

| Object | Staging | Production |
|---|---:|---:|
| Public/private application tables | 26 + 2 | 26 + 2 |
| RLS-enabled app tables | 28 | 28 |
| Constraints | 137 | 135 |
| Secondary indexes | 33 | 32 |
| Functions/procedures | 21 | 20 |
| Views | 2 | 2 |
| Triggers | 7 | 7 |
| Policies | 81 | 80 |
| Table grants for anon/authenticated/service_role | 334 | 334 |

The table-grant inventory was compared entry by entry and is identical to production (334 entries). The remaining count differences are from preserved test-project objects:

- One extra index: `marketplace_listings_public_idx`.
- Two extra constraints on `marketplace_listings`: the preserved `details` JSON-object check and a separately named production-compatible description-length check. The pre-existing broader description check remains in place; no existing constraint was dropped.
- One extra routine: `private.asyut_aqar_is_admin()`.
- One extra marketplace policy; the full policy definitions are detailed below.

The staging `marketplace_listings.reviewed_by` foreign key uses `ON DELETE SET NULL`, whereas production uses the default `NO ACTION`. This is a behavioural difference to review; it was not changed.

## Outstanding security and behaviour gaps

### 1. Marketplace RLS policy definitions differ

Although RLS is enabled and the aggregate table grants exactly match production, the five existing staging marketplace policies are **not equivalent** to the four production policies.

The staging owner INSERT policy only checks that `owner_id` matches `auth.uid()` and status is pending. It does not enforce the production checks that prevent a new owner-submitted row from setting administrative fields such as `is_featured`, `reviewed_at`, `reviewed_by`, or `admin_notes`.

The staging owner UPDATE policy also has weaker `WITH CHECK` conditions than production. In addition, staging's approved-listing read policy includes authenticated users, and a separate owner-read policy exists; production uses a separate authenticated read-scope policy and an anon-only public-read policy.

This requires a reviewed policy replacement on staging. **No policy was changed in this continuation.** Do not treat the test marketplace RLS as production-equivalent until the policy definitions are reconciled.

### 2. Supplier-ad RPC definitions are stale

The production functions `public.layan_activate_supplier_ad(uuid, integer, numeric)` and `public.layan_reject_supplier_ad(uuid, text)` return `jsonb`. Their staging counterparts return `void` and use older update logic.

The inspected staging activation function references `supplier_ads.agreed_price`, which is not a column in the current `supplier_ads` table. The staging rejection function references `admin_notes`, `reviewed_at`, and `reviewed_by`, which are also absent from the current `supplier_ads` table. These RPC paths are therefore expected to fail at runtime when those update statements execute.

Production's versions return structured JSON and update the columns that exist in the current schema. Replacing a PostgreSQL function with a different return type requires dropping/recreating that function or another reviewed migration approach; it must not be attempted casually.

### 3. Function execution grants are broader in staging

The aggregate table grants match production, but function ACLs do not. Staging has additional `PUBLIC` and `anon` EXECUTE privileges on the two stale supplier-ad RPCs and several admin RPC wrappers. Production's corresponding public supplier-ad functions are restricted to `authenticated`, `service_role`, and `postgres`.

The public admin wrapper also points to `private.asyut_aqar_is_admin()` in staging, whereas production points to `private.layan_is_admin()`. Both helpers check the private admin allowlist, but the staging helper and wrapper need to be reconciled with production after dependency review.

**No function body, function grant, schema grant, table grant, or role membership was changed in this continuation.**

### 4. Storage bucket configuration still differs

- Staging `layan_real_estat`: public, 5 MB, JPEG only.
- Production `layan_real_estat`: public, 5 MB, JPEG + PNG + WebP.
- The private `layan-property-documents` bucket matches the production file-size and MIME restrictions.

No Storage objects exist in staging. Bucket metadata was not changed; any future change must use the supported Storage configuration/API path, not direct SQL against managed Storage tables.

## Supabase advisor findings after schema restoration

Security:
- Four RLS-enabled tables have no policies: `private.layan_admins`, `private.project_decisions`, `public.buyer_push_subscriptions`, and `public.buyer_push_vapid_config`. These are preserved deny-all boundaries, not an instruction to add broad policies.
- Leaked Password Protection remains disabled.

Performance:
- Four multiple-permissive-policy findings: `company_profiles` and three marketplace actions (INSERT, SELECT, UPDATE).
- 31 indexes are currently reported unused. Most application tables are empty; this is informational and not a reason to drop indexes.

## Test limitations

- Schema, column, constraint, index, RLS, policy, grant, routine, view and trigger inventories were compared through read-only catalog queries.
- No administrator identity was assigned. The admin allowlist is empty, so authenticated admin operations were not exercised.
- No browser E2E, authenticated Storage HTTP upload, two-user Storage isolation test, supplier-ad RPC execution, or load test has been completed on the hosted staging project.
- GitHub Actions status for the current PR head is not confirmed by the connected status lookup; CI is not claimed as passed.

## Required next work — approval boundary

1. Prepare a reviewed staging-only migration to replace the marketplace owner INSERT/UPDATE/read policies with the production-equivalent conditions.
2. Prepare a reviewed migration to reconcile the public supplier-ad RPC return types, update logic and EXECUTE grants. Review dependent UI/function callers before dropping or recreating anything.
3. Align the public admin wrapper with the production helper while preserving the empty admin allowlist. Do not add the user's account to `private.layan_admins` without separate explicit approval.
4. Align the photo bucket MIME allowlist using the supported Storage API/configuration route.
5. After those changes are separately approved and tested, run authenticated/browser/Storage tests with disposable test accounts only.

## Current boundaries

- Staging project retained and schema-expanded; no production data copied.
- Existing Auth user, identity, two private tables, Edge Function and Storage objects preserved.
- Existing policies/functions were not modified in this continuation.
- Production database, Storage and Edge Functions untouched.
- PR #42 remains Draft and unmerged; no deployment performed.

**Decision:** Staging is a useful schema-level test environment, but it is not yet a faithful functional clone of production. The marketplace RLS policies and supplier-ad RPCs are the main blockers before calling it ready for end-to-end testing.
