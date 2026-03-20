const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const googleAuthRoutes = require('./routes/googleAuthRoutes');
const websiteContentRoutes = require('./routes/websiteContentRoutes');
const directionsRoutes = require('./routes/directionsRoutes');

// Import middleware
const errorMiddleware = require('./middleware/errorMiddleware');
const authMiddleware = require('./middleware/authMiddleware');
const { getUploadRootDir, getUploadPublicPrefix } = require('./config/uploads');

const app = express();
const PORT = process.env.PORT || 5000;

function getAllowedOrigins() {
  const defaults = ['http://localhost:3000', 'http://127.0.0.1:5500'];
  const fromSingle = String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  const fromMulti = String(process.env.FRONTEND_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  return Array.from(new Set([...fromMulti, ...fromSingle, ...defaults]));
}

const allowedOrigins = getAllowedOrigins();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.MONGODB_URI],
    },
  },
}));

// Enable CORS
app.use(cors({
  origin(origin, callback) {
    // Allow server-to-server and non-browser calls without Origin
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Ignore browser favicon probe to avoid noisy 404 logs
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Serve static files (invoices)
app.use('/invoices', express.static('public/invoices'));
app.use(getUploadPublicPrefix(), express.static(path.resolve(getUploadRootDir())));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/content', websiteContentRoutes);
app.use('/api', directionsRoutes);
app.use('/', googleAuthRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
  });
});

// Error handling middleware
app.use(errorMiddleware.notFound);
app.use(errorMiddleware.errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 API routes: http://localhost:${PORT}/api/`);
  console.log(`🌐 Allowed CORS origins: ${allowedOrigins.join(', ')}`);
});
