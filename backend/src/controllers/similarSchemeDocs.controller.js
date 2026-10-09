/**
 * Documents uploaded against saved Similar Schemes (decision notices, officer reports, consultee responses):
 * upload with an AI-suggested type, list, read the text, confirm or change the type, delete, and chat over them.
 */

import { pool } from '../db.js';
import { parseFile } from '../services/parser.service.js';
import { callClaude, parseJSON, MODEL_FAST } from '../services/llm.shared.js';
import { chatAboutSchemeDocuments, lensSchemeDocuments } from '../services/similarSchemeChat.service.js';

const DOC_TYPES = ['decision_notice', 'officer_report', 'consultee', 'other'];
const MAX_STORED_CHARS = 1_000_000; // about 250k tokens: the biggest single document we will keep
const META_COLUMNS = 'id, planit_name, filename, doc_type, type_confirmed, char_count, parse_warning, created_at';

function fail(res, err, fallback) {
  const status = err.status && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error(`[similar-schemes] ${fallback}:`, err);
  const credit = /credit balance/i.test(err.message);
  res.status(credit ? 503 : status).json({ error: credit ? 'The AI provider is out of credit. Top up the Anthropic balance and try again.' : status >= 500 ? fallback : err.message });
}

/** Cheap guess from the filename, used if the AI call fails. */
function guessFromFilename(filename) {
  const f = filename.toLowerCase();
  if (/decision|notice|refusal|grant/.test(f)) return 'decision_notice';
  if (/officer|delegated|committee|report/.test(f)) return 'officer_report';
  if (/consult|response|comment|objection|natural.?england|highway|environment.?agency|historic|conservation/.test(f)) return 'consultee';
  return 'other';
}

async function suggestDocType(filename, text) {
  try {
    const out = parseJSON(
      await callClaude(
        'You classify documents from UK planning applications. Reply ONLY with JSON: {"type": "decision_notice" | "officer_report" | "consultee" | "other"}. decision_notice = the council\'s formal notice granting or refusing permission, with its reasons or conditions. officer_report = the case officer\'s delegated report or committee report assessing the proposal. consultee = a response or comment from a statutory or non-statutory consultee, or a member of the public. other = anything else.',
        `FILENAME: ${filename}\n\nSTART OF DOCUMENT:\n${text.slice(0, 3000)}`,
        MODEL_FAST,
        60
      )
    );
    return DOC_TYPES.includes(out.type) ? out.type : guessFromFilename(filename);
  } catch (err) {
    if (/credit balance/i.test(err.message)) throw err;
    console.warn('[similar-schemes] type suggestion failed:', err.message);
    return guessFromFilename(filename);
  }
}

export async function listDocuments(req, res) {
  try {
    const { rows } = await pool.query(`SELECT ${META_COLUMNS} FROM similar_scheme_documents WHERE project_id = $1 ORDER BY created_at, id`, [Number(req.params.projectId)]);
    res.json({ documents: rows });
  } catch (err) {
    fail(res, err, 'Failed to load the documents');
  }
}

export async function getDocumentText(req, res) {
  try {
    const { rows } = await pool.query('SELECT extracted_text FROM similar_scheme_documents WHERE id = $1 AND project_id = $2', [Number(req.params.docId), Number(req.params.projectId)]);
    if (!rows.length) return res.status(404).json({ error: 'Document not found' });
    res.json({ text: rows[0].extracted_text });
  } catch (err) {
    fail(res, err, 'Failed to load the document text');
  }
}

export async function uploadDocument(req, res) {
  const projectId = Number(req.params.projectId);
  const name = String(req.body?.planit_name ?? '').trim();
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!name) return res.status(400).json({ error: 'planit_name is required' });

  try {
    const { rows: scheme } = await pool.query('SELECT 1 FROM similar_schemes_saved WHERE project_id = $1 AND planit_name = $2', [projectId, name]);
    if (!scheme.length) return res.status(404).json({ error: 'That scheme is not saved to this project' });

    const { text, warning } = await parseFile(req.file.buffer, req.file.originalname);
    const clean = String(text ?? '').replace(/\u0000/g, '').trim();
    if (clean.length < 50) {
      return res.status(422).json({ error: warning || 'No readable text was found in this file. If it is a scan, run it through OCR first.' });
    }
    if (clean.length > MAX_STORED_CHARS) {
      return res.status(422).json({ error: `This document is too long to store (about ${Math.round(clean.length / 4000)}k tokens). Split it into parts and upload each.` });
    }

    const filename = req.file.originalname.slice(0, 200);
    const docType = await suggestDocType(filename, clean);
    const { rows } = await pool.query(
      `INSERT INTO similar_scheme_documents (project_id, planit_name, filename, doc_type, extracted_text, char_count, parse_warning, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${META_COLUMNS}`,
      [projectId, name, filename, docType, clean, clean.length, warning || null, req.user?.id ?? null]
    );
    res.status(201).json({ document: rows[0] });
  } catch (err) {
    fail(res, err, 'Failed to upload the document');
  }
}

export async function setDocumentType(req, res) {
  const docType = req.body?.doc_type;
  if (!DOC_TYPES.includes(docType)) return res.status(400).json({ error: 'Unknown document type' });
  try {
    const { rows } = await pool.query(
      `UPDATE similar_scheme_documents SET doc_type = $1, type_confirmed = true WHERE id = $2 AND project_id = $3 RETURNING ${META_COLUMNS}`,
      [docType, Number(req.params.docId), Number(req.params.projectId)]
    );
    if (!rows.length) return res.status(404).json({ error: 'Document not found' });
    res.json({ document: rows[0] });
  } catch (err) {
    fail(res, err, 'Failed to update the document');
  }
}

export async function deleteDocument(req, res) {
  try {
    await pool.query('DELETE FROM similar_scheme_documents WHERE id = $1 AND project_id = $2', [Number(req.params.docId), Number(req.params.projectId)]);
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, 'Failed to delete the document');
  }
}

export async function chatDocuments(req, res) {
  try {
    const { names, messages, sources } = req.body ?? {};
    res.json(await chatAboutSchemeDocuments({ projectId: Number(req.params.projectId), names, messages, sources }));
  } catch (err) {
    fail(res, err, 'Chat request failed');
  }
}

export async function lensDocuments(req, res) {
  try {
    const { names, policy_ids: policyIds, question } = req.body ?? {};
    res.json(await lensSchemeDocuments({ projectId: Number(req.params.projectId), names, policyIds, question }));
  } catch (err) {
    fail(res, err, 'Policy lens request failed');
  }
}
