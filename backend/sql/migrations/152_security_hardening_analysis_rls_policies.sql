-- Security hardening from SUPABASE_SECURITY_ADVISOR_REPORT.md, Finding 2.
--
-- The 9 analysis_* tables have RLS "enabled" but every policy is
-- USING (true) / WITH CHECK (true) -- equivalent to no RLS at all, and
-- confirmed anon can SELECT/INSERT on analysis_edited directly.
--
-- Confirmed via backend/src/services/analysisSession.service.js and
-- analysisVersioning.service.js (the only in-repo consumers of these
-- tables) that both import `supabaseAdmin` (service_role), which bypasses
-- RLS entirely -- so tightening these policies cannot break the app.
--
-- None of these tables have a created_by/user_id column suitable for a
-- per-row-owner policy except analysis_original.created_by and
-- analysis_sessions.created_by, and the app's own established pattern
-- (projects, site_analyses, trp_reports -- see pg_policies) is shared
-- visibility for all logged-in staff, not per-owner isolation: SELECT/
-- INSERT/UPDATE gated on `auth.uid() IS NOT NULL`, deletes reserved for
-- admins where a delete policy exists at all. This migration matches
-- that convention rather than introducing owner-only access, which
-- would contradict how the tool is actually used (any staff member
-- viewing a project's analysis needs to see all disciplines' data, not
-- just rows they personally created).
--
-- analysis_original / analysis_sessions previously allowed INSERT with
-- `(auth.uid() = created_by) OR (created_by IS NULL)`. That OR clause is
-- a loophole, not a deliberate allowance: passing created_by = NULL (the
-- column default) satisfies it for a fully unauthenticated `anon`
-- request, so anyone with the public anon key could create analysis
-- sessions today. Replaced with `auth.uid() IS NOT NULL`, matching every
-- other table here -- created_by remains available for audit purposes,
-- it's just no longer part of the access check.

-- analysis_change_log
DROP POLICY IF EXISTS "Users can insert change log" ON public.analysis_change_log;
DROP POLICY IF EXISTS "Users can read all change log" ON public.analysis_change_log;
CREATE POLICY "Authenticated users can insert change log" ON public.analysis_change_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can read change log" ON public.analysis_change_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- analysis_changes
DROP POLICY IF EXISTS "Users can insert changes" ON public.analysis_changes;
DROP POLICY IF EXISTS "Users can read all changes" ON public.analysis_changes;
CREATE POLICY "Authenticated users can insert changes" ON public.analysis_changes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can read changes" ON public.analysis_changes
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- analysis_discipline_summary
DROP POLICY IF EXISTS "Users can insert summaries" ON public.analysis_discipline_summary;
DROP POLICY IF EXISTS "Users can read all summaries" ON public.analysis_discipline_summary;
CREATE POLICY "Authenticated users can insert discipline summaries" ON public.analysis_discipline_summary
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can read discipline summaries" ON public.analysis_discipline_summary
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- analysis_edited
DROP POLICY IF EXISTS "Users can insert edited analyses" ON public.analysis_edited;
DROP POLICY IF EXISTS "Users can read all edited analyses" ON public.analysis_edited;
DROP POLICY IF EXISTS "Users can update edited analyses" ON public.analysis_edited;
CREATE POLICY "Authenticated users can insert edited analyses" ON public.analysis_edited
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can read edited analyses" ON public.analysis_edited
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update edited analyses" ON public.analysis_edited
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- analysis_edits
DROP POLICY IF EXISTS "Users can insert edits" ON public.analysis_edits;
DROP POLICY IF EXISTS "Users can read all edits" ON public.analysis_edits;
DROP POLICY IF EXISTS "Users can update edits" ON public.analysis_edits;
CREATE POLICY "Authenticated users can insert edits" ON public.analysis_edits
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can read edits" ON public.analysis_edits
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update edits" ON public.analysis_edits
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- analysis_findings
DROP POLICY IF EXISTS "Users can insert findings" ON public.analysis_findings;
DROP POLICY IF EXISTS "Users can read all findings" ON public.analysis_findings;
CREATE POLICY "Authenticated users can insert findings" ON public.analysis_findings
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can read findings" ON public.analysis_findings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- analysis_original
DROP POLICY IF EXISTS "Users can insert own original analyses" ON public.analysis_original;
DROP POLICY IF EXISTS "Users can read all original analyses" ON public.analysis_original;
CREATE POLICY "Authenticated users can insert original analyses" ON public.analysis_original
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can read original analyses" ON public.analysis_original
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- analysis_rules_triggered
DROP POLICY IF EXISTS "Users can insert rules" ON public.analysis_rules_triggered;
DROP POLICY IF EXISTS "Users can read all rules" ON public.analysis_rules_triggered;
CREATE POLICY "Authenticated users can insert rules triggered" ON public.analysis_rules_triggered
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can read rules triggered" ON public.analysis_rules_triggered
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- analysis_sessions
DROP POLICY IF EXISTS "Users can insert analysis sessions" ON public.analysis_sessions;
DROP POLICY IF EXISTS "Users can read all analysis sessions" ON public.analysis_sessions;
CREATE POLICY "Authenticated users can insert analysis sessions" ON public.analysis_sessions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can read analysis sessions" ON public.analysis_sessions
  FOR SELECT USING (auth.uid() IS NOT NULL);
