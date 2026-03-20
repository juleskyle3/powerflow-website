const express = require('express');
const router = express.Router();
const multer = require('multer');
const productController = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');
const productImageUpload = require('../middleware/productImageUpload');
const { buildProductFileUrl, getProductUploadPublicPath } = require('../config/uploads');
const { body, query, param } = require('express-validator');

const uploadProductImages = productImageUpload.fields([
  { name: 'primaryImage', maxCount: 1 },
  { name: 'galleryImages', maxCount: 10 },
]);

// @route  GET /api/products
// @desc   Get all products with filters and pagination
// @access Public
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page number must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sort').optional().isString().withMessage('Sort must be a string'),
  query('category').optional().isString().withMessage('Category must be a string'),
  query('search').optional().isString().withMessage('Search query must be a string'),
  query('featured').optional().isBoolean().withMessage('Featured must be a boolean'),
  query('minPrice').optional().isNumeric().withMessage('Minimum price must be a number'),
  query('maxPrice').optional().isNumeric().withMessage('Maximum price must be a number'),
], productController.getAllProducts);

// @route  GET /api/products/category/:category
// @desc   Get products by category
// @access Public
router.get('/category/:category', [
  param('category').isString().withMessage('Category must be a string'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page number must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
], productController.getProductsByCategory);

// @route  GET /api/products/search/:query
// @desc   Search products
// @access Public
router.get('/search/:query', [
  param('query').isString().withMessage('Search query must be a string'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page number must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
], productController.searchProducts);

// @route  POST /api/products
// @desc   Create new product
// @access Public (temporarily for testing)
router.post('/', [
  body('name').notEmpty().withMessage('Product name is required').isLength({ min: 2, max: 200 }).withMessage('Product name must be between 2 and 200 characters'),
  body('description').notEmpty().withMessage('Product description is required').isLength({ min: 10, max: 2000 }).withMessage('Product description must be between 10 and 2000 characters'),
  body('category').notEmpty().withMessage('Product category is required').isIn([
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
  ]).withMessage('Invalid product category'),
  body('price').notEmpty().withMessage('Product price is required').isNumeric().withMessage('Price must be a number').isFloat({ min: 0 }).withMessage('Price cannot be negative'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('image').optional().isString().withMessage('Image must be a string').isLength({ max: 2000 }).withMessage('Image path is too long'),
  body('images').optional().isArray().withMessage('Images must be an array'),
  body('images.*').optional().isString().withMessage('Each image must be a string'),
  body('brand').optional().isString().withMessage('Brand must be a string'),
  body('sku').optional().isString().withMessage('SKU must be a string'),
  body('featured').optional().isBoolean().withMessage('Featured must be a boolean'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('tags.*').optional().isString().withMessage('Each tag must be a string'),
  body('warranty').optional().isString().withMessage('Warranty must be a string'),
  body('weight').optional().isNumeric().withMessage('Weight must be a number'),
  body('dimensions').optional().isObject().withMessage('Dimensions must be an object'),
  body('dimensions.length').optional().isNumeric().withMessage('Length must be a number'),
  body('dimensions.width').optional().isNumeric().withMessage('Width must be a number'),
  body('dimensions.height').optional().isNumeric().withMessage('Height must be a number'),
  body('specifications').optional().isArray().withMessage('Specifications must be an array'),
  body('specifications.*.name').optional().isString().withMessage('Specification name must be a string'),
  body('specifications.*.value').optional().isString().withMessage('Specification value must be a string'),
], productController.createProduct);

// @route  POST /api/products/upload-images
// @desc   Upload primary and gallery product images
// @access Public (temporarily for testing)
router.post('/upload-images', (req, res, next) => {
  uploadProductImages(req, res, (error) => {
    if (error) {
      res.status(400);
      if (error instanceof multer.MulterError) {
        return next(new Error(`Image upload failed: ${error.message}`));
      }
      return next(error);
    }

    const primaryFile = req.files?.primaryImage?.[0] || null;
    const galleryFiles = req.files?.galleryImages || [];

    if (!primaryFile && galleryFiles.length === 0) {
      res.status(400);
      return next(new Error('No image files uploaded.'));
    }

    const primaryImage = primaryFile ? buildProductFileUrl(req, primaryFile.filename) : null;
    const additionalImages = galleryFiles.map((file) => buildProductFileUrl(req, file.filename));

    return res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      data: {
        primaryImage,
        additionalImages,
        uploadPublicPath: getProductUploadPublicPath(),
      },
    });
  });
});

// @route  PUT /api/products/:id
// @desc   Update product
// @access Public (temporarily for testing)
router.put('/:id', [
  param('id').isMongoId().withMessage('Invalid product ID'),
  body('name').optional().notEmpty().withMessage('Product name is required').isLength({ min: 2, max: 200 }).withMessage('Product name must be between 2 and 200 characters'),
  body('description').optional().notEmpty().withMessage('Product description is required').isLength({ min: 10, max: 2000 }).withMessage('Product description must be between 10 and 2000 characters'),
  body('category').optional().isIn([
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
  ]).withMessage('Invalid product category'),
  body('price').optional().isNumeric().withMessage('Price must be a number').isFloat({ min: 0 }).withMessage('Price cannot be negative'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('image').optional().isString().withMessage('Image must be a string').isLength({ max: 2000 }).withMessage('Image path is too long'),
  body('images').optional().isArray().withMessage('Images must be an array'),
  body('images.*').optional().isString().withMessage('Each image must be a string'),
  body('brand').optional().isString().withMessage('Brand must be a string'),
  body('sku').optional().isString().withMessage('SKU must be a string'),
  body('featured').optional().isBoolean().withMessage('Featured must be a boolean'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('tags.*').optional().isString().withMessage('Each tag must be a string'),
  body('warranty').optional().isString().withMessage('Warranty must be a string'),
  body('weight').optional().isNumeric().withMessage('Weight must be a number'),
  body('dimensions').optional().isObject().withMessage('Dimensions must be an object'),
  body('dimensions.length').optional().isNumeric().withMessage('Length must be a number'),
  body('dimensions.width').optional().isNumeric().withMessage('Width must be a number'),
  body('dimensions.height').optional().isNumeric().withMessage('Height must be a number'),
  body('specifications').optional().isArray().withMessage('Specifications must be an array'),
  body('specifications.*.name').optional().isString().withMessage('Specification name must be a string'),
  body('specifications.*.value').optional().isString().withMessage('Specification value must be a string'),
], productController.updateProduct);

// @route  DELETE /api/products/:id
// @desc   Delete product
// @access Public (temporarily for testing)
router.delete('/:id', [
  param('id').isMongoId().withMessage('Invalid product ID'),
], productController.deleteProduct);

// @route  GET /api/products/stats
// @desc   Get product statistics
// @access Private/Admin
router.get('/stats', [
  authMiddleware.protect,
  authMiddleware.restrictToAdmin,
], productController.getProductStats);

// @route  POST /api/products/:id/reviews
// @desc   Add product review
// @access Private/Client
router.post('/:id/reviews', [
  authMiddleware.protect,
  param('id').isMongoId().withMessage('Invalid product ID'),
  body('rating').notEmpty().withMessage('Rating is required').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 500 }).withMessage('Comment cannot exceed 500 characters'),
], productController.addProductReview);

// @route  PUT /api/products/:id/reviews
// @desc   Update product review
// @access Private/Client
router.put('/:id/reviews', [
  authMiddleware.protect,
  param('id').isMongoId().withMessage('Invalid product ID'),
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 500 }).withMessage('Comment cannot exceed 500 characters'),
], productController.updateProductReview);

// @route  DELETE /api/products/:id/reviews
// @desc   Delete product review
// @access Private/Client
router.delete('/:id/reviews', [
  authMiddleware.protect,
  param('id').isMongoId().withMessage('Invalid product ID'),
], productController.deleteProductReview);

// @route  GET /api/products/:id
// @desc   Get single product by ID
// @access Public
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid product ID'),
], productController.getProductById);

module.exports = router;
