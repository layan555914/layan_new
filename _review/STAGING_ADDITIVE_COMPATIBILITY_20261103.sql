-- ASYUT AQAR — additive compatibility layer for layan-claude-test only.
-- Generated from the reviewed production schema snapshot on 2026-11-03.
-- DO NOT apply to production. Does not import any rows, Auth users, credentials, secrets or Storage objects.
-- Preserves existing marketplace_listings, current DB functions, Auth user and asyut-admin Edge Function.
-- Existing objects with different definitions are retained; compatibility additions use new columns/constraint names.

-- 1. Add required extension/schema prerequisites.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT USAGE ON SCHEMA private TO authenticated;

CREATE SCHEMA IF NOT EXISTS private;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT USAGE ON SCHEMA private TO authenticated;

-- 2. Create only application tables absent from the approved test project.
-- The existing public.marketplace_listings table is intentionally not recreated.
CREATE TABLE IF NOT EXISTS "private"."layan_admins" (
  "user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "private"."project_decisions" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "project_key" text NOT NULL,
  "document" jsonb NOT NULL,
  "status" text DEFAULT 'approved_for_implementation'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."buyer_offer_alerts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "offer_id" bigint NOT NULL,
  "title_snapshot" text NOT NULL,
  "city_snapshot" text,
  "area_snapshot" text,
  "price_snapshot" numeric(14,2),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "read_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "public"."buyer_preferences" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "property_type" text NOT NULL,
  "area" text,
  "max_total_price" numeric(14,2) DEFAULT 0 NOT NULL,
  "max_upfront" numeric(14,2) DEFAULT 0 NOT NULL,
  "max_monthly_installment" numeric(14,2) DEFAULT 0 NOT NULL,
  "min_bedrooms" integer DEFAULT 0 NOT NULL,
  "notes" text,
  "notifications_enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "city" text
);

