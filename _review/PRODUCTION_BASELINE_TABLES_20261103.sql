-- Catalog-derived current application table definitions. Schema only; not a production apply script.

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE "private"."layan_admins" (
  "user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "private"."project_decisions" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "project_key" text NOT NULL,
  "document" jsonb NOT NULL,
  "status" text DEFAULT 'approved_for_implementation'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."buyer_offer_alerts" (
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

CREATE TABLE "public"."buyer_preferences" (
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

CREATE TABLE "public"."buyer_push_subscriptions" (
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

CREATE TABLE "public"."buyer_push_vapid_config" (
  "id" smallint DEFAULT 1 NOT NULL,
  "public_key" text NOT NULL,
  "private_key" text NOT NULL,
  "subject" text DEFAULT 'https://layan-eg.com/'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."company_profiles" (
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

CREATE TABLE "public"."company_property_ads" (
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

CREATE TABLE "public"."directory_areas" (
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

CREATE TABLE "public"."directory_change_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "table_name" text NOT NULL,
  "record_id" uuid NOT NULL,
  "changed_by" uuid,
  "old_values" jsonb,
  "new_values" jsonb,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."directory_entities" (
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

CREATE TABLE "public"."directory_entity_areas" (
  "entity_id" uuid NOT NULL,
  "area_id" uuid NOT NULL,
  "notes" text
);

CREATE TABLE "public"."directory_entity_private" (
  "entity_id" uuid NOT NULL,
  "internal_address" text,
  "internal_phone" text,
  "verification_label" text,
  "confidence_level" text,
  "notes" text,
  "next_review_at" date,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."directory_entity_sources" (
  "entity_id" uuid NOT NULL,
  "source_id" uuid NOT NULL,
  "claim_key" text DEFAULT 'general'::text NOT NULL
);

CREATE TABLE "public"."directory_opportunities" (
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

CREATE TABLE "public"."directory_opportunity_sources" (
  "opportunity_id" uuid NOT NULL,
  "source_id" uuid NOT NULL,
  "claim_key" text DEFAULT 'general'::text NOT NULL
);

CREATE TABLE "public"."directory_project_entities" (
  "project_id" uuid NOT NULL,
  "entity_id" uuid NOT NULL,
  "relation_type" text NOT NULL,
  "notes" text
);

CREATE TABLE "public"."directory_project_private" (
  "project_id" uuid NOT NULL,
  "size_as_published" text,
  "source_claimed_status" text,
  "confidence_level" text,
  "notes" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."directory_project_sources" (
  "project_id" uuid NOT NULL,
  "source_id" uuid NOT NULL,
  "claim_key" text DEFAULT 'general'::text NOT NULL
);

CREATE TABLE "public"."directory_projects" (
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

CREATE TABLE "public"."directory_sources" (
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

CREATE TABLE "public"."marketplace_categories" (
  "name" text NOT NULL,
  "description" text NOT NULL,
  "display_order" integer NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."marketplace_listings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "category" text NOT NULL,
  "listing_type" text DEFAULT 'خدمة'::text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "city" text DEFAULT 'أسيوط'::text NOT NULL,
  "area" text,
  "property_type" text,
  "price" numeric(14,2),
  "price_period" text,
  "contact_phone" text NOT NULL,
  "whatsapp" text,
  "image_urls" text[] DEFAULT '{}'::text[] NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "admin_notes" text,
  "reviewed_at" timestamp with time zone,
  "reviewed_by" uuid,
  "is_featured" boolean DEFAULT false NOT NULL,
  "featured_until" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "latitude" numeric(10,7),
  "longitude" numeric(10,7)
);

CREATE TABLE "public"."partner_ad_slots" (
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

CREATE TABLE "public"."promotion_payments" (
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

CREATE TABLE "public"."property_offers" (
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

CREATE TABLE "public"."supplier_ads" (
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

CREATE TABLE "public"."user_favorite_offers" (
  "user_id" uuid NOT NULL,
  "offer_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
