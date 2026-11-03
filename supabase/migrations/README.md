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

## Existing production adoption — proposal only

Production already has the first 59 versions applied and already contains the current schema and all 11 marketplace categories. After a fresh catalog fingerprint check and separate explicit approval, the intended ledger-only alignment is:

```bash
supabase migration repair --status applied 20261103140155
supabase migration repair --status applied 20261103140655
supabase migration list
supabase db push --dry-run
```

The two `migration repair` commands only add migration-history records; they do not execute either SQL file. They must only be used after verifying the live production schema still matches the baseline and the 11 category values still match the seed. The dry run should then show only the directory-admin RPC migration as pending.

**Do not run these commands against production without a separate user approval.** Do not run the baseline SQL against the populated production database. The original 59 SQL bodies remain unrecovered and are not represented by these placeholders.
