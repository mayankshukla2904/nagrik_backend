# NAGRIK - Grievance Redressal Platform

A complete, production-ready grievance redressal platform with AI-powered classification and multi-channel reporting (WhatsApp, Call Center).

## 🏗️ Architecture Overview

```
NAGRIK Platform
├── Backend API (Node.js + MongoDB)
├── WhatsApp Service (Baileys)
├── RAG Classifier (Python + OpenAI)
├── Call Service (Omnidimensions Integration)
└── Dashboard APIs
```

## 📁 Project Structure

```
nagrik-2.0/
├── backend/                 # Main API server
│   ├── src/
│   │   ├── models/         # MongoDB models
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Custom middleware
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utility functions
│   └── package.json
├── whatsapp-service/       # WhatsApp integration
│   ├── src/
│   └── auth/               # WhatsApp session data
├── rag-classifier/         # AI classification service
├── call-service/           # Call center integration
├── tests/                  # Test suites
├── docs/                   # Documentation
├── config/                 # Configuration files
└── scripts/                # Deployment scripts
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- Python (v3.8 or higher)
- MongoDB Atlas account
- OpenAI API key

### Installation

1. **Clone and Setup**
```bash
git clone <repository-url>
cd nagrik-2.0
npm run setup
```

2. **Environment Configuration**
```bash
cp .env.template .env
# Edit .env with your actual credentials
```

3. **Start Services**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### WhatsApp Setup

1. **Start WhatsApp Service**
```bash
cd whatsapp-service
npm start
```

2. **Scan QR Code**
- A QR code will appear in the terminal
- Scan it with WhatsApp on your phone
- Service will automatically authenticate and start listening

## 📚 API Documentation

### Endpoints

#### POST /api/report
Submit a new grievance report.

**Request Body:**
```json
{
  "userId": "string",
  "channel": "WhatsApp|Call",
  "description": "string",
  "location": {
    "type": "Point",
    "coordinates": [longitude, latitude]
  },
  "mediaUrl": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "complaintId": "NAGRIK123456",
    "status": "submitted"
  }
}
```

#### GET /api/issues
Retrieve complaints with filters.

**Query Parameters:**
- `category`: Filter by category
- `severity`: Filter by severity level
- `location`: Filter by location (radius in km)
- `page`: Page number
- `limit`: Items per page

## 🔧 Configuration

### MongoDB Atlas Setup

1. Create a MongoDB Atlas cluster
2. Get connection string
3. Add to `.env` as `MONGODB_URI`

### OpenAI Configuration

1. Get API key from OpenAI
2. Add to `.env` as `OPENAI_API_KEY`

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:backend
npm run test:integration
```

## 📊 Monitoring

Logs are stored in `logs/nagrik.log` with structured JSON format for easy parsing and monitoring.

## 🔒 Security

- JWT-based authentication
- Rate limiting implemented
- Input validation and sanitization
- CORS configuration
- Environment variable protection

## 🚀 Deployment

See `docs/deployment.md` for detailed deployment instructions.

## 📖 Additional Documentation

- [API Reference](docs/api-reference.md)
- [WhatsApp Integration Guide](docs/whatsapp-guide.md)
- [AI Classification Details](docs/ai-classification.md)
- [Deployment Guide](docs/deployment.md)
- [Testing Guide](docs/testing.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License - see LICENSE file for details.
