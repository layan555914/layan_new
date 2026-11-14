-- Grant only the verification timestamp required by the public invoker view.
-- Do not grant table-wide SELECT; owner and administrative fields remain private.
GRANT SELECT (verified_at)
  ON TABLE public.company_profiles
  TO anon, authenticated;

ALTER VIEW public.company_profiles_public
  SET (security_invoker = true);

DO $verification$
BEGIN
  IF NOT has_column_privilege('anon','public.company_profiles','verified_at','SELECT')
     OR NOT has_column_privilege('authenticated','public.company_profiles','verified_at','SELECT') THEN
    RAISE EXCEPTION 'Public company profile view is missing the verified_at column grant';
  END IF;

  IF has_column_privilege('anon','public.company_profiles','owner_id','SELECT')
     OR has_column_privilege('authenticated','public.company_profiles','owner_id','SELECT') THEN
    RAISE EXCEPTION 'Owner ID must not be readable by browser roles';
  END IF;

  IF NOT COALESCE(
    (SELECT reloptions @> ARRAY['security_invoker=true']
       FROM pg_class
      WHERE oid='public.company_profiles_public'::regclass),
    false
  ) THEN
    RAISE EXCEPTION 'company_profiles_public must use invoker security';
  END IF;
END;
$verification$;
