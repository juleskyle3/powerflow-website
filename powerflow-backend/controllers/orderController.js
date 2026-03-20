const fs = require('fs/promises');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { AppError, NotFoundError } = require('../middleware/errorMiddleware');
const {
  generateAndStoreInvoice,
  generateInvoiceBuffer,
  getInvoiceFilePath,
  saveInvoiceBuffer,
} = require('../services/invoiceService');
const { isEmailConfigured, sendInvoiceEmail } = require('../services/emailService');

const orderController = {};

const ORDER_STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'];
const PAYMENT_STATUSES = ['Unpaid', 'Paid', 'Partially Paid', 'Refunded'];
const SHIPPING_METHODS = ['Standard', 'Express', 'Pickup'];

function normalizeOrderStatus(input) {
  const raw = sanitizeText(input);
  if (!raw) return null;

  if (raw.toLowerCase() === 'delivery') {
    return 'Delivered';
  }

  return ORDER_STATUSES.find((status) => status.toLowerCase() === raw.toLowerCase()) || null;
}

function normalizePaymentStatus(input) {
  const raw = sanitizeText(input);
  if (!raw) return null;

  return PAYMENT_STATUSES.find((status) => status.toLowerCase() === raw.toLowerCase()) || null;
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function hasEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

async function buildUniqueInvoiceNumber() {
  let invoiceNumber;
  let existing;

  do {
    invoiceNumber = Order.generateInvoiceNumber();
    // eslint-disable-next-line no-await-in-loop
    existing = await Order.findOne({ invoiceNumber }).select('_id');
  } while (existing);

  return invoiceNumber;
}

async function normalizeItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new AppError('Order must contain at least one item', 400);
  }

  const normalized = rawItems.map((item) => {
    const productId = sanitizeText(item.productId);
    if (!productId) {
      throw new AppError('Each order item must include productId', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new AppError(`Invalid productId: ${productId}`, 400);
    }

    return {
      productId,
      quantity: Math.max(1, Math.floor(asNumber(item.quantity, 1))),
      providedName: sanitizeText(item.productName || item.name),
    };
  });

  const productIds = [...new Set(normalized.map((item) => item.productId))];
  const products = await Product.find({ _id: { $in: productIds }, isActive: true });

  const byId = new Map(products.map((product) => [String(product._id), product]));

  const orderItems = [];
  normalized.forEach((item) => {
    const product = byId.get(item.productId);
    if (!product) {
      throw new AppError(`Product not found for ID ${item.productId}`, 404);
    }

    if (product.stock < item.quantity) {
      throw new AppError(`Insufficient stock for ${product.name}. Remaining stock: ${product.stock}`, 409);
    }

    orderItems.push({
      productId: product._id,
      productName: product.name || item.providedName,
      quantity: item.quantity,
      price: asNumber(product.price),
    });
  });

  return orderItems;
}

async function decrementStock(orderItems) {
  const decremented = [];

  try {
    for (const item of orderItems) {
      // Prevent negative stock under concurrent purchases.
      // eslint-disable-next-line no-await-in-loop
      const result = await Product.updateOne(
        { _id: item.productId, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } }
      );

      if (result.modifiedCount === 0) {
        throw new AppError(`Unable to reserve stock for ${item.productName}. Please retry.`, 409);
      }

      decremented.push(item);
    }
  } catch (error) {
    await Promise.all(
      decremented.map((item) => Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } }))
    );
    throw error;
  }
}

async function attachInvoiceToOrder(order) {
  const { fileName, filePath, pdfBuffer } = await generateAndStoreInvoice(order);

  order.invoiceFileName = fileName;
  order.invoicePath = filePath;
  await order.save();

  return { fileName, filePath, pdfBuffer };
}

async function trySendInvoiceEmail(order, invoiceBuffer) {
  if (!isEmailConfigured()) {
    order.invoiceEmailStatus = 'Failed';
    order.invoiceEmailError = 'SMTP is not configured on the server.';
    await order.save();
    return { sent: false, error: order.invoiceEmailError };
  }

  try {
    await sendInvoiceEmail({
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      invoiceNumber: order.invoiceNumber,
      orderId: order._id,
      orderTotal: order.totalAmount,
      invoiceBuffer,
    });

    order.invoiceEmailStatus = 'Sent';
    order.invoiceEmailSentAt = new Date();
    order.invoiceEmailError = '';
    await order.save();

    return { sent: true };
  } catch (error) {
    order.invoiceEmailStatus = 'Failed';
    order.invoiceEmailError = error.message;
    await order.save();

    return { sent: false, error: error.message };
  }
}

