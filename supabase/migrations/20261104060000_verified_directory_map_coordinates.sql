-- Add source-backed public map coordinates to the Asyut directory.
-- No coordinates are seeded: every map point must be entered and verified by an administrator.

ALTER TABLE public.directory_areas
  ADD COLUMN IF NOT EXISTS latitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS location_precision text,
  ADD COLUMN IF NOT EXISTS location_source_id uuid REFERENCES public.directory_sources(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS location_verified_at date,
  ADD COLUMN IF NOT EXISTS location_public boolean NOT NULL DEFAULT false;

ALTER TABLE public.directory_entities
  ADD COLUMN IF NOT EXISTS latitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS location_precision text,
  ADD COLUMN IF NOT EXISTS location_source_id uuid REFERENCES public.directory_sources(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS location_verified_at date,
  ADD COLUMN IF NOT EXISTS location_public boolean NOT NULL DEFAULT false;

ALTER TABLE public.directory_projects
  ADD COLUMN IF NOT EXISTS latitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS location_precision text,
  ADD COLUMN IF NOT EXISTS location_source_id uuid REFERENCES public.directory_sources(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS location_verified_at date,
  ADD COLUMN IF NOT EXISTS location_public boolean NOT NULL DEFAULT false;

ALTER TABLE public.directory_areas
  ADD CONSTRAINT directory_areas_map_latitude_range
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT directory_areas_map_longitude_range
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT directory_areas_map_coordinate_pair
    CHECK ((latitude IS NULL) = (longitude IS NULL)),
  ADD CONSTRAINT directory_areas_map_precision
    CHECK (location_precision IS NULL OR location_precision IN ('building','street','district_centroid','area_centroid')),
  ADD CONSTRAINT directory_areas_map_public_complete
    CHECK (
      (location_public AND latitude IS NOT NULL AND longitude IS NOT NULL
        AND location_precision IS NOT NULL AND location_source_id IS NOT NULL
        AND location_verified_at IS NOT NULL)
      OR
      (NOT location_public AND latitude IS NULL AND longitude IS NULL
        AND location_precision IS NULL AND location_source_id IS NULL
        AND location_verified_at IS NULL)
    );

ALTER TABLE public.directory_entities
  ADD CONSTRAINT directory_entities_map_latitude_range
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT directory_entities_map_longitude_range
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT directory_entities_map_coordinate_pair
    CHECK ((latitude IS NULL) = (longitude IS NULL)),
  ADD CONSTRAINT directory_entities_map_precision
    CHECK (location_precision IS NULL OR location_precision IN ('building','street','district_centroid','area_centroid')),
  ADD CONSTRAINT directory_entities_map_public_complete
    CHECK (
      (location_public AND latitude IS NOT NULL AND longitude IS NOT NULL
        AND location_precision IS NOT NULL AND location_source_id IS NOT NULL
        AND location_verified_at IS NOT NULL)
      OR
      (NOT location_public AND latitude IS NULL AND longitude IS NULL
        AND location_precision IS NULL AND location_source_id IS NULL
        AND location_verified_at IS NULL)
    );

ALTER TABLE public.directory_projects
  ADD CONSTRAINT directory_projects_map_latitude_range
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT directory_projects_map_longitude_range
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT directory_projects_map_coordinate_pair
    CHECK ((latitude IS NULL) = (longitude IS NULL)),
  ADD CONSTRAINT directory_projects_map_precision
    CHECK (location_precision IS NULL OR location_precision IN ('building','street','district_centroid','area_centroid')),
  ADD CONSTRAINT directory_projects_map_public_complete
    CHECK (
      (location_public AND latitude IS NOT NULL AND longitude IS NOT NULL
        AND location_precision IS NOT NULL AND location_source_id IS NOT NULL
        AND location_verified_at IS NOT NULL)
      OR
      (NOT location_public AND latitude IS NULL AND longitude IS NULL
        AND location_precision IS NULL AND location_source_id IS NULL
        AND location_verified_at IS NULL)
    );

CREATE INDEX IF NOT EXISTS directory_areas_location_source_idx
  ON public.directory_areas(location_source_id) WHERE location_public;
CREATE INDEX IF NOT EXISTS directory_entities_location_source_idx
  ON public.directory_entities(location_source_id) WHERE location_public;
CREATE INDEX IF NOT EXISTS directory_projects_location_source_idx
  ON public.directory_projects(location_source_id) WHERE location_public;

COMMENT ON COLUMN public.directory_areas.latitude IS 'Latitude only when a source-backed public map location has been approved.';
COMMENT ON COLUMN public.directory_areas.longitude IS 'Longitude only when a source-backed public map location has been approved.';
COMMENT ON COLUMN public.directory_areas.location_precision IS 'Building/street or an explicitly approximate district/area centroid.';
COMMENT ON COLUMN public.directory_areas.location_source_id IS 'Public high-confidence or official source supporting the published map coordinate.';
COMMENT ON COLUMN public.directory_areas.location_verified_at IS 'Date when the coordinate was checked against its source.';
COMMENT ON COLUMN public.directory_areas.location_public IS 'Explicit approval to show this sourced coordinate on the public map.';
COMMENT ON COLUMN public.directory_entities.location_public IS 'Explicit approval to show this sourced entity coordinate on the public map.';
COMMENT ON COLUMN public.directory_projects.location_public IS 'Explicit approval to show this sourced project coordinate on the public map.';

CREATE OR REPLACE FUNCTION public.directory_validate_map_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_source record;
BEGIN
  -- Coordinates are removed automatically when the parent record is no longer public.
  IF NOT NEW.public_visible OR NEW.verification_status <> 'published'
     OR (TG_TABLE_NAME = 'directory_areas' AND NOT NEW.is_active) THEN
    NEW.latitude := NULL;
    NEW.longitude := NULL;
    NEW.location_precision := NULL;
    NEW.location_source_id := NULL;
    NEW.location_verified_at := NULL;
    NEW.location_public := false;
    RETURN NEW;
  END IF;

  IF NOT NEW.location_public THEN
    -- Unapproved coordinates may never be stored in public-facing directory tables.
    NEW.latitude := NULL;
    NEW.longitude := NULL;
    NEW.location_precision := NULL;
    NEW.location_source_id := NULL;
    NEW.location_verified_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.latitude IS NULL OR NEW.longitude IS NULL
     OR NEW.location_precision IS NULL OR NEW.location_source_id IS NULL
     OR NEW.location_verified_at IS NULL THEN
    RAISE EXCEPTION 'لا يمكن إظهار موقع على الخريطة قبل اكتمال الإحداثيات ودقة التحديد والمصدر وتاريخ التحقق.';
  END IF;

  IF NEW.location_verified_at > current_date THEN
    RAISE EXCEPTION 'تاريخ التحقق من الموقع لا يمكن أن يكون في المستقبل.';
  END IF;

  IF TG_TABLE_NAME = 'directory_areas'
     AND NEW.location_precision NOT IN ('area_centroid','district_centroid') THEN
    RAISE EXCEPTION 'موقع المنطقة يجب أن يكون مركز نطاق أو مركز حي، وليس عنوان مبنى.';
  END IF;

  SELECT s.is_public, s.confidence_level, s.source_url
  INTO v_source
  FROM public.directory_sources AS s
  WHERE s.id = NEW.location_source_id;

  IF NOT FOUND OR v_source.is_public IS DISTINCT FROM true
     OR v_source.confidence_level NOT IN ('high','official')
     OR coalesce(v_source.source_url,'') !~* '^https?://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'مصدر الإحداثيات يجب أن يكون عامًا وموثوقًا أو رسميًا وله رابط صالح.';
  END IF;

  IF TG_TABLE_NAME = 'directory_entities' AND NOT EXISTS (
    SELECT 1 FROM public.directory_entity_sources AS es
    WHERE es.entity_id = NEW.id AND es.source_id = NEW.location_source_id
  ) THEN
    RAISE EXCEPTION 'اربط مصدر الإحداثيات بالجهة في قائمة مراجع السجل أولًا.';
  END IF;

  IF TG_TABLE_NAME = 'directory_projects' AND NOT EXISTS (
    SELECT 1 FROM public.directory_project_sources AS ps
    WHERE ps.project_id = NEW.id AND ps.source_id = NEW.location_source_id
  ) THEN
    RAISE EXCEPTION 'اربط مصدر الإحداثيات بالمشروع في قائمة مراجع السجل أولًا.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS directory_areas_validate_map_location ON public.directory_areas;
CREATE TRIGGER directory_areas_validate_map_location
BEFORE INSERT OR UPDATE ON public.directory_areas
FOR EACH ROW EXECUTE FUNCTION public.directory_validate_map_location();

DROP TRIGGER IF EXISTS directory_entities_validate_map_location ON public.directory_entities;
CREATE TRIGGER directory_entities_validate_map_location
BEFORE INSERT OR UPDATE ON public.directory_entities
FOR EACH ROW EXECUTE FUNCTION public.directory_validate_map_location();

DROP TRIGGER IF EXISTS directory_projects_validate_map_location ON public.directory_projects;
CREATE TRIGGER directory_projects_validate_map_location
BEFORE INSERT OR UPDATE ON public.directory_projects
FOR EACH ROW EXECUTE FUNCTION public.directory_validate_map_location();

CREATE OR REPLACE FUNCTION public.directory_guard_public_map_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.directory_areas a WHERE a.location_source_id = OLD.id AND a.location_public)
       OR EXISTS (SELECT 1 FROM public.directory_entities e WHERE e.location_source_id = OLD.id AND e.location_public)
       OR EXISTS (SELECT 1 FROM public.directory_projects p WHERE p.location_source_id = OLD.id AND p.location_public) THEN
      RAISE EXCEPTION 'لا يمكن حذف مصدر مرتبط بموقع منشور على الخريطة؛ أخفِ الموقع أولًا.';
    END IF;
    RETURN OLD;
  END IF;

  IF (
    NEW.is_public IS DISTINCT FROM true
    OR NEW.confidence_level NOT IN ('high','official')
    OR coalesce(NEW.source_url,'') !~* '^https?://[^[:space:]]+$'
  ) AND (
    EXISTS (SELECT 1 FROM public.directory_areas a WHERE a.location_source_id = NEW.id AND a.location_public)
    OR EXISTS (SELECT 1 FROM public.directory_entities e WHERE e.location_source_id = NEW.id AND e.location_public)
    OR EXISTS (SELECT 1 FROM public.directory_projects p WHERE p.location_source_id = NEW.id AND p.location_public)
  ) THEN
    RAISE EXCEPTION 'هذا المصدر يدعم موقعًا منشورًا على الخريطة؛ أخفِ الموقع أو اربطه بمصدر بديل قبل تغيير حالة المصدر.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS directory_sources_guard_public_map_locations ON public.directory_sources;
CREATE TRIGGER directory_sources_guard_public_map_locations
BEFORE UPDATE OF is_public, confidence_level, source_url OR DELETE
ON public.directory_sources
FOR EACH ROW EXECUTE FUNCTION public.directory_guard_public_map_source();
