import { authFetch } from './client.js';

export async function getSlideshowTemplates() {
  const res = await authFetch('/api/slideshows/templates');
  if (!res.ok) throw new Error('Failed to load slideshow templates');
  return res.json(); // { templates: [{ id, label }], default }
}

// projectUniqueId = projects.unique_id (same key as the quote-request APIs)
export async function generateSlideshow(projectUniqueId, { sources, guidance, template }) {
  const res = await authFetch(`/api/slideshows/${projectUniqueId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources, guidance, template })
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to generate slideshow');
  }
  return res.json(); // { deck_title, slide_titles, filename, file_base64 }
}

// Triggers a browser download of a base64-encoded .pptx.
export function downloadPptx(filename, base64) {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
