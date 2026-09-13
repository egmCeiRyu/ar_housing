BEGIN;

-- Run through a trusted Supabase database connection, never from the browser.
DO $$
BEGIN
  IF (SELECT count(*) FROM auth.users WHERE lower(email) = 'egami@ceiryu.com') <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one administrator account: egami@ceiryu.com';
  END IF;
END $$;
UPDATE auth.users
SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
WHERE lower(email) = 'egami@ceiryu.com';

CREATE OR REPLACE FUNCTION public.is_housing_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND raw_app_meta_data ->> 'role' = 'admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_housing_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_housing_admin() TO anon, authenticated;

-- Restrictive policies also constrain any existing permissive policies.
-- Preserve the existing public AR reads and analytics ingestion policies.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients', 'properties', 'project_colors'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY housing_admin_access ON public.%I FOR ALL TO authenticated USING (public.is_housing_admin()) WITH CHECK (public.is_housing_admin())', t);
    EXECUTE format('CREATE POLICY housing_admin_insert ON public.%I AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (public.is_housing_admin())', t);
    EXECUTE format('CREATE POLICY housing_admin_update ON public.%I AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (public.is_housing_admin()) WITH CHECK (public.is_housing_admin())', t);
    EXECUTE format('CREATE POLICY housing_admin_delete ON public.%I AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (public.is_housing_admin())', t);
  END LOOP;
END $$;

CREATE POLICY housing_client_read_boundary ON public.clients
AS RESTRICTIVE FOR SELECT TO anon, authenticated
USING (public.is_housing_admin() OR auth_user_id = auth.uid());

COMMIT;
