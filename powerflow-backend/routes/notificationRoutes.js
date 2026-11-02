const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

// @route  GET /api/notifications/status
// @desc   Report admin alert configuration (no secrets returned)
// @access Private/Admin
router.get('/status', [
  authMiddleware.protect,
  authMiddleware.restrictToAdmin,
], notificationController.getStatus);

// @route  POST /api/notifications/test
// @desc   Send a test email and/or SMS to the configured admin recipients
// @access Private/Admin
router.post('/test', [
  authMiddleware.protect,
  authMiddleware.restrictToAdmin,
  authMiddleware.rateLimit,
  body('channel').optional().isIn(['email', 'sms', 'both']).withMessage('Channel must be email, sms, or both'),
], notificationController.sendTest);

// @route  POST /api/notifications/order/:id
// @desc   Resend the admin alert for an existing order
// @access Private/Admin
router.post('/order/:id', [
  authMiddleware.protect,
  authMiddleware.restrictToAdmin,
  authMiddleware.rateLimit,
  param('id').isMongoId().withMessage('Invalid order ID'),
], notificationController.resendOrderAlert);

module.exports = router;
