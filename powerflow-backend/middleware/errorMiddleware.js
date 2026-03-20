const errorMiddleware = {};

// 404 Not Found middleware
errorMiddleware.notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Global error handler
errorMiddleware.errorHandler = (error, req, res, next) => {
  // Set status code
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = error.message;

  // Handle specific error types
  if (error.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${error.path}: ${error.value}`;
  }

  if (error.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(error.errors).map(err => err.message);
    message = `Validation failed: ${errors.join(', ')}`;
  }

  if (error.code === 11000) {
    statusCode = 400;
    const field = Object.keys(error.keyPattern)[0];
    message = `Duplicate field value: ${field} already exists`;
  }

  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token has expired';
  }

  // Log the error
  console.error('Error:', {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    statusCode,
    message: error.message,
    stack: error.stack,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    },
  });
};

// Rate limiter error handler
errorMiddleware.rateLimitHandler = (req, res, next) => {
  if (req.rateLimit && req.rateLimit.remaining === 0) {
    return res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests. Please try again later.',
        retryAfter: req.rateLimit.resetTime,
      },
    });
  }
  next();
};

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(errors) {
    super('Validation failed', 400);
    this.errors = errors;
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}

// Express validator error handler
errorMiddleware.expressValidatorErrorHandler = (err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        errors: err.errors,
      },
    });
  }
  next(err);
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = {
  notFound: errorMiddleware.notFound,
  errorHandler: errorMiddleware.errorHandler,
  rateLimitHandler: errorMiddleware.rateLimitHandler,
  expressValidatorErrorHandler: errorMiddleware.expressValidatorErrorHandler,
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
};
