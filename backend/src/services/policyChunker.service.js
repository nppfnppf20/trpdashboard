/**
 * Policy Chunker Service
 * Turns an uploaded policy document (PDF or Word) into structure-based chunks for
 * the company policy library: one chunk per section/clause, never split mid-clause
 * unless a section is very long. Pure functions — no DB or network — so it can be
 * tested on its own. See docs/plans/POLICY_RAG_IMPLEMENTATION_PLAN.md (Phase 2).
 *
 *   extractBlocks(buffer, ext)  -> { blocks, warning }   text with page numbers, headers/footers/contents removed
 *   chunkBlocks(blocks, opts)   -> chunk[]                section-based chunks with section_path / ref / pages
 *
 * A block is { type: 'heading' | 'para', text, page, level?, ref? }.
 */

import { createRequire } from 'module';
import mammoth from 'mammoth';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// ~4 characters per token is close enough for budgeting chunk size.
const CHARS_PER_TOKEN = 4;
export const MAX_CHUNK_TOKENS = 700;
export const estimateTokens = (text) => Math.ceil(text.length / CHARS_PER_TOKEN);

const BULLET_RE = /^([•▪●○◦‣·\-–—*]|\(?\d+[.)]|\(?[a-z][.)])\s+/;
const HEADING_RE = /^(\d+(?:\.\d+)*)\.?\s+([A-Z][^]*)$/;
const CONTENTS_RE = /^(table of )?contents$/i;

// ─── Extraction ──────────────────────────────────────────────────────────────

/**
 * @param {Buffer} buffer
 * @param {'pdf'|'docx'} ext
 * @returns {Promise<{ blocks: object[], warning: string|null }>}
 */
export async function extractBlocks(buffer, ext) {
  if (ext === 'pdf') return extractPdf(buffer);
  if (ext === 'docx') return extractDocx(buffer);
  throw new Error(`Unsupported file type: ${ext}`);
}

async function extractPdf(buffer) {
  const pages = [];
  await pdfParse(buffer, {
    // Keep one entry per page, with a line break wherever the text moves to a new line.
    pagerender: async (pageData) => {
      const content = await pageData.getTextContent();
      let lastY;
      let text = '';
      for (const item of content.items) {
        if (lastY !== undefined && Math.abs(lastY - item.transform[5]) > 1) text += '\n';
        text += item.str;
        lastY = item.transform[5];
      }
      pages.push(text);
      return text;
    },
  });

  const pageLines = pages.map((text) => text.split('\n').map(normaliseLine));
  const withoutBoilerplate = stripRepeatedHeaderFooter(pageLines);

  const blocks = [];
  withoutBoilerplate.forEach((lines, i) => {
    if (isContentsPage(lines)) return;
    blocks.push(...linesToBlocks(lines, i + 1));
  });

  const totalChars = blocks.reduce((n, b) => n + b.text.length, 0);
  if (totalChars < 200) {
    return {
      blocks: [],
      warning: 'No selectable text found. This looks like a scanned PDF, which needs OCR before it can be indexed.',
    };
  }
  return { blocks: markHeadings(blocks), warning: null };
}

async function extractDocx(buffer) {
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const blocks = [];
  const re = /<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\1>|<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[3] !== undefined) {
      const cells = [...m[3].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => htmlToText(c[1]));
      const row = cells.filter(Boolean).join(' | ');
      if (row) blocks.push({ type: 'para', text: row, page: null });
      continue;
    }
    const text = htmlToText(m[2]);
    if (!text) continue;
    if (m[1][0] === 'h') {
      blocks.push({ type: 'heading', text, page: null, level: Number(m[1][1]), ref: headingRef(text) });
    } else if (m[1] === 'li') {
      blocks.push({ type: 'para', text: `• ${text}`, page: null });
    } else {
      blocks.push({ type: 'para', text, page: null });
    }
  }
  if (!blocks.length) {
    return { blocks: [], warning: 'The Word document contained no readable text.' };
  }
  // Word styles aren't always used for headings, so numbered lines are promoted as well.
  return { blocks: markHeadings(blocks), warning: null };
}

function htmlToText(html) {
  return normaliseLine(
    html
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
  );
}

// Justified text leaves runs of spaces; non-breaking spaces and stray control chars come from some generators.
function normaliseLine(line) {
  // eslint-disable-next-line no-control-regex
  return line.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[ \s]+/g, ' ').trim();
}

// Lines that repeat on at least half the pages (running header/footer, page numbers) are dropped.
// Digits are masked first so "1 Internal Company Policy Only" and "2 Internal..." match.
function stripRepeatedHeaderFooter(pageLines) {
  const mask = (l) => l.replace(/\d+/g, '#').toLowerCase();
  const nonEmptyIdx = (lines) => lines.map((l, i) => (l ? i : -1)).filter((i) => i >= 0);
  const candidatesOf = (lines) => {
    const idx = nonEmptyIdx(lines);
    return [...idx.slice(0, 4), ...idx.slice(-3)];
  };

  const seen = new Map();
  for (const lines of pageLines) {
    const onThisPage = new Set(candidatesOf(lines).map((i) => mask(lines[i])));
    for (const key of onThisPage) seen.set(key, (seen.get(key) || 0) + 1);
  }
  const minPages = Math.max(2, Math.ceil(pageLines.length / 2));
  const boilerplate = new Set([...seen].filter(([key, n]) => n >= minPages).map(([key]) => key));

  return pageLines.map((lines) => {
    const candidates = new Set(candidatesOf(lines));
    return lines.map((l, i) => {
      if (!l) return l;
      if (candidates.has(i) && (boilerplate.has(mask(l)) || /^(page\s+)?\d+(\s*(of|\/)\s*\d+)?$/i.test(l))) return '';
      return l;
    });
  });
}

