-- ASYUT AQAR — staging-only cleanup for redundant constraints created by the immediately preceding compatibility migration.
-- Safe scope: six newly introduced duplicate checks on the already-existing empty test marketplace table.
-- Existing pre-migration constraints are preserved. No rows, Auth records, functions, policies or Storage objects are changed.
DO $cleanup$
BEGIN
  ALTER TABLE public.marketplace_listings
    DROP CONSTRAINT IF EXISTS marketplace_listings_compat_category_check;

  ALTER TABLE public.marketplace_listings
    DROP CONSTRAINT IF EXISTS marketplace_listings_compat_coordinates_pair_check;

  ALTER TABLE public.marketplace_listings
    DROP CONSTRAINT IF EXISTS marketplace_listings_compat_description_check;

  ALTER TABLE public.marketplace_listings
    DROP CONSTRAINT IF EXISTS marketplace_listings_compat_latitude_range_check;

  ALTER TABLE public.marketplace_listings
    DROP CONSTRAINT IF EXISTS marketplace_listings_compat_longitude_range_check;

  ALTER TABLE public.marketplace_listings
    DROP CONSTRAINT IF EXISTS marketplace_listings_compat_price_check;
END
$cleanup$;
