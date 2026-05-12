# Implementation Plan: Policy Template Library

## What this is

A library of pre-written national policy text, keyed by **discipline + development type**, that auto-populates the `policy_national` field on `planning_applications.issue_notes` when a new issue track is added to a project. This text is then fed into the planning assessment LLM generator so it doesn't have to be written from scratch for every project.

---

## Confirmed design decisions

- **Template key**: `discipline` (from `admin_console.project_issue_tracks.discipline`) + `development_type` (new field on `projects` table)
- **Fields templated**: `policy_national` only
- **Template management UI**: Admin console
- **Auto-apply trigger**: When a `project_issue_track` is created for a project that has `development_type` set

---

## Context: relevant existing code

Before starting, read these files to understand the existing patterns:

- `backend/src/routes/projects.routes.js` — project CRUD; add `development_type` PATCH here
- `backend/src/controllers/planningApplication.controller.js` — planning app controller; look at `getIssueNotes`, `upsertIssueNote`, and how assessment generation fetches issue data
- `backend/src/services/llm.service.js` — find `buildPlanningAppIssueContext` (around line 1297); this is what feeds `{{ISSUE_CONTEXT}}` to the assessment generator. It currently reads `argument_for` and linked `project_policies` but does NOT read `issue_notes.policy_national`
- Look for wherever `project_issue_tracks` are created (likely in `projects.routes.js` or a workflow/analysis controller) — this is the auto-apply hook point
- Check the admin console frontend — it is likely in `frontend/src/routes/` or similar. Find where issue tracks are managed to know where to add the auto-apply call
- `frontend/src/lib/api/planningApplication.js` — existing API client patterns to follow

---

## Step 1: DB Migration

Create file: `backend/sql/migrations/046_policy_template_library.sql`

```sql
-- Add development_type to projects table
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS development_type VARCHAR(100);

-- Policy template library
CREATE TABLE IF NOT EXISTS planning_applications.assessment_policy_templates (
  id              SERIAL PRIMARY KEY,
  discipline      VARCHAR(100)  NOT NULL,
  development_type VARCHAR(100) NOT NULL,
  policy_national_text TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (discipline, development_type)
);
```

---

## Step 2: Backend — Template CRUD controller

Create: `backend/src/controllers/policyTemplates.controller.js`

Exports:
- `listTemplates(req, res)` — `SELECT * FROM planning_applications.assessment_policy_templates ORDER BY development_type, discipline`
- `getTemplate(req, res)` — by id
- `upsertTemplate(req, res)` — `INSERT ... ON CONFLICT (discipline, development_type) DO UPDATE SET policy_national_text = $3, updated_at = NOW() RETURNING *`
- `deleteTemplate(req, res)` — delete by id

---

## Step 3: Backend — Register template routes

Find the admin/projects router (likely `backend/src/routes/projects.routes.js` or a dedicated admin router). Add:

```js
import {
  listTemplates, getTemplate, upsertTemplate, deleteTemplate
} from '../controllers/policyTemplates.controller.js';

router.get('/policy-templates', listTemplates);
router.get('/policy-templates/:id', getTemplate);
router.post('/policy-templates', upsertTemplate);       // body: { discipline, development_type, policy_national_text }
router.delete('/policy-templates/:id', deleteTemplate);
```

Also add a PATCH route for `development_type` on a project:

```js
router.patch('/:projectId/development-type', async (req, res) => {
  const { development_type } = req.body;
  const { rows } = await pool.query(
    `UPDATE public.projects SET development_type = $1 WHERE id = $2 RETURNING *`,
    [development_type ?? null, req.params.projectId]
  );
  res.json(rows[0]);
});
```

---

## Step 4: Backend — Auto-apply hook on issue track creation

Find where `project_issue_tracks` are created (search for `INSERT INTO admin_console.project_issue_tracks`). After the insert, add this logic:

```js
// Auto-apply national policy template if one exists for this project's development type + discipline
async function applyPolicyTemplate(projectId, trackId, discipline) {
  if (!discipline) return;
  const { rows: projRows } = await pool.query(
    `SELECT development_type FROM public.projects WHERE id = $1`, [projectId]
  );
  const developmentType = projRows[0]?.development_type;
  if (!developmentType) return;

  const { rows: tplRows } = await pool.query(
    `SELECT policy_national_text FROM planning_applications.assessment_policy_templates
     WHERE discipline = $1 AND development_type = $2`,
    [discipline, developmentType]
  );
  if (!tplRows[0]?.policy_national_text) return;

  // Upsert issue_notes — only set policy_national if not already filled
  await pool.query(
    `INSERT INTO planning_applications.issue_notes (project_id, track_id, policy_national)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id, track_id) DO UPDATE
       SET policy_national = EXCLUDED.policy_national
       WHERE planning_applications.issue_notes.policy_national IS NULL
          OR planning_applications.issue_notes.policy_national = ''`,
    [projectId, trackId, tplRows[0].policy_national_text]
  );
}
```

