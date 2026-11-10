-- ASYUT AQAR — 2026-11-10 (follow-up to 20261110170000): the first pass only matched policies written as
-- private.layan_is_admin() / public.layan_is_admin(). Most write policies call it unqualified
-- (layan_is_admin() -> public.layan_is_admin()), so they were still open to added admins.
-- This pass applies the same owner-only rule to those too. Same backup table, same rollback. Safe to re-run.

DO $do$
DECLARE
  p record;
  v_using text;
  v_check text;
  v_sql text;
  -- layan_is_admin() with or without a schema, but never layan_is_admin_base()
  rx constant text := '((private|public)\.)?layan_is_admin\(\)';
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND cmd <> 'SELECT'
       AND (COALESCE(qual, '') || COALESCE(with_check, '')) ~ rx
  LOOP
    INSERT INTO private.layan_owner_gate_backup (kind, object_name, original_definition)
    VALUES ('policy', p.tablename || '.' || p.policyname,
            'cmd=' || p.cmd || ' USING(' || COALESCE(p.qual, '') || ') CHECK(' || COALESCE(p.with_check, '') || ')')
    ON CONFLICT DO NOTHING;

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

-- Check (read-only): write rules that still let added admins write directly (expected: no rows)
SELECT tablename, policyname, cmd FROM pg_policies
 WHERE schemaname = 'public' AND cmd <> 'SELECT'
   AND (COALESCE(qual, '') || COALESCE(with_check, '')) ~ 'layan_is_admin\(\)';
