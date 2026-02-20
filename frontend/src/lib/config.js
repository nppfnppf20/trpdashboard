/**
 * API Configuration
 * Single source of truth for backend URL
 */

// Get backend URL from environment or use production as fallback
export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://hlpv-web-app-test3.onrender.com';

// Export for easy importing
export default API_BASE_URL;
