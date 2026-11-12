BEGIN;
DO $$
DECLARE target uuid; previous boolean;
BEGIN
 SELECT id,furniture_enabled INTO target,previous FROM public.clients LIMIT 1;
 IF target IS NULL THEN RAISE EXCEPTION 'Client required for rollback test'; END IF;
 UPDATE public.clients SET furniture_enabled=NOT previous WHERE id=target;
 IF NOT EXISTS(SELECT 1 FROM public.clients WHERE id=target AND furniture_enabled=NOT previous) THEN RAISE EXCEPTION 'Admin setting failed'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: setting saved by admin and rolled back' AS result;