function isContentsPage(lines) {
  const first = lines.find(Boolean);
  return !!first && CONTENTS_RE.test(first);
}

// Wrapped lines are joined into paragraphs; blank lines, bullets and numbered headings start a new one.
function linesToBlocks(lines, page) {
  const blocks = [];
  let current = null;
  const flush = () => {
    if (current) blocks.push({ type: 'para', text: current, page });
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      flush();
      continue;
    }
    if (looksLikeHeading(line)) {
      flush();
      let text = line;
      // A long heading wraps onto the next line: "7. Procedure for dealing with ... short term" / "absence".
      const next = lines[i + 1];
      if (next && !lines[i + 2] && text.length > 60 && /^[a-z]/.test(next) && next.length <= 60) {
        text = `${text} ${next}`;
        i++;
      }
      blocks.push({ type: 'para', text, page, _headingCandidate: true });
      continue;
    }
    if (BULLET_RE.test(line)) {
      flush();
      current = line;
      continue;
    }
    current = current ? `${current} ${line}` : line;
  }
  flush();
  return blocks;
}

function looksLikeHeading(line) {
  const m = HEADING_RE.exec(line);
  if (!m) return false;
  // A heading is short and doesn't read like a sentence: "3. Policy elements", not "3. The policy applies to all staff."
  if (line.length > 140 || /[.!?;:]$/.test(line)) return false;
  return true;
}

function headingRef(text) {
  const m = /^(\d+(?:\.\d+)*)\.?\s/.exec(text);
  return m ? m[1] : null;
}

// Promote heading candidates (and ALL CAPS short lines when the document has no numbered headings).
function markHeadings(blocks) {
  const numbered = blocks.some((b) => b._headingCandidate || b.type === 'heading');
  return blocks.map((b) => {
    if (b.type === 'heading') return b;
    if (b._headingCandidate) {
      const ref = headingRef(b.text);
      const { _headingCandidate, ...rest } = b;
      return { ...rest, type: 'heading', ref, level: ref ? ref.split('.').length : 1 };
    }
    if (!numbered && isAllCapsHeading(b.text)) return { ...b, type: 'heading', ref: null, level: 1 };
    return b;
  });
}

function isAllCapsHeading(text) {
  return text.length >= 4 && text.length <= 80 && /[A-Z]/.test(text) && text === text.toUpperCase() && !/[.!?]$/.test(text);
}

// ─── Chunking ────────────────────────────────────────────────────────────────

/**
 * @param {object[]} blocks
 * @param {{ maxTokens?: number }} [opts]
 * @returns {{ chunk_index:number, section_path:string, section_ref:string|null, page_start:number|null,
 *            page_end:number|null, content:string, token_count:number, part:number, parts:number }[]}
 */
export function chunkBlocks(blocks, { maxTokens = MAX_CHUNK_TOKENS } = {}) {
  const sections = [];
  const stack = []; // headings currently open, shallowest first
  let current = { path: 'Document information', ref: null, paras: [] };
  sections.push(current);

  for (const block of blocks) {
    if (block.type === 'heading') {
      // Depth comes from the heading's own level, not from whether its number "fits" its parent —
      // real policies have slips like sub-section 6.1 sitting under section 7.
      while (stack.length && stack[stack.length - 1].level >= block.level) stack.pop();
      stack.push({ level: block.level, text: block.text });
      current = { path: stack.map((h) => h.text).join(' > '), ref: block.ref, paras: [], page: block.page };
      sections.push(current);
    } else {
      current.paras.push(block);
    }
  }

  const chunks = [];
  for (const section of sections) {
    if (!section.paras.length) continue; // heading with only sub-headings under it
    const pieces = splitSection(section.paras, maxTokens);
    for (const [i, piece] of pieces.entries()) {
      const pages = piece.map((p) => p.page).filter((p) => p != null);
      chunks.push({
        chunk_index: chunks.length,
        section_path: section.path,
        section_ref: section.ref,
        page_start: pages.length ? Math.min(...pages) : null,
        page_end: pages.length ? Math.max(...pages) : null,
        content: piece.map((p) => p.text).join('\n\n'),
        token_count: estimateTokens(piece.map((p) => p.text).join('\n\n')),
        part: i + 1,
        parts: pieces.length,
      });
    }
  }
  return chunks;
}

// Keeps a section whole where possible; otherwise breaks it between paragraphs.
function splitSection(paras, maxTokens) {
  const pieces = [];
  let piece = [];
  let tokens = 0;
  for (const para of paras) {
    const t = estimateTokens(para.text);
    if (piece.length && tokens + t > maxTokens) {
      pieces.push(piece);
      piece = [];
      tokens = 0;
    }
    piece.push(para);
    tokens += t;
  }
  if (piece.length) pieces.push(piece);
  return pieces;
}

/**
 * Text that is embedded for a chunk: the document and section context goes in front of the
 * body so a clause like "within 3 days" still carries what it is about.
 */
export function embeddingText({ docTitle, version, chunk }) {
  const part = chunk.parts > 1 ? ` (part ${chunk.part} of ${chunk.parts})` : '';
  return `${docTitle} (v${version}) > ${chunk.section_path}${part}\n${chunk.content}`;
}
