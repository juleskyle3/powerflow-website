const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || 'powerflow';

const productStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: `${CLOUDINARY_FOLDER}/products`,
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 1200, height: 1200, crop: 'limit' },
      { quality: 'auto' },
    ],
  },
});

const uploadProductImages = multer({
  storage: productStorage,
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024),
    files: 11,
  },
  fileFilter: (req, file, cb) => {
    if (!String(file.mimetype || '').startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  },
});

module.exports = {
  cloudinary,
  CLOUDINARY_FOLDER,
  uploadProductImages,
};
