/**
 * Projects Routes
 * CRUD routes for projects management
 */

import express from 'express';
import {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject
} from '../projectsApi.js';
import * as projectsController from '../controllers/projects.controller.js';
import { pool } from '../db.js';

const router = express.Router();

// Project information routes (must be before /:id routes)
router.get('/:projectId/information', projectsController.getProjectInformation);
router.put('/:projectId/information', projectsController.updateProjectInformation);

// Development type
router.patch('/:projectId/development-type', async (req, res) => {
  const { development_type } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE public.projects SET development_type = $1 WHERE id = $2 RETURNING *`,
      [development_type ?? null, req.params.projectId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('development-type patch error:', err);
    res.status(500).json({ error: 'Failed to update development type' });
  }
});

// Core project routes
router.post('/', createProject);
router.get('/', getAllProjects);
router.get('/:id', getProjectById);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

export default router;

