const logger = require('../utils/logger');

class ComplaintService {
  constructor() {
    // Estimated resolution times in days based on category and severity
    this.resolutionMatrix = {
      'Infrastructure': { Low: 14, Medium: 10, High: 7, Critical: 3 },
      'Healthcare': { Low: 7, Medium: 5, High: 3, Critical: 1 },
      'Education': { Low: 21, Medium: 14, High: 7, Critical: 3 },
      'Transportation': { Low: 10, Medium: 7, High: 5, Critical: 2 },
      'Environment': { Low: 14, Medium: 10, High: 7, Critical: 3 },
      'Public Safety': { Low: 3, Medium: 2, High: 1, Critical: 1 },
      'Utilities': { Low: 7, Medium: 5, High: 3, Critical: 1 },
      'Governance': { Low: 21, Medium: 14, High: 10, Critical: 7 },
      'Social Services': { Low: 14, Medium: 10, High: 7, Critical: 5 },
      'Economic Issues': { Low: 21, Medium: 14, High: 10, Critical: 7 },
      'Other': { Low: 14, Medium: 10, High: 7, Critical: 5 }
    };

    // Department mapping for automatic assignment
    this.departmentMapping = {
      'Infrastructure': 'Public Works Department',
      'Healthcare': 'Health Department',
      'Education': 'Education Department',
      'Transportation': 'Transport Department',
      'Environment': 'Environment Department',
      'Public Safety': 'Police Department',
      'Utilities': 'Utilities Department',
      'Governance': 'Administrative Department',
      'Social Services': 'Social Welfare Department',
      'Economic Issues': 'Revenue Department',
      'Other': 'General Administration'
    };
  }

  getEstimatedResolutionTime(category, severity) {
    const days = this.resolutionMatrix[category]?.[severity] || 
                 this.resolutionMatrix['Other'][severity] || 7;
    
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + days);
    
