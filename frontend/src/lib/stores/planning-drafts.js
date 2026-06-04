import { writable, get } from 'svelte/store';
import { tick } from 'svelte';
import { getDraftTypes, getDraft, saveDraft, generateDraft, generateDraftSection, getSections, createSection, updateSection, deleteSection, reorderSections, getSectionPrompt, resetSectionPrompt, getAssessmentIssues, generateAssessmentIssue } from '$lib/api/planningApplication.js';

// Editor component refs — set from the template via setDraftEditor / setSectionExampleEditor
let _draftEditor;
let _sectionExampleEditor;
let _projectId;

export function initDrafts(projectId) {
  _projectId = projectId;
}

export function setDraftEditor(editor) {
  _draftEditor = editor;
}

export function setSectionExampleEditor(editor) {
  _sectionExampleEditor = editor;
}

export const draftTypes = writable([]);
export const drafts = writable({});
export const draftLoading = writable({});
export const draftGenerating = writable(null);
export const activeDraftTypeId = writable(null);
export const draftEditorHtml = writable('');
export const draftSaving = writable(false);
export const draftSaved = writable(false);

export const sectionsModalOpen = writable(false);
export const sectionsTypeId = writable(null);
export const sectionsTypeName = writable('');
export const sections = writable([]);
export const sectionsLoading = writable(false);
export const newSectionName = writable('');
export const addingSectionLoading = writable(false);
export const sectionGenerating = writable(null);
export const sectionExpandedId = writable(null);
export const sectionPromptId = writable(null);
export const sectionPromptText = writable('');
export const sectionPromptIsCustom = writable(false);
export const sectionPromptSaving = writable(false);
export const sectionPromptSaved = writable(false);
export const sectionPromptResetting = writable(false);
export const sectionTemplateText = writable('');
export const sectionTemplateSaving = writable(false);
export const sectionTemplateSaved = writable(false);
export const sectionExampleModalOpen = writable(false);
export const sectionExampleId = writable(null);
export const sectionExampleSaving = writable(false);
export const sectionExampleSaved = writable(false);

export async function loadDraftTypes() {
  try {
    const types = await getDraftTypes();
    draftTypes.set(types);
    await Promise.all(types.map(async t => {
      const d = await getDraft(_projectId, t.id);
      drafts.update(dd => ({ ...dd, [t.id]: d }));
    }));
  } catch (err) {
    console.error('Failed to load draft types:', err);
  }
}

export async function handleGenerate(typeId) {
  draftGenerating.set(typeId);
  try {
    const result = await generateDraft(_projectId, typeId);
    drafts.update(d => ({ ...d, [typeId]: result }));
    openDraft(typeId);
  } catch (err) {
    console.error('Generate failed:', err);
    alert(`Generation failed: ${err.message}`);
  } finally {
    draftGenerating.set(null);
  }
}

export function openDraft(typeId) {
  const draft = get(drafts)[typeId];
  if (!draft) return;
  activeDraftTypeId.set(typeId);
  draftEditorHtml.set(draft.content_html ?? '');
  draftSaved.set(false);
}

export function closeDraft() {
  activeDraftTypeId.set(null);
  draftEditorHtml.set('');
}

export async function handleSaveDraft() {
  const typeId = get(activeDraftTypeId);
  if (!typeId) return;
  draftSaving.set(true);
  try {
    const html = _draftEditor?.getHTML() ?? get(draftEditorHtml);
    const result = await saveDraft(_projectId, typeId, html);
    drafts.update(d => ({ ...d, [typeId]: result }));
    draftEditorHtml.set(html);
    draftSaved.set(true);
    setTimeout(() => draftSaved.set(false), 2500);
  } catch (err) {
    console.error('Save draft failed:', err);
  } finally {
    draftSaving.set(false);
  }
}

export async function openSectionsModal(typeId) {
  sectionsTypeId.set(typeId);
  sectionsTypeName.set(get(draftTypes).find(t => t.id === typeId)?.name ?? '');
  sectionsModalOpen.set(true);
  sectionsLoading.set(true);
  sectionExpandedId.set(null);
  try {
    sections.set(await getSections(typeId));
  } catch (err) {
    console.error('Failed to load sections:', err);
  } finally {
    sectionsLoading.set(false);
  }
}

export async function handleAddSection() {
  const name = get(newSectionName).trim();
  if (!name) return;
  addingSectionLoading.set(true);
  try {
    const typeId = get(sectionsTypeId);
    const s = await createSection(typeId, { name, description: '' });
    sections.update(ss => [...ss, s]);
    newSectionName.set('');
    invalidateCardSections(typeId);
  } catch (err) {
    console.error('Failed to add section:', err);
  } finally {
    addingSectionLoading.set(false);
  }
}

