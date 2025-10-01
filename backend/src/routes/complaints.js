const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { 
  validateComplaint, 
  validateComplaintUpdate, 
  validateComplaintFeedback,
  validateComplaintQuery 
} = require('../middleware/validation');
const complaintService = require('../services/complaintService');
const classificationService = require('../services/classificationService');
const logger = require('../utils/logger');

// POST /api/complaints/report - Submit a new complaint
router.post('/report', validateComplaint, catchAsync(async (req, res) => {
  const {
    userId,
    channel,
    title,
    description,
    location,
    mediaUrls,
    category,
    subcategory,
    severity,
    tags
  } = req.body;

  logger.info('New complaint submission', { userId, channel });

  // Check if user exists, create if not
  let user = await User.findOne({ userId });
  if (!user) {
    // Extract phone number from userId (assuming userId is phone number)
    user = new User({
      userId,
      phoneNumber: userId,
      totalComplaints: 0
    });
    await user.save();
    logger.info('New user created', { userId });
  }

  // Prepare complaint data
  const complaintData = {
    userId,
    channel,
    title,
    description,
    location,
    mediaUrls: mediaUrls || [],
    tags: tags || [],
    subcategory,
    metadata: {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip
    }
  };

  // Use AI classification if category or severity not provided
  if (!category || !severity) {
    try {
      logger.info('Initiating AI classification', { userId });
      const classification = await classificationService.classifyComplaint({
        title,
        description,
        location: location.address || `${location.coordinates[1]}, ${location.coordinates[0]}`
      });

      complaintData.category = category || classification.category || 'Other';
      complaintData.severity = severity || classification.severity || 'Medium';
      complaintData.aiClassification = classification;
      
      logger.info('AI classification completed', { 
        userId, 
        category: complaintData.category,
        severity: complaintData.severity,
        confidence: classification.confidence 
      });
    } catch (error) {
      logger.error('AI classification failed, using defaults', { userId, error: error.message });
      complaintData.category = category || 'Other';
      complaintData.severity = severity || 'Medium';
    }
  } else {
    complaintData.category = category;
    complaintData.severity = severity;
  }

  // Create complaint
  const complaint = new Complaint(complaintData);
  await complaint.save();

  // Update user complaint count
  await user.incrementComplaintCount();

  logger.info('Complaint created successfully', { 
    complaintId: complaint.complaintId,
    userId 
  });

  res.status(201).json({
    success: true,
    message: 'Complaint submitted successfully',
    data: {
      complaintId: complaint.complaintId,
      status: complaint.status,
      category: complaint.category,
      severity: complaint.severity,
      estimatedResolutionTime: complaintService.getEstimatedResolutionTime(complaint.category, complaint.severity)
    }
  });
}));

// GET /api/complaints/:complaintId - Get specific complaint details
router.get('/:complaintId', catchAsync(async (req, res) => {
  const { complaintId } = req.params;

  const complaint = await Complaint.findOne({ complaintId })
    .populate('userId', 'name phoneNumber email');

  if (!complaint) {
    throw new AppError('Complaint not found', 404);
  }

  res.json({
    success: true,
    data: complaint
  });
}));

// GET /api/complaints - Get complaints with filters
router.get('/', validateComplaintQuery, catchAsync(async (req, res) => {
  const {
    page,
    limit,
    category,
    severity,
    status,
    userId,
    location,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder
  } = req.query;

  // Build filter object
  const filter = {};
  
  if (category) filter.category = category;
  if (severity) filter.severity = severity;
  if (status) filter.status = status;
  if (userId) filter.userId = userId;

  // Date range filter
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) filter.createdAt.$lte = new Date(dateTo);
  }

  // Location filter (nearby complaints)
  if (location) {
    filter['location'] = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [location.longitude, location.latitude]
        },
        $maxDistance: location.radius * 1000 // Convert km to meters
      }
    };
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Execute query with pagination
  const skip = (page - 1) * limit;
  
  const [complaints, total] = await Promise.all([
    Complaint.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('-timeline -escalationHistory -aiClassification -metadata'),
    Complaint.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    data: {
      complaints,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }
  });
}));

// PUT /api/complaints/:complaintId/status - Update complaint status
router.put('/:complaintId/status', validateComplaintUpdate, catchAsync(async (req, res) => {
  const { complaintId } = req.params;
  const { status, comment, updatedBy } = req.body;

  const complaint = await Complaint.findOne({ complaintId });
  
  if (!complaint) {
    throw new AppError('Complaint not found', 404);
  }

  const oldStatus = complaint.status;
  complaint.status = status;
  complaint.metadata.updatedBy = updatedBy;

  // Add timeline entry (automatically handled by pre-save middleware)
  if (comment) {
    complaint.timeline[complaint.timeline.length - 1].comment = comment;
  }

  await complaint.save();

  // Update user stats if complaint resolved
  if (status === 'Resolved' && oldStatus !== 'Resolved') {
    const user = await User.findOne({ userId: complaint.userId });
    if (user) {
      await user.incrementResolvedCount();
    }
  }

  logger.info('Complaint status updated', { 
    complaintId, 
    oldStatus, 
    newStatus: status, 
    updatedBy 
  });

  res.json({
    success: true,
    message: 'Complaint status updated successfully',
    data: {
      complaintId,
      status,
      timeline: complaint.timeline
    }
  });
}));

