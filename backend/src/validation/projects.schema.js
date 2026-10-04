/**
 * Validation rules for project create/update requests.
 *
 * Deliberately lenient: these rules check type and a generous maximum length so
 * that malformed or oversized input is rejected with a 400 instead of reaching
 * the database, without changing what the existing forms are allowed to send.
 * Unknown keys are passed through untouched (the controllers pick the fields
 * they use).
 *
 * The limits here are the "documented input validation rules" for projects —
 * see docs/deployment/SECURITY_CONTROLS.md.
 */

import { z } from 'zod';

const text = (max) => z.string().max(max);
// Fields the forms send as '' when empty, or null when cleared
const optionalText = (max) => text(max).nullable().optional();
const stringList = (maxItems = 100, maxLen = 300) => z.array(text(maxLen)).max(maxItems);

const idLike = z.union([text(100), z.number()]);

// Dates arrive as 'YYYY-MM-DD' strings (or '' / null when cleared)
const dateField = z.union([text(40), z.null()]).optional();

const longText = optionalText(50000);

const shared = {
  project_name: text(300),
  project_type: optionalText(100),
  local_planning_authority: stringList(50, 200).nullable().optional(),
  project_lead: optionalText(200),
  project_manager: optionalText(200),
  project_director: optionalText(200),
  project_lead_user_id: optionalText(100),
  project_manager_user_id: optionalText(100),
  project_director_user_id: optionalText(100),
  address: optionalText(1000),
  polygon_geojson: z.any().optional(),
  area: z.union([text(100), z.number(), z.null()]).optional(),
  client: optionalText(300),
  client_spv_name: optionalText(300),
  sectors: stringList().nullable().optional(),
  sub_sectors: stringList().nullable().optional(),
  development_types: stringList().nullable().optional(),
  designations_on_site: z.union([text(20000), z.array(z.any()).max(500), z.null()]).optional(),
  relevant_nearby_designations: z.union([text(20000), z.array(z.any()).max(500), z.null()]).optional(),
  status: optionalText(100),
};

export const createProjectSchema = z.looseObject({
  ...shared,
  project_id: idLike.refine((v) => String(v).trim().length > 0, 'project_id is required'),
  project_name: text(300).refine((v) => v.trim().length > 0, 'project_name is required'),
});

export const updateProjectSchema = z.looseObject({
  ...shared,
  project_id: idLike.optional(),
  project_name: text(300).optional(),
  development_description: longText,
  case_officer_name: optionalText(300),
  case_officer_email: optionalText(320),
  case_officer_phone_number: optionalText(50),
  lpa_reference: optionalText(200),
  submission_date: dateField,
  validation_date: dateField,
  lpa_consultation_end_date: dateField,
  committee_date: dateField,
  target_determination_date: dateField,
  determined_date: dateField,
  expiry_of_1st_stat_period_date: dateField,
  eot_date: dateField,
  six_months_appeal_window_date: dateField,
  comments: longText,
  about_applicant: longText,
});

export const developmentTypeSchema = z.looseObject({
  development_type: optionalText(200),
});
