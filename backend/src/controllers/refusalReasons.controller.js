/**
 * Refusal Reasons Controller
 * HTTP handlers for appeal project refusal reasons
 */

import {
  getRefusalReasons,
  createRefusalReason,
  updateRefusalReason,
  deleteRefusalReason,
  reorderRefusalReasons
} from '../services/refusalReasons.service.js';

export async function getRefusalReasonsHandler(req, res) {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const reasons = await getRefusalReasons(projectId);
    res.json({ reasons });
  } catch (error) {
    console.error('Error fetching refusal reasons:', error);
    res.status(500).json({ error: 'Failed to fetch refusal reasons' });
  }
}

export async function createRefusalReasonHandler(req, res) {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const { title, summary, riskLevel, isKeyIssue } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

    const reason = await createRefusalReason(projectId, {
      title: title.trim(),
      summary: summary?.trim() || null,
      riskLevel: riskLevel?.trim() || null,
      isKeyIssue: isKeyIssue ?? false
    });
    res.status(201).json(reason);
  } catch (error) {
    console.error('Error creating refusal reason:', error);
    res.status(500).json({ error: 'Failed to create refusal reason' });
  }
}

export async function updateRefusalReasonHandler(req, res) {
  try {
    const projectId = parseInt(req.params.projectId);
    const reasonId = parseInt(req.params.reasonId);
    if (isNaN(projectId) || isNaN(reasonId)) {
      return res.status(400).json({ error: 'Invalid project or reason ID' });
    }

    const { title, summary, riskLevel, isKeyIssue, sortOrder } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

    const reason = await updateRefusalReason(reasonId, projectId, {
      title: title.trim(),
      summary: summary?.trim() ?? null,
      riskLevel: riskLevel?.trim() ?? null,
      isKeyIssue: isKeyIssue ?? false,
      sortOrder: sortOrder ?? null
    });
    res.json(reason);
  } catch (error) {
    console.error('Error updating refusal reason:', error);
    res.status(500).json({ error: 'Failed to update refusal reason' });
  }
}

export async function deleteRefusalReasonHandler(req, res) {
  try {
    const projectId = parseInt(req.params.projectId);
    const reasonId = parseInt(req.params.reasonId);
    if (isNaN(projectId) || isNaN(reasonId)) {
      return res.status(400).json({ error: 'Invalid project or reason ID' });
    }

    await deleteRefusalReason(reasonId, projectId);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting refusal reason:', error);
    res.status(500).json({ error: 'Failed to delete refusal reason' });
  }
}

export async function reorderRefusalReasonsHandler(req, res) {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.some(id => typeof id !== 'number')) {
      return res.status(400).json({ error: 'orderedIds must be an array of numbers' });
    }

    await reorderRefusalReasons(projectId, orderedIds);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error reordering refusal reasons:', error);
    res.status(500).json({ error: 'Failed to reorder refusal reasons' });
  }
}
