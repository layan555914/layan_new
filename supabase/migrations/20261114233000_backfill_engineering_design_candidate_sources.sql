-- Backfill discovery-source joins for the engineering/interior design candidates.
-- Idempotent repair for databases where the initial seed rows already existed.

BEGIN;

WITH candidates(slug,source_code) AS (
  VALUES
    ('centre-engineering-designs-assiut','SP-20261114-CENTRE-ENG'),
    ('engineering-consultants-group-assiut','SP-20261114-ECG-ASSIUT'),
    ('sherif-engineering-consultants-assiut','SP-20261114-SHERIF-ENG'),
    ('middle-east-engineering-consultants-assiut','SP-20261114-MEAST-ENG'),
    ('bonian-misr-architects-assiut','SP-20261114-BONIAN'),
    ('dar-altasmeemat-engineering-assiut','SP-20261114-DAR-TASMEEM'),
    ('topmountain-design-assiut','SP-20261114-TOPMOUNTAIN'),
    ('byoot-designs-assiut','SP-20261114-BYOOT'),
    ('elkashef-design-group-assiut','SP-20261114-ELKASHEF'),
    ('mh-designs-assiut','SP-20261114-MH-DESIGNS'),
    ('noha-elsharkawy-designs-assiut','SP-20261114-NOHA-DESIGN'),
    ('dizn-studio-assiut','SP-20261114-DIZN')
)
INSERT INTO public.directory_entity_sources(entity_id,source_id,claim_key)
SELECT e.id,s.id,'service_provider_discovery'
FROM candidates c
JOIN public.directory_entities e ON e.slug=c.slug
JOIN public.directory_sources s ON s.source_code=c.source_code
ON CONFLICT (entity_id,source_id,claim_key) DO NOTHING;

COMMIT;
