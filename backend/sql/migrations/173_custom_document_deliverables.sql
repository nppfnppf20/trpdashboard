-- Allow a planning deliverable to be saved without an underlying template
-- row, so a document written from a custom prompt (the "Create" panel / the
-- blank document editor in the planning application workspace) can be saved
-- straight into planning_deliverables.planning_deliverables and show up as
-- an ordinary card on the project's Planning Deliverables page, alongside
-- template-generated deliverables.

ALTER TABLE planning_deliverables.planning_deliverables
  ALTER COLUMN template_id DROP NOT NULL;
