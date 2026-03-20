/* eslint-disable no-console */
require('dotenv').config();

const mongoose = require('mongoose');
const Product = require('../models/Product');

function must(value, name) {
  const v = String(value || '').trim();
  if (!v) throw new Error(`Missing required ${name}`);
  return v;
}

function normalizeOrigin(origin) {
  const raw = String(origin || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  // Allow passing just a hostname.
  if (!/^https?:\/\//i.test(raw)) return `https://${raw}`;
  return raw;
}

function rewriteUrl(url, fromOrigin, toOrigin) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/')) {
    // Keep relative URLs unchanged.
    return raw;
  }

  // Only rewrite /uploads URLs.
  try {
    const parsed = new URL(raw);
    const origin = parsed.origin.replace(/\/+$/, '');
    if (origin !== fromOrigin) return raw;
    if (!parsed.pathname.startsWith('/uploads/')) return raw;
    return `${toOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (_) {
    return raw;
  }
}

async function main() {
  const mongoUri = must(process.env.MONGODB_URI, 'MONGODB_URI');
  const from = normalizeOrigin(must(process.env.FROM_ORIGIN, 'FROM_ORIGIN'));
  const to = normalizeOrigin(must(process.env.TO_ORIGIN, 'TO_ORIGIN'));
  const dryRun = String(process.env.DRY_RUN || 'true').toLowerCase() !== 'false';

  await mongoose.connect(mongoUri);

  const cursor = Product.find({}).cursor();
  let scanned = 0;
  let updated = 0;

  for await (const product of cursor) {
    scanned += 1;
    const nextImage = rewriteUrl(product.image, from, to);
    const nextImages = Array.isArray(product.images)
      ? product.images.map((u) => rewriteUrl(u, from, to))
      : [];

    const changed = nextImage !== (product.image || '')
      || JSON.stringify(nextImages) !== JSON.stringify(product.images || []);

    if (!changed) continue;

    updated += 1;
    if (!dryRun) {
      product.image = nextImage;
      product.images = nextImages;
      // eslint-disable-next-line no-await-in-loop
      await product.save();
    }
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun,
    scanned,
    updated,
    fromOrigin: from,
    toOrigin: to,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