export async function handleDeleteSection(sectionId) {
  if (!confirm('Delete this section?')) return;
  try {
    const typeId = get(sectionsTypeId);
    await deleteSection(sectionId);
    sections.update(ss => ss.filter(s => s.id !== sectionId));
    if (get(sectionExpandedId) === sectionId) sectionExpandedId.set(null);
    invalidateCardSections(typeId);
  } catch (err) {
    console.error('Failed to delete section:', err);
  }
}

export async function moveSectionUp(idx) {
  if (idx === 0) return;
  let reordered;
  sections.update(ss => {
    reordered = [...ss];
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    return reordered;
  });
  try { await reorderSections(get(sectionsTypeId), reordered.map(s => s.id)); } catch {}
}

export async function moveSectionDown(idx) {
  let reordered;
  sections.update(ss => {
    if (idx >= ss.length - 1) return ss;
    reordered = [...ss];
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
    return reordered;
  });
  if (reordered) {
    try { await reorderSections(get(sectionsTypeId), reordered.map(s => s.id)); } catch {}
  }
}

export async function toggleSectionExpand(sectionId) {
  if (get(sectionExpandedId) === sectionId) {
    sectionExpandedId.set(null);
  } else {
    sectionExpandedId.set(sectionId);
    sectionPromptId.set(sectionId);
    const s = get(sections).find(sec => sec.id === sectionId);
    sectionTemplateText.set(s?.template_html ?? '');
    sectionPromptSaved.set(false);
    sectionTemplateSaved.set(false);

    if (s?.slug === 'planning_assessment') {
      sectionPromptText.set('');
      sectionPromptIsCustom.set(false);
      try {
        const data = await getSectionPrompt(sectionId);
        sectionPromptText.set(data.prompt);
        sectionPromptIsCustom.set(data.is_custom);
      } catch (err) {
        console.error('Failed to load section prompt:', err);
      }
    } else {
      sectionPromptText.set(s?.generation_prompt ?? '');
      sectionPromptIsCustom.set(false);
    }
  }
}

export async function handleResetSectionPrompt(sectionId) {
  sectionPromptResetting.set(true);
  try {
    const data = await resetSectionPrompt(sectionId);
    sectionPromptText.set(data.prompt);
    sectionPromptIsCustom.set(false);
    sections.update(ss => ss.map(s => s.id === sectionId ? { ...s, generation_prompt: null } : s));
  } catch (err) {
    console.error('Failed to reset section prompt:', err);
  } finally {
    sectionPromptResetting.set(false);
  }
}

export async function handleSaveSectionPrompt(sectionId) {
  sectionPromptSaving.set(true);
  try {
    const updated = await updateSection(sectionId, { generation_prompt: get(sectionPromptText) });
    sections.update(ss => ss.map(s => s.id === sectionId ? { ...s, ...updated } : s));
    sectionPromptIsCustom.set(true);
    sectionPromptSaved.set(true);
    setTimeout(() => sectionPromptSaved.set(false), 2500);
  } catch (err) {
    console.error('Failed to save section prompt:', err);
  } finally {
    sectionPromptSaving.set(false);
  }
}

export async function handleSaveSectionTemplate(sectionId) {
  sectionTemplateSaving.set(true);
  try {
    const updated = await updateSection(sectionId, { template_html: get(sectionTemplateText) || null });
    sections.update(ss => ss.map(s => s.id === sectionId ? { ...s, ...updated } : s));
    sectionTemplateSaved.set(true);
    setTimeout(() => sectionTemplateSaved.set(false), 2500);
  } catch (err) {
    console.error('Failed to save section template:', err);
  } finally {
    sectionTemplateSaving.set(false);
  }
}

export async function openSectionExampleModal(sectionId) {
  sectionExampleId.set(sectionId);
  sectionExampleSaved.set(false);
  sectionExampleModalOpen.set(true);
  const s = get(sections).find(sec => sec.id === sectionId);
  await tick();
  _sectionExampleEditor?.setHTML(s?.example_text ?? '');
}

export async function handleSaveSectionExample() {
  sectionExampleSaving.set(true);
  try {
    const id = get(sectionExampleId);
    const html = _sectionExampleEditor?.getHTML() ?? '';
    const updated = await updateSection(id, { example_text: html });
    sections.update(ss => ss.map(s => s.id === id ? { ...s, ...updated } : s));
    sectionExampleSaved.set(true);
    setTimeout(() => sectionExampleSaved.set(false), 2500);
  } catch (err) {
    console.error('Failed to save section example:', err);
  } finally {
    sectionExampleSaving.set(false);
  }
}

function patchSectionInDraft(draftHtml, sectionName, newSectionHtml) {
  if (!draftHtml) return newSectionHtml;
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match numbered headings like "2.0 Background" as well as plain "Background"
  const pattern = new RegExp(`<h2>[^<]*${escaped}[^<]*<\\/h2>[\\s\\S]*?(?=<h2>|$)`, 'i');
  if (pattern.test(draftHtml)) {
    return draftHtml.replace(pattern, newSectionHtml + '\n\n');
  }
  return draftHtml + '\n\n' + newSectionHtml;
}

