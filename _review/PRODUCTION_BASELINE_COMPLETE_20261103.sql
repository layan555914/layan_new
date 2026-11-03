-- ASYUT AQAR — complete current application schema baseline from production catalogs.
-- Source project: ebyhwqkmhxbgocngpqfe; PostgreSQL 17.11; captured 2026-11-03.
-- CLEAN SUPABASE PROJECT ONLY. DO NOT execute on the already populated production project.
-- This restores current application schema objects; it does not recreate the original 59-migration history.
-- Excludes user/business rows, Auth users, admin allowlist rows, project decision rows, VAPID secrets and Storage files.
-- Supabase-managed schemas/tables/roles (auth, storage, extensions) must already exist.

-- 0. Extensions and schema setup.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;
SET search_path = public, private, extensions, auth, storage;

-- 1. Application tables.
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


-- 2. Constraints and secondary indexes.





-- Constraints








































































































































-- Secondary indexes



CREATE UNIQUE INDEX buyer_push_subscriptions_endpoint_uidx ON public.buyer_push_subscriptions USING btree (endpoint);






























ALTER TABLE "private"."layan_admins" ADD CONSTRAINT "layan_admins_pkey" PRIMARY KEY (user_id);
ALTER TABLE "private"."project_decisions" ADD CONSTRAINT "project_decisions_pkey" PRIMARY KEY (id);
ALTER TABLE "private"."project_decisions" ADD CONSTRAINT "project_decisions_project_key_key" UNIQUE (project_key);
ALTER TABLE "public"."buyer_offer_alerts" ADD CONSTRAINT "buyer_offer_alerts_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."buyer_offer_alerts" ADD CONSTRAINT "buyer_offer_alerts_user_id_offer_id_key" UNIQUE (user_id, offer_id);
ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_max_monthly_installment_check" CHECK (max_monthly_installment >= 0::numeric);
ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_max_total_price_check" CHECK (max_total_price >= 0::numeric);
ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_max_upfront_check" CHECK (max_upfront >= 0::numeric);
ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_min_bedrooms_check" CHECK (min_bedrooms >= 0 AND min_bedrooms <= 20);
ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_owner_id_key" UNIQUE (owner_id);
ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_property_type_check" CHECK (property_type = ANY (ARRAY['شقة'::text, 'فيلا'::text, 'محل'::text, 'أرض'::text, 'أي نوع'::text]));
ALTER TABLE "public"."buyer_push_subscriptions" ADD CONSTRAINT "buyer_push_subscriptions_failure_count_check" CHECK (failure_count >= 0);
ALTER TABLE "public"."buyer_push_subscriptions" ADD CONSTRAINT "buyer_push_subscriptions_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."buyer_push_subscriptions" ADD CONSTRAINT "buyer_push_subscriptions_user_id_endpoint_key" UNIQUE (user_id, endpoint);
ALTER TABLE "public"."buyer_push_vapid_config" ADD CONSTRAINT "buyer_push_vapid_config_id_check" CHECK (id = 1);
ALTER TABLE "public"."buyer_push_vapid_config" ADD CONSTRAINT "buyer_push_vapid_config_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_company_name_check" CHECK (char_length(TRIM(BOTH FROM company_name)) >= 2 AND char_length(TRIM(BOTH FROM company_name)) <= 140);
ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_description_check" CHECK (char_length(description) >= 20 AND char_length(description) <= 1200);
ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_pending_update_shape" CHECK (pending_update IS NULL OR jsonb_typeof(pending_update) = 'object'::text AND length(pending_update::text) <= 20000);
ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_phone_check" CHECK (char_length(phone) >= 7 AND char_length(phone) <= 30);
ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_projects_check" CHECK (jsonb_typeof(projects) = 'array'::text);
ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'rejected'::text, 'paused'::text, 'needs_changes'::text]));
ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_update_status_check" CHECK (update_status IS NULL OR (update_status = ANY (ARRAY['pending'::text, 'needs_changes'::text, 'rejected'::text])));
ALTER TABLE "public"."company_property_ads" ADD CONSTRAINT "company_property_ads_business_name_check" CHECK (char_length(TRIM(BOTH FROM business_name)) >= 2 AND char_length(TRIM(BOTH FROM business_name)) <= 120);
ALTER TABLE "public"."company_property_ads" ADD CONSTRAINT "company_property_ads_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."company_property_ads" ADD CONSTRAINT "company_property_ads_plan_code_check" CHECK (plan_code = ANY (ARRAY['trial_30'::text, 'starter_15'::text, 'growth_30'::text, 'partner_90'::text]));
ALTER TABLE "public"."company_property_ads" ADD CONSTRAINT "company_property_ads_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'paused'::text, 'expired'::text, 'rejected'::text]));
ALTER TABLE "public"."directory_areas" ADD CONSTRAINT "directory_areas_area_type_check" CHECK (area_type = ANY (ARRAY['governorate'::text, 'center'::text, 'city'::text, 'new_city'::text, 'district'::text, 'neighborhood'::text, 'village'::text, 'zone'::text, 'industrial_zone'::text]));
ALTER TABLE "public"."directory_areas" ADD CONSTRAINT "directory_areas_legacy_code_key" UNIQUE (legacy_code);
ALTER TABLE "public"."directory_areas" ADD CONSTRAINT "directory_areas_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."directory_areas" ADD CONSTRAINT "directory_areas_slug_key" UNIQUE (slug);
ALTER TABLE "public"."directory_areas" ADD CONSTRAINT "directory_areas_verification_status_check" CHECK (verification_status = ANY (ARRAY['draft'::text, 'needs_review'::text, 'verified'::text, 'published'::text, 'archived'::text]));
ALTER TABLE "public"."directory_change_log" ADD CONSTRAINT "directory_change_log_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."directory_entities" ADD CONSTRAINT "directory_entities_entity_type_check" CHECK (entity_type = ANY (ARRAY['developer'::text, 'brokerage'::text, 'marketing'::text, 'contractor'::text, 'public_authority'::text, 'sales_office'::text, 'consultant'::text, 'other'::text]));
ALTER TABLE "public"."directory_entities" ADD CONSTRAINT "directory_entities_legacy_code_key" UNIQUE (legacy_code);
ALTER TABLE "public"."directory_entities" ADD CONSTRAINT "directory_entities_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."directory_entities" ADD CONSTRAINT "directory_entities_slug_key" UNIQUE (slug);
ALTER TABLE "public"."directory_entities" ADD CONSTRAINT "directory_entities_verification_status_check" CHECK (verification_status = ANY (ARRAY['draft'::text, 'needs_review'::text, 'verified'::text, 'published'::text, 'archived'::text]));
ALTER TABLE "public"."directory_entity_areas" ADD CONSTRAINT "directory_entity_areas_pkey" PRIMARY KEY (entity_id, area_id);
ALTER TABLE "public"."directory_entity_private" ADD CONSTRAINT "directory_entity_private_pkey" PRIMARY KEY (entity_id);
ALTER TABLE "public"."directory_entity_sources" ADD CONSTRAINT "directory_entity_sources_pkey" PRIMARY KEY (entity_id, source_id, claim_key);
ALTER TABLE "public"."directory_opportunities" ADD CONSTRAINT "directory_opportunities_legacy_code_key" UNIQUE (legacy_code);
ALTER TABLE "public"."directory_opportunities" ADD CONSTRAINT "directory_opportunities_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."directory_opportunities" ADD CONSTRAINT "directory_opportunities_slug_key" UNIQUE (slug);
ALTER TABLE "public"."directory_opportunities" ADD CONSTRAINT "directory_opportunities_verification_status_check" CHECK (verification_status = ANY (ARRAY['draft'::text, 'needs_review'::text, 'verified'::text, 'published'::text, 'archived'::text]));
ALTER TABLE "public"."directory_opportunity_sources" ADD CONSTRAINT "directory_opportunity_sources_pkey" PRIMARY KEY (opportunity_id, source_id, claim_key);
ALTER TABLE "public"."directory_project_entities" ADD CONSTRAINT "directory_project_entities_pkey" PRIMARY KEY (project_id, entity_id, relation_type);
ALTER TABLE "public"."directory_project_entities" ADD CONSTRAINT "directory_project_entities_relation_type_check" CHECK (relation_type = ANY (ARRAY['developer'::text, 'land_owner'::text, 'marketing_agent'::text, 'sales_agent'::text, 'contractor'::text, 'consultant'::text, 'operator'::text, 'public_authority'::text, 'other'::text]));
ALTER TABLE "public"."directory_project_private" ADD CONSTRAINT "directory_project_private_pkey" PRIMARY KEY (project_id);
ALTER TABLE "public"."directory_project_sources" ADD CONSTRAINT "directory_project_sources_pkey" PRIMARY KEY (project_id, source_id, claim_key);
ALTER TABLE "public"."directory_projects" ADD CONSTRAINT "directory_projects_legacy_code_key" UNIQUE (legacy_code);
ALTER TABLE "public"."directory_projects" ADD CONSTRAINT "directory_projects_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."directory_projects" ADD CONSTRAINT "directory_projects_project_status_check" CHECK (project_status = ANY (ARRAY['announced'::text, 'planned'::text, 'under_construction'::text, 'partially_delivered'::text, 'completed'::text, 'operating'::text, 'stalled'::text, 'unknown'::text]));
ALTER TABLE "public"."directory_projects" ADD CONSTRAINT "directory_projects_project_type_check" CHECK (project_type = ANY (ARRAY['residential'::text, 'commercial'::text, 'administrative'::text, 'medical'::text, 'educational'::text, 'mixed_use'::text, 'land'::text, 'service'::text, 'other'::text]));
ALTER TABLE "public"."directory_projects" ADD CONSTRAINT "directory_projects_slug_key" UNIQUE (slug);
ALTER TABLE "public"."directory_projects" ADD CONSTRAINT "directory_projects_unit_count_check" CHECK (unit_count IS NULL OR unit_count >= 0);
ALTER TABLE "public"."directory_projects" ADD CONSTRAINT "directory_projects_verification_status_check" CHECK (verification_status = ANY (ARRAY['draft'::text, 'needs_review'::text, 'verified'::text, 'published'::text, 'archived'::text]));
ALTER TABLE "public"."directory_sources" ADD CONSTRAINT "directory_sources_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."directory_sources" ADD CONSTRAINT "directory_sources_source_code_key" UNIQUE (source_code);
ALTER TABLE "public"."marketplace_categories" ADD CONSTRAINT "marketplace_categories_display_order_check" CHECK (display_order >= 1 AND display_order <= 11);
ALTER TABLE "public"."marketplace_categories" ADD CONSTRAINT "marketplace_categories_display_order_key" UNIQUE (display_order);
ALTER TABLE "public"."marketplace_categories" ADD CONSTRAINT "marketplace_categories_pkey" PRIMARY KEY (name);
ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_category_check" CHECK (category = ANY (ARRAY['سوق العقارات'::text, 'التنازلات العقارية'::text, 'أراضي للبيع'::text, 'أراضي التنازلات'::text, 'إيجار يومي ومفروش'::text, 'الشركات والمكاتب العقارية'::text, 'مواد البناء والتشطيب'::text, 'الأثاث والفرش وتجهيز الوحدات'::text, 'المشروعات والمطورون العقاريون'::text, 'الصيانة وإدارة العقارات'::text, 'الاستشارات والخدمات العقارية'::text]));
ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_coordinates_pair_check" CHECK (latitude IS NULL AND longitude IS NULL OR latitude IS NOT NULL AND longitude IS NOT NULL);
ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_description_check" CHECK (char_length(TRIM(BOTH FROM description)) >= 20 AND char_length(TRIM(BOTH FROM description)) <= 3000);
ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_latitude_range_check" CHECK (latitude IS NULL OR latitude >= '-90'::integer::numeric AND latitude <= 90::numeric);
ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_longitude_range_check" CHECK (longitude IS NULL OR longitude >= '-180'::integer::numeric AND longitude <= 180::numeric);
ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_price_check" CHECK (price IS NULL OR price >= 0::numeric);
ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'paused'::text]));
ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_title_check" CHECK (char_length(TRIM(BOTH FROM title)) >= 4 AND char_length(TRIM(BOTH FROM title)) <= 180);
ALTER TABLE "public"."partner_ad_slots" ADD CONSTRAINT "partner_ad_slots_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."partner_ad_slots" ADD CONSTRAINT "partner_ad_slots_slot_key_check" CHECK (slot_key = ANY (ARRAY['ceramics'::text, 'furniture'::text, 'curtains'::text, 'paint'::text]));
ALTER TABLE "public"."partner_ad_slots" ADD CONSTRAINT "partner_ad_slots_slot_key_key" UNIQUE (slot_key);
ALTER TABLE "public"."partner_ad_slots" ADD CONSTRAINT "partner_ad_slots_status_check" CHECK (status = ANY (ARRAY['active'::text, 'draft'::text, 'paused'::text]));
ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_amount_egp_check" CHECK (amount_egp > 0::numeric);
ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_duration_days_check" CHECK (duration_days = ANY (ARRAY[15, 30]));
ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_payment_method_check" CHECK (payment_method = 'vodafone_cash'::text);
ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text, 'expired'::text]));
ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_transaction_reference_key" UNIQUE (transaction_reference);
ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "verified_payment_requires_reference" CHECK (status <> 'verified'::text OR transaction_reference IS NOT NULL AND verified_at IS NOT NULL);
ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_coordinates_pair_check" CHECK (latitude IS NULL AND longitude IS NULL OR latitude IS NOT NULL AND longitude IS NOT NULL);
ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_developer_approval_status_check" CHECK (developer_approval_status = ANY (ARRAY['unknown'::text, 'pending'::text, 'approved'::text, 'rejected'::text]));
ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_latitude_range_check" CHECK (latitude IS NULL OR latitude >= '-90'::integer::numeric AND latitude <= 90::numeric);
ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_listing_purpose_check" CHECK (listing_purpose = ANY (ARRAY['بيع'::text, 'إيجار'::text, 'تنازل'::text]));
ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_longitude_range_check" CHECK (longitude IS NULL OR longitude >= '-180'::integer::numeric AND longitude <= 180::numeric);
ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_promotion_status_check" CHECK (promotion_status = ANY (ARRAY['none'::text, 'requested'::text, 'payment_pending'::text, 'active'::text, 'expired'::text, 'rejected'::text]));
ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'available'::text, 'reserved'::text, 'sold'::text]));
ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_verification_status_check" CHECK (verification_status = ANY (ARRAY['pending'::text, 'under_review'::text, 'verified'::text, 'rejected'::text]));
ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_business_name_check" CHECK (char_length(business_name) >= 2 AND char_length(business_name) <= 120);
ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_contact_phone_check" CHECK (char_length(contact_phone) >= 7 AND char_length(contact_phone) <= 30);
ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_dates_check" CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at);
ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_description_check" CHECK (char_length(description) >= 5 AND char_length(description) <= 500);
ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_price_check" CHECK (price >= 0::numeric);
ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_requested_days_check" CHECK (requested_days >= 0 AND requested_days <= 365);
ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_requested_price_check" CHECK (requested_price >= 0::numeric);
ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'paused'::text, 'expired'::text, 'rejected'::text]));
ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_title_check" CHECK (char_length(title) >= 3 AND char_length(title) <= 140);
ALTER TABLE "public"."user_favorite_offers" ADD CONSTRAINT "user_favorite_offers_pkey" PRIMARY KEY (user_id, offer_id);
ALTER TABLE "private"."layan_admins" ADD CONSTRAINT "layan_admins_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "public"."buyer_offer_alerts" ADD CONSTRAINT "buyer_offer_alerts_offer_id_fkey" FOREIGN KEY (offer_id) REFERENCES property_offers(id) ON DELETE CASCADE;
ALTER TABLE "public"."buyer_offer_alerts" ADD CONSTRAINT "buyer_offer_alerts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "public"."buyer_push_subscriptions" ADD CONSTRAINT "buyer_push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);
ALTER TABLE "public"."company_property_ads" ADD CONSTRAINT "company_property_ads_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "public"."directory_areas" ADD CONSTRAINT "directory_areas_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES directory_areas(id) ON DELETE RESTRICT;
ALTER TABLE "public"."directory_entities" ADD CONSTRAINT "directory_entities_primary_area_id_fkey" FOREIGN KEY (primary_area_id) REFERENCES directory_areas(id) ON DELETE SET NULL;
ALTER TABLE "public"."directory_entity_areas" ADD CONSTRAINT "directory_entity_areas_area_id_fkey" FOREIGN KEY (area_id) REFERENCES directory_areas(id) ON DELETE RESTRICT;
ALTER TABLE "public"."directory_entity_areas" ADD CONSTRAINT "directory_entity_areas_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES directory_entities(id) ON DELETE CASCADE;
ALTER TABLE "public"."directory_entity_private" ADD CONSTRAINT "directory_entity_private_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES directory_entities(id) ON DELETE CASCADE;
ALTER TABLE "public"."directory_entity_sources" ADD CONSTRAINT "directory_entity_sources_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES directory_entities(id) ON DELETE CASCADE;
ALTER TABLE "public"."directory_entity_sources" ADD CONSTRAINT "directory_entity_sources_source_id_fkey" FOREIGN KEY (source_id) REFERENCES directory_sources(id) ON DELETE RESTRICT;
ALTER TABLE "public"."directory_opportunity_sources" ADD CONSTRAINT "directory_opportunity_sources_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES directory_opportunities(id) ON DELETE CASCADE;
ALTER TABLE "public"."directory_opportunity_sources" ADD CONSTRAINT "directory_opportunity_sources_source_id_fkey" FOREIGN KEY (source_id) REFERENCES directory_sources(id) ON DELETE RESTRICT;
ALTER TABLE "public"."directory_project_entities" ADD CONSTRAINT "directory_project_entities_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES directory_entities(id) ON DELETE RESTRICT;
ALTER TABLE "public"."directory_project_entities" ADD CONSTRAINT "directory_project_entities_project_id_fkey" FOREIGN KEY (project_id) REFERENCES directory_projects(id) ON DELETE CASCADE;
ALTER TABLE "public"."directory_project_private" ADD CONSTRAINT "directory_project_private_project_id_fkey" FOREIGN KEY (project_id) REFERENCES directory_projects(id) ON DELETE CASCADE;
ALTER TABLE "public"."directory_project_sources" ADD CONSTRAINT "directory_project_sources_project_id_fkey" FOREIGN KEY (project_id) REFERENCES directory_projects(id) ON DELETE CASCADE;
ALTER TABLE "public"."directory_project_sources" ADD CONSTRAINT "directory_project_sources_source_id_fkey" FOREIGN KEY (source_id) REFERENCES directory_sources(id) ON DELETE RESTRICT;
ALTER TABLE "public"."directory_projects" ADD CONSTRAINT "directory_projects_area_id_fkey" FOREIGN KEY (area_id) REFERENCES directory_areas(id) ON DELETE SET NULL;
ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);
ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_offer_id_fkey" FOREIGN KEY (offer_id) REFERENCES property_offers(id) ON DELETE RESTRICT;
ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_company_ad_id_fkey" FOREIGN KEY (company_ad_id) REFERENCES company_property_ads(id) ON DELETE SET NULL;
ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "public"."user_favorite_offers" ADD CONSTRAINT "user_favorite_offers_offer_id_fkey" FOREIGN KEY (offer_id) REFERENCES property_offers(id) ON DELETE CASCADE;
ALTER TABLE "public"."user_favorite_offers" ADD CONSTRAINT "user_favorite_offers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX buyer_offer_alerts_offer_id_idx ON public.buyer_offer_alerts USING btree (offer_id);
CREATE INDEX buyer_offer_alerts_user_created_idx ON public.buyer_offer_alerts USING btree (user_id, created_at DESC);
CREATE INDEX buyer_push_subscriptions_user_idx ON public.buyer_push_subscriptions USING btree (user_id);
CREATE INDEX company_profiles_owner_id_idx ON public.company_profiles USING btree (owner_id);
CREATE INDEX company_profiles_reviewed_by_idx ON public.company_profiles USING btree (reviewed_by);
CREATE INDEX company_property_ads_owner_id_idx ON public.company_property_ads USING btree (owner_id);
CREATE INDEX directory_areas_parent_idx ON public.directory_areas USING btree (parent_id);
CREATE INDEX directory_entities_area_idx ON public.directory_entities USING btree (primary_area_id);
CREATE INDEX directory_entities_public_idx ON public.directory_entities USING btree (verification_status, public_visible, entity_type);
CREATE INDEX directory_entity_areas_area_idx ON public.directory_entity_areas USING btree (area_id);
CREATE INDEX directory_entity_sources_source_idx ON public.directory_entity_sources USING btree (source_id);
CREATE INDEX directory_opportunity_sources_source_idx ON public.directory_opportunity_sources USING btree (source_id);
CREATE INDEX directory_project_entities_entity_idx ON public.directory_project_entities USING btree (entity_id);
CREATE INDEX directory_project_sources_source_idx ON public.directory_project_sources USING btree (source_id);
CREATE INDEX directory_projects_area_idx ON public.directory_projects USING btree (area_id);
CREATE INDEX directory_projects_public_idx ON public.directory_projects USING btree (verification_status, public_visible, project_type);
CREATE INDEX directory_sources_public_idx ON public.directory_sources USING btree (is_public, accessed_at DESC);
CREATE INDEX directory_sources_source_url_idx ON public.directory_sources USING btree (source_url);
CREATE INDEX marketplace_listings_city_area_approved_idx ON public.marketplace_listings USING btree (city, area) WHERE (status = 'approved'::text);
CREATE INDEX marketplace_listings_owner_created_idx ON public.marketplace_listings USING btree (owner_id, created_at DESC);
CREATE INDEX marketplace_listings_public_category_created_idx ON public.marketplace_listings USING btree (category, created_at DESC) WHERE (status = 'approved'::text);
CREATE INDEX marketplace_listings_reviewed_by_idx ON public.marketplace_listings USING btree (reviewed_by);
CREATE INDEX promotion_payments_offer_id_idx ON public.promotion_payments USING btree (offer_id);
CREATE INDEX property_offers_city_area_available_idx ON public.property_offers USING btree (city, area) WHERE (status = 'available'::text);
CREATE INDEX property_offers_company_ad_id_idx ON public.property_offers USING btree (company_ad_id);
CREATE INDEX property_offers_governorate_idx ON public.property_offers USING btree (governorate);
CREATE INDEX property_offers_owner_id_idx ON public.property_offers USING btree (owner_id);
CREATE INDEX property_offers_status_idx ON public.property_offers USING btree (status);
CREATE INDEX supplier_ads_owner_id_idx ON public.supplier_ads USING btree (owner_id);
CREATE INDEX user_favorite_offers_offer_id_idx ON public.user_favorite_offers USING btree (offer_id);
CREATE INDEX user_favorite_offers_user_created_idx ON public.user_favorite_offers USING btree (user_id, created_at DESC);


