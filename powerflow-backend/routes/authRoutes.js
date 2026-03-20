const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { body, query } = require('express-validator');

// @route  POST /api/auth/register
// @desc   Register a new user
// @access Public
router.post('/register', [
  body('name').notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('address').optional().isLength({ max: 500 }).withMessage('Address cannot exceed 500 characters'),
], authController.register);

// @route  POST /api/auth/login
// @desc   Login user
// @access Public
router.post('/login', [
  body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], authController.login);

// @route  POST /api/auth/logout
// @desc   Logout user
// @access Public
router.post('/logout', authController.logout);

// @route  GET /api/auth/me
// @desc   Get current user
// @access Private
router.get('/me', authMiddleware.protect, authMiddleware.logActivity, authController.getCurrentUser);

// @route  PUT /api/auth/update-profile
// @desc   Update user profile
// @access Private
router.put('/update-profile', [
  authMiddleware.protect,
  body('name').optional().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('address').optional().isLength({ max: 500 }).withMessage('Address cannot exceed 500 characters'),
], authController.updateProfile);

// @route  PUT /api/auth/change-password
// @desc   Change password
// @access Private
router.put('/change-password', [
  authMiddleware.protect,
  body('currentPassword').notEmpty().withMessage('Current password is required').isLength({ min: 6 }).withMessage('Current password must be at least 6 characters'),
  body('newPassword').notEmpty().withMessage('New password is required').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
], authController.changePassword);

// @route  POST /api/auth/forgot-password
// @desc   Forgot password
// @access Public
router.post('/forgot-password', [
  body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
], authController.forgotPassword);

module.exports = router;
