-- Ensure the public company directory view obeys the querying role's privileges and RLS.
-- The base table exposes only approved columns to anon/authenticated, and its SELECT policy
-- limits results to active company profiles.
ALTER VIEW public.company_profiles_public
  SET (security_invoker = true);

DO $verification$
DECLARE
  v_options text[];
BEGIN
  SELECT reloptions
    INTO v_options
    FROM pg_class
   WHERE oid = 'public.company_profiles_public'::regclass;

  IF NOT COALESCE(v_options @> ARRAY['security_invoker=true'], false) THEN
    RAISE EXCEPTION 'company_profiles_public must use security_invoker=true';
  END IF;
END;
$verification$;