-- 3. Routines, explicit routine grants, views and triggers.
-- Catalog-derived functions, views and triggers for ASYUT AQAR.

-- Restore table definitions, constraints and indexes first.

-- Do not execute against the existing production project.

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

CREATE OR REPLACE FUNCTION public.layan_is_http_url(u text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select u is null or u = '' or u ~* '^https?://[^[:space:]]+$'
$function$
;

CREATE OR REPLACE FUNCTION public.layan_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select private.layan_is_admin();
$function$
;

CREATE OR REPLACE FUNCTION public.layan_all_http_urls(arr text[])
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(bool_and(public.layan_is_http_url(x)), true) from unnest(arr) as x
$function$
;

CREATE OR REPLACE FUNCTION public.guard_company_owner_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare k text;
begin
  if auth.uid() is null or public.layan_is_admin() then return new; end if;
  new.id := old.id; new.owner_id := old.owner_id; new.created_at := old.created_at;
  new.reviewed_at := old.reviewed_at; new.reviewed_by := old.reviewed_by;
  if old.status = 'active' then
    -- ملف منشور: لا تُمس الأعمدة العامة ولا الحالة؛ المسموح فقط إرسال pending_update
    if new.pending_update is null or jsonb_typeof(new.pending_update) <> 'object' then
      raise exception 'يجب إرسال التعديلات كنسخة مقترحة (pending_update)' using errcode = '23514';
    end if;
    for k in select jsonb_object_keys(new.pending_update) loop
      if k not in ('company_name','category','description','services','city','address','phone','whatsapp','website','logo_url','gallery_urls','projects') then
        raise exception 'حقل غير مسموح في التعديل المقترح: %', k using errcode = '23514';
      end if;
    end loop;
    if not public.layan_is_http_url(new.pending_update->>'website')
       or not public.layan_is_http_url(new.pending_update->>'logo_url') then
      raise exception 'الروابط يجب أن تبدأ بـ http:// أو https://' using errcode = '23514';
    end if;
    new.company_name := old.company_name; new.category := old.category; new.description := old.description;
    new.services := old.services; new.city := old.city; new.address := old.address; new.phone := old.phone;
    new.whatsapp := old.whatsapp; new.website := old.website; new.logo_url := old.logo_url;
    new.gallery_urls := old.gallery_urls; new.projects := old.projects;
    new.status := 'active'; new.admin_notes := old.admin_notes;
    new.update_status := 'pending'; new.update_notes := null;
  else
    -- pending / needs_changes / rejected: تعديل مباشر وإعادة إرسال للمراجعة
    new.status := 'pending'; new.admin_notes := null;
    new.reviewed_at := null; new.reviewed_by := null;
    new.pending_update := null; new.update_status := null; new.update_notes := null;
  end if;
  return new;
end $function$
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

CREATE OR REPLACE FUNCTION public.layan_activate_supplier_ad(p_ad_id uuid, p_days integer, p_price numeric)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.layan_activate_supplier_ad(p_ad_id, p_days, p_price);
$function$
;

CREATE OR REPLACE FUNCTION public.layan_admin_list_company_profiles()
 RETURNS SETOF company_profiles
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select * from private.layan_admin_list_company_profiles();
$function$
;

CREATE OR REPLACE FUNCTION public.layan_admin_review_property_offer(p_id bigint, p_action text, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.layan_admin_review_property_offer(p_id, p_action, p_notes);
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

CREATE OR REPLACE FUNCTION public.layan_reject_supplier_ad(p_ad_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not exists (
    select 1 from private.layan_admins a where a.user_id = auth.uid()
  ) then
    raise exception 'غير مصرح: يلزم حساب إدارة معتمد';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 or length(p_reason) > 500 then
    raise exception 'اكتب سبب رفض واضحًا';
  end if;
  update public.supplier_ads
  set status = 'rejected', updated_at = now()
  where id = p_ad_id and status = 'pending';
  if not found then
    raise exception 'الإعلان غير موجود أو ليس قيد المراجعة';
  end if;
  return jsonb_build_object('success', true, 'ad_id', p_ad_id, 'status', 'rejected');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.layan_review_company_profile(p_id uuid, p_action text, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare r public.company_profiles; d jsonb;
begin
  if not public.layan_is_admin() then raise exception 'غير مسموح' using errcode = '42501'; end if;
  select * into r from public.company_profiles where id = p_id for update;
  if not found or r.status <> 'active' or r.update_status is distinct from 'pending' or r.pending_update is null then
    raise exception 'لا يوجد تعديل معلّق لهذا الملف';
  end if;
  d := r.pending_update;
  if p_action = 'approve' then
    update public.company_profiles set
      company_name = coalesce(nullif(d->>'company_name',''), company_name),
      category     = coalesce(nullif(d->>'category',''), category),
      description  = coalesce(nullif(d->>'description',''), description),
      services     = case when jsonb_typeof(d->'services') = 'array' then array(select jsonb_array_elements_text(d->'services')) else services end,
      city         = coalesce(nullif(d->>'city',''), city),
      address      = case when d ? 'address'  then nullif(d->>'address','')  else address end,
      phone        = coalesce(nullif(d->>'phone',''), phone),
      whatsapp     = case when d ? 'whatsapp' then nullif(d->>'whatsapp','') else whatsapp end,
      website      = case when d ? 'website'  then nullif(d->>'website','')  else website end,
      logo_url     = case when d ? 'logo_url' then nullif(d->>'logo_url','') else logo_url end,
      gallery_urls = case when jsonb_typeof(d->'gallery_urls') = 'array' then array(select jsonb_array_elements_text(d->'gallery_urls')) else gallery_urls end,
      projects     = case when jsonb_typeof(d->'projects') = 'array' then d->'projects' else projects end,
      pending_update = null, update_status = null, update_notes = null, admin_notes = null,
      reviewed_at = now(), reviewed_by = auth.uid()
    where id = p_id;
  elsif p_action in ('request_changes','reject') then
    if coalesce(trim(p_notes),'') = '' then raise exception 'الملاحظات مطلوبة'; end if;
    update public.company_profiles set
      update_status = case p_action when 'request_changes' then 'needs_changes' else 'rejected' end,
      update_notes = left(trim(p_notes), 500)
    where id = p_id;
  else
    raise exception 'إجراء غير صالح';
  end if;
end $function$
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

-- Recreate explicit function EXECUTE grants.

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

REVOKE ALL ON FUNCTION layan_is_http_url(text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION layan_is_http_url(text) TO PUBLIC;

GRANT EXECUTE ON FUNCTION layan_is_http_url(text) TO anon;

GRANT EXECUTE ON FUNCTION layan_is_http_url(text) TO authenticated;

GRANT EXECUTE ON FUNCTION layan_is_http_url(text) TO service_role;

REVOKE ALL ON FUNCTION layan_is_admin() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION layan_is_admin() TO authenticated;

GRANT EXECUTE ON FUNCTION layan_is_admin() TO service_role;

REVOKE ALL ON FUNCTION layan_all_http_urls(text[]) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION layan_all_http_urls(text[]) TO PUBLIC;

GRANT EXECUTE ON FUNCTION layan_all_http_urls(text[]) TO anon;

GRANT EXECUTE ON FUNCTION layan_all_http_urls(text[]) TO authenticated;

GRANT EXECUTE ON FUNCTION layan_all_http_urls(text[]) TO service_role;

REVOKE ALL ON FUNCTION guard_company_owner_update() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION guard_company_owner_update() TO PUBLIC;

GRANT EXECUTE ON FUNCTION guard_company_owner_update() TO anon;

GRANT EXECUTE ON FUNCTION guard_company_owner_update() TO authenticated;

GRANT EXECUTE ON FUNCTION guard_company_owner_update() TO service_role;

REVOKE ALL ON FUNCTION directory_require_public_source() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION directory_require_public_source() TO PUBLIC;

GRANT EXECUTE ON FUNCTION directory_require_public_source() TO anon;

GRANT EXECUTE ON FUNCTION directory_require_public_source() TO authenticated;

GRANT EXECUTE ON FUNCTION directory_require_public_source() TO service_role;

REVOKE ALL ON FUNCTION enforce_company_property_ad_limit() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION enforce_company_property_ad_limit() TO PUBLIC;

GRANT EXECUTE ON FUNCTION enforce_company_property_ad_limit() TO anon;

GRANT EXECUTE ON FUNCTION enforce_company_property_ad_limit() TO authenticated;

GRANT EXECUTE ON FUNCTION enforce_company_property_ad_limit() TO service_role;

REVOKE ALL ON FUNCTION enforce_layan_offer_limit() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION enforce_layan_offer_limit() TO PUBLIC;

GRANT EXECUTE ON FUNCTION enforce_layan_offer_limit() TO anon;

GRANT EXECUTE ON FUNCTION enforce_layan_offer_limit() TO authenticated;

GRANT EXECUTE ON FUNCTION enforce_layan_offer_limit() TO service_role;

REVOKE ALL ON FUNCTION guard_property_offer_promotion() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION guard_property_offer_promotion() TO PUBLIC;

GRANT EXECUTE ON FUNCTION guard_property_offer_promotion() TO anon;

GRANT EXECUTE ON FUNCTION guard_property_offer_promotion() TO authenticated;

GRANT EXECUTE ON FUNCTION guard_property_offer_promotion() TO service_role;

REVOKE ALL ON FUNCTION layan_activate_supplier_ad(uuid,integer,numeric) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION layan_activate_supplier_ad(uuid,integer,numeric) TO authenticated;

GRANT EXECUTE ON FUNCTION layan_activate_supplier_ad(uuid,integer,numeric) TO service_role;

REVOKE ALL ON FUNCTION layan_admin_list_company_profiles() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION layan_admin_list_company_profiles() TO authenticated;

GRANT EXECUTE ON FUNCTION layan_admin_list_company_profiles() TO service_role;

REVOKE ALL ON FUNCTION layan_admin_review_property_offer(bigint,text,text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION layan_admin_review_property_offer(bigint,text,text) TO authenticated;

GRANT EXECUTE ON FUNCTION layan_admin_review_property_offer(bigint,text,text) TO service_role;

REVOKE ALL ON FUNCTION layan_approve_free_trial_ad(uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION layan_approve_free_trial_ad(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION layan_approve_free_trial_ad(uuid) TO service_role;

REVOKE ALL ON FUNCTION layan_reject_supplier_ad(uuid,text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION layan_reject_supplier_ad(uuid,text) TO authenticated;

GRANT EXECUTE ON FUNCTION layan_reject_supplier_ad(uuid,text) TO service_role;

REVOKE ALL ON FUNCTION layan_review_company_profile(uuid,text,text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION layan_review_company_profile(uuid,text,text) TO authenticated;

GRANT EXECUTE ON FUNCTION layan_review_company_profile(uuid,text,text) TO service_role;

REVOKE ALL ON FUNCTION set_company_profiles_updated_at() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION set_company_profiles_updated_at() TO PUBLIC;

GRANT EXECUTE ON FUNCTION set_company_profiles_updated_at() TO anon;

GRANT EXECUTE ON FUNCTION set_company_profiles_updated_at() TO authenticated;

GRANT EXECUTE ON FUNCTION set_company_profiles_updated_at() TO service_role;

REVOKE ALL ON FUNCTION set_supplier_ad_free_trial() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION set_supplier_ad_free_trial() TO PUBLIC;

GRANT EXECUTE ON FUNCTION set_supplier_ad_free_trial() TO anon;

GRANT EXECUTE ON FUNCTION set_supplier_ad_free_trial() TO authenticated;

GRANT EXECUTE ON FUNCTION set_supplier_ad_free_trial() TO service_role;

-- Security-invoker views.

CREATE OR REPLACE VIEW "public"."company_profiles_public" WITH (security_invoker=true) AS
 SELECT id,
    company_name,
    category,
    description,
    services,
    city,
    logo_url
   FROM company_profiles
  WHERE status = 'active'::text;;

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
  WHERE status = 'active'::text;;

-- Application triggers.

CREATE TRIGGER company_profiles_owner_update_guard BEFORE UPDATE ON "public"."company_profiles" FOR EACH ROW EXECUTE FUNCTION guard_company_owner_update();

CREATE TRIGGER company_profiles_set_updated_at BEFORE UPDATE ON "public"."company_profiles" FOR EACH ROW EXECUTE FUNCTION set_company_profiles_updated_at();

CREATE TRIGGER directory_entities_require_source BEFORE INSERT OR UPDATE OF public_visible, verification_status ON "public"."directory_entities" FOR EACH ROW EXECUTE FUNCTION directory_require_public_source();

CREATE TRIGGER directory_opportunities_require_source BEFORE INSERT OR UPDATE OF public_visible, verification_status ON "public"."directory_opportunities" FOR EACH ROW EXECUTE FUNCTION directory_require_public_source();

CREATE TRIGGER directory_projects_require_source BEFORE INSERT OR UPDATE OF public_visible, verification_status ON "public"."directory_projects" FOR EACH ROW EXECUTE FUNCTION directory_require_public_source();

CREATE TRIGGER a_property_offer_promotion_guard BEFORE INSERT ON "public"."property_offers" FOR EACH ROW EXECUTE FUNCTION guard_property_offer_promotion();

CREATE TRIGGER c_property_offer_company_limit BEFORE INSERT ON "public"."property_offers" FOR EACH ROW EXECUTE FUNCTION enforce_company_property_ad_limit();


-- 4. Enable application RLS and create the 80 current application policies.
-- Application RLS policy definitions captured from current PostgreSQL catalog.

-- Apply only after the matching schema and function definitions exist.

-- All 28 app-owned tables had RLS enabled in production.
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
ALTER TABLE "public"."marketplace_listings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."partner_ad_slots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."promotion_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."property_offers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."supplier_ads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_favorite_offers" ENABLE ROW LEVEL SECURITY;

-- Review before use in any environment.

CREATE POLICY "Users can create own buyer alerts" ON "public"."buyer_offer_alerts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can delete own buyer alerts" ON "public"."buyer_offer_alerts" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can read own buyer alerts" ON "public"."buyer_offer_alerts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can update own buyer alerts" ON "public"."buyer_offer_alerts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "buyer_preferences_owner_access" ON "public"."buyer_preferences" AS PERMISSIVE FOR ALL TO "authenticated" USING ((owner_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "company_profiles_admin_read" ON "public"."company_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (layan_is_admin());

CREATE POLICY "company_profiles_owner_submit" ON "public"."company_profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text)));

CREATE POLICY "company_profiles_read_scope" ON "public"."company_profiles" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (((status = 'active'::text) OR (owner_id = ( SELECT auth.uid() AS uid))));

CREATE POLICY "company_profiles_update_scope" ON "public"."company_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((layan_is_admin() OR ((owner_id = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['pending'::text, 'needs_changes'::text, 'rejected'::text, 'active'::text]))))) WITH CHECK ((layan_is_admin() OR ((owner_id = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['pending'::text, 'needs_changes'::text, 'rejected'::text, 'active'::text])) AND ((status = 'active'::text) OR (reviewed_by IS NULL)))));

CREATE POLICY "company_property_ads_admin_update" ON "public"."company_property_ads" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (layan_is_admin()) WITH CHECK (layan_is_admin());

CREATE POLICY "company_property_ads_owner_submit" ON "public"."company_property_ads" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text)));

CREATE POLICY "company_property_ads_read_scope" ON "public"."company_property_ads" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((owner_id = ( SELECT auth.uid() AS uid)) OR layan_is_admin()));

CREATE POLICY "directory_areas_admin_delete" ON "public"."directory_areas" AS PERMISSIVE FOR DELETE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_areas_admin_insert" ON "public"."directory_areas" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_areas_admin_update" ON "public"."directory_areas" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin)) WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_areas_anon_read" ON "public"."directory_areas" AS PERMISSIVE FOR SELECT TO "anon" USING ((is_active AND public_visible AND (verification_status = 'published'::text)));

CREATE POLICY "directory_areas_authenticated_read" ON "public"."directory_areas" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((is_active AND public_visible AND (verification_status = 'published'::text)) OR ( SELECT layan_is_admin() AS layan_is_admin)));

CREATE POLICY "directory_change_log_admin_all" ON "public"."directory_change_log" AS PERMISSIVE FOR ALL TO "authenticated" USING (layan_is_admin()) WITH CHECK (layan_is_admin());

CREATE POLICY "directory_entities_admin_delete" ON "public"."directory_entities" AS PERMISSIVE FOR DELETE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_entities_admin_insert" ON "public"."directory_entities" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_entities_admin_update" ON "public"."directory_entities" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin)) WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_entities_anon_read" ON "public"."directory_entities" AS PERMISSIVE FOR SELECT TO "anon" USING ((public_visible AND (verification_status = 'published'::text)));

CREATE POLICY "directory_entities_authenticated_read" ON "public"."directory_entities" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((public_visible AND (verification_status = 'published'::text)) OR ( SELECT layan_is_admin() AS layan_is_admin)));

CREATE POLICY "directory_entity_areas_admin_all" ON "public"."directory_entity_areas" AS PERMISSIVE FOR ALL TO "authenticated" USING (layan_is_admin()) WITH CHECK (layan_is_admin());

CREATE POLICY "directory_entity_private_admin_all" ON "public"."directory_entity_private" AS PERMISSIVE FOR ALL TO "authenticated" USING (layan_is_admin()) WITH CHECK (layan_is_admin());

CREATE POLICY "directory_entity_sources_admin_delete" ON "public"."directory_entity_sources" AS PERMISSIVE FOR DELETE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_entity_sources_admin_insert" ON "public"."directory_entity_sources" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_entity_sources_admin_update" ON "public"."directory_entity_sources" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin)) WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_entity_sources_anon_read" ON "public"."directory_entity_sources" AS PERMISSIVE FOR SELECT TO "anon" USING (((EXISTS ( SELECT 1
   FROM directory_entities e
  WHERE ((e.id = directory_entity_sources.entity_id) AND e.public_visible AND (e.verification_status = 'published'::text)))) AND (EXISTS ( SELECT 1
   FROM directory_sources s
  WHERE ((s.id = directory_entity_sources.source_id) AND s.is_public)))));

