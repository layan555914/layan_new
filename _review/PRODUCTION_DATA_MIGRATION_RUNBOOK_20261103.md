# ASYUT AQAR — secure production data migration runbook

**Captured:** 2026-11-03  
**Source:** production Supabase project `ebyhwqkmhxbgocngpqfe`  
**Candidate destination:** isolated Supabase branch `aqar-data-restore-staging` under the production project  
**Status:** prepared only. No branch created, no data exported, and no production mutation performed.

## 1. Target environment and cost gate

The user's Supabase organization `layan_real_estat` is currently on the Free plan. The Supabase cost quote returned for a branch is:

- Compute estimate: **USD 0.01344 per hour** (default Micro compute).
- Additional branch usage such as disk/storage and egress may also be billed depending on usage.
- Branches are separate Supabase environments. By default they do not carry over production rows or Storage objects.
- The branch obtains the database schema from the parent project's migration history and gets its own environment/credentials.

**Required gate:** obtain explicit user agreement to this hourly cost before calling `create_branch`. Do not create a branch, new project, or paid resource without that agreement.

The existing `layan-claude-test` project must not be repurposed as the destination: it has a separate 19-migration history and is not a matching copy of production.

## 2. Source data manifest (counts only)

No row values, names, phone numbers, file paths, password hashes, tokens, or secret values were exported for this manifest.

### Authentication and administration
- `auth.users`: 3
- `auth.identities`: 3
- `private.layan_admins`: 2
- `private.project_decisions`: 0

Transient Auth tables seen in the source include active session/refresh-token state. Do not copy sessions, refresh tokens, one-time tokens, OAuth flow state, or active login credentials into a staging branch. Users should authenticate again in the destination. Keep password hashes only if the migration procedure is explicitly configured and tested to preserve them.

### Directory
- `directory_entities`: 70
- `directory_projects`: 37
- `directory_areas`: 26
- `directory_sources`: 81
- `directory_opportunities`: 31
- `directory_entity_private`: 33
- `directory_project_private`: 37
- `directory_entity_sources`: 145
- `directory_project_sources`: 67
- `directory_project_entities`: 40
- `directory_opportunity_sources`: 31
- `directory_entity_areas`: 0
- `directory_change_log`: 0

### Business / marketplace / notifications
At the inventory timestamp the following tables had zero rows:
- `property_offers`
- `company_profiles`
- `company_property_ads`
- `supplier_ads`
- `promotion_payments`
- `marketplace_listings`
- `buyer_offer_alerts`
- `buyer_push_subscriptions`
- `buyer_push_vapid_config`

The VAPID private-key column was not read. A zero-row table does not prove that no secret exists in Edge Function or project environment settings; secret names and deployment configuration must be audited separately without revealing values.

### Storage
- Bucket `layan_real_estat`: 11 objects, 9,440,621 bytes.
- Bucket `layan-property-documents`: 1 object, 2,633,223 bytes.
- Total: 12 objects, 12,073,844 bytes (aggregated by bucket only).

Do not export or copy file bytes through SQL. Copy through the Storage API or S3-compatible storage interface and verify destination object count and byte totals. Preserve object paths so directory/business rows that reference image URLs continue to resolve. The documents bucket must remain private.

## 3. Proposed migration order

1. Create the isolated data-less staging branch only after hourly cost approval. Wait for ACTIVE_HEALTHY and verify its schema/migration history before importing anything.
2. Capture fresh source row counts and storage totals immediately before the export. Reconcile any difference from this manifest because production may have changed since the snapshot.
3. Take a recoverable source backup using the official Supabase CLI backup/restore workflow. Keep dumps outside Git and protect them as confidential files.
4. Import Auth users and identities before application rows that reference `auth.users`. Do not import sessions, refresh tokens, one-time tokens, or transient login flows. Clear any password-reset/confirmation tokens after import. A different destination JWT secret invalidates old access tokens; users sign in again. Password hashes may be preserved with the Auth data when compatible.
5. Import `public` and `private` application table data while preserving UUIDs/primary keys and sequence values. Keep foreign-key relationships intact. Import the two admin allowlist rows only after the Auth user IDs have been verified and mapped.
6. Create or verify the two Storage buckets with their captured public/private settings and MIME/size restrictions. Copy 11 image objects and the one private document through the Storage API, using upsert only on the isolated destination. Do not write directly to `storage.objects`.
7. Re-provision destination-only secrets through the secure environment manager. Do not copy a production JWT secret, service-role key, database password, VAPID private key, OAuth client secret, SMTP password, or GitHub token into source control or chat.
8. Validate exact row counts, foreign-key orphan counts, sequence values, bucket/object counts and byte totals. Run directory publication checks, anonymous/private RLS checks, two-user Storage owner isolation, Auth login/reset flows, Playwright journeys, and Supabase advisors.
9. Keep the staging branch isolated until a separate review confirms the data and app behavior. Do not merge this branch or deploy it to production as part of this exercise.

