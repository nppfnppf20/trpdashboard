# Project Workflow Route Implementation Plan

## Purpose

This document sets out a detailed implementation plan for a new admin-console route that combines:

1. A `Notification Centre`
2. A `Project Stages` board

This is a separate system from the existing surveyor-management programme view. It is intended to operate at the whole-project level.

The goal is to provide:

- A central operational hub for upcoming events and recent activity
- A structured stage-tracking system for projects
- A way to carry forward and update HLPV discipline risks across project stages
- A persistent project-level `key issue` mechanism
- A foundation for future structured meeting note templates

## Scope Summary

### Route

Add a new route under admin console, for example:

- `/admin-console/workflow`

This route will contain two tabs:

- `Notification Centre`
- `Project Stages`

## Functional Requirements

### 1. Notification Centre

The notification centre is a unified operational feed.

It should show:

- Upcoming project events
- Recently completed or recently changed project-stage events
- Overdue stage actions
- Key issue activity
- Scraper activity from the last `N` days, initially defaulting to `7`

It should support at least these views:

- `Team feed`
- `My feed`

It should support filtering by:

- Project
- Person / user context
- Source type
- Date range
- Open vs completed state where applicable

### Team vs My Feed

Team membership is determined from the existing team-member columns in the main project table.

`My feed` should mean:

- Projects where the current user appears in one of the project team-member fields

`Team feed` should mean:

- The wider combined feed across relevant projects/activity

### Scraper Sources

The notification centre should include all scraper sources in the first version, filtered to recent activity only.

This means the feed should include all scraped items created or updated within the last week, with the date window later made configurable in the UI.

## 2. Project Stages Board

This is not a gantt chart.

It is a stage matrix for tracking how project issues evolve over time.

### Basic Structure

- Columns across the top = project stages
- Rows down the left = issue tracks
- Each cell = saved risk state and summary for that issue at that stage

### Stages

The stage list is global and ordered:

1. Kick-off Meeting
2. High-Level Planning View
3. Stage 1 Review
4. EIA
5. Pre-app
6. Surveyor Input
7. Submission
8. Discharge of Conditions
9. Appeal Submission

Stages should be global defaults, but nullable / optional per project via project-stage settings.

### Stage Completion Workflow

There should be a tickbox in each stage header.

When the user ticks a stage header:

- A modal opens
- The modal is the primary data entry point for that stage
- The modal allows the user to update multiple issue rows for that stage in one action
- Saving the modal marks that stage complete

This is intentionally not an inline per-cell editing workflow.

### Stage Modal Behavior

For the first version, the modal should support:

- Updating risk level for each issue row
- Updating a short summary for each issue row
- Updating notes for each issue row if useful
- Promoting or demoting a row as a `key issue`

The modal should not yet include structured meeting note templates, but the design should leave room for adding them later.

There should be no overall stage summary field in version 1.

### Applicability

Each stage should support project-level applicability:

- `is_applicable = true/false`

This is needed because not every project will pass through every stage.

### Issue Rows

Rows should not be limited to disciplines forever.

The board should support:

- Default HLPV-derived discipline rows
- Additional custom rows added later

### Seed Rows from HLPV

On first board initialization for a project:

- Seed rows from any HLPV disciplines present in the saved edited final report data
- Use placeholder summaries for now
- Order rows by highest risk first

Important:

- The exact HLPV discipline field names must be confirmed from the database before implementation
- Do not hardcode names until the schema review step is completed

### Key Issues

`Key issue` should be a project-level property of the row, not a stage-only property.

This means:

- A row can be marked as a key issue
- That status persists across the project
- It can later be demoted / unset

The per-stage modal should allow the user to promote or demote the row while editing stage updates.

### Ordering Behavior

Initial row ordering:

- Highest risk first

After initial creation:

- Keep row order stable
- Do not automatically re-sort the board on every stage update, or the grid will become visually unstable

Optional future enhancement:

- Manual drag reorder

## Design Principles

### 1. Separate from Surveyor Programme

This must not reuse the existing surveyor-management programme model directly.

The current surveyor programme feature is scoped to quotes / instructed surveyor work.

This new workflow system is scoped to the whole project.

### 2. Modal-Driven Stage Capture

The main unit of editing is stage completion, not individual cells.

That fits the real-world process better:

- A project reaches a stage
- A meeting / review occurs
- The user records how all issues changed at that stage

### 3. Database Contract Must Be Confirmed Before Migration

Before writing migrations or endpoint queries, the database must be reviewed with SQL to confirm:

- Existing project team-member column names
- Existing saved HLPV final report fields
- Any existing admin/workflow tables that may overlap
- Any naming constraints or conventions already in use

This is a required first step.

## Proposed Data Model

The following is the recommended data model, subject to confirmation during SQL schema review.

