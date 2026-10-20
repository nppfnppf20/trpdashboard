import { randomUUID } from 'crypto';
import { pool } from '../db.js';
import { supabaseAdmin } from '../supabase.js';
import { queueIndexing, isIndexing } from '../services/policyIndexer.service.js';
import { askPolicies } from '../services/policyChat.service.js';
import { MAX_FOLDER_DEPTH, checkPlacement, scopeIds } from '../services/policyFolders.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Company policy library — internal policy documents (global, not project-scoped).
// Originals live in the private 'company-policies' storage bucket; chunks for
// search are built from them in the background (policyIndexer.service.js). See
// docs/plans/POLICY_RAG_IMPLEMENTATION_PLAN.md. Uses its own names (not
// "policy documents") because /api/lpa/policy-documents already means something else.
// ─────────────────────────────────────────────────────────────────────────────

const BUCKET = 'company-policies';
const VISIBILITIES = ['all', 'admin'];
const MIME_BY_EXT = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  md: 'text/markdown',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};
// Images can't be read for text, so they are always display-only
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

const DOC_COLUMNS = `id, title, category, folder_id, display_only, version, effective_date, status, status_detail, visibility,
  is_current, supersedes_id, original_filename, mime_type, file_size, chunk_count, uploaded_by,
  created_at, updated_at`;

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// A folder id from a request: undefined = not supplied, null = "no folder", a number, or 'invalid'.
function parseFolderId(v) {
  if (v === undefined) return undefined;
  if (v === null || v === '' || v === 'null') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 'invalid';
}

async function loadFolders() {
  const { rows } = await pool.query('SELECT id, name, parent_id, sort_order FROM company_documents.folders');
  return rows;
}

// Accepts YYYY-MM-DD (or empty) and returns it, null for empty, undefined if invalid.
function parseDate(v) {
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) return undefined;
  return v;
}

