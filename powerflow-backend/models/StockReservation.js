const mongoose = require('mongoose');

/**
 * A temporary hold on a product while it sits in a customer's cart.
 *
 * Product.stock stays as the physical stock on hand. Product.reserved is a
 * counter cache of the active reservations, which keeps stock checks atomic
 * without needing MongoDB transactions.
 */
const stockReservationSchema = new mongoose.Schema({
  cartId: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
}, {
  timestamps: true,
});

stockReservationSchema.index({ cartId: 1, productId: 1 }, { unique: true });

const StockReservation = mongoose.model('StockReservation', stockReservationSchema);

module.exports = StockReservation;
