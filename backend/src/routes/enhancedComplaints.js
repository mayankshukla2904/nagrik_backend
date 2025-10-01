const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const EnhancedComplaint = require('../models/EnhancedComplaint');
const classificationService = require('../services/classificationService');
const complaintService = require('../services/complaintService');
const logger = require('../utils/logger');

/**
 * Enhanced complaint submission with similarity detection and upvoting
 */
router.post('/enhanced', async (req, res) => {
  try {
    const { title, description, location, contactInfo, attachments, userPhone } = req.body;

    logger.info('Enhanced complaint submission received', { 
      title: title?.substring(0, 50),
      location: location?.address 
    });

    // Validate required fields
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: 'Title and description are required'
      });
    }

    // Enhanced classification with location validation
    const classification = await classificationService.classifyComplaint(
      `${title} ${description}`, 
      location?.address || '', 
      userPhone
    );

    // Check for similar complaints
    const similarityCheck = await classificationService.findSimilarComplaints(
      `${title} ${description}`,
      location
    );

    // If similar complaint found, ask user if they want to upvote instead
    if (similarityCheck.found_similar && similarityCheck.similar_complaints.length > 0) {
      return res.status(200).json({
        success: true,
        action: 'similar_found',
        message: 'Similar complaints found. Would you like to upvote an existing complaint instead?',
        similar_complaints: similarityCheck.similar_complaints,
        classification,
        suggested_action: 'upvote_existing'
      });
    }

    // Validate location if provided
    let locationValidation = {};
    if (location?.address) {
      locationValidation = await classificationService.validateLocation(location.address);
    }

    // Create enhanced complaint
    const enhancedComplaintData = {
      title,
      description,
      category: classification.category,
      subcategory: classification.subcategory,
      urgency: classification.urgency || 5,
      priority: classification.priority || 'medium',
      sentiment: classification.sentiment || 'neutral',
      department: classification.department,
      location: {
        ...location,
        validation: locationValidation,
        district: locationValidation.district,
        coordinates: locationValidation.coordinates
      },
      contactInfo,
      attachments,
      userPhone,
      classification: {
        confidence: classification.confidence,
        keywords: classification.keywords,
        missingInfo: classification.missingInfo,
        suggestedQuestions: classification.suggestedQuestions,
        estimatedResolutionTime: classification.estimatedResolutionTime,
        processedBy: classification.success ? 'enhanced_rag' : 'fallback',
        processedAt: new Date()
      },
      upvoteCount: 1, // Creator's implicit upvote
      upvotedBy: userPhone ? [userPhone] : [],
      similarComplaints: [],
      status: 'open',
      createdBy: userPhone || 'anonymous',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Enhance with AI if available
    const aiEnhanced = await classificationService.enhanceComplaint(enhancedComplaintData);
    
    // Create the complaint
    const enhancedComplaint = new EnhancedComplaint(aiEnhanced);
    await enhancedComplaint.save();

    logger.info('Enhanced complaint created successfully', { 
      id: enhancedComplaint._id,
      category: enhancedComplaint.category,
      upvotes: enhancedComplaint.upvoteCount
    });

    res.status(201).json({
      success: true,
      action: 'complaint_created',
      message: 'Complaint registered successfully with enhanced features',
      data: {
        id: enhancedComplaint._id,
        title: enhancedComplaint.title,
        category: enhancedComplaint.category,
        priority: enhancedComplaint.priority,
        department: enhancedComplaint.department,
        upvoteCount: enhancedComplaint.upvoteCount,
        estimatedResolutionTime: enhancedComplaint.classification.estimatedResolutionTime,
        trackingNumber: enhancedComplaint.trackingNumber,
        status: enhancedComplaint.status
      }
    });

  } catch (error) {
    logger.error('Enhanced complaint submission failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to process enhanced complaint submission'
    });
  }
});

/**
 * Upvote an existing complaint
 */
router.post('/:id/upvote', async (req, res) => {
  try {
    const { id } = req.params;
    const { userPhone } = req.body;

    if (!userPhone) {
      return res.status(400).json({
        success: false,
        error: 'User phone number is required for upvoting'
      });
    }

    const complaint = await EnhancedComplaint.findById(id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found'
      });
    }

    // Check if user already upvoted
    if (complaint.upvotedBy.includes(userPhone)) {
      return res.status(400).json({
        success: false,
        error: 'You have already upvoted this complaint'
      });
    }

    // Add upvote
    complaint.upvoteCount += 1;
    complaint.upvotedBy.push(userPhone);
    complaint.updatedAt = new Date();

    // Update priority based on upvotes
    if (complaint.upvoteCount >= 10 && complaint.priority === 'medium') {
      complaint.priority = 'high';
    } else if (complaint.upvoteCount >= 5 && complaint.priority === 'low') {
      complaint.priority = 'medium';
    }

    await complaint.save();

    logger.info('Complaint upvoted successfully', { 
      id: complaint._id,
      newUpvoteCount: complaint.upvoteCount,
      priority: complaint.priority
    });

    res.status(200).json({
      success: true,
      message: 'Complaint upvoted successfully',
      data: {
        id: complaint._id,
        upvoteCount: complaint.upvoteCount,
        priority: complaint.priority,
        title: complaint.title
      }
    });

  } catch (error) {
    logger.error('Upvoting failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to upvote complaint'
    });
  }
});

