const path = require('path');

const DEFAULT_FRONTEND_URL = 'http://localhost:3000';
const DEFAULT_BACKEND_URL = 'http://localhost:3001';
const DEFAULT_UPLOAD_ROOT = './public/uploads';
const DEFAULT_UPLOAD_PUBLIC_PREFIX = '/uploads';
const DEFAULT_PRODUCT_SUBDIR = 'products';

function normalizePathSegment(value, fallback) {
  const raw = String(value || fallback || '').trim();
  return raw.replace(/^\/+|\/+$/g, '') || fallback;
}

function getUploadRootDir() {
  const configured = process.env.UPLOAD_PATH || DEFAULT_UPLOAD_ROOT;
  return path.resolve(process.cwd(), configured);
}

function getUploadPublicPrefix() {
  const raw = String(process.env.UPLOAD_PUBLIC_PREFIX || DEFAULT_UPLOAD_PUBLIC_PREFIX).trim();
  if (!raw) return DEFAULT_UPLOAD_PUBLIC_PREFIX;
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeadingSlash.replace(/\/+$/, '') || DEFAULT_UPLOAD_PUBLIC_PREFIX;
}

function getProductUploadSubdir() {
  return normalizePathSegment(process.env.PRODUCT_UPLOAD_SUBDIR, DEFAULT_PRODUCT_SUBDIR);
}

function getProductUploadDir() {
  return path.join(getUploadRootDir(), getProductUploadSubdir());
}

function getProductUploadPublicPath() {
  return `${getUploadPublicPrefix()}/${getProductUploadSubdir()}`.replace(/\/{2,}/g, '/');
}

function getFrontendBaseUrl() {
  return String(process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL).replace(/\/+$/, '');
}

function getBackendBaseUrl(req) {
  const configured = String(process.env.PRODUCT_UPLOAD_BASE_URL || process.env.BACKEND_PUBLIC_URL || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  if (req) {
    return `${req.protocol}://${req.get('host')}`.replace(/\/+$/, '');
  }

  return DEFAULT_BACKEND_URL;
}

function buildProductFileUrl(req, filename) {
  const safeFilename = encodeURIComponent(String(filename || '').trim());
  return `${getBackendBaseUrl(req)}${getProductUploadPublicPath()}/${safeFilename}`;
}

module.exports = {
  getUploadRootDir,
  getUploadPublicPrefix,
  getProductUploadSubdir,
  getProductUploadDir,
  getProductUploadPublicPath,
  getFrontendBaseUrl,
  getBackendBaseUrl,
  buildProductFileUrl,
};
