import { writable, get } from 'svelte/store';
import { tick } from 'svelte';
import {
  getDraftTypes as paGetDraftTypes,
  getDraft as paGetDraft,
  saveDraft as paSaveDraft,
  generateDraft as paGenerateDraft,
  generateDraftSection as paGenerateDraftSection,
  getSections as paGetSections,
  createSection as paCreateSection,
  updateSection as paUpdateSection,
  deleteSection as paDeleteSection,
  reorderSections as paReorderSections,
  getSectionPrompt,
  resetSectionPrompt,
  getAssessmentIssues,
  generateAssessmentIssue,
  getPaDraftContext,
  hasPaIssueNotes,
} from '$lib/api/planningApplication.js';
import {
  getDraftTypes as appealGetDraftTypes,
  getDraft as appealGetDraft,
  saveDraft as appealSaveDraft,
  getSections as appealGetSections,
  createSection as appealCreateSection,
  updateSection as appealUpdateSection,
  deleteSection as appealDeleteSection,
  reorderSections as appealReorderSections,
  getDraftContext as appealGetDraftContext,
  generateDraftFromPaNotes,
  generateSectionFromPaNotes,
  getAppealTypePrompt,
  saveAppealTypePrompt as saveAppealTypePromptApi,
  resetAppealTypePrompt as resetAppealTypePromptApi,
} from '$lib/api/appeal.js';
import { getStage1Context } from '$lib/api/stage1Review.js';

// ── Routing helpers ────────────────────────────────────────────────────────────
// Appeal types get id: 'appeal_N' to avoid collision with PA numeric IDs.

function isAppeal(typeId) {
  return typeof typeId === 'string' && typeId.startsWith('appeal_');
}

function rawId(typeId) {
  return isAppeal(typeId) ? parseInt(typeId.replace('appeal_', ''), 10) : typeId;
}

function api(typeId) {
  return isAppeal(typeId) ? {
    getDraft:       (pid, _id) => appealGetDraft(pid, rawId(typeId)),
    saveDraft:      (pid, _id, html) => appealSaveDraft(pid, rawId(typeId), html),
    getSections:    (_id) => appealGetSections(rawId(typeId)),
    createSection:  (_id, data) => appealCreateSection(rawId(typeId), data),
    updateSection:  (sid, data) => appealUpdateSection(sid, data),
    deleteSection:  (sid) => appealDeleteSection(sid),
    reorderSections: (_id, order) => appealReorderSections(rawId(typeId), order),
    generateDraft:  (pid, _id, opts) => generateDraftFromPaNotes(pid, rawId(typeId), opts),
    generateSection: (pid, _id, sid) => generateSectionFromPaNotes(pid, rawId(typeId), sid),
  } : {
    getDraft:       paGetDraft,
    saveDraft:      paSaveDraft,
    getSections:    paGetSections,
    createSection:  paCreateSection,
    updateSection:  paUpdateSection,
    deleteSection:  paDeleteSection,
    reorderSections: paReorderSections,
    generateDraft:  paGenerateDraft,
    generateSection: paGenerateDraftSection,
  };
}

// ── Editor refs ────────────────────────────────────────────────────────────────
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

// ── Stores ─────────────────────────────────────────────────────────────────────
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

// ── Load ───────────────────────────────────────────────────────────────────────

export async function loadDraftTypes() {
  try {
    const [paTypes, hasNotes, appealTypesRaw] = await Promise.all([
      paGetDraftTypes(),
      hasPaIssueNotes(_projectId),
      appealGetDraftTypes(),
    ]);

    const tagged = [
      ...paTypes.map(t => ({ ...t, tool: 'pa' })),
      ...(hasNotes ? appealTypesRaw.map(t => ({
        ...t,
        id: `appeal_${t.id}`,
        _rawId: t.id,
        tool: 'appeal',
      })) : []),
    ];

    draftTypes.set(tagged);

    await Promise.all(tagged.map(async t => {
      try {
        const d = isAppeal(t.id)
          ? await appealGetDraft(_projectId, t._rawId)
          : await paGetDraft(_projectId, t.id);
        drafts.update(dd => ({ ...dd, [t.id]: d }));
      } catch (err) {
        console.error(`Failed to load draft for type ${t.id}:`, err);
      }
    }));
  } catch (err) {
    console.error('Failed to load draft types:', err);
  }
}

