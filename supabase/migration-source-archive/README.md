# Production migration source archive

**Captured:** 2026-11-13  
**Source:** read-only extraction from production project `ebyhwqkmhxbgocngpqfe`, table `supabase_migrations.schema_migrations`.  
**Archive file:** `production-ledger-statements-2026-11-13.json`

## What this archive contains

- Production currently records 77 migration versions.
- At the time of the audit, 65 production versions did not have a matching version-prefixed SQL file in the active migration folder of the company-claim review branch.
- The production migration ledger retained ordered `statements[]` bodies for those 65 versions.
- 63 source records were copied into the JSON archive without the two owner-specific records described below. One of the 63 records (`20261102175735`) is intentionally partial: its public `directory_entities` seed remains, while the separate `directory_entity_private` seed containing internal addresses and phone numbers was removed. The record carries an explicit `redactions` note.
- The remaining two migrations are documented by version and name, but their SQL bodies are intentionally not included in this public repository:
  - `20261027143024 add_confirmed_layan_admin_account`
  - `20261027144249 add_confirmed_layan_admin_user`

Those two historical statements contain an administrator's email address; the second also contains a specific Auth user UUID. The values were not copied into a public Git repository. They remain in the private production migration ledger.

Five production ledger rows have empty `statements[]` arrays; their corresponding SQL files are present in the main repository's active migration folder. This archive does not attempt to fabricate bodies for those entries.

## Reconstructing the archived SQL files

Run from the repository root:

```bash
node scripts/recovery/export-production-migration-archive.mjs
```

The script writes one SQL file per archive record to:

`supabase/migration-source-archive/exported-sql/`

It preserves the array order for each stored statement and adds a statement terminator on a new line only when the stored item does not already end with one. The recorded statements do not preserve the original file's byte-for-byte formatting or comments; this is a reconstructed source archive from the production ledger, not a copy of the developer's original file bytes. The `20261102175735` record is deliberately redacted and incomplete: the internal address/phone insert is omitted. Do not use that exported file to seed the private directory table.

## Safety boundary

- **Do not move these exported files into `supabase/migrations/` or apply them to production as a batch.** They are already-applied historical changes and several depend on earlier platform state.
- This archive is for audit, source recovery, and manual comparison only.
- A reproducible clean-install chain needs a separately reviewed baseline and an explicit treatment of owner-specific Auth provisioning. It must not blindly replay the archived history against an empty or populated database.
- No production migration, ledger row, table, policy, function, role, or application data was changed during this recovery. The only production operation was a `SELECT` from migration history.

## Accounting

| Item | Count |
|---|---:|
| Production migration ledger rows | 77 |
| Missing version-matched files found during the review-branch audit | 65 |
| SQL source records archived here | 63 |
| Directory seed record with private address/phone block redacted | 1 |
| Owner-specific migration bodies withheld from the public archive | 2 |
| Empty statement arrays whose SQL files already exist in main | 5 |

The archived SQL is not a replacement for a fresh production schema comparison, nor is the migration history mismatch cleared by this archive alone.
