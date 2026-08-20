-- Security hardening from SUPABASE_SECURITY_ADVISOR_REPORT.md, Finding 1.
--
-- 19 views in public are owned by `postgres` with no security_invoker
-- option, so they run with the *owner's* privileges (effectively a
-- SECURITY DEFINER view) and are granted SELECT to anon and
-- authenticated -- confirmed via has_table_privilege() for all 19.
--
-- Repo check (frontend + backend grep, this migration's author's
-- responsibility per the review request): NONE of these 19 views, and
-- none of the admin_console/rag/scraper schemas they read from, are
-- referenced anywhere in frontend/src or backend/src. The only
-- anon-scoped Supabase query in the frontend is `user_roles`
-- (frontend/src/lib/supabase.js); every other read in this app goes
-- through backend/src/supabase.js's `supabaseAdmin` (service_role) or a
-- raw `pg` pool connection (backend/src/db.js, which authenticates as
-- the Postgres owner role and also bypasses RLS). So flipping
-- security_invoker on cannot break anything in *this* codebase.
--
-- What it WILL change: the underlying tables in admin_console/rag that
-- back these views (client_organisations, contacts, projects_with_stats,
-- team_members, quotes, project_designations, project_team_members,
-- programme_events, quote_key_dates, document_sections, key_issues,
-- meeting_notes, planning_appeals, project_designations, designations,
-- stage_issue_updates, stage_updates, project_stages, appeal_designations,
-- appeal_issues, chunks, disciplines, issues) all have RLS ENABLED with
-- ZERO policies defined (confirmed via pg_policies) -- only 3 unrelated
-- admin_console tables (quote_request_recipients/templates,
-- sent_quote_requests) have any policy, and none of those back these
-- views. RLS-enabled-with-no-policy is deny-all to everyone except the
-- table owner / service_role. So after this change, all 19 views become
-- readable only by service_role/postgres -- the same end state as
-- revoking the anon/authenticated grants outright, but done the
-- "correct" way (make the view honour the RLS the tables already
-- declare) rather than papering over it with a grant revoke.
--
-- RISK TO FLAG BEFORE APPLYING: the `chat_` naming strongly suggests
-- these views feed an external AI/RAG chat tool that is NOT part of
-- this repo (n8n workflow, standalone script, etc). Unlike the
-- ingestion_* write path -- which goes through SECURITY DEFINER RPC
-- functions (ingestion_insert_*, meeting_insert_*, already hardened in
-- migration 151) that bypass RLS via the function owner regardless of
-- caller -- there is no equivalent SECURITY DEFINER function wrapping
-- reads of these specific chat_* views. If that external consumer reads
-- them via `supabase.from('chat_project_info')...` (PostgREST) using
-- the anon or authenticated key rather than a service_role key, this
-- migration will make those reads return empty results. Confirm with
-- whoever owns that consumer (or check Supabase project logs for
-- recent traffic on these view names) that it authenticates with
-- SUPABASE_SERVICE_ROLE_KEY before applying. If it doesn't, it needs to
-- move to a service-role-backed call anyway -- shipping the anon key in
-- a public frontend bundle was never a safe way to gate access to
-- contact/quote/financial data.

ALTER VIEW public.chat_client_organisations SET (security_invoker = true);
ALTER VIEW public.chat_contacts SET (security_invoker = true);
ALTER VIEW public.chat_document_sections SET (security_invoker = true);
ALTER VIEW public.chat_key_issues SET (security_invoker = true);
ALTER VIEW public.chat_meeting_actions SET (security_invoker = true);
ALTER VIEW public.chat_meeting_notes SET (security_invoker = true);
ALTER VIEW public.chat_planning_appeals SET (security_invoker = true);
ALTER VIEW public.chat_programme_events SET (security_invoker = true);
ALTER VIEW public.chat_project_designations SET (security_invoker = true);
ALTER VIEW public.chat_project_info SET (security_invoker = true);
ALTER VIEW public.chat_project_team_members SET (security_invoker = true);
ALTER VIEW public.chat_quote_key_dates SET (security_invoker = true);
ALTER VIEW public.chat_quotes SET (security_invoker = true);
ALTER VIEW public.chat_rag_project_designations SET (security_invoker = true);
ALTER VIEW public.chat_stage_issue_updates SET (security_invoker = true);
ALTER VIEW public.chat_stage_updates SET (security_invoker = true);
ALTER VIEW public.chat_team_members SET (security_invoker = true);
ALTER VIEW public.contracts_finder_review SET (security_invoker = true);
ALTER VIEW public.ingestion_appeal_designations SET (security_invoker = true);
ALTER VIEW public.ingestion_appeal_issues SET (security_invoker = true);
ALTER VIEW public.ingestion_chunks SET (security_invoker = true);
ALTER VIEW public.ingestion_disciplines SET (security_invoker = true);
ALTER VIEW public.ingestion_issues SET (security_invoker = true);
ALTER VIEW public.v_final_discipline_risk SET (security_invoker = true);
