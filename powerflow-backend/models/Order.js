const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true,
    maxlength: [200, 'Customer name cannot exceed 200 characters'],
  },
  customerEmail: {
    type: String,
    required: [true, 'Customer email is required'],
    trim: true,
    lowercase: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please provide a valid email address',
    ],
  },
  customerPhone: {
    type: String,
    required: [true, 'Customer phone number is required'],
    maxlength: [20, 'Phone number cannot exceed 20 characters'],
  },
  customerAddress: {
    type: String,
    required: [true, 'Customer address is required'],
    maxlength: [500, 'Address cannot exceed 500 characters'],
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
  }],
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: [0, 'Subtotal cannot be negative'],
  },
  tax: {
    type: Number,
    required: [true, 'Tax is required'],
    min: [0, 'Tax cannot be negative'],
    default: 0,
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative'],
  },
  invoiceNumber: {
    type: String,
    unique: true,
    required: true,
  },
  invoiceFileName: {
    type: String,
  },
  invoicePath: {
    type: String,
  },
  invoiceEmailStatus: {
    type: String,
    enum: ['Pending', 'Sent', 'Failed'],
    default: 'Pending',
  },
  invoiceEmailSentAt: {
    type: Date,
  },
  invoiceEmailError: {
    type: String,
    maxlength: [1000, 'Invoice email error message cannot exceed 1000 characters'],
  },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'],
    default: 'Pending',
  },
  paymentStatus: {
    type: String,
    enum: ['Unpaid', 'Paid', 'Partially Paid', 'Refunded'],
    default: 'Unpaid',
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Bank Transfer', 'Mobile Money', 'Credit Card', 'Other'],
  },
  shippingMethod: {
    type: String,
    enum: ['Standard', 'Express', 'Pickup'],
    default: 'Standard',
  },
  shippingCost: {
    type: Number,
    default: 0,
    min: [0, 'Shipping cost cannot be negative'],
  },
  trackingNumber: {
    type: String,
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
orderSchema.index({ customerEmail: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ invoiceNumber: 1 });
orderSchema.index({ user: 1, createdAt: -1 });

// Virtual field for order number
orderSchema.virtual('orderNumber').get(function() {
  return `PF${this.createdAt.getFullYear()}${String(this._id).slice(-6)}`;
});

// Instance method to calculate total
orderSchema.methods.calculateTotal = function() {
  this.subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  this.tax = Math.floor(this.subtotal * 0.1); // 10% tax
  this.totalAmount = this.subtotal + this.tax + (this.shippingCost || 0);
};

// Static method to generate invoice number
orderSchema.statics.generateInvoiceNumber = function() {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${timestamp}-${random}`;
};

// Static method to get orders by customer email
orderSchema.statics.findByCustomer = async function(email, options = {}) {
  const { page = 1, limit = 10, sort = '-createdAt' } = options;
  const query = { customerEmail: email.toLowerCase(), isActive: true };
  
  const orders = await this.find(query)
    .sort(sort)
    .limit(limit)
    .skip((page - 1) * limit)
    .populate('items.productId', 'name image');
    
  const total = await this.countDocuments(query);
  
  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// Static method to get stats
orderSchema.statics.getStats = async function() {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  
  const [totalSales, weeklySales, monthlySales, activeOrders] = await Promise.all([
    this.aggregate([
      { $match: { isActive: true, paymentStatus: 'Paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]),
    this.aggregate([
      { $match: { isActive: true, paymentStatus: 'Paid', createdAt: { $gte: weekAgo } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]),
    this.aggregate([
      { $match: { isActive: true, paymentStatus: 'Paid', createdAt: { $gte: monthAgo } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]),
    this.aggregate([
      { $match: { isActive: true, status: { $in: ['Pending', 'Processing', 'Shipped'] } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  ]);
  
  return {
    totalSales: totalSales[0]?.total || 0,
    weeklySales: weeklySales[0]?.total || 0,
    monthlySales: monthlySales[0]?.total || 0,
    activeOrders: activeOrders.reduce((sum, item) => sum + item.count, 0),
  };
};

// Remove sensitive fields from JSON output
orderSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    return ret;
  },
});

orderSchema.set('toObject', {
  virtuals: true,
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
