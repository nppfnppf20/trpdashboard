// Order and names of the seven planning stages. Keys match the stage_key check in migration 190.
export const PLANNING_STAGES = [
  { key: 'appraisal',           num: '1(a)', name: 'Detailed appraisal', sub: 'Feasibility and scoping' },
  { key: 'pre_app',             num: '2',    name: 'Pre-application discussions', sub: 'Pre-app with the LPA' },
  { key: 'eia_screening',       num: '3',    name: 'EIA screening', sub: 'Screening and scoping' },
  { key: 'surveys',             num: '4(a)', name: 'Specialist surveys and reports', sub: 'Other specialist work' },
  { key: 'public_engagement',   num: '5',    name: 'Public engagement', sub: 'Consultation' },
  { key: 'prepare_application', num: '6',    name: 'Prepare planning application', sub: 'Drafting and submission pack' },
  { key: 'post_submission',     num: '7',    name: 'Post-submission', sub: 'Project management' }
];

export const STAGE_STATUS_LABEL = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete: 'Complete',
  na: 'Not applicable'
};
