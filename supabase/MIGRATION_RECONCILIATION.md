# Supabase migration source reconciliation

> **Deployment safety hold — do not run `supabase db push`, `migration repair`, or apply a baseline against production until this audit is resolved and explicitly reviewed.**

Audit date: 2026-11-13
Repository: `layan555914/layan_new`
Branch audited: `feature/company-profile-claim-form`
Production project: `ebyhwqkmhxbgocngpqfe`
Test project: `wisnmlbefdrkcbbqvdlg`

## Current source coverage

| Environment | Recorded migration versions | Matching SQL files in this branch | Recorded versions without a matching SQL file |
|---|---:|---:|---:|
| Production | 77 | 12 | 65 |
| Test | 38 | 8 | 30 |

The repository currently contains 20 SQL migration files. A matching filename/version is a source-presence check only; it does not establish that the SQL is identical to what was applied remotely.

## Production versions without a matching source file

| Version | Recorded migration name |
|---|---|
| `20261025191213` | `secure_property_offers_owner_and_trial_limit` |
| `20261025193501` | `allow_owners_to_view_own_offers` |
| `20261025193613` | `secure_layan_property_photo_uploads` |
| `20261025202223` | `allow_pending_property_offers` |
| `20261025205042` | `supplier_ad_free_trial_from_request` |
| `20261025210106` | `least_privilege_public_table_grants` |
| `20261025210305` | `harden_property_review_and_supplier_trial_fields` |
| `20261026065223` | `allow_curtains_and_furnishings_supplier_ads` |
| `20261026191159` | `restrict_layan_storage_upload_size_and_types` |
| `20261027093734` | `fix_public_offer_image_access_and_promotion_request_guard` |
| `20261027131047` | `index_supplier_and_promotion_foreign_keys` |
| `20261027142311` | `create_partner_ad_slots_for_free_trial` |
| `20261027142412` | `allow_supplier_ads_free_trial_requests` |
| `20261027142717` | `secure_admin_approval_for_free_trial_ads` |
| `20261027142729` | `add_admin_only_pending_ad_review_access` |
| `20261027143024` | `add_confirmed_layan_admin_account` |
| `20261027144249` | `add_confirmed_layan_admin_user` |
| `20261028174607` | `separate_paint_and_curtain_partner_ad_slots` |
| `20261029123626` | `company_property_ads_three_property_limit` |
| `20261029124034` | `fix_company_ad_limit_trigger_locking` |
| `20261029182442` | `add_images_to_partner_ad_slots` |
| `20261030192609` | `activate_supplier_ads_after_whatsapp_agreement` |
| `20261030192718` | `hide_ad_prices_and_secure_supplier_activation` |
| `20261030193054` | `restrict_supplier_ad_price_column_visibility` |
| `20261030193123` | `index_company_property_ads_owner_id` |
| `20261030193157` | `keep_live_supplier_ads_compatible_until_release` |
| `20261030194725` | `allow_custom_supplier_ad_terms` |
| `20261030210935` | `create_company_profiles_directory` |
| `20261030211003` | `restrict_company_profiles_api_grants` |
| `20261030220045` | `company_profile_revision_requested_flow` |
| `20261031081655` | `layan_company_profiles_resubmit_20261031` |
| `20261031081658` | `layan_company_profiles_pending_update_20261031` |
| `20261031081701` | `layan_company_profiles_scoped_read_20261031` |
| `20261031081754` | `layan_company_profiles_reviewed_by_index_20261031` |
| `20261031104640` | `expand_layan_marketplace_listing_and_service_categories` |
| `20261031132027` | `add_secure_admin_property_offer_review` |
| `20261031132151` | `harden_property_review_rpc_boundary` |
| `20261031183034` | `index_marketplace_listings_reviewed_by` |
| `20261101170447` | `create_seed_asyut_aqar_marketplace_categories` |
| `20261101172141` | `remove_layan_tables_keep_marketplace` |
| `20261101210205` | `asyut_aqar_company_profile_update_and_property_ad_limit` |
| `20261101220335` | `add_user_favorite_offers` |
| `20261101220830` | `add_location_search_and_buyer_alerts` |
| `20261101221638` | `tighten_buyer_alert_permissions_and_indexes` |
| `20261101222604` | `add_authenticated_web_push_subscriptions` |
| `20261101222624` | `add_authenticated_web_push_subscriptions` |
| `20261101223114` | `lock_push_subscriptions_to_edge_function` |
| `20261101223300` | `enforce_one_owner_per_push_endpoint` |
| `20261102040339` | `tighten_public_table_grants_20261102` |
| `20261102040527` | `company_profiles_admin_read_scope_20261102` |
| `20261102040606` | `split_company_profile_admin_select_policy_20261102` |
| `20261102175232` | `create_asyut_real_estate_directory_v1` |
| `20261102175438` | `allow_contextual_duplicate_directory_source_urls` |
| `20261102175617` | `seed_asyut_directory_areas_and_sources_v1` |
| `20261102175735` | `seed_asyut_directory_entities_v1` |
| `20261102180129` | `seed_asyut_directory_projects_v1` |
| `20261102180205` | `link_asyut_directory_entities_projects_and_opportunities_v1` |
| `20261102180326` | `refine_asyut_directory_policies_and_indexes` |
| `20261102180739` | `require_public_source_before_directory_publication` |
| `20261103140155` | `asyut_aqar_production_schema_baseline` |
| `20261103140655` | `seed_asyut_aqar_marketplace_categories` |
| `20261103141537` | `directory_admin_mutate_with_audit` |
| `20261112060649` | `20261112110000_add_all_offer_notifications_preference` |
| `20261113153428` | `company_representative_claim_requests` |
| `20261113153819` | `company_claim_request_fk_indexes` |

