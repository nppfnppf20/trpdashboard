import { pool } from '../db.js';

export async function listComments(projectId, draftKind, draftTypeId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.project_id, c.draft_kind, c.draft_type_id, c.paragraph_id,
            c.quoted_text, c.body, c.document_text, c.document_title, c.doc_type,
            c.resolved, c.created_at, c.updated_at,
            c.author_id, up.display_name AS author_name, up.avatar_url AS author_avatar_url
       FROM public.draft_paragraph_comments c
       JOIN public.user_profiles up ON up.id = c.author_id
      WHERE c.project_id = $1 AND c.draft_kind = $2 AND c.draft_type_id = $3
      ORDER BY c.resolved, c.created_at DESC`,
    [projectId, draftKind, draftTypeId]
  );
  return rows;
}

export async function createComment(authorId, { projectId, draftKind, draftTypeId, paragraphId, quotedText, body, documentText = null, documentTitle = null, docType = null }) {
  const { rows } = await pool.query(
    `INSERT INTO public.draft_paragraph_comments
       (project_id, draft_kind, draft_type_id, paragraph_id, quoted_text, body, document_text, document_title, doc_type, author_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, project_id, draft_kind, draft_type_id, paragraph_id, quoted_text, body, document_text, document_title, doc_type, resolved, created_at, updated_at, author_id`,
    [projectId, draftKind, draftTypeId, paragraphId, quotedText, body, documentText, documentTitle, docType, authorId]
  );
  return rows[0];
}

export async function updateComment(commentId, { body, resolved }) {
  const { rows } = await pool.query(
    `UPDATE public.draft_paragraph_comments
        SET body = COALESCE($2, body),
            resolved = COALESCE($3, resolved),
            updated_at = now()
      WHERE id = $1
      RETURNING id, project_id, draft_kind, draft_type_id, paragraph_id, quoted_text, body, resolved, created_at, updated_at, author_id`,
    [commentId, body ?? null, resolved ?? null]
  );
  return rows[0] ?? null;
}

export async function deleteComment(commentId) {
  const { rowCount } = await pool.query(
    `DELETE FROM public.draft_paragraph_comments WHERE id = $1`,
    [commentId]
  );
  return rowCount > 0;
}
