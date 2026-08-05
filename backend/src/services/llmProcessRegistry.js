/**
 * Registry of every AI-assisted process in the app, for the central
 * "AI Providers" admin console page (admin_console.llm_process_settings).
 *
 * status:
 *   'configurable' — wired to callLLM + resolveProvider; the toggle on the
 *                    admin page actually changes behaviour.
 *   'claude_only'  — still hardcoded to Claude (callClaude or a raw
 *                    Anthropic SDK call); listed for visibility only, toggle
 *                    disabled until converted.
 *   'background'   — cron/automated job; the central setting still applies
 *                    when read, but there's no per-instance UI to override it.
 */
export const LLM_PROCESS_REGISTRY = [
  // ── configurable ──────────────────────────────────────────────────────
  {
    key: 'quote_extraction',
    label: 'Quote Extraction (PDF import)',
    description: 'Reads an uploaded or pasted surveyor fee quote and prefills the Add Quote form.',
    status: 'configurable',
  },
  {
    key: 'appeal_draft_pa_notes',
    label: 'Appeal Draft Generation (from PA Notes)',
    description: 'Generates an appeal draft section from planning-application briefing notes.',
    status: 'configurable',
  },
  {
    key: 'planning_statement_draft',
    label: 'Planning Statement Draft Generation',
    description: 'Generates planning statement assessments, sections, and template slots.',
    status: 'configurable',
  },

  // ── claude_only ───────────────────────────────────────────────────────
  {
    key: 'appeal_draft_legacy',
    label: 'Appeal Draft Generation (legacy/manual)',
    description: 'Manual appeal draft generation, not driven by PA briefing notes.',
    status: 'claude_only',
  },
  {
    key: 'appeal_section_generate',
    label: 'Appeal Section Generation (manual)',
    description: 'Manual per-section appeal draft generation.',
    status: 'claude_only',
  },
  {
    key: 'appeal_argument_building',
    label: 'Appeal Argument Building / Chat / Incorporation',
    description: 'Argument drafting, document incorporation, and briefing chat within the appeal workspace.',
    status: 'claude_only',
  },
  {
    key: 'planning_statement_helpers',
    label: 'Planning Statement Helper Functions',
    description: 'Summarisation, transcript suggestions, and issue/argument drafting helpers in the planning statement workspace.',
    status: 'claude_only',
  },
  {
    key: 'draft_check',
    label: 'Draft Check',
    description: 'Brief coverage, consistency, and grammar checks on a draft.',
    status: 'claude_only',
  },
  {
    key: 'scraper_filter',
    label: 'Scraper Result Filtering',
    description: 'Filters scraped tender/contract listings by relevance.',
    status: 'claude_only',
  },
  {
    key: 'marketing_draft',
    label: 'Marketing Draft Generation',
    description: 'Generates marketing copy drafts.',
    status: 'claude_only',
  },
  {
    key: 'guiding_brief_review',
    label: 'Guiding Brief Review',
    description: 'Reviews a draft against its guiding brief.',
    status: 'claude_only',
  },
  {
    key: 'project_chat',
    label: 'Project Chat',
    description: 'Grounded Q&A chat over a project\'s selected sources.',
    status: 'claude_only',
  },
  {
    key: 'section_chat',
    label: 'Section Chat',
    description: 'Chat-driven editing of a specific draft section.',
    status: 'claude_only',
  },
  {
    key: 'planit_keyword_suggest',
    label: 'Planning App Keyword Suggestions',
    description: 'Suggests search keywords for finding similar planning applications.',
    status: 'claude_only',
  },
  {
    key: 'hlpv_v3_generate',
    label: 'HLPV v3 Generation',
    description: 'Generates the High-Level Planning View narrative (v3).',
    status: 'claude_only',
  },
  {
    key: 'stage1_review',
    label: 'Stage 1 Review Generation',
    description: 'Generates the Stage 1 review document.',
    status: 'claude_only',
  },
  {
    key: 'lpa_doc_analysis',
    label: 'LPA Document Analysis',
    description: 'Analyses and synthesises local planning authority documents.',
    status: 'claude_only',
  },
  {
    key: 'stage_analysis',
    label: 'Stage Analysis',
    description: 'Analyses an uploaded document for the current project stage.',
    status: 'claude_only',
  },
  {
    key: 'surveyor_briefing_analysis',
    label: 'Surveyor Briefing Analysis',
    description: 'Analyses briefing content for relevant disciplines and suggests email edits.',
    status: 'claude_only',
  },
  {
    key: 'hlpv_legacy_narrative',
    label: 'HLPV v1/v2 Narrative Generation',
    description: 'Legacy High-Level Planning View narrative generation.',
    status: 'claude_only',
  },
  {
    key: 'tracker_intake',
    label: 'Tracker Intake Processing',
    description: 'Processes intake text into structured tracker actions.',
    status: 'claude_only',
  },
  {
    key: 'meeting_processing',
    label: 'Meeting Notes Processing',
    description: 'Extracts insights and summarises meeting transcripts.',
    status: 'claude_only',
  },
  {
    key: 'conditions_tracker_suggestions',
    label: 'Conditions Tracker Suggestions',
    description: 'Suggests advancement summaries, summary emails, and fee quote works for conditions.',
    status: 'claude_only',
  },
  {
    key: 'quote_action_summaries',
    label: 'Quote Action Summaries',
    description: 'Suggests summaries for quote actions.',
    status: 'claude_only',
  },
  {
    key: 'consultation_processing',
    label: 'Consultation Response Processing',
    description: 'Processes and summarises consultation responses.',
    status: 'claude_only',
  },
  {
    key: 'public_comment_processing',
    label: 'Public Comment Processing',
    description: 'Processes and analyses public comments.',
    status: 'claude_only',
  },
  {
    key: 'policy_doc_processing',
    label: 'Policy Document Processing',
    description: 'Processes uploaded policy documents.',
    status: 'claude_only',
  },

  // ── background ────────────────────────────────────────────────────────
  {
    key: 'tender_relevance_classification',
    label: 'Tender Relevance Classification',
    description: 'Classifies scraped tender/contract candidates by relevance (cron + manual admin trigger).',
    status: 'background',
  },
  {
    key: 'document_ingestion',
    label: 'Document Ingestion Pipeline',
    description: 'Ingests and processes documents into the knowledge base.',
    status: 'background',
  },
];

export function getProcessByKey(key) {
  return LLM_PROCESS_REGISTRY.find(p => p.key === key) || null;
}
