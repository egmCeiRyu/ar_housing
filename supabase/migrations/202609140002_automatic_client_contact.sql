BEGIN;

-- Expose only the contact address for an active public AR project.
-- Customer-table read policies remain unchanged.
CREATE OR REPLACE FUNCTION public.get_ar_contact_email(project_slug text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT NULLIF(btrim(c.email), '')
    FROM public.properties AS p
    JOIN public.clients AS c ON c.id = p.client_id
    WHERE p.slug = project_slug AND p.status = 'active'
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_ar_contact_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ar_contact_email(text) TO anon, authenticated;

COMMIT;
