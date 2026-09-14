import * as draftCommentsService from '../services/draftComments.service.js';

export async function listComments(req, res) {
  const { projectId, draftKind, draftTypeId } = req.query;
  if (!projectId || !draftKind || !draftTypeId) {
    return res.status(400).json({ error: 'projectId, draftKind, and draftTypeId are required' });
  }
  try {
    const comments = await draftCommentsService.listComments(projectId, draftKind, draftTypeId);
    res.json(comments);
  } catch (err) {
    console.error('draftComments.listComments error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function createComment(req, res) {
  const { projectId, draftKind, draftTypeId, paragraphId, quotedText, body } = req.body ?? {};
  if (!projectId || !draftKind || !draftTypeId || !paragraphId || !quotedText?.trim() || !body?.trim()) {
    return res.status(400).json({ error: 'projectId, draftKind, draftTypeId, paragraphId, quotedText, and body are required' });
  }
  try {
    const comment = await draftCommentsService.createComment(req.user.id, {
      projectId, draftKind, draftTypeId, paragraphId, quotedText: quotedText.trim(), body: body.trim(),
    });
    res.status(201).json(comment);
  } catch (err) {
    console.error('draftComments.createComment error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function updateComment(req, res) {
  const { id } = req.params;
  const { body, resolved } = req.body ?? {};
  try {
    const comment = await draftCommentsService.updateComment(id, { body: body?.trim(), resolved });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    res.json(comment);
  } catch (err) {
    console.error('draftComments.updateComment error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function deleteComment(req, res) {
  const { id } = req.params;
  try {
    const deleted = await draftCommentsService.deleteComment(id);
    if (!deleted) return res.status(404).json({ error: 'Comment not found' });
    res.status(204).end();
  } catch (err) {
    console.error('draftComments.deleteComment error:', err);
    res.status(500).json({ error: err.message });
  }
}
