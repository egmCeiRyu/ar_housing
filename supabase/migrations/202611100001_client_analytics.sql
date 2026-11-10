BEGIN;

CREATE OR REPLACE FUNCTION public.get_property_analytics(requested_property_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'project_name', p.name,
        'views', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'device', v.device,
                'browser', v.browser
            ))
            FROM public.page_views AS v
            WHERE v.property_id = p.id
        ), '[]'::jsonb),
        'sessions', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'started_at', s.started_at,
                'duration_seconds', coalesce(to_jsonb(s)->'duration_seconds', to_jsonb(s)->'duration')
            ) ORDER BY s.started_at)
            FROM public.ar_sessions AS s
            WHERE s.property_id = p.id
        ), '[]'::jsonb)
    )
    FROM public.properties AS p
    WHERE p.id::text = requested_property_id
      AND auth.uid() IS NOT NULL
      AND (
          public.is_housing_admin()
          OR EXISTS (
              SELECT 1 FROM public.clients AS c
              WHERE c.id = p.client_id AND c.auth_user_id = auth.uid()
          )
      );
$$;

REVOKE ALL ON FUNCTION public.get_property_analytics(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_property_analytics(text) TO authenticated;

COMMIT;
