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

## Final readiness check — directory administration RPC (2026-11-03)

The latest full CI run after the ledger alignment and documentation update passed:
[CI #41666562897 — full success](https://github.com/layan555914/layan_new/actions/runs/41666562897)

The staging RPC received an additional transactional smoke test using its existing synthetic directory entity and the existing staging Auth identity:
- The authenticated admin-only update returned the changed synthetic record and an audit ID.
- The entire transaction was rolled back.
- Follow-up verification showed zero audit rows, zero temporary admin memberships, the original synthetic description, and the same single pre-existing staging Auth user.
- Staging RPC remains SECURITY INVOKER with empty search_path; anon EXECUTE=false, authenticated/service_role EXECUTE=true.

A production read-only preflight confirms every RPC dependency exists: directory entity/project/area/opportunity/source tables, source-link tables, audit table, `layan_is_admin()`, required authenticated table grants, audit INSERT grant, and RLS enabled on all eight affected tables. The RPC itself is still absent.

**Ready for one separately approved production DDL step:** apply only `20261103141537_directory_admin_mutate_with_audit.sql`. This changes the production schema and migration ledger. It has not been applied. Do not merge PR #42, deploy the frontend, or run any other migration as part of this step without separate approval.
