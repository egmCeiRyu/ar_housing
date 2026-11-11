BEGIN;
-- Dedicated metadata only. No changes to existing QRIE/Character tables or policies.
CREATE TABLE public.asset_categories (
 id text PRIMARY KEY, name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80), sort_order integer NOT NULL DEFAULT 0
);
INSERT INTO public.asset_categories(id,name,sort_order) VALUES
 ('sofa','ソファ',1),('table','テーブル',2),('chair','チェア',3),('bed','ベッド',4),
 ('storage','収納家具',5),('wallpaper','壁紙',6),('floor','床材',7),('wood','木材',8),('other','その他',9);
CREATE TABLE public.assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
 category_id text NOT NULL REFERENCES public.asset_categories(id),
 asset_type text NOT NULL CHECK (asset_type IN ('model','texture')),
 s3_key text NOT NULL UNIQUE CHECK (s3_key LIKE 'qrie-assets/%'),
 thumbnail_s3_key text NOT NULL UNIQUE CHECK (thumbnail_s3_key LIKE 'qrie-assets/%'),
 original_filename text NOT NULL CHECK (char_length(original_filename) <= 255),
 content_type text NOT NULL CHECK (content_type IN ('model/gltf-binary','image/png','image/jpeg','image/webp')),
 file_size bigint NOT NULL CHECK (file_size BETWEEN 1 AND 104857600),
 thumbnail_size integer NOT NULL CHECK (thumbnail_size BETWEEN 1 AND 2097152),
 width double precision NOT NULL DEFAULT 0 CHECK (width >= 0 AND width < 1000),
 height double precision NOT NULL DEFAULT 0 CHECK (height >= 0 AND height < 1000),
 depth double precision NOT NULL DEFAULT 0 CHECK (depth >= 0 AND depth < 1000),
 pivot_offset jsonb CHECK (pivot_offset IS NULL OR jsonb_typeof(pivot_offset)='array'),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','inactive','deleted')),
 desired_status text NOT NULL DEFAULT 'active' CHECK (desired_status IN ('active','inactive')),
 created_by uuid REFERENCES auth.users(id),
 uploaded_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assets_category_status_created ON public.assets(category_id,status,created_at DESC);
CREATE INDEX assets_status_created ON public.assets(status,created_at DESC);
CREATE TABLE public.project_assets (
 project_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
 enabled boolean NOT NULL DEFAULT true,
 PRIMARY KEY (project_id,asset_id)
);
CREATE INDEX project_assets_asset_id ON public.project_assets(asset_id);
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assets ENABLE ROW LEVEL SECURITY;
-- Browser access is read-only and administrative. All writes go through validated backend.
REVOKE ALL ON public.asset_categories,public.assets,public.project_assets FROM anon,authenticated;
GRANT SELECT ON public.asset_categories,public.assets,public.project_assets TO authenticated;
GRANT ALL ON public.asset_categories,public.assets,public.project_assets TO service_role;
CREATE POLICY asset_categories_admin_read ON public.asset_categories FOR SELECT TO authenticated USING(public.is_housing_admin());
CREATE POLICY assets_admin_read ON public.assets FOR SELECT TO authenticated USING(public.is_housing_admin());
CREATE POLICY project_assets_admin_read ON public.project_assets FOR SELECT TO authenticated USING(public.is_housing_admin());
CREATE FUNCTION public.save_asset_metadata(target_id uuid, metadata jsonb, project_ids uuid[])
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 PERFORM 1 FROM public.assets WHERE id=target_id AND status IN ('active','inactive','deleted') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Asset unavailable'; END IF;
 UPDATE public.assets SET name=metadata->>'name', category_id=metadata->>'category_id',
 width=(metadata->>'width')::double precision,height=(metadata->>'height')::double precision,
 depth=(metadata->>'depth')::double precision,status=metadata->>'status',updated_at=now() WHERE id=target_id;
 UPDATE public.project_assets SET enabled=false WHERE asset_id=target_id;
 INSERT INTO public.project_assets(project_id,asset_id,enabled)
 SELECT unnest(project_ids),target_id,true ON CONFLICT(project_id,asset_id) DO UPDATE SET enabled=true;
END $$;
REVOKE ALL ON FUNCTION public.save_asset_metadata(uuid,jsonb,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_asset_metadata(uuid,jsonb,uuid[]) TO service_role;
COMMIT;