### 1. `admin_console.project_stage_definitions`

Global stage template.

Suggested columns:

- `id`
- `name`
- `display_order`
- `is_active`
- `created_at`
- `updated_at`

Purpose:

- Defines the fixed ordered stages shown across the top of the board

### 2. `admin_console.project_stage_instances`

Project-specific instance of each stage.

Suggested columns:

- `id`
- `project_id`
- `stage_definition_id`
- `is_applicable`
- `is_complete`
- `target_date`
- `completed_at`
- `completed_by`
- `created_at`
- `updated_at`

Suggested constraint:

- Unique `(project_id, stage_definition_id)`

Purpose:

- Tracks whether a stage is relevant and complete for a specific project

### 3. `admin_console.project_issue_tracks`

Project-level issue rows.

Suggested columns:

- `id`
- `project_id`
- `track_type` such as `discipline` or `custom`
- `source_key` nullable, to identify HLPV seed source
- `label`
- `sort_order`
- `is_key_issue`
- `is_active`
- `created_from_hlpv`
- `last_known_risk_level`
- `created_at`
- `updated_at`

Purpose:

- Defines the left-hand rows of the stage board
- Stores persistent row metadata such as `key issue`

### 4. `admin_console.project_issue_stage_entries`

Per-stage snapshot for each issue row.

Suggested columns:

- `id`
- `project_stage_instance_id`
- `issue_track_id`
- `risk_level`
- `summary`
- `notes`
- `updated_by`
- `updated_at`
- `created_at`

Suggested constraint:

- Unique `(project_stage_instance_id, issue_track_id)`

Purpose:

- Stores how each issue was recorded at a given stage

## Initialization Rules

When a project board is opened for the first time:

1. Create stage instances for all global stage definitions
2. Default `is_applicable = true`
3. Pull available saved HLPV final report discipline risks
4. Create one issue track per detected HLPV discipline
5. Seed the initial issue rows in descending risk order
6. Leave summaries blank or placeholder-backed until real edited summaries are available

### Carry-Forward Behavior

When completing a stage:

- Prefill values from the most recent prior completed stage if available
- If there is no prior completed stage, prefill from initial seeded HLPV values

This should reduce repetitive data entry and make the modal practical to use.

## Notification Feed Model

The notification centre should not directly expose raw source tables.

It should use a normalized backend feed shape.

Suggested normalized feed item shape:

- `source_type`
- `source_id`
- `project_id`
- `project_name`
- `title`
- `description`
- `event_date`
- `status`
- `severity`
- `assigned_scope`
- `created_at`
- `metadata`

### Initial Feed Sources

Recommended first-version sources:

- Completed project stages
- Upcoming stage target dates
- Overdue incomplete stages
- Key issue rows and key issue changes
- Recent scraper activity from all scraper sources in the last 7 days

Potential later additions:

- HLPV refresh reminders
- Project-level deadlines
- Submission deadlines
- Review reminders

## Backend Implementation Plan

### Step 1. Database Schema Review with SQL

This must happen before migrations are written.

Review:

- Main project table structure
- Team-member columns
- Saved HLPV final report fields
- Existing workflow-related admin tables
- Existing user linkage needed for `my feed`

Outputs of this step:

- Confirmed column names
- Confirmed source fields for HLPV discipline seed data
- Confirmed naming for routes/services/migrations

### Step 2. Add Workflow Tables

Create the new workflow tables:

- `project_stage_definitions`
- `project_stage_instances`
- `project_issue_tracks`
- `project_issue_stage_entries`

Seed `project_stage_definitions` with the 9 global stages in display order.

### Step 3. Add Backend Services

Create a dedicated service module for workflow logic.

Suggested responsibilities:

- initialize project board
- fetch project board data
- mark stage complete and save stage entries
- toggle stage applicability
- create custom issue track
- update issue track metadata
- build notification feed

Suggested file location:

- `backend/src/services/workflow.service.js`

### Step 4. Add Controllers

Suggested file location:

- `backend/src/controllers/workflow.controller.js`

Suggested controller actions:

- `getWorkflowNotifications`
- `getProjectStageBoard`
- `initializeProjectStageBoard`
- `completeProjectStage`
- `updateProjectStage`
- `toggleProjectStageApplicability`
- `createProjectIssueTrack`
- `updateProjectIssueTrack`

### Step 5. Add Routes

Suggested file location:

- `backend/src/routes/workflow.routes.js`

Suggested endpoints:

- `GET /api/admin-console/workflow/notifications`
- `GET /api/admin-console/workflow/projects/:projectId/stages`
- `POST /api/admin-console/workflow/projects/:projectId/stages/initialize`
- `PUT /api/admin-console/workflow/projects/:projectId/stages/:stageId/complete`
- `PUT /api/admin-console/workflow/projects/:projectId/stages/:stageId/applicability`
- `POST /api/admin-console/workflow/projects/:projectId/issues`
- `PUT /api/admin-console/workflow/issues/:issueId`

