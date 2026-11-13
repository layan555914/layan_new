-- ASYUT AQAR internal CRM for prospective advertisers and sponsors.
-- Additive only: private admin data, isolated from customer accounts and visitor activity.
-- Deploy only after the production migration-ledger reconciliation is separately approved.

CREATE TABLE IF NOT EXISTS private.admin_crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Phase 1: real-estate companies and related commercial partners only.
  -- Service providers, suppliers, finishing and furniture are added in phase 2.
  category text NOT NULL CHECK (category IN (
    'developer','brokerage','real_estate_office','bank_finance',
    'potential_sponsor','other'
  )),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 180),
  contact_name text CHECK (contact_name IS NULL OR char_length(contact_name) <= 160),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 40),
  whatsapp text CHECK (whatsapp IS NULL OR char_length(whatsapp) <= 40),
  email text CHECK (email IS NULL OR char_length(email) <= 160),
  website text CHECK (website IS NULL OR char_length(website) <= 500),
  region text CHECK (region IS NULL OR char_length(region) <= 120),
  source text CHECK (source IS NULL OR char_length(source) <= 180),
  interest text CHECK (interest IS NULL OR char_length(interest) <= 2000),
  suitable_offer text CHECK (suitable_offer IS NULL OR char_length(suitable_offer) <= 2000),
  stage text NOT NULL DEFAULT 'new' CHECK (stage IN (
    'new','contacted','interested','follow_up','negotiation','converted','not_interested'
  )),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  next_follow_up_at timestamptz,
  last_contact_at timestamptz,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 5000),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE IF NOT EXISTS private.admin_crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES private.admin_crm_leads(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN (
    'call','whatsapp','meeting','email','note','stage_change','created','archived'
  )),
  outcome text CHECK (outcome IS NULL OR char_length(outcome) <= 180),
  notes text NOT NULL CHECK (char_length(btrim(notes)) BETWEEN 2 AND 3000),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_crm_leads_stage_followup_idx
  ON private.admin_crm_leads (stage, next_follow_up_at)
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS admin_crm_leads_assigned_idx
  ON private.admin_crm_leads (assigned_to, updated_at DESC)
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS admin_crm_activities_lead_time_idx
  ON private.admin_crm_activities (lead_id, occurred_at DESC);

ALTER TABLE private.admin_crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.admin_crm_activities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.admin_crm_leads FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE private.admin_crm_activities FROM PUBLIC, anon, authenticated, service_role;

