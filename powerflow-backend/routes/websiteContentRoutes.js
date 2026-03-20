const express = require('express');
const websiteContentController = require('../controllers/websiteContentController');

const router = express.Router();

// @route  GET /api/content
// @desc   Get website content
// @access Public
router.get('/', websiteContentController.getWebsiteContent);

// @route  PUT /api/content
// @desc   Update multiple website content sections at once
// @access Public (temporarily for admin page compatibility)
router.put('/', websiteContentController.updateWebsiteContent);

// @route  PUT /api/content/:section
// @desc   Update a single content section
// @access Public (temporarily for admin page compatibility)
router.put('/:section', websiteContentController.updateWebsiteContentSection);

module.exports = router;
