-- Security hardening: genuinely exhaustive cross-schema sweep (no schema
-- name filter applied to any of the discovery queries — every non-pg_catalog/
-- information_schema schema was checked: Socioeconomics, admin_console,
-- analysis, appeals, auth, conflict, extensions, graphql, graphql_public,
-- issue_tracker, marketing, planning_applications, planning_deliverables,
-- projects, public, rag, realtime, scraper, storage, topology, trpprojects,
-- vault). See SUPABASE_SECURITY_ADVISOR_REPORT.md Finding 9 / Appendix E for
-- the full writeup, including everything found but deliberately NOT fixed
-- here (flagged for your decision instead).
--
-- NOTE: while running this sweep, live query results showed migrations
-- 151-155 already reflected in the database (search_path pinned on all 26
-- functions, all 19+1 views showing security_invoker=true, analysis_*/
-- Finding-3 tables no longer showing open anon/authenticated grants). This
-- migration was written assuming 151-155 are already applied and does not
-- repeat anything from them.

-- ── 1. Function EXECUTE grants: the two specifically requested ──
-- Both confirmed used in-app only via an authenticated backend route (not
-- anon RPC): analyze_renewables via backend/src/controllers/analysis.controller.js
-- -> raw `pool` connection; generate_chunk_search has zero in-repo callers,
-- and pg_stat_statements shows its only observed real traffic (73 calls) is
-- service_role via RPC from the external generation/RAG pipeline. Explicitly
-- re-granting to service_role/postgres below so that external pipeline is
-- unaffected regardless of whether its access currently comes from the
-- PUBLIC grant being revoked or a separate default-privilege grant.
REVOKE EXECUTE ON FUNCTION public.analyze_renewables(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.analyze_renewables(text) TO authenticated, service_role, postgres;

REVOKE EXECUTE ON FUNCTION public.generate_chunk_search(vector, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_chunk_search(vector, text, integer) TO authenticated, service_role, postgres;

-- ── 2. extensions.pg_stat_statements(_info) exposed to anon/authenticated ──
-- New Security-Definer-View-pattern finding (category 2 of this sweep):
-- these two views expose the full normalized text of every query run on
-- this database (table/column names, query shapes -- the same catalog data
-- used throughout this entire audit) and anon/authenticated both have
-- USAGE on the `extensions` schema plus SELECT on both views. Supabase's
-- own documented remediation for this exact advisor lint is to revoke the
-- grant; nothing in this app depends on anon/authenticated being able to
-- read it.
REVOKE SELECT ON extensions.pg_stat_statements FROM anon, authenticated;
REVOKE SELECT ON extensions.pg_stat_statements_info FROM anon, authenticated;

-- ── 3. public.spatial_ref_sys -- RLS disabled, full CRUD grant to anon ──
-- Unlike the read-only PostGIS catalog views (geometry_columns etc., left
-- alone below), this one had anon/authenticated holding SELECT *and*
-- INSERT/UPDATE/DELETE with RLS off entirely -- and `public` is definitely
-- the exposed API schema (confirmed throughout this whole audit), so this
-- one is live and reachable. Runtime geometry operations never write to
-- this table (it's static SRID reference data populated once at extension
-- install), so locking writes to admin has no functional impact. This is
-- also Supabase's own documented safe remediation for this specific table.
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_spatial_ref_sys" ON public.spatial_ref_sys
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "manage_spatial_ref_sys" ON public.spatial_ref_sys
  FOR ALL USING (is_admin());

-- ── 4. `projects` schema -- 3 tables, RLS disabled, full CRUD grant to
-- anon/authenticated (id, geom, name, description map-pin data) ──
-- Confirmed used in-app only via backend/src/services/projectMap.service.js
-- -> raw `pool` connection (owner role, bypasses this either way).
-- Confirmed via has_schema_privilege that anon/authenticated do NOT have
-- USAGE on the `projects` schema itself, so these grants are not currently
-- reachable via PostgREST regardless of the table-level ACL (schema USAGE
-- is a prerequisite Postgres checks before the table-level grant is even
-- considered). Fixed anyway for defense-in-depth: if USAGE on this schema
-- is ever granted later for an unrelated reason, these three tables should
-- not go live-open the moment that happens.
ALTER TABLE projects."TRP Projects- Commercial, Economic and Industrial" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_trp_projects_commercial" ON projects."TRP Projects- Commercial, Economic and Industrial"
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "manage_trp_projects_commercial" ON projects."TRP Projects- Commercial, Economic and Industrial"
  FOR ALL USING (public.is_admin());

ALTER TABLE projects."TRP Projects- Energy, digital and infrastructure" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_trp_projects_energy" ON projects."TRP Projects- Energy, digital and infrastructure"
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "manage_trp_projects_energy" ON projects."TRP Projects- Energy, digital and infrastructure"
  FOR ALL USING (public.is_admin());

ALTER TABLE projects."TRP Projects- Residential and Strategic Land" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_trp_projects_residential" ON projects."TRP Projects- Residential and Strategic Land"
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "manage_trp_projects_residential" ON projects."TRP Projects- Residential and Strategic Land"
  FOR ALL USING (public.is_admin());
