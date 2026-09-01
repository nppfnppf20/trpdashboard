# User Profiles & Task Assignment — Scoping Notes

Status as of 2026-08-29: not started. This is a findings/complexity writeup from a
scoping conversation, for whoever picks this up later — not an approved plan, and
no code has been written against it.

## The idea

A profile page per logged-in user: things (tasks/actions) could be assigned to
them, and they could see all the projects they're involved in from one place.

## Why this is bigger than it looks

"Assign to a user" and "see your projects" both need a *real* relationship
between a task/project and an account. Today there is none — every field that
looks like an assignment is actually free text. This isn't an extension of an
existing pattern (unlike, say, the project-chat date-suggestion feature, which
reused an existing update path end to end) — it's new foundational identity
infrastructure for the app.

## What exists today (verified by reading the migrations/code directly)

**Identity**
- Supabase Auth holds email/password. The app's own Postgres only has
  `public.user_roles` (`backend/sql/migrations/007_create_user_roles.sql`):
  `id`, `user_id → auth.users(id)`, `role` (`admin`/`surveyor`/`client`/`viewer`),
  timestamps. No name, no avatar, nothing else.
- Supabase's `auth.users` (which does hold name/email) is **never SQL-joined**
  anywhere in the backend. The one place that touches it —
  `backend/src/controllers/emailDigest.controller.js:47-62` — does it via a
  separate `supabaseAdmin.auth.admin.listUsers()` call in JS and filters in
  memory, not a database join.

**Every "who's responsible" field is free text — none are foreign keys**
- `public.projects.project_lead` / `project_manager` / `project_director` —
  plain `VARCHAR(255)` (`backend/sql/migrations/001_create_projects_table.sql:12-14`).
- `planning_applications.tracker_actions.owner` — plain `TEXT`
  (`backend/sql/migrations/092_action_tracker.sql:7`).
- `planning_applications.meeting_actions.owner` — plain `TEXT`
  (`backend/sql/migrations/057_meeting_notes.sql:36`).
- A full grep of every migration for `owner`/`assigned_to`/`assignee` turns up
  only those two `TEXT` columns. Nothing anywhere is UUID/FK-typed.

**No project-membership table.** No `project_members`/`project_team`/
`project_users` table exists. "Who's on this project" only exists as the three
free-text strings above.

**No internal user-management page exists.** `/admin-console/surveyors`
manages external contractor *organisations*, not app accounts — there is no
page anywhere listing the people who actually log into this app, and no
self-service profile/settings page for the logged-in user.

**Some of the existing "owner" entry points aren't even proper form fields.**
The meeting-notes actions owner in `PlanningWorkspace.svelte` is a raw `<td>`
inside a contenteditable table, parsed back out via `querySelector('td[data-col="owner"]')`
(around lines 321, 339, 342, saved at line 413) — not a bound Svelte input.
`tracker_actions` has no CRUD UI at all today; only the AI chat service
(`projectChat.service.js`) reads/writes it.

## Recommended phasing, if this gets picked up

1. **A real profile table** — something like `public.user_profiles`
   (`user_id → auth.users`, `display_name`, maybe `avatar_url`), kept in sync
   on signup (a Supabase trigger, or an app-side upsert on first login). This
   is the foundational piece: without it, nothing in Postgres can cheaply
   resolve "who is this" without round-tripping to the Supabase Admin API.

2. **Additive FK columns, not a migration of the existing text fields.** Add
   nullable `*_user_id` columns alongside the existing text ones
   (`projects.project_lead_user_id`, `tracker_actions.assigned_user_id`, etc.)
   rather than converting the text columns outright. Reason: not everyone
   named in those fields is necessarily an app user — a `project_director` is
   often a client contact with no login. A backfill/match against existing
   free text would be fuzzy and would silently drop anyone not in the system.
   Free text stays as the fallback for non-users; the FK is "if this happens
   to be a real account, link it."

3. **The profile page** — the user's `user_profiles` row/role, a "my
   projects" list (querying the new FK columns across `projects`), and a "my
   tasks" list. The last one is a genuinely new query shape: everything else
   in this app is scoped to one project at a time, and "all my assigned
   actions across every project" doesn't exist as a query pattern yet.

4. **Rework at least two existing UI surfaces** into real user-pickers:
   the lead/manager/director fields in `EditProjectModal.svelte`, and — the
   messiest one — the contenteditable owner cell in `PlanningWorkspace.svelte`,
   which needs to become an actual bound form control before it can sanely
   hold a user reference.

5. **Role/visibility rules** for who can see whose profile / whose "my
   projects" list — the cheap part, since `isAdmin`/`isSurveyor`/`isClient`
   role-gating (`frontend/src/lib/stores/auth.js`) already exists as a
   pattern elsewhere in the app.

## Suggested starting point

Just phase 1 (the profile table + signup sync) in isolation — it's useful on
its own, proves the sync mechanism, and nothing else has to be built or
decided before it can land.
