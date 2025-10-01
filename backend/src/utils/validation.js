const Joi = require('joi');

// Validation schemas
const complaintValidation = {
  // Schema for creating a new complaint
  create: Joi.object({
    userId: Joi.string()
      .trim()
      .required()
      .messages({
        'string.empty': 'User ID is required',
        'any.required': 'User ID is required'
      }),
    
    channel: Joi.string()
      .valid('WhatsApp', 'Call', 'Web', 'Mobile')
      .default('WhatsApp')
      .messages({
        'any.only': 'Channel must be one of: WhatsApp, Call, Web, Mobile'
      }),
    
    title: Joi.string()
      .trim()
      .min(10)
      .max(200)
      .required()
      .messages({
        'string.empty': 'Title is required',
        'string.min': 'Title must be at least 10 characters long',
        'string.max': 'Title cannot exceed 200 characters',
        'any.required': 'Title is required'
      }),
    
    description: Joi.string()
      .trim()
      .min(20)
      .max(2000)
      .required()
      .messages({
        'string.empty': 'Description is required',
        'string.min': 'Description must be at least 20 characters long',
        'string.max': 'Description cannot exceed 2000 characters',
        'any.required': 'Description is required'
      }),
    
    category: Joi.string()
      .valid(
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
      )
      .messages({
        'any.only': 'Invalid category selected'
      }),
    
    subcategory: Joi.string()
      .trim()
      .max(100)
      .optional(),
    
    severity: Joi.string()
      .valid('Low', 'Medium', 'High', 'Critical')
      .default('Medium')
      .messages({
        'any.only': 'Severity must be one of: Low, Medium, High, Critical'
      }),
    
    location: Joi.object({
      type: Joi.string()
        .valid('Point')
        .default('Point'),
      coordinates: Joi.array()
        .items(Joi.number())
        .length(2)
        .required()
        .custom((value, helpers) => {
          const [lng, lat] = value;
          if (lng < -180 || lng > 180) {
            return helpers.error('custom.longitude');
          }
          if (lat < -90 || lat > 90) {
            return helpers.error('custom.latitude');
          }
          return value;
        })
        .messages({
          'array.length': 'Coordinates must contain exactly 2 values [longitude, latitude]',
          'any.required': 'Location coordinates are required',
          'custom.longitude': 'Longitude must be between -180 and 180',
          'custom.latitude': 'Latitude must be between -90 and 90'
        }),
      address: Joi.string()
        .trim()
        .max(500)
        .optional(),
      city: Joi.string()
        .trim()
        .max(100)
        .optional(),
      state: Joi.string()
        .trim()
        .max(100)
        .optional(),
      pincode: Joi.string()
        .pattern(/^\d{6}$/)
        .optional()
        .messages({
          'string.pattern.base': 'Pincode must be exactly 6 digits'
        })
    }).required()
      .messages({
        'any.required': 'Location information is required'
      }),
    
    mediaUrls: Joi.array()
      .items(Joi.string().uri())
      .max(5)
      .optional()
      .messages({
        'array.max': 'Maximum 5 media files allowed'
      }),
    
    tags: Joi.array()
      .items(Joi.string().trim().max(50))
      .max(10)
      .optional()
      .messages({
        'array.max': 'Maximum 10 tags allowed'
      })
  }),

  // Schema for updating complaint status
  updateStatus: Joi.object({
    status: Joi.string()
      .valid('Submitted', 'Under Review', 'In Progress', 'Resolved', 'Closed', 'Rejected')
      .required()
      .messages({
        'any.only': 'Invalid status value',
        'any.required': 'Status is required'
      }),
    
    comment: Joi.string()
      .trim()
      .max(500)
      .optional(),
    
    updatedBy: Joi.string()
      .trim()
      .required()
      .messages({
        'any.required': 'Updated by field is required'
      })
  }),

  // Schema for adding feedback
  feedback: Joi.object({
    rating: Joi.number()
      .integer()
      .min(1)
      .max(5)
      .required()
      .messages({
        'number.min': 'Rating must be between 1 and 5',
        'number.max': 'Rating must be between 1 and 5',
        'any.required': 'Rating is required'
      }),
    
    comment: Joi.string()
      .trim()
      .max(1000)
      .optional()
  }),

  // Schema for query parameters
  query: Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .default(1),
    
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(20),
    
    category: Joi.string()
      .valid(
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
      )
      .optional(),
    
    severity: Joi.string()
      .valid('Low', 'Medium', 'High', 'Critical')
      .optional(),
    
    status: Joi.string()
      .valid('Submitted', 'Under Review', 'In Progress', 'Resolved', 'Closed', 'Rejected')
      .optional(),
    
    userId: Joi.string()
      .trim()
      .optional(),
    
    location: Joi.object({
      latitude: Joi.number()
        .min(-90)
        .max(90)
        .required(),
      longitude: Joi.number()
        .min(-180)
        .max(180)
        .required(),
      radius: Joi.number()
        .min(0.1)
        .max(100)
        .default(10) // Default 10km radius
    }).optional(),
    
    dateFrom: Joi.date()
      .iso()
      .optional(),
    
    dateTo: Joi.date()
      .iso()
      .min(Joi.ref('dateFrom'))
      .optional(),
    
    sortBy: Joi.string()
      .valid('createdAt', 'updatedAt', 'severity', 'status', 'category')
      .default('createdAt'),
    
    sortOrder: Joi.string()
      .valid('asc', 'desc')
      .default('desc')
  })
};

// User validation schemas
const userValidation = {
  create: Joi.object({
    phoneNumber: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid phone number format',
        'any.required': 'Phone number is required'
      }),
    
    name: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .optional(),
    
    email: Joi.string()
      .email()
      .optional(),
    
    preferredLanguage: Joi.string()
      .valid('hindi', 'english', 'bengali', 'telugu', 'marathi', 'tamil', 'gujarati', 'urdu', 'kannada', 'malayalam')
      .default('hindi')
  }),

  update: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .optional(),
    
    email: Joi.string()
      .email()
      .optional(),
    
    address: Joi.object({
      street: Joi.string().trim().max(200).optional(),
      city: Joi.string().trim().max(100).optional(),
      state: Joi.string().trim().max(100).optional(),
      pincode: Joi.string().pattern(/^\d{6}$/).optional()
    }).optional(),
    
    preferredLanguage: Joi.string()
      .valid('hindi', 'english', 'bengali', 'telugu', 'marathi', 'tamil', 'gujarati', 'urdu', 'kannada', 'malayalam')
      .optional(),
    
    preferences: Joi.object({
      notifications: Joi.object({
        whatsapp: Joi.boolean().optional(),
        sms: Joi.boolean().optional(),
        email: Joi.boolean().optional()
      }).optional(),
      privacy: Joi.object({
        shareLocation: Joi.boolean().optional(),
        shareContactInfo: Joi.boolean().optional()
      }).optional()
    }).optional()
  })
};

module.exports = {
  complaintValidation,
  userValidation
};
