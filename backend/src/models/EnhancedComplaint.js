const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    default: function() {
      return `NAGRIK-${Date.now().toString().slice(-6)}`;
    }
  },
  
  title: {
    type: String,
    required: [true, 'Complaint title is required'],
    trim: true,
    minlength: [10, 'Title must be at least 10 characters long'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Complaint description is required'],
    trim: true,
    minlength: [20, 'Description must be at least 20 characters long'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  
  category: {
    type: String,
    required: true,
    enum: [
      'Infrastructure',
      'Transportation', 
      'Water Supply',
      'Electricity',
      'Sanitation',
      'Healthcare',
      'Education',
      'Public Safety',
      'Environment',
      'Governance',
      'Rural Development',
      'Mining Issues',
      'Tribal Affairs',
      'Forest Conservation'
    ],
    default: 'Infrastructure'
  },
  
  subCategory: {
    type: String,
    trim: true
  },
  
  status: {
    type: String,
    enum: ['submitted', 'acknowledged', 'in-progress', 'resolved', 'closed', 'rejected'],
    default: 'submitted'
  },
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Jharkhand-specific location fields
  location: {
    address: {
      type: String,
      required: [true, 'Location address is required'],
      trim: true
    },
    district: {
      type: String,
      required: [true, 'District is required'],
      enum: [
        'Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum', 
        'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara', 
        'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu', 
        'Ramgarh', 'Ranchi', 'Sahibganj', 'Seraikela Kharsawan', 
        'Simdega', 'West Singhbhum'
      ]
    },
    block: {
      type: String,
      trim: true
    },
    village: {
      type: String,
      trim: true
    },
    pincode: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^[1-9][0-9]{5}$/.test(v);
        },
        message: 'Invalid pincode format'
      }
    },
    coordinates: {
      latitude: {
        type: Number,
        min: [20.0, 'Invalid latitude for Jharkhand'],
        max: [25.0, 'Invalid latitude for Jharkhand']
      },
      longitude: {
        type: Number,
        min: [83.0, 'Invalid longitude for Jharkhand'], 
        max: [88.0, 'Invalid longitude for Jharkhand']
      }
    },
    landmark: String,
    validated: {
      type: Boolean,
      default: false
    }
  },
  
  // Enhanced upvoting system
  upvotes: {
    count: {
      type: Number,
      default: 1
    },
    users: [{
      userId: String,
      phone: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    similarComplaints: [{
      complaintId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Complaint'
      },
      similarity: {
        type: Number,
        min: 0,
        max: 1
      },
      mergedAt: Date
    }]
  },
  
  // AI Enhancement fields
  aiAnalysis: {
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative', 'angry', 'urgent']
    },
    urgencyLevel: {
      type: Number,
      min: 1,
      max: 10
    },
    suggestedCategory: String,
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    keywords: [String],
    missingInfo: [String],
    suggestedQuestions: [String],
    autoCompleted: {
      type: Boolean,
      default: false
    }
  },
  
  // Enhanced user information
  user: {
    id: String,
    name: String,
    phone: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^[6-9]\d{9}$/.test(v);
        },
        message: 'Invalid Indian phone number'
      }
    },
    whatsappId: String,
    aadharMasked: String,
    isVerified: {
      type: Boolean,
      default: false
    }
  },
  
  channel: {
    type: String,
    enum: ['WhatsApp', 'Web', 'Call', 'Mobile App'],
    required: true
  },
  
  media: [{
    type: {
      type: String,
      enum: ['image', 'video', 'audio', 'document']
    },
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    mimeType: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    processed: {
      type: Boolean,
      default: false
    },
    aiDescription: String
  }],
  
  // Department assignment
  assignedTo: {
    department: {
      type: String,
      enum: [
        'Public Works Department',
        'Urban Development',
        'Rural Development', 
        'Water Resources',
        'Power Department',
        'Health Department',
        'Education Department',
        'Police Department',
        'Forest Department',
        'Mining Department',
        'Tribal Welfare',
        'Municipal Corporation',
        'Panchayati Raj'
      ]
    },
    officer: String,
    assignedAt: Date,
    expectedResolution: Date
  },
  
  // Resolution tracking
  resolution: {
    description: String,
    resolvedBy: String,
    resolvedAt: Date,
    satisfactionRating: {
      type: Number,
      min: 1,
      max: 5
    },
    followUpRequired: {
      type: Boolean,
      default: false
    }
  },
  
  // Activity timeline
  timeline: [{
    action: String,
    description: String,
    performedBy: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    status: String
  }],
  
  // System metadata
  metadata: {
    ipAddress: String,
    userAgent: String,
    sessionId: String,
    source: String,
    tags: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
complaintSchema.index({ id: 1 });
complaintSchema.index({ 'user.phone': 1 });
complaintSchema.index({ category: 1, status: 1 });
complaintSchema.index({ 'location.district': 1 });
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ 'upvotes.count': -1 });
complaintSchema.index({ 'aiAnalysis.urgencyLevel': -1 });

