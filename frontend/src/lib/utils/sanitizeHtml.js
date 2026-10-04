/**
 * HTML sanitizer for anything that is rendered with {@html ...} or assigned to
 * .innerHTML. Much of our stored HTML (meeting-note summaries, planning
 * deliverables, briefings) is produced by an LLM from uploaded documents or
 * typed into a rich-text editor, so it must be treated as untrusted.
 *
 * Keeps ordinary formatting (headings, lists, tables, inline styles, classes,
 * links); removes scripts, event-handler attributes, javascript: URLs, etc.
 */

import DOMPurify from 'dompurify';

let configured = false;

function configure() {
  if (configured) return;
  configured = true;

  // Links opened in a new tab must not get access to window.opener.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('target')) {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

/**
 * @param {string | null | undefined} html
 * @returns {string} safe HTML
 */
export function sanitizeHtml(html) {
  if (html == null || html === '') return '';
  const dirty = String(html);

  // During server-side rendering there is no DOM for DOMPurify to work with.
  // Fall back to stripping every tag — safe, and these views are normally
  // populated client-side after data loads anyway.
  if (typeof window === 'undefined' || !DOMPurify.isSupported) {
    return dirty.replace(/<[^>]*>/g, '');
  }

  configure();
  return DOMPurify.sanitize(dirty, {
    ADD_ATTR: ['target', 'contenteditable'],
  });
}
