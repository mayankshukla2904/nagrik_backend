const { complaintValidation, userValidation } = require('../utils/validation');

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

// Query validation middleware
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Query validation failed',
        errors
      });
    }

    // Replace req.query with validated data
    req.query = value;
    next();
  };
};

// Specific validation middleware
const validateComplaint = validate(complaintValidation.create);
const validateComplaintUpdate = validate(complaintValidation.updateStatus);
const validateComplaintFeedback = validate(complaintValidation.feedback);
const validateComplaintQuery = validateQuery(complaintValidation.query);

const validateUser = validate(userValidation.create);
const validateUserUpdate = validate(userValidation.update);

module.exports = {
  validate,
  validateQuery,
  validateComplaint,
  validateComplaintUpdate,
  validateComplaintFeedback,
  validateComplaintQuery,
  validateUser,
  validateUserUpdate
};
