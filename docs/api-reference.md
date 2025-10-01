# NAGRIK API Reference

## Base URL
```
Production: https://api.nagrik.gov.in
Development: http://localhost:3000
```

## Authentication
Currently, the API does not require authentication for complaint submission. This may be added in future versions.

## Error Handling
All API endpoints return responses in the following format:

### Success Response
```json
{
  "success": true,
  "data": {...},
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": [...], // Optional validation errors
  "code": "ERROR_CODE" // Optional error code
}
```

## HTTP Status Codes
- `200` - Success
- `201` - Created (for new resources)
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `500` - Internal Server Error

---

## Endpoints

### Health Check

#### GET /api/health
Check the health status of the API service.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2023-10-15T10:30:00.000Z",
    "uptime": "02:45:30",
    "database": {
      "status": "connected",
      "name": "nagrik_db"
    },
    "memory": {
      "rss": 145,
      "heapTotal": 89,
      "heapUsed": 67,
      "external": 12
    },
    "environment": "development",
    "version": "1.0.0"
  }
}
```

---

## Complaints API

### Submit Complaint

#### POST /api/complaints/report
Submit a new grievance complaint.

**Request Body:**
```json
{
  "userId": "+919876543210",
  "channel": "WhatsApp",
  "title": "Broken streetlight on Main Street",
  "description": "The streetlight at the corner of Main Street and Oak Avenue has been broken for the past week. This is causing safety issues for pedestrians walking at night.",
  "category": "Infrastructure",
  "severity": "Medium",
  "location": {
    "type": "Point",
    "coordinates": [77.2090, 28.6139],
    "address": "Main Street, New Delhi",
    "city": "New Delhi",
    "state": "Delhi",
    "pincode": "110001"
  },
  "mediaUrls": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "tags": ["streetlight", "safety", "urgent"]
}
```

**Required Fields:**
- `userId` - User identifier (phone number)
- `title` - Complaint title (10-200 characters)
- `description` - Detailed description (20-2000 characters)
- `location.coordinates` - [longitude, latitude]

**Optional Fields:**
- `channel` - Source channel (WhatsApp, Call, Web, Mobile)
- `category` - Complaint category (if not provided, AI will classify)
- `severity` - Severity level (if not provided, AI will determine)
- `location.address` - Human readable address
- `mediaUrls` - Array of media file URLs (max 5)
- `tags` - Array of tags (max 10)

**Valid Categories:**
- Infrastructure
- Healthcare
- Education
- Transportation
- Environment
- Public Safety
- Utilities
- Governance
- Social Services
- Economic Issues
- Other

**Valid Severity Levels:**
- Low
- Medium
- High
- Critical

**Response:**
```json
{
  "success": true,
  "message": "Complaint submitted successfully",
  "data": {
    "complaintId": "NAGRIK123456",
    "status": "submitted",
    "category": "Infrastructure",
    "severity": "Medium",
    "estimatedResolutionTime": {
      "days": 10,
      "estimatedDate": "2023-10-25T10:30:00.000Z",
      "businessDays": 7
    }
  }
}
```

### Get Complaint Details

#### GET /api/complaints/:complaintId
Retrieve details of a specific complaint.

**Parameters:**
- `complaintId` - Unique complaint identifier (e.g., NAGRIK123456)

**Response:**
```json
{
  "success": true,
  "data": {
    "complaintId": "NAGRIK123456",
    "userId": "+919876543210",
    "channel": "WhatsApp",
    "category": "Infrastructure",
    "severity": "Medium",
    "status": "Under Review",
    "title": "Broken streetlight on Main Street",
    "description": "The streetlight at the corner of...",
    "location": {
      "type": "Point",
      "coordinates": [77.2090, 28.6139],
      "address": "Main Street, New Delhi"
    },
    "mediaUrls": ["https://example.com/image1.jpg"],
    "priority": "Medium",
    "assignedTo": {
      "department": "Public Works Department",
      "officer": "John Doe",
      "contactInfo": "john.doe@pwd.gov.in"
    },
    "timeline": [
      {
        "status": "Submitted",
        "timestamp": "2023-10-15T10:30:00.000Z",
        "comment": "Complaint submitted successfully"
      },
      {
        "status": "Under Review",
        "timestamp": "2023-10-16T09:15:00.000Z",
        "updatedBy": "admin@pwd.gov.in",
        "comment": "Assigned to maintenance team"
      }
    ],
    "createdAt": "2023-10-15T10:30:00.000Z",
    "updatedAt": "2023-10-16T09:15:00.000Z",
    "ageInDays": 1
  }
}
```

### List Complaints

#### GET /api/complaints
Retrieve a list of complaints with optional filters.

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `category` - Filter by category
- `severity` - Filter by severity
- `status` - Filter by status
- `userId` - Filter by user ID
- `dateFrom` - Filter from date (ISO string)
- `dateTo` - Filter to date (ISO string)
- `sortBy` - Sort field (createdAt, updatedAt, severity, status, category)
- `sortOrder` - Sort order (asc, desc)

**Location Filter:**
```
?location[latitude]=28.6139&location[longitude]=77.2090&location[radius]=10
```

**Example Request:**
```
GET /api/complaints?category=Infrastructure&severity=High&page=1&limit=10&sortBy=createdAt&sortOrder=desc
```

**Response:**
```json
{
  "success": true,
  "data": {
    "complaints": [
      {
        "complaintId": "NAGRIK123456",
        "category": "Infrastructure",
        "severity": "High",
        "status": "Under Review",
        "title": "Broken streetlight on Main Street",
        "location": "Main Street, New Delhi",
        "createdAt": "2023-10-15T10:30:00.000Z",
        "ageInDays": 1
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 87,
      "itemsPerPage": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### Update Complaint Status

#### PUT /api/complaints/:complaintId/status
Update the status of a complaint (Admin/Officer use).

**Request Body:**
```json
{
  "status": "In Progress",
  "comment": "Work has started on this issue",
  "updatedBy": "officer@pwd.gov.in"
}
```

**Valid Status Values:**
- Submitted
- Under Review
- In Progress
- Resolved
- Closed
- Rejected

**Response:**
```json
{
  "success": true,
  "message": "Complaint status updated successfully",
  "data": {
    "complaintId": "NAGRIK123456",
    "status": "In Progress",
    "timeline": [
      {
        "status": "In Progress",
        "timestamp": "2023-10-17T14:20:00.000Z",
        "updatedBy": "officer@pwd.gov.in",
        "comment": "Work has started on this issue"
      }
    ]
  }
}
```

### Add Feedback

#### POST /api/complaints/:complaintId/feedback
Add feedback to a resolved complaint.

**Request Body:**
```json
{
  "rating": 4,
  "comment": "Issue was resolved quickly and efficiently"
}
```

**Validation:**
- `rating` - Integer between 1 and 5
- `comment` - Optional text (max 1000 characters)
- Complaint must have status "Resolved"

**Response:**
```json
{
  "success": true,
  "message": "Feedback added successfully",
  "data": {
    "complaintId": "NAGRIK123456",
    "feedback": {
      "rating": 4,
      "comment": "Issue was resolved quickly and efficiently",
      "timestamp": "2023-10-20T16:45:00.000Z"
    }
  }
}
```

### Escalate Complaint

#### POST /api/complaints/:complaintId/escalate
Escalate a complaint to higher authority.

**Request Body:**
```json
{
  "reason": "Complaint overdue by 5 days",
  "escalatedBy": "supervisor@pwd.gov.in"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Complaint escalated successfully",
  "data": {
    "complaintId": "NAGRIK123456",
    "escalationLevel": 1,
    "priority": "High"
  }
}
```

---

## Dashboard API

### Dashboard Overview

#### GET /api/dashboard/overview
Get overview statistics for dashboard.

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalComplaints": 1250,
      "totalUsers": 890,
      "resolutionRate": 78.5,
      "avgResolutionDays": 7
    },
    "distribution": {
      "byStatus": [
        { "_id": "Resolved", "count": 980 },
        { "_id": "In Progress", "count": 150 },
        { "_id": "Under Review", "count": 120 }
      ],
      "byCategory": [
        { "_id": "Infrastructure", "count": 450 },
        { "_id": "Utilities", "count": 320 },
        { "_id": "Healthcare", "count": 280 }
      ],
      "bySeverity": [
        { "_id": "Medium", "count": 520 },
        { "_id": "High", "count": 380 },
        { "_id": "Low", "count": 250 },
        { "_id": "Critical", "count": 100 }
      ]
    },
    "recentComplaints": [...]
  }
}
```

### Analytics Data

#### GET /api/dashboard/analytics
Get analytics data for charts and reports.

**Query Parameters:**
- `period` - Time period in days (default: 30)
- `type` - Analytics type (trend, geographic, performance)

**Trend Analytics:**
```
GET /api/dashboard/analytics?period=30&type=trend
```

**Response:**
```json
{
  "success": true,
  "data": {
    "type": "trend",
    "period": 30,
    "data": [
      {
        "_id": { "year": 2023, "month": 10, "day": 15 },
        "count": 25,
        "resolved": 18
      }
    ]
  }
}
```

### Export Data

#### GET /api/dashboard/export
Export complaints data.

**Query Parameters:**
- `format` - Export format (json, csv)
- Other filter parameters same as `/api/complaints`

**CSV Export:**
```
GET /api/dashboard/export?format=csv&category=Infrastructure
```

Returns CSV file download.

---

## Error Examples

### Validation Error
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "title",
      "message": "Title must be at least 10 characters long"
    },
    {
      "field": "location.coordinates",
      "message": "Longitude must be between -180 and 180"
    }
  ]
}
```

### Not Found Error
```json
{
  "success": false,
  "message": "Complaint not found"
}
```

### Rate Limit Error
```json
{
  "success": false,
  "message": "Too many requests from this IP, please try again later."
}
```

---

## Rate Limiting
- 100 requests per 15 minutes per IP address
- Higher limits available for authenticated users

## Response Time
- Target response time: < 500ms for most endpoints
- Dashboard analytics may take up to 2 seconds for complex queries

## Data Retention
- Complaint data: Retained indefinitely
- User session data: 30 days
- Log files: 90 days
