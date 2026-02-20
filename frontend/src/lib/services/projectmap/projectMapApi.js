import { authFetch } from '$lib/api/client.js';

/**
 * Fetch renewables data from the scraper.planit_renewables table
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
export async function getRenewables() {
  try {
    const response = await authFetch('/api/projectmap/renewables');

    if (!response.ok) {
      throw new Error(`Failed to fetch renewables: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.features?.length || 0} renewables from API`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching renewables:', error);
    throw error;
  }
}

/**
 * Fetch data centres data from the scraper.planit_datacentres table
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
export async function getDataCentres() {
  try {
    const response = await authFetch('/api/projectmap/datacentres');

    if (!response.ok) {
      throw new Error(`Failed to fetch data centres: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.features?.length || 0} data centres from API`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching data centres:', error);
    throw error;
  }
}

/**
 * Toggle dismissed status for a renewable
 * @param {number} id - Renewable ID
 * @param {boolean} dismissed - New dismissed status
 * @returns {Promise<Object>} Updated renewable record
 */
export async function toggleRenewableDismissed(id, dismissed) {
  try {
    const response = await authFetch(`/api/projectmap/renewables/${id}/dismiss`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dismissed }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update renewable: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Updated renewable ${id} dismissed status to ${dismissed}`);
    return data;
  } catch (error) {
    console.error('❌ Error updating renewable dismissed status:', error);
    throw error;
  }
}

/**
 * Toggle dismissed status for a data centre
 * @param {number} id - Data centre ID
 * @param {boolean} dismissed - New dismissed status
 * @returns {Promise<Object>} Updated data centre record
 */
export async function toggleDataCentreDismissed(id, dismissed) {
  try {
    const response = await authFetch(`/api/projectmap/datacentres/${id}/dismiss`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dismissed }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update data centre: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Updated data centre ${id} dismissed status to ${dismissed}`);
    return data;
  } catch (error) {
    console.error('❌ Error updating data centre dismissed status:', error);
    throw error;
  }
}

/**
 * Fetch projects data from the projects table
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
export async function getProjects() {
  try {
    const response = await authFetch('/api/projectmap/projects');

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.features?.length || 0} projects from API`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching projects:', error);
    throw error;
  }
}

/**
 * Fetch TRP Commercial, Economic and Industrial projects
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
export async function getTRPCommercial() {
  try {
    const response = await authFetch('/api/projectmap/trp-commercial');

    if (!response.ok) {
      throw new Error(`Failed to fetch TRP Commercial projects: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.features?.length || 0} TRP Commercial projects from API`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching TRP Commercial projects:', error);
    throw error;
  }
}

/**
 * Fetch TRP Energy, digital and infrastructure projects
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
export async function getTRPEnergy() {
  try {
    const response = await authFetch('/api/projectmap/trp-energy');

    if (!response.ok) {
      throw new Error(`Failed to fetch TRP Energy projects: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.features?.length || 0} TRP Energy projects from API`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching TRP Energy projects:', error);
    throw error;
  }
}

/**
 * Fetch TRP Residential and Strategic Land projects
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
export async function getTRPResidential() {
  try {
    const response = await authFetch('/api/projectmap/trp-residential');

    if (!response.ok) {
      throw new Error(`Failed to fetch TRP Residential projects: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.features?.length || 0} TRP Residential projects from API`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching TRP Residential projects:', error);
    throw error;
  }
}

/**
 * Fetch all REPD Filtered projects
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
export async function getREPDSolar() {
  try {
    const response = await authFetch('/api/projectmap/repd-solar');

    if (!response.ok) {
      throw new Error(`Failed to fetch REPD Solar projects: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.features?.length || 0} REPD Solar projects from API`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching REPD Solar projects:', error);
    throw error;
  }
}

export async function getREPDWind() {
  try {
    const response = await authFetch('/api/projectmap/repd-wind');

    if (!response.ok) {
      throw new Error(`Failed to fetch REPD Wind projects: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.features?.length || 0} REPD Wind projects from API`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching REPD Wind projects:', error);
    throw error;
  }
}

export async function getREPDBattery() {
  try {
    const response = await authFetch('/api/projectmap/repd-battery');

    if (!response.ok) {
      throw new Error(`Failed to fetch REPD Battery projects: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.features?.length || 0} REPD Battery projects from API`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching REPD Battery projects:', error);
    throw error;
  }
}

/**
 * Fetch contracts finder data from the scraper.contracts_finder table
 * @returns {Promise<Array>} Array of contract records
 */
export async function getContractsFinder() {
  try {
    const response = await authFetch('/api/projectmap/contracts-finder');

    if (!response.ok) {
      throw new Error(`Failed to fetch contracts finder: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data?.length || 0} contracts from API`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching contracts finder:', error);
    throw error;
  }
}

/**
 * Toggle dismissed status for a contract
 * @param {number} id - Contract ID
 * @param {boolean} dismissed - New dismissed status
 * @returns {Promise<Object>} Updated contract record
 */
export async function toggleContractsFinderDismissed(id, dismissed) {
  try {
    const response = await authFetch(`/api/projectmap/contracts-finder/${id}/dismiss`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dismissed }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update contract: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Updated contract ${id} dismissed status to ${dismissed}`);
    return data;
  } catch (error) {
    console.error('❌ Error updating contract dismissed status:', error);
    throw error;
  }
}