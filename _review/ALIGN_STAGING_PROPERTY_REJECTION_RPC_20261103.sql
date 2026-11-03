-- STAGING ONLY — reconcile property-offer review RPC with production baseline.
-- This restores the production wrapper and preserves the existing function ACL.
-- Do not run this script against production; production already has this definition.

BEGIN;

CREATE OR REPLACE FUNCTION public.layan_admin_review_property_offer(
  p_id bigint,
  p_action text,
  p_notes text DEFAULT NULL::text
)
RETURNS void
LANGUAGE sql
SET search_path TO ''
AS $function$
  SELECT private.layan_admin_review_property_offer(p_id, p_action, p_notes);
$function$;

COMMIT;