    return {
      days,
      estimatedDate: estimatedDate.toISOString(),
      businessDays: this.calculateBusinessDays(days)
    };
  }

  calculateBusinessDays(days) {
    // Rough calculation: 5/7 of total days (excluding weekends)
    return Math.ceil(days * (5/7));
  }

  getAssignedDepartment(category) {
    return this.departmentMapping[category] || this.departmentMapping['Other'];
  }

  generateComplaintId() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `NAGRIK${timestamp.slice(-6)}${random}`;
  }

  calculatePriority(severity, escalationLevel, ageInDays) {
    let priority = 'Medium';

    // Base priority on severity
    switch (severity) {
      case 'Critical':
        priority = 'Urgent';
        break;
      case 'High':
        priority = 'High';
        break;
      case 'Medium':
        priority = 'Medium';
        break;
      case 'Low':
        priority = 'Low';
        break;
    }

    // Escalate priority based on escalation level
    if (escalationLevel > 0) {
      if (priority === 'Low') priority = 'Medium';
      else if (priority === 'Medium') priority = 'High';
      else if (priority === 'High') priority = 'Urgent';
    }

    // Escalate priority based on age
    if (ageInDays > 7) {
      if (priority === 'Low') priority = 'Medium';
      else if (priority === 'Medium') priority = 'High';
    }

    if (ageInDays > 14) {
      if (priority === 'Medium') priority = 'High';
      else if (priority === 'High') priority = 'Urgent';
    }

    return priority;
  }

  validateComplaintData(data) {
    const errors = [];

    // Required fields validation
    if (!data.userId) errors.push('User ID is required');
    if (!data.title || data.title.trim().length < 10) {
      errors.push('Title must be at least 10 characters long');
    }
    if (!data.description || data.description.trim().length < 20) {
      errors.push('Description must be at least 20 characters long');
    }
    if (!data.location || !data.location.coordinates) {
      errors.push('Location coordinates are required');
    }

    // Location validation
    if (data.location && data.location.coordinates) {
      const [lng, lat] = data.location.coordinates;
      if (lng < -180 || lng > 180) errors.push('Invalid longitude');
      if (lat < -90 || lat > 90) errors.push('Invalid latitude');
    }

    // Media URLs validation
    if (data.mediaUrls && data.mediaUrls.length > 5) {
      errors.push('Maximum 5 media files allowed');
    }

    return errors;
  }

  formatComplaintForResponse(complaint) {
    return {
      complaintId: complaint.complaintId,
      category: complaint.category,
      severity: complaint.severity,
      status: complaint.status,
      title: complaint.title,
      description: complaint.description,
      location: complaint.formattedLocation,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
      ageInDays: complaint.ageInDays,
      estimatedResolution: this.getEstimatedResolutionTime(complaint.category, complaint.severity),
      assignedDepartment: this.getAssignedDepartment(complaint.category),
      priority: complaint.priority || this.calculatePriority(
        complaint.severity, 
        complaint.escalationLevel || 0, 
        complaint.ageInDays || 0
      )
    };
  }

  async processIncomingComplaint(rawData, channel = 'Web') {
    try {
      // Validate and sanitize data
      const errors = this.validateComplaintData(rawData);
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(', ')}`);
      }

      // Prepare complaint data
      const complaintData = {
        ...rawData,
        channel,
        status: 'Submitted',
        priority: this.calculatePriority(rawData.severity || 'Medium', 0, 0)
      };

      // Auto-assign department
      if (complaintData.category) {
        complaintData.assignedTo = {
          department: this.getAssignedDepartment(complaintData.category)
        };
      }

      logger.info('Complaint processed for submission', {
        userId: complaintData.userId,
        category: complaintData.category,
        severity: complaintData.severity,
        channel
      });

      return complaintData;

    } catch (error) {
      logger.error('Error processing complaint', { error: error.message, rawData });
      throw error;
    }
  }

  generateStatusUpdateMessage(complaint, newStatus, comment) {
    const statusMessages = {
      'Under Review': `Your complaint ${complaint.complaintId} is now under review by ${complaint.assignedTo?.department || 'relevant department'}.`,
      'In Progress': `Work has started on your complaint ${complaint.complaintId}. ${comment || 'You will be updated on progress.'}`,
      'Resolved': `Your complaint ${complaint.complaintId} has been resolved. ${comment || 'Thank you for your patience.'}`,
      'Closed': `Your complaint ${complaint.complaintId} has been closed. ${comment || ''}`,
      'Rejected': `Your complaint ${complaint.complaintId} could not be processed. ${comment || 'Please contact us for more information.'}`
    };

    return statusMessages[newStatus] || `Your complaint ${complaint.complaintId} status has been updated to ${newStatus}.`;
  }

  shouldEscalate(complaint) {
    const ageInDays = complaint.ageInDays || 0;
    const category = complaint.category;
    const severity = complaint.severity;
    const status = complaint.status;

    // Don't escalate resolved or closed complaints
    if (['Resolved', 'Closed'].includes(status)) return false;

    // Get expected resolution time
    const expectedDays = this.resolutionMatrix[category]?.[severity] || 7;

    // Escalate if complaint is overdue
    if (ageInDays > expectedDays * 1.5) { // 150% of expected time
      return {
        shouldEscalate: true,
        reason: `Complaint overdue by ${Math.ceil(ageInDays - expectedDays)} days`,
        suggestedLevel: Math.min(complaint.escalationLevel + 1, 3)
      };
    }

    // Escalate critical complaints after 24 hours
    if (severity === 'Critical' && ageInDays >= 1 && status === 'Submitted') {
      return {
        shouldEscalate: true,
        reason: 'Critical complaint not reviewed within 24 hours',
        suggestedLevel: Math.min(complaint.escalationLevel + 1, 3)
      };
    }

    return { shouldEscalate: false };
  }
}

module.exports = new ComplaintService();
