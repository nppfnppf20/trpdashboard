// Cross-project chat — a separate, standalone feature from the per-project
// chat in projectChat.service.js (kept deliberately unmodified). Reuses that
// file's existing per-project functions unchanged (getSourceCatalogue,
// assembleContext) by calling them once per project, then qualifying each
// resulting block's source ID with its owning project ("57:COND" instead of
// "COND") so two projects' identically-named trackers never collide. No new
// SQL — same flat "paste everything ticked into the prompt" design as the
// single-project version, just unioned across a small number of projects.
import { getSourceCatalogue, assembleContext, CONTEXT_BUDGET } from './projectChat.service.js';

export { CONTEXT_BUDGET };

// Returns [{ id, groups, budget }] — one source catalogue per project, for
// building a per-project source picker on the frontend.
export async function getMultiProjectCatalogue(projectIds) {
  return Promise.all(projectIds.map(async (id) => {
    const catalogue = await getSourceCatalogue(id);
    return { id, ...catalogue };
  }));
}

/**
 * Assemble qualified, labelled source blocks across multiple projects.
 * sourcesByProject: { [projectId]: { project_details, document_ids, meeting_ids, groups } }
 * Returns { blocks: [{ sourceId, label, text }], totalChars }
 */
export async function assembleMultiProjectContext(projectNames, sourcesByProject) {
  const perProject = await Promise.all(
    Object.entries(sourcesByProject).map(async ([projectId, sources]) => {
      const { blocks } = await assembleContext(projectId, sources);
      const projectName = projectNames[projectId] || `Project ${projectId}`;
      return blocks.map(b => ({
        sourceId: `${projectId}:${b.sourceId}`,
        label: `${b.label} (${projectName})`,
        text: b.text,
      }));
    })
  );

  const blocks = perProject.flat();
  const totalChars = blocks.reduce((acc, b) => acc + b.text.length, 0);
  return { blocks, totalChars };
}