## 4. Auth migration considerations

Supabase documents that Auth user rows and hashed passwords can be migrated with a database dump/restore, but JWT secrets are project-specific. If the destination keeps a different JWT secret, existing sessions/access tokens become invalid and users need to sign in again. This is the safer staging default; do not reuse the production JWT secret just to preserve old sessions.

The source has three Auth users and three identities. A final import must preserve user UUIDs or maintain an explicit, verified old-to-new UUID mapping before importing dependent rows such as `private.layan_admins`. If account identity IDs change, validate every referencing row before applying the allowlist.

## 5. Why the current restore snapshot is not a data backup

`PRODUCTION_BASELINE_COMPLETE_20261103.sql` is a current-state schema reference and is not a data dump. The tested CLI rehearsal rebuilds schema and policies only. It intentionally does not transfer actual account, business, directory, or Storage object data.

The original 59 migration files were not recovered. A staging branch from production can replay the migration history retained by Supabase, but this does not recreate the missing Git history in `main`. Do not write guessed historical SQL or manually rewrite `supabase_migrations.schema_migrations`.

## 6. Safety status

At the time this runbook was created:
- No branch has been created because the hourly cost needs explicit user approval.
- No actual rows or files have been exported or copied.
- No Auth tokens, password hashes, VAPID values, API keys, database passwords, or object paths have been read.
- No production DDL, permissions, RLS, migration ledger, rows, Storage objects, or functions were changed.
- PR #42 remains a draft and has not been merged.

## 7. Free-plan execution path after Branching was rejected

A branch creation was attempted only after the user approved the quoted USD 0.01344/hour compute cost. Supabase rejected the operation with `Branching is supported only on the Pro plan or above`. No branch was created. The organization remains on Free; no plan upgrade was requested or performed.

Do not retry branch creation on this plan, and do not repurpose the older `layan-claude-test` project. The no-cost work that can safely proceed now is the disposable local rehearsal already implemented in this repository:

- `scripts/ci/rehearse-production-schema-baseline.sh` creates a temporary Supabase CLI stack inside the GitHub Actions runner, unsets hosted-project access credentials, and explicitly uses `supabase db reset --local`.
- `tests/db/production-schema-baseline.assertions.sql` checks the reconstructed schema, grants, RLS policies, directory publication guard, and Storage policy boundaries using rollback-only fixtures.
- `tests/db/storage-api-baseline.mjs` exercises Storage authorization over the local HTTP API with disposable Auth users and removes its test users/files.
- Workflow: `.github/workflows/validate-static.yml`, job `rehearse-full-supabase-baseline`.

This CI rehearsal is schema/security verification only. It does **not** connect to production, export real rows, copy Auth users, or transfer Storage objects. GitHub-hosted runners are ephemeral, so they are not a persistent staging destination. Do not add production credentials or database dumps to GitHub workflow files, repository secrets, logs, or artifacts as a shortcut.

### Safe next steps on Free

1. Trigger/review the local rehearsal and retain its CI result. A successful run proves the reconstructed schema and policy checks pass in a disposable local stack; it does not prove data migration.
2. Prepare and validate a migration utility against synthetic fixture records only, with explicit source/destination allowlists, table dependency ordering, UUID preservation, dry-run counts, and refusal to run unless the destination is explicitly confirmed as non-production.
3. Keep the production export step disabled until a persistent isolated destination exists. On Free, that means using a separately approved, already-existing Supabase project only if its owner confirms it is disposable and its schema/plan/history are suitable. The existing `layan-claude-test` project is excluded unless the user separately approves a dedicated compatibility review and confirms it contains no data to preserve.
4. If no suitable destination is approved, stop after local rehearsal. Do not copy production data into the live production project, and do not claim that the migration is complete.

### Current execution boundary

- Branching: unavailable on current Free plan; not created.
- Local schema/security rehearsal: available through GitHub Actions; no production credentials required.
- Real Auth/table/Storage data transfer: not performed and remains blocked pending a suitable persistent isolated destination.
- Production: read-only; no schema, grants, policies, users, rows, Storage objects, secrets, or migration history changed.

