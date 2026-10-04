/**
 * Screenshot Manager
 * Handles capturing, storing and managing map screenshots in localStorage
 */

// Storage key prefix
const STORAGE_PREFIX = 'trp_screenshots_';

/**
 * Generate unique screenshot ID
 */
function generateScreenshotId() {
  return 'screenshot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Get storage key for current session
 * Uses a session-specific key to avoid mixing screenshots between different analyses
 */
function getStorageKey() {
  // Create a session-specific key that clears when page is refreshed/new analysis starts
  if (!window.sessionStorage.getItem('screenshot_session_id')) {
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    window.sessionStorage.setItem('screenshot_session_id', sessionId);
  }
  const sessionId = window.sessionStorage.getItem('screenshot_session_id');
  return STORAGE_PREFIX + sessionId;
}

/**
 * Remove every stored screenshot, across all sessions. Called on sign-out so
 * map images of project sites don't stay readable in the browser afterwards.
 */
export function clearAllStoredScreenshots() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
    window.sessionStorage.removeItem('screenshot_session_id');
  } catch (error) {
    console.error('Error clearing screenshots:', error);
  }
}

/**
 * Get all screenshots from localStorage
 */
export function getScreenshots() {
  try {
    const data = localStorage.getItem(getStorageKey());
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading screenshots:', error);
    return [];
  }
}

/**
 * Save screenshot to localStorage
 */
export function saveScreenshot(screenshotData) {
  try {
    const screenshots = getScreenshots();
    const newScreenshot = {
      id: generateScreenshotId(),
      timestamp: new Date().toISOString(),
      ...screenshotData
    };

    screenshots.push(newScreenshot);
    localStorage.setItem(getStorageKey(), JSON.stringify(screenshots));

    console.log('📷 Screenshot saved:', newScreenshot.id);

    // Dispatch custom event to notify components that a screenshot was added
    window.dispatchEvent(new CustomEvent('screenshotAdded', {
      detail: { screenshot: newScreenshot }
    }));

    return newScreenshot;
  } catch (error) {
    console.error('Error saving screenshot:', error);
    throw error;
  }
}

/**
 * Delete screenshot by ID
 */
export function deleteScreenshot(screenshotId) {
  try {
    const screenshots = getScreenshots();
    const filtered = screenshots.filter(s => s.id !== screenshotId);
    localStorage.setItem(getStorageKey(), JSON.stringify(filtered));

    console.log('🗑️ Screenshot deleted:', screenshotId);
    return true;
  } catch (error) {
    console.error('Error deleting screenshot:', error);
    return false;
  }
}

/**
 * Get screenshots by section
 */
export function getScreenshotsBySection(section) {
  const screenshots = getScreenshots();
  return screenshots.filter(s => s.section === section);
}

/**
 * Update screenshot data (caption, section, etc.)
 */
export function updateScreenshot(screenshotId, updates) {
  try {
    const screenshots = getScreenshots();
    const index = screenshots.findIndex(s => s.id === screenshotId);

    if (index !== -1) {
      screenshots[index] = { ...screenshots[index], ...updates };
      localStorage.setItem(getStorageKey(), JSON.stringify(screenshots));
      console.log('📝 Screenshot updated:', screenshotId);
      return screenshots[index];
    }

    throw new Error('Screenshot not found');
  } catch (error) {
    console.error('Error updating screenshot:', error);
    throw error;
  }
}

/**
 * Clear all screenshots
 */
export function clearAllScreenshots() {
  try {
    localStorage.removeItem(getStorageKey());
    console.log('🧹 All screenshots cleared');
    return true;
  } catch (error) {
    console.error('Error clearing screenshots:', error);
    return false;
  }
}

/**
 * Start a new screenshot session (clears existing session)
 */
export function startNewScreenshotSession() {
  try {
    // Clear current screenshots
    clearAllScreenshots();

    // Generate new session ID
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    window.sessionStorage.setItem('screenshot_session_id', sessionId);

    console.log('🔄 Started new screenshot session:', sessionId);
    return true;
  } catch (error) {
    console.error('Error starting new screenshot session:', error);
    return false;
  }
}

/**
 * Get storage usage info
 */
export function getStorageInfo() {
  try {
    const screenshots = getScreenshots();
    const dataStr = localStorage.getItem(getStorageKey()) || '';
    const sizeInBytes = new Blob([dataStr]).size;
    const sizeInMB = (sizeInBytes / 1024 / 1024).toFixed(2);

    return {
      count: screenshots.length,
      sizeInBytes,
      sizeInMB,
      maxSizeEstimate: '5-10MB' // localStorage typical limit
    };
  } catch (error) {
    console.error('Error getting storage info:', error);
    return null;
  }
}

/**
 * Capture screenshot from Leaflet map
 * @param {import('leaflet').Map} map - Leaflet map instance
 * @param {Object} options - Capture options
 * @returns {Promise<Object>} Screenshot data
 */
export async function captureMapScreenshot(map, options = {}) {
  const {
    section = 'general',
    caption = '',
    quality = 0.8,
    format = 'image/png'
  } = options;

  try {
    let base64;
    let canvas;

    // Use leaflet-image to capture just the map and layers
    console.log('📷 Capturing map with leaflet-image...');
    const leafletImage = await import('leaflet-image');

    canvas = await new Promise((resolve, reject) => {
      leafletImage.default(map, (err, canvasResult) => {
        if (err) {
          console.error('❌ leaflet-image failed:', err);
          reject(err);
        } else {
          console.log('✅ leaflet-image captured successfully');
          resolve(canvasResult);
        }
      });
    });

    base64 = canvas.toDataURL(format, quality);
    console.log('✅ Successfully captured with leaflet-image');

    // Create screenshot data
    const screenshotData = {
      base64,
      caption,
      section,
      width: canvas.width,
      height: canvas.height,
      format,
      mapCenter: map.getCenter(),
      mapZoom: map.getZoom(),
      mapBounds: map.getBounds()
    };

    // Save to localStorage
    return saveScreenshot(screenshotData);

  } catch (error) {
    console.error('Error capturing screenshot:', error);
    throw error;
  }
}