CREATE POLICY "directory_entity_sources_authenticated_read" ON "public"."directory_entity_sources" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((((EXISTS ( SELECT 1
   FROM directory_entities e
  WHERE ((e.id = directory_entity_sources.entity_id) AND e.public_visible AND (e.verification_status = 'published'::text)))) AND (EXISTS ( SELECT 1
   FROM directory_sources s
  WHERE ((s.id = directory_entity_sources.source_id) AND s.is_public)))) OR ( SELECT layan_is_admin() AS layan_is_admin)));

CREATE POLICY "directory_opportunities_admin_delete" ON "public"."directory_opportunities" AS PERMISSIVE FOR DELETE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_opportunities_admin_insert" ON "public"."directory_opportunities" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_opportunities_admin_update" ON "public"."directory_opportunities" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin)) WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_opportunities_anon_read" ON "public"."directory_opportunities" AS PERMISSIVE FOR SELECT TO "anon" USING ((public_visible AND (verification_status = 'published'::text)));

CREATE POLICY "directory_opportunities_authenticated_read" ON "public"."directory_opportunities" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((public_visible AND (verification_status = 'published'::text)) OR ( SELECT layan_is_admin() AS layan_is_admin)));

CREATE POLICY "directory_opportunity_sources_admin_delete" ON "public"."directory_opportunity_sources" AS PERMISSIVE FOR DELETE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_opportunity_sources_admin_insert" ON "public"."directory_opportunity_sources" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_opportunity_sources_admin_update" ON "public"."directory_opportunity_sources" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin)) WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_opportunity_sources_anon_read" ON "public"."directory_opportunity_sources" AS PERMISSIVE FOR SELECT TO "anon" USING (((EXISTS ( SELECT 1
   FROM directory_opportunities o
  WHERE ((o.id = directory_opportunity_sources.opportunity_id) AND o.public_visible AND (o.verification_status = 'published'::text)))) AND (EXISTS ( SELECT 1
   FROM directory_sources s
  WHERE ((s.id = directory_opportunity_sources.source_id) AND s.is_public)))));

