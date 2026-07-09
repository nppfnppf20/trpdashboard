/**
 * Meeting guide content — fetched from the backend, which is the single
 * source of truth (backend/src/services/meetingGuideContent.js). The same
 * content drives the briefing transcript summary prompt, so the on-screen
 * guide and the AI summary structure always match. Edit the backend file
 * to change the guide.
 */
import { authFetch } from '$lib/api/client.js';

let cache = null;

/** Fetch the guide content { baseSections, issueQuestions, tailSections }, cached per session. */
export async function fetchGuideContent() {
  if (cache) return cache;
  const res = await authFetch('/api/planning-application/meeting-guide');
  if (!res.ok) throw new Error('Failed to load meeting guide');
  cache = await res.json();
  return cache;
}

/**
 * Build the full sections list for a given project.
 * guide: content from fetchGuideContent()
 * issueTracks: array of { id, label, discipline } from the project
 */
export function buildGuide(guide, issueTracks = []) {
  const { baseSections, issueQuestions, tailSections } = guide;

  const issueSections = issueTracks.map((track, i) => ({
    title: `9.${i + 1} ${track.label}`,
    feedsLabel: 'Issue working notes + planning statement',
    questions: issueQuestions
  }));

  const keyIssueHeader = {
    title: '9. Key Issues',
    feedsLabel: 'Issue working notes, HLPV, planning statement assessment',
    questions: issueTracks.length === 0
      ? ['No issue tracks set up yet — add tracks on the Stages tab first.']
      : [`The following sub-sections cover each active issue track (${issueTracks.length} total).`]
  };

  return [...baseSections, keyIssueHeader, ...issueSections, ...tailSections];
}
