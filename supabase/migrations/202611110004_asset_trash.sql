BEGIN;
CREATE FUNCTION public.clear_asset_trash(asset_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE current_id uuid; current_status text; removed integer=0; protected_count integer=0;
BEGIN
 IF asset_ids IS NULL OR cardinality(asset_ids) NOT BETWEEN 1 AND 24 OR array_position(asset_ids,NULL) IS NOT NULL THEN
  RAISE EXCEPTION 'このページの削除済み登録を選択してください。';
 END IF;
 FOR current_id IN SELECT DISTINCT unnest(asset_ids) ORDER BY 1 LOOP
  SELECT a.status INTO current_status FROM public.assets a WHERE a.id=current_id FOR UPDATE;
  IF NOT FOUND OR current_status<>'deleted' THEN CONTINUE; END IF;
  IF EXISTS(SELECT 1 FROM public.project_assets p WHERE p.asset_id=current_id AND p.enabled) THEN
   protected_count=protected_count+1; CONTINUE;
  END IF;
  DELETE FROM public.project_assets p WHERE p.asset_id=current_id AND NOT p.enabled;
  DELETE FROM public.assets a WHERE a.id=current_id AND a.status='deleted';
  removed=removed+1;
 END LOOP;
 RETURN jsonb_build_object('removed',removed,'protected',protected_count);
END $$;
REVOKE ALL ON FUNCTION public.clear_asset_trash(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clear_asset_trash(uuid[]) TO service_role;
COMMIT;
