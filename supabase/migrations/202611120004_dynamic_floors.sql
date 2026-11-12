BEGIN;
CREATE OR REPLACE FUNCTION public.protect_furniture_floors() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE floor jsonb;
BEGIN
 IF (TG_OP='INSERT' AND NEW.furniture_floors<>'[]'::jsonb) OR (TG_OP='UPDATE' AND NEW.furniture_floors IS DISTINCT FROM OLD.furniture_floors) THEN
  IF current_user NOT IN ('postgres','service_role') AND COALESCE(auth.jwt()->'app_metadata'->>'role','')<>'admin' THEN RAISE EXCEPTION 'Only administrators can configure furniture floors' USING ERRCODE='42501'; END IF;
 END IF;
 IF jsonb_typeof(NEW.furniture_floors)<>'array' THEN RAISE EXCEPTION 'Invalid floors'; END IF;
 IF jsonb_array_length(NEW.furniture_floors)>100 THEN RAISE EXCEPTION 'Maximum 100 floors'; END IF;
 FOR floor IN SELECT value FROM jsonb_array_elements(NEW.furniture_floors) LOOP
  IF jsonb_typeof(floor)<>'object' OR jsonb_typeof(floor->'name') IS DISTINCT FROM 'string' OR length(btrim(COALESCE(floor->>'name',''))) NOT BETWEEN 1 AND 80 OR jsonb_typeof(floor->'url') IS DISTINCT FROM 'string' OR COALESCE(floor->>'url','')!~'^https://[^[:space:]]+$' OR length(floor->>'url')>2048 THEN RAISE EXCEPTION 'Invalid floor configuration'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.furniture_floors) f GROUP BY btrim(f->>'name') HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate floor name'; END IF;
 RETURN NEW;
END $$;
COMMIT;
