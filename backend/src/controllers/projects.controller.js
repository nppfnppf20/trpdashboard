/**
 * Projects Controller
 * Handles HTTP requests for project endpoints
 */

import * as projectsService from '../services/projects.service.js';

/**
 * PUT /api/admin-console/projects/:projectId/information
 * Update project information
 */
export async function updateProjectInformation(req, res) {
  try {
    const { projectId } = req.params;
    const data = req.body;

    // Validate that projectId is provided
    if (!projectId) {
      return res.status(400).json({ 
        error: 'Project ID is required' 
      });
    }

    const updatedInfo = await projectsService.updateProjectInformation(projectId, data);

    res.json({
      success: true,
      data: updatedInfo,
      message: 'Project information updated successfully'
    });
  } catch (error) {
    console.error('Error updating project information:', error);
    
    if (error.message === 'Project not found') {
      return res.status(404).json({ 
        error: 'Project not found',
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to update project information',
      details: error.message 
    });
  }
}

/**
 * GET /api/admin-console/projects/:projectId/information
 * Get project information
 */
export async function getProjectInformation(req, res) {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ 
        error: 'Project ID is required' 
      });
    }

    const info = await projectsService.getProjectInformation(projectId);

    if (!info) {
      return res.status(404).json({ 
        error: 'Project information not found' 
      });
    }

    res.json(info);
  } catch (error) {
    console.error('Error fetching project information:', error);
    res.status(500).json({ 
      error: 'Failed to fetch project information',
      details: error.message 
    });
  }
}
