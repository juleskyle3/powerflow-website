const express = require('express');
const cartController = require('../controllers/cartController');

const router = express.Router();

// @route  POST /api/cart/sync
// @desc   Reserve/adjust the customer's cart stock and return live availability
// @access Public
router.post('/sync', cartController.syncCart);

// @route  DELETE /api/cart/:cartId
// @desc   Release every stock hold for a cart
// @access Public
router.delete('/:cartId', cartController.releaseCart);

module.exports = router;
