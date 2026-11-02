const mongoose = require('mongoose');
const Product = require('../models/Product');
const StockReservation = require('../models/StockReservation');
const { AppError } = require('../middleware/errorMiddleware');

const DEFAULT_RESERVATION_MINUTES = 15;
const MAX_RESERVATION_MINUTES = 120;
const MAX_CART_ITEMS = 50;
const MAX_ITEM_QUANTITY = 999;
const CLEANUP_BATCH_SIZE = 250;

// All stock mutations are serialized inside this process. PM2 runs a single
// backend fork, so this is enough to keep the reservation counter consistent.
let operationQueue = Promise.resolve();
let janitorTimer = null;
let reconcileTimer = null;

function getReservationMinutes() {
  const configured = Number(process.env.CART_RESERVATION_MINUTES);
  const minutes = Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_RESERVATION_MINUTES;

  return Math.min(Math.max(Math.round(minutes), 1), MAX_RESERVATION_MINUTES);
}

function getReservationTtlMs() {
  return getReservationMinutes() * 60 * 1000;
}

function withStockLock(task) {
  const run = operationQueue.then(task, task);
  operationQueue = run.catch(() => {});
  return run;
}

function sanitizeCartId(value) {
  const cartId = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(cartId)) {
    throw new AppError('A valid cartId is required to reserve stock.', 400);
  }
  return cartId;
}