CREATE POLICY "directory_opportunity_sources_authenticated_read" ON "public"."directory_opportunity_sources" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((((EXISTS ( SELECT 1
   FROM directory_opportunities o
  WHERE ((o.id = directory_opportunity_sources.opportunity_id) AND o.public_visible AND (o.verification_status = 'published'::text)))) AND (EXISTS ( SELECT 1
   FROM directory_sources s
  WHERE ((s.id = directory_opportunity_sources.source_id) AND s.is_public)))) OR ( SELECT layan_is_admin() AS layan_is_admin)));

CREATE POLICY "directory_project_entities_admin_delete" ON "public"."directory_project_entities" AS PERMISSIVE FOR DELETE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_project_entities_admin_insert" ON "public"."directory_project_entities" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_project_entities_admin_update" ON "public"."directory_project_entities" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin)) WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_project_entities_anon_read" ON "public"."directory_project_entities" AS PERMISSIVE FOR SELECT TO "anon" USING (((EXISTS ( SELECT 1
   FROM directory_projects p
  WHERE ((p.id = directory_project_entities.project_id) AND p.public_visible AND (p.verification_status = 'published'::text)))) AND (EXISTS ( SELECT 1
   FROM directory_entities e
  WHERE ((e.id = directory_project_entities.entity_id) AND e.public_visible AND (e.verification_status = 'published'::text))))));

