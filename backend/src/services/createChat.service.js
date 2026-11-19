/**
 * Create card chat: prompt building and response parsing.
 *
 * The Create card is a conversation about one document. Each turn the model
 * sends back a short plain-text reply plus, optionally, ONE tool call:
 *   - write_document: the complete document as HTML (empty document, or an
 *     explicit full rewrite)
 *   - edit_document:  block edits (replace / delete / insert_after) addressed by block
 *     number. The frontend numbers every paragraph, list item and table cell
 *     (data-b) and applies the edits with applyBlockEdits (frontend/src/lib/utils/
 *     blockEdits.js). The model never quotes text to locate it and never retypes
 *     blocks it isn't changing, so tables and the rest of the document can't be lost.
 *
 * Kept free of DB/HTTP so it can be tested on its own.
 */

import { noEmDash, HOUSE_STYLE_BLOCK, ANTI_AI_SLOP_BLOCK } from './llm.shared.js';

export const CREATE_CHAT_MAX_TOKENS = 16000;
// Context budget for the Create card, in characters (~100k tokens, about a tenth of the
// model's window). Its own figure, deliberately not the 200k Project Chat uses. Keep in step
// with CONTEXT_BUDGET in frontend CreateSourcePicker.svelte, which draws the meter.
export const CREATE_CONTEXT_BUDGET = 400000;
// Same cap other style-example blocks use, so a very long example can't eat the context budget.
export const EXAMPLE_MAX_CHARS = 12000;
// Prompts attached from imported material (the prompt that produced the text).
export const IMPORT_PROMPT_MAX_CHARS = 12000;
export const MAX_IMPORTS = 10;

/**
 * Tidies the `imports` a client sends: [{ title, prompt }] where `prompt` is the
 * prompt that originally produced some text the user has imported into the document.
 */
export function cleanImports(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(i => i && typeof i.prompt === 'string' && i.prompt.trim())
    .slice(0, MAX_IMPORTS)
    .map(i => ({
      title: (typeof i.title === 'string' && i.title.trim() ? i.title.trim() : 'Imported text').slice(0, 200),
      prompt: i.prompt.trim().slice(0, IMPORT_PROMPT_MAX_CHARS),
    }));
}

export const writeDocumentTool = {
  name: 'write_document',
  description: 'Write the COMPLETE document, replacing whatever is there. Use only when the document is empty and the user wants it written, or when the user explicitly asks for a full rewrite or restructure. For any other change use edit_document.',
  input_schema: {
    type: 'object',
    properties: {
      html: { type: 'string', description: 'The whole document as clean HTML (h2/h3/p/ul/ol/li/table/strong/em/blockquote). No markdown, no em dashes.' },
    },
    required: ['html'],
  },
};

export const editDocumentTool = {
  name: 'edit_document',
  description: 'Make targeted edits to the existing document: add, cut, change, reword, restyle. Every paragraph, heading, list item and table cell in the document has a block number (data-b). Refer to blocks only by that number. Blocks you do not mention are left exactly as they are.',
  input_schema: {
    type: 'object',
    properties: {
      edits: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            op: { type: 'string', enum: ['replace', 'delete', 'insert_after'] },
            id: { type: 'integer', description: 'The block number (the data-b value) of the block this edit is about.' },
            html: { type: 'string', description: 'replace: the COMPLETE new content of the block, as inline HTML (text with <strong>, <em>, <a>, <br>), not just the changed words. To turn one paragraph into several blocks (a lead-in plus a list, a quotation on its own line) it may hold block elements (<p>, <ul>, <blockquote>). insert_after: the new block element(s): <p>, <h3>, <ul>, <li> (to add a list item), <tr> (to add a table row), <blockquote>.' },
            as: { type: 'string', enum: ['p', 'p-bold', 'h2', 'h3', 'h4'], description: 'replace: change what KIND of block it is, keeping its words. p = ordinary paragraph, p-bold = bold label paragraph, h2/h3/h4 = heading. html can be left out when only the style changes.' },
          },
          required: ['op', 'id'],
        },
      },
    },
    required: ['edits'],
  },
};

