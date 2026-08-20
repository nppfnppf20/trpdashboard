-- Security hardening: findings surfaced by the Supabase dashboard's built-in
-- Security Advisor that the earlier manual audit (SUPABASE_SECURITY_ADVISOR_REPORT.md)
-- missed because it was scoped mostly to the public schema. See the report's
-- Appendix D for the full confirm/scope writeup for each of these 5 items.
--
-- 1) rag.appeal_summaries -- RLS disabled, anon has SELECT.
-- 2) rag.document_sections -- RLS disabled, anon has SELECT.
--    Both are written exclusively via the SECURITY DEFINER RPC functions
--    ingestion_insert_appeal_summary / ingestion_insert_document_section
--    (search_path already pinned in migration 151), which bypass RLS via
--    the function owner regardless of the caller's role -- so this is safe
--    to lock down. Confirmed via has_table_privilege that INSERT was never
--    granted to anon/authenticated on either table (only SELECT was), and
--    both back the already-hardened chat_document_sections view (migration
--    153) with no other in-repo consumer. Locking SELECT to authenticated
--    matches the pattern used everywhere else in this schema.
--
-- 3) admin_console.projects_with_stats -- Security Definer View (owned by
--    postgres, no security_invoker, granted SELECT to anon/authenticated).
--    In-repo usage is backend/src/services/quotes.service.js
--    getProjectsWithStats(), via the raw `pool` connection (backend/src/db.js,
--    Postgres owner role) -- not PostgREST, so unaffected either way. It's
--    also the base of the already-hardened chat_project_info view (153),
--    which doesn't select any of the columns discussed below, so that view
--    is unaffected too.
--    Flagging for awareness, not blocking: this view is ALSO independently
--    granted to anon/authenticated directly. Its FROM table is `projects`,
--    which already has a real `auth.uid() IS NOT NULL` policy -- so with
--    security_invoker on, anon querying this view directly gets zero rows
--    (correct, safe). But two of its LEFT JOINs -- admin_console.client_organisations
--    and admin_console.quotes -- have RLS enabled with zero policies (the
--    same gap identified for the Finding 1 views), so an `authenticated`
--    caller hitting this view directly via PostgREST will get real project
--    rows back but with client_name/instructed_spend/completed_count/
--    outstanding_count columns NULLed out post-fix, rather than populated.
--    Not a security problem (no data leak), just a heads-up that any
--    external consumer relying on those specific aggregate columns via the
--    anon/authenticated key (rather than service_role) will see degraded
--    output, not broken auth.
--
-- 4) public.analyze_renewables(text) -- Function Search Path Mutable.
--    NOT SECURITY DEFINER (prosecdef = false), so this is not a privilege-
--    escalation vector the way the Finding 4 functions were -- it runs
--    with the caller's own privileges. Still worth pinning per the
--    advisor's standard recommendation. Used in-app via
--    backend/src/controllers/analysis.controller.js -> `pool` (raw pg,
--    owner role) and backend/src/routes/analysis.routes.js -- not called
--    via Supabase RPC from the frontend. Also has EXECUTE granted to
--    anon/authenticated directly (Supabase's default for new functions) --
--    worth knowing this is callable by anyone with the anon key, but that's
--    a separate (rate-limiting/compute-cost) concern from search_path, and
--    out of scope for this migration.
--
-- 5) public.generate_chunk_search(vector, text, integer) -- Function
--    Search Path Mutable. Also NOT SECURITY DEFINER. pg_stat_statements
--    shows all 73 observed calls executed as service_role via RPC (the
--    generation/RAG feature's vector search over rag.chunks) -- no
--    anon/authenticated calls observed, though it does have EXECUTE
--    granted to both (same as analyze_renewables). Pinning search_path is
--    still the correct fix regardless of who calls it.

ALTER FUNCTION public.analyze_renewables(polygon_geojson text) SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_chunk_search(query_embedding vector, filter_knowledge_category text, match_count integer) SET search_path = public, pg_temp;

ALTER TABLE rag.appeal_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read appeal summaries" ON rag.appeal_summaries
  FOR SELECT USING (auth.uid() IS NOT NULL);

ALTER TABLE rag.document_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read document sections" ON rag.document_sections
  FOR SELECT USING (auth.uid() IS NOT NULL);

ALTER VIEW admin_console.projects_with_stats SET (security_invoker = true);
