const axios = require('axios');

// Get directions from user location to Power Flow Services office
const getDirections = async (req, res) => {
  try {
    const { origin } = req.query;
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!origin) {
      return res.status(400).json({
        error: 'Origin parameter is required'
      });
    }

    if (!googleMapsApiKey) {
      return res.status(500).json({
        error: 'Google Maps API key is not configured'
      });
    }

    // Power Flow Services location (Kigali - Gasabo - Kimihurura, Rwanda)
    const destination = 'Kigali, Gasabo, Kimihurura, Rwanda';

    // Make request to Google Maps Directions API
    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: origin,
        destination: destination,
        key: googleMapsApiKey
      }
    });

    if (response.data.status === 'OK') {
      res.json({
        success: true,
        data: response.data
      });
    } else {
      res.status(400).json({
        error: `Directions API error: ${response.data.status}`
      });
    }

  } catch (error) {
    console.error('Error fetching directions:', error);
    res.status(500).json({
      error: 'Failed to fetch directions'
    });
  }
};

// Get directions using coordinates
const getDirectionsByCoordinates = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!lat || !lng) {
      return res.status(400).json({
        error: 'Latitude and longitude parameters are required'
      });
    }

    if (!googleMapsApiKey) {
      return res.status(500).json({
        error: 'Google Maps API key is not configured'
      });
    }

    const origin = `${lat},${lng}`;
    const destination = 'Kigali, Gasabo, Kimihurura, Rwanda';

    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: origin,
        destination: destination,
        key: googleMapsApiKey
      }
    });

    if (response.data.status === 'OK') {
      res.json({
        success: true,
        data: response.data
      });
    } else {
      res.status(400).json({
        error: `Directions API error: ${response.data.status}`
      });
    }

  } catch (error) {
    console.error('Error fetching directions:', error);
    res.status(500).json({
      error: 'Failed to fetch directions'
    });
  }
};

// Get current location directions using geolocation
const getCurrentLocationDirections = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Latitude and longitude are required'
      });
    }

    if (!googleMapsApiKey) {
      return res.status(500).json({
        error: 'Google Maps API key is not configured'
      });
    }

    const origin = `${latitude},${longitude}`;
    const destination = 'Kigali, Gasabo, Kimihurura, Rwanda';

    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: origin,
        destination: destination,
        key: googleMapsApiKey
      }
    });

    if (response.data.status === 'OK') {
      res.json({
        success: true,
        data: response.data
      });
    } else {
      res.status(400).json({
        error: `Directions API error: ${response.data.status}`
      });
    }

  } catch (error) {
    console.error('Error fetching directions:', error);
    res.status(500).json({
      error: 'Failed to fetch directions'
    });
  }
};

module.exports = {
  getDirections,
  getDirectionsByCoordinates,
  getCurrentLocationDirections
};
