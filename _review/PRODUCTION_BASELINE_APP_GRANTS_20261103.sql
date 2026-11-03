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
