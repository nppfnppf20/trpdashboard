# Supabase Security Advisor Report

**Date:** 2026-08-19
**Method:** This MCP server does not expose a dedicated `get_advisors` tool — only `execute_sql`, `list_extensions`, `list_migrations`, `list_tables`, `search_docs`. The standard Supabase advisor checks (RLS status/policies, SECURITY DEFINER views, SECURITY DEFINER functions with mutable search_path, extension placement, materialized views/foreign tables exposed via the API) were replicated by querying the Postgres catalogs directly (`pg_class`, `pg_policies`, `pg_proc`, `has_table_privilege`, etc.).
**Changes made:** None. This is a read-only report.

---

## 🔴 Critical

### 1. Views that bypass RLS entirely (Security Definer View pattern)

19 views in `public` are owned by `postgres`, have no `security_invoker` option set (so they execute with the *owner's* privileges, not the caller's), and are granted `SELECT` to both `anon` and `authenticated`:

`chat_client_organisations`, `chat_contacts`, `chat_document_sections`, `chat_key_issues`, `chat_meeting_actions`, `chat_meeting_notes`, `chat_planning_appeals`, `chat_programme_events`, `chat_project_designations`, `chat_project_info`, `chat_project_team_members`, `chat_quote_key_dates`, `chat_quotes`, `chat_rag_project_designations`, `chat_stage_issue_updates`, `chat_stage_updates`, `chat_team_members`, `contracts_finder_review`, `ingestion_appeal_designations`, `ingestion_appeal_issues`, `ingestion_chunks`, `ingestion_disciplines`, `ingestion_issues`, `v_final_discipline_risk`

Any RLS policy on the underlying tables is irrelevant when queried through these views — anyone with the public `anon` key can read whatever the view exposes, full stop. Confirmed `has_table_privilege('anon', ..., 'SELECT') = true` on a sample of these (`chat_project_info`, `chat_contacts`, `ingestion_chunks`, `ingestion_issues`, `contracts_finder_review`, `v_final_discipline_risk`).

### 2. RLS-enabled tables with trivially permissive policies (`USING (true)` / `WITH CHECK (true)`, role `public`)

RLS is "on" but the policy grants unrestricted read/write to anyone, including unauthenticated `anon`:

| Table | Permissive policies |
|---|---|
| `analysis_change_log` | SELECT `true`, INSERT `true` |
| `analysis_changes` | SELECT `true`, INSERT `true` |
| `analysis_discipline_summary` | SELECT `true`, INSERT `true` |
| `analysis_edited` | SELECT `true`, INSERT `true`, UPDATE `true` |
| `analysis_edits` | SELECT `true`, INSERT `true`, UPDATE `true` |
| `analysis_findings` | SELECT `true`, INSERT `true` |
| `analysis_rules_triggered` | SELECT `true`, INSERT `true` |
| `analysis_original` | SELECT `true` (INSERT gated by `auth.uid() = created_by OR created_by IS NULL`) |
| `analysis_sessions` | SELECT `true` (INSERT gated by `auth.uid() = created_by OR created_by IS NULL`) |

Confirmed `anon` can `SELECT`/`INSERT` on `analysis_edited` directly. RLS is enabled in name only on these tables.

### 3. Tables with RLS disabled entirely (23 tables)

Several hold non-reference application data, not just open geodata:

`argument_records`, `summaries`, `tags`, `full_texts`, `pending_lessons`, `lessons_log`, `ingestion_log`, `system_config`, `planning_doc_types`, `planning_doc_sections`, `ingestion_prompts`, `summary_chunks`, `lpa_decision_documents`, `lpa_decision_analysis`, `local_planning_authority`, `generation_doc_types`, `special-area-of-conservation`, `Ancient woodland`, `Flood zone 2 and 3`, `Local nature reserves`, `drinking_water_protected_areas_surface_water`, `ukairports`, `spatial_ref_sys`.

Confirmed `anon` has full `SELECT` + `INSERT` on `summaries`, `tags`, `system_config` directly (default Supabase grants, nothing restricting access). `system_config` being open read/write to `anon` is worth a second look — that's application configuration, not open reference geodata.

---

## 🟠 High

### 4. SECURITY DEFINER functions without a pinned `search_path`

