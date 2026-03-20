const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { getProductUploadDir } = require('../config/uploads');

const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024);
const ALLOWED_MIME_PREFIX = 'image/';

function sanitizeFilename(filename) {
  const parsed = path.parse(String(filename || 'image'));
  const base = parsed.name.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').slice(0, 48) || 'image';
  const ext = (parsed.ext || '.jpg').toLowerCase();
  return `${base}${ext}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const uploadDir = getProductUploadDir();
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const safeName = sanitizeFilename(file.originalname);
    const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniquePrefix}-${safeName}`);
  },
});

function imageFileFilter(req, file, cb) {
  if (!String(file.mimetype || '').startsWith(ALLOWED_MIME_PREFIX)) {
    return cb(new Error('Only image files are allowed.'));
  }
  return cb(null, true);
}

const productImageUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 11,
  },
  fileFilter: imageFileFilter,
});

module.exports = productImageUpload;