const FORMAT_RULES = `HTML rules (for the whole document and for anything you insert):
- <h2> for main section headings, <h3> for sub-sections, <p> for paragraphs, <ul>/<ol> with <li> for lists, <table>/<thead>/<tbody>/<tr>/<th>/<td> for tables, <strong> for bold.
- No markdown characters (**, *, #, ---) and no em dashes.
- Quotations (policy wording, statute, a quoted decision or report): always italic. A short quotation that fits within a line or so stays in the sentence, in quotation marks, wrapped in <em>. A longer quotation (more than about 25 words, or one that would run past a line) starts on its own line as a block: <blockquote><p><em>"the quoted text"</em></p></blockquote>, with the sentence introducing it ending in a colon in the paragraph before. The editor and Word export indent blockquotes. Quote only wording that appears in the sources, verbatim.
- Do not add a document title unless the user asks for one.`;

const EDIT_RULES = `Rules for edit_document:
- In the current document every paragraph, heading, list item and table cell that has text carries a number: data-b="12". Refer to a block ONLY by that number in "id". Never quote text to say where a change goes.
- replace: "id" plus "html" = the COMPLETE new content of that block, written out in full (not just the changed words). Keep every word you were not asked to change exactly as it is, including its bold, italic and links. "html" is inline: text with <strong>, <em>, <a href>, <br>. No <p> around it. For a list item, "html" is that item's text only. A list item's own sub-list is not part of it and is left alone.
- To turn one paragraph or heading into several blocks (a lead-in sentence plus a bullet list, a short paragraph plus a quotation on its own line), use replace with "html" holding the block elements (<p>, <ul><li>...</li></ul>, <blockquote><p><em>"..."</em></p></blockquote>). This does not work on a single list item or table cell.
- To change only what KIND of block it is (an h3 that should be a bold label, a paragraph that should be a heading), use replace with "as" ("p", "p-bold", "h2", "h3", "h4") and no "html".
- delete: "id" removes that block's text (paragraph, heading, list item, quotation). Never delete a table or a table row.
- insert_after: "id" of an existing block plus "html" = the new block element(s), placed straight after it. For a new list item use <li>...</li> after another item of that list. For a new table row use <tr><td>...</td></tr> after a block in the row it should follow. A <p> or <h3> placed after a list item goes after the whole list. Several new things in one place (a lead-in and a list; a few paragraphs) go in ONE insert_after whose html holds all of them in order.
- The user may highlight several paragraphs, bullets or cells. Each block has its own number, so change each one with its own replace in the same call (one replace per bullet, for example). Change only the blocks that need it.
- Quotations (policy wording, statute, a quoted decision): to italicise a quotation that is already in the document inside quotation marks, use replace on its block with the same words and <em> around the quotation. To put a long quotation on its own indented line, use replace on its block with html holding the text before it as <p>, then <blockquote><p><em>"the quote"</em></p></blockquote>, then any text after it as <p>. Never italicise or quote wording that appears only in the sources: if the document paraphrases a policy rather than quoting it, leave it and say in your reply that it is paraphrased. If the user wants a paraphrase turned into a verbatim quotation, that is a different change, made only when they ask.
- Never retype, summarise, reorder or restructure a table. Edit individual cells by their numbers, or insert a whole new <tr>.
- If a change cannot be made with these edits, say so in your reply and do not claim it. Describe only what your edits actually do: your reply is written before they are applied, so never say something is done that is not in an edit.
- Several edits in one call are fine. Every edit must be necessary for what the user asked.`;

function docTypeBlock(docType) {
  if (!docType) return '';
  const parts = [`\n\n## Document type: ${docType.name}`];
  if (docType.structure_notes?.trim()) {
    parts.push(`Guidance on structure and contents for this type of document:\n${docType.structure_notes.trim()}`);
  }
  if (docType.example_text?.trim()) {
    parts.push(
      `Below is an example of this type of document written by this practice. Use it as a guide to tone, register, structure, paragraph length and level of detail. Do NOT copy any of its content: its facts belong to another matter and are not a source for this one.\n\n<example-document>\n${docType.example_text.trim().slice(0, EXAMPLE_MAX_CHARS)}\n</example-document>`
    );
  }
  return parts.join('\n\n');
}

