const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middleware/authMiddleware');
const { param } = require('express-validator');

// @route  POST /api/orders
// @desc   Create new order
// @access Public (temporarily for testing)
router.post('/', orderController.createOrder);

// @route  GET /api/orders
// @desc   Get all orders
// @access Public (temporarily for testing)
router.get('/', orderController.getAllOrders);

// @route  GET /api/orders/:id/invoice
// @desc   Download invoice PDF
// @access Public
router.get('/:id/invoice', orderController.downloadInvoice);

// @route  GET /api/orders/stats
// @desc   Get order statistics (admin only)
// @access Private/Admin
router.get('/stats', [
  authMiddleware.protect,
  authMiddleware.restrictToAdmin,
], orderController.getOrderStats);

// @route  GET /api/orders/:id
// @desc   Get single order by ID
// @access Private
router.get('/:id', [
  authMiddleware.protect,
  param('id').isMongoId().withMessage('Invalid order ID'),
], orderController.getOrderById);

// @route  PUT /api/orders/:id
// @desc   Update order status
// @access Public (temporarily for testing)
router.put('/:id', orderController.updateOrderStatus);

// @route  DELETE /api/orders/:id
// @desc   Delete order
// @access Public (temporarily for testing)
router.delete('/:id', [
  param('id').isMongoId().withMessage('Invalid order ID'),
], orderController.deleteOrder);

// @route  POST /api/orders/:id/delete
// @desc   Delete order (fallback endpoint for clients/environments that block DELETE)
// @access Public (temporarily for testing)
router.post('/:id/delete', [
  param('id').isMongoId().withMessage('Invalid order ID'),
], orderController.deleteOrder);

module.exports = router;