// ── Draft actions ──────────────────────────────────────────────────────────────

// appealSelectedNoteIds: typeId → briefingNoteId (null = latest)
export const appealSelectedNoteIds = writable({});
export const appealDropdownOpenId = writable(null);

export async function handleGenerate(typeId, opts = {}) {
  draftGenerating.set(typeId);
  try {
    const a = api(typeId);
    const result = await a.generateDraft(_projectId, rawId(typeId), opts);
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
    const a = api(typeId);
    const result = await a.saveDraft(_projectId, rawId(typeId), html);
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

// ── Sections modal ─────────────────────────────────────────────────────────────

export async function openSectionsModal(typeId, { autoExpand = false } = {}) {
  sectionsTypeId.set(typeId);
  sectionsTypeName.set(get(draftTypes).find(t => t.id === typeId)?.name ?? '');
  sectionsModalOpen.set(true);
  sectionsLoading.set(true);
  sectionExpandedId.set(null);
  try {
    const loaded = await api(typeId).getSections(rawId(typeId));
    sections.set(loaded);
    if (autoExpand && loaded.length > 0) {
      const first = loaded[0];
      sectionExpandedId.set(first.id);
      sectionPromptId.set(first.id);
      sectionTemplateText.set(first.template_html ?? '');
      sectionPromptText.set(first.generation_prompt ?? '');
      sectionPromptIsCustom.set(false);
      sectionPromptSaved.set(false);
      sectionTemplateSaved.set(false);
    }
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
    const s = await api(typeId).createSection(rawId(typeId), { name, description: '' });
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
    await api(typeId).deleteSection(sectionId);
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
  const typeId = get(sectionsTypeId);
  try { await api(typeId).reorderSections(rawId(typeId), reordered.map(s => s.id)); } catch {}
}

export async function moveSectionDown(idx) {
  let reordered;
  sections.update(ss => {
    if (idx >= ss.length - 1) return ss;
    reordered = [...ss];
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
    return reordered;
  });
  const typeId = get(sectionsTypeId);
  if (reordered) {
    try { await api(typeId).reorderSections(rawId(typeId), reordered.map(s => s.id)); } catch {}
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

    const typeId = get(sectionsTypeId);
    if (!isAppeal(typeId) && s?.slug === 'planning_assessment') {
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
    const typeId = get(sectionsTypeId);
    const updated = await api(typeId).updateSection(sectionId, { generation_prompt: get(sectionPromptText) });
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
    const typeId = get(sectionsTypeId);
    const updated = await api(typeId).updateSection(sectionId, { template_html: get(sectionTemplateText) || null });
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
    const typeId = get(sectionsTypeId);
    const html = _sectionExampleEditor?.getHTML() ?? '';
    const updated = await api(typeId).updateSection(id, { example_text: html });
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
  const pattern = new RegExp(`<h2>[^<]*${escaped}[^<]*<\\/h2>[\\s\\S]*?(?=<h2>|$)`, 'i');
  if (pattern.test(draftHtml)) {
    return draftHtml.replace(pattern, newSectionHtml + '\n\n');
  }
  return draftHtml + '\n\n' + newSectionHtml;
}

// ── Inline card sections ───────────────────────────────────────────────────────

export const cardExpandedTypeId = writable(null);
export const cardSections = writable({});
export const cardSectionsLoading = writable({});

export async function toggleCardExpand(typeId) {
  if (get(cardExpandedTypeId) === typeId) {
    cardExpandedTypeId.set(null);
    return;
  }
  cardExpandedTypeId.set(typeId);
  if (!get(cardSections)[typeId]) {
    cardSectionsLoading.update(s => ({ ...s, [typeId]: true }));
    try {
      const loaded = await api(typeId).getSections(rawId(typeId));
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

// ── Per-issue assessment generation (PA only) ──────────────────────────────────

export const assessmentIssues = writable([]);
export const assessmentIssuesLoading = writable(false);
export const issueGenerating = writable(null);

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
    const saved = await paSaveDraft(_projectId, typeId, patched);
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
    const a = api(typeId);
    const result = await a.generateSection(_projectId, rawId(typeId), sectionId);
    const currentHtml = get(drafts)[typeId]?.content_html ?? '';
    const section = get(sections).find(s => s.id === sectionId)
      ?? Object.values(get(cardSections)).flat().find(s => s.id === sectionId);
    const patched = patchSectionInDraft(currentHtml, section.name, result.html);
    const saved = await a.saveDraft(_projectId, rawId(typeId), patched);
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

// ── Card context accordion ─────────────────────────────────────────────────────

export const cardContextState = writable({});

export async function toggleCardContext(projectId, key) {
  const current = get(cardContextState)[key];
  if (current?.expanded) {
    cardContextState.update(s => ({ ...s, [key]: { ...s[key], expanded: false } }));
    return;
  }
  cardContextState.update(s => ({ ...s, [key]: { ...(s[key] ?? {}), expanded: true, loading: !s[key]?.loaded } }));
  if (current?.loaded) return;
  try {
    const data = key === 'stage1_review'
      ? await getStage1Context(projectId)
      : isAppeal(key)
        ? await appealGetDraftContext(projectId, rawId(key))
        : await getPaDraftContext(projectId, key);
    cardContextState.update(s => ({ ...s, [key]: {
      ...s[key],
      loading: false,
      loaded: true,
      guidingBrief: data.guidingBrief,
      projectBrief: data.projectBrief,
      toneExampleLoaded: data.toneExampleLoaded ?? null,
    }}));
  } catch {
    cardContextState.update(s => ({ ...s, [key]: { ...s[key], loading: false } }));
  }
}

// ── Appeal type broad prompt editing ──────────────────────────────────────────

export const appealPromptOpen = writable(false);
export const appealPromptTypeId = writable(null);   // the 'appeal_N' key
export const appealPromptText = writable('');
export const appealPromptLoading = writable(false);
export const appealPromptSaving = writable(false);
export const appealPromptSaved = writable(false);

export async function openAppealPrompt(typeId) {
  appealPromptTypeId.set(typeId);
  appealPromptOpen.set(true);
  appealPromptLoading.set(true);
  try {
    const data = await getAppealTypePrompt(rawId(typeId));
    appealPromptText.set(data.prompt);
  } catch (err) {
    console.error('Failed to load appeal type prompt:', err);
  } finally {
    appealPromptLoading.set(false);
  }
}

export function closeAppealPrompt() {
  appealPromptOpen.set(false);
}

export async function saveAppealPrompt() {
  const typeId = get(appealPromptTypeId);
  const text = get(appealPromptText);
  if (!text?.trim()) return;
  appealPromptSaving.set(true);
  try {
    await saveAppealTypePromptApi(rawId(typeId), text);
    appealPromptSaved.set(true);
    setTimeout(() => appealPromptSaved.set(false), 2500);
  } catch (err) {
    console.error('Failed to save appeal type prompt:', err);
  } finally {
    appealPromptSaving.set(false);
  }
}

export async function resetAppealPrompt() {
  const typeId = get(appealPromptTypeId);
  appealPromptSaving.set(true);
  try {
    const data = await resetAppealTypePromptApi(rawId(typeId));
    appealPromptText.set(data.prompt);
    appealPromptSaved.set(false);
  } catch (err) {
    console.error('Failed to reset appeal type prompt:', err);
  } finally {
    appealPromptSaving.set(false);
  }
}