CREATE TABLE IF NOT EXISTS "public"."buyer_push_subscriptions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_success_at" timestamp with time zone,
  "failure_count" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."buyer_push_vapid_config" (
  "id" smallint DEFAULT 1 NOT NULL,
  "public_key" text NOT NULL,
  "private_key" text NOT NULL,
  "subject" text DEFAULT 'https://layan-eg.com/'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."company_profiles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "company_name" text NOT NULL,
  "category" text NOT NULL,
  "description" text NOT NULL,
  "services" text[] DEFAULT '{}'::text[] NOT NULL,
  "city" text DEFAULT 'أسيوط'::text NOT NULL,
  "address" text,
  "phone" text NOT NULL,
  "whatsapp" text,
  "website" text,
  "logo_url" text,
  "gallery_urls" text[] DEFAULT '{}'::text[] NOT NULL,
  "projects" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "admin_notes" text,
  "reviewed_at" timestamp with time zone,
  "reviewed_by" uuid,
  "pending_update" jsonb,
  "update_status" text,
  "update_notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."company_property_ads" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "business_name" text NOT NULL,
  "plan_code" text DEFAULT 'trial_30'::text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "public"."directory_areas" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "legacy_code" text,
  "slug" text NOT NULL,
  "name_ar" text NOT NULL,
  "name_en" text,
  "area_type" text NOT NULL,
  "parent_id" uuid,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "verification_status" text DEFAULT 'draft'::text NOT NULL,
  "public_visible" boolean DEFAULT false NOT NULL,
  "last_verified_at" date,
  "next_review_at" date,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."directory_change_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "table_name" text NOT NULL,
  "record_id" uuid NOT NULL,
  "changed_by" uuid,
  "old_values" jsonb,
  "new_values" jsonb,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."directory_entities" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "legacy_code" text,
  "slug" text NOT NULL,
  "name_ar" text NOT NULL,
  "name_en" text,
  "entity_type" text NOT NULL,
  "description" text,
  "website_url" text,
  "public_phone" text,
  "public_email" text,
  "public_address" text,
  "primary_area_id" uuid,
  "verification_status" text DEFAULT 'draft'::text NOT NULL,
  "public_visible" boolean DEFAULT false NOT NULL,
  "last_verified_at" date,
  "next_review_at" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."directory_entity_areas" (
  "entity_id" uuid NOT NULL,
  "area_id" uuid NOT NULL,
  "notes" text
);

CREATE TABLE IF NOT EXISTS "public"."directory_entity_private" (
  "entity_id" uuid NOT NULL,
  "internal_address" text,
  "internal_phone" text,
  "verification_label" text,
  "confidence_level" text,
  "notes" text,
  "next_review_at" date,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."directory_entity_sources" (
  "entity_id" uuid NOT NULL,
  "source_id" uuid NOT NULL,
  "claim_key" text DEFAULT 'general'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."directory_opportunities" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "legacy_code" text,
  "slug" text NOT NULL,
  "name_ar" text NOT NULL,
  "city" text,
  "activity" text,
  "size_description" text,
  "terms_as_published" text,
  "announcement_date" date,
  "opportunity_type" text,
  "source_claimed_status" text,
  "verification_status" text DEFAULT 'needs_review'::text NOT NULL,
  "public_visible" boolean DEFAULT false NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."directory_opportunity_sources" (
  "opportunity_id" uuid NOT NULL,
  "source_id" uuid NOT NULL,
  "claim_key" text DEFAULT 'general'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."directory_project_entities" (
  "project_id" uuid NOT NULL,
  "entity_id" uuid NOT NULL,
  "relation_type" text NOT NULL,
  "notes" text
);

CREATE TABLE IF NOT EXISTS "public"."directory_project_private" (
  "project_id" uuid NOT NULL,
  "size_as_published" text,
  "source_claimed_status" text,
  "confidence_level" text,
  "notes" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."directory_project_sources" (
  "project_id" uuid NOT NULL,
  "source_id" uuid NOT NULL,
  "claim_key" text DEFAULT 'general'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."directory_projects" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "legacy_code" text,
  "slug" text NOT NULL,
  "name_ar" text NOT NULL,
  "name_en" text,
  "project_type" text NOT NULL,
  "description" text,
  "area_id" uuid,
  "location_text" text,
  "size_value" numeric(14,2),
  "size_unit" text,
  "unit_count" integer,
  "project_status" text DEFAULT 'unknown'::text NOT NULL,
  "verification_status" text DEFAULT 'draft'::text NOT NULL,
  "public_visible" boolean DEFAULT false NOT NULL,
  "last_verified_at" date,
  "next_review_at" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."directory_sources" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "source_code" text,
  "title" text NOT NULL,
  "publisher" text,
  "source_type" text NOT NULL,
  "source_url" text NOT NULL,
  "publication_date" date,
  "accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "confidence_level" text DEFAULT 'unverified'::text NOT NULL,
  "is_public" boolean DEFAULT false NOT NULL,
  "notes" text
);

CREATE TABLE IF NOT EXISTS "public"."marketplace_categories" (
  "name" text NOT NULL,
  "description" text NOT NULL,
  "display_order" integer NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."partner_ad_slots" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "slot_key" text NOT NULL,
  "category" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "image_urls" text[] DEFAULT '{}'::text[] NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "is_free_trial" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."promotion_payments" (
  "id" bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "offer_id" bigint NOT NULL,
  "amount_egp" numeric(10,2) NOT NULL,
  "duration_days" integer DEFAULT 15 NOT NULL,
  "payment_method" text DEFAULT 'vodafone_cash'::text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "transaction_reference" text,
  "sms_received_at" timestamp with time zone,
  "verified_at" timestamp with time zone,
  "verified_by" text,
  "admin_notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."property_offers" (
  "id" bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "owner_id" uuid,
  "title" text NOT NULL,
  "governorate" text DEFAULT 'أسيوط'::text NOT NULL,
  "city" text,
  "area" text,
  "property_type" text DEFAULT 'شقة'::text NOT NULL,
  "listing_purpose" text DEFAULT 'تنازل'::text NOT NULL,
  "bedrooms" integer,
  "bathrooms" integer,
  "area_m2" numeric(10,2),
  "land_area_m2" numeric(12,2),
  "land_ownership_authority" text,
  "land_permit_details" text,
  "land_utilities" text,
  "land_zoning" text,
  "total_price" numeric(14,2),
  "down_payment" numeric(14,2) DEFAULT 0 NOT NULL,
  "paid_amount" numeric(14,2),
  "remaining_amount" numeric(14,2),
  "remaining_installments" numeric(14,2),
  "monthly_installment" numeric(14,2),
  "assignment_fee" numeric(14,2) DEFAULT 0 NOT NULL,
  "assignment_fee_percentage" numeric(5,2) DEFAULT 0 NOT NULL,
  "transfer_fee" numeric(14,2) DEFAULT 0 NOT NULL,
  "discount_amount" numeric(14,2) DEFAULT 0 NOT NULL,
  "discount_percent" numeric(5,2) DEFAULT 0 NOT NULL,
  "description" text,
  "image_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "document_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "developer_name" text,
  "project_name" text,
  "contact_name" text,
  "contact_phone" text,
  "company_ad_id" uuid,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "verification_status" text DEFAULT 'pending'::text NOT NULL,
  "developer_approval_status" text DEFAULT 'unknown'::text NOT NULL,
  "verification_notes" text,
  "verified_at" timestamp with time zone,
  "featured_requested" boolean DEFAULT false NOT NULL,
  "is_featured" boolean DEFAULT false NOT NULL,
  "featured_until" timestamp with time zone,
  "promotion_status" text DEFAULT 'none'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "latitude" numeric(10,7),
  "longitude" numeric(10,7)
);

CREATE TABLE IF NOT EXISTS "public"."supplier_ads" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "business_name" text NOT NULL,
  "category" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "image_url" text,
  "target_url" text,
  "contact_phone" text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "price" numeric(12,2) DEFAULT 0 NOT NULL,
  "plan_code" text DEFAULT 'custom'::text NOT NULL,
  "requested_days" integer DEFAULT 0 NOT NULL,
  "requested_price" numeric(12,2) DEFAULT 0 NOT NULL,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "free_trial_started_at" timestamp with time zone,
  "free_trial_ends_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "public"."user_favorite_offers" (
  "user_id" uuid NOT NULL,
  "offer_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. Add missing production marketplace columns without changing existing rows or definitions.
ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS featured_until timestamptz;
ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS latitude numeric(10,7);
ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS longitude numeric(10,7);

-- 4. Add constraints only to new relations; marketplace additions get distinct compatibility names.
DO $compat_constraint_0$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'layan_admins_pkey' AND conrelid = 'private.layan_admins'::regclass) THEN
    ALTER TABLE "private"."layan_admins" ADD CONSTRAINT "layan_admins_pkey" PRIMARY KEY (user_id);
  END IF;
END
$compat_constraint_0$;

DO $compat_constraint_1$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_decisions_pkey' AND conrelid = 'private.project_decisions'::regclass) THEN
    ALTER TABLE "private"."project_decisions" ADD CONSTRAINT "project_decisions_pkey" PRIMARY KEY (id);
  END IF;
END
$compat_constraint_1$;

DO $compat_constraint_2$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_decisions_project_key_key' AND conrelid = 'private.project_decisions'::regclass) THEN
    ALTER TABLE "private"."project_decisions" ADD CONSTRAINT "project_decisions_project_key_key" UNIQUE (project_key);
  END IF;
END
$compat_constraint_2$;

DO $compat_constraint_3$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_offer_alerts_pkey' AND conrelid = 'public.buyer_offer_alerts'::regclass) THEN
    ALTER TABLE "public"."buyer_offer_alerts" ADD CONSTRAINT "buyer_offer_alerts_pkey" PRIMARY KEY (id);
  END IF;
END
$compat_constraint_3$;

DO $compat_constraint_4$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_offer_alerts_user_id_offer_id_key' AND conrelid = 'public.buyer_offer_alerts'::regclass) THEN
    ALTER TABLE "public"."buyer_offer_alerts" ADD CONSTRAINT "buyer_offer_alerts_user_id_offer_id_key" UNIQUE (user_id, offer_id);
  END IF;
END
$compat_constraint_4$;

DO $compat_constraint_5$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_preferences_max_monthly_installment_check' AND conrelid = 'public.buyer_preferences'::regclass) THEN
    ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_max_monthly_installment_check" CHECK (max_monthly_installment >= 0::numeric);
  END IF;
END
$compat_constraint_5$;

DO $compat_constraint_6$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_preferences_max_total_price_check' AND conrelid = 'public.buyer_preferences'::regclass) THEN
    ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_max_total_price_check" CHECK (max_total_price >= 0::numeric);
  END IF;
END
$compat_constraint_6$;

DO $compat_constraint_7$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_preferences_max_upfront_check' AND conrelid = 'public.buyer_preferences'::regclass) THEN
    ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_max_upfront_check" CHECK (max_upfront >= 0::numeric);
  END IF;
END
$compat_constraint_7$;

DO $compat_constraint_8$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_preferences_min_bedrooms_check' AND conrelid = 'public.buyer_preferences'::regclass) THEN
    ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_min_bedrooms_check" CHECK (min_bedrooms >= 0 AND min_bedrooms <= 20);
  END IF;
END
$compat_constraint_8$;

DO $compat_constraint_9$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_preferences_owner_id_key' AND conrelid = 'public.buyer_preferences'::regclass) THEN
    ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_owner_id_key" UNIQUE (owner_id);
  END IF;
END
$compat_constraint_9$;

DO $compat_constraint_10$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_preferences_pkey' AND conrelid = 'public.buyer_preferences'::regclass) THEN
    ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_pkey" PRIMARY KEY (id);
  END IF;
END
$compat_constraint_10$;

DO $compat_constraint_11$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_preferences_property_type_check' AND conrelid = 'public.buyer_preferences'::regclass) THEN
    ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_property_type_check" CHECK (property_type = ANY (ARRAY['شقة'::text, 'فيلا'::text, 'محل'::text, 'أرض'::text, 'أي نوع'::text]));
  END IF;
END
$compat_constraint_11$;

DO $compat_constraint_12$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_push_subscriptions_failure_count_check' AND conrelid = 'public.buyer_push_subscriptions'::regclass) THEN
    ALTER TABLE "public"."buyer_push_subscriptions" ADD CONSTRAINT "buyer_push_subscriptions_failure_count_check" CHECK (failure_count >= 0);
  END IF;
END
$compat_constraint_12$;

DO $compat_constraint_13$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_push_subscriptions_pkey' AND conrelid = 'public.buyer_push_subscriptions'::regclass) THEN
    ALTER TABLE "public"."buyer_push_subscriptions" ADD CONSTRAINT "buyer_push_subscriptions_pkey" PRIMARY KEY (id);
  END IF;
END
$compat_constraint_13$;

DO $compat_constraint_14$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_push_subscriptions_user_id_endpoint_key' AND conrelid = 'public.buyer_push_subscriptions'::regclass) THEN
    ALTER TABLE "public"."buyer_push_subscriptions" ADD CONSTRAINT "buyer_push_subscriptions_user_id_endpoint_key" UNIQUE (user_id, endpoint);
  END IF;
END
$compat_constraint_14$;

DO $compat_constraint_15$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_push_vapid_config_id_check' AND conrelid = 'public.buyer_push_vapid_config'::regclass) THEN
    ALTER TABLE "public"."buyer_push_vapid_config" ADD CONSTRAINT "buyer_push_vapid_config_id_check" CHECK (id = 1);
  END IF;
END
$compat_constraint_15$;

DO $compat_constraint_16$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_push_vapid_config_pkey' AND conrelid = 'public.buyer_push_vapid_config'::regclass) THEN
    ALTER TABLE "public"."buyer_push_vapid_config" ADD CONSTRAINT "buyer_push_vapid_config_pkey" PRIMARY KEY (id);
  END IF;
END
$compat_constraint_16$;

DO $compat_constraint_17$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_profiles_company_name_check' AND conrelid = 'public.company_profiles'::regclass) THEN
    ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_company_name_check" CHECK (char_length(TRIM(BOTH FROM company_name)) >= 2 AND char_length(TRIM(BOTH FROM company_name)) <= 140);
  END IF;
END
$compat_constraint_17$;

DO $compat_constraint_18$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_profiles_description_check' AND conrelid = 'public.company_profiles'::regclass) THEN
    ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_description_check" CHECK (char_length(description) >= 20 AND char_length(description) <= 1200);
  END IF;
END
$compat_constraint_18$;

DO $compat_constraint_19$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_profiles_pending_update_shape' AND conrelid = 'public.company_profiles'::regclass) THEN
    ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_pending_update_shape" CHECK (pending_update IS NULL OR jsonb_typeof(pending_update) = 'object'::text AND length(pending_update::text) <= 20000);
  END IF;
END
$compat_constraint_19$;

DO $compat_constraint_20$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_profiles_phone_check' AND conrelid = 'public.company_profiles'::regclass) THEN
    ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_phone_check" CHECK (char_length(phone) >= 7 AND char_length(phone) <= 30);
  END IF;
END
$compat_constraint_20$;

DO $compat_constraint_21$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_profiles_pkey' AND conrelid = 'public.company_profiles'::regclass) THEN
    ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_pkey" PRIMARY KEY (id);
  END IF;
END
$compat_constraint_21$;

DO $compat_constraint_22$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_profiles_projects_check' AND conrelid = 'public.company_profiles'::regclass) THEN
    ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_projects_check" CHECK (jsonb_typeof(projects) = 'array'::text);
  END IF;
END
$compat_constraint_22$;

DO $compat_constraint_23$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_profiles_status_check' AND conrelid = 'public.company_profiles'::regclass) THEN
    ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'rejected'::text, 'paused'::text, 'needs_changes'::text]));
  END IF;
END
$compat_constraint_23$;

DO $compat_constraint_24$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_profiles_update_status_check' AND conrelid = 'public.company_profiles'::regclass) THEN
    ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_update_status_check" CHECK (update_status IS NULL OR (update_status = ANY (ARRAY['pending'::text, 'needs_changes'::text, 'rejected'::text])));
  END IF;
END
$compat_constraint_24$;

DO $compat_constraint_25$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_property_ads_business_name_check' AND conrelid = 'public.company_property_ads'::regclass) THEN
    ALTER TABLE "public"."company_property_ads" ADD CONSTRAINT "company_property_ads_business_name_check" CHECK (char_length(TRIM(BOTH FROM business_name)) >= 2 AND char_length(TRIM(BOTH FROM business_name)) <= 120);
  END IF;
END
$compat_constraint_25$;

DO $compat_constraint_26$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_property_ads_pkey' AND conrelid = 'public.company_property_ads'::regclass) THEN
    ALTER TABLE "public"."company_property_ads" ADD CONSTRAINT "company_property_ads_pkey" PRIMARY KEY (id);
  END IF;
END
$compat_constraint_26$;

DO $compat_constraint_27$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_property_ads_plan_code_check' AND conrelid = 'public.company_property_ads'::regclass) THEN
    ALTER TABLE "public"."company_property_ads" ADD CONSTRAINT "company_property_ads_plan_code_check" CHECK (plan_code = ANY (ARRAY['trial_30'::text, 'starter_15'::text, 'growth_30'::text, 'partner_90'::text]));
  END IF;
END
$compat_constraint_27$;

DO $compat_constraint_28$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_property_ads_status_check' AND conrelid = 'public.company_property_ads'::regclass) THEN
    ALTER TABLE "public"."company_property_ads" ADD CONSTRAINT "company_property_ads_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'paused'::text, 'expired'::text, 'rejected'::text]));
  END IF;
END
$compat_constraint_28$;

DO $compat_constraint_29$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_areas_area_type_check' AND conrelid = 'public.directory_areas'::regclass) THEN
    ALTER TABLE "public"."directory_areas" ADD CONSTRAINT "directory_areas_area_type_check" CHECK (area_type = ANY (ARRAY['governorate'::text, 'center'::text, 'city'::text, 'new_city'::text, 'district'::text, 'neighborhood'::text, 'village'::text, 'zone'::text, 'industrial_zone'::text]));
  END IF;
END
$compat_constraint_29$;

DO $compat_constraint_30$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_areas_legacy_code_key' AND conrelid = 'public.directory_areas'::regclass) THEN
    ALTER TABLE "public"."directory_areas" ADD CONSTRAINT "directory_areas_legacy_code_key" UNIQUE (legacy_code);
  END IF;
END
$compat_constraint_30$;

DO $compat_constraint_31$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_areas_pkey' AND conrelid = 'public.directory_areas'::regclass) THEN
    ALTER TABLE "public"."directory_areas" ADD CONSTRAINT "directory_areas_pkey" PRIMARY KEY (id);
  END IF;
END
$compat_constraint_31$;

DO $compat_constraint_32$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_areas_slug_key' AND conrelid = 'public.directory_areas'::regclass) THEN
    ALTER TABLE "public"."directory_areas" ADD CONSTRAINT "directory_areas_slug_key" UNIQUE (slug);
  END IF;
END
$compat_constraint_32$;

DO $compat_constraint_33$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_areas_verification_status_check' AND conrelid = 'public.directory_areas'::regclass) THEN
    ALTER TABLE "public"."directory_areas" ADD CONSTRAINT "directory_areas_verification_status_check" CHECK (verification_status = ANY (ARRAY['draft'::text, 'needs_review'::text, 'verified'::text, 'published'::text, 'archived'::text]));
  END IF;
END
$compat_constraint_33$;

DO $compat_constraint_34$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_change_log_pkey' AND conrelid = 'public.directory_change_log'::regclass) THEN
    ALTER TABLE "public"."directory_change_log" ADD CONSTRAINT "directory_change_log_pkey" PRIMARY KEY (id);
  END IF;
END
$compat_constraint_34$;

DO $compat_constraint_35$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_entities_entity_type_check' AND conrelid = 'public.directory_entities'::regclass) THEN
    ALTER TABLE "public"."directory_entities" ADD CONSTRAINT "directory_entities_entity_type_check" CHECK (entity_type = ANY (ARRAY['developer'::text, 'brokerage'::text, 'marketing'::text, 'contractor'::text, 'public_authority'::text, 'sales_office'::text, 'consultant'::text, 'other'::text]));
  END IF;
END
$compat_constraint_35$;

DO $compat_constraint_36$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_entities_legacy_code_key' AND conrelid = 'public.directory_entities'::regclass) THEN
    ALTER TABLE "public"."directory_entities" ADD CONSTRAINT "directory_entities_legacy_code_key" UNIQUE (legacy_code);
  END IF;
END
$compat_constraint_36$;

DO $compat_constraint_37$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_entities_pkey' AND conrelid = 'public.directory_entities'::regclass) THEN
    ALTER TABLE "public"."directory_entities" ADD CONSTRAINT "directory_entities_pkey" PRIMARY KEY (id);
  END IF;
END
$compat_constraint_37$;

DO $compat_constraint_38$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_entities_slug_key' AND conrelid = 'public.directory_entities'::regclass) THEN
    ALTER TABLE "public"."directory_entities" ADD CONSTRAINT "directory_entities_slug_key" UNIQUE (slug);
  END IF;
END
$compat_constraint_38$;

DO $compat_constraint_39$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_entities_verification_status_check' AND conrelid = 'public.directory_entities'::regclass) THEN
    ALTER TABLE "public"."directory_entities" ADD CONSTRAINT "directory_entities_verification_status_check" CHECK (verification_status = ANY (ARRAY['draft'::text, 'needs_review'::text, 'verified'::text, 'published'::text, 'archived'::text]));
  END IF;
END
$compat_constraint_39$;

DO $compat_constraint_40$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_entity_areas_pkey' AND conrelid = 'public.directory_entity_areas'::regclass) THEN
    ALTER TABLE "public"."directory_entity_areas" ADD CONSTRAINT "directory_entity_areas_pkey" PRIMARY KEY (entity_id, area_id);
  END IF;
END
$compat_constraint_40$;

DO $compat_constraint_41$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_entity_private_pkey' AND conrelid = 'public.directory_entity_private'::regclass) THEN
    ALTER TABLE "public"."directory_entity_private" ADD CONSTRAINT "directory_entity_private_pkey" PRIMARY KEY (entity_id);
  END IF;
END
$compat_constraint_41$;

DO $compat_constraint_42$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_entity_sources_pkey' AND conrelid = 'public.directory_entity_sources'::regclass) THEN
    ALTER TABLE "public"."directory_entity_sources" ADD CONSTRAINT "directory_entity_sources_pkey" PRIMARY KEY (entity_id, source_id, claim_key);
  END IF;
END
$compat_constraint_42$;

DO $compat_constraint_43$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_opportunities_legacy_code_key' AND conrelid = 'public.directory_opportunities'::regclass) THEN
    ALTER TABLE "public"."directory_opportunities" ADD CONSTRAINT "directory_opportunities_legacy_code_key" UNIQUE (legacy_code);
  END IF;
END
$compat_constraint_43$;

DO $compat_constraint_44$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_opportunities_pkey' AND conrelid = 'public.directory_opportunities'::regclass) THEN
    ALTER TABLE "public"."directory_opportunities" ADD CONSTRAINT "directory_opportunities_pkey" PRIMARY KEY (id);
  END IF;
END
$compat_constraint_44$;

DO $compat_constraint_45$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_opportunities_slug_key' AND conrelid = 'public.directory_opportunities'::regclass) THEN
    ALTER TABLE "public"."directory_opportunities" ADD CONSTRAINT "directory_opportunities_slug_key" UNIQUE (slug);
  END IF;
END
$compat_constraint_45$;

DO $compat_constraint_46$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_opportunities_verification_status_check' AND conrelid = 'public.directory_opportunities'::regclass) THEN
    ALTER TABLE "public"."directory_opportunities" ADD CONSTRAINT "directory_opportunities_verification_status_check" CHECK (verification_status = ANY (ARRAY['draft'::text, 'needs_review'::text, 'verified'::text, 'published'::text, 'archived'::text]));
  END IF;
END
$compat_constraint_46$;

DO $compat_constraint_47$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_opportunity_sources_pkey' AND conrelid = 'public.directory_opportunity_sources'::regclass) THEN
    ALTER TABLE "public"."directory_opportunity_sources" ADD CONSTRAINT "directory_opportunity_sources_pkey" PRIMARY KEY (opportunity_id, source_id, claim_key);
  END IF;
END
$compat_constraint_47$;

DO $compat_constraint_48$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_project_entities_pkey' AND conrelid = 'public.directory_project_entities'::regclass) THEN
    ALTER TABLE "public"."directory_project_entities" ADD CONSTRAINT "directory_project_entities_pkey" PRIMARY KEY (project_id, entity_id, relation_type);
  END IF;
END
$compat_constraint_48$;

DO $compat_constraint_49$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_project_entities_relation_type_check' AND conrelid = 'public.directory_project_entities'::regclass) THEN
    ALTER TABLE "public"."directory_project_entities" ADD CONSTRAINT "directory_project_entities_relation_type_check" CHECK (relation_type = ANY (ARRAY['developer'::text, 'land_owner'::text, 'marketing_agent'::text, 'sales_agent'::text, 'contractor'::text, 'consultant'::text, 'operator'::text, 'public_authority'::text, 'other'::text]));
  END IF;
END
$compat_constraint_49$;

DO $compat_constraint_50$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_project_private_pkey' AND conrelid = 'public.directory_project_private'::regclass) THEN
    ALTER TABLE "public"."directory_project_private" ADD CONSTRAINT "directory_project_private_pkey" PRIMARY KEY (project_id);
  END IF;
END
$compat_constraint_50$;

DO $compat_constraint_51$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_project_sources_pkey' AND conrelid = 'public.directory_project_sources'::regclass) THEN
    ALTER TABLE "public"."directory_project_sources" ADD CONSTRAINT "directory_project_sources_pkey" PRIMARY KEY (project_id, source_id, claim_key);
  END IF;
END
$compat_constraint_51$;

DO $compat_constraint_52$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_projects_legacy_code_key' AND conrelid = 'public.directory_projects'::regclass) THEN
    ALTER TABLE "public"."directory_projects" ADD CONSTRAINT "directory_projects_legacy_code_key" UNIQUE (legacy_code);
  END IF;
END
$compat_constraint_52$;

DO $compat_constraint_53$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_projects_pkey' AND conrelid = 'public.directory_projects'::regclass) THEN
    ALTER TABLE "public"."directory_projects" ADD CONSTRAINT "directory_projects_pkey" PRIMARY KEY (id);
  END IF;
END
$compat_constraint_53$;

DO $compat_constraint_54$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_projects_project_status_check' AND conrelid = 'public.directory_projects'::regclass) THEN
    ALTER TABLE "public"."directory_projects" ADD CONSTRAINT "directory_projects_project_status_check" CHECK (project_status = ANY (ARRAY['announced'::text, 'planned'::text, 'under_construction'::text, 'partially_delivered'::text, 'completed'::text, 'operating'::text, 'stalled'::text, 'unknown'::text]));
  END IF;
END
$compat_constraint_54$;

DO $compat_constraint_55$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_projects_project_type_check' AND conrelid = 'public.directory_projects'::regclass) THEN
    ALTER TABLE "public"."directory_projects" ADD CONSTRAINT "directory_projects_project_type_check" CHECK (project_type = ANY (ARRAY['residential'::text, 'commercial'::text, 'administrative'::text, 'medical'::text, 'educational'::text, 'mixed_use'::text, 'land'::text, 'service'::text, 'other'::text]));
  END IF;
END
$compat_constraint_55$;

DO $compat_constraint_56$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_projects_slug_key' AND conrelid = 'public.directory_projects'::regclass) THEN
    ALTER TABLE "public"."directory_projects" ADD CONSTRAINT "directory_projects_slug_key" UNIQUE (slug);
  END IF;
END
$compat_constraint_56$;

DO $compat_constraint_57$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_projects_unit_count_check' AND conrelid = 'public.directory_projects'::regclass) THEN
    ALTER TABLE "public"."directory_projects" ADD CONSTRAINT "directory_projects_unit_count_check" CHECK (unit_count IS NULL OR unit_count >= 0);
  END IF;
END
$compat_constraint_57$;

DO $compat_constraint_58$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_projects_verification_status_check' AND conrelid = 'public.directory_projects'::regclass) THEN
    ALTER TABLE "public"."directory_projects" ADD CONSTRAINT "directory_projects_verification_status_check" CHECK (verification_status = ANY (ARRAY['draft'::text, 'needs_review'::text, 'verified'::text, 'published'::text, 'archived'::text]));
  END IF;
END
$compat_constraint_58$;

DO $compat_constraint_59$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_sources_pkey' AND conrelid = 'public.directory_sources'::regclass) THEN
    ALTER TABLE "public"."directory_sources" ADD CONSTRAINT "directory_sources_pkey" PRIMARY KEY (id);
  END IF;
END
$compat_constraint_59$;

DO $compat_constraint_60$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_sources_source_code_key' AND conrelid = 'public.directory_sources'::regclass) THEN
    ALTER TABLE "public"."directory_sources" ADD CONSTRAINT "directory_sources_source_code_key" UNIQUE (source_code);
  END IF;
END
$compat_constraint_60$;

DO $compat_constraint_61$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_categories_display_order_check' AND conrelid = 'public.marketplace_categories'::regclass) THEN
    ALTER TABLE "public"."marketplace_categories" ADD CONSTRAINT "marketplace_categories_display_order_check" CHECK (display_order >= 1 AND display_order <= 11);
  END IF;
END
$compat_constraint_61$;

DO $compat_constraint_62$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_categories_display_order_key' AND conrelid = 'public.marketplace_categories'::regclass) THEN
    ALTER TABLE "public"."marketplace_categories" ADD CONSTRAINT "marketplace_categories_display_order_key" UNIQUE (display_order);
  END IF;
END
$compat_constraint_62$;

DO $compat_constraint_63$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_categories_pkey' AND conrelid = 'public.marketplace_categories'::regclass) THEN
    ALTER TABLE "public"."marketplace_categories" ADD CONSTRAINT "marketplace_categories_pkey" PRIMARY KEY (name);
  END IF;
END
$compat_constraint_63$;

DO $compat_constraint_64$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_listings_category_check' AND conrelid = 'public.marketplace_listings'::regclass) THEN
    ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_category_check" CHECK (category = ANY (ARRAY['سوق العقارات'::text, 'التنازلات العقارية'::text, 'أراضي للبيع'::text, 'أراضي التنازلات'::text, 'إيجار يومي ومفروش'::text, 'الشركات والمكاتب العقارية'::text, 'مواد البناء والتشطيب'::text, 'الأثاث والفرش وتجهيز الوحدات'::text, 'المشروعات والمطورون العقاريون'::text, 'الصيانة وإدارة العقارات'::text, 'الاستشارات والخدمات العقارية'::text]));
  END IF;
END
$compat_constraint_64$;

DO $compat_constraint_65$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_listings_coordinates_pair_check' AND conrelid = 'public.marketplace_listings'::regclass) THEN
    ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_coordinates_pair_check" CHECK (latitude IS NULL AND longitude IS NULL OR latitude IS NOT NULL AND longitude IS NOT NULL);
  END IF;
END
$compat_constraint_65$;

DO $compat_constraint_66$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_listings_description_production_compat_check' AND conrelid = 'public.marketplace_listings'::regclass) THEN
    ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_description_production_compat_check" CHECK (char_length(TRIM(BOTH FROM description)) >= 20 AND char_length(TRIM(BOTH FROM description)) <= 3000);
  END IF;
END
$compat_constraint_66$;

DO $compat_constraint_67$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_listings_latitude_range_check' AND conrelid = 'public.marketplace_listings'::regclass) THEN
    ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_latitude_range_check" CHECK (latitude IS NULL OR latitude >= '-90'::integer::numeric AND latitude <= 90::numeric);
  END IF;
END
$compat_constraint_67$;

DO $compat_constraint_68$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_listings_longitude_range_check' AND conrelid = 'public.marketplace_listings'::regclass) THEN
    ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_longitude_range_check" CHECK (longitude IS NULL OR longitude >= '-180'::integer::numeric AND longitude <= 180::numeric);
  END IF;
END
$compat_constraint_68$;

DO $compat_constraint_69$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_listings_pkey' AND conrelid = 'public.marketplace_listings'::regclass) THEN
    ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY (id);
  END IF;
END
$compat_constraint_69$;

DO $compat_constraint_70$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_listings_price_check' AND conrelid = 'public.marketplace_listings'::regclass) THEN
    ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_price_check" CHECK (price IS NULL OR price >= 0::numeric);
  END IF;
END
$compat_constraint_70$;

DO $compat_constraint_71$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_listings_status_check' AND conrelid = 'public.marketplace_listings'::regclass) THEN
    ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'paused'::text]));
  END IF;
