-- Quote line item text columns were varchar(255), which verbatim descriptions
-- extracted from quote PDFs can exceed (error 22001: value too long for type
-- character varying(255)). Widen to TEXT: metadata-only change, existing data
-- untouched.
--
-- public.chat_quotes selects quote_notes, and Postgres refuses to alter a
-- column a view depends on, so the view is dropped and recreated with its
-- exact original definition (captured from the live DB on 2026-07-16).

BEGIN;

DROP VIEW public.chat_quotes;

ALTER TABLE admin_console.quote_line_items
  ALTER COLUMN item TYPE TEXT;

ALTER TABLE admin_console.quote_line_items
  ALTER COLUMN description TYPE TEXT;

ALTER TABLE admin_console.quotes
  ALTER COLUMN quote_notes TYPE TEXT;

CREATE VIEW public.chat_quotes AS
 SELECT q.id,
    q.project_code,
    q.discipline,
    q.status,
    q.instruction_status,
    q.work_status,
    q.total,
    q.partially_instructed_total,
    q.site_visit_date,
    q.report_draft_date,
    q.date,
    q.dependencies,
    q.quote_notes,
    q.operational_notes,
    q.quality,
    q.responsiveness,
    q.delivered_on_time,
    q.overall_review,
    q.review_notes,
    ps.name AS project_name,
    co.organisation_name AS surveyor_organisation,
    c.name AS contact_name
   FROM admin_console.quotes q
     LEFT JOIN admin_console.projects_with_stats ps ON q.project_id = ps.id
     LEFT JOIN admin_console.client_organisations co ON q.surveyor_organisation_id = co.id
     LEFT JOIN admin_console.contacts c ON q.contact_id = c.id;

COMMIT;
