-- Catalog-derived constraints and secondary indexes for ASYUT AQAR.

-- Apply only after the table definitions snapshot; do not run on production.

SET search_path = public, private, extensions, auth;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Constraints

ALTER TABLE "private"."layan_admins" ADD CONSTRAINT "layan_admins_pkey" PRIMARY KEY (user_id);

ALTER TABLE "private"."layan_admins" ADD CONSTRAINT "layan_admins_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "private"."project_decisions" ADD CONSTRAINT "project_decisions_pkey" PRIMARY KEY (id);

ALTER TABLE "private"."project_decisions" ADD CONSTRAINT "project_decisions_project_key_key" UNIQUE (project_key);

ALTER TABLE "public"."buyer_offer_alerts" ADD CONSTRAINT "buyer_offer_alerts_offer_id_fkey" FOREIGN KEY (offer_id) REFERENCES property_offers(id) ON DELETE CASCADE;

ALTER TABLE "public"."buyer_offer_alerts" ADD CONSTRAINT "buyer_offer_alerts_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."buyer_offer_alerts" ADD CONSTRAINT "buyer_offer_alerts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."buyer_offer_alerts" ADD CONSTRAINT "buyer_offer_alerts_user_id_offer_id_key" UNIQUE (user_id, offer_id);

ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_max_monthly_installment_check" CHECK (max_monthly_installment >= 0::numeric);

ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_max_total_price_check" CHECK (max_total_price >= 0::numeric);

ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_max_upfront_check" CHECK (max_upfront >= 0::numeric);

ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_min_bedrooms_check" CHECK (min_bedrooms >= 0 AND min_bedrooms <= 20);

ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_owner_id_key" UNIQUE (owner_id);

ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."buyer_preferences" ADD CONSTRAINT "buyer_preferences_property_type_check" CHECK (property_type = ANY (ARRAY['شقة'::text, 'فيلا'::text, 'محل'::text, 'أرض'::text, 'أي نوع'::text]));

ALTER TABLE "public"."buyer_push_subscriptions" ADD CONSTRAINT "buyer_push_subscriptions_failure_count_check" CHECK (failure_count >= 0);

ALTER TABLE "public"."buyer_push_subscriptions" ADD CONSTRAINT "buyer_push_subscriptions_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."buyer_push_subscriptions" ADD CONSTRAINT "buyer_push_subscriptions_user_id_endpoint_key" UNIQUE (user_id, endpoint);

ALTER TABLE "public"."buyer_push_subscriptions" ADD CONSTRAINT "buyer_push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."buyer_push_vapid_config" ADD CONSTRAINT "buyer_push_vapid_config_id_check" CHECK (id = 1);

ALTER TABLE "public"."buyer_push_vapid_config" ADD CONSTRAINT "buyer_push_vapid_config_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_company_name_check" CHECK (char_length(TRIM(BOTH FROM company_name)) >= 2 AND char_length(TRIM(BOTH FROM company_name)) <= 140);

ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_description_check" CHECK (char_length(description) >= 20 AND char_length(description) <= 1200);

ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_pending_update_shape" CHECK (pending_update IS NULL OR jsonb_typeof(pending_update) = 'object'::text AND length(pending_update::text) <= 20000);

ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_phone_check" CHECK (char_length(phone) >= 7 AND char_length(phone) <= 30);

ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_projects_check" CHECK (jsonb_typeof(projects) = 'array'::text);

ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);

ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'rejected'::text, 'paused'::text, 'needs_changes'::text]));

ALTER TABLE "public"."company_profiles" ADD CONSTRAINT "company_profiles_update_status_check" CHECK (update_status IS NULL OR (update_status = ANY (ARRAY['pending'::text, 'needs_changes'::text, 'rejected'::text])));

ALTER TABLE "public"."company_property_ads" ADD CONSTRAINT "company_property_ads_business_name_check" CHECK (char_length(TRIM(BOTH FROM business_name)) >= 2 AND char_length(TRIM(BOTH FROM business_name)) <= 120);

