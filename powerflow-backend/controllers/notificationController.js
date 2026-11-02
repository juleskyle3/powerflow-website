const Order = require('../models/Order');
const { NotFoundError } = require('../middleware/errorMiddleware');
const {
  deliverOrderAlert,
  getNotificationStatus,
  sendTestAlert,
} = require('../services/notificationService');

const notificationController = {};

function buildInvoiceUrl(req, order) {
  const token = order.invoiceAccessToken
    ? `?token=${encodeURIComponent(order.invoiceAccessToken)}`
    : '';

  return `${req.protocol}://${req.get('host')}/api/orders/${order._id}/invoice${token}`;
}

function summarize(result = {}) {
  const parts = [];
  if (result.email) parts.push(`email ${result.email.status.toLowerCase()}`);
  if (result.sms) parts.push(`SMS ${result.sms.status.toLowerCase()}`);
  return parts.join(', ');
}

// @route  GET /api/notifications/status
// @desc   Report admin alert configuration (no secrets returned)
// @access Private/Admin
notificationController.getStatus = async (req, res, next) => {
  try {
    const status = await getNotificationStatus();
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
};

// @route  POST /api/notifications/test
// @desc   Send a test email and/or SMS to the configured admin recipients
// @access Private/Admin
notificationController.sendTest = async (req, res, next) => {
  try {
    const channel = req.body?.channel || 'both';
    const results = await sendTestAlert(channel);
    const summary = summarize(results);

    res.status(200).json({
      success: true,
      message: summary ? `Test alert attempted (${summary}).` : 'No test channel selected.',
      data: { results },
    });
  } catch (error) {
    next(error);
  }
};

// @route  POST /api/notifications/order/:id
// @desc   Resend the admin alert for an existing order
// @access Private/Admin
notificationController.resendOrderAlert = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, isActive: true });

    if (!order) {
      return next(new NotFoundError('Order'));
    }

    const result = await deliverOrderAlert(order, {
      invoiceUrl: buildInvoiceUrl(req, order),
      trigger: 'manual-resend',
    });

    res.status(200).json({
      success: true,
      message: `Admin alert resent (${summarize(result)}).`,
      data: {
        alert: result,
        order: {
          _id: order._id,
          adminAlertEmailStatus: result.email?.status || 'Pending',
          adminAlertEmailError: result.email?.error || '',
          adminAlertEmailSentAt: result.email?.status === 'Sent' ? result.attemptedAt : null,
          adminAlertSmsStatus: result.sms?.status || 'Pending',
          adminAlertSmsError: result.sms?.error || '',
          adminAlertSmsSentAt: result.sms?.status === 'Sent' ? result.attemptedAt : null,
          adminAlertLastAttemptAt: result.attemptedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = notificationController;
