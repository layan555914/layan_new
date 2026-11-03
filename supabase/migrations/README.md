# Migration directory: history markers and current-state migrations

## Important distinction

The first 59 files in this directory are **comment-only historical ledger markers**. Their timestamps and names exactly match the metadata currently recorded by the production Supabase migration ledger on 2026-11-03. Their original SQL bodies were not recovered from Git history.

These files are intentionally empty of executable SQL. They preserve the existing production version/name keys for Supabase CLI migration-list comparison; they do **not** claim to recreate the original historical changes.

A clean database is rebuilt by applying, in timestamp order:

1. The 59 no-op historical ledger markers.
2. `20261103140155_asyut_aqar_production_schema_baseline.sql`, the reviewed current-state application schema snapshot.
3. `20261103140655_seed_asyut_aqar_marketplace_categories.sql`, the 11 stable, public marketplace category rows.
4. `20261103141537_directory_admin_mutate_with_audit.sql`, the incremental atomic directory mutation/audit RPC.

The Storage bootstrap remains separate at `../bootstrap/storage-baseline.sql` because Supabase manages Storage table ownership separately from application migrations.

## Existing production adoption — completed

**Completed 2026-11-03 17:35 Egypt time (UTC+02).**

A fresh production preflight passed immediately before the metadata update:
- All 15 application, privilege and Storage catalog fingerprints matched the reviewed production snapshot.
- All 11 marketplace categories matched the category seed exactly (name, description, order and active flag).
- Both target migration versions were absent from the ledger.
- `directory_admin_mutate_with_audit(text,text,uuid,jsonb,text)` was still absent from production.

The two missing history records were then inserted into `supabase_migrations.schema_migrations` only:
- `20261103140155_asyut_aqar_production_schema_baseline`
- `20261103140655_seed_asyut_aqar_marketplace_categories`

The write reproduced the Supabase CLI v2.84.2 `migration repair --status applied` metadata upsert semantics (version, name and parsed statement array). The CLI executable itself was not run because no linked CLI/database-password session was available; the database-side metadata-only operation was performed through the authorized Supabase SQL connection.

**Neither migration's SQL was executed against production.** No table, policy, function, category row, user, file or application record was changed.

Post-write verification:
- Production migration ledger: 61 rows (59 historical + 2 metadata records).
- Both new version/name pairs appear in `list_migrations`.
- The directory-admin RPC migration `20261103141537` remains absent from the ledger.
- The directory-admin RPC remains absent from production.
- All 11 category rows remain present and unchanged.

The repository contains 62 migration files; comparing those timestamps with the verified 61 production ledger entries leaves exactly one pending file: `20261103141537_directory_admin_mutate_with_audit.sql`. This is the expected pending migration. A literal `supabase db push --dry-run` was not run because this session has no linked Supabase CLI/password session; no push was attempted.

**Do not apply the pending directory-admin RPC migration or deploy it without separate explicit approval.** The original 59 SQL bodies remain unrecovered and are not represented by the historical markers.

## Latest verification

The repository contains 62 unique migration files: exactly 59 comment-only markers matching the current production version/name ledger, followed by the baseline, category seed, and directory RPC.

A new empty local Supabase stack replayed all 62 successfully. Assertions verified the 59 marker versions and the 11 marketplace categories, and the rest of the full database/API test suite passed.

[CI #41660618571 — full success, 2026-11-03 15:09 UTC](https://github.com/layan555914/layan_new/actions/runs/41660618571)

The production catalog was rechecked immediately before the metadata-only ledger repair at 2026-11-03 15:35 UTC: all 15 fingerprints matched. The production ledger now contains 61 records after adding only the baseline and category-seed metadata; no migration SQL was run.

## Production directory-admin RPC — applied (2026-11-03)

The user separately approved applying only `20261103141537_directory_admin_mutate_with_audit.sql` to production.

The reviewed migration source was fetched from branch `review/directory-atomic-audit-20261103` at blob SHA `09b5f17009d1dfd8aefbd52f473dfcb6c2f93b39`. A transactional production change was executed with preconditions for the 61-row ledger, absence of the RPC, existence of all dependency tables and the admin helper, required authenticated table grants, and RLS enabled on every affected table. The migration SQL and its ledger record were applied in one transaction with postconditions for the 62-row ledger and RPC security properties.

Post-application checks:
- Production migration ledger lists all 62 expected versions, including `20261103141537_directory_admin_mutate_with_audit`.
- The RPC exists in production.
- The migration ledger row stores four parsed SQL statements.
- All 11 marketplace categories remain present.
- The production directory audit log remains empty (zero test records).
- The existing two production admin memberships were not changed.
- No user account, password, Auth identity, property, listing, source record, Storage object, frontend deployment, or GitHub merge was modified.

The staging-only transactional smoke test had already verified that an authenticated staging admin update creates an audit row and that rollback removes the audit and restores the synthetic record. No live production admin mutation was performed, so the production RPC's end-to-end authenticated invocation remains untested against a real production admin session.

Supabase advisors after the migration still report:
- Four INFO findings for RLS-enabled tables with no policies (private/admin or server-only tables; remain deny-by-default).
- One WARN for disabled leaked-password protection.
- Fourteen unused-index INFO findings.
- One multiple-permissive-policy WARN on `public.company_profiles`.
No advisor finding was automatically changed or "fixed" as part of this migration.

**PR #42 remains Draft and unmerged. No frontend deployment occurred.** The remaining release step is a separate review of the PR diff and explicit approval to merge/deploy. Do not infer approval for that step from approval of this database migration.

