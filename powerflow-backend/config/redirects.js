const DEFAULT_FRONTEND_URL = 'http://localhost:3000';
const DEFAULT_ADMIN_ORDERS_PATH = '/admin/pages/orders.html';

function parseUrlOrFallback(candidate, fallbackUrl) {
  const raw = String(candidate || '').trim();
  if (!raw) {
    return new URL(fallbackUrl);
  }

  try {
    return new URL(raw);
  } catch (error) {
    return new URL(fallbackUrl);
  }
}

function getDefaultAdminOrdersUrl() {
  const frontendBase = parseUrlOrFallback(process.env.FRONTEND_URL, DEFAULT_FRONTEND_URL);
  return new URL(DEFAULT_ADMIN_ORDERS_PATH, frontendBase).toString();
}

function getGoogleOAuthSuccessRedirectUrl() {
  const fallback = getDefaultAdminOrdersUrl();
  return parseUrlOrFallback(
    process.env.GOOGLE_OAUTH_SUCCESS_REDIRECT_URL
      || process.env.ADMIN_ORDERS_URL
      || process.env.FRONTEND_ADMIN_ORDERS_URL,
    fallback
  ).toString();
}

function getGoogleOAuthErrorRedirectUrl() {
  const fallback = getDefaultAdminOrdersUrl();
  return parseUrlOrFallback(
    process.env.GOOGLE_OAUTH_ERROR_REDIRECT_URL
      || process.env.GOOGLE_OAUTH_SUCCESS_REDIRECT_URL
      || process.env.ADMIN_ORDERS_URL
      || process.env.FRONTEND_ADMIN_ORDERS_URL,
    fallback
  ).toString();
}

function appendQueryParams(urlString, params = {}) {
  const url = new URL(urlString);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

module.exports = {
  getDefaultAdminOrdersUrl,
  getGoogleOAuthSuccessRedirectUrl,
  getGoogleOAuthErrorRedirectUrl,
  appendQueryParams,
};