/**
 * Find similar complaints for a given text and location
 */
router.post('/find-similar', async (req, res) => {
  try {
    const { text, location } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required for similarity search'
      });
    }

    const similarComplaints = await EnhancedComplaint.findSimilar(text, location);

    res.status(200).json({
      success: true,
      data: {
        found: similarComplaints.length > 0,
        count: similarComplaints.length,
        complaints: similarComplaints.map(complaint => ({
          id: complaint._id,
          title: complaint.title,
          description: complaint.description.substring(0, 200) + '...',
          category: complaint.category,
          upvoteCount: complaint.upvoteCount,
          status: complaint.status,
          createdAt: complaint.createdAt,
          similarity: complaint.similarity || 0.8
        }))
      }
    });

  } catch (error) {
    logger.error('Similar complaints search failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to find similar complaints'
    });
  }
});

/**
 * Get enhanced complaints with upvoting information
 */
router.get('/enhanced', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      status, 
      priority,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      minUpvotes = 0
    } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (minUpvotes > 0) filter.upvoteCount = { $gte: parseInt(minUpvotes) };

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const complaints = await EnhancedComplaint.find(filter)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('assignedTo', 'name email')
      .lean();

    const total = await EnhancedComplaint.countDocuments(filter);

    // Add additional computed fields
    const enhancedComplaints = complaints.map(complaint => ({
      ...complaint,
      isPopular: complaint.upvoteCount >= 5,
      isTrending: complaint.upvoteCount >= 3 && 
                  (new Date() - new Date(complaint.createdAt)) / (1000 * 60 * 60) <= 24,
      urgencyLevel: complaint.urgency >= 7 ? 'high' : complaint.urgency >= 4 ? 'medium' : 'low'
    }));

    res.status(200).json({
      success: true,
      data: {
        complaints: enhancedComplaints,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        },
        stats: {
          totalComplaints: total,
          avgUpvotes: complaints.reduce((sum, c) => sum + c.upvoteCount, 0) / complaints.length || 0,
          topCategory: await getTopCategory(),
          popularComplaints: complaints.filter(c => c.upvoteCount >= 5).length
        }
      }
    });

  } catch (error) {
    logger.error('Enhanced complaints retrieval failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve enhanced complaints'
    });
  }
});

/**
 * Get complaint statistics with upvoting information
 */
router.get('/stats/enhanced', async (req, res) => {
  try {
    const [
      totalComplaints,
      totalUpvotes,
      popularComplaints,
      trendingComplaints,
      categoryStats,
      priorityStats
    ] = await Promise.all([
      EnhancedComplaint.countDocuments(),
      EnhancedComplaint.aggregate([
        { $group: { _id: null, total: { $sum: '$upvoteCount' } } }
      ]),
      EnhancedComplaint.countDocuments({ upvoteCount: { $gte: 5 } }),
      EnhancedComplaint.countDocuments({ 
        upvoteCount: { $gte: 3 },
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }),
      EnhancedComplaint.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 }, upvotes: { $sum: '$upvoteCount' } } },
        { $sort: { upvotes: -1 } }
      ]),
      EnhancedComplaint.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalComplaints,
          totalUpvotes: totalUpvotes[0]?.total || 0,
          popularComplaints,
          trendingComplaints,
          avgUpvotesPerComplaint: totalComplaints > 0 ? 
            (totalUpvotes[0]?.total || 0) / totalComplaints : 0
        },
        categories: categoryStats,
        priorities: priorityStats,
        engagement: {
          upvotingRate: totalComplaints > 0 ? 
            (totalUpvotes[0]?.total || 0) / totalComplaints : 0,
          popularityThreshold: 5,
          trendingThreshold: 3
        }
      }
    });

  } catch (error) {
    logger.error('Enhanced stats retrieval failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve enhanced statistics'
    });
  }
});

// Helper function to get top category
async function getTopCategory() {
  try {
    const result = await EnhancedComplaint.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    return result[0]?._id || 'Infrastructure';
  } catch (error) {
    return 'Infrastructure';
  }
}

module.exports = router;