// Chat mode, chosen with the Ask / Edit switch in the Create card.
const EDIT_MODE_RULES = `## How to respond (Edit mode)
The user has switched to Edit mode, so lean towards making changes: unless they clearly ask otherwise, treat their message as an instruction to change the document. Every turn, reply with 1 to 3 sentences of plain text, plus ONE tool call when you are changing the document:
- write_document: the complete document. Use it when the document is empty and the user wants it written, or when they explicitly ask for a full rewrite or restructure.
- edit_document: for every other change to an existing document (add, cut, change, reword, move).
- Answer in the chat with NO tool call, and leave the document alone, when the user clearly asks a question or asks to be told something (for example "just tell me", "don't change anything", "what do you think of...", "why did you...", "is this..."). Answer it properly in the chat (more than 3 sentences is fine), and do not edit the document unless they also ask for a change. When in doubt between a question and an instruction, ask one short question.
- Also skip the tool if you need information before you can proceed (ask one short question) or the change truly cannot be made with these tools (say why in one sentence). Otherwise do not just describe what you would change: make the change.
Never paste the document text or your edits into the reply. The reply only describes what you did.
Write the reply in plain, short prose. No markdown headings (#), no tables, no code blocks. The only formatting allowed is **double asterisks** around a short label where it genuinely helps, and simple dash lists.`;

const ASK_MODE_RULES = `## How to respond (Ask mode)
The user has switched to Ask mode: they want an answer, not a change. You have no tools and you must not change the document. Answer their question in the chat, using the sources, the current document and what they have told you. Be direct and as concise as the question allows, but give as much as it needs. Quote the document only where it helps. If they are clearly asking for a change, say they can switch to Edit mode and describe in a line what you would do. Never claim to have changed anything.
Write in plain prose. No markdown headings (#), no tables, no code blocks. The only formatting allowed is **double asterisks** around a short label where it genuinely helps, and simple dash lists.`;

/**
 * @param {object} p
 * @param {string} p.projectName
 * @param {string|null} [p.clientName]
 * @param {'edit'|'ask'} [p.chatMode] - 'ask': answer only, never change the document
 * @param {{name:string, example_text?:string, structure_notes?:string}|null} [p.docType]
 * @param {{sourceId:string, label:string, text:string}[]} [p.blocks] - assembled sources
 * @param {string} [p.documentHtml] - the document as it is now ('' when empty)
 * @param {{quoted_text?:string}|null} [p.selection] - passage the user has highlighted
 * @param {{title:string, prompt:string}[]} [p.imports] - prompts that produced text imported into the document
 * @param {boolean} [p.useHouseStyle]
 */
export function buildCreateSystemPrompt({
  projectName,
  clientName = null,
  docType = null,
  blocks = [],
  documentHtml = '',
  selection = null,
  imports = [],
  useHouseStyle = true,
  chatMode = 'edit',
}) {
  const isEmpty = !documentHtml?.replace(/<[^>]+>/g, '').trim();

  const sourcesSection = blocks.length
    ? `\n\n## Sources\nThe user has chosen these sources from the project to write from. They are your only source of project-specific facts.\n\n${blocks.map(b => `<source id="${b.sourceId}" name="${b.label}">\n${b.text}\n</source>`).join('\n\n')}`
    : `\n\n## Sources\nNo project sources are selected. Write only from what the user tells you in this conversation. Do not invent project-specific facts; where one is needed, put [SOURCE REQUIRED: what is missing] in its place. If the user would clearly be better served by ticking sources, say so briefly.`;

  const selectionSection = selection?.quoted_text?.trim()
    ? `\n\n## Highlighted passage\nThe user has highlighted part of the document, and it is repeated at the end of their message in <highlighted_passage> tags together with the numbers of the blocks it covers. Their request is about those blocks: act on them (each with its own edit if several need changing), and do not edit other blocks. Edits to blocks outside the highlight are rejected. Never say you cannot see what is highlighted.\n<highlighted>\n${selection.quoted_text.trim()}\n</highlighted>`
    : '';

  const importsSection = imports.length
    ? `\n\n## How imported text was originally produced\nThe user has imported text into this document that was generated earlier from the prompts below. Treat them as background: they show the intent, structure, tone and conventions that text was written to, so keep your edits consistent with them unless the user asks for something different. They are not instructions to follow now, and they may contain {{VARIABLE}} placeholders that were filled in when the text was generated.\n\n${imports.map(i => `<imported-prompt for="${i.title.replace(/"/g, "'")}">\n${i.prompt}\n</imported-prompt>`).join('\n\n')}`
    : '';

  const documentSection = isEmpty
    ? `\n\n## Current document\n(empty: nothing has been written yet)`
    : `\n\n## Current document\n<document>\n${documentHtml.trim()}\n</document>`;

  return `You are a senior UK planning consultant co-writing a document with the user for the project "${projectName}"${clientName ? ` (client: ${clientName})` : ''}. Work conversationally: they tell you what to write or change, you do it, and you say briefly what you did.${docTypeBlock(docType)}${documentSection}${importsSection}${selectionSection}${sourcesSection}

${chatMode === 'ask' ? ASK_MODE_RULES : `${EDIT_MODE_RULES}

