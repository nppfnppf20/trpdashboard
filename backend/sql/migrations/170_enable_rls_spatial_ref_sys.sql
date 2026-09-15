-- spatial_ref_sys is a PostGIS system table holding public coordinate reference
-- system definitions (EPSG codes). It contains no application data, but Supabase's
-- Security Advisor flags any public-schema table without RLS. Enable RLS with a
-- permissive read-only policy so PostGIS functions keep working, silencing the
-- advisor without restricting access to data that was never sensitive.

ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to spatial reference systems"
  ON public.spatial_ref_sys
  FOR SELECT
  USING (true);
