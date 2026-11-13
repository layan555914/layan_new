# ASYUT AQAR current-state schema rehearsal

## Purpose

This branch tests whether a new empty local Supabase database can build the current application schema from a reviewed current-state baseline and all post-baseline SQL migrations. It is a schema/security rehearsal, not a production clone.

## Migration chain

The clean-install chain contains 24 active SQL migrations:

1. 20261103140155_asyut_aqar_production_schema_baseline.sql — catalog-derived application schema snapshot captured on 2026-11-03.
2. 20261103140655_seed_asyut_aqar_marketplace_categories.sql — 11 stable marketplace categories.
3. 20261103141537_directory_admin_mutate_with_audit.sql — directory administration RPC.
4. The 18 SQL files currently present on main, dated 2026-11-04 through 2026-11-12.
5. 20261113165309_serialize_company_claim_approvals_by_entity.sql and 20261113172533_company_claim_feature_schema_reconciliation.sql — company representative claim locking and clean-install schema reconciliation.
6. 20261113231500_admin_crm_internal_leads.sql — private prospective advertiser/sponsor CRM tables, role-checked RPCs, follow-up fields and activity history.

The baseline is a squashed schema snapshot, not a recreation of the original 59 pre-November-3 migration bodies. Those old DDL changes are represented by the baseline snapshot. No empty no-op migration markers are added to this build chain.

## What is included

- Application-owned tables, columns, constraints, indexes, views, functions, triggers, RLS and grants from the November 3 catalog snapshot.
- Incremental admin, directory, owner approval, advertiser logo, sponsor, buyer notification and company-claim schema changes after November 3.
- A separate local-only Storage bootstrap for two ASYUT AQAR buckets and six object policies.
- Local API tests for Auth, owner isolation, directory admin RPC atomicity, Storage RLS, and the internal CRM's anonymous/user/supervisor/owner boundaries.

## What is deliberately not included

This branch does not copy production application rows, Auth users/sessions, admin allowlist memberships, private directory contact records, project review metadata, uploaded files, Storage object metadata, VAPID/private secrets, or personal identifiers.

The historical public seed material currently available is incomplete relative to production. The production catalog currently contains 26 areas, 89 directory sources, 73 directory entities, 37 projects and 31 opportunities. The old archived SQL seed sources cover only an earlier subset (26 areas, 32 sources, 47 entities and 23 projects), and internal directory address/phone and project-review inserts have been redacted from the public archive. Therefore this rehearsal does not claim to restore the current public directory dataset. Data recovery/seeding is a separate reviewed workstream.

## Run locally

Use the pinned Supabase CLI version from the CI workflow (2.84.2) and a Docker-compatible runtime.

```bash
supabase start
supabase db reset --local --no-seed
supabase migration list --local
```

For the full schema, RLS, Auth and Storage rehearsal:

```bash
bash scripts/ci/rehearse-current-state-schema.sh
```

The script creates an isolated temporary project, clears hosted Supabase access credentials from its environment, uses only local endpoints, and removes the local stack and temporary directory on exit.

## Production safety

- No hosted Supabase project ref, production password, API key or secret is configured in this branch.
- The script uses explicit --local CLI operations and refuses non-loopback endpoints in its API test program.
- It does not run supabase db push, migration repair, linked reset, or any production command.
- The 24-migration chain is for clean-install reproducibility only. It does not rewrite or reconcile the production migration ledger.
- The CRM migration and API checks are part of the local rehearsal only; production adoption requires a separate migration-ledger reconciliation and explicit owner approval.
- No merge, production deployment, or live database change is part of this rehearsal.