ALTER TABLE "public"."company_property_ads" ADD CONSTRAINT "company_property_ads_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."company_property_ads" ADD CONSTRAINT "company_property_ads_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."company_property_ads" ADD CONSTRAINT "company_property_ads_plan_code_check" CHECK (plan_code = ANY (ARRAY['trial_30'::text, 'starter_15'::text, 'growth_30'::text, 'partner_90'::text]));

ALTER TABLE "public"."company_property_ads" ADD CONSTRAINT "company_property_ads_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'paused'::text, 'expired'::text, 'rejected'::text]));

ALTER TABLE "public"."directory_areas" ADD CONSTRAINT "directory_areas_area_type_check" CHECK (area_type = ANY (ARRAY['governorate'::text, 'center'::text, 'city'::text, 'new_city'::text, 'district'::text, 'neighborhood'::text, 'village'::text, 'zone'::text, 'industrial_zone'::text]));

ALTER TABLE "public"."directory_areas" ADD CONSTRAINT "directory_areas_legacy_code_key" UNIQUE (legacy_code);

ALTER TABLE "public"."directory_areas" ADD CONSTRAINT "directory_areas_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES directory_areas(id) ON DELETE RESTRICT;

ALTER TABLE "public"."directory_areas" ADD CONSTRAINT "directory_areas_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."directory_areas" ADD CONSTRAINT "directory_areas_slug_key" UNIQUE (slug);

ALTER TABLE "public"."directory_areas" ADD CONSTRAINT "directory_areas_verification_status_check" CHECK (verification_status = ANY (ARRAY['draft'::text, 'needs_review'::text, 'verified'::text, 'published'::text, 'archived'::text]));

ALTER TABLE "public"."directory_change_log" ADD CONSTRAINT "directory_change_log_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."directory_entities" ADD CONSTRAINT "directory_entities_entity_type_check" CHECK (entity_type = ANY (ARRAY['developer'::text, 'brokerage'::text, 'marketing'::text, 'contractor'::text, 'public_authority'::text, 'sales_office'::text, 'consultant'::text, 'other'::text]));

ALTER TABLE "public"."directory_entities" ADD CONSTRAINT "directory_entities_legacy_code_key" UNIQUE (legacy_code);

ALTER TABLE "public"."directory_entities" ADD CONSTRAINT "directory_entities_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."directory_entities" ADD CONSTRAINT "directory_entities_primary_area_id_fkey" FOREIGN KEY (primary_area_id) REFERENCES directory_areas(id) ON DELETE SET NULL;

ALTER TABLE "public"."directory_entities" ADD CONSTRAINT "directory_entities_slug_key" UNIQUE (slug);

ALTER TABLE "public"."directory_entities" ADD CONSTRAINT "directory_entities_verification_status_check" CHECK (verification_status = ANY (ARRAY['draft'::text, 'needs_review'::text, 'verified'::text, 'published'::text, 'archived'::text]));

ALTER TABLE "public"."directory_entity_areas" ADD CONSTRAINT "directory_entity_areas_area_id_fkey" FOREIGN KEY (area_id) REFERENCES directory_areas(id) ON DELETE RESTRICT;

ALTER TABLE "public"."directory_entity_areas" ADD CONSTRAINT "directory_entity_areas_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES directory_entities(id) ON DELETE CASCADE;

ALTER TABLE "public"."directory_entity_areas" ADD CONSTRAINT "directory_entity_areas_pkey" PRIMARY KEY (entity_id, area_id);

ALTER TABLE "public"."directory_entity_private" ADD CONSTRAINT "directory_entity_private_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES directory_entities(id) ON DELETE CASCADE;

ALTER TABLE "public"."directory_entity_private" ADD CONSTRAINT "directory_entity_private_pkey" PRIMARY KEY (entity_id);

ALTER TABLE "public"."directory_entity_sources" ADD CONSTRAINT "directory_entity_sources_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES directory_entities(id) ON DELETE CASCADE;

ALTER TABLE "public"."directory_entity_sources" ADD CONSTRAINT "directory_entity_sources_pkey" PRIMARY KEY (entity_id, source_id, claim_key);

ALTER TABLE "public"."directory_entity_sources" ADD CONSTRAINT "directory_entity_sources_source_id_fkey" FOREIGN KEY (source_id) REFERENCES directory_sources(id) ON DELETE RESTRICT;

