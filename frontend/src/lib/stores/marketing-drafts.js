import { writable, get } from 'svelte/store';
import {
  getMarketingDraftTypes,
  getMarketingDraft,
  saveMarketingDraft,
  generateMarketingDraft,
} from '$lib/api/marketing.js';

let _editor;

export function setMarketingEditor(editor) {
  _editor = editor;
}

export const draftTypes      = writable([]);
export const drafts          = writable({});
export const draftGenerating = writable(null);
export const activeDraftTypeId = writable(null);
export const draftEditorHtml   = writable('');
export const draftSaving     = writable(false);
export const draftSaved      = writable(false);

export async function loadDraftTypes() {
  const types = await getMarketingDraftTypes();
  draftTypes.set(types);
  const results = await Promise.allSettled(types.map(t => getMarketingDraft(t.id)));
  const map = {};
  types.forEach((t, i) => {
    const r = results[i];
    if (r.status === 'fulfilled' && r.value) map[t.id] = r.value;
  });
  drafts.set(map);
}

export function openDraft(typeId) {
  const draft = get(drafts)[typeId];
  activeDraftTypeId.set(typeId);
  draftEditorHtml.set(draft?.content_html ?? '');
  draftSaved.set(true);
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
    const saved = await saveMarketingDraft(typeId, get(draftEditorHtml));
    drafts.update(d => ({ ...d, [typeId]: saved }));
    draftSaved.set(true);
  } catch (err) {
    console.error('[marketing] handleSaveDraft error:', err);
  } finally {
    draftSaving.set(false);
  }
}

export async function handleGenerate(typeId, opts = {}) {
  draftGenerating.set(typeId);
  try {
    const result = await generateMarketingDraft(typeId, opts);
    drafts.update(d => ({ ...d, [typeId]: result }));
    if (get(activeDraftTypeId) === typeId) {
      draftEditorHtml.set(result.content_html ?? '');
      _editor?.setHTML(result.content_html ?? '');
      draftSaved.set(true);
    }
  } catch (err) {
    console.error('[marketing] handleGenerate error:', err);
    alert('Generation failed: ' + err.message);
  } finally {
    draftGenerating.set(null);
  }
}
