import { authFetch } from '$lib/api/client.js';

// Legacy analysis function (simple counts)
export async function analyzePolygon(/** @type {any} */ polygonGeoJSON) {
  const res = await authFetch('/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygon: polygonGeoJSON })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Analyze failed: ${res.status} ${text}`);
  }
  return res.json();
}

// New detailed heritage analysis
export async function analyzeHeritage(/** @type {any} */ polygonGeoJSON) {
  const res = await authFetch('/analyze/heritage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygon: polygonGeoJSON })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Heritage analysis failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Listed buildings analysis
export async function analyzeListedBuildings(/** @type {any} */ polygonGeoJSON) {
  const res = await authFetch('/analyze/listed-buildings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygon: polygonGeoJSON })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Listed buildings analysis failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Conservation areas analysis
export async function analyzeConservationAreas(/** @type {any} */ polygonGeoJSON) {
  const res = await authFetch('/analyze/conservation-areas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygon: polygonGeoJSON })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Conservation areas analysis failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Scheduled monuments analysis
export async function analyzeScheduledMonuments(/** @type {any} */ polygonGeoJSON) {
  const res = await authFetch('/analyze/scheduled-monuments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygon: polygonGeoJSON })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Scheduled monuments analysis failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Landscape analysis (Green Belt, AONB, etc.)
export async function analyzeLandscape(/** @type {any} */ polygonGeoJSON) {
  const res = await authFetch('/analyze/landscape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygon: polygonGeoJSON })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Landscape analysis failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Agricultural land analysis (ALC grades and coverage)
export async function analyzeAgLand(/** @type {any} */ polygonGeoJSON) {
  const res = await authFetch('/analyze/ag-land', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygon: polygonGeoJSON })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Agricultural land analysis failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Renewables analysis (Solar, Wind, Battery developments)
export async function analyzeRenewables(/** @type {any} */ polygonGeoJSON) {
  const res = await authFetch('/analyze/renewables', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygon: polygonGeoJSON })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Renewables analysis failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Ecology analysis (OS Priority Ponds and other ecological features)
export async function analyzeEcology(/** @type {any} */ polygonGeoJSON) {
  const res = await authFetch('/analyze/ecology', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygon: polygonGeoJSON })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ecology analysis failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Trees analysis (Ancient Woodland)
export async function analyzeTrees(/** @type {any} */ polygonGeoJSON) {
  const res = await authFetch('/analyze/trees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygon: polygonGeoJSON })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trees analysis failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Airfields analysis (UK Airports)
export async function analyzeAirfields(/** @type {any} */ polygonGeoJSON) {
  const res = await authFetch('/analyze/airfields', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygon: polygonGeoJSON })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airfields analysis failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Save site analysis for TRP Report
export async function saveSite(/** @type {any} */ siteData) {
  const res = await authFetch('/save-site', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(siteData)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Save site failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Save TRP report edits
export async function saveTRPEdits(/** @type {any} */ trpData) {
  const res = await authFetch('/save-trp-edits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trpData)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Save TRP edits failed: ${res.status} ${text}`);
  }
  return res.json();
}

// ============================================================================
// Analysis Versioning API
// ============================================================================

/**
 * Save the original (automated) analysis
 * @param {Object} analysisData - The complete analysis data
 * @returns {Promise<{success: boolean, originalId: string}>}
 */
export async function saveOriginalAnalysis(/** @type {any} */ analysisData) {
  const res = await authFetch('/api/analysis/save-original', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(analysisData)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Save original analysis failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Save the edited analysis with change reasons
 * @param {string} originalId - The ID of the original analysis
 * @param {Object} analysisData - The edited analysis data
 * @param {Array} changes - Array of changes with reasons
 * @returns {Promise<{success: boolean, editedId: string, changesRecorded: number}>}
 */
export async function saveEditedAnalysis(/** @type {string} */ originalId, /** @type {any} */ analysisData, /** @type {any[]} */ changes = []) {
  const res = await authFetch(`/api/analysis/${originalId}/save-edited`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ analysisData, changes })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Save edited analysis failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Get the full analysis (original + edited + changes)
 * @param {string} originalId - The ID of the original analysis
 * @returns {Promise<{success: boolean, data: {original: any, edited: any, changes: any[]}}>}
 */
export async function getFullAnalysis(/** @type {string} */ originalId) {
  const res = await authFetch(`/api/analysis/${originalId}/full`, {
    method: 'GET'
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Get full analysis failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Get change history for an analysis
 * @param {string} originalId - The ID of the original analysis
 * @returns {Promise<{success: boolean, data: any[], count: number}>}
 */
export async function getAnalysisChanges(/** @type {string} */ originalId) {
  const res = await authFetch(`/api/analysis/${originalId}/changes`, {
    method: 'GET'
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Get analysis changes failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Get analysis by project ID
 * @param {string} projectId - The project ID
 * @returns {Promise<{success: boolean, data: {original: any, edited: any, hasEdits: boolean}}>}
 */
export async function getAnalysisByProject(/** @type {string} */ projectId) {
  const res = await authFetch(`/api/analysis/project/${projectId}`, {
    method: 'GET'
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Get analysis by project failed: ${res.status} ${text}`);
  }
  return res.json();
}

// ============================================================================
// Analysis Session API (Normalized Tables)
// ============================================================================

/**
 * Create a new analysis session with all data (normalized storage)
 * @param {Object} sessionData - The analysis data to save
 * @returns {Promise<{success: boolean, sessionId: string}>}
 */
export async function createAnalysisSession(/** @type {any} */ sessionData) {
  const res = await authFetch('/api/session/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sessionData)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create analysis session failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Get analysis session by project ID (reconstructed for frontend)
 * @param {string} projectId - The project ID
 * @returns {Promise<{success: boolean, data: any}>}
 */
export async function getSessionByProject(/** @type {string} */ projectId) {
  const res = await authFetch(`/api/session/project/${projectId}`, {
    method: 'GET'
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Get session by project failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Get analysis session by ID
 * @param {string} sessionId - The session ID
 * @returns {Promise<{success: boolean, data: any}>}
 */
export async function getSession(/** @type {string} */ sessionId) {
  const res = await authFetch(`/api/session/${sessionId}`, {
    method: 'GET'
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Get session failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Save edit to a discipline
 * @param {string} sessionId - The session ID
 * @param {string} discipline - The discipline name
 * @param {string} editedRisk - The edited risk level
 * @param {string[]} editedRecommendations - The edited recommendations
 * @param {Array} changes - Array of changes to log
 * @returns {Promise<{success: boolean, editId: string}>}
 */
export async function saveSessionEdit(
  /** @type {string} */ sessionId,
  /** @type {string} */ discipline,
  /** @type {string} */ editedRisk,
  /** @type {string[]} */ editedRecommendations,
  /** @type {any[]} */ changes = []
) {
  const res = await authFetch(`/api/session/${sessionId}/edit`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ discipline, editedRisk, editedRecommendations, changes })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Save session edit failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Get change log for a session
 * @param {string} sessionId - The session ID
 * @returns {Promise<{success: boolean, data: any[], count: number}>}
 */
export async function getSessionChanges(/** @type {string} */ sessionId) {
  const res = await authFetch(`/api/session/${sessionId}/changes`, {
    method: 'GET'
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Get session changes failed: ${res.status} ${text}`);
  }
  return res.json();
}