-- Read RPC: both owners and added administrators may see the internal CRM.
CREATE OR REPLACE FUNCTION public.layan_admin_list_crm_leads(
  p_search text DEFAULT NULL,
  p_stage text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_due text DEFAULT 'all',
  p_limit integer DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  category text,
  name text,
  contact_name text,
  phone text,
  whatsapp text,
  email text,
  website text,
  region text,
  source text,
  interest text,
  suitable_offer text,
  stage text,
  assigned_to uuid,
  assigned_to_email text,
  next_follow_up_at timestamptz,
  last_contact_at timestamptz,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  activities_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا السجل متاح لفريق إدارة أسيوط عقار فقط' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(p_due, 'all') NOT IN ('all','overdue','today','upcoming') THEN
    RAISE EXCEPTION 'فلتر موعد المتابعة غير صحيح' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    l.id, l.category, l.name, l.contact_name, l.phone, l.whatsapp,
    l.email, l.website, l.region, l.source, l.interest, l.suitable_offer,
    l.stage, l.assigned_to, u.email::text,
    l.next_follow_up_at, l.last_contact_at, l.notes, l.created_at, l.updated_at,
    (SELECT count(*) FROM private.admin_crm_activities a WHERE a.lead_id = l.id)
  FROM private.admin_crm_leads l
  LEFT JOIN auth.users u ON u.id = l.assigned_to
  WHERE l.archived_at IS NULL
    AND (NULLIF(btrim(p_search), '') IS NULL
      OR l.name ILIKE '%' || btrim(p_search) || '%'
      OR COALESCE(l.contact_name, '') ILIKE '%' || btrim(p_search) || '%'
      OR COALESCE(l.phone, '') ILIKE '%' || btrim(p_search) || '%'
      OR COALESCE(l.email, '') ILIKE '%' || btrim(p_search) || '%'
      OR COALESCE(l.region, '') ILIKE '%' || btrim(p_search) || '%')
    AND (NULLIF(p_stage, '') IS NULL OR p_stage = 'all' OR l.stage = p_stage)
    AND (NULLIF(p_category, '') IS NULL OR p_category = 'all' OR l.category = p_category)
    AND (
      COALESCE(p_due, 'all') = 'all'
      OR (p_due = 'overdue' AND l.next_follow_up_at < now())
      OR (p_due = 'today' AND (l.next_follow_up_at AT TIME ZONE 'Africa/Cairo')::date = (now() AT TIME ZONE 'Africa/Cairo')::date)
      OR (p_due = 'upcoming' AND l.next_follow_up_at >= now())
    )
  ORDER BY l.next_follow_up_at ASC NULLS LAST, l.updated_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
END
$function$;

-- Summary RPC: counts are calculated over all active leads, not just the visible page.
CREATE OR REPLACE FUNCTION public.layan_admin_list_crm_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا السجل متاح لفريق إدارة أسيوط عقار فقط' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'total', count(*),
      'overdue', count(*) FILTER (WHERE next_follow_up_at < now() AND stage NOT IN ('converted','not_interested')),
      'today', count(*) FILTER (
        WHERE (next_follow_up_at AT TIME ZONE 'Africa/Cairo')::date = (now() AT TIME ZONE 'Africa/Cairo')::date
          AND stage NOT IN ('converted','not_interested')
      ),
      'interested', count(*) FILTER (WHERE stage IN ('interested','negotiation')),
      'converted', count(*) FILTER (WHERE stage = 'converted')
    )
    FROM private.admin_crm_leads
    WHERE archived_at IS NULL
  );
END
$function$;

-- Read RPC: immutable timeline entries for an individual lead.
CREATE OR REPLACE FUNCTION public.layan_admin_list_crm_activities(
  p_lead_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  activity_type text,
  outcome text,
  notes text,
  occurred_at timestamptz,
  created_by uuid,
  actor_email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا السجل متاح لفريق إدارة أسيوط عقار فقط' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM private.admin_crm_leads l
    WHERE l.id = p_lead_id AND l.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'الجهة غير موجودة أو مؤرشفة' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT a.id, a.activity_type, a.outcome, a.notes, a.occurred_at, a.created_by, u.email::text
  FROM private.admin_crm_activities a
  LEFT JOIN auth.users u ON u.id = a.created_by
  WHERE a.lead_id = p_lead_id
  ORDER BY a.occurred_at DESC, a.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 300);
END
$function$;

