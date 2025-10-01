const express = require('express');
const axios = require('axios');
const cors = require('cors');
const winston = require('winston');
const Joi = require('joi');
require('dotenv').config({ path: '../.env' });

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'call-service.log' }),
    new winston.transports.Console()
  ]
});

class CallService {
  constructor() {
    this.app = express();
    this.port = process.env.CALL_SERVICE_PORT || 3002;
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    
    // Omnidimensions configuration
    this.omnidimensionsConfig = {
      apiUrl: process.env.OMNIDIMENSIONS_API_URL || 'https://api.omnidimensions.com',
      apiKey: process.env.OMNIDIMENSIONS_API_KEY || '',
      username: process.env.OMNIDIMENSIONS_USERNAME || '',
      password: process.env.OMNIDIMENSIONS_PASSWORD || ''
    };

    this.setupMiddleware();
    this.setupRoutes();
    this.authenticateWithOmnidimensions();
    
    logger.info('Call Service initialized');
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, { 
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  async authenticateWithOmnidimensions() {
    // Placeholder for Omnidimensions authentication
    // This would be implemented based on their actual API documentation
    
    if (!this.omnidimensionsConfig.apiKey) {
      logger.warn('Omnidimensions API key not configured - running in stub mode');
      return;
    }

    try {
      // Simulated authentication call
      logger.info('Authenticating with Omnidimensions API...');
      
      // Actual implementation would make a real API call here
      // const authResponse = await axios.post(`${this.omnidimensionsConfig.apiUrl}/auth`, {
      //   username: this.omnidimensionsConfig.username,
      //   password: this.omnidimensionsConfig.password,
      //   apiKey: this.omnidimensionsConfig.apiKey
      // });
      
      // For now, just log that we're in stub mode
      logger.info('Omnidimensions authentication stub - ready to receive calls');
      
    } catch (error) {
      logger.error('Failed to authenticate with Omnidimensions:', error.message);
    }
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'Call Service',
        version: '1.0.0',
        omnidimensions: {
          configured: !!this.omnidimensionsConfig.apiKey,
          status: this.omnidimensionsConfig.apiKey ? 'connected' : 'stub-mode'
        }
      });
    });

    // Webhook endpoint for incoming calls from Omnidimensions
    this.app.post('/webhook/call', this.validateCallData, async (req, res) => {
      try {
        const callData = req.body;
        logger.info('Incoming call webhook', { callId: callData.callId });
        
        await this.handleIncomingCall(callData);
        
        res.json({
          success: true,
          message: 'Call processed successfully'
        });
        
      } catch (error) {
        logger.error('Error processing call webhook:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Manual call reporting endpoint (for testing)
    this.app.post('/report', this.validateComplaintData, async (req, res) => {
      try {
        const complaintData = req.body;
        logger.info('Manual call report', { phoneNumber: complaintData.phoneNumber });
        
        const complaintId = await this.submitComplaint(complaintData);
        
        res.json({
          success: true,
          message: 'Complaint submitted successfully',
          complaintId
        });
        
      } catch (error) {
        logger.error('Error submitting manual complaint:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Call status endpoint
    this.app.get('/calls/:callId', async (req, res) => {
      try {
        const { callId } = req.params;
        const callStatus = await this.getCallStatus(callId);
        
        res.json({
          success: true,
          data: callStatus
        });
        
      } catch (error) {
        logger.error('Error getting call status:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Call analytics endpoint
    this.app.get('/analytics', async (req, res) => {
      try {
        const analytics = await this.getCallAnalytics();
        
        res.json({
          success: true,
          data: analytics
        });
        
      } catch (error) {
        logger.error('Error getting call analytics:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
  }

  validateCallData = (req, res, next) => {
    const schema = Joi.object({
      callId: Joi.string().required(),
      phoneNumber: Joi.string().required(),
      callerName: Joi.string().optional(),
      callDuration: Joi.number().optional(),
      recordingUrl: Joi.string().uri().optional(),
      transcript: Joi.string().optional(),
      agentId: Joi.string().optional(),
      timestamp: Joi.date().optional(),
      metadata: Joi.object().optional()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    next();
  };

  validateComplaintData = (req, res, next) => {
    const schema = Joi.object({
      phoneNumber: Joi.string().required(),
      callerName: Joi.string().optional(),
      title: Joi.string().min(10).max(200).required(),
      description: Joi.string().min(20).max(2000).required(),
      category: Joi.string().optional(),
      severity: Joi.string().valid('Low', 'Medium', 'High', 'Critical').optional(),
      location: Joi.object({
        address: Joi.string().required(),
        coordinates: Joi.array().items(Joi.number()).length(2).optional()
      }).required(),
      agentId: Joi.string().optional(),
      callId: Joi.string().optional(),
      recordingUrl: Joi.string().uri().optional()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    next();
  };

  async handleIncomingCall(callData) {
    logger.info('Processing incoming call', { callId: callData.callId });

    // Extract complaint information from call transcript or metadata
    const complaintInfo = this.extractComplaintFromCall(callData);
    
    if (complaintInfo) {
      const complaintId = await this.submitComplaint(complaintInfo);
      logger.info('Complaint created from call', { 
        callId: callData.callId, 
        complaintId 
      });
      
      // Optionally, notify the caller about the complaint ID
      await this.notifyCaller(callData.phoneNumber, complaintId);
    }

    // Store call record for analytics
    await this.storeCallRecord(callData);
  }

  extractComplaintFromCall(callData) {
    // This would typically use NLP to extract complaint details from transcript
    // For now, we'll return a simplified extraction
    
    if (!callData.transcript && !callData.metadata) {
      logger.warn('No transcript or metadata available for complaint extraction');
      return null;
    }

    const transcript = callData.transcript || '';
    
    // Simple keyword-based extraction (in production, use proper NLP)
    let category = 'Other';
    let severity = 'Medium';
    
    // Basic category detection
    if (transcript.toLowerCase().includes('road') || transcript.toLowerCase().includes('street')) {
      category = 'Infrastructure';
    } else if (transcript.toLowerCase().includes('hospital') || transcript.toLowerCase().includes('health')) {
      category = 'Healthcare';
    } else if (transcript.toLowerCase().includes('police') || transcript.toLowerCase().includes('crime')) {
      category = 'Public Safety';
      severity = 'High';
    }

    // Basic severity detection
    if (transcript.toLowerCase().includes('emergency') || transcript.toLowerCase().includes('urgent')) {
      severity = 'Critical';
    } else if (transcript.toLowerCase().includes('serious') || transcript.toLowerCase().includes('major')) {
      severity = 'High';
    }

    return {
      userId: callData.phoneNumber,
      phoneNumber: callData.phoneNumber,
      callerName: callData.callerName || 'Unknown',
      title: this.generateTitleFromTranscript(transcript),
      description: transcript || 'Complaint received via phone call',
      category,
      severity,
      location: {
        address: 'Location provided via phone call',
        coordinates: [77.2090, 28.6139] // Default coordinates
      },
      channel: 'Call',
      agentId: callData.agentId,
      callId: callData.callId,
      recordingUrl: callData.recordingUrl
    };
  }

  generateTitleFromTranscript(transcript) {
    if (!transcript) return 'Phone complaint';
    
    // Extract first meaningful sentence as title
    const sentences = transcript.split('.').filter(s => s.trim().length > 10);
    if (sentences.length > 0) {
      let title = sentences[0].trim();
      if (title.length > 200) title = title.substring(0, 197) + '...';
      if (title.length < 10) title = 'Phone complaint: ' + title;
      return title;
    }
    
    return 'Phone complaint';
  }

  async submitComplaint(complaintData) {
    try {
      const response = await axios.post(`${this.backendUrl}/api/complaints/report`, complaintData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      if (response.data.success) {
        return response.data.data.complaintId;
      } else {
        throw new Error(response.data.message || 'Failed to submit complaint');
      }
    } catch (error) {
      logger.error('Backend API error:', error.response?.data || error.message);
      throw error;
    }
  }

  async notifyCaller(phoneNumber, complaintId) {
    // This would integrate with SMS service or call back system
    logger.info('Caller notification', { phoneNumber, complaintId });
    
    // Placeholder for SMS notification
    // In production, integrate with SMS gateway
    console.log(`SMS to ${phoneNumber}: Your complaint ${complaintId} has been registered successfully.`);
  }

  async storeCallRecord(callData) {
    // Store call record for analytics and auditing
    // This could be in a database or analytics service
    logger.info('Call record stored', { callId: callData.callId });
  }

  async getCallStatus(callId) {
    // Placeholder for getting call status from Omnidimensions
    return {
      callId,
      status: 'completed',
      duration: 180,
      timestamp: new Date().toISOString(),
      complaintGenerated: true
    };
  }

  async getCallAnalytics() {
    // Placeholder for call analytics
    return {
      totalCalls: 150,
      complaintsGenerated: 120,
      averageCallDuration: 180,
      conversionRate: 80,
      topCategories: [
        { category: 'Infrastructure', count: 45 },
        { category: 'Utilities', count: 30 },
        { category: 'Public Safety', count: 25 }
      ]
    };
  }

  start() {
    this.app.listen(this.port, () => {
      logger.info(`Call Service running on port ${this.port}`);
      console.log(`📞 Call Service ready on http://localhost:${this.port}`);
      console.log(`🔗 Webhook endpoint: http://localhost:${this.port}/webhook/call`);
    });
  }
}

// Initialize and start the service
const callService = new CallService();
callService.start();

module.exports = CallService;