// POST /api/complaints/:complaintId/feedback - Add feedback to resolved complaint
router.post('/:complaintId/feedback', validateComplaintFeedback, catchAsync(async (req, res) => {
  const { complaintId } = req.params;
  const { rating, comment } = req.body;

  const complaint = await Complaint.findOne({ complaintId });
  
  if (!complaint) {
    throw new AppError('Complaint not found', 404);
  }

  if (complaint.status !== 'Resolved') {
    throw new AppError('Feedback can only be added to resolved complaints', 400);
  }

  await complaint.addFeedback(rating, comment);

  logger.info('Feedback added to complaint', { complaintId, rating });

  res.json({
    success: true,
    message: 'Feedback added successfully',
    data: {
      complaintId,
      feedback: complaint.feedback
    }
  });
}));

// POST /api/complaints/:complaintId/escalate - Escalate complaint
router.post('/:complaintId/escalate', catchAsync(async (req, res) => {
  const { complaintId } = req.params;
  const { reason, escalatedBy } = req.body;

  if (!reason || !escalatedBy) {
    throw new AppError('Reason and escalatedBy are required', 400);
  }

  const complaint = await Complaint.findOne({ complaintId });
  
  if (!complaint) {
    throw new AppError('Complaint not found', 404);
  }

  if (complaint.escalationLevel >= 3) {
    throw new AppError('Complaint already at maximum escalation level', 400);
  }

  await complaint.escalate(reason, escalatedBy);

  logger.info('Complaint escalated', { 
    complaintId, 
    newLevel: complaint.escalationLevel, 
    escalatedBy 
  });

  res.json({
    success: true,
    message: 'Complaint escalated successfully',
    data: {
      complaintId,
      escalationLevel: complaint.escalationLevel,
      priority: complaint.priority
    }
  });
}));

// GET /api/complaints/stats/overview - Get complaint statistics
router.get('/stats/overview', catchAsync(async (req, res) => {
  const stats = await Complaint.getStatistics();
  
  res.json({
    success: true,
    data: stats
  });
}));

// POST /api/complaints/enhanced - Enhanced complaint submission with AI features
router.post('/enhanced', validateComplaint, catchAsync(async (req, res) => {
  const {
    userId,
    channel,
    title,
    description,
    location,
    mediaUrls,
    category,
    subcategory,
    severity,
    tags
  } = req.body;

  logger.info('Enhanced complaint submission', { userId, channel });

  // Check if user exists, create if not
  let user = await User.findOne({ userId });
  if (!user) {
    user = new User({
      userId,
      phoneNumber: userId,
      totalComplaints: 0
    });
    await user.save();
    logger.info('New user created for enhanced submission', { userId });
  }

  // Prepare complaint data with auto-generated complaintId
  const complaintData = {
    userId,
    channel,
    title,
    description,
    location,
    mediaUrls: mediaUrls || [],
    tags: tags || [],
    subcategory,
    metadata: {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      enhanced: true
    }
  };

  // Use AI classification
  try {
    logger.info('Initiating enhanced AI classification', { userId });
    const classification = await classificationService.classifyComplaint({
      title,
      description,
      location: location.address || `${location.coordinates[1]}, ${location.coordinates[0]}`
    });

    complaintData.category = category || classification.category || 'Other';
    complaintData.severity = severity || classification.severity || 'Medium';
    complaintData.aiClassification = classification;
    
    logger.info('Enhanced AI classification completed', { 
      userId, 
      category: complaintData.category,
      severity: complaintData.severity,
      confidence: classification.confidence 
    });
  } catch (error) {
    logger.error('Enhanced AI classification failed, using defaults', { userId, error: error.message });
    complaintData.category = category || 'Other';
    complaintData.severity = severity || 'Medium';
  }

  // Create complaint (complaintId will be auto-generated by pre-save hook)
  const complaint = new Complaint(complaintData);
  await complaint.save();

  // Update user complaint count
  await user.incrementComplaintCount();

  logger.info('Enhanced complaint created successfully', { 
    complaintId: complaint.complaintId,
    userId,
    category: complaint.category 
  });

  res.status(201).json({
    success: true,
    message: 'Enhanced complaint submitted successfully',
    data: {
      complaintId: complaint.complaintId,
      status: complaint.status,
      category: complaint.category,
      severity: complaint.severity,
      estimatedResolution: complaint.estimatedResolutionTime,
      trackingUrl: `${req.protocol}://${req.get('host')}/track/${complaint.complaintId}`
    }
  });
}));

// POST /api/complaints/find-similar - Find similar complaints
router.post('/find-similar', catchAsync(async (req, res) => {
  const { title, description, category } = req.body;

  if (!title && !description) {
    return res.status(400).json({
      success: false,
      message: 'Title or description is required'
    });
  }

  try {
    // Simple similarity search based on keywords
    const searchTerms = (title + ' ' + (description || '')).toLowerCase().split(' ').filter(term => term.length > 3);
    
    const query = {
      $or: [
        { title: { $regex: searchTerms.join('|'), $options: 'i' } },
        { description: { $regex: searchTerms.join('|'), $options: 'i' } }
      ]
    };

    if (category) {
      query.category = category;
    }

    const similarComplaints = await Complaint.find(query)
      .select('complaintId title category status severity createdAt')
      .limit(5)
      .sort({ createdAt: -1 });

    logger.info('Similar complaints found', { 
      searchTerms: searchTerms.length,
      results: similarComplaints.length 
    });

    res.json({
      success: true,
      data: {
        similar: similarComplaints,
        searchTerms,
        count: similarComplaints.length
      }
    });

  } catch (error) {
    logger.error('Similar complaint search failed', { error: error.message });
    res.json({
      success: true,
      data: {
        similar: [],
        searchTerms: [],
        count: 0
      }
    });
  }
}));

module.exports = router;
