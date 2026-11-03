-- ASYUT AQAR: make the directory audit log append-only for authenticated users.
-- Keep SELECT and INSERT for the admin audit viewer and the SECURITY INVOKER
-- directory_admin_mutate_with_audit() function. Remove mutation/DDL-adjacent
-- table privileges so audit history cannot be edited, deleted, or truncated
-- by the authenticated role. RLS remains enabled and its admin policy remains
-- unchanged.

REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.directory_change_log
  FROM authenticated;

GRANT SELECT, INSERT
  ON TABLE public.directory_change_log
  TO authenticated;

NOTIFY pgrst, 'reload schema';
