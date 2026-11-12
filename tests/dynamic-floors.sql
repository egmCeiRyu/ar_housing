BEGIN;
CREATE TEMP TABLE dynamic_floor_test(furniture_floors jsonb);
CREATE TRIGGER floor_guard BEFORE INSERT OR UPDATE ON dynamic_floor_test FOR EACH ROW EXECUTE FUNCTION public.protect_furniture_floors();
INSERT INTO dynamic_floor_test VALUES('[{"name":"1階","url":"https://example.com/1.glb"},{"name":"2階","url":"https://example.com/2.glb"},{"name":"3階","url":"https://example.com/3.glb"}]');
DO $$ BEGIN
 IF (SELECT jsonb_array_length(furniture_floors) FROM dynamic_floor_test)<>3 THEN RAISE EXCEPTION 'Third floor missing'; END IF;
 UPDATE dynamic_floor_test SET furniture_floors=furniture_floors||'[{"name":"屋上","url":"https://example.com/roof.glb"}]';
 BEGIN UPDATE dynamic_floor_test SET furniture_floors='[{"name":"1階","url":"https://example.com/1.glb"},{"name":"1階","url":"https://example.com/2.glb"}]'; RAISE EXCEPTION 'Duplicate accepted' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 BEGIN UPDATE dynamic_floor_test SET furniture_floors='[{"name":"3階","url":"http://example.com/3.glb"}]'; RAISE EXCEPTION 'HTTP accepted' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
END $$;
GRANT SELECT,UPDATE ON dynamic_floor_test TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"app_metadata":{"role":"client"}}',true);
DO $$ BEGIN
 BEGIN UPDATE dynamic_floor_test SET furniture_floors='[]'; RAISE EXCEPTION 'Client changed floors' USING ERRCODE='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: third floor and custom names accepted; duplicates, HTTP and client updates blocked; rolled back' AS result;