CREATE POLICY "directory_project_entities_authenticated_read" ON "public"."directory_project_entities" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((((EXISTS ( SELECT 1
   FROM directory_projects p
  WHERE ((p.id = directory_project_entities.project_id) AND p.public_visible AND (p.verification_status = 'published'::text)))) AND (EXISTS ( SELECT 1
   FROM directory_entities e
  WHERE ((e.id = directory_project_entities.entity_id) AND e.public_visible AND (e.verification_status = 'published'::text))))) OR ( SELECT layan_is_admin() AS layan_is_admin)));

CREATE POLICY "directory_project_private_admin_all" ON "public"."directory_project_private" AS PERMISSIVE FOR ALL TO "authenticated" USING (layan_is_admin()) WITH CHECK (layan_is_admin());

CREATE POLICY "directory_project_sources_admin_delete" ON "public"."directory_project_sources" AS PERMISSIVE FOR DELETE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_project_sources_admin_insert" ON "public"."directory_project_sources" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_project_sources_admin_update" ON "public"."directory_project_sources" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin)) WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_project_sources_anon_read" ON "public"."directory_project_sources" AS PERMISSIVE FOR SELECT TO "anon" USING (((EXISTS ( SELECT 1
   FROM directory_projects p
  WHERE ((p.id = directory_project_sources.project_id) AND p.public_visible AND (p.verification_status = 'published'::text)))) AND (EXISTS ( SELECT 1
   FROM directory_sources s
  WHERE ((s.id = directory_project_sources.source_id) AND s.is_public)))));

