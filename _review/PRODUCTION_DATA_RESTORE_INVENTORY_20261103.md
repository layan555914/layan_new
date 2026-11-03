# ASYUT AQAR — inventory of production data excluded from schema baseline

**Captured:** 2026-11-03  
**Source:** production project `ebyhwqkmhxbgocngpqfe`  
**Method:** read-only SQL row counts and schema metadata only. No application values, credentials, names, phone numbers, access tokens, hashes, VAPID values, file names, or file contents were read or exported.

## 1. Auth and private administration

| Dataset | Exact row count | Migration handling |
|---|---:|---|
| `auth.users` | 3 | User-account migration must use a controlled Auth process; do not copy active sessions or refresh tokens |
| `private.layan_admins` | 2 | Rebuild only after the destination Auth user IDs are mapped and verified |
| `private.project_decisions` | 0 | No decision rows to carry at this snapshot |

The Auth schema contains sensitive token/hash fields. None were queried. Existing Auth user IDs are referenced by company records and subscriptions, so the migration plan must either preserve compatible user IDs through a controlled process or build and validate a complete old-to-new UUID mapping before importing dependent rows.

## 2. Directory data

| Dataset | Exact row count |
|---|---:|
| `directory_entities` | 70 |
| `directory_projects` | 37 |
| `directory_areas` | 26 |
| `directory_sources` | 81 |
| `directory_opportunities` | 31 |
| `directory_entity_private` | 33 |
| `directory_project_private` | 37 |
| `directory_entity_sources` | 145 |
| `directory_project_sources` | 67 |
| `directory_project_entities` | 40 |
| `directory_opportunity_sources` | 31 |
| `directory_entity_areas` | 0 |
| `directory_change_log` | 0 |

Directory records have relationships and source-evidence requirements. A later export/import must preserve primary keys and restore source/relationship tables in dependency order, then re-run publication and RLS checks. Internal/private directory rows must remain protected.

## 3. Marketplace, company and notification datasets

| Dataset | Exact row count |
|---|---:|
| `public.property_offers` | 0 |
| `public.company_profiles` | 0 |
| `public.company_property_ads` | 0 |
| `public.supplier_ads` | 0 |
| `public.promotion_payments` | 0 |
| `public.marketplace_listings` | 0 |
| `public.buyer_offer_alerts` | 0 |
| `public.buyer_push_subscriptions` | 0 |
| `public.buyer_push_vapid_config` | 0 |

The VAPID configuration table has a `private_key` column, but its row count is zero. The private-key value was not queried. This does not prove that no VAPID secret exists in deployment settings or Edge Function secrets; those must be audited by secret name/status only and re-provisioned through a secure secrets workflow, never through Git.

## 4. Storage objects and files

There are 2 configured buckets and 12 Storage objects. Counts and sizes below are aggregated by bucket; object names and metadata values were not exposed.

| Bucket | Objects | Total bytes | Handling |
|---|---:|---:|---|
| `layan_real_estat` | 11 | 9,440,621 | Images; copy through Storage/S3 API |
| `layan-property-documents` | 1 | 2,633,223 | Private document; preserve private access rules |

Do not migrate file contents using SQL. The destination procedure must copy files through the Storage API or S3-compatible interface, preserve object paths and relevant MIME metadata, and verify object counts and byte totals. Private documents must remain private. Supabase explicitly recommends deleting through the Storage API rather than SQL; the same Storage API boundary should be followed for the file-copy workflow.

## 5. Recommended data migration sequence

1. Take a consistent source snapshot and record the export timestamp. Recheck counts immediately before export because production may continue changing.
2. Restore the tested application schema and Storage policies to a clean destination (not the existing production project).
3. Establish Auth account mappings, then rebuild the two administrator allowlist entries only after identity verification.
4. Copy Storage objects via Storage/S3 API and reconcile per-bucket counts and byte totals.
5. Export/import directory rows in foreign-key dependency order, preserving IDs, source links, publication state, and internal privacy boundaries.
6. Re-provision any external secrets through the secure environment/secrets manager. Never place VAPID private keys, Auth tokens, service keys, or passwords in this repository or in chat.
7. Import non-empty business tables only if a new source snapshot shows rows; the listed company/property/promotion tables were empty at this capture.
8. Run the same CLI, RLS, customer/admin and Storage API test suite, then compare source/destination row counts and file checksums.

## 6. Safety and scope

- This inventory contains counts and schema metadata only; it does not contain row values or exported data.
- No writes, DDL, role changes, Storage modifications, user changes, or exports were performed on production.
- No data has been copied into a destination project.
- The migration history remains separate: production has 59 recorded migrations, while this snapshot represents the current schema state and does not recreate the original 59 SQL files.
- The tested baseline and this inventory remain in `_review/` on the review branch. PR #42 remains draft and unmerged.
