-- ASYUT AQAR — 2026-11-10: the admin page "فريق الإدارة" lists EVERYONE who has admin access
-- (owners + added admins, with their role), so the team is always visible and anyone added later
-- appears there automatically. Owners are unchanged (the owner decided to keep all three owner accounts).
-- Rollback: restore public.layan_admin_list_admins() from 20261108120000_admin_control_center.sql.

-- ---------- 2) list every admin (owners first) ----------
DROP FUNCTION IF EXISTS public.layan_admin_list_admins();
CREATE FUNCTION public.layan_admin_list_admins()
RETURNS TABLE (user_id uuid, email text, added_at timestamptz, role text)
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
    SELECT x.user_id, x.email, x.added_at, x.role FROM (
      SELECT a.user_id, u.email::text AS email, a.created_at AS added_at, 'owner'::text AS role, 0 AS ord
        FROM private.layan_admins a JOIN auth.users u ON u.id = a.user_id
      UNION ALL
      SELECT m.user_id, u.email::text, m.added_at, 'admin'::text, 1
        FROM private.layan_admin_members m JOIN auth.users u ON u.id = m.user_id
       WHERE NOT EXISTS (SELECT 1 FROM private.layan_admins a WHERE a.user_id = m.user_id)
    ) x
    ORDER BY x.ord, x.added_at;
END
$function$;
REVOKE ALL ON FUNCTION public.layan_admin_list_admins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.layan_admin_list_admins() TO authenticated;

-- Check (read-only): who has admin access now
SELECT 'owner' AS role, u.email FROM private.layan_admins a JOIN auth.users u ON u.id = a.user_id
UNION ALL
SELECT 'admin', u.email FROM private.layan_admin_members m JOIN auth.users u ON u.id = m.user_id
ORDER BY 1 DESC, 2;
