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
