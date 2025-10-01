class MultiLanguageSupport {
  constructor() {
    this.supportedLanguages = ['en', 'hi', 'sa']; // English, Hindi, Santali
    this.userLanguages = new Map();
    
    this.translations = {
      en: {
        welcome: "🙏 Welcome to NAGRIK - Digital Grievance Platform\n\nI'm here to help you report civic issues quickly.\n\nType 'complaint' to file a report or 'help' for assistance.\n\n🏛️ Your voice matters!",
        helpCommands: "Available Commands:\n• 'complaint' - File new complaint\n• 'status' - Check status\n• 'help' - Show help\n• 'language' - Change language",
        titleRequest: "📝 Please provide a brief title for your complaint (10-200 characters):",
        descriptionRequest: "✅ Title recorded.\n\n📄 Now provide detailed description (20-2000 characters):\n\nInclude:\n• What is the problem?\n• When did you notice it?\n• How does it affect you?",
        locationRequest: "✅ Description recorded.\n\n📍 Please share your location:\n\nOption 1: Send WhatsApp location\nOption 2: Type address manually",
        mediaRequest: "✅ Location recorded.\n\n📷 (Optional) Send photos/videos:\n\n• Up to 3 files\n• Type 'skip' to continue\n• Type 'done' when finished"
      },
      hi: {
        welcome: "🙏 NAGRIK में आपका स्वागत है - डिजिटल शिकायत मंच\n\nमैं आपकी नागरिक समस्याओं की रिपोर्ट में मदद करूंगा।\n\nशिकायत दर्ज करने के लिए 'complaint' टाइप करें।\n\n🏛️ आपकी आवाज़ मायने रखती है!",
        helpCommands: "उपलब्ध कमांड:\n• 'complaint' - नई शिकायत\n• 'status' - स्थिति जांचें\n• 'help' - सहायता\n• 'language' - भाषा बदलें",
        titleRequest: "📝 कृपया अपनी शिकायत का संक्षिप्त शीर्षक दें (10-200 अक्षर):",
        descriptionRequest: "✅ शीर्षक दर्ज हुआ।\n\n📄 अब विस्तृत विवरण दें (20-2000 अक्षर):\n\nशामिल करें:\n• समस्या क्या है?\n• कब पता चला?\n• आप पर क्या प्रभाव?",
        locationRequest: "✅ विवरण दर्ज हुआ।\n\n📍 कृपया अपना स्थान साझा करें:\n\nविकल्प 1: WhatsApp स्थान भेजें\nविकल्प 2: पता टाइप करें",
        mediaRequest: "✅ स्थान दर्ज हुआ।\n\n📷 (वैकल्पिक) फोटो/वीडियो भेजें:\n\n• अधिकतम 3 फाइलें\n• 'skip' टाइप करें\n• समाप्त होने पर 'done' टाइप करें"
      },
      sa: {
        welcome: "🙏 NAGRIK re johar - Digital complaint manch\n\nAam aapnar nagarik samasya report mein madad karbo.\n\nComplaint file karne lage 'complaint' type karem.\n\n🏛️ Aapnar awaj mahatva rakhe!",
        helpCommands: "Available commands:\n• 'complaint' - Noa complaint\n• 'status' - Status dekhem\n• 'help' - Madad\n• 'language' - Bhasha bodlao",
        titleRequest: "📝 Dayakate aapnar complaint kar title dem (10-200 akhar):",
        descriptionRequest: "✅ Title record hoyeche.\n\n📄 Ekhon details dem (20-2000 akhar):\n\nDhukao:\n• Samasya ki?\n• Kobe dekhechen?\n• Aapnar upor ki prabhav?",
        locationRequest: "✅ Description record hoyeche.\n\n📍 Dayakate location share karem:\n\nOption 1: WhatsApp location pathao\nOption 2: Address type karem",
        mediaRequest: "✅ Location record hoyeche.\n\n📷 (Optional) Photo/video pathao:\n\n• 3 ta file porjonto\n• 'skip' type karem\n• Shesh hole 'done' type karem"
      }
    };
  }

  detectLanguage(text) {
    const hindiPattern = /[\u0900-\u097F]/;
    const santaliPattern = /\b(johar|aamu|sadom|katha|mandir|jila)\b/i;
    
    if (hindiPattern.test(text)) return 'hi';
    if (santaliPattern.test(text)) return 'sa';
    return 'en'; // Default to English
  }

  setUserLanguage(userId, language) {
    if (this.supportedLanguages.includes(language)) {
      this.userLanguages.set(userId, language);
      return true;
    }
    return false;
  }

  getUserLanguage(userId) {
    return this.userLanguages.get(userId) || 'en';
  }

  translate(userId, key) {
    const language = this.getUserLanguage(userId);
    return this.translations[language]?.[key] || this.translations.en[key];
  }

  getLanguageSelectionMessage() {
    return `🌐 भाषा चुनें / Choose Language / Bhasha chunem:

1. English
2. हिंदी (Hindi)
3. ᱥᱟᱱᱛᱟᱲᱤ (Santali)

Reply with number (1-3) / संख्या के साथ उत्तर दें / Number sangey reply karem`;
  }

  handleLanguageSelection(selection) {
    const langMap = {
      '1': 'en',
      '2': 'hi', 
      '3': 'sa',
      'english': 'en',
      'hindi': 'hi',
      'santali': 'sa'
    };
    
    return langMap[selection.toLowerCase()] || null;
  }

  getLocalizedCategories(userId) {
    const language = this.getUserLanguage(userId);
    
    const categories = {
      en: [
        "Infrastructure (Roads, Bridges)",
        "Water & Sanitation", 
        "Electricity",
        "Healthcare",
        "Education",
        "Mining & Environment",
        "Corruption",
        "Social Welfare"
      ],
      hi: [
        "अवसंरचना (सड़कें, पुल)",
        "जल एवं स्वच्छता",
        "बिजली", 
        "स्वास्थ्य सेवा",
        "शिक्षा",
        "खनन एवं पर्यावरण",
        "भ्रष्टाचार",
        "सामाजिक कल्याण"
      ],
      sa: [
        "Infrastructure (Sadak, Pool)",
        "Dak o Sapha",
        "Bijli",
        "Healthcare", 
        "Siksha",
        "Khanij o Paryavaran",
        "Bhrashtachar",
        "Samajik Kalyan"
      ]
    };
    
    return categories[language] || categories.en;
  }
}

module.exports = MultiLanguageSupport;
