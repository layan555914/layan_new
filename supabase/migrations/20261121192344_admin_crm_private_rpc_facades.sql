-- Move privileged CRM RPC implementations out of the exposed public schema.
-- Public RPC names and signatures remain stable for the existing admin UI.
-- This migration is additive to the CRM schema migration and does not touch production by itself.

-- Move the already-reviewed SECURITY DEFINER implementations into private.
ALTER FUNCTION public.layan_admin_list_crm_leads(text,text,text,text,integer) SET SCHEMA private;
ALTER FUNCTION public.layan_admin_list_crm_archived(text,text,text,integer) SET SCHEMA private;
ALTER FUNCTION public.layan_admin_list_crm_summary() SET SCHEMA private;
ALTER FUNCTION public.layan_admin_list_crm_activities(uuid,integer) SET SCHEMA private;
ALTER FUNCTION public.layan_admin_crm_save_lead(uuid,text,text,text,text,text,text,text,text,text,text,text,text,uuid,timestamptz,text) SET SCHEMA private;
ALTER FUNCTION public.layan_admin_crm_log_activity(uuid,text,text,text,timestamptz) SET SCHEMA private;
ALTER FUNCTION public.layan_admin_crm_archive_lead(uuid) SET SCHEMA private;
ALTER FUNCTION public.layan_admin_crm_restore_lead(uuid) SET SCHEMA private;

-- The implementations remain SECURITY DEFINER, but only the invoker facades below
-- are exposed through PostgREST. Their internal authorization checks are unchanged.
ALTER FUNCTION private.layan_admin_list_crm_leads(text,text,text,text,integer) SECURITY DEFINER;
ALTER FUNCTION private.layan_admin_list_crm_archived(text,text,text,integer) SECURITY DEFINER;
ALTER FUNCTION private.layan_admin_list_crm_summary() SECURITY DEFINER;
ALTER FUNCTION private.layan_admin_list_crm_activities(uuid,integer) SECURITY DEFINER;
ALTER FUNCTION private.layan_admin_crm_save_lead(uuid,text,text,text,text,text,text,text,text,text,text,text,text,uuid,timestamptz,text) SECURITY DEFINER;
ALTER FUNCTION private.layan_admin_crm_log_activity(uuid,text,text,text,timestamptz) SECURITY DEFINER;
ALTER FUNCTION private.layan_admin_crm_archive_lead(uuid) SECURITY DEFINER;
ALTER FUNCTION private.layan_admin_crm_restore_lead(uuid) SECURITY DEFINER;

-- Authenticated callers may invoke the private helpers only through an authenticated
-- database role; the private schema is not exposed as a PostgREST API schema.
GRANT USAGE ON SCHEMA private TO authenticated;

