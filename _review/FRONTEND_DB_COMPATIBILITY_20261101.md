# ASYUT AQAR — Frontend / Database Compatibility Audit
Date: 2026-11-01
Repository: layan555914/layan_new
Branch: restore/asyut-aqar-full-platform-20261101
Production Supabase project: ebyhwqkmhxbgocngpqfe

## Scope
Read-only inspection of the restoration branch and production database. No SQL, schema, RLS, Auth, storage, DNS, deployment, or merge changes were made.

## Confirmed findings

### 1. Company profile page calls a missing RPC
- `companies.js` calls `/rest/v1/rpc/layan_get_my_company_profile` to load the signed-in user's company profile.
- A direct catalog lookup in production for `layan_get_my_company_profile` returned no function in any schema.
- The function therefore needs to be reconciled before the company profile workflow can be considered functional. Do not create a replacement until its expected return shape and authorization rules are reviewed against `companies.js`, `company_profiles`, and the existing private admin functions.

### 2. Limit-enforcement functions are present, but no public-table triggers were found
- Production has functions named `enforce_company_property_ad_limit` and `enforce_layan_offer_limit`.
- The production trigger inventory for schema `public` returned no rows.
- Frontend code submits company property ads directly to `company_property_ads` and property offers directly to `property_offers`.
- This means the existence of the functions alone does not establish that limits are enforced. Verify intended trigger wiring or another server-side enforcement path before release. Do not attach triggers without reviewing function definitions and expected business rules.

### 3. Data tables are currently empty
- `marketplace_categories`: 11 rows.
- `marketplace_listings`, `property_offers`, `buyer_preferences`, `supplier_ads`, `partner_ad_slots`, `company_property_ads`, `company_profiles`, and `promotion_payments`: 0 rows at the time of this audit.
- This is a live database observation, not evidence that historical records never existed.

### 4. Marketplace listing flow matches its table at a high level
- `marketplace.js` writes `owner_id, category, listing_type, title, description, city, area, property_type, price, price_period, contact_phone, whatsapp, image_urls, details, status` to `marketplace_listings`.
- The inspected production table contains these columns with compatible broad types (`image_urls text[]`, `details jsonb`, status default pending).
- The public marketplace query reads approved listings; RLS policies restrict anonymous reads to approved rows and owner/admin access is separately scoped.

### 5. Production views found
- `company_profiles_public`: exposes selected fields for active company profiles.
- `public_active_supplier_ads`: exposes selected fields for active supplier ads.
- Their definitions were inspected; no changes were made.

## Release blockers / next checks
1. Reconcile or implement the missing `layan_get_my_company_profile` RPC only after confirming the frontend's expected payload and safe owner-scoped access.
2. Review definitions and intended use of both limit-enforcement functions; verify whether triggers are missing or another secure server-side mechanism is intended.
3. Complete a field-by-field audit of every form and admin action against production schema and RLS.
4. Run browser end-to-end tests for signup/login, company profile submission/editing, property offers, marketplace listings, approvals, and buyer preferences.
5. Keep PR #30 in draft and do not merge or publish until the original logo, migration history, Pages source, and release checks are resolved.

## Explicitly not done
- No production SQL or DDL.
- No changes to Auth users, passwords, permissions, RLS policies, or storage.
- No DNS or domain changes.
- No deployment and no PR merge.


## Additional function-level verification
The definitions of the four guard/limit functions were read:
- `enforce_layan_offer_limit()` is a trigger function that requires the authenticated owner, forces new offers to pending, and caps the owner at three offers.
- `enforce_company_property_ad_limit()` is a trigger function that validates the company ad owner/name and caps a company ad at three linked property offers.
- `guard_company_owner_update()` is a trigger function that protects approved company profiles and routes changes through `pending_update`.
- `guard_property_offer_promotion()` is a trigger function that prevents client-supplied featured state on insert.

Because the public trigger inventory is empty, none of these trigger functions is currently wired to a table event in `public`. The frontend directly inserts into the relevant tables, so the intended server-side protections cannot be assumed to execute. This is a confirmed release blocker requiring reviewed trigger definitions and tests, not a change to apply blindly.

The missing company-profile RPC also affects more than prefill: `companies.js` uses its result to retain the existing profile ID/status and determine whether to submit a safe `pending_update` draft. If lookup fails, an existing company owner may be treated like a first-time submitter. Verify duplicate prevention and the owner-scoped lookup design before restoring this workflow.


## Company-profile duplicate and submission-safety checks
- Production has a non-unique index on `company_profiles.owner_id`, but no UNIQUE(owner_id) constraint. Multiple company profiles per owner are therefore not prevented at database level.
- The current company registration UI is structured around a single existing profile per signed-in owner. This mismatch must be resolved as a product/data rule before adding a unique constraint; no constraint was added.
- Updated `companies.js` so the owner-scoped lookup is completed before allowing a submission. If the lookup fails, the page displays an error and blocks a new profile insert rather than silently treating the owner as a first-time registrant.
- The account-wide offer-limit trigger is deliberately excluded from the proposed SQL. Its existing function caps all offers for an owner at three indefinitely; it does not check plan code or trial expiry. Do not activate it until the commercial/trial rule is confirmed.
- The company-ad property cap remains proposed only for offers linked to a company ad (`company_ad_id`); it is distinct from the account-wide cap.

## Branding asset check
Two candidate logo images were found in the Library. One is labeled `أسيوط عقار: أفق معماري أنيق` and contains “LAYAN AQAR” beneath the Arabic name; the other is labeled `شعار أسيوط العقاري الفاخر` and contains “ASYUT AQAR”. They are different images. Neither was copied into the repository or substituted for `icon.svg`, because the exact approved original logo has not been unambiguously confirmed.


## Additional company submission hardening
- The owner lookup now fetches up to two rows and blocks submission if multiple company profiles are found for one account, rather than arbitrarily editing the first row.
- Paused company profiles are blocked from owner submission in the UI, consistent with the existing RLS update scope.
- Company insert/update requests now ask PostgREST for the saved representation and require exactly one returned row before showing success. This prevents a zero-row PATCH from being reported as a successful update.
- Multiline gallery/project fields retain real newline separators when loaded back into the form.
