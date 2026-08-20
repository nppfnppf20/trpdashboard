import { pool } from '../db.js';
import { parseFile } from '../services/parser.service.js';
import { processPublicComment, splitPublicCommentBlock, analysePublicComments } from '../services/public_comments.service.js';

export async function splitCommentBlock(req, res) {
  try {
    let text, fileName;

    if (req.file) {
      ({ text } = await parseFile(req.file.buffer, req.file.originalname));
      fileName = req.file.originalname;
      if (!text || text.trim().length < 30) {
        return res.status(422).json({
          error: 'Could not extract readable text from this PDF. It may be a scanned or image-based document, try pasting the text directly instead.',
        });
      }
    } else if (req.body.text) {
      text = req.body.text;
      fileName = req.body.file_name || null;
    } else {
      return res.status(400).json({ error: 'No file or text provided' });
    }

    const segments = await splitPublicCommentBlock(text);
    res.json({ segments, source_file_name: fileName });
  } catch (err) {
    console.error('public_comments.splitCommentBlock error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function processComment(req, res) {
  try {
    const { user_notes } = req.body;
    let text, fileName;

    if (req.file) {
      ({ text } = await parseFile(req.file.buffer, req.file.originalname));
      fileName = req.file.originalname;
      if (!text || text.trim().length < 30) {
        return res.status(422).json({
          error: 'Could not extract readable text from this PDF. It may be a scanned or image-based document, try pasting the text directly instead.',
        });
      }
    } else if (req.body.text) {
      text = req.body.text;
      fileName = req.body.file_name || null;
    } else {
      return res.status(400).json({ error: 'No file or text provided' });
    }

    const suggestion = await processPublicComment(text, fileName, user_notes?.trim() || null);
    res.json({ suggestion, source_file_name: fileName });
  } catch (err) {
    console.error('public_comments.processComment error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function getCommentsData(req, res) {
  const { projectId } = req.params;
  try {
    const [{ rows: comments }, { rows: analysis }] = await Promise.all([
      pool.query(
        `SELECT id, commenter_name, date_received, position, comment, notes,
                source_file_name, sort_order, created_at, updated_at
         FROM planning_applications.public_comments
         WHERE project_id = $1
         ORDER BY sort_order ASC, date_received ASC NULLS LAST, created_at ASC`,
        [projectId]
      ),
      pool.query(
        `SELECT bullet_summary, themes, last_analysed_at
         FROM planning_applications.public_comment_analysis
         WHERE project_id = $1`,
        [projectId]
      ),
    ]);

    res.json({
      comments,
      analysis: analysis[0] || { bullet_summary: null, themes: null, last_analysed_at: null },
    });
  } catch (err) {
    console.error('public_comments.getCommentsData error:', err);
    res.status(500).json({ error: 'Failed to fetch public comments data' });
  }
}

export async function createComment(req, res) {
  const { projectId } = req.params;
  const { commenter_name, date_received, position, comment, notes, source_file_name } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.public_comments
         (project_id, commenter_name, date_received, position, comment, notes, source_file_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        projectId,
        commenter_name?.trim() || null,
        date_received || null,
        position?.trim() || null,
        comment?.trim() || null,
        notes?.trim() || null,
        source_file_name?.trim() || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('public_comments.createComment error:', err);
    res.status(500).json({ error: 'Failed to create comment' });
  }
}

export async function updateComment(req, res) {
  const { commentId } = req.params;
  const { commenter_name, date_received, position, comment, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE planning_applications.public_comments SET
         commenter_name = $2,
         date_received  = $3,
         position       = $4,
         comment        = $5,
         notes          = $6,
         updated_at     = NOW()
       WHERE id = $1 RETURNING *`,
      [
        commentId,
        commenter_name?.trim() || null,
        date_received || null,
        position?.trim() || null,
        comment?.trim() || null,
        notes?.trim() || null,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('public_comments.updateComment error:', err);
    res.status(500).json({ error: 'Failed to update comment' });
  }
}

export async function deleteComment(req, res) {
  const { commentId } = req.params;
  try {
    await pool.query(
      `DELETE FROM planning_applications.public_comments WHERE id = $1`,
      [commentId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('public_comments.deleteComment error:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
}

export async function runAnalysis(req, res) {
  const { projectId } = req.params;
  try {
    const { rows: comments } = await pool.query(
      `SELECT commenter_name, position, comment
       FROM planning_applications.public_comments
       WHERE project_id = $1
       ORDER BY sort_order ASC, date_received ASC NULLS LAST, created_at ASC`,
      [projectId]
    );

    if (!comments.length) {
      return res.status(400).json({ error: 'No comments to analyse' });
    }

    const { bulletSummary, themes } = await analysePublicComments(comments);

    const { rows } = await pool.query(
      `INSERT INTO planning_applications.public_comment_analysis
         (project_id, bullet_summary, themes, last_analysed_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (project_id) DO UPDATE SET
         bullet_summary   = EXCLUDED.bullet_summary,
         themes           = EXCLUDED.themes,
         last_analysed_at = NOW(),
         updated_at       = NOW()
       RETURNING bullet_summary, themes, last_analysed_at`,
      [projectId, JSON.stringify(bulletSummary), JSON.stringify(themes)]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('public_comments.runAnalysis error:', err);
    res.status(500).json({ error: 'Failed to run analysis', details: err.message });
  }
}
