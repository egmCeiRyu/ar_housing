BEGIN;
ALTER TABLE public.properties ADD COLUMN furniture_floors jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE FUNCTION public.protect_furniture_floors() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE floor jsonb;
BEGIN
 IF (TG_OP='INSERT' AND NEW.furniture_floors<>'[]'::jsonb) OR (TG_OP='UPDATE' AND NEW.furniture_floors IS DISTINCT FROM OLD.furniture_floors) THEN
  IF current_user NOT IN ('postgres','service_role') AND COALESCE(auth.jwt()->'app_metadata'->>'role','')<>'admin' THEN RAISE EXCEPTION 'Only administrators can configure furniture floors' USING ERRCODE='42501'; END IF;
 END IF;
 IF jsonb_typeof(NEW.furniture_floors)<>'array' THEN RAISE EXCEPTION 'Invalid floors'; END IF;
 IF jsonb_array_length(NEW.furniture_floors)>2 THEN RAISE EXCEPTION 'Maximum two floors'; END IF;
 FOR floor IN SELECT value FROM jsonb_array_elements(NEW.furniture_floors) LOOP
  IF COALESCE(floor->>'name','') NOT IN ('1階','2階') OR COALESCE(floor->>'url','')!~'^https://[^[:space:]]+$' OR length(floor->>'url')>2048 THEN RAISE EXCEPTION 'Invalid floor configuration'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_furniture_floors BEFORE INSERT OR UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.protect_furniture_floors();
CREATE FUNCTION public.get_furniture_config(project_slug text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('name',p.name,'floors',p.furniture_floors,'assets',COALESCE((
  SELECT jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'asset_type',a.asset_type,'category_name',c.name,'s3_key',a.s3_key,'thumbnail_s3_key',a.thumbnail_s3_key,'width',a.width,'height',a.height,'depth',a.depth) ORDER BY c.sort_order,a.name)
  FROM public.project_assets pa JOIN public.assets a ON a.id=pa.asset_id JOIN public.asset_categories c ON c.id=a.category_id
  WHERE pa.project_id=p.id AND pa.enabled AND a.status='active' AND c.archived_at IS NULL
 ),'[]'::jsonb))
 FROM public.properties p JOIN public.clients client ON client.id=p.client_id
 WHERE p.slug=project_slug AND p.status='active' AND client.furniture_enabled AND jsonb_array_length(p.furniture_floors)>0 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_furniture_config(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_furniture_config(text) TO anon,authenticated;
COMMIT;
