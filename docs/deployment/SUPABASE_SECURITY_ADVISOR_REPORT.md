# Supabase Security Advisor Report

**Date:** 2026-08-19
**Method:** This MCP server does not expose a dedicated `get_advisors` tool — only `execute_sql`, `list_extensions`, `list_migrations`, `list_tables`, `search_docs`. The standard Supabase advisor checks (RLS status/policies, SECURITY DEFINER views, SECURITY DEFINER functions with mutable search_path, extension placement, materialized views/foreign tables exposed via the API) were replicated by querying the Postgres catalogs directly (`pg_class`, `pg_policies`, `pg_proc`, `has_table_privilege`, etc.).
**Changes made:** None. This is a read-only report.
**Remediation status (updated 2026-08-19):** Migration files written for review, none applied yet.
- `backend/sql/migrations/151_security_hardening_search_path_and_system_config.sql` — Finding 4 (search_path) + part of Finding 3 (`system_config`)
- `backend/sql/migrations/152_security_hardening_analysis_rls_policies.sql` — Finding 2 (`analysis_*` permissive policies)
- `backend/sql/migrations/153_security_hardening_chat_views_security_invoker.sql` — Finding 1 (19 `chat_*`/`ingestion_*` views) — flagged risk (external consumer might read via `anon`/`authenticated`) checked and cleared, see [Appendix C](#appendix-c-153-risk-check-resolved-chat-view-traffic-is-service_role-only); safe to apply
- `backend/sql/migrations/154_security_hardening_remaining_rls_disabled_tables.sql` — Finding 3 (remaining tables)
- `backend/sql/migrations/155_security_hardening_rag_admin_console_schemas.sql` — Finding 8 (`rag`/`admin_console` schema gaps the manual audit missed — see [Appendix D](#appendix-d-rag--admin_console-schema-gaps-from-the-supabase-dashboard-advisor))
- `backend/sql/migrations/156_security_hardening_exhaustive_cross_schema_sweep.sql` — Finding 9 (genuinely exhaustive, no-schema-filter sweep — see [Appendix E](#appendix-e-exhaustive-cross-schema-sweep-no-schema-name-filter))
- `backend/sql/migrations/157_security_hardening_classify_contract_execute_grant.sql` — Finding 10 (`public.classify_contract` — Finding 9's flagged "most serious" item, now fixed — see [Appendix F](#appendix-f-classify_contract-investigation-and-fix--flagged-tail-status-check))

All seven are clear to apply, in order 151 → 152 → 153 → 154 → 155 → 156 → 157.

**Live-database note (2026-08-19, during the Finding 9 sweep):** query results while running Finding 9's discovery queries showed migrations 151-155 already reflected in the live database — all 26 functions from 151 show `search_path` set, all 20 views from 153/155 show `security_invoker=true`, and the Finding 2/3 tables no longer show open `anon`/`authenticated` grants. This wasn't confirmed with you directly, so flagging it plainly here rather than assuming — if that's not expected, worth double-checking what got applied and when.

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

## 🔴 Critical (cross-schema, found after this report's initial `public`-only pass)

### 8. `rag`/`admin_console` schema gaps missed by scoping the original audit to `public`

The original pass in this report queried `pg_class`/`pg_policies`/`pg_proc` filtered to `n.nspname = 'public'`, so it missed equivalents of Findings 1/3/4 living in the `rag` and `admin_console` schemas. The Supabase dashboard's built-in Security Advisor (not available via this MCP server, but cross-checked manually here) flagged 5 of these; confirmed and scoped in [Appendix D](#appendix-d-rag--admin_console-schema-gaps-from-the-supabase-dashboard-advisor). Fix: `backend/sql/migrations/155_security_hardening_rag_admin_console_schemas.sql`.

- `rag.appeal_summaries` — RLS disabled, `anon` has SELECT
- `rag.document_sections` — RLS disabled, `anon` has SELECT
- `admin_console.projects_with_stats` — Security Definer View (same pattern as Finding 1)
- `public.analyze_renewables` — Function Search Path Mutable (not SECURITY DEFINER, lower severity than Finding 4)
- `public.generate_chunk_search` — Function Search Path Mutable (not SECURITY DEFINER, lower severity than Finding 4)

This was a scoping gap in the original method, not a sign these are the only two non-`public` schemas worth checking — `admin_console`, `scraper`, and `rag` all have additional RLS-disabled tables beyond these two that weren't in scope for this pass (e.g. `admin_console.users`, `admin_console.project_information`, `scraper.contracts_finder`, `rag.disciplines`, `rag.meeting_actions`); a full cross-schema pass would need to cover those too.

---

### 9. Genuinely exhaustive, no-schema-name-filter sweep

Every prior pass scoped its discovery queries to an explicit schema list (`public`, then `public`+`rag`+`admin_console`+`scraper`, then the 5 dashboard-flagged items). This pass removed schema-name filtering entirely from all four discovery queries — they ran across every schema in the database and were only filtered by the actual condition being checked (RLS disabled + a real grant, security_invoker unset + a real grant, etc.), never by an assumed schema list. Full writeup, including a list of every schema that exists and what was found in each: [Appendix E](#appendix-e-exhaustive-cross-schema-sweep-no-schema-name-filter). Fix: `backend/sql/migrations/156_security_hardening_exhaustive_cross_schema_sweep.sql`.

**Fixed in 156:**
- `extensions.pg_stat_statements` / `pg_stat_statements_info` — exposes every query's normalized text/stats to `anon`/`authenticated`; Supabase's own documented remediation is to revoke.
- `public.spatial_ref_sys` — RLS disabled with full `SELECT`/`INSERT`/`UPDATE`/`DELETE` granted to `anon` (not just read, unlike the extension-owned catalog views left alone below).
- `projects` schema — 3 tables (`TRP Projects- Commercial, Economic and Industrial`, `...- Energy, digital and infrastructure`, `...- Residential and Strategic Land`) with RLS disabled and full CRUD granted to `anon`/`authenticated`. Not currently reachable via PostgREST (the `projects` *schema* itself has no `USAGE` grant to either role — confirmed with `has_schema_privilege`), so this is a defense-in-depth fix, not a live-exploitable one today.
- `public.analyze_renewables` / `public.generate_chunk_search` — the two functions named in this request: `EXECUTE` revoked from `PUBLIC`, re-granted to `authenticated` (+ `service_role`/`postgres` explicitly, so the external RAG pipeline calling `generate_chunk_search` via `service_role` — confirmed via `pg_stat_statements`, see Appendix C — isn't put at risk by this).

**Flagged, not fixed** (deliberately left for you to decide — see Appendix E for the full list and reasoning):
- `public.classify_contract` — **the most serious single item in this sweep**. It's `SECURITY DEFINER`, has no internal auth check, directly `UPDATE`s `scraper.contracts_finder`, and `EXECUTE` is granted to `anon` — and unlike the `projects` schema tables above, `public` schema USAGE is definitely granted to `anon`. This one looks live and reachable.
- The ~27 other `public.analyze_*`/`*_search`/`*_chunk*` functions sharing the exact same shape as the two fixed above (not `SECURITY DEFINER`, but compute-heavy and `EXECUTE`-able by `anon`).
- Every `ingestion_insert_*`/`ingestion_upsert_*`/`meeting_insert_*`/`meeting_update_action_status` `SECURITY DEFINER` function from migration 151 — all still have `EXECUTE` granted to `anon` (only `search_path` was pinned, not the grant).
- `admin_console.refresh_surveyor_ratings`/`refresh_all_surveyor_ratings` — callable by `anon` (schema has `USAGE`), but confirmed the `UPDATE` inside would currently fail for `anon`/`authenticated` anyway (no `UPDATE` grant on `admin_console.surveyor_organisations`), so lower urgency than it first looks.

### 10. `public.classify_contract` — Finding 9's flagged item, now fixed

Investigated and fixed. `EXECUTE` was granted to `anon`/`authenticated` on a `SECURITY DEFINER` function with no internal auth check that directly `UPDATE`s `scraper.contracts_finder`. Confirmed via `pg_stat_statements` that its 277 real calls are 100% `service_role`, and via repo grep that nothing in `frontend/src`/`backend/src` calls it at all — it's driven entirely by an external pipeline. Fix (locks to `service_role` only, no `authenticated` grant added since there's no legitimate authenticated caller): `backend/sql/migrations/157_security_hardening_classify_contract_execute_grant.sql`. Full investigation: [Appendix F](#appendix-f-classify_contract-investigation-and-fix--flagged-tail-status-check).

**Status check on the rest of Finding 9's flagged-but-not-fixed tail** (requested alongside this fix, to make sure nothing else at `classify_contract`'s severity was still sitting unaddressed): checked real `pg_stat_statements` traffic for all of it. One category turned out to be genuinely the same shape and severity as `classify_contract` and is *not* fixed yet — see Appendix F for which, and why it was left for a decision rather than folded into this migration.

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

## Appendix C: 153 risk check resolved — chat view traffic is `service_role`-only

Migration 153's in-file comment flagged an open risk: the `chat_*` views are read by something outside this repo (a separate Next.js app / chat API, per the views' own DDL comments — `-- Public view so the Next.js app can query scraper data without exposing the schema in PostgREST`, `-- Public view for chat API and viewer UI`), and if that consumer used the `anon`/`authenticated` key rather than `service_role`, applying `security_invoker = true` would silently break it (empty results, no error).

Checked via `pg_stat_statements`, filtered to all 19 view names plus the other Finding 1 views:

- Every recorded call — hundreds across `chat_project_info`, `chat_quotes`, `chat_stage_updates`, `ingestion_issues`, `contracts_finder_review`, `v_final_discipline_risk`, etc. — executed as `service_role` or `postgres`.
- Zero calls as `anon` or `authenticated`.

Since `service_role` bypasses RLS regardless of a view's `security_invoker` setting, that external consumer is unaffected by this migration. **153 is confirmed safe to apply.**

Caveat: `pg_stat_statements` only reflects activity since the last stats reset, so this is strong corroborating evidence (backed by the views' own documented intent) rather than an absolute lifetime guarantee.

## Appendix D: `rag`/`admin_console` schema gaps from the Supabase dashboard advisor

Prompted by a diff between the Supabase dashboard's Security Advisor and this report: the dashboard checks all schemas, this report's original pass only checked `public`. Five items confirmed here; fix in `backend/sql/migrations/155_security_hardening_rag_admin_console_schemas.sql`.

**1–2. `rag.appeal_summaries` / `rag.document_sections` — RLS disabled**

```json
{"relrowsecurity": false}   // both tables
{"anon_select": true, "anon_insert": false}   // both tables (SELECT-only grant to anon, no INSERT grant)
```

Repo check: zero references in `frontend/src` or `backend/src`. Both are written exclusively via the SECURITY DEFINER RPCs `ingestion_insert_appeal_summary` / `ingestion_insert_document_section` (search_path already pinned in migration 151), which bypass RLS via the function owner — so this is a pure read-exposure fix, no write-path risk. Both back the already-hardened `chat_document_sections` view (153). Fix: enable RLS, add `auth.uid() IS NOT NULL` SELECT policy (no INSERT policy needed — the grant already excludes it).

**3. `admin_console.projects_with_stats` — Security Definer View**

Same pattern as Finding 1: owned by `postgres`, no `security_invoker`, granted SELECT to `anon`/`authenticated` (confirmed via `has_table_privilege`).

Repo check: used by `backend/src/services/quotes.service.js` (`getProjectsWithStats()`), but via the raw `pool` connection (`backend/src/db.js`, `DATABASE_URL` — the Postgres owner role) rather than PostgREST, so this in-repo usage is unaffected by `security_invoker`. It's also the base table of `chat_project_info`, already hardened in 153, and that view doesn't select any of the columns discussed below.

Worth knowing (not blocking): its own `FROM` table is `projects`, which already has a real `auth.uid() IS NOT NULL` policy, so `anon` querying this view directly after the fix gets zero rows (correct). But two of its `LEFT JOIN`s — `admin_console.client_organisations` and `admin_console.quotes` — have RLS enabled with zero policies (the same gap as Finding 1's views), so an `authenticated` caller hitting this view directly via PostgREST will get real project rows with `client_name`/`instructed_spend`/`completed_count`/`outstanding_count` NULLed out post-fix. No data leak, just degraded output for any external consumer relying on those columns via the anon/authenticated key rather than service_role.

**4–5. `public.analyze_renewables` / `public.generate_chunk_search` — Function Search Path Mutable**

```json
{"security_definer": false, "proconfig": null}   // both functions
```

Neither is `SECURITY DEFINER` (`prosecdef = false`), so unlike Finding 4 this is not a privilege-escalation vector — both run with the caller's own privileges. Still the standard advisor fix to pin `search_path`.

- `analyze_renewables(text)`: used via `backend/src/controllers/analysis.controller.js` → `pool` (raw pg, owner role) and `backend/src/routes/analysis.routes.js`. Not called via Supabase RPC from the frontend.
- `generate_chunk_search(vector, text, integer)`: zero references in `frontend/src`/`backend/src`. `pg_stat_statements` shows all 73 observed calls executed as `service_role` via RPC — this is the generation/RAG feature's vector search over `rag.chunks`, called from outside this repo (DDL comment: `-- generate_chunk_search in public schema (server calls rpc without schema prefix)`).

Both have `EXECUTE` granted to `anon`/`authenticated` directly (Supabase's default for new functions) — worth knowing either is callable by anyone holding the anon key, but that's a separate rate-limiting/compute-cost concern from search_path and out of scope for this migration.

Fix for both: `ALTER FUNCTION ... SET search_path = public, pg_temp;` — same treatment as Finding 4, just filed separately since these aren't SECURITY DEFINER.

## Appendix E: Exhaustive cross-schema sweep (no schema-name filter)

**Every schema in the database**, queried directly rather than assumed:

| Schema | Owner | Tables | Views | Functions | Nature |
|---|---|---|---|---|---|
| `Socioeconomics` | postgres | 51 | 0 | 0 | App data — not covered by this sweep's table check beyond the generic query (see caveat below) |
| `admin_console` | postgres | 45 | 1 | 6 | App data — partially covered in 155, more below |
| `analysis` | postgres | 0 | 1 | 3 | App logic (schema lacks `anon`/`authenticated` USAGE — inert) |
| `appeals` | postgres | 5 | 0 | 0 | App data |
| `auth` | supabase_admin | 23 | 0 | 4 | Supabase-managed — expected shape, not touched |
| `conflict` | postgres | 2 | 0 | 0 | App data |
| `extensions` | postgres | 0 | 2 | 55 | Extension-managed — one real finding here (pg_stat_statements) |
| `graphql` / `graphql_public` | supabase_admin | 0 | 0 | 0 / 1 | Supabase-managed |
| `issue_tracker` | postgres | 6 | 0 | 0 | App data |
| `marketing` | postgres | 2 | 0 | 0 | App data |
| `planning_applications` | postgres | 39 | 0 | 0 | App data |
| `planning_deliverables` | postgres | 2 | 0 | 0 | App data |
| `projects` | postgres | 4 | 1 | 0 | App data — real finding, see below |
| `public` | postgres | 73 | 28 | 1465 (mostly PostGIS) | Covered extensively already; a few new items below |
| `rag` | postgres | 27 | 0 | 1 | Covered in 155 |
| `realtime` | supabase_admin | 3 | 0 | 15 | Supabase-managed |
| `scraper` | postgres | 13 | 0 | 2 | Schema lacks `anon`/`authenticated` USAGE — inert (same pattern as `projects`) |
| `storage` | supabase_admin | 8 | 0 | 17 | Supabase-managed |
| `topology` | supabase_admin | 2 | 0 | 104 | PostGIS extension-managed |
| `trpprojects` | postgres | 0 | 0 | 0 | Empty |
| `vault` | supabase_admin | 1 | 1 | 5 | Supabase-managed; `decrypted_secrets` view confirmed **not** granted to `anon`/`authenticated` |

**Caveat on completeness**: `Socioeconomics` (51 tables), `appeals`, `conflict`, `issue_tracker`, `marketing`, and `planning_applications` (39 tables) all came back **clean** on the RLS-disabled-with-a-grant query (category 1) — none of their tables appear in the results below, meaning every table in those six schemas either has RLS enabled or has no `anon`/`authenticated` grant. They weren't given the same table-by-table narrative treatment as `public`/`rag`/`admin_console` in earlier findings simply because there was nothing to report — the query covered them, it just found nothing.

### Category 1: RLS disabled + any `anon`/`authenticated` grant, all schemas

Full result set (via `has_table_privilege`, not `information_schema.role_table_grants` — the latter proved unreliable earlier in this audit, returning empty for grants that `has_table_privilege` confirmed exist):

| Schema.table | anon | authenticated | Verdict |
|---|---|---|---|
| `projects."TRP Projects- Commercial, Economic and Industrial"` | SELECT/INSERT/UPDATE/DELETE | SELECT/INSERT/UPDATE/DELETE | **Fixed in 156** (schema lacks USAGE, so not live-exploitable today, but locked down for defense-in-depth) |
| `projects."TRP Projects- Energy, digital and infrastructure"` | SELECT/INSERT/UPDATE/DELETE | SELECT/INSERT/UPDATE/DELETE | **Fixed in 156** (same) |
| `projects."TRP Projects- Residential and Strategic Land"` | SELECT/INSERT/UPDATE/DELETE | SELECT/INSERT/UPDATE/DELETE | **Fixed in 156** (same) |
| `public.spatial_ref_sys` | SELECT/INSERT/UPDATE/DELETE | SELECT/INSERT/UPDATE/DELETE | **Fixed in 156** — `public` schema USAGE is granted, so this one is live |
| `realtime.subscription` | SELECT only | SELECT only | Not fixed — Supabase's own internal Realtime bookkeeping table, expected shape, not app data |
| `topology.layer` | SELECT only | SELECT only | Not fixed — PostGIS topology extension internals, expected shape |
| `topology.topology` | SELECT only | SELECT only | Not fixed — same |

Nothing else in any schema (including the six "clean" app schemas above) had both RLS disabled and a real `anon`/`authenticated` grant.

### Category 2: Security Definer View pattern, all schemas

| Schema.view | Owner | `security_invoker` | Granted to anon/auth? | Verdict |
|---|---|---|---|---|
| `admin_console.projects_with_stats` | postgres | `true` | yes | Already fixed (155) |
| `public.chat_*` (12), `contracts_finder_review`, `ingestion_*` (5), `v_final_discipline_risk` | postgres | `true` | yes | Already fixed (153) |
| `analysis.aonb_features_v` | postgres | unset | **no** — not granted to anon/authenticated | Not exploitable, no action |
| `projects."REPD Filtered"` | postgres | unset | **no** | Not exploitable, no action |
| `vault.decrypted_secrets` | supabase_admin | unset | **no** — confirmed not granted | Correctly locked down already, no action |
| `public.geography_columns`, `geometry_columns`, `raster_columns`, `raster_overviews` | supabase_admin | unset | yes (SELECT) | Not fixed — standard PostGIS extension catalog views (list which tables have geometry/raster columns, not data), expected default grant, low sensitivity |
| `extensions.pg_stat_statements`, `pg_stat_statements_info` | postgres | unset | yes (SELECT) | **Fixed in 156** — new finding, see Finding 9 above |

### Category 3: SECURITY DEFINER functions with mutable search_path, all schemas

**Clean.** The only functions matching this query anywhere in the database are the 3 PostGIS `st_estimatedextent` overloads in `public` — already identified and deliberately excluded in migration 151 (extension-owned). Nothing new in any other schema.

### Category 4: Functions with EXECUTE granted directly to anon/authenticated, all schemas

Extension-owned functions (PostGIS, etc.) excluded via `pg_depend` — without that exclusion this returns effectively all of PostGIS, which grants `EXECUTE` to `PUBLIC` by default same as core Postgres. Supabase-internal schemas (`auth`, `extensions` helper functions, `graphql_public`, `realtime`, `storage`) also came back in the raw results — all expected-by-design (e.g. `auth.uid()`/`auth.jwt()`/`auth.role()` are *meant* to be callable by anon/authenticated, since RLS policies across the whole schema call them inline for every single query) and not flagged.

**App-defined functions with anon/authenticated EXECUTE, by severity:**

**Fixed in 156:**
- `public.analyze_renewables(text)`, `public.generate_chunk_search(vector, text, integer)` — as requested.

**Highest-priority flag, not fixed — your call:**
- `public.classify_contract(...)` — `SECURITY DEFINER`, no internal auth check, `UPDATE`s `scraper.contracts_finder` directly, `public` schema definitely has anon USAGE. Definition:
  ```sql
  CREATE OR REPLACE FUNCTION public.classify_contract(p_id integer, p_relevant boolean, p_reason text, p_confidence text, p_reviewed_at timestamptz)
   RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
  AS $function$
    UPDATE scraper.contracts_finder SET relevant = p_relevant, relevance_reason = p_reason, confidence = p_confidence, reviewed_at = p_reviewed_at WHERE id = p_id;
  $function$
  ```
  Ready-to-use fix, not applied:
  ```sql
  REVOKE EXECUTE ON FUNCTION public.classify_contract(integer, boolean, text, text, timestamptz) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.classify_contract(integer, boolean, text, text, timestamptz) TO authenticated, service_role, postgres;
  ```

**Same shape as the two already fixed, not fixed — candidates for a follow-up migration:**
- All ~27 other `public.analyze_*` functions (`analyze_ag_land`, `analyze_ancient_woodland`, `analyze_aonb`, `analyze_conservation_areas`, `analyze_drinking_water`, `analyze_flood_zones`, `analyze_gcn`, `analyze_green_belt`, `analyze_listed_buildings`, `analyze_national_nature_reserves`, `analyze_national_parks`, `analyze_os_priority_ponds`, `analyze_ramsar`, `analyze_registered_parks_gardens`, `analyze_sac`, `analyze_scheduled_monuments`, `analyze_site_*` (8 variants), `analyze_spa`, `analyze_sssi`, `analyze_uk_airports`, `analyze_world_heritage_sites`) plus the search-family (`chunk_search`, `chunk_search_v3` (5 overloads), `keyword_search_v1`, `match_summary_chunks`, `meeting_keyword_search_v1`, `search_chunks`, `search_projects_by_lpa`, `tag_search_v1`) and some clearly-dead test functions (`search_test_table`, `test_chunks`, `test_vec_search`, `test_vec_search2`) — not `SECURITY DEFINER`, so lower severity than `classify_contract`, but same "expensive, anon-callable, no reason to be" shape as the two just fixed.
- Every `SECURITY DEFINER` write RPC from migration 151 (`ingestion_insert_*`, `ingestion_upsert_*`, `meeting_insert_*`, `meeting_update_action_status`) — 151 only pinned `search_path`, the `EXECUTE`-to-`anon` grant was out of that migration's scope. `pg_stat_statements` (Appendix C) shows these are only ever actually called by `service_role`, so revoking `anon`/`authenticated` and keeping `service_role` would match real usage — but that's a broader, more consequential change (an entire ingestion pipeline's write path) than this request asked for, so left as a flag rather than applied.
- `is_admin()`, `get_user_role()`, `get_disciplines()` — **deliberately excluded from any revoke recommendation.** These are called inline by RLS policies across the whole schema (`manage_*`, `Admins can manage...`, etc.); revoking `EXECUTE` from `anon`/`authenticated` would break every policy that references them for every query either role makes, not just admin actions.

**Lower priority, checked and largely inert:**
- `admin_console.refresh_surveyor_ratings(uuid)` / `refresh_all_surveyor_ratings()` — not `SECURITY DEFINER`, `admin_console` schema has real `anon`/`authenticated` USAGE, so these are callable — but confirmed the `UPDATE admin_console.surveyor_organisations` inside would fail for both roles today (no `UPDATE` grant on that table), so calling it currently just wastes a query rather than corrupting rating data. `admin_console.surveyor_organisations` itself has RLS disabled, which is a separate, already-known gap (see Finding 8's closing note on additional `admin_console` tables not yet covered).
- `analysis.analyze_aonb`, `analysis.proximity_summary`, `analysis.to_compass_dir` — `EXECUTE` granted, but the `analysis` schema itself has no `anon`/`authenticated` USAGE (confirmed), so these are inert the same way the `projects`-schema tables are.
- All `storage.*`, `realtime.*`, `auth.*`, `extensions.*` helper functions — Supabase-managed, expected to be callable by anon/authenticated by design (session/auth mechanics, storage API internals), not flagged.

## Appendix F: `classify_contract` investigation and fix + flagged-tail status check

### `classify_contract` investigation

**1. `pg_stat_statements` — actual observed callers:**

```
service_role | 277 calls | RPC (json_to_record payload shape — PostgREST's RPC convention)
postgres     |   1 call  | GRANT EXECUTE ON FUNCTION public.classify_contract TO anon, authenticated
postgres     |   1 call  | ALTER FUNCTION ... SET search_path ... (migration 151)
```

277 real invocations, **100% `service_role`, 0% `anon`/`authenticated`**. The DDL history also captured the exact moment the offending grant was made (`GRANT EXECUTE ON FUNCTION public.classify_contract TO anon, authenticated`) — someone granted it broadly at some point, but nothing has ever actually called it that way.

**2. Repo check:** `grep -r "classify_contract"` across `frontend/src` and `backend/src` returns **zero matches** (the only repo hits are this report, and this migration's own comment). It isn't called by this app in any form — not via the browser anon client, not via a backend route, not via the raw `pg.Pool`. The 277 `service_role` calls are driven entirely by something outside this repo — almost certainly the same pipeline that populates `scraper.contracts_finder` in the first place (naming and the columns it writes — `relevant`, `relevance_reason`, `confidence`, `reviewed_at` — read exactly like an LLM classification result being persisted after scraping).

**3. Fix applied** (`backend/sql/migrations/157_security_hardening_classify_contract_execute_grant.sql`):

```sql
REVOKE EXECUTE ON FUNCTION public.classify_contract(integer, boolean, text, text, timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.classify_contract(integer, boolean, text, text, timestamp with time zone) TO service_role, postgres;
```

No `authenticated` grant added (unlike `analyze_renewables`/`generate_chunk_search` in 156) — there's no legitimate authenticated-user call path here, only the external `service_role` pipeline.

**`SECURITY DEFINER` / internal auth check — considered, not changed:** the function needs `SECURITY DEFINER` because its only legitimate caller reaches into `scraper.contracts_finder`, and the `scraper` schema has no `USAGE` grant for `anon`/`authenticated` at all (confirmed earlier in this audit) — a `SECURITY INVOKER` version would be unusable by anyone but the table owner regardless. Once `EXECUTE` is restricted to `service_role` — a role that already bypasses RLS and grants — neither downgrading to `SECURITY INVOKER` nor adding an internal `auth.uid() IS NOT NULL` check adds anything, since the function is no longer reachable by any caller such a check would need to stop.

### Status check: is there another `classify_contract` hiding in Finding 9's flagged tail?

Checked real `pg_stat_statements` traffic (not just grants) for every item on that list. **Short answer: yes, one category is exactly the same shape and severity — not fixed yet, flagged clearly below for a decision. The rest is confirmed lower urgency, with hard evidence, not just inference.**

**🔴 Same severity as `classify_contract` was — not fixed, recommend a follow-up migration:**

The `SECURITY DEFINER` ingestion/meeting write RPCs from migration 151 (`ingestion_insert_appeal*`, `ingestion_insert_chunk`, `ingestion_insert_document_section`, `ingestion_upsert_*`, `meeting_insert_action`, `meeting_insert_chunk`, `meeting_insert_note`, `meeting_insert_transcript`, `meeting_update_action_status`). Real traffic:

```
service_role | ~1,139 calls total across these functions | RPC
postgres     | DDL history only (CREATE/ALTER/GRANT/DROP) | 0 real invocations as postgres
```

**100% of real traffic is `service_role`, exactly like `classify_contract`.** One DDL comment even documents the original intent explicitly: `-- Ingestion RPCs: service_role only (called from ingestion server)`, and some of these functions (e.g. `ingestion_insert_appeal`, `ingestion_insert_appeal_main_issue`, `ingestion_upsert_issue`) do have an explicit `GRANT EXECUTE ... TO service_role` in their history. But **`GRANT` in Postgres is additive, not exclusive** — granting to `service_role` doesn't revoke the default `EXECUTE`-to-`PUBLIC` grant every function gets at creation unless a `REVOKE FROM PUBLIC` is also run, and none was. So despite the documented "service_role only" intent, every one of these functions currently still shows `anon`/`authenticated` `EXECUTE = true` (confirmed in Finding 9's Appendix E category-4 query) — the exact same live, reachable, `SECURITY DEFINER`-write shape as `classify_contract`. This wasn't folded into 157 because it's a larger, more consequential change (revoking write access across an entire ingestion pipeline's RPC surface, ~13 functions) than this request scoped — but it's the same class of issue, not a lesser one.

**🟡 Confirmed lower urgency — real traffic backs this up, not just theory:**

- **The ~27 `analyze_*`/`*_search*` functions** (not `SECURITY DEFINER`). Checked real traffic for the highest-volume ones: `analyze_site_heritage` (916 calls), `analyze_site_landscape` (797), `analyze_site_ag_land` (764), `analyze_site_renewables` (723), `analyze_site_ecology` (661), `analyze_site_trees` (221), `analyze_site_airfields` (153), `analyze_green_belt` (34), `analysis.analyze_aonb` (24), and others — **100% of all of it is role `postgres`** (the backend's raw `pg.Pool` connection, same as confirmed for `analyze_renewables` before it was fixed in 156). Zero `anon`, zero `authenticated`, zero `service_role` calls across the entire family. `EXECUTE` is still open to `anon` (worth closing eventually, same pattern as 156), but there's no privilege-escalation angle here (not `SECURITY DEFINER`) and no evidence of any exploitation — worst case if `anon` did call one today is unwanted compute cost, not a data or integrity issue, since the underlying geodata tables these functions read now have their own `auth.uid() IS NOT NULL` policies (migration 154).
- **`admin_console.refresh_surveyor_ratings`/`refresh_all_surveyor_ratings`** — only 7 real calls total, **100% role `postgres`** (i.e. run manually via the SQL editor / a direct session, not via any automated pipeline or the app). Combined with the earlier finding that the `UPDATE` inside would fail for `anon`/`authenticated` today anyway (no `UPDATE` grant on `admin_console.surveyor_organisations`), this is confirmed genuinely low-priority — callable in theory, never called that way in practice, and would fail if it were.

**Bottom line for "is the audit done":** not quite — the ingestion/meeting `SECURITY DEFINER` RPC family is a real, live, `classify_contract`-equivalent gap, just wider in blast radius (13 functions instead of 1), which is exactly why it wasn't rolled into this fix without checking with you first. Recommend treating that as the next concrete step. Everything else flagged in Finding 9 is now backed by hard traffic evidence showing genuinely lower urgency, not just a lower a-priori guess.