END
$compat_constraint_71$;

DO $compat_constraint_72$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_listings_title_check' AND conrelid = 'public.marketplace_listings'::regclass) THEN
    ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_title_check" CHECK (char_length(TRIM(BOTH FROM title)) >= 4 AND char_length(TRIM(BOTH FROM title)) <= 180);
  END IF;
END
$compat_constraint_72$;

DO $compat_constraint_73$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partner_ad_slots_pkey' AND conrelid = 'public.partner_ad_slots'::regclass) THEN
    ALTER TABLE "public"."partner_ad_slots" ADD CONSTRAINT "partner_ad_slots_pkey" PRIMARY KEY (id);
  END IF;
END
$compat_constraint_73$;

DO $compat_constraint_74$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partner_ad_slots_slot_key_check' AND conrelid = 'public.partner_ad_slots'::regclass) THEN
    ALTER TABLE "public"."partner_ad_slots" ADD CONSTRAINT "partner_ad_slots_slot_key_check" CHECK (slot_key = ANY (ARRAY['ceramics'::text, 'furniture'::text, 'curtains'::text, 'paint'::text]));
  END IF;
END
$compat_constraint_74$;

DO $compat_constraint_75$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partner_ad_slots_slot_key_key' AND conrelid = 'public.partner_ad_slots'::regclass) THEN
    ALTER TABLE "public"."partner_ad_slots" ADD CONSTRAINT "partner_ad_slots_slot_key_key" UNIQUE (slot_key);
  END IF;
END
$compat_constraint_75$;

DO $compat_constraint_76$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partner_ad_slots_status_check' AND conrelid = 'public.partner_ad_slots'::regclass) THEN
    ALTER TABLE "public"."partner_ad_slots" ADD CONSTRAINT "partner_ad_slots_status_check" CHECK (status = ANY (ARRAY['active'::text, 'draft'::text, 'paused'::text]));
  END IF;
END
$compat_constraint_76$;

DO $compat_constraint_77$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_payments_amount_egp_check' AND conrelid = 'public.promotion_payments'::regclass) THEN
    ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_amount_egp_check" CHECK (amount_egp > 0::numeric);
  END IF;
END
$compat_constraint_77$;

DO $compat_constraint_78$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_payments_duration_days_check' AND conrelid = 'public.promotion_payments'::regclass) THEN
    ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_duration_days_check" CHECK (duration_days = ANY (ARRAY[15, 30]));
  END IF;
END
$compat_constraint_78$;

DO $compat_constraint_79$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_payments_payment_method_check' AND conrelid = 'public.promotion_payments'::regclass) THEN
    ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_payment_method_check" CHECK (payment_method = 'vodafone_cash'::text);
  END IF;
END
$compat_constraint_79$;

DO $compat_constraint_80$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_payments_pkey' AND conrelid = 'public.promotion_payments'::regclass) THEN
    ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_pkey" PRIMARY KEY (id);
  END IF;
END
$compat_constraint_80$;

DO $compat_constraint_81$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_payments_status_check' AND conrelid = 'public.promotion_payments'::regclass) THEN
    ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text, 'expired'::text]));
  END IF;
END
$compat_constraint_81$;

DO $compat_constraint_82$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_payments_transaction_reference_key' AND conrelid = 'public.promotion_payments'::regclass) THEN
    ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_transaction_reference_key" UNIQUE (transaction_reference);
  END IF;
