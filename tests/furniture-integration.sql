BEGIN;
DO $$
DECLARE project uuid; client uuid; project_slug text; category text; enabled_asset uuid=gen_random_uuid(); disabled_asset uuid=gen_random_uuid(); config jsonb;
BEGIN
 SELECT p.id,p.client_id,p.slug INTO project,client,project_slug FROM public.properties p WHERE p.client_id IS NOT NULL LIMIT 1;
 SELECT id INTO category FROM public.asset_categories WHERE archived_at IS NULL LIMIT 1;
 IF project IS NULL OR category IS NULL THEN RAISE EXCEPTION 'Existing project and category required'; END IF;
 UPDATE public.clients SET furniture_enabled=false WHERE id=client;
 UPDATE public.properties SET status='active',furniture_floors='[{"name":"1階","url":"https://example.com/test.glb"}]' WHERE id=project;
 IF public.get_furniture_config(project_slug) IS NOT NULL THEN RAISE EXCEPTION 'Disabled client exposed'; END IF;
 UPDATE public.clients SET furniture_enabled=true WHERE id=client;
 INSERT INTO public.assets(id,name,category_id,asset_type,s3_key,thumbnail_s3_key,original_filename,content_type,file_size,thumbnail_size,status)
 SELECT id,'Rollback test',category,'model','clients/asset-library/qa/'||id||'/original.glb','clients/asset-library/qa/'||id||'/thumb.webp','qa.glb','model/gltf-binary',1,1,status FROM (VALUES(enabled_asset,'active'),(disabled_asset,'inactive')) fixture(id,status);
 INSERT INTO public.project_assets(project_id,asset_id,enabled) VALUES(project,enabled_asset,true),(project,disabled_asset,true);
 config=public.get_furniture_config(project_slug);
 IF config IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(config->'assets') a WHERE a->>'id'=enabled_asset::text) OR EXISTS(SELECT 1 FROM jsonb_array_elements(config->'assets') a WHERE a->>'id'=disabled_asset::text) THEN RAISE EXCEPTION 'Asset visibility failed'; END IF;
 UPDATE public.project_assets SET enabled=false WHERE project_id=project AND asset_id=enabled_asset;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(public.get_furniture_config(project_slug)->'assets') a WHERE a->>'id'=enabled_asset::text) THEN RAISE EXCEPTION 'Unassigned asset exposed'; END IF;
 UPDATE public.properties SET status='inactive' WHERE id=project;
 IF public.get_furniture_config(project_slug) IS NOT NULL THEN RAISE EXCEPTION 'Inactive project exposed'; END IF;
 UPDATE public.properties SET status='active',furniture_floors='[]' WHERE id=project;
 IF public.get_furniture_config(project_slug) IS NOT NULL THEN RAISE EXCEPTION 'Unconfigured project exposed'; END IF;
 IF public.get_furniture_config('nonexistent-qrie-test') IS NOT NULL THEN RAISE EXCEPTION 'Unknown slug exposed'; END IF;
END $$;
CREATE TEMP TABLE furniture_permission_test(furniture_enabled boolean, furniture_floors jsonb);
INSERT INTO furniture_permission_test VALUES(false,'[]');
CREATE TRIGGER client_guard BEFORE UPDATE ON furniture_permission_test FOR EACH ROW EXECUTE FUNCTION public.protect_client_furniture_setting();
CREATE TRIGGER floor_guard BEFORE UPDATE ON furniture_permission_test FOR EACH ROW EXECUTE FUNCTION public.protect_furniture_floors();
GRANT SELECT,UPDATE ON furniture_permission_test TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"app_metadata":{"role":"client"},"user_metadata":{"role":"admin"}}',true);
DO $$ BEGIN
 BEGIN UPDATE furniture_permission_test SET furniture_enabled=true; RAISE EXCEPTION 'Client changed enable setting'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE furniture_permission_test SET furniture_floors='[{"name":"1階","url":"https://example.com/a.glb"}]'; RAISE EXCEPTION 'Client changed floor setting'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"app_metadata":{"role":"admin"}}',true);
UPDATE furniture_permission_test SET furniture_enabled=true,furniture_floors='[{"name":"1階","url":"https://example.com/a.glb"}]';
RESET ROLE;
ROLLBACK;
SELECT 'PASS: visibility, asset assignment and admin-only settings; all changes rolled back' AS result;
