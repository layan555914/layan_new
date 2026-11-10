-- ASYUT AQAR — 2026-11-10: every change made by an ADDED admin (مشرف) needs the owners' (المدير) approval first.
--
-- Before: added admins (private.layan_admin_members) could write directly wherever a policy/RPC used
--         private.layan_is_admin() (sponsors, sponsored ads, company profiles, services, directory, badges, edits).
--         Only delete/suspend went through owner approval.
-- After:  * Owners (private.layan_admins) keep full power, unchanged.
--         * Added admins can still SEE everything in the admin page, but every write path in the database
--           now requires an owner -> an added admin physically cannot change anything directly.
--         * The admin page turns an added admin's change into a request (layan_admin_request_change) that an
--           owner reviews; when the owner approves, the owner's own session performs exactly that change and
--           marks the request done (layan_admin_finish_change).
-- Nothing here deletes or changes data, accounts, owners or public/visitor/owner-of-listing permissions:
-- only the "admin" part of each write rule is narrowed from (owners + added admins) to (owners).
-- Safe to re-run.
--
-- Rollback: in the same policies/functions replace private.layan_is_owner() back with private.layan_is_admin()
-- (the original expressions are saved in private.layan_owner_gate_backup by this migration).

-- ---------- helpers ----------
CREATE OR REPLACE FUNCTION private.layan_is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f$ SELECT auth.uid() IS NOT NULL AND COALESCE(private.layan_is_admin_base(), false) $f$;
REVOKE ALL ON FUNCTION private.layan_is_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.layan_is_owner() TO authenticated;

-- 'owner' | 'admin' | 'none' — lets the admin page know whether to send changes for approval.
CREATE OR REPLACE FUNCTION public.layan_admin_whoami()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f$
  SELECT CASE WHEN private.layan_is_owner() THEN 'owner'
              WHEN auth.uid() IS NOT NULL AND private.layan_is_admin() THEN 'admin'
              ELSE 'none' END
$f$;
REVOKE ALL ON FUNCTION public.layan_admin_whoami() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_whoami() TO authenticated;

-- Backup of every expression this migration changes (for an exact rollback).
CREATE TABLE IF NOT EXISTS private.layan_owner_gate_backup (
  kind text NOT NULL,            -- 'policy' | 'function'
  object_name text NOT NULL,
  original_definition text NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, object_name)
);
REVOKE ALL ON private.layan_owner_gate_backup FROM PUBLIC, anon, authenticated;

-- ---------- 1) write policies: admin part becomes owner-only ----------
DO $do$
DECLARE
  p record;
  v_using text;
  v_check text;
  v_sql text;
  rx constant text := '(private|public)\.layan_is_admin\(\)';
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND cmd <> 'SELECT'
       AND (COALESCE(qual, '') || COALESCE(with_check, '')) ~ rx
  LOOP
    INSERT INTO private.layan_owner_gate_backup (kind, object_name, original_definition)
    VALUES ('policy', p.tablename || '.' || p.policyname,
            'cmd=' || p.cmd || ' USING(' || COALESCE(p.qual, '') || ') CHECK(' || COALESCE(p.with_check, '') || ')')
    ON CONFLICT DO NOTHING;

    -- An ALL policy also grants SELECT: keep reading for added admins with a separate read policy.
    IF p.cmd = 'ALL' THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', left(p.policyname, 50) || '_admins_read', p.schemaname, p.tablename);
      EXECUTE format('CREATE POLICY %I ON %I.%I FOR SELECT TO authenticated USING (%s)',
                     left(p.policyname, 50) || '_admins_read', p.schemaname, p.tablename, COALESCE(p.qual, 'false'));
    END IF;

    v_using := regexp_replace(p.qual, rx, 'private.layan_is_owner()', 'g');
    v_check := regexp_replace(p.with_check, rx, 'private.layan_is_owner()', 'g');
    v_sql := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    IF v_using IS NOT NULL THEN v_sql := v_sql || ' USING (' || v_using || ')'; END IF;
    IF v_check IS NOT NULL THEN v_sql := v_sql || ' WITH CHECK (' || v_check || ')'; END IF;
    EXECUTE v_sql;
  END LOOP;
END
$do$;

-- ---------- 2) admin write functions: owner-only (requests from added admins go through approval) ----------
DO $do$
DECLARE
  f record;
  v_def text;
  rx constant text := '(private|public)\.layan_is_admin\(\)';
BEGIN
  FOR f IN
    SELECT p.oid, n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS name
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname IN ('public', 'private') AND p.prokind = 'f'
       AND p.proname IN ('layan_admin_set_offer_trust_badge', 'layan_guard_property_offer_trust_badge',
                         'layan_review_company_profile', 'directory_admin_mutate_with_audit', 'layan_admin_review_edit')
  LOOP
    v_def := pg_get_functiondef(f.oid);
    IF v_def ~ rx THEN
      INSERT INTO private.layan_owner_gate_backup (kind, object_name, original_definition)
      VALUES ('function', f.name, v_def) ON CONFLICT DO NOTHING;
      EXECUTE regexp_replace(v_def, rx, 'private.layan_is_owner()', 'g');
    END IF;
  END LOOP;
END
$do$;

-- ---------- 3) change requests (any change by an added admin) ----------
ALTER TABLE private.layan_admin_requests ADD COLUMN IF NOT EXISTS payload jsonb;
ALTER TABLE private.layan_admin_requests DROP CONSTRAINT IF EXISTS layan_admin_requests_action_check;
ALTER TABLE private.layan_admin_requests ADD CONSTRAINT layan_admin_requests_action_check
  CHECK (action IN ('delete_user','suspend_user','unsuspend_user','delete_offer','delete_service','delete_company',
                    'delete_supplier_ad','delete_sponsor','change'));