// Create new order (public - no auth required)
orderController.createOrder = async (req, res, next) => {
  try {
    const { customer = {}, items = [], delivery, notes, shippingMethod } = req.body;

    const customerName = sanitizeText(customer.name);
    const customerEmail = sanitizeText(customer.email).toLowerCase();
    const customerPhone = sanitizeText(customer.phone);
    const customerAddress = [sanitizeText(customer.address), sanitizeText(customer.city)]
      .filter(Boolean)
      .join(', ');

    if (!customerName || !customerEmail || !customerPhone || !customerAddress) {
      throw new AppError('Customer name, email, phone, city and address are required', 400);
    }

    if (!hasEmail(customerEmail)) {
      throw new AppError('Please provide a valid customer email address', 400);
    }

    const orderItems = await normalizeItems(items);
    const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingCost = Math.max(0, asNumber(delivery, 0));
    const tax = Math.max(0, asNumber(req.body.tax, 0));
    const totalAmount = subtotal + shippingCost + tax;

    const invoiceNumber = await buildUniqueInvoiceNumber();
    const normalizedShippingMethod = SHIPPING_METHODS.includes(sanitizeText(shippingMethod))
      ? sanitizeText(shippingMethod)
      : 'Standard';

    const order = await Order.create({
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      items: orderItems,
      subtotal,
      shippingCost,
      tax,
      totalAmount,
      invoiceNumber,
      notes: sanitizeText(notes),
      shippingMethod: normalizedShippingMethod,
      status: 'Pending',
      paymentStatus: 'Unpaid',
      invoiceEmailStatus: 'Pending',
    });

    await decrementStock(orderItems);

    let emailResult = { sent: false, error: null };
    try {
      const invoice = await attachInvoiceToOrder(order);
      // Transaction email trigger: send invoice immediately after order is created.
      emailResult = await trySendInvoiceEmail(order, invoice.pdfBuffer);
    } catch (invoiceError) {
      order.invoiceEmailStatus = 'Failed';
      order.invoiceEmailError = `Invoice generation failed: ${invoiceError.message}`;
      await order.save();
      emailResult = { sent: false, error: order.invoiceEmailError };
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order,
        invoiceUrl: `/api/orders/${order._id}/invoice`,
        invoiceEmailSent: emailResult.sent,
        invoiceEmailError: emailResult.error || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all orders (admin)
orderController.getAllOrders = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = '-createdAt',
      status,
      customerEmail,
      invoiceEmailStatus,
    } = req.query;

    const query = { isActive: true };

    if (status) {
      query.status = status;
    }

    if (invoiceEmailStatus) {
      query.invoiceEmailStatus = invoiceEmailStatus;
    }

    if (customerEmail) {
      query.customerEmail = { $regex: customerEmail, $options: 'i' };
    }

    const orders = await Order.find(query)
      .sort(sort)
      .limit(parseInt(limit, 10))
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))
      .populate('items.productId', 'name image sku')
      .populate('user', 'name email');

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total,
          pages: Math.ceil(total / parseInt(limit, 10)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get user's orders (client)
orderController.getUserOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sort = '-createdAt', status } = req.query;

    const query = {
      user: req.user._id,
      isActive: true,
    };

    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort(sort)
      .limit(parseInt(limit, 10))
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))
      .populate('items.productId', 'name image');

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total,
          pages: Math.ceil(total / parseInt(limit, 10)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single order (client/admin)
orderController.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.productId', 'name image')
      .populate('user', 'name email');

    if (!order || !order.isActive) {
      return next(new NotFoundError('Order'));
    }

    const isAdmin = req.user.role === 'admin';
    const isOwnerByUser = order.user && String(order.user._id) === String(req.user._id);
    const isOwnerByEmail = order.customerEmail === req.user.email;

    if (!isAdmin && !isOwnerByUser && !isOwnerByEmail) {
      return next(new AppError('You are not authorized to view this order', 403));
    }

    res.status(200).json({
      success: true,
      data: {
        order,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update order status (admin)
orderController.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, paymentStatus, trackingNumber } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order || !order.isActive) {
      return next(new NotFoundError('Order'));
    }

    if (status !== undefined) {
      const normalizedStatus = normalizeOrderStatus(status);
      if (!normalizedStatus) {
        throw new AppError(`Invalid status. Allowed values: ${ORDER_STATUSES.join(', ')}`, 400);
      }
      order.status = normalizedStatus;
    }

    if (paymentStatus !== undefined) {
      const normalizedPaymentStatus = normalizePaymentStatus(paymentStatus);
      if (!normalizedPaymentStatus) {
        throw new AppError(`Invalid payment status. Allowed values: ${PAYMENT_STATUSES.join(', ')}`, 400);
      }
      order.paymentStatus = normalizedPaymentStatus;
    }

    if (trackingNumber !== undefined) {
      order.trackingNumber = sanitizeText(trackingNumber);
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order updated successfully',
      data: {
        order,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Delete order (admin)
orderController.deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!order) {
      return next(new AppError('Order not found or already deleted', 404));
    }

    await Promise.all(
      order.items.map((item) => Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } }))
    );

    res.status(200).json({
      success: true,
      message: 'Order deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get order stats (admin)
orderController.getOrderStats = async (req, res, next) => {
  try {
    const stats = await Order.getStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// Download invoice (public)
orderController.downloadInvoice = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || !order.isActive) {
      return next(new NotFoundError('Order'));
    }

    let invoicePath = order.invoicePath || getInvoiceFilePath(order.invoiceNumber);

    try {
      await fs.access(invoicePath);
    } catch (_) {
      const pdfBuffer = await generateInvoiceBuffer(order);
      const { fileName, filePath } = await saveInvoiceBuffer(order.invoiceNumber, pdfBuffer);

      invoicePath = filePath;
      order.invoiceFileName = fileName;
      order.invoicePath = filePath;
      await order.save();
    }

    res.download(invoicePath, `Invoice-${order.invoiceNumber}.pdf`);
  } catch (error) {
    next(error);
  }
};

module.exports = orderController;