// ── Inline card sections (expand on draft type card without opening modal) ──

export const cardExpandedTypeId = writable(null);
export const cardSections = writable({});       // typeId → section[]
export const cardSectionsLoading = writable({}); // typeId → bool

export async function toggleCardExpand(typeId) {
  if (get(cardExpandedTypeId) === typeId) {
    cardExpandedTypeId.set(null);
    return;
  }
  cardExpandedTypeId.set(typeId);
  if (!get(cardSections)[typeId]) {
    cardSectionsLoading.update(s => ({ ...s, [typeId]: true }));
    try {
      const loaded = await getSections(typeId);
      cardSections.update(s => ({ ...s, [typeId]: loaded }));
    } catch (err) {
      console.error('Failed to load card sections:', err);
    } finally {
      cardSectionsLoading.update(s => ({ ...s, [typeId]: false }));
    }
  }
}

export function invalidateCardSections(typeId) {
  cardSections.update(s => { const copy = { ...s }; delete copy[typeId]; return copy; });
}

// ── Per-issue assessment generation ──

export const assessmentIssues = writable([]);
export const assessmentIssuesLoading = writable(false);
export const issueGenerating = writable(null); // trackId

export async function loadAssessmentIssues() {
  assessmentIssuesLoading.set(true);
  try {
    assessmentIssues.set(await getAssessmentIssues(_projectId));
  } catch (err) {
    console.error('Failed to load assessment issues:', err);
  } finally {
    assessmentIssuesLoading.set(false);
  }
}

function patchIssueInDraft(draftHtml, issueLabel, newIssueHtml) {
  if (!draftHtml) return newIssueHtml;
  const escaped = issueLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const h3Pattern = new RegExp(`<h3>[^<]*${escaped}[^<]*<\\/h3>`, 'i');

  // Walk each llm-generated block individually so we never match across block boundaries
  const OPEN = '<div class="llm-generated">';
  const CLOSE = '</div>';
  let searchFrom = 0;
  while (true) {
    const openIdx = draftHtml.indexOf(OPEN, searchFrom);
    if (openIdx === -1) break;
    const closeIdx = draftHtml.indexOf(CLOSE, openIdx + OPEN.length);
    if (closeIdx === -1) break;
    const block = draftHtml.slice(openIdx, closeIdx + CLOSE.length);
    if (h3Pattern.test(block)) {
      return draftHtml.slice(0, openIdx) + newIssueHtml + draftHtml.slice(closeIdx + CLOSE.length);
    }
    searchFrom = closeIdx + CLOSE.length;
  }

  // No existing block found — insert after the Planning Assessment h2
  const h2Match = /<h2>[^<]*[Pp]lanning\s+[Aa]ssessment[^<]*<\/h2>/.exec(draftHtml);
  if (h2Match) {
    const insertAt = h2Match.index + h2Match[0].length;
    return draftHtml.slice(0, insertAt) + '\n\n' + newIssueHtml + draftHtml.slice(insertAt);
  }

  return draftHtml + '\n\n' + newIssueHtml;
}

export async function handleGenerateAssessmentIssue(typeId, sectionId, trackId, issueLabel) {
  issueGenerating.set(trackId);
  try {
    const { html } = await generateAssessmentIssue(_projectId, typeId, sectionId, trackId);
    const currentHtml = get(drafts)[typeId]?.content_html ?? '';
    const patched = patchIssueInDraft(currentHtml, issueLabel, html);
    const saved = await saveDraft(_projectId, typeId, patched);
    drafts.update(d => ({ ...d, [typeId]: saved }));
    if (get(activeDraftTypeId) === typeId) {
      draftEditorHtml.set(patched);
      _draftEditor?.setHTML(patched);
    }
  } catch (err) {
    console.error('Generate assessment issue failed:', err);
    alert(`Failed to generate: ${err.message}`);
  } finally {
    issueGenerating.set(null);
  }
}

export async function handleGenerateSection(sectionId, explicitTypeId = null) {
  sectionGenerating.set(sectionId);
  try {
    const typeId = explicitTypeId ?? get(sectionsTypeId);
    const result = await generateDraftSection(_projectId, typeId, sectionId);
    const currentHtml = get(drafts)[typeId]?.content_html ?? '';
    const section = get(sections).find(s => s.id === sectionId)
      ?? Object.values(get(cardSections)).flat().find(s => s.id === sectionId);
    const patched = patchSectionInDraft(currentHtml, section.name, result.html);
    const saved = await saveDraft(_projectId, typeId, patched);
    drafts.update(d => ({ ...d, [typeId]: saved }));
    if (get(activeDraftTypeId) === typeId) {
      draftEditorHtml.set(patched);
      _draftEditor?.setHTML(patched);
    }
  } catch (err) {
    console.error('Generate section failed:', err);
    alert(`Failed to generate section: ${err.message}`);
  } finally {
    sectionGenerating.set(null);
  }
}
