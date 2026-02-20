/**
 * Lookups Routes
 * API endpoints for fetching dropdown options
 */

import express from 'express';
import { getLookupOptions, getAvailableLookupTypes } from '../services/lookups.service.js';

const router = express.Router();

/**
 * GET /api/lookups
 * Get list of available lookup types
 */
router.get('/', async (req, res) => {
  try {
    const types = getAvailableLookupTypes();
    res.json({ success: true, types });
  } catch (error) {
    console.error('Error fetching lookup types:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch lookup types' });
  }
});

/**
 * GET /api/lookups/:type
 * Get all options for a specific lookup type
 */
router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const options = await getLookupOptions(type);
    res.json({ success: true, options });
  } catch (error) {
    console.error(`Error fetching lookup options for ${req.params.type}:`, error);

    if (error.message.startsWith('Unknown lookup type')) {
      res.status(400).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Failed to fetch lookup options' });
    }
  }
});

export default router;
