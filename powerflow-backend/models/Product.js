const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters'],
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [2000, 'Product description cannot exceed 2000 characters'],
  },
  category: {
    type: String,
    required: [true, 'Product category is required'],
    enum: [
      'electrical',
      'electronic',
      'plumbing',
      'lighting',
      'safety',
      'control-systems',
      'hvac',
      'water-heaters',
      'pumps',
      'cctv',
      'alarm-systems',
      'other'
    ],
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative'],
  },
  stock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0,
  },
  image: {
    type: String,
    default: '',
  },
  images: [{
    type: String,
  }],
  brand: {
    type: String,
    default: '',
  },
  sku: {
    type: String,
    unique: true,
    sparse: true,
  },
  featured: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  specifications: [{
    name: String,
    value: String,
  }],
  tags: [{
    type: String,
  }],
  weight: {
    type: Number,
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
  },
  warranty: {
    type: String,
  },
  reviews: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
}, {
  timestamps: true,
});

// Indexes for better query performance
productSchema.index({ name: 'text', description: 'text', category: 'text' });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ featured: 1, createdAt: -1 });

// Virtual field for average rating
productSchema.virtual('averageRating').get(function() {
  if (!this.reviews || this.reviews.length === 0) return 0;
  const total = this.reviews.reduce((sum, review) => sum + review.rating, 0);
  return Math.round(total / this.reviews.length * 10) / 10;
});

// Virtual field for review count
productSchema.virtual('reviewCount').get(function() {
  return this.reviews ? this.reviews.length : 0;
});

// Instance method to check if product is in stock
productSchema.methods.isInStock = function(quantity = 1) {
  return this.stock >= quantity && this.isActive;
};

// Static method to find products by category
productSchema.statics.findByCategory = async function(category, options = {}) {
  const { page = 1, limit = 10, sort = '-createdAt' } = options;
  const query = { category, isActive: true };
  
  const products = await this.find(query)
    .sort(sort)
    .limit(limit)
    .skip((page - 1) * limit);
    
  const total = await this.countDocuments(query);
  
  return {
    products,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// Static method to search products
productSchema.statics.search = async function(query, options = {}) {
  const { page = 1, limit = 10, sort = '-createdAt' } = options;
  const searchQuery = {
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } },
    ],
    isActive: true,
  };
  
  const products = await this.find(searchQuery)
    .sort(sort)
    .limit(limit)
    .skip((page - 1) * limit);
    
  const total = await this.countDocuments(searchQuery);
  
  return {
    products,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// Remove sensitive fields from JSON output
productSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    // Remove reviews from public API responses if needed
    return ret;
  },
});

productSchema.set('toObject', {
  virtuals: true,
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
