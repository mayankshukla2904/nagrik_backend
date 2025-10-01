const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// GET /api/health - Health check endpoint
router.get('/', async (req, res) => {
  try {
    // Check database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024)
    };

    // Check uptime
    const uptime = process.uptime();
    const uptimeFormatted = new Date(uptime * 1000).toISOString().substr(11, 8);

    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: uptimeFormatted,
      database: {
        status: dbStatus,
        name: mongoose.connection.name || 'unknown'
      },
      memory: memoryUsageMB,
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      services: {
        api: 'operational',
        database: dbStatus === 'connected' ? 'operational' : 'degraded'
      }
    };

    // Determine overall status
    if (dbStatus !== 'connected') {
      healthStatus.status = 'degraded';
    }

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      success: true,
      data: healthStatus
    });

  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/health/detailed - Detailed health check
router.get('/detailed', async (req, res) => {
  try {
    const Complaint = require('../models/Complaint');
    const User = require('../models/User');

    // Test database operations
    const [complaintCount, userCount] = await Promise.all([
      Complaint.countDocuments().catch(() => -1),
      User.countDocuments().catch(() => -1)
    ]);

    // Check external services
    const externalServices = {
      ragClassifier: {
        url: process.env.RAG_SERVICE_URL || 'http://localhost:5000',
        status: 'unknown' // Would need actual health check
      },
      whatsappService: {
        url: process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3001',
        status: 'unknown' // Would need actual health check
      },
      openai: {
        configured: !!process.env.OPENAI_API_KEY,
        status: process.env.OPENAI_API_KEY ? 'configured' : 'not-configured'
      }
    };

    const detailedHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connection: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        collections: {
          complaints: complaintCount,
          users: userCount
        }
      },
      externalServices,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT,
        logLevel: process.env.LOG_LEVEL
      }
    };

    res.json({
      success: true,
      data: detailedHealth
    });

  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      message: 'Detailed health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