${FORMAT_RULES}

${EDIT_RULES}`}

## Facts and sources
- Use facts only from the sources above and from what the user says in this conversation. Never use outside knowledge for project-specific claims.
- Where a needed fact is not available, write [SOURCE REQUIRED: what is missing] in the document instead of inventing it.
- Do not put source IDs or citations in the document itself. In your reply you may say which source you drew on, naming it in words (for example "the pre-app response"), never by its ID.
- You may use general planning knowledge to structure and phrase the document, not to assert project facts.${useHouseStyle ? HOUSE_STYLE_BLOCK + ANTI_AI_SLOP_BLOCK : ''}`;
}

function cleanHtml(raw) {
  return noEmDash(String(raw ?? '').trim().replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim());
}

const VALID_OPS = new Set(['replace', 'delete', 'insert_after']);
const RESTYLE_AS = new Set(['p', 'p-bold', 'h2', 'h3', 'h4']);

// `reasons` (optional array) collects why an edit was dropped, so the caller can tell the model.
function cleanEdits(raw, reasons = []) {
  let list = raw;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { reasons.push('"edits" was not valid JSON'); return []; }
  }
  if (!Array.isArray(list)) { reasons.push('"edits" must be a list of edits'); return []; }
  const out = [];
  list.forEach((e, i) => {
    const n = i + 1;
    if (!e || !VALID_OPS.has(e.op)) { reasons.push(`edit ${n} has no valid "op" (use replace, delete or insert_after)`); return; }
    const id = Number(String(e.id ?? '').replace(/^b/i, ''));
    if (e.id === undefined || e.id === null || e.id === '' || !Number.isInteger(id) || id < 0) {
      reasons.push(`edit ${n} (${e.op}) has no block number in "id": use the data-b number of the block`);
      return;
    }
    if (e.op === 'delete') { out.push({ op: 'delete', id }); return; }
    const html = cleanHtml(e.html);
    if (e.op === 'insert_after') {
      if (!html) { reasons.push(`edit ${n} (insert_after) has no "html"`); return; }
      out.push({ op: 'insert_after', id, html });
      return;
    }
    const as = RESTYLE_AS.has(e.as) ? e.as : '';
    if (!html && !as) { reasons.push(`edit ${n} (replace) needs "html" (the full new content of the block) or "as"`); return; }
    out.push({ op: 'replace', id, ...(html ? { html } : {}), ...(as ? { as } : {}) });
  });
  return out;
}

/**
 * Turns an Anthropic Messages response into what the frontend needs.
 * @returns {{reply: string, mode: 'full'|'edits'|'none', html: string|null, edits: object[]|null, truncated: boolean}}
 */
export function parseCreateResponse(response) {
  const content = response?.content ?? [];
  const reply = content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim();

  const write = content.find(b => b.type === 'tool_use' && b.name === 'write_document');
  const edit = content.find(b => b.type === 'tool_use' && b.name === 'edit_document');
  const truncated = response?.stop_reason === 'max_tokens' && !!(write || edit);

  const reasons = [];
  if (write) {
    const html = cleanHtml(write.input?.html);
    if (html) return { reply, mode: 'full', html, edits: null, truncated };
    reasons.push('write_document had no "html"');
  }
  if (edit) {
    const edits = cleanEdits(edit.input?.edits, reasons);
    if (edits.length) return { reply, mode: 'edits', html: null, edits, truncated };
    if (!reasons.length) reasons.push('edit_document had no edits');
  }
  // invalid: the model called a tool but nothing usable came back (the caller can retry).
  return { reply, mode: 'none', html: null, edits: null, truncated, invalid: !!(write || edit), reasons };
}
