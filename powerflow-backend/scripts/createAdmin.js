/**
 * Create (or promote) an admin account for the admin portal.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='strong-password' \
 *     node scripts/createAdmin.js
 *
 * Optional:
 *   ADMIN_NAME="Power Flow Admin"
 *   ADMIN_UPDATE_PASSWORD=true   # reset the password of an existing account
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  const name = String(process.env.ADMIN_NAME || 'Power Flow Admin').trim();
  const updatePassword = String(process.env.ADMIN_UPDATE_PASSWORD || '').toLowerCase() === 'true';

  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD before running this script.');
    process.exit(1);
  }

  if (password.length < 10) {
    console.error('ADMIN_PASSWORD must be at least 10 characters long.');
    process.exit(1);
  }

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not configured.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });

  try {
    let user = await User.findOne({ email });
    let created = false;

    if (!user) {
      user = new User({
        name,
        email,
        password,
        role: 'admin',
        isActive: true,
      });
      await user.save();
      created = true;
    } else {
      user.name = name || user.name;
      user.role = 'admin';
      user.isActive = true;
      if (updatePassword) {
        user.password = password;
      }
      await user.save();
    }

    console.log(`${created ? 'Created' : 'Updated'} admin account: ${user.email} (role: ${user.role})`);
    if (!created && !updatePassword) {
      console.log('Password unchanged. Set ADMIN_UPDATE_PASSWORD=true to reset it.');
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Failed to create admin:', error.message);
  process.exit(1);
});