33 functions in `public` are `SECURITY DEFINER`; **29 of them have no `search_path` set** in `proconfig`. This is the classic search_path-hijack vector (a caller-controlled schema/object earlier in the resolution path could get executed with the function owner's privileges).

Only these have `search_path=public` pinned:
- `ingestion_delete_chunks_by_file`
- `ingestion_insert_chunk_issue_link`
- `ingestion_insert_key_issue`
- `ingestion_insert_key_issue_discipline`

Unpinned (search_path mutable): `appeal_chunk_search`, `appeal_issue_card_search`, `classify_contract`, `get_disciplines`, `get_user_role`, `handle_new_user`, `is_admin`, most `ingestion_insert_*`/`ingestion_upsert_*` functions, `meeting_chunk_search`, `meeting_insert_*`, `meeting_update_action_status`, and the `st_estimatedextent` overloads (PostGIS-owned, lower concern).

`is_admin()` and `get_user_role()` are especially worth pinning since they gate the admin-only policies referenced above (`manage_*` policies on GIS tables, `Admins can manage all projects`, `Admins can manage roles`, etc.) — if their resolution path were ever hijackable it would undermine every policy that calls them.

---

## 🟡 Medium

### 5. Extensions installed into the `public` schema instead of a dedicated schema

`postgis`, `postgis_raster`, `pg_trgm`, `vector` are installed in `public` (Supabase recommends a separate `extensions` schema — already done correctly for `pgcrypto`, `uuid-ossp`, `pg_stat_statements`). Low direct risk but pollutes the API surface; this is the standard `extension_in_public` advisor lint.

---

## ℹ️ Informational (not a vulnerability, but worth flagging)

### 6. RLS-enabled tables with zero policies defined

Effectively locked to everyone except `service_role`:

`appeal_arguments`, `appeal_documents`, `appeal_issue_notes`, `appeal_prompt_settings`, `appeals`, `policy_documents`, `project_planning_history`, `project_policies`, `socioeconomics_sessions`.

Safe by default, but if the frontend expects `anon`/`authenticated` to read/write these directly (rather than through a service-role backend), they're currently getting nothing. Given ongoing work on the appeals feature and unapplied migrations noted elsewhere in the project, this is likely in-progress rather than a real gap — flagging so it isn't mistaken for "RLS is protecting this."

### 7. Well-configured tables, for contrast

`projects`, `user_roles`, `site_analyses`, `trp_reports` all have real `auth.uid()`-based policies and admin-gated writes via `is_admin()`. The GIS reference layers (`AONB`, `SSSI`, `listed_building`, `conservation_area`, etc.) correctly allow public read but gate writes behind `is_admin()` — good pattern, no action needed.

No foreign tables and no materialized views exist in `public`, so those two advisor checks are clean.

---

## Summary / suggested priority

The most consequential single fix would be:

1. Add `security_invoker = true` to the 19 views in [Finding 1](#1-views-that-bypass-rls-entirely-security-definer-view-pattern) (or restrict them to `service_role`-only access).
2. Tighten the `analysis_*` table policies in [Finding 2](#2-rls-enabled-tables-with-trivially-permissive-policies-using-true--with-check-true-role-public) to check `auth.uid()` instead of `true`.
3. Enable RLS with real policies on the 23 tables in [Finding 3](#3-tables-with-rls-disabled-entirely-23-tables), starting with `system_config`.
4. Pin `search_path` on the SECURITY DEFINER functions in [Finding 4](#4-security-definer-functions-without-a-pinned-search_path), starting with `is_admin()` and `get_user_role()`.

No remediation SQL has been applied — this report is diagnostic only.

---

## Appendix A: Confirmed `system_config` exposure (follow-up query)

Re-checked directly against `system_config`:

```json
{"anon_select": true, "anon_insert": true, "auth_select": true, "auth_insert": true}
```

```json
{"relrowsecurity": false}
```

Confirms Finding 3: any unauthenticated request with the public `anon` key can read **and write** `system_config` today. Recommend prioritizing this table when working through Finding 3.

## Appendix B: Generated `ALTER FUNCTION ... SET search_path` statements (Finding 4)

Not yet applied. Covers the 26 non-PostGIS `SECURITY DEFINER` functions with a mutable `search_path` (PostGIS's `st_estimatedextent` overloads excluded — extension-owned).

```sql
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
```
