-- ASYUT AQAR CRM: private business prospect tracking for sponsors and advertisers.
-- Direct writes are owner-only; added admins use the existing layan_admin_request_change approval gate.
-- This data is internal and must never be exposed to anonymous visitors.

CREATE TABLE public.advertiser_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name text NOT NULL,
  organization_type text NOT NULL DEFAULT 'other',
  contact_name text,
  contact_phone text,
  contact_whatsapp text,
  contact_email text,
  website_url text,
  governorate text NOT NULL DEFAULT 'أسيوط',
  city text,
  area text,
  lead_source text,
  interest text,
  stage text NOT NULL DEFAULT 'new',
  priority text NOT NULL DEFAULT 'normal',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  next_follow_up_at timestamptz,
  last_contact_at timestamptz,
  notes text,
  archived_at timestamptz,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT advertiser_leads_name_check
    CHECK (char_length(btrim(organization_name)) BETWEEN 2 AND 180),
  CONSTRAINT advertiser_leads_type_check
    CHECK (organization_type IN (
      'developer','brokerage','real_estate_office','bank_finance',
      'building_materials','manufacturer','finishing_furniture',
      'service_provider','sponsor','other'
    )),
  CONSTRAINT advertiser_leads_stage_check
    CHECK (stage IN ('new','contacted','interested','follow_up','negotiation','converted','not_interested')),
  CONSTRAINT advertiser_leads_priority_check
    CHECK (priority IN ('low','normal','high')),
  CONSTRAINT advertiser_leads_phone_check
    CHECK (contact_phone IS NULL OR (
      char_length(btrim(contact_phone)) BETWEEN 7 AND 30
      AND char_length(regexp_replace(contact_phone, '[^0-9]', '', 'g')) BETWEEN 7 AND 20
    )),
  CONSTRAINT advertiser_leads_whatsapp_check
    CHECK (contact_whatsapp IS NULL OR (
      char_length(btrim(contact_whatsapp)) BETWEEN 7 AND 30
      AND char_length(regexp_replace(contact_whatsapp, '[^0-9]', '', 'g')) BETWEEN 7 AND 20
    )),
  CONSTRAINT advertiser_leads_email_check
    CHECK (contact_email IS NULL OR char_length(btrim(contact_email)) <= 160),
  CONSTRAINT advertiser_leads_website_check
    CHECK (website_url IS NULL OR website_url ~* '^https?://'),
  CONSTRAINT advertiser_leads_interest_check
    CHECK (interest IS NULL OR char_length(interest) <= 1000),
  CONSTRAINT advertiser_leads_notes_check
    CHECK (notes IS NULL OR char_length(notes) <= 3000)
);

CREATE TABLE public.advertiser_lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.advertiser_leads(id) ON DELETE RESTRICT,
  activity_type text NOT NULL,
  outcome text NOT NULL DEFAULT 'completed',
  notes text,
  next_follow_up_at timestamptz,
  stage_after text,
  actor_user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT advertiser_lead_activities_type_check
    CHECK (activity_type IN ('call','whatsapp','meeting','email','visit','note')),
  CONSTRAINT advertiser_lead_activities_outcome_check
    CHECK (outcome IN ('completed','no_answer','interested','needs_details','follow_up','not_interested','other')),
  CONSTRAINT advertiser_lead_activities_notes_check
    CHECK (notes IS NULL OR char_length(notes) <= 1600),
  CONSTRAINT advertiser_lead_activities_stage_check
    CHECK (stage_after IS NULL OR stage_after IN (
      'new','contacted','interested','follow_up','negotiation','converted','not_interested'
    ))
);

CREATE INDEX advertiser_leads_stage_follow_up_idx
  ON public.advertiser_leads(stage, next_follow_up_at)
  WHERE archived_at IS NULL;
CREATE INDEX advertiser_leads_type_created_idx
  ON public.advertiser_leads(organization_type, created_at DESC)
  WHERE archived_at IS NULL;
CREATE INDEX advertiser_leads_assigned_to_idx
  ON public.advertiser_leads(assigned_to, next_follow_up_at)
  WHERE archived_at IS NULL;
CREATE INDEX advertiser_leads_name_lower_idx
  ON public.advertiser_leads(lower(organization_name));
CREATE INDEX advertiser_lead_activities_lead_created_idx
  ON public.advertiser_lead_activities(lead_id, created_at DESC);

ALTER TABLE public.advertiser_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertiser_lead_activities ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.advertiser_leads FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.advertiser_lead_activities FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.advertiser_leads TO authenticated;
GRANT SELECT, INSERT ON TABLE public.advertiser_lead_activities TO authenticated;

CREATE POLICY advertiser_leads_admin_read
  ON public.advertiser_leads FOR SELECT TO authenticated
  USING (private.layan_is_admin());
CREATE POLICY advertiser_leads_owner_insert
  ON public.advertiser_leads FOR INSERT TO authenticated
  WITH CHECK (
    private.layan_is_owner()
    AND created_by = (SELECT auth.uid())
    AND (updated_by IS NULL OR updated_by = (SELECT auth.uid()))
  );
CREATE POLICY advertiser_leads_owner_update
  ON public.advertiser_leads FOR UPDATE TO authenticated
  USING (private.layan_is_owner())
  WITH CHECK (private.layan_is_owner());

CREATE POLICY advertiser_lead_activities_admin_read
  ON public.advertiser_lead_activities FOR SELECT TO authenticated
  USING (private.layan_is_admin());
CREATE POLICY advertiser_lead_activities_owner_insert
  ON public.advertiser_lead_activities FOR INSERT TO authenticated
  WITH CHECK (
    private.layan_is_owner()
    AND actor_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.advertiser_leads l
      WHERE l.id = advertiser_lead_activities.lead_id
    )
  );

CREATE OR REPLACE FUNCTION private.asyut_crm_sync_lead_after_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  UPDATE public.advertiser_leads
     SET last_contact_at = CASE
           WHEN NEW.activity_type = 'note' THEN last_contact_at
           ELSE GREATEST(COALESCE(last_contact_at, NEW.created_at), NEW.created_at)
         END,
         next_follow_up_at = COALESCE(NEW.next_follow_up_at, next_follow_up_at),
         stage = COALESCE(NEW.stage_after, stage),
         updated_by = (SELECT auth.uid()),
         updated_at = now()
   WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.asyut_crm_sync_lead_after_activity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER advertiser_lead_activities_sync_lead
  AFTER INSERT ON public.advertiser_lead_activities
  FOR EACH ROW
  EXECUTE FUNCTION private.asyut_crm_sync_lead_after_activity();

COMMENT ON TABLE public.advertiser_leads IS
  'Internal ASYUT AQAR CRM prospects: advertisers, sponsors, developers, brokerages and service providers. Not public directory data.';
COMMENT ON TABLE public.advertiser_lead_activities IS
  'Append-only internal contact and follow-up history for advertiser CRM leads.';
