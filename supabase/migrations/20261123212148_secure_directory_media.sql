-- Secure, review-gated media for verified company/service profiles and approved projects.
-- Development branch only. Do not apply to production without a separate approval.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'asyut-directory-media',
  'asyut-directory-media',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/avif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.directory_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_entity_id uuid NOT NULL REFERENCES public.directory_entities(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES public.directory_projects(id) ON DELETE RESTRICT,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  media_kind text NOT NULL CHECK (media_kind IN (
    'entity_logo','entity_cover','entity_gallery','service_gallery','project_gallery'
  )),
  bucket_id text NOT NULL DEFAULT 'asyut-directory-media'
    CHECK (bucket_id = 'asyut-directory-media'),
  storage_path text NOT NULL UNIQUE,
  caption text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 240),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 1000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','removed')),
  review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 1200),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT directory_media_kind_project_contract CHECK (
    (media_kind = 'project_gallery' AND project_id IS NOT NULL)
    OR (media_kind <> 'project_gallery' AND project_id IS NULL)
  ),
  CONSTRAINT directory_media_storage_path_contract CHECK (
    storage_path ~ (
      '^' || directory_entity_id::text || '/' || owner_user_id::text ||
      '/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp|avif)$'
    )
  ),
  CONSTRAINT directory_media_review_pair_contract CHECK (
    (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (status <> 'pending' AND reviewed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS directory_media_public_gallery_idx
  ON public.directory_media_assets(directory_entity_id, media_kind, sort_order, created_at)
  WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS directory_media_project_gallery_idx
  ON public.directory_media_assets(project_id, sort_order, created_at)
  WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS directory_media_owner_pending_idx
  ON public.directory_media_assets(owner_user_id, created_at DESC)
  WHERE status = 'pending';

ALTER TABLE public.directory_media_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.directory_media_assets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.directory_media_assets TO anon, authenticated;
GRANT INSERT (
  directory_entity_id, project_id, owner_user_id, media_kind,
  bucket_id, storage_path, caption, sort_order
) ON public.directory_media_assets TO authenticated;
GRANT UPDATE (caption, sort_order) ON public.directory_media_assets TO authenticated;
GRANT UPDATE (status, review_note, reviewed_by, reviewed_at, updated_at)
  ON public.directory_media_assets TO authenticated;
GRANT DELETE ON public.directory_media_assets TO authenticated;

DROP POLICY IF EXISTS directory_media_public_approved_read ON public.directory_media_assets;
CREATE POLICY directory_media_public_approved_read
ON public.directory_media_assets
FOR SELECT TO anon, authenticated
USING (
  status = 'approved'
  AND EXISTS (
    SELECT 1 FROM public.directory_entities e
    WHERE e.id = directory_media_assets.directory_entity_id
      AND e.public_visible = true
      AND e.verification_status = 'published'
  )
  AND (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.directory_projects p
      WHERE p.id = directory_media_assets.project_id
        AND p.public_visible = true
        AND p.verification_status = 'published'
    )
  )
);

DROP POLICY IF EXISTS directory_media_owner_read ON public.directory_media_assets;
CREATE POLICY directory_media_owner_read
ON public.directory_media_assets
FOR SELECT TO authenticated
USING (
  owner_user_id = (SELECT auth.uid())
  AND private.company_entity_manager_access(directory_entity_id) IN ('owner','manager')
);

DROP POLICY IF EXISTS directory_media_admin_read ON public.directory_media_assets;
CREATE POLICY directory_media_admin_read
ON public.directory_media_assets
FOR SELECT TO authenticated
USING (private.layan_is_admin());

DROP POLICY IF EXISTS directory_media_verified_manager_insert ON public.directory_media_assets;
CREATE POLICY directory_media_verified_manager_insert
ON public.directory_media_assets
FOR INSERT TO authenticated
WITH CHECK (
  owner_user_id = (SELECT auth.uid())
  AND status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND private.company_entity_manager_access(directory_entity_id) IN ('owner','manager')
  AND (
    project_id IS NULL
    OR (
      media_kind = 'project_gallery'
      AND EXISTS (
        SELECT 1 FROM public.directory_project_entities r
        JOIN public.directory_projects p ON p.id = r.project_id
        WHERE r.project_id = directory_media_assets.project_id
          AND r.entity_id = directory_media_assets.directory_entity_id
          AND r.relation_type IN ('developer','land_owner')
          AND p.public_visible = true
          AND p.verification_status = 'published'
      )
    )
  )
);

DROP POLICY IF EXISTS directory_media_owner_pending_update ON public.directory_media_assets;
CREATE POLICY directory_media_owner_pending_update
ON public.directory_media_assets
FOR UPDATE TO authenticated
USING (
  status = 'pending'
  AND owner_user_id = (SELECT auth.uid())
  AND private.company_entity_manager_access(directory_entity_id) IN ('owner','manager')
)
WITH CHECK (
  status = 'pending'
  AND owner_user_id = (SELECT auth.uid())
  AND private.company_entity_manager_access(directory_entity_id) IN ('owner','manager')
);

DROP POLICY IF EXISTS directory_media_admin_review_update ON public.directory_media_assets;
CREATE POLICY directory_media_admin_review_update
ON public.directory_media_assets
FOR UPDATE TO authenticated
USING (private.layan_is_admin())
WITH CHECK (
  private.layan_is_admin()
  AND reviewed_by = (SELECT auth.uid())
  AND reviewed_at IS NOT NULL
);

DROP POLICY IF EXISTS directory_media_owner_pending_delete ON public.directory_media_assets;
CREATE POLICY directory_media_owner_pending_delete
ON public.directory_media_assets
FOR DELETE TO authenticated
USING (
  status = 'pending'
  AND owner_user_id = (SELECT auth.uid())
  AND private.company_entity_manager_access(directory_entity_id) IN ('owner','manager')
);

DROP POLICY IF EXISTS directory_media_admin_delete ON public.directory_media_assets;
CREATE POLICY directory_media_admin_delete
ON public.directory_media_assets
FOR DELETE TO authenticated
USING (private.layan_is_admin());

-- Storage remains private. A file is downloadable only when its metadata row is approved,
-- or by its verified uploader / an administrator for review and management.
DROP POLICY IF EXISTS directory_media_storage_verified_upload ON storage.objects;
CREATE POLICY directory_media_storage_verified_upload
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'asyut-directory-media'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
  AND name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|avif)$'
  AND private.company_entity_manager_access(((storage.foldername(name))[1])::uuid) IN ('owner','manager')
);