CREATE OR REPLACE FUNCTION public.layan_admin_request_change(p_label text, p_payload jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_method text := upper(COALESCE(p_payload->>'method', ''));
  v_path text := COALESCE(p_payload->>'path', '');
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING ERRCODE = '42501';
  END IF;
  IF v_method NOT IN ('POST', 'PATCH', 'DELETE')
     OR v_path !~ '^/rest/v1/[a-z_]+'
     OR v_path ~ '/rpc/(layan_admin_set_admin|layan_admin_decide_request|layan_admin_finish_change|layan_admin_request_change)'
     OR char_length(p_payload::text) > 20000 THEN
    RAISE EXCEPTION 'طلب غير صالح' USING ERRCODE = '22023';
  END IF;
  INSERT INTO private.layan_admin_requests (action, target, target_label, requested_by, payload)
  VALUES ('change', 'chg-' || gen_random_uuid()::text, left(COALESCE(p_label, 'تعديل'), 200), auth.uid(),
          jsonb_build_object('method', v_method, 'path', v_path, 'body', p_payload->'body',
                             'prefer', left(p_payload->>'prefer', 120)));
  RETURN 'pending';
END
$function$;
REVOKE ALL ON FUNCTION public.layan_admin_request_change(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_request_change(text, jsonb) TO authenticated;

-- Owner marks a change request done after the owner's session performed it (or failed).
CREATE OR REPLACE FUNCTION public.layan_admin_finish_change(p_id bigint, p_ok boolean, p_note text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT private.layan_is_owner() THEN
    RAISE EXCEPTION 'اعتماد الطلبات متاح للمدير فقط' USING ERRCODE = '42501';
  END IF;
  UPDATE private.layan_admin_requests
     SET status = CASE WHEN p_ok THEN 'approved' ELSE 'failed' END,
         decided_by = auth.uid(), decided_at = now(), note = left(p_note, 300)
   WHERE id = p_id AND action = 'change' AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود أو تم البت فيه' USING ERRCODE = 'P0002'; END IF;
  RETURN CASE WHEN p_ok THEN 'approved' ELSE 'failed' END;
END
$function$;
REVOKE ALL ON FUNCTION public.layan_admin_finish_change(bigint, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_finish_change(bigint, boolean, text) TO authenticated;

-- decide_request: unchanged, except a "change" request is approved by performing it (finish_change); rejecting works as before.
CREATE OR REPLACE FUNCTION public.layan_admin_decide_request(p_id bigint, p_approve boolean, p_note text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  r private.layan_admin_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(private.layan_is_admin_base(), false) THEN
    RAISE EXCEPTION 'اعتماد الطلبات متاح للمدير فقط' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM private.layan_admin_requests WHERE id = p_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود أو تم البت فيه' USING ERRCODE = 'P0002'; END IF;
  IF p_approve AND r.action = 'change' THEN
    RAISE EXCEPTION 'اعتمد هذا الطلب من زر «اعتماد وتنفيذ» في صفحة الإدارة' USING ERRCODE = '22023';
  END IF;
  IF p_approve THEN
    BEGIN
      PERFORM private.layan_admin_perform(r.action, r.target);
    EXCEPTION WHEN OTHERS THEN
      UPDATE private.layan_admin_requests SET status = 'failed', decided_by = auth.uid(), decided_at = now(), note = left(SQLERRM, 300) WHERE id = p_id;
      RETURN 'failed';
    END;
  END IF;
  UPDATE private.layan_admin_requests
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, decided_by = auth.uid(), decided_at = now(), note = left(p_note, 300)
   WHERE id = p_id;
  RETURN CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;
END
$function$;
REVOKE ALL ON FUNCTION public.layan_admin_decide_request(bigint, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_decide_request(bigint, boolean, text) TO authenticated;

-- list_requests now also returns the change payload (for the owner to review before approving).
DROP FUNCTION IF EXISTS public.layan_admin_list_requests(text);
CREATE FUNCTION public.layan_admin_list_requests(p_status text DEFAULT 'pending')
RETURNS TABLE (id bigint, action text, target text, target_label text, requested_by_email text, status text,
               created_at timestamptz, decided_by_email text, decided_at timestamptz, note text, can_decide boolean, payload jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.layan_is_admin() THEN
    RAISE EXCEPTION 'هذا الإجراء متاح لإدارة أسيوط عقار فقط' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT r.id, r.action, r.target, r.target_label, ru.email::text, r.status, r.created_at, du.email::text, r.decided_at, r.note,
         COALESCE(private.layan_is_admin_base(), false) AND r.status = 'pending', r.payload
  FROM private.layan_admin_requests r
  LEFT JOIN auth.users ru ON ru.id = r.requested_by
  LEFT JOIN auth.users du ON du.id = r.decided_by
  WHERE p_status IS NULL OR p_status = '' OR r.status = p_status
  ORDER BY r.created_at DESC
  LIMIT 500;
END
$function$;
REVOKE ALL ON FUNCTION public.layan_admin_list_requests(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_list_requests(text) TO authenticated;

-- Check (read-only): write rules that still let added admins write directly (expected: no rows)
SELECT tablename, policyname, cmd FROM pg_policies
 WHERE schemaname = 'public' AND cmd <> 'SELECT'
   AND (COALESCE(qual, '') || COALESCE(with_check, '')) ~ '(private|public)\.layan_is_admin\(\)';