ALTER TABLE "public"."directory_opportunities" ADD CONSTRAINT "directory_opportunities_legacy_code_key" UNIQUE (legacy_code);

ALTER TABLE "public"."directory_opportunities" ADD CONSTRAINT "directory_opportunities_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."directory_opportunities" ADD CONSTRAINT "directory_opportunities_slug_key" UNIQUE (slug);

ALTER TABLE "public"."directory_opportunities" ADD CONSTRAINT "directory_opportunities_verification_status_check" CHECK (verification_status = ANY (ARRAY['draft'::text, 'needs_review'::text, 'verified'::text, 'published'::text, 'archived'::text]));

ALTER TABLE "public"."directory_opportunity_sources" ADD CONSTRAINT "directory_opportunity_sources_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES directory_opportunities(id) ON DELETE CASCADE;

ALTER TABLE "public"."directory_opportunity_sources" ADD CONSTRAINT "directory_opportunity_sources_pkey" PRIMARY KEY (opportunity_id, source_id, claim_key);

ALTER TABLE "public"."directory_opportunity_sources" ADD CONSTRAINT "directory_opportunity_sources_source_id_fkey" FOREIGN KEY (source_id) REFERENCES directory_sources(id) ON DELETE RESTRICT;

ALTER TABLE "public"."directory_project_entities" ADD CONSTRAINT "directory_project_entities_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES directory_entities(id) ON DELETE RESTRICT;

ALTER TABLE "public"."directory_project_entities" ADD CONSTRAINT "directory_project_entities_pkey" PRIMARY KEY (project_id, entity_id, relation_type);

ALTER TABLE "public"."directory_project_entities" ADD CONSTRAINT "directory_project_entities_project_id_fkey" FOREIGN KEY (project_id) REFERENCES directory_projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."directory_project_entities" ADD CONSTRAINT "directory_project_entities_relation_type_check" CHECK (relation_type = ANY (ARRAY['developer'::text, 'land_owner'::text, 'marketing_agent'::text, 'sales_agent'::text, 'contractor'::text, 'consultant'::text, 'operator'::text, 'public_authority'::text, 'other'::text]));

ALTER TABLE "public"."directory_project_private" ADD CONSTRAINT "directory_project_private_pkey" PRIMARY KEY (project_id);

ALTER TABLE "public"."directory_project_private" ADD CONSTRAINT "directory_project_private_project_id_fkey" FOREIGN KEY (project_id) REFERENCES directory_projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."directory_project_sources" ADD CONSTRAINT "directory_project_sources_pkey" PRIMARY KEY (project_id, source_id, claim_key);

ALTER TABLE "public"."directory_project_sources" ADD CONSTRAINT "directory_project_sources_project_id_fkey" FOREIGN KEY (project_id) REFERENCES directory_projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."directory_project_sources" ADD CONSTRAINT "directory_project_sources_source_id_fkey" FOREIGN KEY (source_id) REFERENCES directory_sources(id) ON DELETE RESTRICT;

ALTER TABLE "public"."directory_projects" ADD CONSTRAINT "directory_projects_area_id_fkey" FOREIGN KEY (area_id) REFERENCES directory_areas(id) ON DELETE SET NULL;

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

ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_price_check" CHECK (price IS NULL OR price >= 0::numeric);

ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);

ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'paused'::text]));

ALTER TABLE "public"."marketplace_listings" ADD CONSTRAINT "marketplace_listings_title_check" CHECK (char_length(TRIM(BOTH FROM title)) >= 4 AND char_length(TRIM(BOTH FROM title)) <= 180);

ALTER TABLE "public"."partner_ad_slots" ADD CONSTRAINT "partner_ad_slots_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."partner_ad_slots" ADD CONSTRAINT "partner_ad_slots_slot_key_check" CHECK (slot_key = ANY (ARRAY['ceramics'::text, 'furniture'::text, 'curtains'::text, 'paint'::text]));

ALTER TABLE "public"."partner_ad_slots" ADD CONSTRAINT "partner_ad_slots_slot_key_key" UNIQUE (slot_key);

