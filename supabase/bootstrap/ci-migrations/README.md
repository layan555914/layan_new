# CI-only Supabase baseline fixtures

These timestamped SQL snapshots are used only by the disposable GitHub Actions rehearsal.
The workflow copies them into a temporary Supabase project before replaying the incremental
migrations from the current repository.

They are intentionally stored outside `supabase/migrations/` and must never be deployed to
the populated production project or moved into the production migration directory. They contain
schema/bootstrap definitions only; no production user rows, admin allowlist rows, property rows,
or storage object contents are included.