CREATE POLICY "directory_project_sources_authenticated_read" ON "public"."directory_project_sources" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((((EXISTS ( SELECT 1
   FROM directory_projects p
  WHERE ((p.id = directory_project_sources.project_id) AND p.public_visible AND (p.verification_status = 'published'::text)))) AND (EXISTS ( SELECT 1
   FROM directory_sources s
  WHERE ((s.id = directory_project_sources.source_id) AND s.is_public)))) OR ( SELECT layan_is_admin() AS layan_is_admin)));

CREATE POLICY "directory_projects_admin_delete" ON "public"."directory_projects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_projects_admin_insert" ON "public"."directory_projects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_projects_admin_update" ON "public"."directory_projects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin)) WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_projects_anon_read" ON "public"."directory_projects" AS PERMISSIVE FOR SELECT TO "anon" USING ((public_visible AND (verification_status = 'published'::text)));

CREATE POLICY "directory_projects_authenticated_read" ON "public"."directory_projects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((public_visible AND (verification_status = 'published'::text)) OR ( SELECT layan_is_admin() AS layan_is_admin)));

CREATE POLICY "directory_sources_admin_delete" ON "public"."directory_sources" AS PERMISSIVE FOR DELETE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_sources_admin_insert" ON "public"."directory_sources" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_sources_admin_update" ON "public"."directory_sources" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (( SELECT layan_is_admin() AS layan_is_admin)) WITH CHECK (( SELECT layan_is_admin() AS layan_is_admin));

