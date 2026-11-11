BEGIN;
-- Only QRIE asset-library metadata is affected.
ALTER TABLE public.asset_categories ADD COLUMN archived_at timestamptz;

CREATE FUNCTION public.list_asset_categories(include_archived boolean DEFAULT false)
RETURNS TABLE(id text,name text,sort_order integer,archived_at timestamptz,asset_count bigint)
LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT c.id,c.name,c.sort_order,c.archived_at,count(a.id)
 FROM public.asset_categories c LEFT JOIN public.assets a ON a.category_id=c.id
 WHERE include_archived OR c.archived_at IS NULL
 GROUP BY c.id,c.name,c.sort_order,c.archived_at ORDER BY c.sort_order,c.id;
$$;
REVOKE ALL ON FUNCTION public.list_asset_categories(boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_asset_categories(boolean) TO service_role;

CREATE FUNCTION public.manage_asset_category(operation text,category_id text,category_name text DEFAULT NULL,target_category_id text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE current_category public.asset_categories; active_count integer; clean_name text;
BEGIN
 -- Serialize category operations only; no locks on other application tables.
 PERFORM pg_catalog.pg_advisory_xact_lock(20261111,3);
 IF operation NOT IN ('create','rename','delete','restore') THEN RAISE EXCEPTION '操作が無効です。'; END IF;
 IF operation IN ('create','rename','restore') THEN
  clean_name=btrim(category_name);
  IF clean_name IS NULL OR char_length(clean_name) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'カテゴリー名は1〜80文字で入力してください。'; END IF;
  IF EXISTS(SELECT 1 FROM public.asset_categories c WHERE c.archived_at IS NULL AND lower(c.name)=lower(clean_name) AND c.id<>category_id) THEN
   RAISE EXCEPTION '同じ名前のカテゴリーがあります。';
  END IF;
 END IF;
 IF operation='create' THEN
  IF (SELECT count(*) FROM public.asset_categories)>=200 THEN RAISE EXCEPTION 'カテゴリーの登録上限に達しました。'; END IF;
  INSERT INTO public.asset_categories(id,name,sort_order) SELECT category_id,clean_name,coalesce(max(c.sort_order),0)+1 FROM public.asset_categories c;
  RETURN;
 END IF;
 SELECT * INTO current_category FROM public.asset_categories c WHERE c.id=category_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'カテゴリーが見つかりません。'; END IF;
 IF operation='restore' THEN
  IF current_category.archived_at IS NULL THEN RAISE EXCEPTION 'このカテゴリーは削除されていません。'; END IF;
  UPDATE public.asset_categories c SET name=clean_name,archived_at=NULL WHERE c.id=category_id;
  RETURN;
 END IF;
 IF current_category.archived_at IS NOT NULL THEN RAISE EXCEPTION 'このカテゴリーは削除されています。'; END IF;
 IF operation='rename' THEN
  UPDATE public.asset_categories c SET name=clean_name WHERE c.id=category_id;
  RETURN;
 END IF;
 SELECT count(*) INTO active_count FROM public.asset_categories c WHERE c.archived_at IS NULL;
 IF active_count<=1 THEN RAISE EXCEPTION '最後のカテゴリーは削除できません。'; END IF;
 IF target_category_id IS NOT NULL THEN
  IF target_category_id=category_id THEN RAISE EXCEPTION '別の移動先カテゴリーを選択してください。'; END IF;
  PERFORM 1 FROM public.asset_categories c WHERE c.id=target_category_id AND c.archived_at IS NULL FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION '有効な移動先カテゴリーを選択してください。'; END IF;
  UPDATE public.assets a SET category_id=target_category_id,updated_at=now() WHERE a.category_id=manage_asset_category.category_id;
 ELSIF EXISTS(SELECT 1 FROM public.assets a WHERE a.category_id=manage_asset_category.category_id) THEN
  RAISE EXCEPTION 'アセットの移動先カテゴリーを選択してください。';
 END IF;
 UPDATE public.asset_categories c SET archived_at=now() WHERE c.id=category_id;
END $$;
REVOKE ALL ON FUNCTION public.manage_asset_category(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.manage_asset_category(text,text,text,text) TO service_role;

-- Also protect uploads/edits from choosing a category archived by another session.
CREATE FUNCTION public.validate_asset_category() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 PERFORM 1 FROM public.asset_categories c WHERE c.id=NEW.category_id AND c.archived_at IS NULL FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION '有効なカテゴリーを選択してください。'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_asset_category() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_asset_category BEFORE INSERT OR UPDATE OF category_id ON public.assets FOR EACH ROW EXECUTE FUNCTION public.validate_asset_category();
COMMIT;
