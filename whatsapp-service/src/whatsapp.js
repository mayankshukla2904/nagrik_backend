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
const mime = require('mime-types');
const sharp = require('sharp');
require('dotenv').config({ path: '../.env' });

// Import enhanced modules (optional, fallback to basic functionality if not available)
let EnhancedConversationHandler, SmartCategoryDetector, MultiLanguageSupport, EnhancedStatusTracker, CommunityFeatures;

try {
  const EnhancedConversationHandlerClass = require('./enhancedConversationHandler');
  const SmartCategoryDetectorClass = require('./smartCategoryDetector');
  const MultiLanguageSupportClass = require('./multiLanguageSupport');
  const EnhancedStatusTrackerClass = require('./enhancedStatusTracker');
  const CommunityFeaturesClass = require('./communityFeatures');
  
  EnhancedConversationHandler = EnhancedConversationHandlerClass;
  SmartCategoryDetector = SmartCategoryDetectorClass;
  MultiLanguageSupport = MultiLanguageSupportClass;
  EnhancedStatusTracker = EnhancedStatusTrackerClass;
  CommunityFeatures = CommunityFeaturesClass;
} catch (error) {
  console.log('Enhanced features not available, using basic functionality');
  EnhancedConversationHandler = null;
  SmartCategoryDetector = null;
  MultiLanguageSupport = null;
  EnhancedStatusTracker = null;
  CommunityFeatures = null;
}

// Logger setup
const winston = require('winston');

// Add trace level to winston
winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'cyan',
  debug: 'green',
  trace: 'gray'
});

const logger = winston.createLogger({
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4
  },
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/whatsapp.log' }),
    new winston.transports.Console()
  ]
});

