-- APPLIED staging-only migration record.
-- Target Supabase project: wisnmlbefdrkcbbqvdlg (layan-claude-test)
-- Migration: 20261103094836 align_marketplace_listing_type_default
-- This file is an audit record, not a production deployment instruction.
-- No rows, users, policies, functions, privileges, or Storage objects were changed.

ALTER TABLE public.marketplace_listings
  ALTER COLUMN listing_type SET DEFAULT 'خدمة';

-- Read-only verification:
-- SELECT column_default
-- FROM information_schema.columns
-- WHERE table_schema='public'
--   AND table_name='marketplace_listings'
--   AND column_name='listing_type';
-- Expected: 'خدمة'::text
