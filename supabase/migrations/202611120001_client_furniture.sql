BEGIN;
ALTER TABLE public.clients ADD COLUMN furniture_enabled boolean NOT NULL DEFAULT false;
CREATE FUNCTION public.protect_client_furniture_setting()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF (TG_OP = 'INSERT' AND NEW.furniture_enabled) OR
    (TG_OP = 'UPDATE' AND NEW.furniture_enabled IS DISTINCT FROM OLD.furniture_enabled) THEN
  IF current_user NOT IN ('postgres','service_role') AND
     COALESCE(auth.jwt()->'app_metadata'->>'role','') <> 'admin' THEN
   RAISE EXCEPTION 'Only administrators can change furniture access' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_client_furniture_setting BEFORE INSERT OR UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.protect_client_furniture_setting();
COMMIT;
