# Notification Centre — Data Sources

**Date:** 10 March 2026

This document describes every data source drawn into the Workflow Notification Centre feed, where the data lives in the database, and how it is surfaced in the UI.

---

## Overview

The feed is built by `getWorkflowNotifications()` in `backend/src/services/workflow.service.js`. It assembles up to **seven distinct source types** into a single normalised list, sorted by `event_date` descending. Each source type maps to a distinct icon and colour in the `WorkflowNotificationFeed` component.

The frontend calls `GET /api/admin-console/workflow/notifications` with optional query params:

| Param | Effect |
|---|---|
| `scope` | `team` (all projects) or `mine` (projects where you are lead / manager / director) |
| `userName` | Required when scope = `mine` — matched against `project_lead`, `project_manager`, `project_director` (case-insensitive) |
| `projectId` | Filter to a single project |
| `sourceType` | Filter to one source type (see below) |
| `dateFrom` / `dateTo` | Date range filter (applied per source type where relevant) |

---

## Source Types

### 1. `stage_completed` — Completed Stages

| Field | Value |
|---|---|
| **DB tables** | `admin_console.project_stage_instances`, `admin_console.project_stage_definitions`, `public.projects` |
| **Condition** | `psi.is_complete = TRUE` |
| **Event date** | `psi.completed_at` |
| **Limit** | 100 rows, ordered by `completed_at DESC` |
| **Date filter** | Applied to `completed_at` |

Surfaces every stage that has been marked complete across all projects (or your projects in `mine` scope). Shows the stage name, project name, and who completed it.

---

### 2. `stage_upcoming` — Upcoming Stage Deadlines

| Field | Value |
|---|---|
| **DB tables** | `admin_console.project_stage_instances`, `admin_console.project_stage_definitions`, `public.projects` |
| **Condition** | `is_complete = FALSE`, `is_applicable = TRUE`, `target_date >= CURRENT_DATE`, `target_date IS NOT NULL` |
| **Event date** | `psi.target_date` |
| **Limit** | 100 rows, ordered by `target_date ASC` |
| **Date filter** | Applied to `target_date` (dateTo only) |

Shows stages that have a target date set and have not yet been completed. Ordered nearest-first so imminent deadlines surface at the top.

---

### 3. `stage_overdue` — Overdue Stages

| Field | Value |
|---|---|
| **DB tables** | `admin_console.project_stage_instances`, `admin_console.project_stage_definitions`, `public.projects` |
| **Condition** | `is_complete = FALSE`, `is_applicable = TRUE`, `target_date < CURRENT_DATE` |
| **Event date** | `psi.target_date` |
| **Limit** | 100 rows, ordered by `target_date ASC` |
| **Date filter** | None (shows all overdue regardless of date range) |

Stages where the target date has passed and the stage is still incomplete. Most overdue surfaces first.

---

### 4. `key_issue` — Key Issue Tracks

| Field | Value |
|---|---|
| **DB tables** | `admin_console.project_issue_tracks`, `public.projects` |
| **Condition** | `is_key_issue = TRUE`, `is_active = TRUE` |
| **Event date** | `pit.updated_at` (last time the track was modified) |
| **Limit** | 100 rows, ordered by `updated_at DESC` |
| **Date filter** | Applied to `updated_at` |

Every issue track that has been flagged as a Key Issue on any project's stage board. The event date reflects when it was last updated (e.g. when it was flagged).

---

### 5. `scraper_renewables` — Renewables Planning Applications

| Field | Value |
|---|---|
| **DB table** | `scraper.planit_renewables` |
| **Condition** | `start_date >= [dateFrom or last 7 days]` OR `decided_date >= [dateFrom or last 7 days]` |
| **Event date** | `decided_date` if set, otherwise `start_date` |
| **Limit** | 50 rows, ordered by most recent activity |
| **Date filter** | Applied as the `dateFrom` window (defaults to last 7 days if no filter set) |

Live scraper data for renewable energy planning applications. Columns surfaced: `name`, `area_name`, `app_state`, `decision`, `start_date`, `decided_date`.

---

### 6. `scraper_datacentres` — Data Centre Planning Applications

| Field | Value |
|---|---|
| **DB table** | `scraper.planit_datacentres` |
| **Condition** | `start_date >= [dateFrom or last 7 days]` OR `decided_date >= [dateFrom or last 7 days]` |
| **Event date** | `decided_date` if set, otherwise `start_date` |
| **Limit** | 50 rows, ordered by most recent activity |
| **Date filter** | Applied as the `dateFrom` window (defaults to last 7 days if no filter set) |

Same structure as renewables, but from the data centres scraper table.

---

### 7. `scraper_contracts` — Contracts Finder Opportunities

| Field | Value |
|---|---|
| **DB table** | `scraper.contracts_finder` |
| **Condition** | `published_date >= [dateFrom or last 7 days]` |
| **Event date** | `published_date` |
| **Limit** | 50 rows, ordered by `published_date DESC` |
| **Date filter** | Applied to `published_date` |

Public contract opportunities from the Contracts Finder scraper. Columns surfaced: `title`, `organisation`, `published_date`, `closing_date`, `status`.

---

## Default Date Window for Scrapers

If no `dateFrom` filter is provided, scraper sources (renewables, datacentres, contracts) default to **the last 7 days** from the time of the request. Stage-based sources (completed, upcoming, overdue, key issues) have no default date window and return all matching records up to their row limit.

---

## Relevant Files

| File | Role |
|---|---|
| `backend/src/services/workflow.service.js` | `getWorkflowNotifications()` — all DB queries and assembly logic |
| `backend/src/controllers/workflow.controller.js` | `getWorkflowNotificationsHandler()` — parses query params, calls service |
| `backend/src/routes/workflow.routes.js` | `GET /notifications` route |
| `frontend/src/lib/services/workflowApi.js` | `getNotifications()` — frontend API call |
| `frontend/src/lib/components/workflow/WorkflowNotificationCentre.svelte` | Scope toggle, filter controls, load logic |
| `frontend/src/lib/components/workflow/WorkflowNotificationFilters.svelte` | Source type dropdown, date range pickers |
| `frontend/src/lib/components/workflow/WorkflowNotificationFeed.svelte` | Table rendering, source type icons and colours |