CREATE POLICY "directory_sources_anon_read" ON "public"."directory_sources" AS PERMISSIVE FOR SELECT TO "anon" USING (is_public);

CREATE POLICY "directory_sources_authenticated_read" ON "public"."directory_sources" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_public OR ( SELECT layan_is_admin() AS layan_is_admin)));

CREATE POLICY "Public can read active marketplace categories" ON "public"."marketplace_categories" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ((is_active = true));

CREATE POLICY "Owners can submit pending marketplace listings" ON "public"."marketplace_listings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((( SELECT auth.uid() AS uid) = owner_id) AND (status = 'pending'::text) AND (is_featured = false) AND (reviewed_at IS NULL) AND (reviewed_by IS NULL) AND (admin_notes IS NULL)));

CREATE POLICY "marketplace_listings_authenticated_read" ON "public"."marketplace_listings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((status = 'approved'::text) OR (owner_id = ( SELECT auth.uid() AS uid)) OR layan_is_admin()));

CREATE POLICY "marketplace_listings_public_read" ON "public"."marketplace_listings" AS PERMISSIVE FOR SELECT TO "anon" USING ((status = 'approved'::text));

CREATE POLICY "marketplace_listings_update_scope" ON "public"."marketplace_listings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((layan_is_admin() OR ((owner_id = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['pending'::text, 'rejected'::text]))))) WITH CHECK ((layan_is_admin() OR ((owner_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text) AND (is_featured = false) AND (reviewed_at IS NULL) AND (reviewed_by IS NULL))));

