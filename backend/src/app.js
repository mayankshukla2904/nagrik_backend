const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: '../.env' });

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Import routes
const complaintRoutes = require('./routes/complaints');
const enhancedComplaintRoutes = require('./routes/enhancedComplaints');
const dashboardRoutes = require('./routes/dashboard');
const healthRoutes = require('./routes/health');
const demoRoutes = require('./routes/demo');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Database connection with demo mode support
const connectDB = async () => {
  if (process.env.DEMO_MODE === 'true' || process.env.MONGODB_URI?.startsWith('demo://')) {
    logger.info('Running in DEMO mode - starting in-memory MongoDB');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = new MongoMemoryServer();
      await mongod.start();
      const uri = mongod.getUri();
      
      await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      logger.info('In-memory MongoDB connected successfully for demo');
      return mongod; // Return the instance for cleanup if needed
    } catch (error) {
      logger.error('Demo MongoDB setup error:', error);
      logger.warn('Continuing without database - some features may not work');
    }
    return;
  }
  
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    logger.warn('Continuing without database - some features may not work');
  }
};

// Connect to database
connectDB();

// MongoDB connection event handlers
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

// Static file serving for dashboards and public assets
app.use(express.static(require('path').join(__dirname, '../public')));

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/enhanced-complaints', enhancedComplaintRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/demo', demoRoutes);

// Dashboard routes
app.get('/dashboard', (req, res) => {
  res.sendFile(require('path').join(__dirname, '../public/enhanced-dashboard.html'));
});

app.get('/dashboard/legacy', (req, res) => {
  res.sendFile(require('path').join(__dirname, '../../dashboard.html'));
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🚀 NAGRIK 2.0 - Enhanced Grievance Platform API',
    version: '2.0.0',
    status: 'running',
    features: [
      'Enhanced complaint classification with Jharkhand-specific intelligence',
      'Upvoting system for similar complaints',
      'AI-powered data enhancement and validation',
      'Real-time similarity detection',
      'Location validation for Jharkhand addresses'
    ],
    endpoints: {
      health: '/api/health',
      complaints: '/api/complaints',
      enhanced_complaints: '/api/enhanced-complaints',
      dashboard: '/api/dashboard'
    },
    presentation_ready: true
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  process.exit(0);
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`NAGRIK Backend API server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV}`);
    logger.info(`MongoDB: ${process.env.MONGODB_URI ? 'Connected' : 'Not configured'}`);
  });
}

module.exports = app;
