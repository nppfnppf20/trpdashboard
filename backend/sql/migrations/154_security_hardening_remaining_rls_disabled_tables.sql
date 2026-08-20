-- Security hardening from SUPABASE_SECURITY_ADVISOR_REPORT.md, Finding 3
-- (remainder -- system_config was already handled in migration 151).
--
-- All tables below currently have RLS disabled entirely, and anon is
-- confirmed (has_table_privilege) to have SELECT + INSERT on every one
-- of them.
--
-- Repo check: none of the "ingestion internals" tables below appear
-- anywhere in frontend/src or backend/src -- they're written by the
-- external ingestion pipeline via the SECURITY DEFINER RPC functions
-- hardened in migration 151 (ingestion_insert_*, meeting_insert_*,
-- classify_contract), which bypass RLS via the function owner
-- regardless of the caller's role or the target table's policies. So
-- locking these fully to service_role cannot break that pipeline, and
-- nothing in this app reads them directly today.
--
-- lpa_decision_documents / lpa_decision_analysis ARE used in-app
-- (backend/src/controllers/lpaAnalysis.controller.js), but through
-- `pool` from backend/src/db.js -- a raw `pg` connection on
-- DATABASE_URL, which is the Postgres owner role and bypasses RLS by
-- default (same reasoning as the ingestion functions). Confirmed no
-- Supabase-client (anon/authenticated) access to these two tables
-- exists in this repo, so this is also safe to lock down.
--
-- ── Application-data tables: fully locked to service_role/postgres ──
-- (RLS enabled, no policies -- same treatment as system_config in
-- migration 151). These hold raw ingested appeal content, LLM prompt
-- text, or admin review-queue state that no part of this app currently
-- surfaces to authenticated users directly; if a future feature needs
-- staff-facing read access, add a scoped SELECT policy then rather than
-- guessing at exposure now.
ALTER TABLE public.argument_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.full_texts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_doc_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_doc_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summary_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lpa_decision_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lpa_decision_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_doc_types ENABLE ROW LEVEL SECURITY;

-- ── Geodata reference layers: public-read, admin-write ──
-- Matches the existing, already-correct pattern used for AONB, SSSI,
-- listed_building, conservation_area, etc: view_X lets any *logged-in*
-- user read (not fully public/anon -- consistent with every other view_*
-- policy in this schema, which all gate on auth.uid() IS NOT NULL
-- rather than USING (true)), manage_X reserves writes for admins.
-- spatial_ref_sys is a PostGIS system table, not app data -- left alone,
-- same as the st_estimatedextent PostGIS functions in migration 151.
ALTER TABLE public.local_planning_authority ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_local_planning_authority" ON public.local_planning_authority
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "manage_local_planning_authority" ON public.local_planning_authority
  FOR ALL USING (is_admin());

ALTER TABLE public."special-area-of-conservation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_special_area_of_conservation" ON public."special-area-of-conservation"
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "manage_special_area_of_conservation" ON public."special-area-of-conservation"
  FOR ALL USING (is_admin());

ALTER TABLE public."Ancient woodland" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_Ancient_woodland" ON public."Ancient woodland"
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "manage_Ancient_woodland" ON public."Ancient woodland"
  FOR ALL USING (is_admin());

ALTER TABLE public."Flood zone 2 and 3" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_Flood_zone_2_and_3" ON public."Flood zone 2 and 3"
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "manage_Flood_zone_2_and_3" ON public."Flood zone 2 and 3"
  FOR ALL USING (is_admin());

ALTER TABLE public."Local nature reserves" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_Local_nature_reserves" ON public."Local nature reserves"
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "manage_Local_nature_reserves" ON public."Local nature reserves"
  FOR ALL USING (is_admin());

ALTER TABLE public.drinking_water_protected_areas_surface_water ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_drinking_water_protected_areas_surface_water" ON public.drinking_water_protected_areas_surface_water
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "manage_drinking_water_protected_areas_surface_water" ON public.drinking_water_protected_areas_surface_water
  FOR ALL USING (is_admin());

ALTER TABLE public.ukairports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_ukairports" ON public.ukairports
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "manage_ukairports" ON public.ukairports
  FOR ALL USING (is_admin());