// Add trace method for Baileys compatibility
logger.trace = logger.debug;

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.sessionPath = path.join(__dirname, '../auth');
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    this.sessionName = process.env.WHATSAPP_SESSION_NAME || 'nagrik_session';
    
    // User session management
    this.userSessions = new Map();
    this.activeReports = new Map();
    
    // Initialize enhanced modules if available
    this.enhancedMode = false;
    this.initializeEnhancedFeatures();
    
    // Ensure directories exist
    fs.ensureDirSync(this.sessionPath);
    fs.ensureDirSync('logs');
    fs.ensureDirSync('uploads');

    this.init();
  }

  initializeEnhancedFeatures() {
    try {
      if (EnhancedConversationHandler && process.env.OPENAI_API_KEY) {
        this.conversationHandler = new EnhancedConversationHandler(process.env.OPENAI_API_KEY);
        logger.info('AI conversation handler initialized');
      }
      
      if (SmartCategoryDetector) {
        this.categoryDetector = new SmartCategoryDetector();
        logger.info('Smart category detector initialized');
      }
      
      if (MultiLanguageSupport) {
        this.languageSupport = new MultiLanguageSupport();
        logger.info('Multi-language support initialized');
      }
      
      if (EnhancedStatusTracker) {
        this.statusTracker = new EnhancedStatusTracker(this.backendUrl);
        logger.info('Enhanced status tracker initialized');
      }
      
      if (CommunityFeatures) {
        this.communityFeatures = new CommunityFeatures(this.backendUrl);
        logger.info('Community features initialized');
      }
      
      this.enhancedMode = !!(this.conversationHandler || this.categoryDetector || this.languageSupport);
      
      if (this.enhancedMode) {
        logger.info('✨ Enhanced WhatsApp service mode activated');
      } else {
        logger.info('📱 Basic WhatsApp service mode (enhanced features not available)');
      }
      
    } catch (error) {
      logger.warn('Enhanced features initialization failed, using basic mode:', error.message);
      this.enhancedMode = false;
    }
  }

  async init() {
    try {
      logger.info('Initializing WhatsApp service...');
      
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
      
      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // Disable deprecated option
        logger: {
          fatal: (...args) => logger.error(...args),
          error: (...args) => logger.error(...args),
          warn: (...args) => logger.warn(...args),
          info: (...args) => logger.info(...args),
          debug: (...args) => logger.debug(...args),
          trace: (...args) => logger.debug(...args), // Map trace to debug
          child: () => ({
            fatal: (...args) => logger.error(...args),
            error: (...args) => logger.error(...args),
            warn: (...args) => logger.warn(...args),
            info: (...args) => logger.info(...args),
            debug: (...args) => logger.debug(...args),
            trace: (...args) => logger.debug(...args)
          }),
          level: 'info'
        },
        browser: ['NAGRIK', 'Chrome', '1.0.0']
      });

      // Handle connection updates
      this.sock.ev.on('connection.update', (update) => this.handleConnectionUpdate(update));
      
      // Handle credential updates
      this.sock.ev.on('creds.update', saveCreds);
      
      // Handle incoming messages
      this.sock.ev.on('messages.upsert', (m) => this.handleIncomingMessage(m));

      logger.info('WhatsApp service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize WhatsApp service:', error);
      process.exit(1);
    }
  }

  handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('\n🔗 Scan this QR code with WhatsApp to connect:');
      qrcode.generate(qr, { small: true });
      console.log('\nOpen WhatsApp > Linked Devices > Link a Device > Scan QR Code\n');
    }
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      
      logger.info('Connection closed', { 
        shouldReconnect,
        reason: lastDisconnect?.error?.output?.statusCode 
      });
      
      if (shouldReconnect) {
        setTimeout(() => this.init(), 5000);
      }
    } else if (connection === 'open') {
      logger.info('WhatsApp connection opened successfully');
      console.log('✅ WhatsApp connected successfully!');
      console.log('📱 Ready to receive grievance reports via WhatsApp');
    }
  }

  async handleIncomingMessage(messageUpdate) {
    const { messages, type } = messageUpdate;
    
    if (type !== 'notify') return;
    
    for (const message of messages) {
      try {
        // Skip messages from self or status updates
        if (message.key.fromMe || message.key.remoteJid === 'status@broadcast') continue;
        
        const jid = message.key.remoteJid;
        const userId = jid.split('@')[0]; // Extract phone number
        
        logger.info('Processing message', { userId, messageType: message.message ? Object.keys(message.message)[0] : 'unknown' });
        
        await this.processMessage(message, userId, jid);
        
      } catch (error) {
        logger.error('Error processing message:', error);
      }
    }
  }

  async processMessage(message, userId, jid) {
    const messageContent = this.extractMessageContent(message);
    
    if (!messageContent) return;
    
    // Get or create user session
    if (!this.userSessions.has(userId)) {
      // Initialize session with enhanced features if available
      const sessionData = {
        step: 'greeting',
        data: {},
        lastActivity: Date.now()
      };
      
      // Detect language if enhanced mode is available
      if (this.enhancedMode && this.languageSupport) {
        const detectedLang = this.languageSupport.detectLanguage(messageContent);
        this.languageSupport.setUserLanguage(userId, detectedLang);
        sessionData.language = detectedLang;
        sessionData.preferences = {};
      }
      
      this.userSessions.set(userId, sessionData);
      
      // Send enhanced or basic welcome message
      if (this.enhancedMode && this.languageSupport) {
        await this.sendLocalizedWelcomeMessage(jid, userId);
      } else {
        await this.sendWelcomeMessage(jid);
      }
      return;
    }
    
    const session = this.userSessions.get(userId);
    session.lastActivity = Date.now();
    
    // Handle enhanced commands if available
    if (this.enhancedMode && await this.handleEnhancedCommands(jid, userId, messageContent, session)) {
      return;
    }
    
    // Handle different conversation steps (enhanced or basic)
    switch (session.step) {
      case 'greeting':
        if (this.enhancedMode) {
          await this.handleEnhancedGreeting(jid, userId, messageContent, session);
        } else {
          await this.handleGreeting(jid, userId, messageContent, session);
        }
        break;
      case 'collecting_title':
        if (this.enhancedMode && this.categoryDetector) {
          await this.handleEnhancedTitle(jid, userId, messageContent, session);
        } else {
          await this.handleTitle(jid, userId, messageContent, session);
        }
        break;
      case 'collecting_description':
        if (this.enhancedMode && this.categoryDetector) {
          await this.handleEnhancedDescription(jid, userId, messageContent, session);
        } else {
          await this.handleDescription(jid, userId, messageContent, session);
        }
        break;
      case 'category_selection':
        if (this.enhancedMode) {
          await this.handleCategorySelection(jid, userId, messageContent, session);
        } else {
          // Fallback to location collection if no enhanced features
          session.step = 'collecting_location';
          await this.sendMessage(jid, `✅ Category noted.\n\n📍 Now, please share your location:\n\nOption 1: Send your current location using WhatsApp's location feature\nOption 2: Type the address manually`);
        }
        break;
      case 'collecting_location':
        await this.handleLocation(jid, userId, message, session);
        break;
      case 'collecting_media':
        await this.handleMedia(jid, userId, message, session);
        break;
      case 'similarity_check':
        if (this.enhancedMode && this.communityFeatures) {
          await this.handleSimilarityDecision(jid, userId, messageContent, session);
        } else {
          // Fallback to confirmation if no enhanced features
          session.step = 'confirming';
          await this.showConfirmation(jid, session);
        }
        break;
      case 'confirming':
        await this.handleConfirmation(jid, userId, messageContent, session);
        break;
      case 'status_inquiry':
        if (this.enhancedMode && this.statusTracker) {
          await this.statusTracker.handleStatusInquiry(jid, userId, messageContent, session, this);
        } else {
          await this.handleStatusInquiry(jid, userId);
        }
        break;
      case 'language_selection':
        if (this.enhancedMode && this.languageSupport) {
          await this.handleLanguageSelection(jid, userId, messageContent, session);
        } else {
          session.step = 'greeting';
          await this.sendMessage(jid, 'Language selection not available. How can I help you?');
        }
        break;
      default:
        if (this.enhancedMode && this.languageSupport) {
          await this.sendLocalizedMessage(jid, userId, 'Sorry, something went wrong. Type "help" to start over.');
        } else {
          await this.sendMessage(jid, 'Sorry, something went wrong. Please type "help" to start over.');
        }
    }
  }

  extractMessageContent(message) {
    if (message.message?.conversation) {
      return message.message.conversation.trim();
    }
    
    if (message.message?.extendedTextMessage?.text) {
      return message.message.extendedTextMessage.text.trim();
    }
    
    return null;
  }

  async sendWelcomeMessage(jid) {
    const welcomeText = `🙏 Welcome to NAGRIK - Digital Grievance Platform

I'm here to help you report civic issues and grievances quickly and efficiently.

To file a complaint, simply type "complaint" or "report"

For help, type "help"

🏛️ Your voice matters in building a better community!`;
    
    await this.sendMessage(jid, welcomeText);
  }

  async handleGreeting(jid, userId, text, session) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('complaint') || lowerText.includes('report') || lowerText.includes('issue') || lowerText.includes('problem')) {
      session.step = 'collecting_title';
      session.data = { userId, channel: 'WhatsApp' };
      
      await this.sendMessage(jid, `📝 Let's help you file your complaint.

Please provide a brief title for your complaint (10-200 characters):

Example: "Broken streetlight on Main Street"`);
      
    } else if (lowerText.includes('help')) {
      await this.sendHelpMessage(jid);
    } else if (lowerText.includes('status')) {
      await this.handleStatusInquiry(jid, userId);
    } else {
      await this.sendMessage(jid, `I can help you with:
• Filing a new complaint (type "complaint")
• Check complaint status (type "status")
• Get help (type "help")

What would you like to do?`);
    }
  }

  // Enhanced methods (only used if enhanced mode is available)
  async handleEnhancedCommands(jid, userId, text, session) {
    if (!this.enhancedMode) return false;
    
    const lowerText = text.toLowerCase();
    
    // Language selection
    if ((lowerText === 'language' || lowerText === 'भाषा' || lowerText === 'bhasha') && this.languageSupport) {
      await this.sendMessage(jid, this.languageSupport.getLanguageSelectionMessage());
      session.step = 'language_selection';
      return true;
    }
    
    // Community features
    if (this.communityFeatures && (lowerText.includes('trending') || lowerText.includes('popular') || 
        lowerText.includes('upvote') || lowerText.includes('community') ||
        lowerText.includes('similar'))) {
      await this.communityFeatures.handleCommunityCommands(jid, userId, lowerText, this);
      return true;
    }
    
    // Enhanced status tracking
    if (this.statusTracker && (lowerText.includes('status') || lowerText.includes('track') || 
        lowerText.match(/nagrik\d{6}/))) {
      await this.statusTracker.handleStatusInquiry(jid, userId, lowerText, session, this);
      return true;
    }
    
    return false;
  }

  async handleLanguageSelection(jid, userId, text, session) {
    if (!this.languageSupport) return;
    
    const selectedLang = this.languageSupport.handleLanguageSelection(text);
    if (selectedLang) {
      this.languageSupport.setUserLanguage(userId, selectedLang);
      session.language = selectedLang;
      await this.sendLocalizedMessage(jid, userId, '✅ Language updated successfully!');
      session.step = 'greeting';
    } else {
      await this.sendMessage(jid, 'Please select a valid language (1-3).');
    }
  }

  async handleEnhancedGreeting(jid, userId, text, session) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('complaint') || lowerText.includes('report') || 
        lowerText.includes('issue') || lowerText.includes('problem') ||
        lowerText.includes('शिकायत') || lowerText.includes('complaint')) {
      
      session.step = 'collecting_title';
      session.data = { userId, channel: 'WhatsApp' };
      
      if (this.languageSupport) {
        await this.sendLocalizedMessage(jid, userId, 'titleRequest');
      } else {
        await this.sendMessage(jid, `📝 Let's help you file your complaint.\n\nPlease provide a brief title for your complaint (10-200 characters):\n\nExample: "Broken streetlight on Main Street"`);
      }
      
    } else if (lowerText.includes('help')) {
      if (this.languageSupport) {
        await this.sendLocalizedHelpMessage(jid, userId);
      } else {
        await this.sendHelpMessage(jid);
      }
    } else {
      // Use AI for contextual response if available
      if (this.conversationHandler) {
        try {
          const contextualResponse = await this.conversationHandler.generateContextualResponse(
            userId, text, session
          );
          await this.sendMessage(jid, contextualResponse);
        } catch (error) {
          logger.warn('AI response failed, using fallback:', error.message);
          await this.handleGreeting(jid, userId, text, session);
        }
      } else {
        await this.handleGreeting(jid, userId, text, session);
      }
    }
  }

  async handleEnhancedTitle(jid, userId, text, session) {
    if (text.length < 10 || text.length > 200) {
      const message = this.languageSupport ? 
        'Title should be between 10-200 characters. Please try again:' :
        'Title should be between 10-200 characters. Please try again:';
      await this.sendMessage(jid, message);
      return;
    }
    
    session.data.title = text;
    
    // Smart category detection if available
    if (this.categoryDetector) {
      try {
        const categoryDetection = await this.categoryDetector.detectCategory(text, '');
        
        if (categoryDetection.confidence > 0.3) {
          session.data.suggestedCategory = categoryDetection.topSuggestion;
          const categoryMessage = this.categoryDetector.generateCategoryMessage(categoryDetection);
          await this.sendMessage(jid, `✅ Title recorded: "${text}"\n\n${categoryMessage}`);
          session.step = 'category_selection';
          return;
        }
      } catch (error) {
        logger.warn('Category detection failed, using basic flow:', error.message);
      }
    }
    
    // Fallback to basic description collection
    session.step = 'collecting_description';
    const message = this.languageSupport ? 
      this.languageSupport.translate(userId, 'descriptionRequest') :
      `✅ Title recorded: "${text}"\n\nNow, please provide a detailed description of the issue (20-2000 characters):\n\nInclude:\n• What exactly is the problem?\n• When did you notice it?\n• How is it affecting you/community?`;
    await this.sendMessage(jid, message);
  }

  async handleEnhancedDescription(jid, userId, text, session) {
    if (text.length < 20 || text.length > 2000) {
      const message = this.languageSupport ? 
        'Description should be between 20-2000 characters. Please provide more details:' :
        'Description should be between 20-2000 characters. Please provide more details:';
      await this.sendMessage(jid, message);
      return;
    }
    
    session.data.description = text;
    
    // Enhanced category detection with title + description
    if (this.categoryDetector && !session.data.suggestedCategory) {
      try {
        const categoryDetection = await this.categoryDetector.detectCategory(
          session.data.title, text
        );
        
        if (categoryDetection.confidence > 0.3) {
          session.data.suggestedCategory = categoryDetection.topSuggestion;
          const categoryMessage = this.categoryDetector.generateCategoryMessage(categoryDetection);
          await this.sendMessage(jid, `✅ Description recorded.\n\n${categoryMessage}`);
          session.step = 'category_selection';
          return;
        }
      } catch (error) {
        logger.warn('Enhanced category detection failed, using basic flow:', error.message);
      }
    }
    
    // Fallback to location collection
    session.step = 'collecting_location';
    const message = this.languageSupport ? 
      this.languageSupport.translate(userId, 'locationRequest') :
      `✅ Description recorded.\n\n📍 Now, please share your location:\n\nOption 1: Send your current location using WhatsApp's location feature\nOption 2: Type the address manually\n\nThis helps authorities locate and resolve the issue quickly.`;
    await this.sendMessage(jid, message);
  }

  async handleCategorySelection(jid, userId, text, session) {
    if (!this.categoryDetector) return;
    
    const selection = parseInt(text);
    const suggested = session.data.suggestedCategory;
    
    if (selection >= 1 && selection <= suggested.subcategories.length) {
      session.data.category = suggested.category;
      session.data.subcategory = suggested.subcategories[selection - 1];
      
      await this.sendMessage(jid, `✅ Category selected: ${suggested.category} > ${suggested.subcategories[selection - 1]}\n\nGreat! This helps route your complaint to the right department.`);
      
      session.step = 'collecting_location';
      const message = this.languageSupport ? 
        this.languageSupport.translate(userId, 'locationRequest') :
        `📍 Now, please share your location:\n\nOption 1: Send your current location using WhatsApp's location feature\nOption 2: Type the address manually\n\nThis helps authorities locate and resolve the issue quickly.`;
      await this.sendMessage(jid, message);
      
    } else if (text.toLowerCase() === 'other') {
      session.step = 'collecting_location';
      await this.sendMessage(jid, '✅ We\'ll determine the category automatically.\n\n');
      const message = this.languageSupport ? 
        this.languageSupport.translate(userId, 'locationRequest') :
        `📍 Now, please share your location:\n\nOption 1: Send your current location using WhatsApp's location feature\nOption 2: Type the address manually`;
      await this.sendMessage(jid, message);
    } else {
      await this.sendMessage(jid, 'Please select a valid number or type "other".');
    }
  }

  async handleSimilarityDecision(jid, userId, text, session) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('upvote') || lowerText === 'yes') {
      // User wants to upvote existing complaint
      const complaintId = session.data.similarComplaintId;
      if (this.communityFeatures) {
        await this.communityFeatures.handleUpvoteFlow(jid, userId, `upvote ${complaintId}`, this);
      }
      session.step = 'greeting';
      session.data = {};
    } else if (lowerText === 'proceed' || lowerText === 'new' || lowerText === 'no') {
      // User wants to proceed with new complaint
      session.step = 'confirming';
      if (this.enhancedMode) {
        await this.showEnhancedConfirmation(jid, session);
      } else {
        await this.showConfirmation(jid, session);
      }
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
    if (!this.languageSupport) {
      await this.sendWelcomeMessage(jid);
      return;
    }
    
    const welcomeText = this.languageSupport.translate(userId, 'welcome');
    await this.sendMessage(jid, welcomeText);
  }

  async sendLocalizedMessage(jid, userId, key) {
    if (!this.languageSupport) {
      // Fallback to English messages
      const fallbackMessages = {
        'titleRequest': '📝 Please provide a brief title for your complaint (10-200 characters):',
        'descriptionRequest': 'Now, please provide a detailed description of the issue (20-2000 characters):',
        'locationRequest': '📍 Please share your location or type the address manually:',
        'mediaRequest': '📷 (Optional) Send photos/videos or type "skip" to continue:'
      };
      await this.sendMessage(jid, fallbackMessages[key] || 'How can I assist you?');
      return;
    }
    
    const message = this.languageSupport.translate(userId, key);
    await this.sendMessage(jid, message);
  }

  async sendLocalizedHelpMessage(jid, userId) {
    if (!this.languageSupport) {
      await this.sendHelpMessage(jid);
      return;
    }
    
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

  async handleTitle(jid, userId, text, session) {
    if (text.length < 10 || text.length > 200) {
      await this.sendMessage(jid, 'Title should be between 10-200 characters. Please try again:');
      return;
    }
    
    session.data.title = text;
    session.step = 'collecting_description';
    
    await this.sendMessage(jid, `✅ Title recorded: "${text}"

Now, please provide a detailed description of the issue (20-2000 characters):

Include:
• What exactly is the problem?
• When did you notice it?
• How is it affecting you/community?`);
  }

  async handleDescription(jid, userId, text, session) {
    if (text.length < 20 || text.length > 2000) {
      await this.sendMessage(jid, 'Description should be between 20-2000 characters. Please provide more details:');
      return;
    }
    
    session.data.description = text;
    session.step = 'collecting_location';
    
    await this.sendMessage(jid, `✅ Description recorded.

📍 Now, please share your location:

Option 1: Send your current location using WhatsApp's location feature
Option 2: Type the address manually

This helps authorities locate and resolve the issue quickly.`);
  }

  async handleLocation(jid, userId, message, session) {
    let location = null;
    
    // Check if it's a location message
    if (message.message?.locationMessage) {
      const loc = message.message.locationMessage;
      location = {
        type: 'Point',
        coordinates: [loc.degreesLongitude, loc.degreesLatitude],
        address: loc.name || `${loc.degreesLatitude}, ${loc.degreesLongitude}`
      };
    } else {
      // Handle text address
      const text = this.extractMessageContent(message);
      if (text && text.length > 5) {
        // For manual address, we'll use a default coordinate and store address
        location = {
          type: 'Point',
          coordinates: [77.2090, 28.6139], // Default to Delhi coordinates
          address: text
        };
      }
    }
    
    if (!location) {
      await this.sendMessage(jid, 'Please share a valid location or type a detailed address.');
      return;
    }
    
    session.data.location = location;
    session.step = 'collecting_media';
    
    await this.sendMessage(jid, `✅ Location recorded: ${location.address}

📷 (Optional) You can now send photos or videos related to your complaint:

• Send up to 3 images/videos
• Or type "skip" to continue without media
• Or type "done" when finished adding media`);
  }

  async handleMedia(jid, userId, message, session) {
    const text = this.extractMessageContent(message);
    
    if (text) {
      const lowerText = text.toLowerCase();
      if (lowerText === 'skip' || lowerText === 'done') {
        session.step = 'confirming';
        await this.showConfirmation(jid, session);
        return;
      }
    }
    
    // Handle media messages
    if (message.message?.imageMessage || message.message?.videoMessage || message.message?.documentMessage) {
      try {
        const mediaUrl = await this.downloadAndSaveMedia(message, userId);
        
        if (!session.data.mediaUrls) session.data.mediaUrls = [];
        session.data.mediaUrls.push(mediaUrl);
        
        await this.sendMessage(jid, `✅ Media received (${session.data.mediaUrls.length}/3)

You can send more media or type "done" to continue.`);
        
        if (session.data.mediaUrls.length >= 3) {
          session.step = 'confirming';
          await this.showConfirmation(jid, session);
        }
      } catch (error) {
        logger.error('Error processing media:', error);
        await this.sendMessage(jid, 'Sorry, there was an error processing your media. Please try again or type "skip".');
      }
    } else {
      await this.sendMessage(jid, 'Please send an image/video or type "skip" or "done".');
    }
  }

  async downloadAndSaveMedia(message, userId) {
    const mediaMessage = message.message?.imageMessage || message.message?.videoMessage || message.message?.documentMessage;
    
    if (!mediaMessage) throw new Error('No media message found');
    
    const buffer = await downloadMediaMessage(message, 'buffer', {}, {
      logger: winston.createLogger({ level: 'silent' })
    });
    
    const timestamp = Date.now();
    const extension = mime.extension(mediaMessage.mimetype) || 'bin';
    const filename = `${userId}_${timestamp}.${extension}`;
    const filepath = path.join('uploads', filename);
    
    // Compress images if needed
    if (mediaMessage.mimetype?.startsWith('image/')) {
      const compressedBuffer = await sharp(buffer)
        .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      
      await fs.writeFile(filepath, compressedBuffer);
    } else {
      await fs.writeFile(filepath, buffer);
    }
    
    logger.info('Media saved', { filename, userId, mimetype: mediaMessage.mimetype });
    
    // Return URL that backend can access
    return `${this.backendUrl}/uploads/${filename}`;
  }

  async showConfirmation(jid, session) {
    const data = session.data;
    const confirmationText = `📋 Please confirm your complaint details:

🏷️ Title: ${data.title}

📝 Description: ${data.description}

📍 Location: ${data.location.address}

📷 Media files: ${data.mediaUrls ? data.mediaUrls.length : 0}

Type "confirm" to submit or "cancel" to start over.`;
    
    await this.sendMessage(jid, confirmationText);
  }

  async handleConfirmation(jid, userId, text, session) {
    const lowerText = text.toLowerCase();
    
    if (lowerText === 'confirm' || lowerText === 'yes') {
      try {
        await this.sendMessage(jid, '⏳ Submitting your complaint...');
        
        const result = await this.submitComplaint(session.data);
        
        // Handle enhanced response
        if (typeof result === 'object' && result.shouldWaitForDecision) {
          // Wait for user decision on similar complaints
          return;
        }
        
        let complaintId, successMessage;
        
        if (typeof result === 'object') {
          // Enhanced response with additional information
          complaintId = result.complaintId;
          successMessage = `✅ Complaint submitted successfully!

🆔 Your Complaint ID: *${complaintId}*
📂 Category: ${result.category || 'Processing'}
🔴 Priority: ${result.priority || 'Medium'}
${result.estimatedResolution ? `⏱️ Estimated Resolution: ${result.estimatedResolution} days` : ''}

📧 You will receive updates on the progress of your complaint.

${this.enhancedMode ? '👍 Your complaint is now available for community upvoting!' : ''}

Thank you for using NAGRIK. Your voice helps build a better community! 🏛️

Type "complaint" to file another complaint or "help" for assistance.`;
        } else {
          // Basic response
          complaintId = result;
          successMessage = `✅ Complaint submitted successfully!

🆔 Your Complaint ID: *${complaintId}*

📧 You will receive updates on the progress of your complaint.

Thank you for using NAGRIK. Your voice helps build a better community! 🏛️

Type "complaint" to file another complaint or "help" for assistance.`;
        }
        
        await this.sendMessage(jid, successMessage);
        
        // Reset session
        session.step = 'greeting';
        session.data = {};
        
        logger.info('Complaint submitted via WhatsApp', { 
          userId, 
          complaintId,
          enhancedMode: this.enhancedMode 
        });
        
      } catch (error) {
        logger.error('Error submitting complaint:', error);
        await this.sendMessage(jid, '❌ Sorry, there was an error submitting your complaint. Please try again later or contact support.');
      }
    } else if (lowerText === 'cancel' || lowerText === 'no') {
      session.step = 'greeting';
      session.data = {};
      await this.sendMessage(jid, 'Complaint cancelled. Type "complaint" to start a new report.');
    } else if (lowerText === 'edit' && this.enhancedMode) {
      session.step = 'collecting_title';
      await this.sendMessage(jid, 'Let\'s edit your complaint. Please provide a new title:');
    } else {
      const options = this.enhancedMode ? 
        'Please type "confirm" to submit, "edit" to make changes, or "cancel" to start over.' :
        'Please type "confirm" to submit or "cancel" to start over.';
      await this.sendMessage(jid, options);
    }
  }

  // Map WhatsApp smart categories to backend valid categories
  mapCategoryToBackend(whatsappCategory) {
    const categoryMapping = {
      'Infrastructure': 'Infrastructure',
      'Water & Sanitation': 'Utilities',
      'Electricity': 'Utilities',
      'Healthcare': 'Healthcare',
      'Education': 'Education',
      'Mining & Environment': 'Environment',
      'Corruption': 'Governance',
      'Social Welfare': 'Social Services',
      'Transportation': 'Transportation',
      'Public Safety': 'Public Safety',
      'Economic Issues': 'Economic Issues'
    };
    
    return categoryMapping[whatsappCategory] || 'Other';
  }

  async submitComplaint(data) {
    try {
      // Map category to backend valid category
      if (data.category) {
        data.category = this.mapCategoryToBackend(data.category);
      }
      
      // Ensure description is present
      if (!data.description && data.title) {
        data.description = data.title; // Use title as description if missing
      }
      
      // Check for similar complaints before submission if enhanced mode is available
      if (this.enhancedMode && this.communityFeatures) {
        try {
          const hasSimilar = await this.communityFeatures.suggestSimilarDuringSubmission(
            data, data.userId, this
          );
          
          if (hasSimilar) {
            return { shouldWaitForDecision: true };
          }
        } catch (error) {
          logger.warn('Similar complaint check failed, proceeding with submission:', error.message);
        }
      }
      
      // Try enhanced endpoint first, fallback to basic endpoint
      let endpoint = '/api/complaints/enhanced';
      let response;
      
      try {
        response = await axios.post(`${this.backendUrl}${endpoint}`, data, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        });
      } catch (enhancedError) {
        logger.warn('Enhanced endpoint failed, trying basic endpoint:', enhancedError.message);
        
        // Fallback to basic endpoint
        endpoint = '/api/complaints/report';
        response = await axios.post(`${this.backendUrl}${endpoint}`, data, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        });
      }
      
      if (response.data.success) {
        // Handle enhanced response format
        if (response.data.data.trackingNumber) {
          return {
            complaintId: response.data.data.trackingNumber,
            category: response.data.data.category,
            priority: response.data.data.priority,
            estimatedResolution: response.data.data.estimatedResolutionTime
          };
        }
        // Handle basic response format
        else if (response.data.data.complaintId) {
          return response.data.data.complaintId;
        }
        // Handle direct ID response
        else {
          return response.data.data.id || response.data.data._id;
        }
      } else {
        throw new Error(response.data.message || 'Failed to submit complaint');
      }
    } catch (error) {
      logger.error('Complaint submission error:', error.response?.data || error.message);
      throw error;
    }
  }

  async handleStatusInquiry(jid, userId) {
    await this.sendMessage(jid, `To check your complaint status, please provide your Complaint ID.

Example: NAGRIK123456

Or type "latest" to see your most recent complaint.`);
    
    // Set up a temporary handler for status inquiry
    const session = this.userSessions.get(userId) || {};
    session.step = 'status_inquiry';
    this.userSessions.set(userId, session);
  }

  async sendHelpMessage(jid) {
    let helpText = `🆘 NAGRIK Help

Available Commands:
• "complaint" or "report" - File a new complaint
• "status" - Check complaint status
• "help" - Show this help message`;

    // Add enhanced features if available
    if (this.enhancedMode) {
      if (this.languageSupport) {
        helpText += `
• "language" - Change language (English/Hindi/Santali)`;
      }
      
      if (this.communityFeatures) {
        helpText += `

🌟 Community Features:
• "trending" - See popular complaints
• "upvote [ID]" - Support existing complaints  
• "similar [issue]" - Find related reports
• "community" - View community statistics`;
      }
      
      if (this.statusTracker) {
        helpText += `

🔍 Enhanced Status Tracking:
• "status [ID]" - Check specific complaint
• "latest" - Your recent complaints
• "all" - All your complaints
• "subscribe" - Get automatic updates`;
      }
    }

    helpText += `

How to file a complaint:
1. Type "complaint"
2. Provide a clear title
3. Give detailed description`;

    if (this.enhancedMode && this.categoryDetector) {
      helpText += `
4. Select category (auto-suggested)`;
    }

    helpText += `
${this.enhancedMode ? '4-5' : '4'}. Share location
${this.enhancedMode ? '5-6' : '5'}. Optionally add photos/videos
${this.enhancedMode ? '6-7' : '6'}. Confirm and submit

📞 For urgent issues requiring immediate attention, please contact emergency services.

🏛️ NAGRIK - Your digital voice for civic issues.`;

    if (this.enhancedMode) {
      helpText += `\n\n✨ Enhanced features are active! Enjoy AI-powered assistance, multi-language support, and community features.`;
    }
    
    await this.sendMessage(jid, helpText);
  }

  async sendMessage(jid, text) {
    try {
      await this.sock.sendMessage(jid, { text });
      logger.info('Message sent', { jid: jid.split('@')[0], messageLength: text.length });
    } catch (error) {
      logger.error('Error sending message:', error);
    }
  }

  // Cleanup inactive sessions
  startSessionCleanup() {
    setInterval(() => {
      const now = Date.now();
      const timeout = 30 * 60 * 1000; // 30 minutes
      
      for (const [userId, session] of this.userSessions.entries()) {
        if (now - session.lastActivity > timeout) {
          this.userSessions.delete(userId);
          logger.info('Session cleaned up', { userId });
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }
}

// Initialize the service
const whatsappService = new WhatsAppService();
whatsappService.startSessionCleanup();

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Shutting down WhatsApp service...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down WhatsApp service...');
  process.exit(0);
});

module.exports = WhatsAppService;
