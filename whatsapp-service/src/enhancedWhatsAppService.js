// Enhanced WhatsApp Service - Updated Main Handler
const { 
  default: makeWASocket, 
  DisconnectReason, 
  useMultiFileAuthState,
  downloadMediaMessage
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// Import our enhanced modules
const EnhancedConversationHandler = require('./enhancedConversationHandler');
const SmartCategoryDetector = require('./smartCategoryDetector');
const MultiLanguageSupport = require('./multiLanguageSupport');
const EnhancedStatusTracker = require('./enhancedStatusTracker');
const CommunityFeatures = require('./communityFeatures');

class EnhancedWhatsAppService {
  constructor() {
    this.sock = null;
    this.sessionPath = path.join(__dirname, '../auth');
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    
    // Initialize enhanced modules
    this.conversationHandler = new EnhancedConversationHandler(process.env.OPENAI_API_KEY);
    this.categoryDetector = new SmartCategoryDetector();
    this.languageSupport = new MultiLanguageSupport();
    this.statusTracker = new EnhancedStatusTracker(this.backendUrl);
    this.communityFeatures = new CommunityFeatures(this.backendUrl);
    
    // User session management
    this.userSessions = new Map();
    this.activeReports = new Map();
    
    // Ensure directories exist
    fs.ensureDirSync(this.sessionPath);
    fs.ensureDirSync('logs');
    fs.ensureDirSync('uploads');

    this.init();
  }

  async processMessage(message, userId, jid) {
    const messageContent = this.extractMessageContent(message);
    
    if (!messageContent) return;
    
    // Detect language if this is a new user
    if (!this.userSessions.has(userId)) {
      const detectedLang = this.languageSupport.detectLanguage(messageContent);
      this.languageSupport.setUserLanguage(userId, detectedLang);
      
      this.userSessions.set(userId, {
        step: 'greeting',
        data: {},
        lastActivity: Date.now(),
        language: detectedLang,
        preferences: {}
      });
      
      await this.sendLocalizedWelcomeMessage(jid, userId);
      return;
    }
    
    const session = this.userSessions.get(userId);
    session.lastActivity = Date.now();
    
    // Handle special commands first
    if (await this.handleSpecialCommands(jid, userId, messageContent, session)) {
      return;
    }
    
    // Handle conversation steps with enhanced features
    switch (session.step) {
      case 'greeting':
        await this.handleEnhancedGreeting(jid, userId, messageContent, session);
        break;
      case 'collecting_title':
        await this.handleEnhancedTitle(jid, userId, messageContent, session);
        break;
      case 'collecting_description':
        await this.handleEnhancedDescription(jid, userId, messageContent, session);
        break;
      case 'category_selection':
        await this.handleCategorySelection(jid, userId, messageContent, session);
        break;
      case 'collecting_location':
        await this.handleLocation(jid, userId, message, session);
        break;
      case 'collecting_media':
        await this.handleMedia(jid, userId, message, session);
        break;
      case 'similarity_check':
        await this.handleSimilarityDecision(jid, userId, messageContent, session);
        break;
      case 'confirming':
        await this.handleConfirmation(jid, userId, messageContent, session);
        break;
      case 'status_inquiry':
        await this.statusTracker.handleStatusInquiry(jid, userId, messageContent, session, this);
        break;
      default:
        await this.sendLocalizedMessage(jid, userId, 'Sorry, something went wrong. Type "help" to start over.');
    }
  }

  async handleSpecialCommands(jid, userId, text, session) {
    const lowerText = text.toLowerCase();
    
    // Language selection
    if (lowerText === 'language' || lowerText === 'भाषा' || lowerText === 'bhasha') {
      await this.sendMessage(jid, this.languageSupport.getLanguageSelectionMessage());
      session.step = 'language_selection';
      return true;
    }
    
    if (session.step === 'language_selection') {
      const selectedLang = this.languageSupport.handleLanguageSelection(text);
      if (selectedLang) {
        this.languageSupport.setUserLanguage(userId, selectedLang);
        session.language = selectedLang;
        await this.sendLocalizedMessage(jid, userId, '✅ Language updated successfully!');
        session.step = 'greeting';
      } else {
        await this.sendMessage(jid, 'Please select a valid language (1-3).');
      }
      return true;
    }
    
    // Community features
    if (lowerText.includes('trending') || lowerText.includes('popular') || 
        lowerText.includes('upvote') || lowerText.includes('community') ||
        lowerText.includes('similar')) {
      await this.communityFeatures.handleCommunityCommands(jid, userId, lowerText, this);
      return true;
    }
    
    // Status tracking
    if (lowerText.includes('status') || lowerText.includes('track') || 
        lowerText.match(/nagrik\d{6}/)) {
      await this.statusTracker.handleStatusInquiry(jid, userId, lowerText, session, this);
      return true;
    }
    
    return false;
  }

  async handleEnhancedGreeting(jid, userId, text, session) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('complaint') || lowerText.includes('report') || 
        lowerText.includes('issue') || lowerText.includes('problem') ||
        lowerText.includes('शिकायत') || lowerText.includes('complaint')) {
      
      session.step = 'collecting_title';
      session.data = { userId, channel: 'WhatsApp' };
      
      await this.sendLocalizedMessage(jid, userId, 'titleRequest');
      
    } else if (lowerText.includes('help')) {
      await this.sendLocalizedHelpMessage(jid, userId);
    } else {
      // Use AI for contextual response
      const contextualResponse = await this.conversationHandler.generateContextualResponse(
        userId, text, session
      );
      await this.sendMessage(jid, contextualResponse);
    }
  }

  async handleEnhancedTitle(jid, userId, text, session) {
    if (text.length < 10 || text.length > 200) {
      await this.sendLocalizedMessage(jid, userId, 'Title should be between 10-200 characters. Please try again:');
      return;
    }
    
    session.data.title = text;
    
    // Smart category detection
    const categoryDetection = await this.categoryDetector.detectCategory(text, '');
    
    if (categoryDetection.confidence > 0.3) {
      session.data.suggestedCategory = categoryDetection.topSuggestion;
      const categoryMessage = this.categoryDetector.generateCategoryMessage(categoryDetection);
      await this.sendMessage(jid, `✅ Title recorded: "${text}"\n\n${categoryMessage}`);
      session.step = 'category_selection';
    } else {
      session.step = 'collecting_description';
      await this.sendLocalizedMessage(jid, userId, 'descriptionRequest');
    }
  }

  async handleEnhancedDescription(jid, userId, text, session) {
    if (text.length < 20 || text.length > 2000) {
      await this.sendLocalizedMessage(jid, userId, 'Description should be between 20-2000 characters. Please provide more details:');
      return;
    }
    
    session.data.description = text;
    
    // Enhanced category detection with title + description
    const categoryDetection = await this.categoryDetector.detectCategory(
      session.data.title, text
    );
    
    if (!session.data.suggestedCategory && categoryDetection.confidence > 0.3) {
      session.data.suggestedCategory = categoryDetection.topSuggestion;
      const categoryMessage = this.categoryDetector.generateCategoryMessage(categoryDetection);
      await this.sendMessage(jid, `✅ Description recorded.\n\n${categoryMessage}`);
      session.step = 'category_selection';
    } else {
      session.step = 'collecting_location';
      await this.sendLocalizedMessage(jid, userId, 'locationRequest');
    }
  }

  async handleCategorySelection(jid, userId, text, session) {
    const selection = parseInt(text);
    const suggested = session.data.suggestedCategory;
    
    if (selection >= 1 && selection <= suggested.subcategories.length) {
      session.data.category = suggested.category;
      session.data.subcategory = suggested.subcategories[selection - 1];
      
      await this.sendMessage(jid, `✅ Category selected: ${suggested.category} > ${suggested.subcategories[selection - 1]}\n\nGreat! This helps route your complaint to the right department.`);
      
      session.step = 'collecting_location';
      await this.sendLocalizedMessage(jid, userId, 'locationRequest');
      
    } else if (text.toLowerCase() === 'other') {
      session.step = 'collecting_location';
      await this.sendMessage(jid, '✅ We\'ll determine the category automatically.\n\n');
      await this.sendLocalizedMessage(jid, userId, 'locationRequest');
    } else {
      await this.sendMessage(jid, 'Please select a valid number or type "other".');
    }
  }

  async handleSimilarityDecision(jid, userId, text, session) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('upvote') || lowerText === 'yes') {
      // User wants to upvote existing complaint
      const complaintId = session.data.similarComplaintId;
      await this.communityFeatures.handleUpvoteFlow(jid, userId, `upvote ${complaintId}`, this);
      session.step = 'greeting';
      session.data = {};
    } else if (lowerText === 'proceed' || lowerText === 'new' || lowerText === 'no') {
      // User wants to proceed with new complaint
      session.step = 'confirming';
      await this.showEnhancedConfirmation(jid, session);
    } else {
      await this.sendMessage(jid, 'Please choose:\n• "upvote" to support existing complaint\n• "proceed" to submit new complaint');
    }
  }

  async showEnhancedConfirmation(jid, session) {
    const data = session.data;
    const confirmationText = `📋 Final Review - Please Confirm:

🏷️ Title: ${data.title}

📝 Description: ${data.description}

📂 Category: ${data.category || 'Auto-detected'} ${data.subcategory ? `> ${data.subcategory}` : ''}

📍 Location: ${data.location.address}

📷 Media files: ${data.mediaUrls ? data.mediaUrls.length : 0}

🎯 This complaint will be:
• Automatically classified and prioritized
• Routed to the appropriate department
• Made available for community upvoting
• Tracked for resolution progress

Type "confirm" to submit or "edit" to make changes.`;
    
    await this.sendMessage(jid, confirmationText);
  }

  async sendLocalizedWelcomeMessage(jid, userId) {
    const welcomeText = this.languageSupport.translate(userId, 'welcome');
    await this.sendMessage(jid, welcomeText);
  }

  async sendLocalizedMessage(jid, userId, key) {
    const message = this.languageSupport.translate(userId, key);
    await this.sendMessage(jid, message);
  }

  async sendLocalizedHelpMessage(jid, userId) {
    const helpText = this.languageSupport.translate(userId, 'helpCommands');
    const categories = this.languageSupport.getLocalizedCategories(userId);
    
    const fullHelp = `${helpText}

📂 Complaint Categories:
${categories.map((cat, i) => `${i + 1}. ${cat}`).join('\n')}

🌟 Community Features:
• "trending" - See popular complaints
• "upvote [ID]" - Support existing complaints
• "similar [issue]" - Find related reports

🔍 Status Tracking:
• "status [ID]" - Check complaint progress
• "latest" - Your recent complaints
• "subscribe" - Get automatic updates

Type "complaint" to get started! 🏛️`;
    
    await this.sendMessage(jid, fullHelp);
  }

  // ... (rest of the existing methods like sendMessage, handleLocation, etc. remain the same)
  
  async submitComplaint(data) {
    try {
      // Check for similar complaints before submission
      const hasSimilar = await this.communityFeatures.suggestSimilarDuringSubmission(
        data, data.userId, this
      );
      
      if (hasSimilar) {
        return { shouldWaitForDecision: true };
      }
      
      // Use enhanced complaint endpoint
      const response = await axios.post(`${this.backendUrl}/api/complaints/enhanced`, data, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
      
      if (response.data.success) {
        return {
          complaintId: response.data.data.trackingNumber || response.data.data.id,
          category: response.data.data.category,
          priority: response.data.data.priority,
          estimatedResolution: response.data.data.estimatedResolutionTime
        };
      } else {
        throw new Error(response.data.message || 'Failed to submit complaint');
      }
    } catch (error) {
      console.error('Enhanced submission error:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = EnhancedWhatsAppService;