### Step 6. Notification Aggregation

Build backend notification aggregation that:

- normalizes stage activity
- normalizes key issue activity
- normalizes scraper activity
- supports `team` vs `mine`
- supports filter params

Likely query inputs:

- `scope=team|mine`
- `projectId`
- `sourceType`
- `dateFrom`
- `dateTo`

## Frontend Implementation Plan

### Step 1. Add Route Shell

Create a new route under:

- `frontend/src/routes/admin-console/workflow/+page.svelte`

Main route responsibilities:

- project selector
- tab management
- filter state
- data loading

### Step 2. Build Notification Centre Tab

Suggested components:

- `WorkflowNotificationCentre.svelte`
- `WorkflowNotificationFilters.svelte`
- `WorkflowNotificationFeed.svelte`

Responsibilities:

- team vs mine toggle
- filter controls
- render normalized feed items
- support future filter expansion without redesign

### Step 3. Build Project Stages Tab

Suggested components:

- `ProjectStagesBoard.svelte`
- `ProjectStagesHeaderRow.svelte`
- `ProjectStagesIssueRows.svelte`
- `ProjectStageCompletionModal.svelte`
- `ProjectStageAddIssueModal.svelte`

Responsibilities:

- render matrix board
- sticky stage headers
- sticky issue labels
- stage applicability controls
- stage completion trigger
- modal editing flow

### Step 4. Modal UX

The completion modal should:

- open from the stage header
- load all issue rows for that stage
- prefill values from the prior stage
- allow risk editing per row
- allow summary editing per row
- allow notes editing per row
- allow key issue promotion/demotion

The modal should save all rows in one transaction-like user action.

### Step 5. Custom Issue Rows

Allow users to add rows that are not HLPV disciplines.

Examples:

- planning strategy
- land control
- grid
- consultation risk

These should appear alongside seeded discipline rows.

## Data Loading Strategy

### Project Stages Board

When a project is selected:

1. Request stage board data
2. If no board exists, initialize it
3. Re-fetch the initialized board
4. Render the matrix

### Notification Centre

When the route or filters change:

1. Request normalized feed data
2. Apply current filter state
3. Render grouped or sorted feed results

## Risk Handling

Risk levels should align with the app’s existing risk-level conventions.

Before implementation, confirm the canonical risk values already used across the app, for example:

- `extremely_high_risk`
- `high_risk`
- `medium_high_risk`
- `medium_risk`
- `medium_low_risk`
- `low_risk`

The board should reuse the existing risk vocabulary rather than invent a parallel scheme.

## SQL Review Requirement Before Build

Before any migration or endpoint implementation is submitted, run SQL to review and confirm:

1. Main project table columns
2. Team-member columns
3. Saved HLPV final report discipline fields
4. Any current stored risk columns
5. Any existing admin/workflow-related tables that overlap

This review step is mandatory because field names must be taken from the real schema, not inferred.

## Recommended Build Order

1. Review database schema with SQL
2. Confirm saved HLPV final report discipline field names
3. Confirm project team-member columns for notification scoping
4. Write migrations for workflow tables
5. Seed global stage definitions
6. Build backend board initialization and fetch logic
7. Build backend stage completion save flow
8. Build frontend project stages tab and modal
9. Test seeded HLPV issue creation and stage persistence
10. Build notification feed backend aggregation
11. Build notification centre frontend
12. Add filtering and polish

## Out of Scope for Version 1

These should be explicitly deferred:

- Structured meeting note templates
- Manual drag-and-drop row ordering
- Inline per-cell editing outside the stage modal
- Advanced notification automation rules
- Full audit-history UI

## Key Decisions Already Made

- This is separate from the existing surveyor-management programme feature
- The route will have two tabs: notification centre and project stages
- Project stages are global defaults but project-applicability can vary
- Stage completion is triggered from the column header
- Completing a stage opens one modal to update all rows for that stage
- There is no overall stage summary in version 1
- Team membership comes from columns on the main project table
- Notification centre should include all scraper sources initially
- Default issue rows should seed from HLPV disciplines in the saved edited final report
- Seeded rows should be ordered by highest risk first
- HLPV summaries are not implemented yet, so placeholders are acceptable
- `Key issue` is persistent at the project-row level, but can be promoted or demoted later

## Next Step for the Next Chat

The next chat should start with the database review step.

Specifically:

- inspect the project table
- inspect the saved HLPV final report data structure
- inspect any existing admin console workflow/programme tables
- confirm exact field names before writing migrations or backend queries
