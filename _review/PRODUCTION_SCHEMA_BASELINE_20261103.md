# ASYUT AQAR — production schema baseline

The full catalog-derived current-state schema snapshot is available at:

- `_review/PRODUCTION_BASELINE_COMPLETE_20261103.sql`

It is split into reviewable components:
tables; constraints and indexes; routines/views/triggers; application RLS; application grants; Storage bucket metadata/grants; Storage object policies.

Verified source counts on 2026-11-03 (PostgreSQL 17.11):
- 28 application tables (26 public, 2 private)
- 135 constraints
- 32 secondary indexes
- 20 routines
- 2 views
- 7 triggers
- 80 app table RLS policies
- 70 table/view grant groups
- 2 API-enabled sequences
- 2 Storage buckets and 6 Storage object policies

The combined file was instantiated in isolated rehearsal schemas in the existing test Supabase project. It passed catalog-count, privilege, RLS, directory source-publication, and Storage owner/anonymous-access checks. The transaction was rolled back and a follow-up query found zero rehearsal schemas/tables.

This is a **current-state schema snapshot**, not the original 59 migration files. It is not in `supabase/migrations` and must not be run on the populated production database. A complete CLI `db reset` could not be run because Supabase CLI, Docker, psql, and pg_dump are unavailable in the current execution environment. Original production data, Auth users, admin allowlist rows, project-decision records, VAPID secrets, and Storage objects are intentionally excluded.
