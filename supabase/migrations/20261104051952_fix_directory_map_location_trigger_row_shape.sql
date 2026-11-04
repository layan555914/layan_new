-- Fix trigger row-shape handling: is_active exists only on directory_areas.
CREATE OR REPLACE FUNCTION public.directory_validate_map_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_source record;
BEGIN
  IF NOT NEW.public_visible OR NEW.verification_status <> 'published' THEN
    NEW.latitude := NULL;
    NEW.longitude := NULL;
    NEW.location_precision := NULL;
    NEW.location_source_id := NULL;
    NEW.location_verified_at := NULL;
    NEW.location_public := false;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'directory_areas' THEN
    IF NOT NEW.is_active THEN
      NEW.latitude := NULL;
      NEW.longitude := NULL;
      NEW.location_precision := NULL;
      NEW.location_source_id := NULL;
      NEW.location_verified_at := NULL;
      NEW.location_public := false;
      RETURN NEW;
    END IF;
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