END
$compat_constraint_82$;

DO $compat_constraint_83$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verified_payment_requires_reference' AND conrelid = 'public.promotion_payments'::regclass) THEN
    ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "verified_payment_requires_reference" CHECK (status <> 'verified'::text OR transaction_reference IS NOT NULL AND verified_at IS NOT NULL);
  END IF;
END
$compat_constraint_83$;

DO $compat_constraint_84$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_offers_coordinates_pair_check' AND conrelid = 'public.property_offers'::regclass) THEN
    ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_coordinates_pair_check" CHECK (latitude IS NULL AND longitude IS NULL OR latitude IS NOT NULL AND longitude IS NOT NULL);
  END IF;
END
$compat_constraint_84$;

DO $compat_constraint_85$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_offers_developer_approval_status_check' AND conrelid = 'public.property_offers'::regclass) THEN
    ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_developer_approval_status_check" CHECK (developer_approval_status = ANY (ARRAY['unknown'::text, 'pending'::text, 'approved'::text, 'rejected'::text]));
  END IF;
END
$compat_constraint_85$;

DO $compat_constraint_86$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_offers_latitude_range_check' AND conrelid = 'public.property_offers'::regclass) THEN
    ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_latitude_range_check" CHECK (latitude IS NULL OR latitude >= '-90'::integer::numeric AND latitude <= 90::numeric);
  END IF;
END
$compat_constraint_86$;

DO $compat_constraint_87$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_offers_listing_purpose_check' AND conrelid = 'public.property_offers'::regclass) THEN
    ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_listing_purpose_check" CHECK (listing_purpose = ANY (ARRAY['بيع'::text, 'إيجار'::text, 'تنازل'::text]));
  END IF;
END
$compat_constraint_87$;

DO $compat_constraint_88$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_offers_longitude_range_check' AND conrelid = 'public.property_offers'::regclass) THEN
    ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_longitude_range_check" CHECK (longitude IS NULL OR longitude >= '-180'::integer::numeric AND longitude <= 180::numeric);
  END IF;
END
$compat_constraint_88$;

DO $compat_constraint_89$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_offers_pkey' AND conrelid = 'public.property_offers'::regclass) THEN
    ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_pkey" PRIMARY KEY (id);
  END IF;
END
$compat_constraint_89$;

DO $compat_constraint_90$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_offers_promotion_status_check' AND conrelid = 'public.property_offers'::regclass) THEN
    ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_promotion_status_check" CHECK (promotion_status = ANY (ARRAY['none'::text, 'requested'::text, 'payment_pending'::text, 'active'::text, 'expired'::text, 'rejected'::text]));
  END IF;
END
$compat_constraint_90$;

DO $compat_constraint_91$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_offers_status_check' AND conrelid = 'public.property_offers'::regclass) THEN
    ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'available'::text, 'reserved'::text, 'sold'::text]));
  END IF;
END
$compat_constraint_91$;

DO $compat_constraint_92$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_offers_verification_status_check' AND conrelid = 'public.property_offers'::regclass) THEN
    ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_verification_status_check" CHECK (verification_status = ANY (ARRAY['pending'::text, 'under_review'::text, 'verified'::text, 'rejected'::text]));
  END IF;
END
$compat_constraint_92$;

DO $compat_constraint_93$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_ads_business_name_check' AND conrelid = 'public.supplier_ads'::regclass) THEN
    ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_business_name_check" CHECK (char_length(business_name) >= 2 AND char_length(business_name) <= 120);
  END IF;
END
$compat_constraint_93$;

DO $compat_constraint_94$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_ads_contact_phone_check' AND conrelid = 'public.supplier_ads'::regclass) THEN
    ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_contact_phone_check" CHECK (char_length(contact_phone) >= 7 AND char_length(contact_phone) <= 30);
  END IF;
END
$compat_constraint_94$;

DO $compat_constraint_95$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_ads_dates_check' AND conrelid = 'public.supplier_ads'::regclass) THEN
    ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_dates_check" CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at);
  END IF;
END
$compat_constraint_95$;

DO $compat_constraint_96$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_ads_description_check' AND conrelid = 'public.supplier_ads'::regclass) THEN
    ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_description_check" CHECK (char_length(description) >= 5 AND char_length(description) <= 500);
  END IF;
END
$compat_constraint_96$;

DO $compat_constraint_97$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_ads_pkey' AND conrelid = 'public.supplier_ads'::regclass) THEN
    ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_pkey" PRIMARY KEY (id);
  END IF;
END
$compat_constraint_97$;

DO $compat_constraint_98$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_ads_price_check' AND conrelid = 'public.supplier_ads'::regclass) THEN
    ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_price_check" CHECK (price >= 0::numeric);
  END IF;
END
$compat_constraint_98$;

DO $compat_constraint_99$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_ads_requested_days_check' AND conrelid = 'public.supplier_ads'::regclass) THEN
    ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_requested_days_check" CHECK (requested_days >= 0 AND requested_days <= 365);
  END IF;
END
$compat_constraint_99$;

DO $compat_constraint_100$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_ads_requested_price_check' AND conrelid = 'public.supplier_ads'::regclass) THEN
    ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_requested_price_check" CHECK (requested_price >= 0::numeric);
  END IF;
END
$compat_constraint_100$;

DO $compat_constraint_101$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_ads_status_check' AND conrelid = 'public.supplier_ads'::regclass) THEN
    ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'paused'::text, 'expired'::text, 'rejected'::text]));
  END IF;
END
$compat_constraint_101$;

DO $compat_constraint_102$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_ads_title_check' AND conrelid = 'public.supplier_ads'::regclass) THEN
    ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_title_check" CHECK (char_length(title) >= 3 AND char_length(title) <= 140);
  END IF;
END
$compat_constraint_102$;

DO $compat_constraint_103$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_favorite_offers_pkey' AND conrelid = 'public.user_favorite_offers'::regclass) THEN
    ALTER TABLE "public"."user_favorite_offers" ADD CONSTRAINT "user_favorite_offers_pkey" PRIMARY KEY (user_id, offer_id);
  END IF;
END
$compat_constraint_103$;

DO $compat_constraint_104$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'layan_admins_user_id_fkey' AND conrelid = 'private.layan_admins'::regclass) THEN
    ALTER TABLE "private"."layan_admins" ADD CONSTRAINT "layan_admins_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$compat_constraint_104$;

DO $compat_constraint_105$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_offer_alerts_offer_id_fkey' AND conrelid = 'public.buyer_offer_alerts'::regclass) THEN
    ALTER TABLE "public"."buyer_offer_alerts" ADD CONSTRAINT "buyer_offer_alerts_offer_id_fkey" FOREIGN KEY (offer_id) REFERENCES property_offers(id) ON DELETE CASCADE;
  END IF;
END
$compat_constraint_105$;

DO $compat_constraint_106$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_offer_alerts_user_id_fkey' AND conrelid = 'public.buyer_offer_alerts'::regclass) THEN
    ALTER TABLE "public"."buyer_offer_alerts" ADD CONSTRAINT "buyer_offer_alerts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$compat_constraint_106$;

DO $compat_constraint_107$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_preferences_owner_id_fkey' AND conrelid = 'public.buyer_preferences'::regclass) THEN
    ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$compat_constraint_107$;

DO $compat_constraint_108$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_push_subscriptions_user_id_fkey' AND conrelid = 'public.buyer_push_subscriptions'::regclass) THEN
    ALTER TABLE "public"."buyer_push_subscriptions" ADD CONSTRAINT "buyer_push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$compat_constraint_108$;

DO $compat_constraint_109$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_profiles_owner_id_fkey' AND conrelid = 'public.company_profiles'::regclass) THEN
    ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$compat_constraint_109$;

DO $compat_constraint_110$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_profiles_reviewed_by_fkey' AND conrelid = 'public.company_profiles'::regclass) THEN
    ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);
  END IF;
END
$compat_constraint_110$;

DO $compat_constraint_111$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_property_ads_owner_id_fkey' AND conrelid = 'public.company_property_ads'::regclass) THEN
    ALTER TABLE "public"."company_property_ads" ADD CONSTRAINT "company_property_ads_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$compat_constraint_111$;

DO $compat_constraint_112$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_areas_parent_id_fkey' AND conrelid = 'public.directory_areas'::regclass) THEN
    ALTER TABLE "public"."directory_areas" ADD CONSTRAINT "directory_areas_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES directory_areas(id) ON DELETE RESTRICT;
  END IF;
END
$compat_constraint_112$;

DO $compat_constraint_113$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_entities_primary_area_id_fkey' AND conrelid = 'public.directory_entities'::regclass) THEN
    ALTER TABLE "public"."directory_entities" ADD CONSTRAINT "directory_entities_primary_area_id_fkey" FOREIGN KEY (primary_area_id) REFERENCES directory_areas(id) ON DELETE SET NULL;
  END IF;
END
$compat_constraint_113$;

DO $compat_constraint_114$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_entity_areas_area_id_fkey' AND conrelid = 'public.directory_entity_areas'::regclass) THEN
    ALTER TABLE "public"."directory_entity_areas" ADD CONSTRAINT "directory_entity_areas_area_id_fkey" FOREIGN KEY (area_id) REFERENCES directory_areas(id) ON DELETE RESTRICT;
  END IF;
END
$compat_constraint_114$;

DO $compat_constraint_115$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_entity_areas_entity_id_fkey' AND conrelid = 'public.directory_entity_areas'::regclass) THEN
    ALTER TABLE "public"."directory_entity_areas" ADD CONSTRAINT "directory_entity_areas_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES directory_entities(id) ON DELETE CASCADE;
  END IF;
END
$compat_constraint_115$;

DO $compat_constraint_116$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_entity_private_entity_id_fkey' AND conrelid = 'public.directory_entity_private'::regclass) THEN
    ALTER TABLE "public"."directory_entity_private" ADD CONSTRAINT "directory_entity_private_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES directory_entities(id) ON DELETE CASCADE;
  END IF;
END
$compat_constraint_116$;

DO $compat_constraint_117$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_entity_sources_entity_id_fkey' AND conrelid = 'public.directory_entity_sources'::regclass) THEN
    ALTER TABLE "public"."directory_entity_sources" ADD CONSTRAINT "directory_entity_sources_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES directory_entities(id) ON DELETE CASCADE;
  END IF;
END
$compat_constraint_117$;

DO $compat_constraint_118$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_entity_sources_source_id_fkey' AND conrelid = 'public.directory_entity_sources'::regclass) THEN
    ALTER TABLE "public"."directory_entity_sources" ADD CONSTRAINT "directory_entity_sources_source_id_fkey" FOREIGN KEY (source_id) REFERENCES directory_sources(id) ON DELETE RESTRICT;
  END IF;
END
$compat_constraint_118$;

DO $compat_constraint_119$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_opportunity_sources_opportunity_id_fkey' AND conrelid = 'public.directory_opportunity_sources'::regclass) THEN
    ALTER TABLE "public"."directory_opportunity_sources" ADD CONSTRAINT "directory_opportunity_sources_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES directory_opportunities(id) ON DELETE CASCADE;
  END IF;
END
$compat_constraint_119$;

DO $compat_constraint_120$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_opportunity_sources_source_id_fkey' AND conrelid = 'public.directory_opportunity_sources'::regclass) THEN
    ALTER TABLE "public"."directory_opportunity_sources" ADD CONSTRAINT "directory_opportunity_sources_source_id_fkey" FOREIGN KEY (source_id) REFERENCES directory_sources(id) ON DELETE RESTRICT;
  END IF;
END
$compat_constraint_120$;

DO $compat_constraint_121$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_project_entities_entity_id_fkey' AND conrelid = 'public.directory_project_entities'::regclass) THEN
    ALTER TABLE "public"."directory_project_entities" ADD CONSTRAINT "directory_project_entities_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES directory_entities(id) ON DELETE RESTRICT;
  END IF;
END
$compat_constraint_121$;

DO $compat_constraint_122$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_project_entities_project_id_fkey' AND conrelid = 'public.directory_project_entities'::regclass) THEN
    ALTER TABLE "public"."directory_project_entities" ADD CONSTRAINT "directory_project_entities_project_id_fkey" FOREIGN KEY (project_id) REFERENCES directory_projects(id) ON DELETE CASCADE;
  END IF;
END
$compat_constraint_122$;

DO $compat_constraint_123$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_project_private_project_id_fkey' AND conrelid = 'public.directory_project_private'::regclass) THEN
    ALTER TABLE "public"."directory_project_private" ADD CONSTRAINT "directory_project_private_project_id_fkey" FOREIGN KEY (project_id) REFERENCES directory_projects(id) ON DELETE CASCADE;
  END IF;
END
$compat_constraint_123$;

