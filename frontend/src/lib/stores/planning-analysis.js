import { writable, derived, get } from 'svelte/store';
import { analyseDocument, getPromptTemplate, savePromptTemplate, deletePromptTemplate } from '$lib/api/planningApplication.js';
import { appendToNote } from '$lib/stores/planning-notes.js';

// Upload / input state
export const activeInputTab = writable('upload');
export const selectedFile = writable(null);
export const documentType = writable('Officer Report');
export const documentDirection = writable('for');
export const userNotes = writable('');
export const selectedTrackIds = writable([]);
export const dragOver = writable(false);
export const pasteText = writable('');

// Analysis state: 'idle' | 'loading' | 'results'
export const analysisState = writable('idle');
export const analysisError = writable(null);
export const analysisSummary = writable('');
export const analysisCoverage = writable([]);
export const extractedPoints = writable([]);
export const acceptedPoints = writable([]);

export const activePoints = derived(extractedPoints, $pts => $pts.filter(p => !p.dismissed));

export const pointsByIssue = derived(activePoints, $pts => {
  const groups = {};
  for (const p of $pts) {
    const key = p.track_id ?? '__general__';
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  return groups;
});

// Prompt modal state
export const promptModalOpen = writable(false);
export const promptText = writable('');
export const promptLoading = writable(false);
export const promptSaving = writable(false);
export const promptSaved = writable(false);
export const promptIsCustom = writable(false);

let _projectId;

export function initAnalysis(projectId) {
  _projectId = projectId;
}

function buildPayload(extras = {}) {
  const tab = get(activeInputTab);
  return {
    documentType: get(documentType),
    documentDirection: get(documentDirection),
    userNotes: get(userNotes).trim() || null,
    relevantTrackIds: get(selectedTrackIds),
    ...(tab === 'upload' ? { file: get(selectedFile) } : { text: get(pasteText) }),
    ...extras
  };
}

export function onDrop(e) {
  e.preventDefault();
  dragOver.set(false);
  const file = e.dataTransfer.files[0];
  if (file) selectedFile.set(file);
}

export function onFileInputChange(e) {
  selectedFile.set(e.target.files[0] ?? null);
  e.target.value = '';
}

export function toggleTrack(id) {
  selectedTrackIds.update(ids =>
    ids.includes(id) ? ids.filter(t => t !== id) : [...ids, id]
  );
}

export function dismissPoint(idx) {
  extractedPoints.update(pts => pts.map((p, i) => i === idx ? { ...p, dismissed: true } : p));
}

export function acceptPoint(idx, keyIssues) {
  const points = get(extractedPoints);
  const point = points[idx];
  const trackId = point.track_id;
  const field = point.field;

  if (trackId !== null) {
    appendToNote(trackId, field, point.point);
  }
  const issueLabel = trackId !== null
    ? (keyIssues.find(i => String(i.id) === String(trackId))?.label ?? 'General')
    : 'General';
  acceptedPoints.update(pts => [...pts, { track_id: trackId, issue_label: issueLabel, field, point: point.point }]);
  extractedPoints.update(pts => pts.map((p, i) => i === idx ? { ...p, dismissed: true } : p));
}

export async function openPromptModal() {
  promptLoading.set(true);
  promptModalOpen.set(true);
  promptText.set('');
  promptSaved.set(false);
  try {
    const saved = await getPromptTemplate(_projectId);
    if (saved?.extract_points_template) {
      promptText.set(saved.extract_points_template);
      promptIsCustom.set(true);
    } else {
      const result = await analyseDocument(_projectId, buildPayload({ preview: true }));
      promptText.set(result.template);
      promptIsCustom.set(false);
    }
  } catch (err) {
    promptText.set(`Error loading prompt: ${err.message}`);
  } finally {
    promptLoading.set(false);
  }
}

export async function savePrompt() {
  promptSaving.set(true);
  try {
    await savePromptTemplate(_projectId, get(promptText));
    promptIsCustom.set(true);
    promptSaved.set(true);
    setTimeout(() => promptSaved.set(false), 2500);
  } catch (err) {
    console.error('Failed to save prompt:', err);
  } finally {
    promptSaving.set(false);
  }
}

export async function resetPromptToDefault() {
  promptLoading.set(true);
  try {
    await deletePromptTemplate(_projectId);
    const result = await analyseDocument(_projectId, buildPayload({ preview: true }));
    promptText.set(result.template);
    promptIsCustom.set(false);
  } catch (err) {
    console.error('Failed to reset prompt:', err);
  } finally {
    promptLoading.set(false);
  }
}

export async function runAnalysis(customPrompt = null) {
  analysisState.set('loading');
  analysisError.set(null);
  try {
    const payload = buildPayload(customPrompt ? { customPrompt } : {});
    const raw = await analyseDocument(_projectId, payload);
    const result = Array.isArray(raw) ? { summary: '', coverage: [], points: raw } : raw;
    analysisSummary.set(result.summary ?? '');
    analysisCoverage.set(result.coverage ?? []);
    extractedPoints.set((result.points ?? []).map(p => ({ ...p, dismissed: false })));
    console.log('Analysis result:', result);
    analysisState.set('results');
  } catch (err) {
    analysisError.set(err.message);
    analysisState.set('idle');
  }
}

export async function runAnalysisWithPrompt() {
  promptModalOpen.set(false);
  await runAnalysis(get(promptText));
}

export function resetAnalysis() {
  analysisState.set('idle');
  analysisSummary.set('');
  analysisCoverage.set([]);
  extractedPoints.set([]);
  acceptedPoints.set([]);
  selectedFile.set(null);
  pasteText.set('');
  userNotes.set('');
  selectedTrackIds.set([]);
  documentDirection.set('for');
  analysisError.set(null);
}
