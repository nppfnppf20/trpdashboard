import sanitizeHtml from 'sanitize-html';

// Rich-text fields (policy summaries, key points, implications) are stored and
// later rendered with {@html} on the frontend with no client-side sanitization,
// so untrusted markup must be stripped here before it ever reaches the database.
const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'span', 'h1', 'h2', 'h3', 'h4', 'a'];
const ALLOWED_ATTRIBUTES = { a: ['href'] };

export function sanitizeRichText(html) {
  if (html == null) return html;
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}
