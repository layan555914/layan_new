# Supabase database workflow — ASYUT AQAR

## Current canonical baseline

This repository now carries a **squashed current-state schema baseline** captured from the ASYUT AQAR production catalog on 2026-11-03:

- `migrations/20261103140155_asyut_aqar_production_schema_baseline.sql` — application-owned tables, constraints, indexes, functions, views, triggers, RLS and grants.
- `migrations/20261103140655_seed_asyut_aqar_marketplace_categories.sql` — 11 stable, public marketplace reference categories.
- `migrations/20261103141537_directory_admin_mutate_with_audit.sql` — incremental directory administration RPC. It uses `SECURITY INVOKER`, a strict table/column allowlist, checks `auth.uid()` and `public.layan_is_admin()`, and writes the change log in the same transaction.
- `bootstrap/storage-baseline.sql` — separate local-only bootstrap for Supabase-managed Storage grants, the two application buckets and six application Storage object policies. It is not an application migration because the managed Storage objects have a separate owner and must be applied with the Storage-owner/superuser context in the isolated CI rehearsal.
- `../tests/db/production-schema-baseline.assertions.sql` — catalog, grant, RLS, directory-publication, and Storage policy assertions.
- `../scripts/ci/rehearse-production-schema-baseline.sh` — disposable local rebuild and API-level Auth/Storage/directory RPC tests.

The application baseline contains schema only. It does **not** contain production Auth users or sessions, business/listing rows, directory records or private contact details, admin allowlist membership, project-decision data, VAPID private material, Storage object metadata, or file bytes.

## Important history limitation

The original SQL bodies for the 59 production migrations were not recovered from Git. Their exact version/name metadata was recovered from Supabase. The 59 corresponding files in this directory are explicitly labelled **comment-only ledger markers**; they contain no historical SQL and must not be mistaken for reconstructed migrations.

A clean local database replays those 59 no-op markers, then the current-state baseline, the 11-row public marketplace reference seed, and the directory RPC. This preserves CLI version matching without inventing historical SQL.

## Local setup and verification

Use the pinned Supabase CLI version from `.github/workflows/validate-static.yml` (currently 2.84.2) and a Docker-compatible runtime.

From the repository root:

```bash
supabase start
supabase db reset --local --no-seed
supabase migration list --local
```

For the full, isolated, CI-managed rehearsal (including the separate Storage bootstrap, assertions, disposable Auth users, Storage owner-isolation checks and directory admin RPC tests), run:

```bash
bash scripts/ci/rehearse-production-schema-baseline.sh
```

The script creates a temporary project directory, explicitly uses a local stack, removes hosted Supabase access credentials from its environment, and refuses non-loopback API/database endpoints in the Auth/Storage test program. It applies the Storage fragment only inside the disposable local Docker database. The CI runner is ephemeral; it is not a persistent staging destination.

## Creating future migrations

For each new schema change:

1. Inspect the existing schema and relevant Supabase documentation.
2. Start with a disposable local database and use the Supabase CLI to create the migration file:

   ```bash
   supabase migration new descriptive_change_name
   ```

3. Write the SQL in that generated timestamped file.
4. Verify from a clean local database with `supabase db reset --local --no-seed`, the SQL assertions, and API/browser tests.
5. Review Supabase security/performance advisors and the migration diff before proposing any remote action.

Do not place Storage-managed owner operations in an ordinary application migration unless they are supported by Supabase's documented ownership model. Keep the Storage bootstrap as its own explicitly reviewed environment step.

## Production safety

**No production command has been run.** The proposed adoption, after a fresh fingerprint check and separate approval, is to mark the current-state baseline and the already-existing 11-category seed as applied in the production migration ledger (without executing either SQL file), then preview the remaining directory RPC migration:

```bash
supabase migration repair --status applied 20261103140155
supabase migration repair --status applied 20261103140655
supabase migration list
supabase db push --dry-run
```

The repair commands modify only `supabase_migrations.schema_migrations`; they do not execute SQL. The exact 59 old version markers remain matched to their existing remote entries. The dry run should show only `directory_admin_mutate_with_audit` as pending. Actual repair or push requires a separate explicit user approval, fresh backup/restore validation, and confirmation that the production catalog and category values still match this captured baseline. Never run the baseline SQL against the populated production database. The review PR stays Draft.
