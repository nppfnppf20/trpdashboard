/**
 * Parser Service
 * Handles file parsing (PDF + plain text) and text chunking for LLM ingestion.
 * Chunking targets ~1500 tokens (~6000 chars) with paragraph-boundary awareness
 * to avoid splitting mid-sentence, which degrades LLM analysis quality.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const CHUNK_CHAR_LIMIT = 6000;

/**
 * Parse an uploaded file buffer into plain text.
 * Tries pdf-parse first for PDFs, falls back to raw UTF-8 if it throws.
 * Returns { text, warning } where warning is non-null if the fallback was used.
 *
 * @param {Buffer} buffer
 * @param {string} originalname
 * @returns {Promise<{ text: string, warning: string|null }>}
 */
export async function parseFile(buffer, originalname) {
  const ext = originalname.split('.').pop().toLowerCase();

  if (ext === 'pdf') {
    try {
      const result = await pdfParse(buffer);
      return { text: result.text, warning: null };
    } catch (err) {
      // pdf-parse can fail on scanned/encrypted PDFs — fall back rather than blocking ingestion
      const fallback = buffer.toString('utf8');
      return {
        text: fallback,
        warning: `pdf-parse failed (${err.message}); content read as raw UTF-8 — accuracy may be reduced`
      };
    }
  }

  // .txt and .md — just decode
  return { text: buffer.toString('utf8'), warning: null };
}

/**
 * Split text into chunks that fit within the LLM context window.
 * Splits on paragraph boundaries (\n\n) rather than hard char cuts
 * to preserve sentence integrity within each chunk.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function chunkText(text) {
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;

    if (candidate.length > CHUNK_CHAR_LIMIT && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter(c => c.length > 0);
}
