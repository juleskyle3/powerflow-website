const Product = require('../models/Product');
const { validationResult } = require('express-validator');
const { AppError, ValidationError, NotFoundError } = require('../middleware/errorMiddleware');

const productController = {};

// Get all products (public)
productController.getAllProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = '-createdAt',
      category,
      search,
      featured,
      minPrice,
      maxPrice,
    } = req.query;

    const query = { isActive: true };

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by featured
    if (featured === 'true') {
      query.featured = true;
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) {
        query.price.$gte = parseFloat(minPrice);
      }
      if (maxPrice) {
        query.price.$lte = parseFloat(maxPrice);
      }
    }

    // Search
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const products = await Product.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single product (public)
productController.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('reviews.userId', 'name avatar');

    if (!product || !product.isActive) {
      return next(new NotFoundError('Product'));
    }

    res.status(200).json({
      success: true,
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get products by category (public)
productController.getProductsByCategory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sort = '-createdAt' } = req.query;

    const result = await Product.findByCategory(req.params.category, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Search products (public)
productController.searchProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sort = '-createdAt' } = req.query;

    const result = await Product.search(req.params.query, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Create product (admin)
productController.createProduct = async (req, res, next) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationError(errors.array()));
    }

    const product = await Product.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update product (admin)
productController.updateProduct = async (req, res, next) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationError(errors.array()));
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!product) {
      return next(new NotFoundError('Product'));
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Delete product (admin)
productController.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return next(new NotFoundError('Product'));
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get product stats (admin)
productController.getProductStats = async (req, res, next) => {
  try {
    const [totalProducts, activeProducts, featuredProducts, categories] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ featured: true, isActive: true }),
      Product.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalProducts,
        activeProducts,
        featuredProducts,
        categories,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Add product review (client)
productController.addProductReview = async (req, res, next) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationError(errors.array()));
    }

    const { rating, comment } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      return next(new NotFoundError('Product'));
    }

    // Check if user has already reviewed this product
    const existingReview = product.reviews.find(
      (review) => review.userId.toString() === req.user._id.toString()
    );

    if (existingReview) {
      return next(new AppError('You have already reviewed this product', 409));
    }

    // Add new review
    product.reviews.push({
      userId: req.user._id,
      rating,
      comment,
      createdAt: new Date(),
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: {
        review: product.reviews[product.reviews.length - 1],
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update product review (client)
productController.updateProductReview = async (req, res, next) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationError(errors.array()));
    }

    const { rating, comment } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      return next(new NotFoundError('Product'));
    }

    // Find user's review
    const reviewIndex = product.reviews.findIndex(
      (review) => review.userId.toString() === req.user._id.toString()
    );

    if (reviewIndex === -1) {
      return next(new AppError('Review not found', 404));
    }

    // Update review
    product.reviews[reviewIndex] = {
      ...product.reviews[reviewIndex],
      rating,
      comment,
      updatedAt: new Date(),
    };

    await product.save();

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: {
        review: product.reviews[reviewIndex],
      },
    });
  } catch (error) {
    next(error);
  }
};

// Delete product review (client)
productController.deleteProductReview = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return next(new NotFoundError('Product'));
    }

    // Remove user's review
    const reviewIndex = product.reviews.findIndex(
      (review) => review.userId.toString() === req.user._id.toString()
    );

    if (reviewIndex === -1) {
      return next(new AppError('Review not found', 404));
    }

    product.reviews.splice(reviewIndex, 1);
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = productController;
