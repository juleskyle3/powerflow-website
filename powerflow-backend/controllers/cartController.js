const stockService = require('../services/stockService');

const cartController = {};

// @route  POST /api/cart/sync
// @desc   Reserve/adjust the customer's cart stock and return live availability
// @access Public
cartController.syncCart = async (req, res, next) => {
  try {
    const result = await stockService.syncCart(req.body?.cartId, req.body?.items);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// @route  DELETE /api/cart/:cartId
// @desc   Release every stock hold for a cart
// @access Public
cartController.releaseCart = async (req, res, next) => {
  try {
    const released = await stockService.releaseCartReservations(req.params.cartId);
    res.status(200).json({
      success: true,
      message: 'Cart stock released',
      data: { released },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = cartController;
