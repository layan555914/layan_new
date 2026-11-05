# ASYUT AQAR — tested current-state schema baseline

## Files

- Combined review/reference bundle: `_review/PRODUCTION_BASELINE_COMPLETE_20261103.sql`
- App phase, suitable for a disposable clean Supabase migration: `_review/PRODUCTION_BASELINE_APP_20261103.sql`
- Managed Storage phase, applied separately in the correct managed-owner context: `_review/PRODUCTION_BASELINE_STORAGE_ADMIN_20261103.sql`

The combined file is a reference bundle, not a single migration to execute as the regular migration owner.

## Verified source counts (2026-11-03, PostgreSQL 17.11)

- 28 app tables (26 public, 2 private)
- 135 constraints
- 32 secondary indexes
- 20 routines
- 2 views
- 7 triggers
- 80 application RLS policies
- 70 table/view grant groups
- 2 API-enabled app sequences
- 2 Storage buckets and 6 Storage object policies

## Full local Supabase CLI test: PASS

GitHub Actions run: https://github.com/layan555914/layan_new/actions/runs/41600477197

Using Supabase CLI 2.84.2 and Docker, CI created a clean temporary local project, started PostgreSQL 17 + Auth + Storage + PostgREST, ran `supabase db reset --local --no-seed` with the app phase, applied the managed Storage phase separately, and passed the catalog and SQL RLS assertions.

A second integration test used two temporary Auth users against the local Storage API:
- own image/document uploads and owner reads passed;
- cross-owner upload/read/delete attempts were denied;
- anonymous access to private documents was denied;
- owner deletion through Storage API passed.
The temporary Auth users and objects were cleaned up, and the local Supabase stack was stopped.

Regular validation in the same CI run also passed: JavaScript, Edge Function type checks, RTL/assets/PWA checks, Playwright customer/admin flows, and live read-only anonymous boundaries.

## What remains excluded

The snapshot does not copy Auth users/sessions, admin allowlist entries, private project decisions, VAPID secrets, company/property/directory data, Storage object records, or actual files. These require separate secure data migration/initialization procedures.

## Historical migration reconciliation

This snapshot reflects current production state, not the missing original 59 migration SQL files. Production's migration count remains 59 through `20261102180739`. No manual edits or `migration repair` were made to the production migration ledger.

## Safety boundary

The baseline files remain on `review/directory-atomic-audit-20261103` under `_review/`. They are not active production migrations. No production DDL, role grants, policies, data, migration ledger, merge to `main`, or deployment was changed as part of this rehearsal. PR #42 remains a draft for review.


## Secure data restore inventory

Metadata-only inventory, with exact row counts and no row values or secrets exported:
`_review/PRODUCTION_DATA_RESTORE_INVENTORY_20261103.md`.

It records 3 Auth users, 2 admin allowlist entries, 12 Storage objects (11 photos + 1 private document), and zero rows in the current company/property/promotion/notification/VAPID-config datasets. It also lists the exact directory relationship counts and the safe ordering for a future migration. No data migration has been performed.
