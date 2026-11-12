BEGIN;
CREATE OR REPLACE FUNCTION public.get_furniture_config(project_slug text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('name',p.name,'floors',p.furniture_floors,'assets',COALESCE((
  SELECT jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'asset_type',a.asset_type,'category_name',c.name,'s3_key',a.s3_key,'thumbnail_s3_key',a.thumbnail_s3_key,'width',a.width,'height',a.height,'depth',a.depth) ORDER BY c.sort_order,a.name)
  FROM public.assets a JOIN public.asset_categories c ON c.id=a.category_id
  WHERE a.status='active' AND c.archived_at IS NULL
 ),'[]'::jsonb))
 FROM public.properties p JOIN public.clients client ON client.id=p.client_id
 WHERE p.slug=project_slug AND p.status='active' AND client.furniture_enabled AND jsonb_array_length(p.furniture_floors)>0 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_furniture_config(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_furniture_config(text) TO anon,authenticated;
COMMIT;
