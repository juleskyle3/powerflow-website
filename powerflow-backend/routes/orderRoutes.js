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
// @access Private/Admin (contains customer PII and invoice access tokens)
router.get('/', [
  authMiddleware.protect,
  authMiddleware.restrictToAdmin,
], orderController.getAllOrders);

// @route  POST /api/orders/:id/send-invoice
// @desc   Resend the order invoice email
// @access Order-specific token (legacy orders without a token remain allowed)
router.post('/:id/send-invoice', [
  param('id').isMongoId().withMessage('Invalid order ID'),
  authMiddleware.rateLimit,
], orderController.resendInvoice);

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
// @access Private/Admin
router.put('/:id', [
  authMiddleware.protect,
  authMiddleware.restrictToAdmin,
], orderController.updateOrderStatus);

// @route  DELETE /api/orders/:id
// @desc   Delete order
// @access Private/Admin
router.delete('/:id', [
  authMiddleware.protect,
  authMiddleware.restrictToAdmin,
  param('id').isMongoId().withMessage('Invalid order ID'),
], orderController.deleteOrder);

// @route  POST /api/orders/:id/delete
// @desc   Delete order (fallback endpoint for clients/environments that block DELETE)
// @access Private/Admin
router.post('/:id/delete', [
  authMiddleware.protect,
  authMiddleware.restrictToAdmin,
  param('id').isMongoId().withMessage('Invalid order ID'),
], orderController.deleteOrder);

module.exports = router;
