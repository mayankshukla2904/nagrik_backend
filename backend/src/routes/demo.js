const express = require('express');
const router = express.Router();
const EnhancedComplaint = require('../models/EnhancedComplaint');
const logger = require('../utils/logger');

/**
 * Create sample data for demonstration
 */
router.post('/create-sample-data', async (req, res) => {
  try {
    const sampleComplaints = [
      {
        title: "Road Repair Needed in Ranchi Main Road",
        description: "The main road from Ranchi station to Kanke has multiple potholes causing traffic issues and vehicle damage. Urgent repair needed especially during monsoon season.",
        category: "Infrastructure",
        subcategory: "Roads",
        department: "Public Works Department",
        priority: "high",
        urgency: 7,
        sentiment: "negative",
        location: {
          address: "Main Road, Ranchi, Jharkhand",
          district: "Ranchi",
          coordinates: { lat: 23.3441, lon: 85.3096 }
        },
        upvoteCount: 12,
        upvotedBy: ["9876543210", "9876543211", "9876543212"],
        status: "open",
        createdBy: "9876543210",
        trackingNumber: "TKN000001",
        contactInfo: { phone: "9876543210", email: "citizen1@example.com" },
        classification: {
          confidence: 0.9,
          keywords: ["road", "pothole", "repair"],
          estimatedResolutionTime: 72,
          processedBy: "enhanced_rag"
        }
      },
      {
        title: "Water Shortage in Jharia Mining Area",
        description: "Severe water shortage affecting 500+ families in Jharia coal mining area. No water supply for last 3 days. Immediate tanker service required.",
        category: "Water Supply",
        subcategory: "Water Shortage",
        department: "Water Resources",
        priority: "urgent",
        urgency: 9,
        sentiment: "angry",
        location: {
          address: "Jharia, Dhanbad, Jharkhand",
          district: "Dhanbad",
          coordinates: { lat: 23.7401, lon: 86.4093 }
        },
        upvoteCount: 25,
        upvotedBy: Array.from({length: 25}, (_, i) => `98765432${String(i).padStart(2, '0')}`),
        status: "in_progress",
        createdBy: "9876543220",
        trackingNumber: "TKN000002",
        contactInfo: { phone: "9876543220", email: "citizen2@example.com" },
        classification: {
          confidence: 0.95,
          keywords: ["water", "shortage", "mining"],
          estimatedResolutionTime: 4,
          processedBy: "enhanced_rag"
        }
      },
      {
        title: "Power Outage in Jamshedpur Steel City",
        description: "Frequent power cuts in Bistupur area of Jamshedpur for past week. Affecting local businesses and students preparing for exams.",
        category: "Electricity",
        subcategory: "Power Outage",
        department: "Power Department",
        priority: "high",
        urgency: 6,
        sentiment: "negative",
        location: {
          address: "Bistupur, Jamshedpur, Jharkhand",
          district: "East Singhbhum",
          coordinates: { lat: 22.8046, lon: 86.2029 }
        },
        upvoteCount: 8,
        upvotedBy: ["9876543230", "9876543231", "9876543232"],
        status: "open",
        createdBy: "9876543230",
        trackingNumber: "TKN000003",
        contactInfo: { phone: "9876543230", email: "citizen3@example.com" },
        classification: {
          confidence: 0.88,
          keywords: ["power", "outage", "electricity"],
          estimatedResolutionTime: 12,
          processedBy: "enhanced_rag"
        }
      },
      {
        title: "Healthcare Facility Shortage in Tribal Area",
        description: "Remote tribal village in Khunti district lacks basic healthcare facility. Nearest hospital is 50km away. Need mobile medical unit or primary health center.",
        category: "Healthcare",
        subcategory: "Hospital Services",
        department: "Health Department",
        priority: "high",
        urgency: 8,
        sentiment: "neutral",
        location: {
          address: "Remote Village, Khunti, Jharkhand",
          district: "Khunti",
          coordinates: { lat: 23.0407, lon: 85.2792 }
        },
        upvoteCount: 15,
        upvotedBy: Array.from({length: 15}, (_, i) => `98765433${String(i).padStart(2, '0')}`),
        status: "open",
        createdBy: "9876543340",
        trackingNumber: "TKN000004",
        contactInfo: { phone: "9876543340", email: "tribal.leader@example.com" },
        classification: {
          confidence: 0.92,
          keywords: ["healthcare", "tribal", "medical"],
          estimatedResolutionTime: 168,
          processedBy: "enhanced_rag"
        }
      },
      {
        title: "Illegal Mining Activity Near Forest Area",
        description: "Unauthorized coal mining detected near protected forest area in West Singhbhum. Environmental damage and tribal land encroachment reported.",
        category: "Mining Issues",
        subcategory: "Environmental Impact",
        department: "Mining Department",
        priority: "urgent",
        urgency: 9,
        sentiment: "angry",
        location: {
          address: "Forest Area, West Singhbhum, Jharkhand",
          district: "West Singhbhum",
          coordinates: { lat: 22.5519, lon: 85.0422 }
        },
        upvoteCount: 32,
        upvotedBy: Array.from({length: 32}, (_, i) => `98765434${String(i).padStart(2, '0')}`),
        status: "in_progress",
        createdBy: "9876543450",
        trackingNumber: "TKN000005",
        contactInfo: { phone: "9876543450", email: "forest.guard@example.com" },
        classification: {
          confidence: 0.94,
          keywords: ["mining", "illegal", "forest", "environment"],
          estimatedResolutionTime: 48,
          processedBy: "enhanced_rag"
        }
      },
      {
        title: "School Building Damage in Rural Area",
        description: "Primary school building in Latehar district has damaged roof and walls. Monsoon season approaching, need immediate repair to continue classes.",
        category: "Education",
        subcategory: "School Infrastructure",
        department: "Education Department",
        priority: "medium",
        urgency: 5,
        sentiment: "neutral",
        location: {
          address: "Village School, Latehar, Jharkhand",
          district: "Latehar",
          coordinates: { lat: 23.7437, lon: 84.4194 }
        },
        upvoteCount: 6,
        upvotedBy: ["9876543560", "9876543561", "9876543562"],
        status: "open",
        createdBy: "9876543560",
        trackingNumber: "TKN000006",
        contactInfo: { phone: "9876543560", email: "headmaster@example.com" },
        classification: {
          confidence: 0.86,
          keywords: ["school", "building", "education", "repair"],
          estimatedResolutionTime: 120,
          processedBy: "enhanced_rag"
        }
      },
      {
        title: "Waste Management Crisis in Bokaro",
        description: "Garbage collection has been irregular in Sector 4, Bokaro for past month. Waste accumulation causing health hazards and bad odor in residential area.",
        category: "Sanitation",
        subcategory: "Waste Management",
        department: "Urban Development",
        priority: "medium",
        urgency: 4,
        sentiment: "negative",
        location: {
          address: "Sector 4, Bokaro, Jharkhand",
          district: "Bokaro",
          coordinates: { lat: 23.6693, lon: 85.9590 }
        },
        upvoteCount: 18,
        upvotedBy: Array.from({length: 18}, (_, i) => `98765436${String(i).padStart(2, '0')}`),
        status: "open",
        createdBy: "9876543670",
        trackingNumber: "TKN000007",
        contactInfo: { phone: "9876543670", email: "resident@example.com" },
        classification: {
          confidence: 0.83,
          keywords: ["waste", "garbage", "sanitation"],
          estimatedResolutionTime: 24,
          processedBy: "enhanced_rag"
        }
      },
      {
        title: "Public Transport Issues in Deoghar",
        description: "Insufficient bus services between Deoghar and nearby villages. Pilgrims and locals facing difficulty in transportation, especially during festival seasons.",
        category: "Transportation",
        subcategory: "Public Transport",
        department: "Transport Department",
        priority: "medium",
        urgency: 3,
        sentiment: "neutral",
        location: {
          address: "Deoghar Bus Stand, Deoghar, Jharkhand",
          district: "Deoghar",
          coordinates: { lat: 24.4847, lon: 86.6914 }
        },
        upvoteCount: 11,
        upvotedBy: Array.from({length: 11}, (_, i) => `98765437${String(i).padStart(2, '0')}`),
        status: "open",
        createdBy: "9876543780",
        trackingNumber: "TKN000008",
        contactInfo: { phone: "9876543780", email: "pilgrim@example.com" },
        classification: {
          confidence: 0.79,
          keywords: ["transport", "bus", "public"],
          estimatedResolutionTime: 72,
          processedBy: "enhanced_rag"
        }
      }
    ];

    // Check if sample data already exists
    const existingCount = await EnhancedComplaint.countDocuments();
    if (existingCount > 0) {
      return res.json({
        success: true,
        message: `Database already has ${existingCount} complaints. Sample data not created.`,
        data: { existingCount }
      });
    }

    // Create sample complaints
    const createdComplaints = [];
    for (const complaintData of sampleComplaints) {
      const complaint = new EnhancedComplaint({
        ...complaintData,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random date within last week
        updatedAt: new Date()
      });
      
      const saved = await complaint.save();
      createdComplaints.push(saved);
    }

    logger.info(`Created ${createdComplaints.length} sample complaints for demonstration`);

    res.json({
      success: true,
      message: `Successfully created ${createdComplaints.length} sample complaints`,
      data: {
        created: createdComplaints.length,
        complaints: createdComplaints.map(c => ({
          id: c._id,
          title: c.title,
          department: c.department,
          priority: c.priority,
          upvoteCount: c.upvoteCount
        }))
      }
    });

  } catch (error) {
    logger.error('Sample data creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create sample data'
    });
  }
});

/**
 * Get demo statistics
 */
router.get('/demo-stats', async (req, res) => {
  try {
    const stats = {
      totalComplaints: await EnhancedComplaint.countDocuments(),
      departmentBreakdown: await EnhancedComplaint.aggregate([
        { $group: { _id: '$department', count: { $sum: 1 }, upvotes: { $sum: '$upvoteCount' } } },
        { $sort: { count: -1 } }
      ]),
      priorityBreakdown: await EnhancedComplaint.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      recentComplaints: await EnhancedComplaint.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title department priority upvoteCount createdAt')
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Demo stats failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get demo statistics'
    });
  }
});

module.exports = router;
