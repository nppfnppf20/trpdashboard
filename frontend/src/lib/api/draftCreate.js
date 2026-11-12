import { authFetch } from '$lib/api/client.js';

export async function generateCustomDraft({ prompt, provider, use_house_style }) {
  const res = await authFetch('/api/draft-create/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, provider, use_house_style })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate document');
  }
  return res.json();
}

/**
 * One turn of the Create card conversation.
 * @param {number|string} projectId
 * @param {{
 *   messages: {role: 'user'|'assistant', content: string}[],
 *   sources?: object,            // same shape as Project Chat's sources
 *   docTypeId?: number|null,
 *   documentHtml?: string,       // the document as it is now
 *   selection?: {quoted_text: string}|null,
 *   imports?: {title: string, prompt: string}[],  // prompts that produced text imported into the document
 *   useHouseStyle?: boolean,
 * }} opts
 * @returns {Promise<{reply: string, mode: 'full'|'edits'|'none', html: string|null, edits: Array|null, context_chars: number}>}
 *   mode 'edits' -> apply with applyAiEditResult(html, { edits }, paragraphIds) from $lib/utils/documentEdits.js
 *   mode 'full'  -> html is the complete document
 */
export async function sendCreateChat(projectId, { messages, sources = {}, docTypeId = null, documentHtml = '', selection = null, imports = [], useHouseStyle = true }) {
  const res = await authFetch(`/api/draft-create/projects/${projectId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      sources,
      doc_type_id: docTypeId,
      document_html: documentHtml,
      selection,
      imports,
      use_house_style: useHouseStyle,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to get a response');
  }
  return res.json();
}