DO $compat_constraint_124$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_project_sources_project_id_fkey' AND conrelid = 'public.directory_project_sources'::regclass) THEN
    ALTER TABLE "public"."directory_project_sources" ADD CONSTRAINT "directory_project_sources_project_id_fkey" FOREIGN KEY (project_id) REFERENCES directory_projects(id) ON DELETE CASCADE;
  END IF;
END
$compat_constraint_124$;

DO $compat_constraint_125$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_project_sources_source_id_fkey' AND conrelid = 'public.directory_project_sources'::regclass) THEN
    ALTER TABLE "public"."directory_project_sources" ADD CONSTRAINT "directory_project_sources_source_id_fkey" FOREIGN KEY (source_id) REFERENCES directory_sources(id) ON DELETE RESTRICT;
  END IF;
END
$compat_constraint_125$;

DO $compat_constraint_126$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_projects_area_id_fkey' AND conrelid = 'public.directory_projects'::regclass) THEN
    ALTER TABLE "public"."directory_projects" ADD CONSTRAINT "directory_projects_area_id_fkey" FOREIGN KEY (area_id) REFERENCES directory_areas(id) ON DELETE SET NULL;
  END IF;
END
$compat_constraint_126$;

DO $compat_constraint_127$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_listings_owner_id_fkey' AND conrelid = 'public.marketplace_listings'::regclass) THEN
    ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$compat_constraint_127$;

DO $compat_constraint_128$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_listings_reviewed_by_fkey' AND conrelid = 'public.marketplace_listings'::regclass) THEN
    ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);
  END IF;
END
$compat_constraint_128$;

DO $compat_constraint_129$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_payments_offer_id_fkey' AND conrelid = 'public.promotion_payments'::regclass) THEN
    ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_offer_id_fkey" FOREIGN KEY (offer_id) REFERENCES property_offers(id) ON DELETE RESTRICT;
  END IF;
END
$compat_constraint_129$;

DO $compat_constraint_130$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_offers_company_ad_id_fkey' AND conrelid = 'public.property_offers'::regclass) THEN
    ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_company_ad_id_fkey" FOREIGN KEY (company_ad_id) REFERENCES company_property_ads(id) ON DELETE SET NULL;
  END IF;
END
$compat_constraint_130$;

DO $compat_constraint_131$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_offers_owner_id_fkey' AND conrelid = 'public.property_offers'::regclass) THEN
    ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END
$compat_constraint_131$;

DO $compat_constraint_132$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_ads_owner_id_fkey' AND conrelid = 'public.supplier_ads'::regclass) THEN
    ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$compat_constraint_132$;

DO $compat_constraint_133$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_favorite_offers_offer_id_fkey' AND conrelid = 'public.user_favorite_offers'::regclass) THEN
    ALTER TABLE "public"."user_favorite_offers" ADD CONSTRAINT "user_favorite_offers_offer_id_fkey" FOREIGN KEY (offer_id) REFERENCES property_offers(id) ON DELETE CASCADE;
  END IF;
END
$compat_constraint_133$;

DO $compat_constraint_134$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_favorite_offers_user_id_fkey' AND conrelid = 'public.user_favorite_offers'::regclass) THEN
    ALTER TABLE "public"."user_favorite_offers" ADD CONSTRAINT "user_favorite_offers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$compat_constraint_134$;

-- 5. Add production indexes for new relations and missing indexes for marketplace_listings.
CREATE UNIQUE INDEX IF NOT EXISTS buyer_push_subscriptions_endpoint_uidx ON public.buyer_push_subscriptions USING btree (endpoint);

CREATE INDEX IF NOT EXISTS buyer_offer_alerts_offer_id_idx ON public.buyer_offer_alerts USING btree (offer_id);

CREATE INDEX IF NOT EXISTS buyer_offer_alerts_user_created_idx ON public.buyer_offer_alerts USING btree (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS buyer_push_subscriptions_user_idx ON public.buyer_push_subscriptions USING btree (user_id);

CREATE INDEX IF NOT EXISTS company_profiles_owner_id_idx ON public.company_profiles USING btree (owner_id);

CREATE INDEX IF NOT EXISTS company_profiles_reviewed_by_idx ON public.company_profiles USING btree (reviewed_by);

CREATE INDEX IF NOT EXISTS company_property_ads_owner_id_idx ON public.company_property_ads USING btree (owner_id);

CREATE INDEX IF NOT EXISTS directory_areas_parent_idx ON public.directory_areas USING btree (parent_id);

CREATE INDEX IF NOT EXISTS directory_entities_area_idx ON public.directory_entities USING btree (primary_area_id);

CREATE INDEX IF NOT EXISTS directory_entities_public_idx ON public.directory_entities USING btree (verification_status, public_visible, entity_type);

CREATE INDEX IF NOT EXISTS directory_entity_areas_area_idx ON public.directory_entity_areas USING btree (area_id);

CREATE INDEX IF NOT EXISTS directory_entity_sources_source_idx ON public.directory_entity_sources USING btree (source_id);

CREATE INDEX IF NOT EXISTS directory_opportunity_sources_source_idx ON public.directory_opportunity_sources USING btree (source_id);

CREATE INDEX IF NOT EXISTS directory_project_entities_entity_idx ON public.directory_project_entities USING btree (entity_id);

CREATE INDEX IF NOT EXISTS directory_project_sources_source_idx ON public.directory_project_sources USING btree (source_id);

CREATE INDEX IF NOT EXISTS directory_projects_area_idx ON public.directory_projects USING btree (area_id);

CREATE INDEX IF NOT EXISTS directory_projects_public_idx ON public.directory_projects USING btree (verification_status, public_visible, project_type);

CREATE INDEX IF NOT EXISTS directory_sources_public_idx ON public.directory_sources USING btree (is_public, accessed_at DESC);

CREATE INDEX IF NOT EXISTS directory_sources_source_url_idx ON public.directory_sources USING btree (source_url);

CREATE INDEX IF NOT EXISTS marketplace_listings_city_area_approved_idx ON public.marketplace_listings USING btree (city, area) WHERE (status = 'approved'::text);

CREATE INDEX IF NOT EXISTS marketplace_listings_owner_created_idx ON public.marketplace_listings USING btree (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS marketplace_listings_public_category_created_idx ON public.marketplace_listings USING btree (category, created_at DESC) WHERE (status = 'approved'::text);

CREATE INDEX IF NOT EXISTS marketplace_listings_reviewed_by_idx ON public.marketplace_listings USING btree (reviewed_by);

CREATE INDEX IF NOT EXISTS promotion_payments_offer_id_idx ON public.promotion_payments USING btree (offer_id);

CREATE INDEX IF NOT EXISTS property_offers_city_area_available_idx ON public.property_offers USING btree (city, area) WHERE (status = 'available'::text);

CREATE INDEX IF NOT EXISTS property_offers_company_ad_id_idx ON public.property_offers USING btree (company_ad_id);

CREATE INDEX IF NOT EXISTS property_offers_governorate_idx ON public.property_offers USING btree (governorate);

CREATE INDEX IF NOT EXISTS property_offers_owner_id_idx ON public.property_offers USING btree (owner_id);

CREATE INDEX IF NOT EXISTS property_offers_status_idx ON public.property_offers USING btree (status);

CREATE INDEX IF NOT EXISTS supplier_ads_owner_id_idx ON public.supplier_ads USING btree (owner_id);

CREATE INDEX IF NOT EXISTS user_favorite_offers_offer_id_idx ON public.user_favorite_offers USING btree (offer_id);

CREATE INDEX IF NOT EXISTS user_favorite_offers_user_created_idx ON public.user_favorite_offers USING btree (user_id, created_at DESC);

-- 6. Add only functions absent by schema/name. Existing test functions are intentionally untouched.
CREATE OR REPLACE FUNCTION private.layan_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select auth.uid() is not null
     and exists (select 1 from private.layan_admins a where a.user_id = auth.uid());
$function$
;

CREATE OR REPLACE FUNCTION private.layan_activate_supplier_ad(p_ad_id uuid, p_days integer, p_price numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ad public.supplier_ads%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from private.layan_admins a where a.user_id = auth.uid()
  ) then
    raise exception 'غير مصرح: يلزم حساب إدارة معتمد';
  end if;

  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'مدة الإعلان يجب أن تكون من يوم إلى 365 يومًا';
  end if;

  if p_price is null or p_price < 0 then
    raise exception 'السعر المتفق عليه غير صحيح';
  end if;

  select * into v_ad
  from public.supplier_ads
  where id = p_ad_id
  for update;

  if not found then
    raise exception 'الإعلان غير موجود';
  end if;

  if v_ad.status <> 'pending' then
    raise exception 'لا يمكن تفعيل إعلان حالته ليست قيد المراجعة';
  end if;

  update public.supplier_ads
  set status = 'active',
      price = p_price,
      requested_price = p_price,
      requested_days = p_days,
      starts_at = now(),
      ends_at = now() + make_interval(days => p_days),
      updated_at = now()
  where id = p_ad_id;

  return jsonb_build_object(
    'success', true,
    'ad_id', p_ad_id,
    'status', 'active',
    'duration_days', p_days,
    'agreed_price_egp', p_price
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.layan_admin_list_company_profiles()
 RETURNS SETOF company_profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not exists (
    select 1 from private.layan_admins a where a.user_id = auth.uid()
  ) then
    raise exception 'غير مصرح: يلزم حساب إدارة معتمد' using errcode = '42501';
  end if;

  return query
  select cp.*
  from public.company_profiles cp
  where cp.status = 'pending'
     or (cp.status = 'active' and cp.update_status = 'pending' and cp.pending_update is not null)
  order by cp.created_at asc;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.layan_admin_review_property_offer(p_id bigint, p_action text, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not exists (
    select 1 from private.layan_admins a where a.user_id = auth.uid()
  ) then
    raise exception 'غير مسموح' using errcode = '42501';
  end if;

  if p_action not in ('approve','reject') then
    raise exception 'إجراء غير صالح';
  end if;

  if p_action = 'reject' and coalesce(length(trim(p_notes)),0) < 3 then
    raise exception 'اكتب سببًا واضحًا للرفض';
  end if;

  update public.property_offers
  set status = case when p_action = 'approve' then 'available' else status end,
      verification_status = case when p_action = 'approve' then 'verified' else 'rejected' end,
      verification_notes = case when p_action = 'approve' then null else left(trim(p_notes),500) end,
      verified_at = case when p_action = 'approve' then now() else null end
  where id = p_id
    and status = 'pending'
    and verification_status in ('pending','under_review');

  if not found then
    raise exception 'الإعلان غير موجود أو تمت مراجعته بالفعل';
  end if;
end
$function$
;

CREATE OR REPLACE FUNCTION public.directory_require_public_source()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare has_source boolean := false;
begin
  if new.public_visible and new.verification_status = 'published' then
    if tg_table_name = 'directory_entities' then
      select exists(
        select 1 from public.directory_entity_sources es
        join public.directory_sources s on s.id=es.source_id
        where es.entity_id=new.id and s.is_public
      ) into has_source;
    elsif tg_table_name = 'directory_projects' then
      select exists(
        select 1 from public.directory_project_sources ps
        join public.directory_sources s on s.id=ps.source_id
        where ps.project_id=new.id and s.is_public
      ) into has_source;
    elsif tg_table_name = 'directory_opportunities' then
      select exists(
        select 1 from public.directory_opportunity_sources os
        join public.directory_sources s on s.id=os.source_id
        where os.opportunity_id=new.id and s.is_public
      ) into has_source;
    else
      has_source := true;
    end if;
    if not has_source then
      raise exception 'لا يمكن نشر سجل الدليل دون ربط مصدر عام واحد على الأقل.';
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_company_property_ad_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_owner uuid;
  v_status text;
  v_count bigint;
begin
  if new.company_ad_id is null then
    return new;
  end if;

  -- Serialize inserts for this one company ad to prevent concurrent
  -- requests from both observing a count below three.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.company_ad_id::text, 0)
  );

  select c.owner_id, c.status
    into v_owner, v_status
    from public.company_property_ads c
   where c.id = new.company_ad_id;

  if not found then
    raise exception 'إعلان الشركة غير موجود. ابدأ طلب إعلان شركة جديد.';
  end if;

  if v_owner is distinct from new.owner_id then
    raise exception 'لا يمكنك إضافة عقار إلى إعلان شركة لا تملكه.';
  end if;

  if v_status not in ('pending','active') then
    raise exception 'إعلان الشركة غير نشط. أرسل طلب إعلان شركة جديدًا.';
  end if;

  select pg_catalog.count(*)
    into v_count
    from public.property_offers p
   where p.company_ad_id = new.company_ad_id;

  if v_count >= 3 then
    raise exception 'وصل إعلان الشركة إلى الحد الأقصى: 3 عقارات في الإعلان الواحد.';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_layan_offer_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid;
  owned_count integer;
begin
  current_user_id := (select auth.uid());
  if current_user_id is null then
    raise exception 'يلزم تسجيل الدخول قبل إضافة عرض.';
  end if;
  if new.owner_id is distinct from current_user_id then
    raise exception 'لا يمكن إضافة عرض لحساب مستخدم آخر.';
  end if;
  new.status := 'pending';
  select count(*) into owned_count
  from public.property_offers
  where owner_id = current_user_id;
  if owned_count >= 3 then
    raise exception 'وصلت للحد الأقصى: 3 عروض لكل حساب في الفترة التجريبية.';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_property_offer_promotion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin if tg_op = 'INSERT' then new.is_featured := false; new.featured_until := null; if coalesce(new.featured_requested, false) then new.promotion_status := 'requested'; else new.promotion_status := 'none'; end if; end if; return new; end; $function$
;

CREATE OR REPLACE FUNCTION public.layan_admin_list_company_profiles()
 RETURNS SETOF company_profiles
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select * from private.layan_admin_list_company_profiles();
$function$
;

CREATE OR REPLACE FUNCTION public.layan_approve_free_trial_ad(p_ad_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_ad public.supplier_ads%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from private.layan_admins a where a.user_id = auth.uid()
  ) then
    raise exception 'غير مصرح: يلزم حساب إدارة معتمد';
  end if;

  select * into v_ad
  from public.supplier_ads
  where id = p_ad_id
  for update;

  if not found then
    raise exception 'الإعلان غير موجود';
  end if;
  if v_ad.status <> 'pending' then
    raise exception 'لا يمكن اعتماد إعلان حالته ليست قيد المراجعة';
  end if;
  if v_ad.plan_code <> 'trial_30' or v_ad.requested_days <> 30 or v_ad.requested_price <> 0 then
    raise exception 'هذه العملية مخصصة للتجربة المجانية فقط';
  end if;

  update public.supplier_ads
  set status = 'active',
      price = 0,
      starts_at = now(),
      ends_at = now() + interval '30 days',
      free_trial_started_at = now(),
      free_trial_ends_at = now() + interval '30 days',
      updated_at = now()
  where id = p_ad_id;

  return jsonb_build_object('success', true, 'ad_id', p_ad_id, 'status', 'active', 'trial_days', 30);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_company_profiles_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin new.updated_at = now(); return new; end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_supplier_ad_free_trial()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.free_trial_started_at := now();
  new.free_trial_ends_at := now() + interval '30 days';
  return new;
end;
$function$
;

-- 7. Add production security-invoker views (the test project currently has none).
CREATE OR REPLACE VIEW "public"."company_profiles_public" WITH (security_invoker=true) AS
 SELECT id,
    company_name,
    category,
    description,
    services,
    city,
    logo_url
   FROM company_profiles
  WHERE status = 'active'::text;

CREATE OR REPLACE VIEW "public"."public_active_supplier_ads" WITH (security_invoker=true) AS
 SELECT id,
    business_name,
    category,
    title,
    description,
    image_url,
    target_url,
    contact_phone,
    created_at
   FROM supplier_ads
  WHERE status = 'active'::text;

-- 8. Enable RLS on each newly created application table.
ALTER TABLE "private"."layan_admins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."project_decisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."buyer_offer_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."buyer_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."buyer_push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."buyer_push_vapid_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."company_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."company_property_ads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."directory_areas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."directory_change_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."directory_entities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."directory_entity_areas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."directory_entity_private" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."directory_entity_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."directory_opportunities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."directory_opportunity_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."directory_project_entities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."directory_project_private" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."directory_project_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."directory_projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."directory_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."marketplace_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."partner_ad_slots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."promotion_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."property_offers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."supplier_ads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_favorite_offers" ENABLE ROW LEVEL SECURITY;

-- 9. Add application triggers only on relations absent from the test project.
DO $compat_trigger_0$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='company_profiles_owner_update_guard' AND tgrelid='public.company_profiles'::regclass AND NOT tgisinternal) THEN
    CREATE TRIGGER company_profiles_owner_update_guard BEFORE UPDATE ON "public"."company_profiles" FOR EACH ROW EXECUTE FUNCTION guard_company_owner_update();
  END IF;
END
$compat_trigger_0$;

DO $compat_trigger_1$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='company_profiles_set_updated_at' AND tgrelid='public.company_profiles'::regclass AND NOT tgisinternal) THEN
    CREATE TRIGGER company_profiles_set_updated_at BEFORE UPDATE ON "public"."company_profiles" FOR EACH ROW EXECUTE FUNCTION set_company_profiles_updated_at();
  END IF;