export async function listCompanyPolicies(req, res) {
  const includeHistory = req.query.include_history === '1';
  try {
    const { rows } = await pool.query(
      `SELECT ${DOC_COLUMNS}
       FROM company_documents.documents
       ${includeHistory ? '' : 'WHERE is_current'}
       ORDER BY title, created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('companyPolicies.list error:', err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
}

// Upload a file as a new policy, or as a new version of an existing one (supersedes_id).
export async function uploadCompanyPolicy(req, res) {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'A file is required' });

  const title = clean(req.body.title, 200);
  if (!title) return res.status(400).json({ error: 'title is required' });

  const visibility = req.body.visibility || 'all';
  if (!VISIBILITIES.includes(visibility)) return res.status(400).json({ error: 'Invalid visibility' });

  const effectiveDate = parseDate(req.body.effective_date);
  if (effectiveDate === undefined) return res.status(400).json({ error: 'effective_date must be YYYY-MM-DD' });

  const supersedesId = req.body.supersedes_id ? Number(req.body.supersedes_id) : null;
  if (supersedesId !== null && !Number.isInteger(supersedesId)) {
    return res.status(400).json({ error: 'Invalid supersedes_id' });
  }

  // Checked before the file is stored so a bad folder doesn't leave an orphaned upload behind.
  let folderId = parseFolderId(req.body.folder_id);
  if (folderId === 'invalid') return res.status(400).json({ error: 'Invalid folder' });
  if (typeof folderId === 'number' && !(await loadFolders()).some((f) => f.id === folderId)) {
    return res.status(400).json({ error: 'That folder no longer exists' });
  }

  const ext = (file.originalname.split('.').pop() || '').toLowerCase();

  // Display only = stored and shown as uploaded, never read, indexed or searched. Images always are.
  const displayOnly = IMAGE_EXTS.includes(ext) || req.body.display_only === 'true' || req.body.display_only === true;
  if (displayOnly && ext === 'docx') {
    return res.status(400).json({ error: "Word documents can't be shown as they are in the browser, so they are always read and indexed. Upload a PDF instead if you want it displayed as is." });
  }

  // The stored key is generated; the client-supplied filename is kept only as a display label.
  const storagePath = `${randomUUID()}.${ext}`;
  const mimeType = MIME_BY_EXT[ext] || 'application/octet-stream';

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, file.buffer, { contentType: mimeType, upsert: false });
  if (uploadError) {
    console.error('companyPolicies.upload storage error:', uploadError);
    return res.status(500).json({ error: 'Failed to store the file' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let category = clean(req.body.category, 100) || 'General';
    if (supersedesId !== null) {
      const prev = await client.query(
        'SELECT id, category, folder_id FROM company_documents.documents WHERE id = $1 AND is_current FOR UPDATE',
        [supersedesId]
      );
      if (!prev.rows.length) {
        await client.query('ROLLBACK');
        await removeFromStorage(storagePath);
        return res.status(404).json({ error: 'The document being replaced was not found or is already superseded' });
      }
      if (!clean(req.body.category, 100)) category = prev.rows[0].category;
      if (folderId === undefined) folderId = prev.rows[0].folder_id; // a new version stays where the old one was
      await client.query(
        'UPDATE company_documents.documents SET is_current = false, updated_at = NOW() WHERE id = $1',
        [supersedesId]
      );
    }

    const { rows } = await client.query(
      `INSERT INTO company_documents.documents
         (title, category, folder_id, version, effective_date, visibility, supersedes_id,
          original_filename, mime_type, file_size, storage_path, uploaded_by, status, display_only)
       VALUES ($1, $2, $12, $3, $4, $5, $6, $7, $8, $9, $10, $11, $13, $14)
       RETURNING ${DOC_COLUMNS}`,
      [
        title,
        category,
        clean(req.body.version, 50) || '1',
        effectiveDate,
        visibility,
        supersedesId,
        clean(file.originalname, 255),
        mimeType,
        file.size,
        storagePath,
        req.user?.id ?? null,
        folderId ?? null,
        displayOnly ? 'ready' : 'processing', // nothing to index for a display-only document
        displayOnly,
      ]
    );
    await client.query('COMMIT');
    if (!displayOnly) queueIndexing(rows[0].id); // background; the status badge flips to Ready/Failed when it finishes
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    await removeFromStorage(storagePath);
    console.error('companyPolicies.upload error:', err);
    res.status(500).json({ error: 'Failed to save the document' });
  } finally {
    client.release();
  }
}

export async function updateCompanyPolicy(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  const { title, category, version, visibility, effective_date } = req.body;
  if (visibility !== undefined && !VISIBILITIES.includes(visibility)) {
    return res.status(400).json({ error: 'Invalid visibility' });
  }
  const effectiveDate = effective_date === undefined ? undefined : parseDate(effective_date);
  if (effectiveDate === undefined && effective_date !== undefined) {
    return res.status(400).json({ error: 'effective_date must be YYYY-MM-DD' });
  }
  if (title !== undefined && !clean(title, 200)) return res.status(400).json({ error: 'title cannot be empty' });

  // folder_id: omitted = leave as is, null = take it out of its folder, a number = move it there
  const folderId = parseFolderId(req.body.folder_id);
  if (folderId === 'invalid') return res.status(400).json({ error: 'Invalid folder' });

  // display_only: omitted = leave as is; true/false switches a PDF between "shown as uploaded" and "read and searched"
  const wantDisplayOnly = req.body.display_only;
  if (wantDisplayOnly !== undefined && typeof wantDisplayOnly !== 'boolean') {
    return res.status(400).json({ error: 'display_only must be true or false' });
  }

  try {
    const before = await pool.query(
      'SELECT title, version, display_only, mime_type FROM company_documents.documents WHERE id = $1',
      [id]
    );
    if (!before.rows.length) return res.status(404).json({ error: 'Document not found' });
    if (typeof folderId === 'number' && !(await loadFolders()).some((f) => f.id === folderId)) {
      return res.status(400).json({ error: 'That folder no longer exists' });
    }

    const was = before.rows[0];
    const isImage = (was.mime_type || '').startsWith('image/');
    const isWord = (was.mime_type || '').includes('wordprocessingml');
    if (wantDisplayOnly === false && isImage) {
      return res.status(400).json({ error: 'Images can only be displayed as they are; they have no text to read.' });
    }
    if (wantDisplayOnly === true && isWord) {
      return res.status(400).json({ error: "Word documents can't be shown as they are in the browser, so they are always read and indexed." });
    }
    // Only a real change needs any follow-up work
    const switchTo = wantDisplayOnly !== undefined && wantDisplayOnly !== was.display_only ? wantDisplayOnly : undefined;

    const { rows } = await pool.query(
      `UPDATE company_documents.documents SET
         title          = COALESCE($1, title),
         category       = COALESCE($2, category),
         version        = COALESCE($3, version),
         visibility     = COALESCE($4, visibility),
         effective_date = CASE WHEN $5::boolean THEN $6::date ELSE effective_date END,
         folder_id      = CASE WHEN $8::boolean THEN $9::int ELSE folder_id END,
         display_only   = CASE WHEN $10::boolean THEN $11::boolean ELSE display_only END,
         updated_at     = NOW()
       WHERE id = $7
       RETURNING ${DOC_COLUMNS}`,
      [
        title !== undefined ? clean(title, 200) : null,
        category !== undefined ? clean(category, 100) || 'General' : null,
        version !== undefined ? clean(version, 50) || '1' : null,
        visibility ?? null,
        effective_date !== undefined,
        effectiveDate ?? null,
        id,
        folderId !== undefined,
        folderId ?? null,
        switchTo !== undefined,
        switchTo ?? null,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Document not found' });
    const doc = rows[0];

    if (switchTo === true) {
      // Now display-only: drop what was indexed. There is nothing left to read or search.
      await pool.query('DELETE FROM company_documents.chunks WHERE document_id = $1', [id]);
      const done = await pool.query(
        `UPDATE company_documents.documents SET status = 'ready', status_detail = NULL, chunk_count = 0
          WHERE id = $1 RETURNING status, status_detail, chunk_count`,
        [id]
      );
      Object.assign(doc, done.rows[0]);
    } else if (switchTo === false) {
      // Back to being read and searched: index it now.
      const queued = await pool.query(
        `UPDATE company_documents.documents SET status = 'processing', status_detail = NULL
          WHERE id = $1 RETURNING status, status_detail`,
        [id]
      );
      queueIndexing(id);
      Object.assign(doc, queued.rows[0]);
    } else if (!doc.display_only && (doc.title !== was.title || doc.version !== was.version) && doc.status !== 'uploaded') {
      // The title and version are part of the text that gets embedded, so a change means re-indexing.
      const requeued = await pool.query(
        `UPDATE company_documents.documents SET status = 'processing', status_detail = NULL WHERE id = $1 RETURNING status`,
        [id]
      );
      queueIndexing(id);
      doc.status = requeued.rows[0].status;
      doc.status_detail = null;
    }
    res.json(doc);
  } catch (err) {
    console.error('companyPolicies.update error:', err);
    res.status(500).json({ error: 'Failed to update the document' });
  }
}

// ─── Folders ─────────────────────────────────────────────────────────────────

// The whole (small) tree as flat rows; the client builds the nesting. doc_count is the documents
// directly in each folder.
export async function listCompanyPolicyFolders(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT f.id, f.name, f.parent_id, f.sort_order,
              COUNT(d.id) FILTER (WHERE d.is_current)::int AS doc_count
         FROM company_documents.folders f
         LEFT JOIN company_documents.documents d ON d.folder_id = f.id
        GROUP BY f.id
        ORDER BY f.sort_order, lower(f.name)`
    );
    res.json({ folders: rows, max_depth: MAX_FOLDER_DEPTH });
  } catch (err) {
    console.error('companyPolicies.folders.list error:', err);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
}

const isDuplicateName = (err) => err?.code === '23505';

export async function createCompanyPolicyFolder(req, res) {
  const name = clean(req.body.name, 100);
  if (!name) return res.status(400).json({ error: 'A folder name is required' });
  const parentId = parseFolderId(req.body.parent_id) ?? null;
  if (parentId === 'invalid') return res.status(400).json({ error: 'Invalid parent folder' });

  try {
    const problem = checkPlacement(await loadFolders(), { parentId });
    if (problem) return res.status(400).json({ error: problem });

    const { rows } = await pool.query(
      `INSERT INTO company_documents.folders (name, parent_id) VALUES ($1, $2)
       RETURNING id, name, parent_id, sort_order, 0 AS doc_count`,
      [name, parentId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (isDuplicateName(err)) return res.status(409).json({ error: 'A folder with that name already exists here' });
    console.error('companyPolicies.folders.create error:', err);
    res.status(500).json({ error: 'Failed to create the folder' });
  }
}

// Rename a folder and/or move it under another one (parent_id null = top level).
export async function updateCompanyPolicyFolder(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  const name = req.body.name === undefined ? undefined : clean(req.body.name, 100);
  if (name === '') return res.status(400).json({ error: 'A folder name is required' });
  const parentId = parseFolderId(req.body.parent_id);
  if (parentId === 'invalid') return res.status(400).json({ error: 'Invalid parent folder' });

  try {
    const folders = await loadFolders();
    if (!folders.some((f) => f.id === id)) return res.status(404).json({ error: 'Folder not found' });
    if (parentId !== undefined) {
      const problem = checkPlacement(folders, { folderId: id, parentId });
      if (problem) return res.status(400).json({ error: problem });
    }

    const { rows } = await pool.query(
      `UPDATE company_documents.folders SET
         name       = COALESCE($1, name),
         parent_id  = CASE WHEN $2::boolean THEN $3::int ELSE parent_id END,
         updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, parent_id, sort_order`,
      [name ?? null, parentId !== undefined, parentId ?? null, id]
    );
    res.json(rows[0]);
  } catch (err) {
    if (isDuplicateName(err)) return res.status(409).json({ error: 'A folder with that name already exists here' });
    console.error('companyPolicies.folders.update error:', err);
    res.status(500).json({ error: 'Failed to update the folder' });
  }
}

// Only an empty folder can be deleted: nothing in it and no sub-folders.
export async function deleteCompanyPolicyFolder(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const { rows } = await pool.query(
      `SELECT (SELECT COUNT(*) FROM company_documents.folders WHERE parent_id = $1)::int AS subfolders,
              (SELECT COUNT(*) FROM company_documents.documents WHERE folder_id = $1)::int AS documents`,
      [id]
    );
    const { subfolders, documents } = rows[0];
    if (subfolders || documents) {
      return res.status(409).json({
        error: "This folder isn't empty. Move or delete everything inside it first.",
        subfolders,
        documents,
      });
    }
    const result = await pool.query('DELETE FROM company_documents.folders WHERE id = $1', [id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Folder not found' });
    res.json({ ok: true });
  } catch (err) {
    // 23503: something was added to the folder between the check and the delete
    if (err?.code === '23503') return res.status(409).json({ error: "This folder isn't empty. Move or delete everything inside it first." });
    console.error('companyPolicies.folders.delete error:', err);
    res.status(500).json({ error: 'Failed to delete the folder' });
  }
}

// Rebuild a document's chunks from its stored original (after a failure, or an old upload).
export async function reindexCompanyPolicy(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  if (isIndexing(id)) return res.status(409).json({ error: 'This document is already being indexed' });
  try {
    const { rows } = await pool.query(
      `UPDATE company_documents.documents
          SET status = 'processing', status_detail = NULL, updated_at = NOW()
        WHERE id = $1 AND NOT display_only
      RETURNING ${DOC_COLUMNS}`,
      [id]
    );
    if (!rows.length) {
      const exists = await pool.query('SELECT display_only FROM company_documents.documents WHERE id = $1', [id]);
      if (exists.rows[0]?.display_only) return res.status(400).json({ error: 'This document is display only, so there is nothing to index.' });
      return res.status(404).json({ error: 'Document not found' });
    }
    queueIndexing(id);
    res.json(rows[0]);
  } catch (err) {
    console.error('companyPolicies.reindex error:', err);
    res.status(500).json({ error: 'Failed to start indexing' });
  }
}

// Question -> answer grounded in the indexed policies, with the cited sources.
export async function askCompanyPolicies(req, res) {
  const question = clean(req.body.question, 2000);
  if (!question) return res.status(400).json({ error: 'question is required' });

  // Prior turns give follow-up questions their context; keep them bounded.
  const history = (Array.isArray(req.body.history) ? req.body.history : [])
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 4000) }));
  while (history.length && history[0].role !== 'user') history.shift(); // must start with a user turn

  const isAdmin = req.user?.role === 'admin';

  // folder_id narrows the search to that folder and everything inside it
  let folderIds = null;
  const scopeFolder = parseFolderId(req.body.folder_id);
  if (scopeFolder === 'invalid') return res.status(400).json({ error: 'Invalid folder' });
  if (typeof scopeFolder === 'number') {
    try {
      const folders = await loadFolders();
      if (!folders.some((f) => f.id === scopeFolder)) return res.status(400).json({ error: 'That folder no longer exists' });
      folderIds = scopeIds(folders, scopeFolder);
    } catch (err) {
      console.error('companyPolicies.ask folder error:', err);
      return res.status(500).json({ error: 'Failed to answer the question' });
    }
  }

  // stream: true -> server-sent events: {type:'delta', text} as the answer is written, then
  // {type:'done', answer, sources, query} (the final, cleaned answer replaces the streamed text).
  if (req.body.stream === true) {
    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // stop nginx-style proxies holding the stream back
    });
    res.flushHeaders();
    const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    // Stop paying for tokens nobody will read if the browser goes away mid-answer.
    const controller = new AbortController();
    res.on('close', () => controller.abort());

    try {
      const result = await askPolicies({
        question,
        history,
        isAdmin,
        folderIds,
        onDelta: (text) => send({ type: 'delta', text }),
        signal: controller.signal,
      });
      send({ type: 'done', ...result });
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error('companyPolicies.ask (stream) error:', err);
        send({ type: 'error', message: 'Failed to answer the question' });
      }
    }
    return res.end();
  }

  try {
    res.json(await askPolicies({ question, history, isAdmin, folderIds }));
  } catch (err) {
    console.error('companyPolicies.ask error:', err);
    res.status(500).json({ error: 'Failed to answer the question' });
  }
}

