// Default to production URL, override with environment variable if present
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://prompt-tiles-api.minhung-shih.workers.dev';

// Export configuration
export { API_BASE_URL };
