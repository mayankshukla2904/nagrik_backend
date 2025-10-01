# NAGRIK WhatsApp Integration Guide

## Overview
The NAGRIK WhatsApp service enables citizens to report grievances directly through WhatsApp using the Baileys library. This guide covers setup, configuration, and usage.

## Features
- 📱 QR Code authentication
- 🤖 Interactive conversation flow
- 📷 Media file support (images, videos)
- 📍 Location sharing
- ✅ Real-time complaint submission
- 🔄 Status updates and notifications
- 🌐 Multi-language support ready

## Prerequisites
- Node.js v18 or higher
- WhatsApp account for business use
- Active internet connection
- NAGRIK backend service running

## Installation

### 1. Install Dependencies
```bash
cd whatsapp-service
npm install
```

### 2. Environment Configuration
Create `.env` file in the root directory:
```bash
# Backend Configuration
BACKEND_URL=http://localhost:3000

# WhatsApp Configuration
WHATSAPP_SESSION_NAME=nagrik_session

# Optional: Custom port
WHATSAPP_PORT=3001
```

## Setup and Authentication

### 1. Start the Service
```bash
cd whatsapp-service
npm start
```

### 2. WhatsApp Authentication
1. When you start the service, a QR code will appear in the terminal
2. Open WhatsApp on your phone
3. Go to **Settings > Linked Devices**
4. Tap **Link a Device**
5. Scan the QR code displayed in the terminal
6. Once connected, you'll see "✅ WhatsApp connected successfully!"

### 3. Session Persistence
The authentication session is saved in the `auth/` directory and will persist across restarts.

## User Interaction Flow

### 1. Initial Contact
When a user first messages the WhatsApp number, they receive:
```
🙏 Welcome to NAGRIK - Digital Grievance Platform

I'm here to help you report civic issues and grievances quickly and efficiently.

To file a complaint, simply type "complaint" or "report"

For help, type "help"

🏛️ Your voice matters in building a better community!
```

### 2. Filing a Complaint
Users can start the complaint process by typing:
- "complaint"
- "report" 
- "issue"
- "problem"

### 3. Conversation Steps

#### Step 1: Title Collection
```
📝 Let's help you file your complaint.

Please provide a brief title for your complaint (10-200 characters):

Example: "Broken streetlight on Main Street"
```

#### Step 2: Description Collection
```
✅ Title recorded: "Broken streetlight on Main Street"

Now, please provide a detailed description of the issue (20-2000 characters):

Include:
• What exactly is the problem?
• When did you notice it?
• How is it affecting you/community?
```

#### Step 3: Location Collection
```
✅ Description recorded.

📍 Now, please share your location:

Option 1: Send your current location using WhatsApp's location feature
Option 2: Type the address manually

This helps authorities locate and resolve the issue quickly.
```

#### Step 4: Media Collection (Optional)
```
✅ Location recorded: Main Street, New Delhi

📷 (Optional) You can now send photos or videos related to your complaint:

• Send up to 3 images/videos
• Or type "skip" to continue without media
• Or type "done" when finished adding media
```

#### Step 5: Confirmation
```
📋 Please confirm your complaint details:

🏷️ Title: Broken streetlight on Main Street

📝 Description: The streetlight at the corner of Main Street...

📍 Location: Main Street, New Delhi

📷 Media files: 2

Type "confirm" to submit or "cancel" to start over.
```

#### Step 6: Submission
```
✅ Complaint submitted successfully!

🆔 Your Complaint ID: *NAGRIK123456*

📧 You will receive updates on the progress of your complaint.

Thank you for using NAGRIK. Your voice helps build a better community! 🏛️
```

## Commands

### User Commands
- **"complaint"** - Start filing a new complaint
- **"help"** - Show help information
- **"status"** - Check complaint status
- **"skip"** - Skip optional steps (like media upload)
- **"done"** - Finish current step
- **"cancel"** - Cancel current operation
- **"confirm"** - Confirm and submit complaint

### Help Information
```
🆘 NAGRIK Help

Available Commands:
• "complaint" or "report" - File a new complaint
• "status" - Check complaint status
• "help" - Show this help message

How to file a complaint:
1. Type "complaint"
2. Provide a clear title
3. Give detailed description
4. Share location
5. Optionally add photos/videos
6. Confirm and submit

📞 For urgent issues requiring immediate attention, please contact emergency services.

🏛️ NAGRIK - Your digital voice for civic issues.
```

## Features in Detail

### 1. Location Handling
The service accepts locations in two formats:

**WhatsApp Location Message:**
- User shares location using WhatsApp's built-in location feature
- Automatically extracts coordinates and address