// The whole document as indexed sections, for the in-app reader.
export async function getCompanyPolicyContent(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const doc = await pool.query(
      `SELECT ${DOC_COLUMNS} FROM company_documents.documents WHERE id = $1`,
      [id]
    );
    if (!doc.rows.length) return res.status(404).json({ error: 'Document not found' });

    const { rows: sections } = await pool.query(
      `SELECT chunk_index, section_path, section_ref, page_start, page_end, content
         FROM company_documents.chunks WHERE document_id = $1 ORDER BY chunk_index`,
      [id]
    );
    res.json({ document: doc.rows[0], sections });
  } catch (err) {
    console.error('companyPolicies.content error:', err);
    res.status(500).json({ error: 'Failed to load the document' });
  }
}

// Short-lived signed URL for the original file (the bucket is private).
// ?inline=1 serves it for viewing in the browser (PDFs open at #page=N); otherwise it downloads.
export async function getCompanyPolicyFileUrl(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const { rows } = await pool.query(
      'SELECT storage_path, original_filename FROM company_documents.documents WHERE id = $1',
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Document not found' });

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(rows[0].storage_path, 60, req.query.inline === '1' ? undefined : { download: rows[0].original_filename });
    if (error) throw error;
    res.json({ url: data.signedUrl });
  } catch (err) {
    console.error('companyPolicies.fileUrl error:', err);
    res.status(500).json({ error: 'Failed to create a download link' });
  }
}

export async function deleteCompanyPolicy(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    // Chunks go with the row (ON DELETE CASCADE). A policy this one replaced is not
    // reinstated automatically — the older version stays in history.
    const { rows } = await pool.query(
      'DELETE FROM company_documents.documents WHERE id = $1 RETURNING storage_path',
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Document not found' });
    await removeFromStorage(rows[0].storage_path);
    res.json({ ok: true });
  } catch (err) {
    console.error('companyPolicies.delete error:', err);
    res.status(500).json({ error: 'Failed to delete the document' });
  }
}

async function removeFromStorage(path) {
  try {
    const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
    if (error) console.error('companyPolicies storage cleanup failed:', path, error);
  } catch (err) {
    console.error('companyPolicies storage cleanup failed:', path, err);
  }
}