REVOKE ALL ON FUNCTION private.layan_admin_list_crm_leads(text,text,text,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.layan_admin_list_crm_archived(text,text,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.layan_admin_list_crm_summary() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.layan_admin_list_crm_activities(uuid,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.layan_admin_crm_save_lead(uuid,text,text,text,text,text,text,text,text,text,text,text,text,uuid,timestamptz,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.layan_admin_crm_log_activity(uuid,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.layan_admin_crm_archive_lead(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.layan_admin_crm_restore_lead(uuid) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION private.layan_admin_list_crm_leads(text,text,text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION private.layan_admin_list_crm_archived(text,text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION private.layan_admin_list_crm_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION private.layan_admin_list_crm_activities(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION private.layan_admin_crm_save_lead(uuid,text,text,text,text,text,text,text,text,text,text,text,text,uuid,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.layan_admin_crm_log_activity(uuid,text,text,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION private.layan_admin_crm_archive_lead(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.layan_admin_crm_restore_lead(uuid) TO authenticated;

-- Public facades use invoker rights and preserve the RPC contract consumed by admin-crm.js.
CREATE OR REPLACE FUNCTION public.layan_admin_list_crm_leads(
  p_search text DEFAULT NULL,p_stage text DEFAULT NULL,p_category text DEFAULT NULL,
  p_due text DEFAULT 'all',p_limit integer DEFAULT 200
)
RETURNS TABLE (
  id uuid,category text,name text,contact_name text,phone text,whatsapp text,email text,
  website text,region text,source text,interest text,suitable_offer text,stage text,
  assigned_to uuid,assigned_to_email text,next_follow_up_at timestamptz,last_contact_at timestamptz,
  notes text,created_at timestamptz,updated_at timestamptz,activities_count bigint
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $function$
  SELECT * FROM private.layan_admin_list_crm_leads(p_search,p_stage,p_category,p_due,p_limit);
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_list_crm_archived(
  p_search text DEFAULT NULL,p_stage text DEFAULT NULL,p_category text DEFAULT NULL,p_limit integer DEFAULT 200
)
RETURNS TABLE (
  id uuid,category text,name text,contact_name text,phone text,whatsapp text,email text,
  website text,region text,source text,interest text,suitable_offer text,stage text,
  assigned_to uuid,assigned_to_email text,next_follow_up_at timestamptz,last_contact_at timestamptz,
  notes text,created_at timestamptz,updated_at timestamptz,activities_count bigint
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $function$
  SELECT * FROM private.layan_admin_list_crm_archived(p_search,p_stage,p_category,p_limit);
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_list_crm_summary()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $function$
  SELECT private.layan_admin_list_crm_summary();
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_list_crm_activities(p_lead_id uuid,p_limit integer DEFAULT 100)
RETURNS TABLE (
  id uuid,activity_type text,outcome text,notes text,occurred_at timestamptz,created_by uuid,actor_email text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $function$
  SELECT * FROM private.layan_admin_list_crm_activities(p_lead_id,p_limit);
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_crm_save_lead(
  p_id uuid,p_category text,p_name text,p_contact_name text,p_phone text,p_whatsapp text,
  p_email text,p_website text,p_region text,p_source text,p_interest text,p_suitable_offer text,
  p_stage text,p_assigned_to uuid,p_next_follow_up_at timestamptz,p_notes text
)
RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $function$
  SELECT private.layan_admin_crm_save_lead(
    p_id,p_category,p_name,p_contact_name,p_phone,p_whatsapp,p_email,p_website,p_region,
    p_source,p_interest,p_suitable_offer,p_stage,p_assigned_to,p_next_follow_up_at,p_notes
  );
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_crm_log_activity(
  p_lead_id uuid,p_activity_type text,p_outcome text,p_notes text,p_occurred_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $function$
  SELECT private.layan_admin_crm_log_activity(p_lead_id,p_activity_type,p_outcome,p_notes,p_occurred_at);
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_crm_archive_lead(p_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $function$
  SELECT private.layan_admin_crm_archive_lead(p_id);
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_crm_restore_lead(p_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $function$
  SELECT private.layan_admin_crm_restore_lead(p_id);
$function$;

REVOKE ALL ON FUNCTION public.layan_admin_list_crm_leads(text,text,text,text,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.layan_admin_list_crm_archived(text,text,text,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.layan_admin_list_crm_summary() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.layan_admin_list_crm_activities(uuid,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.layan_admin_crm_save_lead(uuid,text,text,text,text,text,text,text,text,text,text,text,text,uuid,timestamptz,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.layan_admin_crm_log_activity(uuid,text,text,text,timestamptz) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.layan_admin_crm_archive_lead(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.layan_admin_crm_restore_lead(uuid) FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION public.layan_admin_list_crm_leads(text,text,text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.layan_admin_list_crm_archived(text,text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.layan_admin_list_crm_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.layan_admin_list_crm_activities(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.layan_admin_crm_save_lead(uuid,text,text,text,text,text,text,text,text,text,text,text,text,uuid,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.layan_admin_crm_log_activity(uuid,text,text,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.layan_admin_crm_archive_lead(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.layan_admin_crm_restore_lead(uuid) TO authenticated;

COMMENT ON FUNCTION public.layan_admin_list_crm_leads(text,text,text,text,integer) IS
  'Authenticated invoker facade; privileged CRM read logic lives in private schema.';
COMMENT ON FUNCTION public.layan_admin_crm_save_lead(uuid,text,text,text,text,text,text,text,text,text,text,text,text,uuid,timestamptz,text) IS
  'Authenticated invoker facade; owner-only CRM write logic lives in private schema.';
