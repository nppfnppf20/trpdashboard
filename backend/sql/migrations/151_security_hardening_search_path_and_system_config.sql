-- Security hardening from SUPABASE_SECURITY_ADVISOR_REPORT.md.
--
-- 1) Pin search_path on SECURITY DEFINER functions that had it unset
--    (mutable search_path on a SECURITY DEFINER function is a known
--    privilege-escalation vector). PostGIS-owned st_estimatedextent
--    overloads are intentionally excluded.
--
-- 2) Lock down system_config: confirmed anon/authenticated had SELECT
--    and INSERT on it with RLS disabled, and nothing in the codebase
--    reads/writes it directly, so it's safe to restrict to
--    service_role/postgres only (RLS enabled, no policies).

ALTER FUNCTION public.appeal_chunk_search(query_embedding double precision[], filter_appeal_id uuid, filter_section_type text, filter_issue_slug text) SET search_path = public, pg_temp;
ALTER FUNCTION public.appeal_issue_card_search(query_embedding double precision[], filter_appeal_id uuid, filter_weight_level text) SET search_path = public, pg_temp;
ALTER FUNCTION public.classify_contract(p_id integer, p_relevant boolean, p_reason text, p_confidence text, p_reviewed_at timestamp with time zone) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_disciplines() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_role() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.ingestion_insert_appeal(p_appeal_ref text, p_decision text, p_decision_date date, p_lpa text, p_inspector_name text, p_procedure text, p_application_type text, p_site_address text, p_related_app_ref text, p_linked_project_id uuid, p_key_lessons text) SET search_path = public, pg_temp;
ALTER FUNCTION public.ingestion_insert_appeal_chunk(p_appeal_id uuid, p_content text, p_embedding vector, p_section_type text, p_issue_slug text, p_discipline text, p_section_title text) SET search_path = public, pg_temp;
ALTER FUNCTION public.ingestion_insert_appeal_designation_link(p_appeal_id uuid, p_designation_id uuid, p_site_relation text) SET search_path = public, pg_temp;
ALTER FUNCTION public.ingestion_insert_appeal_issue_card(p_appeal_id uuid, p_issue_title text, p_policy_refs text[], p_key_facts text, p_key_text text, p_weight_level text, p_conclusion_on_issue text, p_para_refs text, p_user_notes text, p_main_issue_id uuid, p_embedding vector) SET search_path = public, pg_temp;
ALTER FUNCTION public.ingestion_insert_appeal_issue_link(p_appeal_id uuid, p_issue_id uuid, p_inspector_finding text, p_weight_given text) SET search_path = public, pg_temp;
ALTER FUNCTION public.ingestion_insert_appeal_main_issue(p_appeal_id uuid, p_sort_order integer, p_tag text, p_issue_text text) SET search_path = public, pg_temp;
ALTER FUNCTION public.ingestion_insert_appeal_policy_link(p_appeal_id uuid, p_policy_ref text) SET search_path = public, pg_temp;
ALTER FUNCTION public.ingestion_insert_appeal_summary(p_appeal_id uuid, p_summary text, p_key_outcome text, p_main_issues text[], p_disciplines text[], p_policy_refs text[]) SET search_path = public, pg_temp;
ALTER FUNCTION public.ingestion_insert_chunk(p_content text, p_embedding double precision[], p_metadata jsonb, p_project_id uuid, p_knowledge_category text) SET search_path = public, pg_temp;
ALTER FUNCTION public.ingestion_insert_document_section(p_project_id uuid, p_doc_type text, p_stage text, p_date text, p_file_title text, p_document_section text, p_section_title text, p_discipline text, p_verbatim_text text, p_word_count integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.ingestion_upsert_appeal_designation(p_slug text, p_display_name text) SET search_path = public, pg_temp;
ALTER FUNCTION public.ingestion_upsert_appeal_issue(p_slug text, p_display_name text, p_discipline text) SET search_path = public, pg_temp;
ALTER FUNCTION public.ingestion_upsert_issue(p_slug text, p_display_name text, p_discipline text, p_issue_type text) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.meeting_chunk_search(query_embedding double precision[], filter_project_id uuid, filter_discipline text, filter_chunk_type text, filter_action_status text, filter_transcript_id uuid, filter_date_from date, filter_date_to date, filter_meeting_type text, filter_meeting_category text) SET search_path = public, pg_temp;
ALTER FUNCTION public.meeting_insert_action(p_meeting_note_id uuid, p_project_id uuid, p_project_name text, p_meeting_date date, p_meeting_title text, p_description text, p_owner text, p_owner_unclear boolean, p_deadline text, p_discipline text, p_issue text) SET search_path = public, pg_temp;
ALTER FUNCTION public.meeting_insert_chunk(p_meeting_note_id uuid, p_transcript_id uuid, p_project_id uuid, p_project_name text, p_meeting_date date, p_meeting_title text, p_content text, p_embedding double precision[], p_chunk_type text, p_discipline text, p_issue text, p_action_owner text, p_deadline text, p_action_status text) SET search_path = public, pg_temp;
ALTER FUNCTION public.meeting_insert_note(p_project_id uuid, p_project_name text, p_meeting_date date, p_meeting_title text, p_participants text, p_summary_markdown text, p_actions jsonb, p_decisions jsonb, p_meeting_category text, p_meeting_type text) SET search_path = public, pg_temp;
ALTER FUNCTION public.meeting_insert_transcript(p_meeting_note_id uuid, p_project_id uuid, p_project_name text, p_meeting_date date, p_meeting_title text, p_transcript_text text) SET search_path = public, pg_temp;
ALTER FUNCTION public.meeting_update_action_status(p_action_id uuid, p_status text, p_completed_date date) SET search_path = public, pg_temp;

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
