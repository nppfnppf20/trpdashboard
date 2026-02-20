/**
 * REPD Controller
 * Handles HTTP requests for REPD endpoints
 */

import { repdService } from '../services/repd.service.js';

export async function getREPDSolar(req, res) {
  try {
    const geojson = await repdService.getREPDByTechnology('Solar Photovoltaics');
    console.log(`✅ Fetched ${geojson.features.length} REPD Solar projects`);
    res.json(geojson);
  } catch (error) {
    console.error('Error fetching REPD Solar projects:', error);
    res.status(500).json({ error: 'Failed to fetch REPD Solar projects data' });
  }
}

export async function getREPDWind(req, res) {
  try {
    const geojson = await repdService.getREPDByTechnology('Wind Onshore');
    console.log(`✅ Fetched ${geojson.features.length} REPD Wind projects`);
    res.json(geojson);
  } catch (error) {
    console.error('Error fetching REPD Wind projects:', error);
    res.status(500).json({ error: 'Failed to fetch REPD Wind projects data' });
  }
}

export async function getREPDBattery(req, res) {
  try {
    const geojson = await repdService.getREPDByTechnology('Battery');
    console.log(`✅ Fetched ${geojson.features.length} REPD Battery projects`);
    res.json(geojson);
  } catch (error) {
    console.error('Error fetching REPD Battery projects:', error);
    res.status(500).json({ error: 'Failed to fetch REPD Battery projects data' });
  }
}

