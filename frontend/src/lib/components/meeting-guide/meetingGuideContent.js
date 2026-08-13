/**
 * Meeting guide content — fetched from the backend, which is the single
 * source of truth (backend/src/services/meetingGuideContent.js). The generic
 * guide also drives the briefing transcript summary prompt, so the on-screen
 * guide and the AI summary structure always match. Edit the backend file
 * to change the guide, or add a doc-type-specific entry to DOC_TYPE_GUIDES
 * there.
 */
import { authFetch } from '$lib/api/client.js';

const cache = new Map();

/**
 * Fetch the guide content { label, baseSections, issueQuestions, issueSectionLabel,
 * issueSectionFeedsLabel, tailSections } for a doc type, cached per (docType, project).
 * docTypeSlug: omit for the generic guide (e.g. Stage 1, HLPV, or the standalone
 * Meeting Notes tab entry point).
 * projectId: when given, sections with a `coveredByDocType` match against this
 * project's saved document summaries come back flagged `onFile: true`.
 */
export async function fetchGuideContent(docTypeSlug = null, projectId = null) {
  const key = `${docTypeSlug ?? ''}::${projectId ?? ''}`;
  if (cache.has(key)) return cache.get(key);

  const params = new URLSearchParams();
  if (docTypeSlug) params.set('docType', docTypeSlug);
  if (projectId) params.set('projectId', projectId);
  const qs = params.toString();

  const res = await authFetch(`/api/planning-application/meeting-guide${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to load meeting guide');
  const guide = await res.json();
  cache.set(key, guide);
  return guide;
}

/**
 * Build the full sections list for a given project.
 * guide: content from fetchGuideContent()
 * issueTracks: array of { id, label, discipline } — drafting issues for doc
 * types that use them (e.g. Planning Statement v3), or legacy issue tracks
 * otherwise.
 */
export function buildGuide(guide, issueTracks = []) {
  const { baseSections, issueQuestions, tailSections, issueSectionLabel, issueSectionFeedsLabel } = guide;
  const sectionLabel = issueSectionLabel ?? 'Key Issues';
  const feedsLabel = issueSectionFeedsLabel ?? 'Issue working notes, HLPV, planning statement assessment';

  const issueSections = issueTracks.map((track, i) => ({
    title: `9.${i + 1} ${track.label}`,
    feedsLabel: `Issue working notes + ${sectionLabel.toLowerCase()}`,
    questions: issueQuestions
  }));

  const keyIssueHeader = {
    title: `9. ${sectionLabel}`,
    feedsLabel,
    questions: issueTracks.length === 0
      ? ['No issues set up yet — add them on the Issues Tracker / Drafting Issues tab first.']
      : [`The following sub-sections cover each active issue (${issueTracks.length} total).`]
  };

  return [...baseSections, keyIssueHeader, ...issueSections, ...tailSections];
}
