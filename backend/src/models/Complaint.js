const mongoose = require('mongoose');

// Complaint Schema
const complaintSchema = new mongoose.Schema({
  complaintId: {
    type: String,
    unique: true,
    uppercase: true,
    match: /^NAGRIK\d{6}$/
    // Removed required: true to allow pre-save hook to generate it
  },
  userId: {
    type: String,
    required: true,
    trim: true
  },
  channel: {
    type: String,
    required: true,
    enum: ['WhatsApp', 'Call', 'Web', 'Mobile'],
    default: 'WhatsApp'
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Infrastructure',
      'Healthcare',
      'Education',
      'Transportation',
      'Environment',
      'Public Safety',
      'Utilities',
      'Governance',
      'Social Services',
      'Economic Issues',
      'Other'
    ]
  },
  subcategory: {
    type: String,
    trim: true
  },
  severity: {
    type: String,
    required: true,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function(coordinates) {
          return coordinates.length === 2 && 
                 coordinates[0] >= -180 && coordinates[0] <= 180 && // longitude
                 coordinates[1] >= -90 && coordinates[1] <= 90;     // latitude
        },
        message: 'Invalid coordinates format'
      }
    },
    address: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    pincode: {
      type: String,
      trim: true,
      match: /^\d{6}$/
    }
  },
  mediaUrls: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Closed', 'Rejected'],
    default: 'Submitted'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  assignedTo: {
    department: {
      type: String,
      trim: true
    },
    officer: {
      type: String,
      trim: true
    },
    contactInfo: {
      type: String,
      trim: true
    }
  },
  timeline: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: String,
      trim: true
    },
    comment: {
      type: String,
      trim: true
    }
  }],
  escalationLevel: {
    type: Number,
    default: 0,
    min: 0,
    max: 3
  },
  escalationHistory: [{
    level: Number,
    timestamp: Date,
    reason: String,
    escalatedBy: String
  }],
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      trim: true
    },
    timestamp: Date
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    type: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  aiClassification: {
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    extractedInfo: {
      type: mongoose.Schema.Types.Mixed
    },
    processedBy: {
      type: String,
      enum: ['keyword', 'openai', 'manual'],
      default: 'keyword'
    },
    processedAt: {
      type: Date,
      default: Date.now
    }
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    sessionId: String,
    referrer: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
complaintSchema.index({ complaintId: 1 });
complaintSchema.index({ userId: 1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ category: 1 });
complaintSchema.index({ severity: 1 });
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ 'location': '2dsphere' }); // Geospatial index
complaintSchema.index({ 'assignedTo.department': 1 });

// Virtual for age in days
complaintSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for formatted location
complaintSchema.virtual('formattedLocation').get(function() {
  if (this.location && this.location.address) {
    return this.location.address;
  }
  if (this.location && this.location.coordinates) {
    return `${this.location.coordinates[1]}, ${this.location.coordinates[0]}`;
  }
  return 'Location not specified';
});

// Pre-save middleware to generate complaint ID
complaintSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Generate unique complaint ID
    const count = await this.constructor.countDocuments();
    this.complaintId = `NAGRIK${String(count + 1).padStart(6, '0')}`;
    
    // Add initial timeline entry
    this.timeline.push({
      status: 'Submitted',
      timestamp: new Date(),
      comment: 'Complaint submitted successfully'
    });
  }
  next();
});

// Pre-save middleware to update timeline on status change
complaintSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.timeline.push({
      status: this.status,
      timestamp: new Date(),
      updatedBy: this.metadata?.updatedBy || 'system',
      comment: `Status updated to ${this.status}`
    });
  }
  next();
});

// Static method to get complaint statistics
complaintSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        byStatus: {
          $push: {
            status: '$status',
            count: 1
          }
        },
        byCategory: {
          $push: {
            category: '$category',
            count: 1
          }
        },
        bySeverity: {
          $push: {
            severity: '$severity',
            count: 1
          }
        }
      }
    }
  ]);
  
  return stats[0] || { total: 0, byStatus: [], byCategory: [], bySeverity: [] };
};

// Instance method to escalate complaint
complaintSchema.methods.escalate = function(reason, escalatedBy) {
  this.escalationLevel += 1;
  this.escalationHistory.push({
    level: this.escalationLevel,
    timestamp: new Date(),
    reason,
    escalatedBy
  });
  
  // Auto-adjust priority based on escalation level
  if (this.escalationLevel >= 2) {
    this.priority = 'Urgent';
  } else if (this.escalationLevel === 1) {
    this.priority = 'High';
  }
  
  return this.save();
};

// Instance method to add feedback
complaintSchema.methods.addFeedback = function(rating, comment) {
  this.feedback = {
    rating,
    comment,
    timestamp: new Date()
  };
  return this.save();
};

module.exports = mongoose.model('Complaint', complaintSchema);
