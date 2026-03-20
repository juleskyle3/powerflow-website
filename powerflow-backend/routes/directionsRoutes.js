const express = require('express');
const router = express.Router();
const {
  getDirections,
  getDirectionsByCoordinates,
  getCurrentLocationDirections
} = require('../controllers/directionsController');

// Get directions from address
router.get('/directions', getDirections);

// Get directions from coordinates
router.get('/directions/coordinates', getDirectionsByCoordinates);

// Get directions from current location (geolocation)
router.post('/directions/current', getCurrentLocationDirections);

module.exports = router;
