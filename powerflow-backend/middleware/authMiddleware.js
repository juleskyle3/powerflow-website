const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = {};

authMiddleware.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in cookies or authorization header
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        message: 'Not authorized to access this route',
        error: 'Missing token',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user exists and is active
    const user = await User.findById(decoded.id).select('-passwordHash');

    if (!user || !user.isActive) {
      return res.status(401).json({
        message: 'User not found or account is inactive',
        error: 'User not found',
      });
    }

    // Check if token is expired
    const tokenExpiration = decoded.exp;
    const currentTime = Date.now() / 1000;
    if (tokenExpiration < currentTime) {
      return res.status(401).json({
        message: 'Token has expired. Please log in again.',
        error: 'Token expired',
      });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Authorization error:', error);
    
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Session has expired. Please log in again.',
        error: 'Token expired',
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Invalid token. Please log in again.',
        error: 'Invalid token',
      });
    }

    return res.status(401).json({
      message: 'Not authorized to access this route',
      error: 'Authorization failed',
    });
  }
};

authMiddleware.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'You do not have permission to perform this action',
        error: 'Forbidden',
      });
    }
    next();
  };
};

authMiddleware.restrictToAdmin = authMiddleware.restrictTo('admin');

authMiddleware.logActivity = async (req, res, next) => {
  try {
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, {
        lastLoginAt: new Date(),
        $inc: { loginCount: 1 },
      });
    }
    next();
  } catch (error) {
    console.error('Activity log error:', error);
    next(); // Continue even if logging fails
  }
};

// Rate limiting middleware (using rate-limiter-flexible)
const { RateLimiterMemory } = require('rate-limiter-flexible');

const limiter = new RateLimiterMemory({
  points: 100, // 100 requests
  duration: 60, // per minute
});

authMiddleware.rateLimit = async (req, res, next) => {
  try {
    await limiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({
      message: 'Too many requests. Please try again later.',
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil(rejRes.msBeforeNext / 1000),
    });
  }
};

// API key authentication (for external integrations)
authMiddleware.apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      message: 'Invalid API key',
      error: 'Invalid API key',
    });
  }
  
  next();
};

module.exports = authMiddleware;
