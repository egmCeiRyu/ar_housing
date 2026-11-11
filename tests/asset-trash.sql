BEGIN;
DO $$
DECLARE cat text; property uuid; removable uuid=gen_random_uuid(); active_id uuid=gen_random_uuid(); protected_id uuid=gen_random_uuid(); result jsonb;
BEGIN
 SELECT id INTO cat FROM public.asset_categories WHERE archived_at IS NULL LIMIT 1;
 SELECT id INTO property FROM public.properties LIMIT 1;
 IF cat IS NULL OR property IS NULL THEN RAISE EXCEPTION 'Rollback test requires an existing category and project'; END IF;
 INSERT INTO public.assets(id,name,category_id,asset_type,s3_key,thumbnail_s3_key,original_filename,content_type,file_size,thumbnail_size,status)
 SELECT id,'一時検証',cat,'model','clients/asset-library/qa/'||id||'/original.glb','clients/asset-library/qa/'||id||'/thumbnail.webp','qa.glb','model/gltf-binary',1,1,status
 FROM (VALUES(removable,'deleted'),(active_id,'active'),(protected_id,'deleted')) AS fixture(id,status);
 INSERT INTO public.project_assets(project_id,asset_id,enabled) VALUES(property,protected_id,true),(property,removable,false);
 result=public.clear_asset_trash(ARRAY[removable,active_id,protected_id]);
 IF (result->>'removed')::integer<>1 OR (result->>'protected')::integer<>1 THEN RAISE EXCEPTION 'Unexpected cleanup counts: %',result; END IF;
 IF EXISTS(SELECT 1 FROM public.assets WHERE id=removable) OR EXISTS(SELECT 1 FROM public.project_assets WHERE asset_id=removable) THEN RAISE EXCEPTION 'Unlinked trash not cleared'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.assets WHERE id=active_id AND status='active') THEN RAISE EXCEPTION 'Active asset was affected'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.assets WHERE id=protected_id AND status='deleted') OR NOT EXISTS(SELECT 1 FROM public.project_assets WHERE asset_id=protected_id AND enabled) THEN RAISE EXCEPTION 'Linked asset was affected'; END IF;
 IF has_function_privilege('authenticated','public.clear_asset_trash(uuid[])','EXECUTE') OR has_function_privilege('anon','public.clear_asset_trash(uuid[])','EXECUTE') THEN RAISE EXCEPTION 'Cleanup RPC exposed'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: only unlinked deleted metadata removed; active and linked assets preserved; all test data rolled back.' AS result;