function normalizeCartItems(rawItems) {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  const merged = new Map();

  rawItems.slice(0, MAX_CART_ITEMS).forEach((rawItem) => {
    const productId = String(rawItem?.productId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return;
    }

    const quantity = Math.floor(Number(rawItem?.quantity) || 0);
    if (quantity <= 0) {
      return;
    }

    const nextQuantity = Math.min(
      MAX_ITEM_QUANTITY,
      (merged.get(productId) || 0) + quantity
    );

    merged.set(productId, nextQuantity);
  });

  return Array.from(merged.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

function calculateAvailableStock(product) {
  return Math.max(
    0,
    Math.floor(Number(product?.stock || 0) - Number(product?.reserved || 0))
  );
}

async function changeReservedStock(productId, delta) {
  if (!delta) {
    return null;
  }

  if (delta > 0) {
    // Atomic guard: never reserve more units than are currently available.
    return Product.findOneAndUpdate(
      {
        _id: productId,
        isActive: true,
        $expr: {
          $gte: [
            {
              $subtract: [
                { $ifNull: ['$stock', 0] },
                { $ifNull: ['$reserved', 0] },
              ],
            },
            delta,
          ],
        },
      },
      { $inc: { reserved: delta } },
      { new: true }
    );
  }

  await Product.updateOne({ _id: productId }, { $inc: { reserved: delta } });
  // Recover from any historical drift instead of leaving a negative counter.
  await Product.updateOne(
    { _id: productId, reserved: { $lt: 0 } },
    { $set: { reserved: 0 } }
  );

  return null;
}

async function releaseReservationDoc(reservation) {
  const deleted = await StockReservation.findOneAndDelete({ _id: reservation._id });
  if (!deleted) {
    return false;
  }

  await changeReservedStock(deleted.productId, -deleted.quantity);
  return true;
}

async function releaseExpiredReservationsUnlocked() {
  const now = new Date();
  let releasedCount = 0;

  // Drain in small batches so a long outage cannot block the event loop.
  for (let batch = 0; batch < 10; batch += 1) {
    // eslint-disable-next-line no-await-in-loop
    const expired = await StockReservation.find({ expiresAt: { $lte: now } })
      .limit(CLEANUP_BATCH_SIZE);

    if (expired.length === 0) {
      break;
    }

    for (const reservation of expired) {
      // eslint-disable-next-line no-await-in-loop
      await releaseReservationDoc(reservation);
      releasedCount += 1;
    }
  }

  return releasedCount;
}

function releaseExpiredReservations() {
  return withStockLock(releaseExpiredReservationsUnlocked);
}

async function releaseCartReservationsUnlocked(cartId) {
  const reservations = await StockReservation.find({ cartId });
  let releasedCount = 0;

  for (const reservation of reservations) {
    // eslint-disable-next-line no-await-in-loop
    const released = await releaseReservationDoc(reservation);
    if (released) {
      releasedCount += 1;
    }
  }

  return releasedCount;
}

function releaseCartReservations(cartId) {
  const cleanCartId = sanitizeCartId(cartId);
  return withStockLock(() => releaseCartReservationsUnlocked(cleanCartId));
}

async function syncCartUnlocked(cartId, rawItems) {
  await releaseExpiredReservationsUnlocked();

  const desiredItems = normalizeCartItems(rawItems);
  const desiredIds = new Set(desiredItems.map((item) => item.productId));
  const existingReservations = await StockReservation.find({ cartId });
  const existingByProduct = new Map(
    existingReservations.map((reservation) => [String(reservation.productId), reservation])
  );

  // Release anything the customer removed from the cart.
  for (const reservation of existingReservations) {
    if (!desiredIds.has(String(reservation.productId))) {
      // eslint-disable-next-line no-await-in-loop
      await releaseReservationDoc(reservation);
      existingByProduct.delete(String(reservation.productId));
    }
  }

  const expiresAt = new Date(Date.now() + getReservationTtlMs());
  const items = [];
  const adjustments = [];

  for (const item of desiredItems) {
    // eslint-disable-next-line no-await-in-loop
    const product = await Product.findOne({ _id: item.productId, isActive: true });
    const existingReservation = existingByProduct.get(item.productId);
    const currentQuantity = existingReservation?.quantity || 0;

    if (!product) {
      if (existingReservation) {
        // eslint-disable-next-line no-await-in-loop
        await releaseReservationDoc(existingReservation);
      }

      adjustments.push({
        productId: item.productId,
        requested: item.quantity,
        quantity: 0,
        reason: 'product-unavailable',
      });
      items.push({
        productId: item.productId,
        quantity: 0,
        availableStock: 0,
        stock: 0,
      });
      continue;
    }

    const physicalStock = Math.max(0, Math.floor(Number(product.stock || 0)));
    let targetQuantity = Math.min(item.quantity, physicalStock);
    let reservedDeltaApplied = 0;

    if (targetQuantity < item.quantity) {
      adjustments.push({
        productId: item.productId,
        requested: item.quantity,
        quantity: targetQuantity,
        reason: 'insufficient-stock',
      });
    }

    if (targetQuantity > currentQuantity) {
      const delta = targetQuantity - currentQuantity;
      // eslint-disable-next-line no-await-in-loop
      const updated = await changeReservedStock(product._id, delta);

      if (updated) {
        reservedDeltaApplied = delta;
      } else {
        // Another cart took the remaining units between our read and the
        // atomic update. Keep what this cart already holds and add only what
        // is still genuinely available.
        // eslint-disable-next-line no-await-in-loop
        const freshProduct = await Product.findById(product._id);
        const available = calculateAvailableStock(freshProduct);
        const extra = Math.max(0, Math.min(item.quantity - currentQuantity, available));

        if (extra > 0) {
          // eslint-disable-next-line no-await-in-loop
          const retried = await changeReservedStock(product._id, extra);
          if (retried) {
            targetQuantity = currentQuantity + extra;
            reservedDeltaApplied = extra;
          } else {
            targetQuantity = currentQuantity;
          }
        } else {
          targetQuantity = currentQuantity;
        }

        if (targetQuantity < item.quantity) {
          adjustments.push({
            productId: item.productId,
            requested: item.quantity,
            quantity: targetQuantity,
            reason: 'insufficient-stock',
          });
        }
      }
    } else if (targetQuantity < currentQuantity) {
      // eslint-disable-next-line no-await-in-loop
      await changeReservedStock(product._id, -(currentQuantity - targetQuantity));
    }

    if (targetQuantity <= 0) {
      if (existingReservation) {
        // The counter was already adjusted above; only remove the document.
        // eslint-disable-next-line no-await-in-loop
        await StockReservation.deleteOne({ _id: existingReservation._id });
      }

      items.push({
        productId: item.productId,
        quantity: 0,
        availableStock: calculateAvailableStock(product),
        stock: physicalStock,
        name: product.name,
        price: product.price,
        image: product.image,
      });
      continue;
    }

    let reservation;
    try {
      // eslint-disable-next-line no-await-in-loop
      reservation = await StockReservation.findOneAndUpdate(
        { cartId, productId: product._id },
        {
          $set: { quantity: targetQuantity, expiresAt },
          $setOnInsert: { cartId, productId: product._id },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (reservedDeltaApplied > 0) {
        // eslint-disable-next-line no-await-in-loop
        await changeReservedStock(product._id, -reservedDeltaApplied);
      }
      throw error;
    }

    // eslint-disable-next-line no-await-in-loop
    const freshProduct = await Product.findById(product._id);
    items.push({
      productId: item.productId,
      quantity: reservation.quantity,
      availableStock: calculateAvailableStock(freshProduct),
      stock: Math.max(0, Math.floor(Number(freshProduct?.stock || 0))),
      name: freshProduct?.name || product.name,
      price: freshProduct?.price ?? product.price,
      image: freshProduct?.image || product.image || '',
      expiresAt: reservation.expiresAt,
    });
  }

  return {
    cartId,
    items,
    adjustments,
    expiresAt,
    reservationMinutes: getReservationMinutes(),
  };
}

function syncCart(cartId, items) {
  const cleanCartId = sanitizeCartId(cartId);
  return withStockLock(() => syncCartUnlocked(cleanCartId, items));
}

async function restoreConsumedStockUnlocked(appliedItems) {
  if (!Array.isArray(appliedItems) || appliedItems.length === 0) {
    return;
  }

  await Promise.all(
    appliedItems.map((item) => Product.updateOne(
      { _id: item.productId },
      { $inc: { stock: item.quantity } }
    ))
  );
}

function restoreConsumedStock(appliedItems) {
  return withStockLock(() => restoreConsumedStockUnlocked(appliedItems));
}

async function consumeCartStockUnlocked(cartId, rawItems) {
  await releaseExpiredReservationsUnlocked();

  const cleanCartId = cartId ? sanitizeCartId(cartId) : null;

  // Merge duplicate lines so the availability check matches the quantity that
  // is actually removed from stock.
  const merged = new Map();
  (Array.isArray(rawItems) ? rawItems : []).forEach((item) => {
    const productId = String(item?.productId || '').trim();
    const quantity = Math.floor(Number(item?.quantity) || 0);

    if (!mongoose.Types.ObjectId.isValid(productId) || quantity <= 0) {
      return;
    }

    const existing = merged.get(productId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      merged.set(productId, {
        productId,
        quantity,
        productName: String(item?.productName || ''),
      });
    }
  });

  const items = Array.from(merged.values());
  if (items.length === 0) {
    return [];
  }

  const reservations = cleanCartId
    ? await StockReservation.find({ cartId: cleanCartId })
    : [];
  const heldByProduct = new Map(
    reservations.map((reservation) => [
      String(reservation.productId),
      Math.max(0, Math.floor(Number(reservation.quantity) || 0)),
    ])
  );

  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await Product.find({ _id: { $in: productIds }, isActive: true });
  const productsById = new Map(products.map((product) => [String(product._id), product]));

  // Validate every line before mutating anything. The cart's own hold counts
  // toward what this order may take, but other carts' holds do not.
  for (const item of items) {
    const product = productsById.get(item.productId);
    if (!product) {
      throw new AppError(`Product not found for ID ${item.productId}`, 404);
    }

    const held = heldByProduct.get(item.productId) || 0;
    const availableForOrder = calculateAvailableStock(product) + held;

    if (availableForOrder < item.quantity) {
      throw new AppError(
        `Insufficient stock for ${product.name}. Remaining stock: ${availableForOrder}`,
        409
      );
    }
  }

  const applied = [];

  try {
    for (const item of items) {
      const held = heldByProduct.get(item.productId) || 0;

      // Atomically consume physical stock. Other carts' holds must remain
      // covered after the sale, and this cart's hold is released separately.
      // eslint-disable-next-line no-await-in-loop
      const updated = await Product.findOneAndUpdate(
        {
          _id: item.productId,
          isActive: true,
          $expr: {
            $and: [
              { $gte: [{ $ifNull: ['$stock', 0] }, item.quantity] },
              { $gte: [{ $ifNull: ['$reserved', 0] }, held] },
              {
                $gte: [
                  {
                    $subtract: [
                      { $ifNull: ['$stock', 0] },
                      { $ifNull: ['$reserved', 0] },
                    ],
                  },
                  item.quantity - held,
                ],
              },
            ],
          },
        },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );

      if (!updated) {
        const product = productsById.get(item.productId);
        throw new AppError(
          `Unable to reserve stock for ${product?.name || item.productName || 'this product'}. Please retry.`,
          409
        );
      }

      applied.push({ productId: item.productId, quantity: item.quantity });
    }
  } catch (error) {
    await restoreConsumedStockUnlocked(applied);
    throw error;
  }

  // The order now owns these units, so drop the cart's temporary holds. This
  // also decrements Product.reserved for each released reservation.
  if (cleanCartId) {
    try {
      await releaseCartReservationsUnlocked(cleanCartId);
    } catch (error) {
      // Stock is already sold; the janitor will clear the leftover holds when
      // they expire. Never fail a placed order because of cleanup.
      console.error('Failed to release cart reservations after order:', error.message);
    }
  }

  return applied;
}

function consumeCartStock(cartId, items) {
  return withStockLock(() => consumeCartStockUnlocked(cartId, items));
}

async function reconcileReservedStockUnlocked() {
  const activeReservations = await StockReservation.aggregate([
    { $match: { expiresAt: { $gt: new Date() } } },
    {
      $group: {
        _id: '$productId',
        reserved: { $sum: '$quantity' },
      },
    },
  ]);

  const reservedByProduct = new Map(
    activeReservations.map((row) => [String(row._id), row.reserved])
  );
  const activeProductIds = activeReservations.map((row) => row._id);
  const query = activeProductIds.length > 0
    ? { $or: [{ reserved: { $gt: 0 } }, { reserved: { $lt: 0 } }, { _id: { $in: activeProductIds } }] }
    : { $or: [{ reserved: { $gt: 0 } }, { reserved: { $lt: 0 } }] };

  const products = await Product.find(query).select('_id reserved');
  const operations = products
    .map((product) => {
      const expected = reservedByProduct.get(String(product._id)) || 0;
      if (Number(product.reserved || 0) === expected) {
        return null;
      }

      return {
        updateOne: {
          filter: { _id: product._id },
          update: { $set: { reserved: expected } },
        },
      };
    })
    .filter(Boolean);

  if (operations.length > 0) {
    await Product.bulkWrite(operations, { ordered: false });
  }

  return operations.length;
}

function reconcileReservedStock() {
  return withStockLock(reconcileReservedStockUnlocked);
}

function startReservationJanitor() {
  if (janitorTimer) {
    return janitorTimer;
  }

  const tick = () => {
    releaseExpiredReservations().catch((error) => {
      console.error('Stock reservation cleanup failed:', error.message);
    });
  };

  janitorTimer = setInterval(tick, 60 * 1000);
  if (typeof janitorTimer.unref === 'function') {
    janitorTimer.unref();
  }

  // Repair any counter drift left by a crash/restart.
  setTimeout(() => {
    reconcileReservedStock().catch((error) => {
      console.error('Stock reservation reconcile failed:', error.message);
    });
  }, 5000).unref?.();

  reconcileTimer = setInterval(() => {
    reconcileReservedStock().catch((error) => {
      console.error('Stock reservation reconcile failed:', error.message);
    });
  }, 10 * 60 * 1000);
  if (typeof reconcileTimer.unref === 'function') {
    reconcileTimer.unref();
  }

  tick();
  return janitorTimer;
}

module.exports = {
  MAX_CART_ITEMS,
  MAX_ITEM_QUANTITY,
  calculateAvailableStock,
  consumeCartStock,
  getReservationMinutes,
  getReservationTtlMs,
  normalizeCartItems,
  reconcileReservedStock,
  releaseCartReservations,
  releaseExpiredReservations,
  restoreConsumedStock,
  sanitizeCartId,
  startReservationJanitor,
  syncCart,
  withStockLock,
};