DROP POLICY IF EXISTS directory_media_storage_review_read ON storage.objects;
CREATE POLICY directory_media_storage_review_read
ON storage.objects
FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'asyut-directory-media'
  AND EXISTS (
    SELECT 1 FROM public.directory_media_assets m
    WHERE m.bucket_id = storage.objects.bucket_id
      AND m.storage_path = storage.objects.name
      AND m.status = 'approved'
      AND EXISTS (
        SELECT 1 FROM public.directory_entities e
        WHERE e.id = m.directory_entity_id
          AND e.public_visible = true
          AND e.verification_status = 'published'
      )
      AND (
        m.project_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.directory_projects p
          WHERE p.id = m.project_id
            AND p.public_visible = true
            AND p.verification_status = 'published'
        )
      )
  )
);

DROP POLICY IF EXISTS directory_media_storage_owner_read ON storage.objects;
CREATE POLICY directory_media_storage_owner_read
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'asyut-directory-media'
  AND EXISTS (
    SELECT 1 FROM public.directory_media_assets m
    WHERE m.bucket_id = storage.objects.bucket_id
      AND m.storage_path = storage.objects.name
      AND m.owner_user_id = (SELECT auth.uid())
      AND private.company_entity_manager_access(m.directory_entity_id) IN ('owner','manager')
  )
);

DROP POLICY IF EXISTS directory_media_storage_admin_read ON storage.objects;
CREATE POLICY directory_media_storage_admin_read
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'asyut-directory-media'
  AND private.layan_is_admin()
);

DROP POLICY IF EXISTS directory_media_storage_owner_pending_delete ON storage.objects;
CREATE POLICY directory_media_storage_owner_pending_delete
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'asyut-directory-media'
  AND EXISTS (
    SELECT 1 FROM public.directory_media_assets m
    WHERE m.bucket_id = storage.objects.bucket_id
      AND m.storage_path = storage.objects.name
      AND m.owner_user_id = (SELECT auth.uid())
      AND m.status = 'pending'
      AND private.company_entity_manager_access(m.directory_entity_id) IN ('owner','manager')
  )
);

DROP POLICY IF EXISTS directory_media_storage_admin_delete ON storage.objects;
CREATE POLICY directory_media_storage_admin_delete
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'asyut-directory-media'
  AND private.layan_is_admin()
);

COMMIT;