-- Write RPCs are owner-only. admin-approval.js routes an added administrator's
-- write request through the existing manager-approval queue before execution.
CREATE OR REPLACE FUNCTION public.layan_admin_crm_save_lead(
  p_id uuid,
  p_category text,
  p_name text,
  p_contact_name text,
  p_phone text,
  p_whatsapp text,
  p_email text,
  p_website text,
  p_region text,
  p_source text,
  p_interest text,
  p_suitable_offer text,
  p_stage text,
  p_assigned_to uuid,
  p_next_follow_up_at timestamptz,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_id uuid;
  v_old_stage text;
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_owner() THEN
    RAISE EXCEPTION 'إضافة وتعديل جهات المتابعة يتطلب اعتماد المدير' USING ERRCODE = '42501';
  END IF;

  IF p_category NOT IN (
    'developer','brokerage','real_estate_office','bank_finance',
    'potential_sponsor','other'
  ) THEN
    RAISE EXCEPTION 'نوع الجهة غير صحيح' USING ERRCODE = '22023';
  END IF;
  IF p_stage NOT IN ('new','contacted','interested','follow_up','negotiation','converted','not_interested') THEN
    RAISE EXCEPTION 'مرحلة المتابعة غير صحيحة' USING ERRCODE = '22023';
  END IF;
  IF p_name IS NULL OR char_length(btrim(p_name)) < 2 OR char_length(p_name) > 180 THEN
    RAISE EXCEPTION 'اكتب اسم الجهة من حرفين إلى 180 حرفًا' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(char_length(p_contact_name),0) > 160
     OR COALESCE(char_length(p_phone),0) > 40
     OR COALESCE(char_length(p_whatsapp),0) > 40
     OR COALESCE(char_length(p_email),0) > 160
     OR COALESCE(char_length(p_website),0) > 500
     OR COALESCE(char_length(p_region),0) > 120
     OR COALESCE(char_length(p_source),0) > 180
     OR COALESCE(char_length(p_interest),0) > 2000
     OR COALESCE(char_length(p_suitable_offer),0) > 2000
     OR COALESCE(char_length(p_notes),0) > 5000 THEN
    RAISE EXCEPTION 'أحد الحقول تجاوز الحد المسموح للطول' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(p_email), '') IS NOT NULL
     AND p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'البريد الإلكتروني غير صحيح' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(p_website), '') IS NOT NULL
     AND p_website !~* '^https?://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'رابط الموقع يجب أن يبدأ بـ http:// أو https://' USING ERRCODE = '22023';
  END IF;
  IF p_assigned_to IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM private.layan_admins a WHERE a.user_id = p_assigned_to
    UNION ALL
    SELECT 1 FROM private.layan_admin_members m WHERE m.user_id = p_assigned_to
  ) THEN
    RAISE EXCEPTION 'المسؤول المختار ليس ضمن فريق إدارة أسيوط عقار' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO private.admin_crm_leads (
      category, name, contact_name, phone, whatsapp, email, website, region,
      source, interest, suitable_offer, stage, assigned_to, next_follow_up_at,
      notes, created_by, updated_by
    ) VALUES (
      p_category, btrim(p_name), NULLIF(btrim(p_contact_name), ''),
      NULLIF(btrim(p_phone), ''), NULLIF(btrim(p_whatsapp), ''),
      NULLIF(btrim(p_email), ''), NULLIF(btrim(p_website), ''),
      NULLIF(btrim(p_region), ''), NULLIF(btrim(p_source), ''),
      NULLIF(btrim(p_interest), ''), NULLIF(btrim(p_suitable_offer), ''),
      p_stage, p_assigned_to, p_next_follow_up_at, NULLIF(btrim(p_notes), ''),
      auth.uid(), auth.uid()
    )
    RETURNING id INTO v_id;

    INSERT INTO private.admin_crm_activities (
      lead_id, activity_type, outcome, notes, occurred_at, created_by
    ) VALUES (
      v_id, 'created', p_stage, 'تم إنشاء سجل الجهة في نظام المتابعة.', now(), auth.uid()
    );
    RETURN v_id;
  END IF;

  SELECT l.stage INTO v_old_stage
  FROM private.admin_crm_leads l
  WHERE l.id = p_id AND l.archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الجهة غير موجودة أو مؤرشفة' USING ERRCODE = 'P0002';
  END IF;

  UPDATE private.admin_crm_leads
  SET category = p_category,
      name = btrim(p_name),
      contact_name = NULLIF(btrim(p_contact_name), ''),
      phone = NULLIF(btrim(p_phone), ''),
      whatsapp = NULLIF(btrim(p_whatsapp), ''),
      email = NULLIF(btrim(p_email), ''),
      website = NULLIF(btrim(p_website), ''),
      region = NULLIF(btrim(p_region), ''),
      source = NULLIF(btrim(p_source), ''),
      interest = NULLIF(btrim(p_interest), ''),
      suitable_offer = NULLIF(btrim(p_suitable_offer), ''),
      stage = p_stage,
      assigned_to = p_assigned_to,
      next_follow_up_at = p_next_follow_up_at,
      notes = NULLIF(btrim(p_notes), ''),
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = p_id
  RETURNING id INTO v_id;

  IF v_old_stage IS DISTINCT FROM p_stage THEN
    INSERT INTO private.admin_crm_activities (
      lead_id, activity_type, outcome, notes, occurred_at, created_by
    ) VALUES (
      v_id, 'stage_change', p_stage,
      'تم تغيير مرحلة المتابعة من ' || v_old_stage || ' إلى ' || p_stage || '.',
      now(), auth.uid()
    );
  END IF;

  RETURN v_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_crm_log_activity(
  p_lead_id uuid,
  p_activity_type text,
  p_outcome text,
  p_notes text,
  p_occurred_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_owner() THEN
    RAISE EXCEPTION 'تسجيل تواصل جديد يتطلب اعتماد المدير' USING ERRCODE = '42501';
  END IF;
  IF p_activity_type NOT IN ('call','whatsapp','meeting','email','note') THEN
    RAISE EXCEPTION 'نوع التواصل غير صحيح' USING ERRCODE = '22023';
  END IF;
  IF p_notes IS NULL OR char_length(btrim(p_notes)) < 2 OR char_length(p_notes) > 3000 THEN
    RAISE EXCEPTION 'اكتب ملخصًا من حرفين إلى 3000 حرف' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(char_length(p_outcome),0) > 180 THEN
    RAISE EXCEPTION 'نتيجة التواصل طويلة أكثر من اللازم' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM private.admin_crm_leads l
  WHERE l.id = p_lead_id AND l.archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الجهة غير موجودة أو مؤرشفة' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO private.admin_crm_activities (
    lead_id, activity_type, outcome, notes, occurred_at, created_by
  ) VALUES (
    p_lead_id, p_activity_type, NULLIF(btrim(p_outcome), ''),
    btrim(p_notes), COALESCE(p_occurred_at, now()), auth.uid()
  )
  RETURNING id INTO v_id;

  IF p_activity_type <> 'note' THEN
    UPDATE private.admin_crm_leads
    SET last_contact_at = GREATEST(COALESCE(last_contact_at, COALESCE(p_occurred_at, now())), COALESCE(p_occurred_at, now())),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_lead_id;
  END IF;

  RETURN v_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.layan_admin_crm_archive_lead(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_owner() THEN
    RAISE EXCEPTION 'أرشفة جهة المتابعة تتطلب اعتماد المدير' USING ERRCODE = '42501';
  END IF;

  UPDATE private.admin_crm_leads
  SET archived_at = now(), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_id AND archived_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الجهة غير موجودة أو تمت أرشفتها بالفعل' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO private.admin_crm_activities (
    lead_id, activity_type, notes, occurred_at, created_by
  ) VALUES (
    p_id, 'archived', 'تمت أرشفة سجل الجهة من لوحة الإدارة.', now(), auth.uid()
  );
  RETURN true;
END
$function$;

REVOKE ALL ON FUNCTION public.layan_admin_list_crm_leads(text, text, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.layan_admin_list_crm_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.layan_admin_list_crm_activities(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.layan_admin_crm_save_lead(uuid, text, text, text, text, text, text, text, text, text, text, text, text, uuid, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.layan_admin_crm_log_activity(uuid, text, text, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.layan_admin_crm_archive_lead(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.layan_admin_list_crm_leads(text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.layan_admin_list_crm_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.layan_admin_list_crm_activities(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.layan_admin_crm_save_lead(uuid, text, text, text, text, text, text, text, text, text, text, text, text, uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.layan_admin_crm_log_activity(uuid, text, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.layan_admin_crm_archive_lead(uuid) TO authenticated;

COMMENT ON TABLE private.admin_crm_leads IS
  'Internal ASYUT AQAR prospective advertiser and sponsor CRM. Never exposed as a public API table.';
COMMENT ON TABLE private.admin_crm_activities IS
  'Append-only internal CRM communication timeline. Never exposed as a public API table.';