END
$compat_trigger_1$;

DO $compat_trigger_2$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='directory_entities_require_source' AND tgrelid='public.directory_entities'::regclass AND NOT tgisinternal) THEN
    CREATE TRIGGER directory_entities_require_source BEFORE INSERT OR UPDATE OF public_visible, verification_status ON "public"."directory_entities" FOR EACH ROW EXECUTE FUNCTION directory_require_public_source();
  END IF;
END
$compat_trigger_2$;

DO $compat_trigger_3$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='directory_opportunities_require_source' AND tgrelid='public.directory_opportunities'::regclass AND NOT tgisinternal) THEN
    CREATE TRIGGER directory_opportunities_require_source BEFORE INSERT OR UPDATE OF public_visible, verification_status ON "public"."directory_opportunities" FOR EACH ROW EXECUTE FUNCTION directory_require_public_source();
  END IF;
END
$compat_trigger_3$;

DO $compat_trigger_4$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='directory_projects_require_source' AND tgrelid='public.directory_projects'::regclass AND NOT tgisinternal) THEN
    CREATE TRIGGER directory_projects_require_source BEFORE INSERT OR UPDATE OF public_visible, verification_status ON "public"."directory_projects" FOR EACH ROW EXECUTE FUNCTION directory_require_public_source();
  END IF;
END
$compat_trigger_4$;

DO $compat_trigger_5$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='a_property_offer_promotion_guard' AND tgrelid='public.property_offers'::regclass AND NOT tgisinternal) THEN
    CREATE TRIGGER a_property_offer_promotion_guard BEFORE INSERT ON "public"."property_offers" FOR EACH ROW EXECUTE FUNCTION guard_property_offer_promotion();
  END IF;
END
$compat_trigger_5$;

DO $compat_trigger_6$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='c_property_offer_company_limit' AND tgrelid='public.property_offers'::regclass AND NOT tgisinternal) THEN
    CREATE TRIGGER c_property_offer_company_limit BEFORE INSERT ON "public"."property_offers" FOR EACH ROW EXECUTE FUNCTION enforce_company_property_ad_limit();
  END IF;
END
$compat_trigger_6$;

-- 10. Add production RLS policies to new relations; preserve every existing marketplace policy.
DO $compat_policy_0$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='buyer_offer_alerts' AND policyname='Users can create own buyer alerts') THEN
    CREATE POLICY "Users can create own buyer alerts" ON "public"."buyer_offer_alerts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
  END IF;
END
$compat_policy_0$;

DO $compat_policy_1$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='buyer_offer_alerts' AND policyname='Users can delete own buyer alerts') THEN
    CREATE POLICY "Users can delete own buyer alerts" ON "public"."buyer_offer_alerts" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id));
  END IF;
END
$compat_policy_1$;

DO $compat_policy_2$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='buyer_offer_alerts' AND policyname='Users can read own buyer alerts') THEN
    CREATE POLICY "Users can read own buyer alerts" ON "public"."buyer_offer_alerts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id));
  END IF;
END
$compat_policy_2$;

DO $compat_policy_3$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='buyer_offer_alerts' AND policyname='Users can update own buyer alerts') THEN
    CREATE POLICY "Users can update own buyer alerts" ON "public"."buyer_offer_alerts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
  END IF;
END
$compat_policy_3$;

DO $compat_policy_4$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='buyer_preferences' AND policyname='buyer_preferences_owner_access') THEN
    CREATE POLICY "buyer_preferences_owner_access" ON "public"."buyer_preferences" AS PERMISSIVE FOR ALL TO "authenticated" USING ((owner_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));
  END IF;
END
$compat_policy_4$;

DO $compat_policy_5$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_profiles' AND policyname='company_profiles_admin_read') THEN
    CREATE POLICY "company_profiles_admin_read" ON "public"."company_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (layan_is_admin());
  END IF;
END
$compat_policy_5$;

DO $compat_policy_6$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_profiles' AND policyname='company_profiles_owner_submit') THEN
    CREATE POLICY "company_profiles_owner_submit" ON "public"."company_profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text)));
  END IF;
END
$compat_policy_6$;

DO $compat_policy_7$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_profiles' AND policyname='company_profiles_read_scope') THEN
    CREATE POLICY "company_profiles_read_scope" ON "public"."company_profiles" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (((status = 'active'::text) OR (owner_id = ( SELECT auth.uid() AS uid))));
  END IF;
END
$compat_policy_7$;

DO $compat_policy_8$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_profiles' AND policyname='company_profiles_update_scope') THEN
    CREATE POLICY "company_profiles_update_scope" ON "public"."company_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((layan_is_admin() OR ((owner_id = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['pending'::text, 'needs_changes'::text, 'rejected'::text, 'active'::text]))))) WITH CHECK ((layan_is_admin() OR ((owner_id = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['pending'::text, 'needs_changes'::text, 'rejected'::text, 'active'::text])) AND ((status = 'active'::text) OR (reviewed_by IS NULL)))));
  END IF;
END
$compat_policy_8$;

DO $compat_policy_9$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_property_ads' AND policyname='company_property_ads_admin_update') THEN
    CREATE POLICY "company_property_ads_admin_update" ON "public"."company_property_ads" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (layan_is_admin()) WITH CHECK (layan_is_admin());
  END IF;
END
$compat_policy_9$;

DO $compat_policy_10$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_property_ads' AND policyname='company_property_ads_owner_submit') THEN
    CREATE POLICY "company_property_ads_owner_submit" ON "public"."company_property_ads" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text)));
  END IF;
END
$compat_policy_10$;

DO $compat_policy_11$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_property_ads' AND policyname='company_property_ads_read_scope') THEN
    CREATE POLICY "company_property_ads_read_scope" ON "public"."company_property_ads" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((owner_id = ( SELECT auth.uid() AS uid)) OR layan_is_admin()));
  END IF;
END
$compat_policy_11$;

DO $compat_policy_12$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_areas' AND policyname='directory_areas_admin_delete') THEN
    CREATE POLICY "directory_areas_admin_delete" ON "public"."directory_areas" AS PERMISSIVE FOR DELETE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_12$;

DO $compat_policy_13$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_areas' AND policyname='directory_areas_admin_insert') THEN
    CREATE POLICY "directory_areas_admin_insert" ON "public"."directory_areas" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_13$;

DO $compat_policy_14$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_areas' AND policyname='directory_areas_admin_update') THEN
    CREATE POLICY "directory_areas_admin_update" ON "public"."directory_areas" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin)) WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_14$;

DO $compat_policy_15$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_areas' AND policyname='directory_areas_anon_read') THEN
    CREATE POLICY "directory_areas_anon_read" ON "public"."directory_areas" AS PERMISSIVE FOR SELECT TO "anon" USING ((is_active AND public_visible AND (verification_status = 'published'::text)));
  END IF;
END
$compat_policy_15$;

DO $compat_policy_16$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_areas' AND policyname='directory_areas_authenticated_read') THEN
    CREATE POLICY "directory_areas_authenticated_read" ON "public"."directory_areas" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((is_active AND public_visible AND (verification_status = 'published'::text)) OR ( SELECT layan_is_admin() AS layan_is_admin)));
  END IF;
END
$compat_policy_16$;

DO $compat_policy_17$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_change_log' AND policyname='directory_change_log_admin_all') THEN
    CREATE POLICY "directory_change_log_admin_all" ON "public"."directory_change_log" AS PERMISSIVE FOR ALL TO "authenticated" USING (layan_is_admin()) WITH CHECK (layan_is_admin());
  END IF;
END
$compat_policy_17$;

DO $compat_policy_18$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_entities' AND policyname='directory_entities_admin_delete') THEN
    CREATE POLICY "directory_entities_admin_delete" ON "public"."directory_entities" AS PERMISSIVE FOR DELETE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_18$;

DO $compat_policy_19$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_entities' AND policyname='directory_entities_admin_insert') THEN
    CREATE POLICY "directory_entities_admin_insert" ON "public"."directory_entities" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_19$;

DO $compat_policy_20$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_entities' AND policyname='directory_entities_admin_update') THEN
    CREATE POLICY "directory_entities_admin_update" ON "public"."directory_entities" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin)) WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_20$;