ALTER TABLE "public"."partner_ad_slots" ADD CONSTRAINT "partner_ad_slots_status_check" CHECK (status = ANY (ARRAY['active'::text, 'draft'::text, 'paused'::text]));

ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_amount_egp_check" CHECK (amount_egp > 0::numeric);

ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_duration_days_check" CHECK (duration_days = ANY (ARRAY[15, 30]));

ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_offer_id_fkey" FOREIGN KEY (offer_id) REFERENCES property_offers(id) ON DELETE RESTRICT;

ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_payment_method_check" CHECK (payment_method = 'vodafone_cash'::text);

ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text, 'expired'::text]));

ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "promotion_payments_transaction_reference_key" UNIQUE (transaction_reference);

ALTER TABLE "public"."promotion_payments" ADD CONSTRAINT "verified_payment_requires_reference" CHECK (status <> 'verified'::text OR transaction_reference IS NOT NULL AND verified_at IS NOT NULL);

ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_company_ad_id_fkey" FOREIGN KEY (company_ad_id) REFERENCES company_property_ads(id) ON DELETE SET NULL;

ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_coordinates_pair_check" CHECK (latitude IS NULL AND longitude IS NULL OR latitude IS NOT NULL AND longitude IS NOT NULL);

ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_developer_approval_status_check" CHECK (developer_approval_status = ANY (ARRAY['unknown'::text, 'pending'::text, 'approved'::text, 'rejected'::text]));

ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_latitude_range_check" CHECK (latitude IS NULL OR latitude >= '-90'::integer::numeric AND latitude <= 90::numeric);

ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_listing_purpose_check" CHECK (listing_purpose = ANY (ARRAY['بيع'::text, 'إيجار'::text, 'تنازل'::text]));

ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_longitude_range_check" CHECK (longitude IS NULL OR longitude >= '-180'::integer::numeric AND longitude <= 180::numeric);

ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_promotion_status_check" CHECK (promotion_status = ANY (ARRAY['none'::text, 'requested'::text, 'payment_pending'::text, 'active'::text, 'expired'::text, 'rejected'::text]));

ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'available'::text, 'reserved'::text, 'sold'::text]));

ALTER TABLE "public"."property_offers" ADD CONSTRAINT "property_offers_verification_status_check" CHECK (verification_status = ANY (ARRAY['pending'::text, 'under_review'::text, 'verified'::text, 'rejected'::text]));

ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_business_name_check" CHECK (char_length(business_name) >= 2 AND char_length(business_name) <= 120);

ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_contact_phone_check" CHECK (char_length(contact_phone) >= 7 AND char_length(contact_phone) <= 30);

ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_dates_check" CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at);

ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_description_check" CHECK (char_length(description) >= 5 AND char_length(description) <= 500);

ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_price_check" CHECK (price >= 0::numeric);

ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_requested_days_check" CHECK (requested_days >= 0 AND requested_days <= 365);

ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_requested_price_check" CHECK (requested_price >= 0::numeric);

ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'paused'::text, 'expired'::text, 'rejected'::text]));

ALTER TABLE "public"."supplier_ads" ADD CONSTRAINT "supplier_ads_title_check" CHECK (char_length(title) >= 3 AND char_length(title) <= 140);

ALTER TABLE "public"."user_favorite_offers" ADD CONSTRAINT "user_favorite_offers_offer_id_fkey" FOREIGN KEY (offer_id) REFERENCES property_offers(id) ON DELETE CASCADE;

ALTER TABLE "public"."user_favorite_offers" ADD CONSTRAINT "user_favorite_offers_pkey" PRIMARY KEY (user_id, offer_id);

ALTER TABLE "public"."user_favorite_offers" ADD CONSTRAINT "user_favorite_offers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Secondary indexes

CREATE INDEX buyer_offer_alerts_offer_id_idx ON public.buyer_offer_alerts USING btree (offer_id);

CREATE INDEX buyer_offer_alerts_user_created_idx ON public.buyer_offer_alerts USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX buyer_push_subscriptions_endpoint_uidx ON public.buyer_push_subscriptions USING btree (endpoint);

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
