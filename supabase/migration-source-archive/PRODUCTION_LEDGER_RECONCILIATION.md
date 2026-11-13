# Production migration ledger and live-catalog reconciliation

**Audit date:** 2026-11-13  
**Production project:** `ebyhwqkmhxbgocngpqfe`  
**Compared repository branch:** `main`  
**Method:** read-only Supabase SQL/catalog inspection and GitHub source reads.

## Executive finding

The migration ledger is incomplete as a source-control record, but the live production catalog contains important objects introduced by several repository migrations that do not have their own version rows in the production ledger. The ledger alone therefore cannot be used to decide whether a migration's effects are present.

This report does **not** authorize or recommend `supabase migration repair`, `db push`, or replay of the archived migrations. Source recovery and ledger reconciliation are separate tasks.

## Source inventory

| Measurement | Result |
|---|---:|
| Production ledger rows | 77 |
| Active SQL migration files in `main` | 18 |
| Exact version keys shared by ledger and `main` files | 12 |
| Exact shared versions with stored SQL body | 7 |
| Exact shared versions with empty `statements[]` | 5 |
| `main` files with no exact version key in production ledger | 6 |

The six files without an exact version key are:

- `20261110150000_admin_team_full_list.sql`
- `20261110170000_added_admins_need_owner_approval.sql`
- `20261110171000_owner_gate_unqualified_admin_calls.sql`
- `20261110190000_advertiser_logos.sql`
- `20261110191000_advertiser_logos_upgrade_from_v1.sql`
- `20261112110000_add_all_offer_notifications_preference.sql`

The last item is a version alias: production records version `20261112060649` with the same migration name. Its stored SQL statement is byte-for-byte identical to the file named with version `20261112110000`. Do not rename or repair the production row on the basis of this observation alone.

## SQL source comparisons

Eight comparisons were possible using SQL retained in production's `statements[]`:

- Six November 4 migrations matched their local `main` file after normalization of whitespace and leading SQL comments.
- `20261109221833_add_price_on_request_to_property_offers.sql` matched its ledger SQL after the same normalization.
- The notification preference migration matched its differently versioned production ledger statement byte-for-byte.

The five exact-version rows with empty `statements[]` correspond to files present in `main`:

- `20261105160000_property_offer_trust_badges.sql`
- `20261108120000_admin_control_center.sql`
- `20261108190000_unlimited_company_ads_and_company_admin.sql`
- `20261108200000_owner_edits_with_review.sql`
- `20261110120000_sponsors_and_sponsored_ads_admin.sql`

Their source files are available for review, but an empty ledger statement array does not allow a source-to-ledger SQL comparison.

## Read-only production catalog evidence for five unmatched version keys

Catalog probes found the core effects expected from the five unmatched November 10 migrations:

| Migration source | Current production evidence |
|---|---|
| `admin_team_full_list` | `public.layan_admin_list_admins()` exists |
| `added_admins_need_owner_approval` | `private.layan_is_owner()`, `public.layan_admin_whoami()`, `public.layan_admin_request_change()`, `public.layan_admin_decide_request()`, `private.layan_admin_requests`, and `private.layan_owner_gate_backup` exist |
| `owner_gate_unqualified_admin_calls` | 38 public write policies use the owner gate; zero public write policies matched the former `layan_is_admin()` gate check |
| `advertiser_logos` / `advertiser_logos_upgrade_from_v1` | `public.advertiser_brand_logos`, public logo lookup, advertiser self-service and admin review functions exist |

Security catalog checks on the same production snapshot:

- `private.layan_admin_requests` and `private.layan_owner_gate_backup` have RLS enabled and no direct table privileges for `anon` or `authenticated`.
- `public.advertiser_brand_logos` has RLS enabled, no policies, and no direct SELECT/INSERT/UPDATE/DELETE table privileges for `anon` or `authenticated`; browser access is through RPCs.
- Admin review/manage RPCs checked are SECURITY DEFINER with an empty search path, callable by `authenticated`, and not executable by `anon`.
- The public approved-logo lookup RPC is intentionally executable by `anon` and `authenticated`.

These are catalog presence/security observations, not cryptographic proof that the entire SQL body of each unmatched migration ran unchanged. The ledger mismatch remains unresolved.

## Company-claim feature production boundary

A separate read-only check on production found:

| Check | Result |
|---|---|
| `company_claim_requests` RLS | enabled |
| `company_entity_managers` RLS | enabled |
| Claim request rows | 0 |
| Manager link rows | 0 |
| Company-row lock in `private.company_claim_admin_review` | not enabled |

The feature's lock/reconciliation migrations in PR #115 are not applied to production. The successful PostgreSQL 16 smoke test runs in an isolated CI database and is not evidence that the production lock is installed.

## What this means for a clean-install baseline

A clean-install strategy must be designed as a **new current-state chain**, not as blind replay of every recovered historical migration:

1. The November 3 catalog-derived baseline can supply the application schema snapshot at that point in time.
2. The November 4 onward migrations must be ordered and reviewed against that baseline.
3. The directory reference seed data and other intentionally retained public reference data must be explicitly accounted for; the old baseline documentation excludes application rows.
4. Owner/admin account provisioning must remain a separate, parameterized post-install operation. Two historical owner-provisioning statements were withheld from the public archive because they contained private account identifiers.
5. Rebuild and compare schema objects, RLS, grants, routines, triggers, storage configuration, and required reference data in a disposable database before any decision about production migration history.

The historical archive at `production-ledger-statements-2026-11-13.json` is source material for review only. It must not be moved into `supabase/migrations` or replayed as a batch. One source record (`20261102175735`) was sanitized before publication: the public entity seed is retained, but the `INSERT INTO public.directory_entity_private` block containing internal addresses and phone numbers was removed and documented in the record's `redactions` field.

## Production safety

- All production queries for this report were SELECT/catalog reads.
- No production schema, data, role, grant, RLS policy, function, migration ledger row, Auth setting, Storage object, or secret was modified.
- No `supabase db push`, `migration repair`, baseline adoption, or deployment was run.
- The migration-history issue is now better understood, but not fully reconciled or cleared.