DO $compat_policy_21$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_entities' AND policyname='directory_entities_anon_read') THEN
    CREATE POLICY "directory_entities_anon_read" ON "public"."directory_entities" AS PERMISSIVE FOR SELECT TO "anon" USING ((public_visible AND (verification_status = 'published'::text)));
  END IF;
END
$compat_policy_21$;

DO $compat_policy_22$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_entities' AND policyname='directory_entities_authenticated_read') THEN
    CREATE POLICY "directory_entities_authenticated_read" ON "public"."directory_entities" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((public_visible AND (verification_status = 'published'::text)) OR ( SELECT layan_is_admin() AS layan_is_admin)));
  END IF;
END
$compat_policy_22$;

DO $compat_policy_23$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_entity_areas' AND policyname='directory_entity_areas_admin_all') THEN
    CREATE POLICY "directory_entity_areas_admin_all" ON "public"."directory_entity_areas" AS PERMISSIVE FOR ALL TO "authenticated" USING (layan_is_admin()) WITH CHECK (layan_is_admin());
  END IF;
END
$compat_policy_23$;

DO $compat_policy_24$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_entity_private' AND policyname='directory_entity_private_admin_all') THEN
    CREATE POLICY "directory_entity_private_admin_all" ON "public"."directory_entity_private" AS PERMISSIVE FOR ALL TO "authenticated" USING (layan_is_admin()) WITH CHECK (layan_is_admin());
  END IF;
END
$compat_policy_24$;

DO $compat_policy_25$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_entity_sources' AND policyname='directory_entity_sources_admin_delete') THEN
    CREATE POLICY "directory_entity_sources_admin_delete" ON "public"."directory_entity_sources" AS PERMISSIVE FOR DELETE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_25$;

DO $compat_policy_26$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_entity_sources' AND policyname='directory_entity_sources_admin_insert') THEN
    CREATE POLICY "directory_entity_sources_admin_insert" ON "public"."directory_entity_sources" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_26$;

DO $compat_policy_27$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_entity_sources' AND policyname='directory_entity_sources_admin_update') THEN
    CREATE POLICY "directory_entity_sources_admin_update" ON "public"."directory_entity_sources" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin)) WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_27$;

DO $compat_policy_28$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_entity_sources' AND policyname='directory_entity_sources_anon_read') THEN
    CREATE POLICY "directory_entity_sources_anon_read" ON "public"."directory_entity_sources" AS PERMISSIVE FOR SELECT TO "anon" USING (((EXISTS ( SELECT 1
   FROM directory_entities e
  WHERE ((e.id = directory_entity_sources.entity_id) AND e.public_visible AND (e.verification_status = 'published'::text)))) AND (EXISTS ( SELECT 1
   FROM directory_sources s
  WHERE ((s.id = directory_entity_sources.source_id) AND s.is_public)))));
  END IF;
END
$compat_policy_28$;

DO $compat_policy_29$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_entity_sources' AND policyname='directory_entity_sources_authenticated_read') THEN
    CREATE POLICY "directory_entity_sources_authenticated_read" ON "public"."directory_entity_sources" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((((EXISTS ( SELECT 1
   FROM directory_entities e
  WHERE ((e.id = directory_entity_sources.entity_id) AND e.public_visible AND (e.verification_status = 'published'::text)))) AND (EXISTS ( SELECT 1
   FROM directory_sources s
  WHERE ((s.id = directory_entity_sources.source_id) AND s.is_public)))) OR ( SELECT layan_is_admin() AS layan_is_admin)));
  END IF;
END
$compat_policy_29$;

DO $compat_policy_30$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_opportunities' AND policyname='directory_opportunities_admin_delete') THEN
    CREATE POLICY "directory_opportunities_admin_delete" ON "public"."directory_opportunities" AS PERMISSIVE FOR DELETE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_30$;

DO $compat_policy_31$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_opportunities' AND policyname='directory_opportunities_admin_insert') THEN
    CREATE POLICY "directory_opportunities_admin_insert" ON "public"."directory_opportunities" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_31$;

DO $compat_policy_32$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_opportunities' AND policyname='directory_opportunities_admin_update') THEN
    CREATE POLICY "directory_opportunities_admin_update" ON "public"."directory_opportunities" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin)) WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_32$;

DO $compat_policy_33$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_opportunities' AND policyname='directory_opportunities_anon_read') THEN
    CREATE POLICY "directory_opportunities_anon_read" ON "public"."directory_opportunities" AS PERMISSIVE FOR SELECT TO "anon" USING ((public_visible AND (verification_status = 'published'::text)));
  END IF;
END
$compat_policy_33$;

DO $compat_policy_34$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_opportunities' AND policyname='directory_opportunities_authenticated_read') THEN
    CREATE POLICY "directory_opportunities_authenticated_read" ON "public"."directory_opportunities" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((public_visible AND (verification_status = 'published'::text)) OR ( SELECT layan_is_admin() AS layan_is_admin)));
  END IF;
END
$compat_policy_34$;

DO $compat_policy_35$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_opportunity_sources' AND policyname='directory_opportunity_sources_admin_delete') THEN
    CREATE POLICY "directory_opportunity_sources_admin_delete" ON "public"."directory_opportunity_sources" AS PERMISSIVE FOR DELETE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_35$;

DO $compat_policy_36$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_opportunity_sources' AND policyname='directory_opportunity_sources_admin_insert') THEN
    CREATE POLICY "directory_opportunity_sources_admin_insert" ON "public"."directory_opportunity_sources" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_36$;

DO $compat_policy_37$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_opportunity_sources' AND policyname='directory_opportunity_sources_admin_update') THEN
    CREATE POLICY "directory_opportunity_sources_admin_update" ON "public"."directory_opportunity_sources" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin)) WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_37$;

DO $compat_policy_38$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_opportunity_sources' AND policyname='directory_opportunity_sources_anon_read') THEN
    CREATE POLICY "directory_opportunity_sources_anon_read" ON "public"."directory_opportunity_sources" AS PERMISSIVE FOR SELECT TO "anon" USING (((EXISTS ( SELECT 1
   FROM directory_opportunities o
  WHERE ((o.id = directory_opportunity_sources.opportunity_id) AND o.public_visible AND (o.verification_status = 'published'::text)))) AND (EXISTS ( SELECT 1
   FROM directory_sources s
  WHERE ((s.id = directory_opportunity_sources.source_id) AND s.is_public)))));
  END IF;
END
$compat_policy_38$;

DO $compat_policy_39$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_opportunity_sources' AND policyname='directory_opportunity_sources_authenticated_read') THEN
    CREATE POLICY "directory_opportunity_sources_authenticated_read" ON "public"."directory_opportunity_sources" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((((EXISTS ( SELECT 1
   FROM directory_opportunities o
  WHERE ((o.id = directory_opportunity_sources.opportunity_id) AND o.public_visible AND (o.verification_status = 'published'::text)))) AND (EXISTS ( SELECT 1
   FROM directory_sources s
  WHERE ((s.id = directory_opportunity_sources.source_id) AND s.is_public)))) OR ( SELECT layan_is_admin() AS layan_is_admin)));
  END IF;
END
$compat_policy_39$;

DO $compat_policy_40$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_project_entities' AND policyname='directory_project_entities_admin_delete') THEN
    CREATE POLICY "directory_project_entities_admin_delete" ON "public"."directory_project_entities" AS PERMISSIVE FOR DELETE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_40$;

DO $compat_policy_41$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_project_entities' AND policyname='directory_project_entities_admin_insert') THEN
    CREATE POLICY "directory_project_entities_admin_insert" ON "public"."directory_project_entities" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_41$;

DO $compat_policy_42$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_project_entities' AND policyname='directory_project_entities_admin_update') THEN
    CREATE POLICY "directory_project_entities_admin_update" ON "public"."directory_project_entities" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin)) WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_42$;

DO $compat_policy_43$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_project_entities' AND policyname='directory_project_entities_anon_read') THEN
    CREATE POLICY "directory_project_entities_anon_read" ON "public"."directory_project_entities" AS PERMISSIVE FOR SELECT TO "anon" USING (((EXISTS ( SELECT 1
   FROM directory_projects p
  WHERE ((p.id = directory_project_entities.project_id) AND p.public_visible AND (p.verification_status = 'published'::text)))) AND (EXISTS ( SELECT 1
   FROM directory_entities e
  WHERE ((e.id = directory_project_entities.entity_id) AND e.public_visible AND (e.verification_status = 'published'::text))))));
  END IF;
END
$compat_policy_43$;

DO $compat_policy_44$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_project_entities' AND policyname='directory_project_entities_authenticated_read') THEN
    CREATE POLICY "directory_project_entities_authenticated_read" ON "public"."directory_project_entities" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((((EXISTS ( SELECT 1
   FROM directory_projects p
  WHERE ((p.id = directory_project_entities.project_id) AND p.public_visible AND (p.verification_status = 'published'::text)))) AND (EXISTS ( SELECT 1
   FROM directory_entities e
  WHERE ((e.id = directory_project_entities.entity_id) AND e.public_visible AND (e.verification_status = 'published'::text))))) OR ( SELECT layan_is_admin() AS layan_is_admin)));
  END IF;
END
$compat_policy_44$;

DO $compat_policy_45$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_project_private' AND policyname='directory_project_private_admin_all') THEN
    CREATE POLICY "directory_project_private_admin_all" ON "public"."directory_project_private" AS PERMISSIVE FOR ALL TO "authenticated" USING (layan_is_admin()) WITH CHECK (layan_is_admin());
  END IF;
END
$compat_policy_45$;

DO $compat_policy_46$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_project_sources' AND policyname='directory_project_sources_admin_delete') THEN
    CREATE POLICY "directory_project_sources_admin_delete" ON "public"."directory_project_sources" AS PERMISSIVE FOR DELETE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_46$;

DO $compat_policy_47$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_project_sources' AND policyname='directory_project_sources_admin_insert') THEN
    CREATE POLICY "directory_project_sources_admin_insert" ON "public"."directory_project_sources" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_47$;

DO $compat_policy_48$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_project_sources' AND policyname='directory_project_sources_admin_update') THEN
    CREATE POLICY "directory_project_sources_admin_update" ON "public"."directory_project_sources" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin)) WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_48$;

DO $compat_policy_49$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_project_sources' AND policyname='directory_project_sources_anon_read') THEN
    CREATE POLICY "directory_project_sources_anon_read" ON "public"."directory_project_sources" AS PERMISSIVE FOR SELECT TO "anon" USING (((EXISTS ( SELECT 1
   FROM directory_projects p
  WHERE ((p.id = directory_project_sources.project_id) AND p.public_visible AND (p.verification_status = 'published'::text)))) AND (EXISTS ( SELECT 1
   FROM directory_sources s
  WHERE ((s.id = directory_project_sources.source_id) AND s.is_public)))));
  END IF;
END
$compat_policy_49$;

DO $compat_policy_50$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_project_sources' AND policyname='directory_project_sources_authenticated_read') THEN
    CREATE POLICY "directory_project_sources_authenticated_read" ON "public"."directory_project_sources" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((((EXISTS ( SELECT 1
   FROM directory_projects p
  WHERE ((p.id = directory_project_sources.project_id) AND p.public_visible AND (p.verification_status = 'published'::text)))) AND (EXISTS ( SELECT 1
   FROM directory_sources s
  WHERE ((s.id = directory_project_sources.source_id) AND s.is_public)))) OR ( SELECT layan_is_admin() AS layan_is_admin)));
  END IF;
END
$compat_policy_50$;

DO $compat_policy_51$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_projects' AND policyname='directory_projects_admin_delete') THEN
    CREATE POLICY "directory_projects_admin_delete" ON "public"."directory_projects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_51$;

DO $compat_policy_52$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_projects' AND policyname='directory_projects_admin_insert') THEN
    CREATE POLICY "directory_projects_admin_insert" ON "public"."directory_projects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_52$;

DO $compat_policy_53$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_projects' AND policyname='directory_projects_admin_update') THEN
    CREATE POLICY "directory_projects_admin_update" ON "public"."directory_projects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin)) WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_53$;

DO $compat_policy_54$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_projects' AND policyname='directory_projects_anon_read') THEN
    CREATE POLICY "directory_projects_anon_read" ON "public"."directory_projects" AS PERMISSIVE FOR SELECT TO "anon" USING ((public_visible AND (verification_status = 'published'::text)));
  END IF;
END
$compat_policy_54$;

DO $compat_policy_55$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_projects' AND policyname='directory_projects_authenticated_read') THEN
    CREATE POLICY "directory_projects_authenticated_read" ON "public"."directory_projects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((public_visible AND (verification_status = 'published'::text)) OR ( SELECT layan_is_admin() AS layan_is_admin)));
  END IF;