// Compound indexes for similarity detection
complaintSchema.index({ 
  category: 1, 
  'location.district': 1, 
  'location.block': 1,
  status: 1 
});

// Text index for search
complaintSchema.index({
  title: 'text',
  description: 'text',
  'location.address': 'text'
});

// Virtual for complaint age
complaintSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for response time
complaintSchema.virtual('responseTime').get(function() {
  if (this.resolution && this.resolution.resolvedAt) {
    return Math.floor((this.resolution.resolvedAt - this.createdAt) / (1000 * 60 * 60));
  }
  return null;
});

// Virtual for similarity score calculation
complaintSchema.virtual('similarityScore').get(function() {
  return this.upvotes.count + (this.aiAnalysis?.urgencyLevel || 0);
});

// Pre-save middleware for validation and processing
complaintSchema.pre('save', async function(next) {
  // Auto-generate ID if not present
  if (!this.id) {
    this.id = `NAGRIK-${Date.now().toString().slice(-6)}`;
  }
  
  // Add initial upvote from reporter
  if (this.isNew && this.upvotes.count === 1) {
    this.upvotes.users.push({
      userId: this.user.id,
      phone: this.user.phone,
      timestamp: new Date()
    });
  }
  
  // Add to timeline
  if (this.isNew) {
    this.timeline.push({
      action: 'complaint_created',
      description: 'Complaint submitted through ' + this.channel,
      performedBy: this.user.name || this.user.phone,
      status: this.status
    });
  }
  
  next();
});

// Static method to find similar complaints
complaintSchema.statics.findSimilar = async function(complaint, threshold = 0.7) {
  const similarComplaints = await this.find({
    _id: { $ne: complaint._id },
    category: complaint.category,
    'location.district': complaint.location.district,
    status: { $in: ['submitted', 'acknowledged', 'in-progress'] },
    $text: { $search: complaint.title }
  }).limit(10);
  
  return similarComplaints;
};

// Static method to merge similar complaints (upvote)
complaintSchema.statics.addUpvote = async function(complaintId, userId, userPhone) {
  const complaint = await this.findById(complaintId);
  if (!complaint) throw new Error('Complaint not found');
  
  // Check if user already upvoted
  const alreadyUpvoted = complaint.upvotes.users.some(
    user => user.userId === userId || user.phone === userPhone
  );
  
  if (alreadyUpvoted) {
    throw new Error('User has already upvoted this complaint');
  }
  
  // Add upvote
  complaint.upvotes.count += 1;
  complaint.upvotes.users.push({
    userId,
    phone: userPhone,
    timestamp: new Date()
  });
  
  // Add timeline entry
  complaint.timeline.push({
    action: 'upvote_added',
    description: `Similar complaint reported by ${userPhone}`,
    performedBy: userPhone,
    status: complaint.status
  });
  
  await complaint.save();
  return complaint;
};

// Instance method to check if can be merged
complaintSchema.methods.canMergeWith = function(otherComplaint) {
  return (
    this.category === otherComplaint.category &&
    this.location.district === otherComplaint.location.district &&
    this.status !== 'resolved' &&
    this.status !== 'closed'
  );
};

module.exports = mongoose.model('EnhancedComplaint', complaintSchema);