Call `applyPolicyTemplate(projectId, newTrack.id, newTrack.discipline)` immediately after the INSERT returns.

---

## Step 5: Backend — Wire `policy_national` into assessment generation

### 5a. Update the assessment generation query

In `planningApplication.controller.js`, find the query that fetches issues for assessment generation (look for queries joining `project_issue_tracks` with `issue_notes` for `argument_for`). Add `ins.policy_national` to the SELECT:

```sql
SELECT pit.id, pit.label, pit.discipline, pit.sort_order,
       ins.argument_for, ins.policy_national
FROM admin_console.project_issue_tracks pit
LEFT JOIN planning_applications.issue_notes ins
  ON ins.track_id = pit.id AND ins.project_id = $1
WHERE pit.project_id = $1 AND pit.is_active = TRUE
ORDER BY pit.sort_order, pit.id
```

This affects both `generateAssessmentIssue` and `handleGenerate` (full section generation) — check both code paths.

### 5b. Update `buildPlanningAppIssueContext` in `llm.service.js`

Around line 1317, after the linked policies block and before the `### Policy Assessment Notes` block, add:

```js
if (issue.policy_national?.trim()) {
  lines.push(`### National Policy Context`);
  lines.push(issue.policy_national.trim());
}
```

This slots the template text between the raw policy records and the compliance argument notes, giving Claude the pre-written national policy interpretation before the project-specific compliance argument.

---

## Step 6: Frontend — API client

Add to `frontend/src/lib/api/planningApplication.js` (or a shared projects API file — follow existing pattern):

```js
// Policy templates (admin)
export async function listPolicyTemplates() {
  const res = await authFetch('/api/policy-templates');  // adjust base path to match registered route
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
}

export async function upsertPolicyTemplate(data) {
  // data: { discipline, development_type, policy_national_text }
  const res = await authFetch('/api/policy-templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to save template');
  return res.json();
}

export async function deletePolicyTemplate(id) {
  const res = await authFetch(`/api/policy-templates/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete template');
  return res.json();
}

export async function setProjectDevelopmentType(projectId, developmentType) {
  const res = await authFetch(`/api/projects/${projectId}/development-type`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ development_type: developmentType })
  });
  if (!res.ok) throw new Error('Failed to update development type');
  return res.json();
}
```

---

## Step 7: Frontend — Admin console UI

Find where the admin console is rendered (search for admin routes/pages in `frontend/src/routes/`). Add a **"Policy Templates"** section.

### UI structure

**Template list view:**
- Table with columns: Development Type | Discipline | National Policy Text (truncated) | Actions
- "New template" button → opens create modal
- Each row: Edit button → opens edit modal | Delete button (with confirm)

**Create/edit modal:**
- `Development type` — text input (e.g. "Residential", "Solar", "Commercial", "Mixed Use")
- `Discipline` — text input or select matching the values used on issue tracks (check what discipline values exist in `admin_console.project_issue_tracks.discipline`)
- `National policy text` — large textarea
- Save button → calls `upsertPolicyTemplate`

### Discipline values
Check the database or existing UI for what discipline strings are in use (e.g. `heritage`, `highways`, `ecology`, `transport`, `design`, `residential_amenity` etc.) — use these as options in the discipline selector.

---

## Step 8: Frontend — Development type on project

Find where project details are displayed/edited (likely in a project settings page or the planning workspace header). Add a **"Development type"** field:

- Small text input or select (e.g. Residential / Commercial / Solar / Mixed Use / Industrial / Change of Use / Other)
- On change, call `setProjectDevelopmentType(project.id, value)`
- Display it in the planning workspace header alongside the project name

---

## Step 9: Verify end-to-end

1. Create a template in admin console: discipline = `heritage`, development_type = `Residential`, with national policy text
2. Create/set a project with `development_type = Residential`  
3. Add an issue track with `discipline = heritage` to that project
4. Check `planning_applications.issue_notes` — `policy_national` should be populated
5. Go to the Policy tab in the planning workspace — the national policy field for that issue should show the template text
6. Generate the planning assessment for that issue — verify the national policy context appears in the output

---

## Notes

- The `ON CONFLICT ... WHERE ... IS NULL OR = ''` in the auto-apply SQL means templates only fill blank fields — they never overwrite text a user has already written
- Templates are discipline-exact match — no fuzzy matching. Keep discipline values consistent between templates and issue tracks
- `development_type` on projects is free text initially — if you want a controlled vocabulary, add a `planning_applications.development_types` lookup table later and use a select instead of a text input
- The `policy_national` field already has a full editing UI in `PolicyTierNotes.svelte` (Policy tab) — users can always override the template text there after it's applied