**Manual Address:**
- User types the address as text
- Uses default coordinates with the provided address text

### 2. Media File Support
- **Supported formats:** Images (JPEG, PNG, GIF), Videos (MP4), Audio (MP3)
- **File size limit:** 10MB per file
- **Maximum files:** 3 per complaint
- **Auto-compression:** Images are automatically compressed to optimize storage

### 3. Session Management
- **Session timeout:** 30 minutes of inactivity
- **Auto-cleanup:** Inactive sessions are automatically removed
- **State persistence:** User progress is saved during conversation

### 4. Error Handling
The service handles various error scenarios:
- Invalid input lengths
- Network connectivity issues
- Backend API failures
- Media processing errors

## Configuration Options

### Environment Variables
```bash
# Backend API endpoint
BACKEND_URL=http://localhost:3000

# WhatsApp session name (for multiple instances)
WHATSAPP_SESSION_NAME=nagrik_session

# File upload settings
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_PATH=uploads/

# Session timeout (milliseconds)
SESSION_TIMEOUT=1800000  # 30 minutes

# Logging level
LOG_LEVEL=info
```

### Custom Messages
You can customize messages by editing the `whatsapp.js` file:

```javascript
// Welcome message
const welcomeText = `🙏 Welcome to NAGRIK - Digital Grievance Platform...`;

// Help message
const helpText = `🆘 NAGRIK Help...`;
```

## Monitoring and Logging

### Log Files
Logs are written to `logs/whatsapp.log` with the following information:
- Connection status
- Message processing
- Error events
- User interactions
- Complaint submissions

### Log Format
```json
{
  "timestamp": "2023-10-15T10:30:00.000Z",
  "level": "info",
  "message": "Complaint submitted via WhatsApp",
  "userId": "+919876543210",
  "complaintId": "NAGRIK123456"
}
```

## Troubleshooting

### Common Issues

#### 1. QR Code Not Appearing
**Problem:** QR code doesn't show in terminal
**Solution:**
- Ensure terminal supports QR code display
- Check internet connection
- Restart the service

#### 2. Connection Drops Frequently
**Problem:** WhatsApp connection keeps disconnecting
**Solution:**
- Check internet stability
- Ensure phone has stable WhatsApp connection
- Clear auth folder and re-authenticate

#### 3. Media Upload Failures
**Problem:** Images/videos not processing
**Solution:**
- Check file size limits
- Verify upload directory permissions
- Review file format support

#### 4. Backend Connection Issues
**Problem:** Complaints not submitting
**Solution:**
- Verify backend service is running
- Check BACKEND_URL configuration
- Review network connectivity

### Debug Mode
Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

### Health Check
The service provides a health check endpoint:
```bash
GET http://localhost:3001/health
```

## Security Considerations

### 1. Session Security
- Auth files contain sensitive WhatsApp session data
- Keep `auth/` directory secure and backed up
- Don't share session files

### 2. File Upload Security
- Files are scanned for malicious content
- Only specific file types are allowed
- Files are stored securely with random names

### 3. Data Privacy
- User phone numbers are used as identifiers
- Messages are logged for debugging (can be disabled)
- No personal data is shared with third parties

## Deployment

### Production Deployment
1. **Use Process Manager:**
```bash
npm install -g pm2
pm2 start src/whatsapp.js --name "nagrik-whatsapp"
```

2. **Set Production Environment:**
```bash
NODE_ENV=production
LOG_LEVEL=error
```

3. **Configure Nginx (if needed):**
```nginx
location /whatsapp/ {
    proxy_pass http://localhost:3001/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

### Scaling Considerations
- Each WhatsApp number requires a separate service instance
- Use different session names for multiple instances
- Consider load balancing for high-volume deployments

## Advanced Features

### Multi-language Support
Add language detection and responses:
```javascript
const userLanguage = detectLanguage(message);
const response = getLocalizedMessage(userLanguage, 'welcome');
```

### Custom Workflows
Implement department-specific workflows:
```javascript
if (category === 'Emergency') {
  // Immediate escalation flow
  await escalateToEmergencyServices(complaint);
}
```

### Integration with Other Services
Connect to additional services:
```javascript
// SMS notifications
await sendSMSConfirmation(phoneNumber, complaintId);

// Email alerts
await sendEmailToOfficials(complaint);
```

## Support

For technical support and questions:
- Check logs in `logs/whatsapp.log`
- Review the troubleshooting section
- Contact the development team
- Submit issues to the project repository

## API Integration

The WhatsApp service integrates with the backend API:
- **POST /api/complaints/report** - Submit complaints
- **GET /api/complaints/:id** - Check status
- Health checks and monitoring

This ensures consistent data flow and real-time updates across all channels.