## Feature-specific findings

- Production records `20261113153428` (`company_representative_claim_requests`) and `20261113153819` (`company_claim_request_fk_indexes`), but neither original SQL source is present in this branch.
- The Git history paths queried for both filenames returned no commits.
- Another historical branch contains `20261113120000_company_directory_claims.sql`, but it creates a different schema (`company_directory_entries` and `company_directory_claim_requests`) and is not a valid source substitute for the production tables (`directory_entities`, `company_claim_requests`, `company_entity_managers`). Do not copy or apply it as a replacement.
- The forward reconciliation migration `20261113172533_company_claim_feature_schema_reconciliation.sql` converges the current feature tables/functions/grants/RLS on a compatible existing platform schema. It is not a recovery of the missing historical SQL and does not reconcile the entire platform migration history.

## Safe recovery procedure

1. Preserve the current production migration ledger and take a verified backup before any migration-history operation.
2. Recover each missing SQL source from the original developer machine, CI artifacts, Supabase CLI working directory, deployment bundle, or a trusted archived repository commit. Require review of the exact SQL and its relationship to the applied version.
3. Compare recovered SQL with the current production schema and data. Where original source cannot be recovered, create a separately reviewed, clearly labeled baseline/squash strategy; do not invent historical files and do not mark guessed SQL as applied.
4. Rehearse the chosen strategy on an isolated database and verify schema objects, RLS, grants, policies, triggers, functions, indexes, seed data, and application workflows.
5. Only after independent review and explicit owner approval should a production migration-history or schema action be scheduled.

## What has and has not changed

- The production migration ledger was read only during this audit.
- No production migration was applied, repaired, deleted, or reordered.
- No production table, policy, function, role, or data was modified.
- PostgreSQL 16 smoke tests for the company-claim feature passed in an ephemeral GitHub Actions service database. That test starts from a minimal platform contract, not a full reconstruction of every historical platform migration.
- The feature branch remains a Draft PR and is not merged.

## Important distinction

Missing migration source files are a repository traceability/reproducibility problem. They do not, by themselves, prove that the currently running production schema is broken. Production was observed with RLS enabled on both company-claim tables, zero test claim rows and zero manager links, while the company-row concurrency lock still remains unapplied there.
