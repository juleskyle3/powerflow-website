// Site Configuration
window.APP_CONFIG = {
  // Backend API URL (Production)
  API_BASE_URL: 'https://api.powerflowservicesltd.com/api',
  
  // Local development
  API_BASE_URL_LOCAL: 'http://localhost:5050/api',
  
  // Site URLs
  SITE_URL: 'https://powerflowservicesltd.com',
  ADMIN_URL: 'https://admin.powerflowservicesltd.com',
};

// Auto-detect environment
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.APP_CONFIG.API_BASE_URL = window.APP_CONFIG.API_BASE_URL_LOCAL;
}
