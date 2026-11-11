BEGIN;
DO $$
DECLARE a text='qa-'||substr(gen_random_uuid()::text,1,8); b text='qa-'||substr(gen_random_uuid()::text,1,8);
 aid uuid=gen_random_uuid(); source_key text; blocked boolean=false;
BEGIN
 PERFORM public.manage_asset_category('create',a,'検証A-'||a,NULL);
 PERFORM public.manage_asset_category('create',b,'検証B-'||b,NULL);
 PERFORM public.manage_asset_category('rename',a,'検証更新-'||a,NULL);
 IF (SELECT name FROM public.asset_categories WHERE id=a)<>'検証更新-'||a THEN RAISE EXCEPTION 'Rename failed'; END IF;
 BEGIN
  PERFORM public.manage_asset_category('create','dup-'||a,'検証更新-'||a,NULL);
 EXCEPTION WHEN raise_exception THEN blocked=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Duplicate category accepted'; END IF;
 source_key='clients/asset-library/qa/'||aid||'/original.glb';
 INSERT INTO public.assets(id,name,category_id,asset_type,s3_key,thumbnail_s3_key,original_filename,content_type,file_size,thumbnail_size)
 VALUES(aid,'検証用アセット',a,'model',source_key,'clients/asset-library/qa/'||aid||'/thumbnail.webp','qa.glb','model/gltf-binary',1,1);
 blocked=false;
 BEGIN
  PERFORM public.manage_asset_category('delete',a,NULL,NULL);
 EXCEPTION WHEN raise_exception THEN blocked=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Nonempty category deleted without target'; END IF;
 IF (SELECT archived_at IS NOT NULL FROM public.asset_categories WHERE id=a) THEN RAISE EXCEPTION 'Failed deletion changed category'; END IF;
 PERFORM public.manage_asset_category('delete',a,NULL,b);
 IF (SELECT category_id FROM public.assets WHERE id=aid)<>b THEN RAISE EXCEPTION 'Asset transfer failed'; END IF;
 IF (SELECT s3_key FROM public.assets WHERE id=aid)<>source_key THEN RAISE EXCEPTION 'Asset file reference changed'; END IF;
 IF NOT (SELECT archived_at IS NOT NULL FROM public.asset_categories WHERE id=a) THEN RAISE EXCEPTION 'Archive failed'; END IF;
 blocked=false;
 BEGIN
  UPDATE public.assets SET category_id=a WHERE id=aid;
 EXCEPTION WHEN raise_exception THEN blocked=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Archived category accepted'; END IF;
 PERFORM public.manage_asset_category('restore',a,'検証更新-'||a,NULL);
 IF (SELECT archived_at IS NOT NULL FROM public.asset_categories WHERE id=a) THEN RAISE EXCEPTION 'Restore failed'; END IF;
 IF has_function_privilege('authenticated','public.manage_asset_category(text,text,text,text)','EXECUTE') OR
    has_function_privilege('anon','public.manage_asset_category(text,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Category write permissions exposed'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: create, rename, duplicate rejection, required transfer, archive, restore, preserved file references and restricted RPC. All test data rolled back.' AS result;