CREATE POLICY "partner_ad_slots_admin_update" ON "public"."partner_ad_slots" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (layan_is_admin()) WITH CHECK (layan_is_admin());

CREATE POLICY "partner_ad_slots_authenticated_read" ON "public"."partner_ad_slots" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((status = 'active'::text) OR layan_is_admin()));

CREATE POLICY "partner_ad_slots_public_read" ON "public"."partner_ad_slots" AS PERMISSIVE FOR SELECT TO "anon" USING ((status = 'active'::text));

CREATE POLICY "promotion_payments_admin_read" ON "public"."promotion_payments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (layan_is_admin());

CREATE POLICY "property_offers_authenticated_read" ON "public"."property_offers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((status = 'available'::text) OR (owner_id = ( SELECT auth.uid() AS uid)) OR ((status = 'pending'::text) AND layan_is_admin())));

CREATE POLICY "property_offers_owner_submit" ON "public"."property_offers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text) AND (is_featured = false) AND (verification_status = 'pending'::text) AND (developer_approval_status = 'unknown'::text) AND (verified_at IS NULL) AND (featured_until IS NULL) AND (((featured_requested = false) AND (promotion_status = 'none'::text)) OR ((featured_requested = true) AND (promotion_status = 'requested'::text)))));

CREATE POLICY "property_offers_public_read" ON "public"."property_offers" AS PERMISSIVE FOR SELECT TO "anon" USING ((status = 'available'::text));

CREATE POLICY "supplier_ads_admin_update" ON "public"."supplier_ads" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (layan_is_admin()) WITH CHECK (layan_is_admin());

CREATE POLICY "supplier_ads_authenticated_read" ON "public"."supplier_ads" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((status = 'active'::text) OR (owner_id = ( SELECT auth.uid() AS uid)) OR layan_is_admin()));

CREATE POLICY "supplier_ads_owner_submit" ON "public"."supplier_ads" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text)));

CREATE POLICY "supplier_ads_public_read" ON "public"."supplier_ads" AS PERMISSIVE FOR SELECT TO "anon" USING ((status = 'active'::text));

CREATE POLICY "Users can add own favorites" ON "public"."user_favorite_offers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can delete own favorites" ON "public"."user_favorite_offers" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can read own favorites" ON "public"."user_favorite_offers" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id));


-- 5. Exact grants on application tables/views/sequences.
-- Exact application object privileges extracted from the production PostgreSQL catalogs.

-- Current state: PostgreSQL 17.11, ASYUT AQAR production, 2026-11-03.

-- Run only after restoring app tables/views. Not for the existing production database.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT USAGE ON SCHEMA private TO authenticated;

-- Reset API-role grants on the application-owned public/private relations before restoring captured grants.

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

REVOKE ALL PRIVILEGES ON TABLE "public"."marketplace_listings" FROM anon, authenticated, service_role;

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

GRANT SELECT ON TABLE "public"."marketplace_listings" TO "anon";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."marketplace_listings" TO "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."marketplace_listings" TO "service_role";

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

-- Sequence ACLs are captured from pg_class.relacl, not only USAGE from information_schema.

REVOKE ALL PRIVILEGES ON SEQUENCE "private"."project_decisions_id_seq" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON SEQUENCE "public"."promotion_payments_id_seq" FROM anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON SEQUENCE "public"."property_offers_id_seq" FROM anon, authenticated, service_role;

-- Sequence privileges verified in the source database:

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.property_offers_id_seq TO anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.promotion_payments_id_seq TO anon, authenticated, service_role;


-- 6. Supabase Storage table grants and current bucket metadata.
-- Existing application Storage bucket metadata captured from production.
-- Does not copy or modify storage.objects file contents.
-- Apply only to a clean Supabase project after Storage is enabled.

-- Match the source project's Storage API table ACLs; RLS policies remain the row-level boundary.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE storage.buckets TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE storage.buckets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE storage.objects TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE storage.objects TO service_role;

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES
 ('layan_real_estat','layan_real_estat',true,5242880,ARRAY['image/jpeg','image/png','image/webp']::text[]),
 ('layan-property-documents','layan-property-documents',false,10485760,ARRAY['application/pdf','image/jpeg','image/png']::text[])
ON CONFLICT (id) DO UPDATE SET
 name=EXCLUDED.name,
 public=EXCLUDED.public,
 file_size_limit=EXCLUDED.file_size_limit,
 allowed_mime_types=EXCLUDED.allowed_mime_types;


-- 7. Current Storage.objects RLS policies.
-- Application Storage.objects policies captured from the production catalog.

-- Keep these object-level policies in addition to Supabase's managed Storage internals.

-- No files or object metadata rows are exported.

DROP POLICY IF EXISTS "Authenticated users upload own LAYAN photos" ON storage.objects;

CREATE POLICY "Authenticated users upload own LAYAN photos" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'layan_real_estat'::text) AND ((storage.foldername(name))[1] = 'offers'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)));

DROP POLICY IF EXISTS "Owners and admins read LAYAN property documents" ON storage.objects;

CREATE POLICY "Owners and admins read LAYAN property documents" ON storage.objects AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'layan-property-documents'::text) AND (((storage.foldername(name))[1] = 'documents'::text) AND (((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text) OR ( SELECT layan_is_admin() AS layan_is_admin)))));

DROP POLICY IF EXISTS "Owners delete own LAYAN offer photos" ON storage.objects;

CREATE POLICY "Owners delete own LAYAN offer photos" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'layan_real_estat'::text) AND ((storage.foldername(name))[1] = 'offers'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)));

DROP POLICY IF EXISTS "Owners delete own LAYAN property documents" ON storage.objects;

CREATE POLICY "Owners delete own LAYAN property documents" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'layan-property-documents'::text) AND ((storage.foldername(name))[1] = 'documents'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)));

DROP POLICY IF EXISTS "Owners upload own LAYAN property documents" ON storage.objects;

CREATE POLICY "Owners upload own LAYAN property documents" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'layan-property-documents'::text) AND ((storage.foldername(name))[1] = 'documents'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)));

DROP POLICY IF EXISTS "Public can read LAYAN JPEG offer images" ON storage.objects;

CREATE POLICY "Public can read LAYAN JPEG offer images" ON storage.objects AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (((bucket_id = 'layan_real_estat'::text) AND (storage.extension(name) = 'jpg'::text) AND (lower((storage.foldername(name))[1]) = ANY (ARRAY['public'::text, 'offers'::text]))));


-- End of current-state baseline. Review all excluded environment data before use.