import { authFetch } from '$lib/api/client.js';

const BASE = '/api/planning-application';

export async function sendSectionChatMessage({ projectId, docTypeSlug, messages, paragraphs, docText, docTitle }) {
  const res = await authFetch(`${BASE}/projects/${projectId}/section-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doc_type_slug: docTypeSlug || 'planning_statement',
      messages,
      paragraphs,
      doc_text: docText || null,
      doc_title: docTitle || null,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { reply, section_html }
}

export async function parseSectionChatDoc(projectId, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await authFetch(`${BASE}/projects/${projectId}/section-chat/parse-doc`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { text, warning }
}
