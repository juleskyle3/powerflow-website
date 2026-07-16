require('dotenv').config();
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');
const Product = require('../models/Product');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || 'powerflow';
const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets', 'images', 'equipment');

async function uploadImageToCloudinary(localPath, productName) {
  try {
    const result = await cloudinary.uploader.upload(localPath, {
      folder: `${CLOUDINARY_FOLDER}/products`,
      public_id: productName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      transformation: [
        { width: 1200, height: 1200, crop: 'limit' },
        { quality: 'auto' },
      ],
    });
    return result.secure_url;
  } catch (error) {
    console.error(`  Failed to upload ${localPath}:`, error.message);
    return null;
  }
}

function isDataUri(str) {
  return str && str.startsWith('data:');
}

function isCloudinaryUrl(str) {
  return str && str.startsWith('http') && str.includes('cloudinary');
}

async function migrateImages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log(`Looking for images in: ${ASSETS_DIR}\n`);

    if (!fs.existsSync(ASSETS_DIR)) {
      console.error('Assets directory not found!');
      process.exit(1);
    }

    const products = await Product.find({});
    console.log(`Found ${products.length} products\n`);

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const product of products) {
      console.log(`Processing: ${product.name}`);

      if (!product.image) {
        console.log(`  No image set - skipping\n`);
        skipped++;
        continue;
      }

      if (isCloudinaryUrl(product.image)) {
        console.log(`  Already on Cloudinary - skipping\n`);
        skipped++;
        continue;
      }

      if (isDataUri(product.image)) {
        console.log(`  SVG placeholder (data URI) - skipping\n`);
        skipped++;
        continue;
      }

      const filename = path.basename(product.image);
      const localPath = path.join(ASSETS_DIR, filename);

      if (fs.existsSync(localPath)) {
        const cloudUrl = await uploadImageToCloudinary(localPath, product.name);
        if (cloudUrl) {
          product.image = cloudUrl;
          await product.save();
          migrated++;
          console.log(`  Uploaded to Cloudinary: ${cloudUrl}\n`);
        } else {
          failed++;
        }
      } else {
        console.log(`  File not found: ${filename} - skipping\n`);
        skipped++;
      }
    }

    console.log('--- Migration Complete ---');
    console.log(`Migrated: ${migrated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateImages();
