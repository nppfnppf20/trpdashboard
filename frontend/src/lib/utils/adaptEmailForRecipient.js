const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeHtml = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const firstName = (name) => (name ?? '').trim().split(/\s+/)[0] || '';

// Replaces every occurrence of one string with another, matching it as written or HTML-escaped ("A & B" / "A &amp; B")
function swapAll(html, oldText, newText) {
  if (!oldText || !newText || oldText === newText) return html;
  let out = html;
  for (const [o, n] of [[escapeHtml(oldText), escapeHtml(newText)], [oldText, newText]]) {
    out = out.replace(new RegExp(escapeRegExp(o), 'g'), () => n);
  }
  return out;
}

/**
 * Copies an edited briefing email to another recipient: swaps the first recipient's organisation
 * name and greeting name for the second's, leaving everything else as edited.
 *
 * @param {string} html - the edited email (HTML) written for `from`
 * @param {{ surveyorOrganisation?: string, contactName?: string }} from
 * @param {{ surveyorOrganisation?: string, contactName?: string }} to
 * @returns {string}
 */
export function adaptEmailForRecipient(html, from, to) {
  if (!html) return html;

  // Organisation name wherever it appears ("Dear Acme Heritage," / "...from Acme Heritage")
  let out = swapAll(html, from.surveyorOrganisation, to.surveyorOrganisation);

  // First name in the greeting ("Hi Sam,") - only the opening paragraph, so a name used elsewhere is left alone
  const oldFirst = firstName(from.contactName);
  const newFirst = firstName(to.contactName);
  if (oldFirst && newFirst && oldFirst !== newFirst) {
    out = out.replace(/<p[^>]*>[\s\S]*?<\/p>/, (firstParagraph) => swapAll(firstParagraph, oldFirst, newFirst));
  }
  return out;
}