END
$compat_policy_55$;

DO $compat_policy_56$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_sources' AND policyname='directory_sources_admin_delete') THEN
    CREATE POLICY "directory_sources_admin_delete" ON "public"."directory_sources" AS PERMISSIVE FOR DELETE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_56$;

DO $compat_policy_57$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_sources' AND policyname='directory_sources_admin_insert') THEN
    CREATE POLICY "directory_sources_admin_insert" ON "public"."directory_sources" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_57$;

DO $compat_policy_58$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_sources' AND policyname='directory_sources_admin_update') THEN
    CREATE POLICY "directory_sources_admin_update" ON "public"."directory_sources" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin)) WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));
  END IF;
END
$compat_policy_58$;

DO $compat_policy_59$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_sources' AND policyname='directory_sources_anon_read') THEN
    CREATE POLICY "directory_sources_anon_read" ON "public"."directory_sources" AS PERMISSIVE FOR SELECT TO "anon" USING (is_public);
  END IF;
END
$compat_policy_59$;

DO $compat_policy_60$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='directory_sources' AND policyname='directory_sources_authenticated_read') THEN
    CREATE POLICY "directory_sources_authenticated_read" ON "public"."directory_sources" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_public OR ( SELECT layan_is_admin() AS layan_is_admin)));
  END IF;
END
$compat_policy_60$;

DO $compat_policy_61$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_categories' AND policyname='Public can read active marketplace categories') THEN
    CREATE POLICY "Public can read active marketplace categories" ON "public"."marketplace_categories" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ((is_active = true));
  END IF;
END
$compat_policy_61$;

DO $compat_policy_62$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='partner_ad_slots' AND policyname='partner_ad_slots_admin_update') THEN
    CREATE POLICY "partner_ad_slots_admin_update" ON "public"."partner_ad_slots" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (layan_is_admin()) WITH CHECK (layan_is_admin());
  END IF;
END
$compat_policy_62$;

DO $compat_policy_63$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='partner_ad_slots' AND policyname='partner_ad_slots_authenticated_read') THEN
    CREATE POLICY "partner_ad_slots_authenticated_read" ON "public"."partner_ad_slots" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((status = 'active'::text) OR layan_is_admin()));
  END IF;
END
$compat_policy_63$;

DO $compat_policy_64$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='partner_ad_slots' AND policyname='partner_ad_slots_public_read') THEN
    CREATE POLICY "partner_ad_slots_public_read" ON "public"."partner_ad_slots" AS PERMISSIVE FOR SELECT TO "anon" USING ((status = 'active'::text));
  END IF;
END
$compat_policy_64$;

DO $compat_policy_65$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='promotion_payments' AND policyname='promotion_payments_admin_read') THEN
    CREATE POLICY "promotion_payments_admin_read" ON "public"."promotion_payments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (layan_is_admin());
  END IF;
END
$compat_policy_65$;

DO $compat_policy_66$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='property_offers' AND policyname='property_offers_authenticated_read') THEN
    CREATE POLICY "property_offers_authenticated_read" ON "public"."property_offers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((status = 'available'::text) OR (owner_id = ( SELECT auth.uid() AS uid)) OR ((status = 'pending'::text) AND layan_is_admin())));
  END IF;
END
$compat_policy_66$;

DO $compat_policy_67$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='property_offers' AND policyname='property_offers_owner_submit') THEN
    CREATE POLICY "property_offers_owner_submit" ON "public"."property_offers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text) AND (is_featured = false) AND (verification_status = 'pending'::text) AND (developer_approval_status = 'unknown'::text) AND (verified_at IS NULL) AND (featured_until IS NULL) AND (((featured_requested = false) AND (promotion_status = 'none'::text)) OR ((featured_requested = true) AND (promotion_status = 'requested'::text)))));
  END IF;
END
$compat_policy_67$;

DO $compat_policy_68$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='property_offers' AND policyname='property_offers_public_read') THEN
    CREATE POLICY "property_offers_public_read" ON "public"."property_offers" AS PERMISSIVE FOR SELECT TO "anon" USING ((status = 'available'::text));
  END IF;
END
$compat_policy_68$;

DO $compat_policy_69$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_ads' AND policyname='supplier_ads_admin_update') THEN
    CREATE POLICY "supplier_ads_admin_update" ON "public"."supplier_ads" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (layan_is_admin()) WITH CHECK (layan_is_admin());
  END IF;
END
$compat_policy_69$;

DO $compat_policy_70$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_ads' AND policyname='supplier_ads_authenticated_read') THEN
    CREATE POLICY "supplier_ads_authenticated_read" ON "public"."supplier_ads" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((status = 'active'::text) OR (owner_id = ( SELECT auth.uid() AS uid)) OR layan_is_admin()));
  END IF;
END
$compat_policy_70$;

DO $compat_policy_71$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_ads' AND policyname='supplier_ads_owner_submit') THEN
    CREATE POLICY "supplier_ads_owner_submit" ON "public"."supplier_ads" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text)));
  END IF;
END
$compat_policy_71$;

DO $compat_policy_72$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_ads' AND policyname='supplier_ads_public_read') THEN
    CREATE POLICY "supplier_ads_public_read" ON "public"."supplier_ads" AS PERMISSIVE FOR SELECT TO "anon" USING ((status = 'active'::text));
  END IF;
END
$compat_policy_72$;

DO $compat_policy_73$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_favorite_offers' AND policyname='Users can add own favorites') THEN
    CREATE POLICY "Users can add own favorites" ON "public"."user_favorite_offers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
  END IF;
END
$compat_policy_73$;

DO $compat_policy_74$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_favorite_offers' AND policyname='Users can delete own favorites') THEN
    CREATE POLICY "Users can delete own favorites" ON "public"."user_favorite_offers" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id));
  END IF;
END
$compat_policy_74$;

DO $compat_policy_75$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_favorite_offers' AND policyname='Users can read own favorites') THEN
    CREATE POLICY "Users can read own favorites" ON "public"."user_favorite_offers" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id));
  END IF;
END
$compat_policy_75$;

-- 11. Apply captured least-privilege grants only to new tables/views and newly created sequences/functions.
REVOKE ALL ON FUNCTION private.layan_is_admin() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.layan_is_admin() TO PUBLIC;

GRANT EXECUTE ON FUNCTION private.layan_is_admin() TO authenticated;

REVOKE ALL ON FUNCTION private.layan_activate_supplier_ad(uuid,integer,numeric) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.layan_activate_supplier_ad(uuid,integer,numeric) TO authenticated;

REVOKE ALL ON FUNCTION private.layan_admin_list_company_profiles() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.layan_admin_list_company_profiles() TO PUBLIC;

GRANT EXECUTE ON FUNCTION private.layan_admin_list_company_profiles() TO authenticated;

REVOKE ALL ON FUNCTION private.layan_admin_review_property_offer(bigint,text,text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.layan_admin_review_property_offer(bigint,text,text) TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE "public"."buyer_offer_alerts" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."buyer_preferences" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."buyer_push_subscriptions" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."buyer_push_vapid_config" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."company_profiles" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."company_profiles_public" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."company_property_ads" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."directory_areas" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."directory_change_log" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."directory_entities" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."directory_entity_areas" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."directory_entity_private" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."directory_entity_sources" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."directory_opportunities" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."directory_opportunity_sources" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."directory_project_entities" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."directory_project_private" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."directory_project_sources" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."directory_projects" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."directory_sources" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."marketplace_categories" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."partner_ad_slots" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."promotion_payments" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."property_offers" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."public_active_supplier_ads" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."supplier_ads" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE "public"."user_favorite_offers" FROM anon, authenticated, service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."buyer_offer_alerts" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."buyer_offer_alerts" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."buyer_preferences" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."buyer_preferences" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."buyer_push_subscriptions" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."buyer_push_vapid_config" TO "service_role";

GRANT SELECT ON TABLE "public"."company_profiles" TO "anon";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."company_profiles" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."company_profiles" TO "service_role";

GRANT SELECT ON TABLE "public"."company_profiles_public" TO "anon";

GRANT SELECT ON TABLE "public"."company_profiles_public" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."company_profiles_public" TO "service_role";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."company_property_ads" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."company_property_ads" TO "service_role";

GRANT SELECT ON TABLE "public"."directory_areas" TO "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_areas" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_areas" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_change_log" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_change_log" TO "service_role";

GRANT SELECT ON TABLE "public"."directory_entities" TO "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_entities" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_entities" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_entity_areas" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_entity_areas" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_entity_private" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_entity_private" TO "service_role";

GRANT SELECT ON TABLE "public"."directory_entity_sources" TO "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_entity_sources" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_entity_sources" TO "service_role";

GRANT SELECT ON TABLE "public"."directory_opportunities" TO "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_opportunities" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_opportunities" TO "service_role";

GRANT SELECT ON TABLE "public"."directory_opportunity_sources" TO "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_opportunity_sources" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_opportunity_sources" TO "service_role";

GRANT SELECT ON TABLE "public"."directory_project_entities" TO "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_project_entities" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_project_entities" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_project_private" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_project_private" TO "service_role";

GRANT SELECT ON TABLE "public"."directory_project_sources" TO "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_project_sources" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_project_sources" TO "service_role";

GRANT SELECT ON TABLE "public"."directory_projects" TO "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_projects" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_projects" TO "service_role";

GRANT SELECT ON TABLE "public"."directory_sources" TO "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_sources" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."directory_sources" TO "service_role";

GRANT SELECT ON TABLE "public"."marketplace_categories" TO "anon";

GRANT SELECT ON TABLE "public"."marketplace_categories" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."marketplace_categories" TO "service_role";

GRANT SELECT ON TABLE "public"."partner_ad_slots" TO "anon";

GRANT SELECT, UPDATE ON TABLE "public"."partner_ad_slots" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."partner_ad_slots" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."promotion_payments" TO "service_role";

GRANT SELECT ON TABLE "public"."property_offers" TO "anon";

GRANT INSERT, SELECT ON TABLE "public"."property_offers" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."property_offers" TO "service_role";

GRANT SELECT ON TABLE "public"."public_active_supplier_ads" TO "anon";

GRANT SELECT ON TABLE "public"."public_active_supplier_ads" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."public_active_supplier_ads" TO "service_role";

GRANT SELECT ON TABLE "public"."supplier_ads" TO "anon";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."supplier_ads" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."supplier_ads" TO "service_role";

GRANT DELETE, INSERT, SELECT ON TABLE "public"."user_favorite_offers" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_favorite_offers" TO "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.property_offers_id_seq TO anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.promotion_payments_id_seq TO anon, authenticated, service_role;

-- 12. Marketplace-specific compatibility checks. Existing constraints and data remain untouched.
-- Additional stricter description check preserves the previous looser check under its original name.

DO $market_compat_0$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='marketplace_listings_compat_category_check' AND conrelid='public.marketplace_listings'::regclass) THEN
  ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_compat_category_check
  CHECK (category = ANY (ARRAY[
    'سوق العقارات'::text, 'التنازلات العقارية'::text, 'أراضي للبيع'::text,
    'أراضي التنازلات'::text, 'إيجار يومي ومفروش'::text, 'الشركات والمكاتب العقارية'::text,
    'مواد البناء والتشطيب'::text, 'الأثاث والفرش وتجهيز الوحدات'::text,
    'المشروعات والمطورون العقاريون'::text, 'الصيانة وإدارة العقارات'::text,
    'الاستشارات والخدمات العقارية'::text
  ]));
 END IF;
END
$market_compat_0$;

DO $market_compat_1$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='marketplace_listings_compat_coordinates_pair_check' AND conrelid='public.marketplace_listings'::regclass) THEN
  ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_compat_coordinates_pair_check
  CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL));
 END IF;
END
$market_compat_1$;

DO $market_compat_2$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='marketplace_listings_compat_description_check' AND conrelid='public.marketplace_listings'::regclass) THEN
  ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_compat_description_check
  CHECK (char_length(trim(description)) >= 20 AND char_length(trim(description)) <= 3000);
 END IF;
END
$market_compat_2$;

DO $market_compat_3$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='marketplace_listings_compat_latitude_range_check' AND conrelid='public.marketplace_listings'::regclass) THEN
  ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_compat_latitude_range_check
  CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
 END IF;
END
$market_compat_3$;

DO $market_compat_4$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='marketplace_listings_compat_longitude_range_check' AND conrelid='public.marketplace_listings'::regclass) THEN
  ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_compat_longitude_range_check
  CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
 END IF;
END
$market_compat_4$;

DO $market_compat_5$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='marketplace_listings_compat_price_check' AND conrelid='public.marketplace_listings'::regclass) THEN
  ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_compat_price_check
  CHECK (price IS NULL OR price >= 0);
 END IF;
END
$market_compat_5$;
