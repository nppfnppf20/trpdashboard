/**
 * Project Map Controller
 * Handles HTTP requests for project map endpoints
 */

import { projectMapService } from '../services/projectMap.service.js';

export async function getRenewables(req, res) {
  try {
    const geojson = await projectMapService.getRenewables();
    console.log(`✅ Fetched ${geojson.features.length} renewables records`);
    res.json(geojson);
  } catch (error) {
    console.error('Error fetching renewables:', error);
    res.status(500).json({ error: 'Failed to fetch renewables data' });
  }
}

export async function getDataCentres(req, res) {
  try {
    const geojson = await projectMapService.getDataCentres();
    console.log(`✅ Fetched ${geojson.features.length} data centres records`);
    res.json(geojson);
  } catch (error) {
    console.error('Error fetching data centres:', error);
    res.status(500).json({ error: 'Failed to fetch data centres data' });
  }
}

export async function getProjects(req, res) {
  try {
    const geojson = await projectMapService.getProjects();
    console.log(`✅ Fetched ${geojson.features.length} projects records`);
    res.json(geojson);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects data' });
  }
}

export async function getTRPCommercial(req, res) {
  try {
    const geojson = await projectMapService.getTRPCommercial();
    console.log(`✅ Fetched ${geojson.features.length} TRP Commercial projects`);
    res.json(geojson);
  } catch (error) {
    console.error('Error fetching TRP Commercial projects:', error);
    res.status(500).json({ error: 'Failed to fetch TRP Commercial projects data' });
  }
}

export async function getTRPEnergy(req, res) {
  try {
    const geojson = await projectMapService.getTRPEnergy();
    console.log(`✅ Fetched ${geojson.features.length} TRP Energy projects`);
    res.json(geojson);
  } catch (error) {
    console.error('Error fetching TRP Energy projects:', error);
    res.status(500).json({ error: 'Failed to fetch TRP Energy projects data' });
  }
}

export async function getTRPResidential(req, res) {
  try {
    const geojson = await projectMapService.getTRPResidential();
    console.log(`✅ Fetched ${geojson.features.length} TRP Residential projects`);
    res.json(geojson);
  } catch (error) {
    console.error('Error fetching TRP Residential projects:', error);
    res.status(500).json({ error: 'Failed to fetch TRP Residential projects data' });
  }
}

export async function updateRenewableDismissed(req, res) {
  try {
    const { id } = req.params;
    const { dismissed } = req.body;
    
    const result = await projectMapService.updateRenewableDismissed(id, dismissed);
    console.log(`✅ Updated renewable ${id} dismissed status to ${dismissed}`);
    res.json(result);
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error updating renewable dismissed status:', error);
    res.status(500).json({ error: 'Failed to update dismissed status' });
  }
}

export async function updateDataCentreDismissed(req, res) {
  try {
    const { id } = req.params;
    const { dismissed } = req.body;

    const result = await projectMapService.updateDataCentreDismissed(id, dismissed);
    console.log(`✅ Updated data centre ${id} dismissed status to ${dismissed}`);
    res.json(result);
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error updating data centre dismissed status:', error);
    res.status(500).json({ error: 'Failed to update dismissed status' });
  }
}

export async function getContractsFinder(req, res) {
  try {
    const contracts = await projectMapService.getContractsFinder();
    console.log(`✅ Fetched ${contracts.length} contracts finder records`);
    res.json(contracts);
  } catch (error) {
    console.error('Error fetching contracts finder:', error);
    res.status(500).json({ error: 'Failed to fetch contracts finder data' });
  }
}

export async function updateContractsFinderDismissed(req, res) {
  try {
    const { id } = req.params;
    const { dismissed } = req.body;

    const result = await projectMapService.updateContractsFinderDismissed(id, dismissed);
    console.log(`✅ Updated contract ${id} dismissed status to ${dismissed}`);
    res.json(result);
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error updating contract dismissed status:', error);
    res.status(500).json({ error: 'Failed to update dismissed status' });
  }
}

