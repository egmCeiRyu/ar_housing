BEGIN;
-- Reuse the existing QRIE upload namespace; preserve archived draft references.
ALTER TABLE public.assets
 DROP CONSTRAINT assets_s3_key_check,
 DROP CONSTRAINT assets_thumbnail_s3_key_check,
 ADD CONSTRAINT assets_s3_key_check CHECK (s3_key LIKE 'qrie-assets/%' OR s3_key LIKE 'clients/asset-library/%'),
 ADD CONSTRAINT assets_thumbnail_s3_key_check CHECK (thumbnail_s3_key LIKE 'qrie-assets/%' OR thumbnail_s3_key LIKE 'clients/asset-library/%');
COMMIT;
