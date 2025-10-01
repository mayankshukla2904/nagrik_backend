const mongoose = require('mongoose');

// User Schema for tracking complaint reporters
const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    match: /^\+?[1-9]\d{1,14}$/
  },
  name: {
    type: String,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: /^\S+@\S+\.\S+$/
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: {
      type: String,
      match: /^\d{6}$/
    }
  },
  preferredLanguage: {
    type: String,
    enum: ['hindi', 'english', 'bengali', 'telugu', 'marathi', 'tamil', 'gujarati', 'urdu', 'kannada', 'malayalam'],
    default: 'hindi'
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  totalComplaints: {
    type: Number,
    default: 0
  },
  resolvedComplaints: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    min: 1,
    max: 5
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  blockReason: {
    type: String,
    trim: true
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  channels: [{
    type: String,
    enum: ['WhatsApp', 'Call', 'Web', 'Mobile']
  }],
  preferences: {
    notifications: {
      whatsapp: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      },
      email: {
        type: Boolean,
        default: false
      }
    },
    privacy: {
      shareLocation: {
        type: Boolean,
        default: true
      },
      shareContactInfo: {
        type: Boolean,
        default: false
      }
    }
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ userId: 1 });
userSchema.index({ phoneNumber: 1 });
userSchema.index({ email: 1 });
userSchema.index({ verificationStatus: 1 });

// Virtual for complaint resolution rate
userSchema.virtual('resolutionRate').get(function() {
  if (this.totalComplaints === 0) return 0;
  return (this.resolvedComplaints / this.totalComplaints) * 100;
});

// Instance method to update activity
userSchema.methods.updateActivity = function() {
  this.lastActiveAt = new Date();
  return this.save();
};

// Instance method to increment complaint count
userSchema.methods.incrementComplaintCount = function() {
  this.totalComplaints += 1;
  return this.save();
};

// Instance method to increment resolved count
userSchema.methods.incrementResolvedCount = function() {
  this.resolvedComplaints += 1;
  return this.save();
};

module.exports = mongoose.model('User', userSchema);
