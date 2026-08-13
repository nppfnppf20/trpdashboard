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
 * issueSectionFeedsLabel, issueSectionExamples, tailSections } for a doc type, cached
 * per (docType, project). Section titles come back unnumbered — buildGuide() numbers
 * them by position, since doc types have different section counts.
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
 * Build the full, numbered sections list for a given project.
 * guide: content from fetchGuideContent()
 * issueTracks: array of { id, label, discipline } — this project's drafting
 * issues, used only to note how many issues exist. The checklist itself is
 * shown once, as a "repeat this per issue" template — not expanded into a
 * separate repeated sub-section per real issue.
 */
export function buildGuide(guide, issueTracks = []) {
  const { baseSections, issueQuestions, tailSections, issueSectionLabel, issueSectionFeedsLabel, issueSectionExamples } = guide;
  const sectionLabel = issueSectionLabel ?? 'Key Issues';
  const feedsLabel = issueSectionFeedsLabel ?? 'Issue working notes, HLPV, planning statement assessment';
  const examples = issueSectionExamples ?? [];

  const numberedBase = baseSections.map((s, i) => ({ ...s, title: `${i + 1}. ${s.title}` }));
  const issueSectionNumber = baseSections.length + 1;

  const countNote = issueTracks.length > 0
    ? ` This project currently has ${issueTracks.length} issue(s) set up on the Drafting Issues tab.`
    : '';

  const issueSection = {
    title: `${issueSectionNumber}. ${sectionLabel}`,
    feedsLabel,
    headerNote: `Repeat this checklist for every issue on this project (for example: heritage, ecology, daylight/sunlight, landscape and visual, agricultural land, highways and access, noise) — however many issues that turns out to be.${countNote}`,
    questions: [
      ...examples,
      ...issueQuestions
    ]
  };

  const numberedTail = tailSections.map((s, i) => ({ ...s, title: `${issueSectionNumber + 1 + i}. ${s.title}` }));

  return [...numberedBase, issueSection, ...numberedTail];
}
