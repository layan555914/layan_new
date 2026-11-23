-- ASYUT AQAR guest intake. Public clients never write directly to property_offers,
-- buyer_preferences, or private submission tables. Only the guest-intake Edge Function
-- (service_role) can accept submissions and issue temporary upload tickets.

CREATE TABLE IF NOT EXISTS private.guest_submission_rate_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_kind text NOT NULL CHECK (submission_kind IN ('property','buyer','upload')),
  fingerprint_hash text NOT NULL CHECK (fingerprint_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guest_submission_rate_events_lookup
  ON private.guest_submission_rate_events (submission_kind, fingerprint_hash, created_at DESC);
REVOKE ALL ON private.guest_submission_rate_events FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS private.guest_property_submissions (
  id uuid PRIMARY KEY,
  payload jsonb NOT NULL,
  image_paths text[] NOT NULL DEFAULT '{}',
  document_paths text[] NOT NULL DEFAULT '{}',
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_consent boolean NOT NULL DEFAULT false,
  fingerprint_hash text NOT NULL CHECK (fingerprint_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_note text,
  published_offer_id bigint REFERENCES public.property_offers(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS guest_property_submissions_pending
  ON private.guest_property_submissions (created_at DESC) WHERE status='pending';
REVOKE ALL ON private.guest_property_submissions FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS private.guest_buyer_requests (
  id uuid PRIMARY KEY,
  payload jsonb NOT NULL,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  fingerprint_hash text NOT NULL CHECK (fingerprint_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','contacted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_note text
);
CREATE INDEX IF NOT EXISTS guest_buyer_requests_pending
  ON private.guest_buyer_requests (created_at DESC) WHERE status='pending';
REVOKE ALL ON private.guest_buyer_requests FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE private.guest_submission_rate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.guest_property_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.guest_buyer_requests ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('asyut-guest-intake','asyut-guest-intake',false,15728640,
        ARRAY['image/jpeg','application/pdf','image/png']::text[])
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name, public=false, file_size_limit=EXCLUDED.file_size_limit,
  allowed_mime_types=EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.layan_guest_take_rate_slot(
  p_kind text, p_fingerprint_hash text, p_limit integer DEFAULT 5, p_window_minutes integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     OR p_kind NOT IN ('property','buyer','upload')
     OR p_fingerprint_hash !~ '^[0-9a-f]{64}$'
     OR p_limit < 1 OR p_limit > 30
     OR p_window_minutes < 1 OR p_window_minutes > 1440 THEN
    RAISE EXCEPTION 'Invalid guest rate-limit request' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_kind || ':' || p_fingerprint_hash, 0));
  DELETE FROM private.guest_submission_rate_events
   WHERE created_at < now() - interval '2 days';
  SELECT count(*) INTO v_count
    FROM private.guest_submission_rate_events
   WHERE submission_kind=p_kind AND fingerprint_hash=p_fingerprint_hash
     AND created_at >= now() - make_interval(mins => p_window_minutes);
  IF v_count >= p_limit THEN RETURN false; END IF;
  INSERT INTO private.guest_submission_rate_events(submission_kind,fingerprint_hash)
  VALUES(p_kind,p_fingerprint_hash);
  RETURN true;
END
$function$;
REVOKE ALL ON FUNCTION public.layan_guest_take_rate_slot(text,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.layan_guest_take_rate_slot(text,text,integer,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.layan_guest_submit_property(
  p_id uuid, p_payload jsonb, p_image_paths text[], p_document_paths text[], p_fingerprint_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_name text; v_phone text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Guest submissions must pass through the intake service' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_payload) <> 'object'
     OR length(trim(COALESCE(p_payload->>'title',''))) < 5
     OR length(trim(COALESCE(p_payload->>'title',''))) > 180
     OR p_payload->>'listing_purpose' NOT IN ('بيع','إيجار','تنازل')
     OR length(trim(COALESCE(p_payload->>'property_type',''))) < 2
     OR length(trim(COALESCE(p_payload->>'city',''))) < 2
     OR length(trim(COALESCE(p_payload->>'area',''))) < 2
     OR length(trim(COALESCE(p_payload->>'contact_name',''))) < 2
     OR length(trim(COALESCE(p_payload->>'contact_name',''))) > 120
     OR COALESCE(p_payload->>'contact_phone','') !~ '^[0-9+() -]{7,20}$'
     OR p_fingerprint_hash !~ '^[0-9a-f]{64}$'
     OR cardinality(COALESCE(p_image_paths,'{}')) > 8
     OR cardinality(COALESCE(p_document_paths,'{}')) > 5 THEN
    RAISE EXCEPTION 'بيانات الإعلان غير مكتملة أو غير صالحة' USING ERRCODE='22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_image_paths,'{}')) AS x(path)
    WHERE path !~ ('^pending/' || p_id::text || '/images/[0-9a-f-]{36}\.jpg$')
  ) OR EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_document_paths,'{}')) AS x(path)
    WHERE path !~ ('^pending/' || p_id::text || '/documents/[0-9a-f-]{36}\.(pdf|jpg|png)$')
  ) THEN
    RAISE EXCEPTION 'مسارات الملفات المؤقتة غير صالحة' USING ERRCODE='22023';
  END IF;
  v_name := trim(p_payload->>'contact_name');
  v_phone := regexp_replace(p_payload->>'contact_phone','\s','','g');
  INSERT INTO private.guest_property_submissions(
    id,payload,image_paths,document_paths,contact_name,contact_phone,contact_consent,fingerprint_hash
  ) VALUES (
    p_id,
    p_payload - 'status' - 'owner_id' - 'company_ad_id' - 'is_featured' - 'featured_until',
    COALESCE(p_image_paths,'{}'), COALESCE(p_document_paths,'{}'),
    v_name,v_phone,COALESCE((p_payload->>'contact_consent')::boolean,false),p_fingerprint_hash
  ) ON CONFLICT (id) DO NOTHING;
  RETURN p_id;
END
$function$;
REVOKE ALL ON FUNCTION public.layan_guest_submit_property(uuid,jsonb,text[],text[],text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.layan_guest_submit_property(uuid,jsonb,text[],text[],text) TO service_role;

CREATE OR REPLACE FUNCTION public.layan_guest_submit_buyer(
  p_id uuid, p_payload jsonb, p_fingerprint_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Guest requests must pass through the intake service' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_payload) <> 'object'
     OR length(trim(COALESCE(p_payload->>'contact_name',''))) < 2
     OR length(trim(COALESCE(p_payload->>'contact_name',''))) > 120
     OR COALESCE(p_payload->>'contact_phone','') !~ '^[0-9+() -]{7,20}$'
     OR length(COALESCE(p_payload->>'notes','')) > 500
     OR p_fingerprint_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'بيانات طلب البحث غير مكتملة أو غير صالحة' USING ERRCODE='22023';
  END IF;
  INSERT INTO private.guest_buyer_requests(id,payload,contact_name,contact_phone,fingerprint_hash)
  VALUES(
    p_id,
    p_payload - 'owner_id' - 'status' - 'notifications_enabled' - 'all_notifications_enabled',
    trim(p_payload->>'contact_name'),
    regexp_replace(p_payload->>'contact_phone','\s','','g'),
    p_fingerprint_hash
  ) ON CONFLICT (id) DO NOTHING;
  RETURN p_id;
END
$function$;
REVOKE ALL ON FUNCTION public.layan_guest_submit_buyer(uuid,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.layan_guest_submit_buyer(uuid,jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.layan_admin_list_guest_property_submissions(p_limit integer DEFAULT 100)
RETURNS TABLE(id uuid,payload jsonb,image_paths text[],document_paths text[],contact_name text,contact_phone text,contact_consent boolean,status text,created_at timestamptz,review_note text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT s.id,s.payload,s.image_paths,s.document_paths,s.contact_name,s.contact_phone,
    s.contact_consent,s.status,s.created_at,s.review_note
  FROM private.guest_property_submissions s
  WHERE s.status='pending' ORDER BY s.created_at DESC LIMIT greatest(1,least(p_limit,200));
END
$function$;
REVOKE ALL ON FUNCTION public.layan_admin_list_guest_property_submissions(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_list_guest_property_submissions(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.layan_admin_list_guest_buyer_requests(p_limit integer DEFAULT 100)
RETURNS TABLE(id uuid,payload jsonb,contact_name text,contact_phone text,status text,created_at timestamptz,review_note text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT s.id,s.payload,s.contact_name,s.contact_phone,s.status,s.created_at,s.review_note
  FROM private.guest_buyer_requests s
  WHERE s.status='pending' ORDER BY s.created_at DESC LIMIT greatest(1,least(p_limit,200));
END
$function$;
REVOKE ALL ON FUNCTION public.layan_admin_list_guest_buyer_requests(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_list_guest_buyer_requests(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.layan_guest_pending_property_ids()
RETURNS uuid[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';
  END IF;
  RETURN COALESCE((SELECT array_agg(id) FROM private.guest_property_submissions WHERE status='pending'),'{}'::uuid[]);
END
$function$;
REVOKE ALL ON FUNCTION public.layan_guest_pending_property_ids() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.layan_guest_pending_property_ids() TO service_role;

CREATE OR REPLACE FUNCTION public.layan_guest_get_property_submission(p_id uuid)
RETURNS TABLE(id uuid,payload jsonb,image_paths text[],document_paths text[],contact_name text,contact_phone text,contact_consent boolean,status text,published_offer_id bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT s.id,s.payload,s.image_paths,s.document_paths,s.contact_name,s.contact_phone,s.contact_consent,s.status,s.published_offer_id
  FROM private.guest_property_submissions s WHERE s.id=p_id;
END
$function$;
REVOKE ALL ON FUNCTION public.layan_guest_get_property_submission(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.layan_guest_get_property_submission(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.layan_admin_publish_guest_property_submission(p_id uuid,p_image_urls text[])
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE s private.guest_property_submissions%ROWTYPE; v_offer_id bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_owner() THEN
    RAISE EXCEPTION 'نشر إعلانات الزوار متاح لمالك المنصة فقط' USING ERRCODE='42501';
  END IF;
  SELECT * INTO s FROM private.guest_property_submissions WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'طلب الزائر غير موجود' USING ERRCODE='P0002'; END IF;
  IF s.status='approved' AND s.published_offer_id IS NOT NULL THEN RETURN s.published_offer_id; END IF;
  IF s.status <> 'pending' THEN RAISE EXCEPTION 'طلب الزائر تمت مراجعته بالفعل' USING ERRCODE='P0002'; END IF;
  IF cardinality(COALESCE(p_image_urls,'{}')) > 8
     OR EXISTS (SELECT 1 FROM unnest(COALESCE(p_image_urls,'{}')) AS x(url)
                WHERE url !~ '^https://[^/]+/storage/v1/object/public/layan_real_estat/offers/guest/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$') THEN
    RAISE EXCEPTION 'روابط صور الإعلان غير صالحة' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.property_offers(
    title,listing_purpose,land_ownership_authority,land_permit_details,land_utilities,land_zoning,
    governorate,city,area,latitude,longitude,area_m2,bedrooms,bathrooms,monthly_installment,
    property_type,rental_period,rental_furnishing,rental_security_deposit,rental_minimum_months,
    description,price_on_request,total_price,down_payment,paid_amount,remaining_amount,remaining_installments,
    assignment_fee,assignment_fee_percentage,discount_amount,discount_percent,developer_name,project_name,
    document_urls,image_urls,contact_name,contact_phone,featured_requested,is_featured,promotion_status,
    status,verification_status,verified_at,verification_notes
  ) VALUES (
    s.payload->>'title',s.payload->>'listing_purpose',s.payload->>'land_ownership_authority',
    s.payload->>'land_permit_details',s.payload->>'land_utilities',s.payload->>'land_zoning',
    'أسيوط',s.payload->>'city',s.payload->>'area',
    NULLIF(s.payload->>'latitude','')::numeric,NULLIF(s.payload->>'longitude','')::numeric,
    NULLIF(s.payload->>'area_m2','')::numeric,NULLIF(s.payload->>'bedrooms','')::integer,
    NULLIF(s.payload->>'bathrooms','')::integer,NULLIF(s.payload->>'monthly_installment','')::numeric,
    s.payload->>'property_type',s.payload->>'rental_period',s.payload->>'rental_furnishing',
    NULLIF(s.payload->>'rental_security_deposit','')::numeric,NULLIF(s.payload->>'rental_minimum_months','')::integer,
    s.payload->>'description',COALESCE((s.payload->>'price_on_request')::boolean,false),
    CASE WHEN COALESCE((s.payload->>'price_on_request')::boolean,false) THEN NULL ELSE NULLIF(s.payload->>'total_price','')::numeric END,
    COALESCE(NULLIF(s.payload->>'down_payment','')::numeric,0),COALESCE(NULLIF(s.payload->>'paid_amount','')::numeric,0),
    COALESCE(NULLIF(s.payload->>'remaining_amount','')::numeric,0),NULLIF(s.payload->>'remaining_installments','')::numeric,
    COALESCE(NULLIF(s.payload->>'assignment_fee','')::numeric,0),COALESCE(NULLIF(s.payload->>'assignment_fee_percentage','')::numeric,0),
    COALESCE(NULLIF(s.payload->>'discount_amount','')::numeric,0),COALESCE(NULLIF(s.payload->>'discount_percent','')::numeric,0),
    s.payload->>'developer_name',s.payload->>'project_name','[]'::jsonb,to_jsonb(COALESCE(p_image_urls,'{}')),
    s.contact_name,CASE WHEN s.contact_consent THEN s.contact_phone ELSE NULL END,
    COALESCE((s.payload->>'featured_requested')::boolean,false),false,
    CASE WHEN COALESCE((s.payload->>'featured_requested')::boolean,false) THEN 'requested' ELSE 'none' END,
    'available','verified',now(),null
  ) RETURNING id INTO v_offer_id;
  UPDATE private.guest_property_submissions
     SET status='approved',reviewed_at=now(),reviewed_by=auth.uid(),published_offer_id=v_offer_id
   WHERE id=p_id;
  RETURN v_offer_id;
END
$function$;
REVOKE ALL ON FUNCTION public.layan_admin_publish_guest_property_submission(uuid,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_publish_guest_property_submission(uuid,text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.layan_admin_reject_guest_property_submission(p_id uuid,p_note text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_owner() THEN
    RAISE EXCEPTION 'مراجعة طلبات الزوار متاحة لمالك المنصة فقط' USING ERRCODE='42501';
  END IF;
  UPDATE private.guest_property_submissions SET status='rejected',reviewed_at=now(),reviewed_by=auth.uid(),review_note=left(p_note,300)
   WHERE id=p_id AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'طلب الزائر غير موجود أو تمت مراجعته بالفعل' USING ERRCODE='P0002'; END IF;
  RETURN true;
END
$function$;
REVOKE ALL ON FUNCTION public.layan_admin_reject_guest_property_submission(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_reject_guest_property_submission(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.layan_admin_review_guest_buyer_request(p_id uuid,p_status text,p_note text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() OR p_status NOT IN ('contacted','rejected') THEN
    RAISE EXCEPTION 'مراجعة طلبات الباحثين غير مسموحة' USING ERRCODE='42501';
  END IF;
  UPDATE private.guest_buyer_requests SET status=p_status,reviewed_at=now(),reviewed_by=auth.uid(),review_note=left(p_note,300)
   WHERE id=p_id AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'طلب الباحث غير موجود أو تمت مراجعته بالفعل' USING ERRCODE='P0002'; END IF;
  RETURN true;
END
$function$;
REVOKE ALL ON FUNCTION public.layan_admin_review_guest_buyer_request(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_review_guest_buyer_request(uuid,text,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
