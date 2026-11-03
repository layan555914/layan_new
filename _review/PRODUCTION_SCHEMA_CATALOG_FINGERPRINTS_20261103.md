# ASYUT AQAR production catalog fingerprints

**Captured:** 2026-11-03 14:35 UTC  
**Source:** production Supabase project `ebyhwqkmhxbgocngpqfe`  
**Method:** read-only catalog queries, with explicit `search_path = public, private, extensions, auth, storage` so PostgreSQL deparsing is consistent with the local CI assertions.

## Current object counts

| Object | Count |
|---|---:|
| Application tables | 28 |
| Public views | 2 |
| Application columns | 321 |
| Constraints | 135 |
| Indexes (including primary/unique backing indexes) | 76 |
| Routines before the new directory RPC | 20 |
| Application triggers | 7 |
| Application RLS policies | 80 |
| Tables with RLS enabled | 28 |
| Storage buckets | 2 |
| Storage object policies | 6 |

## Catalog fingerprints

Fingerprints are MD5 signatures of ordered JSON representations of catalog definitions. They are used as deterministic change detectors, not as cryptographic security controls.

| Catalog set | Production fingerprint |
|---|---|
| Columns | `a283488be8971790a5ede069c55ad06a` |
| Constraints | `9e3514cdf8501484958912b30cd50195` |
| Indexes | `ff1b1ac5ad852ef85f14b2b49d86ece7` |
| Existing routines (excluding the new directory RPC) | `ac34f483aa464955047f293b1f7e1fcf` |
| Views | `a71ebf185b60c81add11b457a18e0d10` |
| Triggers | `233bb57017595a2d5340845235578329` |
| Policies on public/private application tables | `504e1190d8e9a1908346c9a79baf6c80` |
| RLS-enabled table state | `05cf3a01d0cf939e809c17f21aa2db14` |
| Table/view effective privileges | `7bd719f0dccb0c722b466213ed8f18dd` |
| Sequence effective privileges | `d037ea954b9cb65164830db66329d539` |
| Existing function EXECUTE privileges | `166494438099beab585204d7cf19a2d5` |
| Schema USAGE/CREATE privileges | `5e8de6a131fb75266fc6ce20f79af2be` |
| Storage table effective privileges | `767fa03fcd34b45b270a38d855d01494` |
| Storage bucket configuration | `7daa6598baf8bbdb66ce8132992fa824` |
| Storage object policies | `ac22d229029b1feacf223767b37e122e` |

## Storage reference settings

The two application buckets are:

- `layan_real_estat`: public image bucket, 5 MiB file limit, JPEG/PNG/WebP.
- `layan-property-documents`: private document bucket, 10 MiB file limit, PDF/JPEG/PNG.

No Storage object paths, object metadata rows, or file bytes are included in this report.

## Verification

CI run [#41658175755](https://github.com/layan555914/layan_new/actions/runs/41658175755) rebuilt the application schema locally and passed all catalog fingerprints, the stable marketplace category data assertions, Auth recovery, property/marketplace workflows, directory admin atomic RPC, Storage owner isolation, and cleanup verification.

The exact expected fingerprints are embedded in `tests/db/production-schema-baseline.assertions.sql`. Any production schema change should trigger a fresh catalog capture before reusing this baseline.
