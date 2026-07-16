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
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'products');

async function uploadImageToCloudinary(localPath) {
  try {
    const result = await cloudinary.uploader.upload(localPath, {
      folder: `${CLOUDINARY_FOLDER}/products`,
      transformation: [
        { width: 1200, height: 1200, crop: 'limit' },
        { quality: 'auto' },
      ],
    });
    return result.secure_url;
  } catch (error) {
    console.error(`Failed to upload ${localPath}:`, error.message);
    return null;
  }
}

async function migrateImages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const products = await Product.find({});
    console.log(`Found ${products.length} products`);

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const product of products) {
      console.log(`\nProcessing: ${product.name}`);

      let updated = false;

      if (product.image && !product.image.startsWith('http')) {
        const localPath = path.join(UPLOAD_DIR, path.basename(product.image));
        if (fs.existsSync(localPath)) {
          const cloudUrl = await uploadImageToCloudinary(localPath);
          if (cloudUrl) {
            product.image = cloudUrl;
            updated = true;
            migrated++;
            console.log(`  Migrated primary image`);
          } else {
            failed++;
          }
        } else {
          console.log(`  Local file not found: ${localPath}`);
          skipped++;
        }
      } else if (product.image && product.image.startsWith('http')) {
        console.log(`  Already using Cloudinary URL`);
        skipped++;
      }

      if (product.images && product.images.length > 0) {
        const newImages = [];
        for (const img of product.images) {
          if (img && !img.startsWith('http')) {
            const localPath = path.join(UPLOAD_DIR, path.basename(img));
            if (fs.existsSync(localPath)) {
              const cloudUrl = await uploadImageToCloudinary(localPath);
              if (cloudUrl) {
                newImages.push(cloudUrl);
                migrated++;
                console.log(`  Migrated gallery image`);
              } else {
                failed++;
              }
            } else {
              console.log(`  Local gallery file not found: ${localPath}`);
              skipped++;
            }
          } else {
            newImages.push(img);
          }
        }
        product.images = newImages;
        updated = true;
      }

      if (updated) {
        await product.save();
        console.log(`  Updated product in database`);
      }
    }

    console.log('\n--- Migration Complete ---');
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
