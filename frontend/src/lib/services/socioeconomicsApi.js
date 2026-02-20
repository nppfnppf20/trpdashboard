import { authFetch } from '$lib/api/client.js';

/**
 * Analyze socioeconomics data for a given polygon
 * @param {Object} polygon - GeoJSON polygon
 * @returns {Promise<Object>} Socioeconomics analysis results
 */
export async function analyzeSocioeconomics(polygon) {
  const response = await authFetch('/analyze/socioeconomics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ polygon }),
  });

  if (!response.ok) {
    throw new Error(`Socioeconomics analysis failed: ${response.status}`);
  }

  return response.json();
}