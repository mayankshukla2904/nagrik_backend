const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// GET /api/dashboard/overview - Dashboard overview statistics
router.get('/overview', catchAsync(async (req, res) => {
  const [
    totalComplaints,
    totalUsers,
    complaintsByStatus,
    complaintsByCategory,
    complaintsBySeverity,
    recentComplaints
  ] = await Promise.all([
    Complaint.countDocuments(),
    User.countDocuments(),
    Complaint.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]),
    Complaint.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]),
    Complaint.aggregate([
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ]),
    Complaint.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('complaintId category severity status createdAt userId')
  ]);

  // Calculate resolution metrics
  const resolvedComplaints = await Complaint.countDocuments({ status: 'Resolved' });
  const resolutionRate = totalComplaints > 0 ? (resolvedComplaints / totalComplaints) * 100 : 0;

  // Calculate average resolution time
  const resolvedComplaintsWithTimeline = await Complaint.find({ 
    status: 'Resolved',
    'timeline.status': 'Resolved'
  }).select('createdAt timeline');

  let avgResolutionTime = 0;
  if (resolvedComplaintsWithTimeline.length > 0) {
    const totalResolutionTime = resolvedComplaintsWithTimeline.reduce((total, complaint) => {
      const resolvedEntry = complaint.timeline.find(entry => entry.status === 'Resolved');
      if (resolvedEntry) {
        return total + (resolvedEntry.timestamp - complaint.createdAt);
      }
      return total;
    }, 0);
    avgResolutionTime = totalResolutionTime / resolvedComplaintsWithTimeline.length;
  }

  // Convert milliseconds to days
  const avgResolutionDays = Math.round(avgResolutionTime / (1000 * 60 * 60 * 24));

  res.json({
    success: true,
    data: {
      overview: {
        totalComplaints,
        totalUsers,
        resolutionRate: Math.round(resolutionRate * 100) / 100,
        avgResolutionDays
      },
      distribution: {
        byStatus: complaintsByStatus,
        byCategory: complaintsByCategory,
        bySeverity: complaintsBySeverity
      },
      recentComplaints
    }
  });
}));

// GET /api/dashboard/analytics - Analytics data for charts
router.get('/analytics', catchAsync(async (req, res) => {
  const { period = '30', type = 'trend' } = req.query;
  
  const days = parseInt(period);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  if (type === 'trend') {
    // Get daily complaint trends
    const trendData = await Complaint.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 },
          resolved: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0]
            }
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        type: 'trend',
        period: days,
        data: trendData
      }
    });
  } else if (type === 'geographic') {
    // Get geographic distribution
    const geoData = await Complaint.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            city: '$location.city',
            state: '$location.state'
          },
          count: { $sum: 1 },
          categories: { $push: '$category' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 20
      }
    ]);

    res.json({
      success: true,
      data: {
        type: 'geographic',
        period: days,
        data: geoData
      }
    });
  } else if (type === 'performance') {
    // Get performance metrics by department/category
    const performanceData = await Complaint.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: 1 },
          resolved: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0]
            }
          },
          avgSeverity: {
            $avg: {
              $switch: {
                branches: [
                  { case: { $eq: ['$severity', 'Low'] }, then: 1 },
                  { case: { $eq: ['$severity', 'Medium'] }, then: 2 },
                  { case: { $eq: ['$severity', 'High'] }, then: 3 },
                  { case: { $eq: ['$severity', 'Critical'] }, then: 4 }
                ],
                default: 2
              }
            }
          }
        }
      },
      {
        $addFields: {
          resolutionRate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $multiply: [{ $divide: ['$resolved', '$total'] }, 100] },
              0
            ]
          }
        }
      },
      {
        $sort: { total: -1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        type: 'performance',
        period: days,
        data: performanceData
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Invalid analytics type. Use: trend, geographic, or performance'
    });
  }
}));

// GET /api/dashboard/alerts - Get system alerts and notifications
router.get('/alerts', catchAsync(async (req, res) => {
  const alerts = [];

  // High severity unresolved complaints
  const criticalComplaints = await Complaint.countDocuments({
    severity: 'Critical',
    status: { $nin: ['Resolved', 'Closed'] }
  });

  if (criticalComplaints > 0) {
    alerts.push({
      type: 'critical',
      message: `${criticalComplaints} critical complaints pending resolution`,
      count: criticalComplaints,
      action: '/complaints?severity=Critical&status=Under Review,In Progress'
    });
  }

  // Old unresolved complaints
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 7); // 7 days old

  const oldComplaints = await Complaint.countDocuments({
    createdAt: { $lt: oldDate },
    status: { $nin: ['Resolved', 'Closed'] }
  });

  if (oldComplaints > 0) {
    alerts.push({
      type: 'warning',
      message: `${oldComplaints} complaints older than 7 days`,
      count: oldComplaints,
      action: '/complaints?dateFrom=' + oldDate.toISOString()
    });
  }

  // Escalated complaints
  const escalatedComplaints = await Complaint.countDocuments({
    escalationLevel: { $gt: 0 },
    status: { $nin: ['Resolved', 'Closed'] }
  });

  if (escalatedComplaints > 0) {
    alerts.push({
      type: 'info',
      message: `${escalatedComplaints} escalated complaints require attention`,
      count: escalatedComplaints,
      action: '/complaints?escalated=true'
    });
  }

  res.json({
    success: true,
    data: {
      alerts,
      timestamp: new Date()
    }
  });
}));

// GET /api/dashboard/export - Export complaints data
router.get('/export', catchAsync(async (req, res) => {
  const { format = 'json', ...filters } = req.query;

  // Build filter object
  const filter = {};
  if (filters.category) filter.category = filters.category;
  if (filters.severity) filter.severity = filters.severity;
  if (filters.status) filter.status = filters.status;
  if (filters.dateFrom || filters.dateTo) {
    filter.createdAt = {};
    if (filters.dateFrom) filter.createdAt.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) filter.createdAt.$lte = new Date(filters.dateTo);
  }

  const complaints = await Complaint.find(filter)
    .select('-timeline -escalationHistory -aiClassification -metadata')
    .sort({ createdAt: -1 });

  if (format === 'csv') {
    // Convert to CSV format
    const csv = complaints.map(complaint => {
      return [
        complaint.complaintId,
        complaint.userId,
        complaint.category,
        complaint.severity,
        complaint.status,
        complaint.title,
        complaint.description.replace(/,/g, ';'), // Replace commas to avoid CSV issues
        complaint.formattedLocation,
        complaint.createdAt.toISOString(),
        complaint.updatedAt.toISOString()
      ].join(',');
    });

    const csvHeader = [
      'Complaint ID',
      'User ID',
      'Category',
      'Severity',
      'Status',
      'Title',
      'Description',
      'Location',
      'Created At',
      'Updated At'
    ].join(',');

    const csvContent = [csvHeader, ...csv].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=complaints.csv');
    res.send(csvContent);
  } else {
    res.json({
      success: true,
      data: {
        complaints,
        total: complaints.length,
        exportedAt: new Date()
      }
    });
  }
}));

module.exports = router;
