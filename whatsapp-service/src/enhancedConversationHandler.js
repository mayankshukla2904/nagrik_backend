const { OpenAI } = require('openai');

class EnhancedConversationHandler {
  constructor(openaiApiKey) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.conversationMemory = new Map();
  }

  async generateContextualResponse(userId, userMessage, sessionData) {
    const context = this.buildConversationContext(sessionData);
    
    const systemPrompt = `You are NAGRIK, an AI assistant for Jharkhand's grievance redressal system. 
    You help citizens file complaints about civic issues. Be empathetic, helpful, and guide users through the process.
    
    Current context: ${context}
    
    Guidelines:
    - Be concise but friendly
    - Ask clarifying questions when needed
    - Suggest relevant categories based on user input
    - Show empathy for citizen concerns
    - Encourage detailed descriptions for better resolution`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 150,
        temperature: 0.7
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI API error:', error);
      return this.getFallbackResponse(sessionData.step);
    }
  }

  buildConversationContext(sessionData) {
    return `Step: ${sessionData.step}, Data collected: ${Object.keys(sessionData.data).join(', ')}`;
  }

  getFallbackResponse(step) {
    const fallbacks = {
      'greeting': 'How can I help you file a complaint today?',
      'collecting_title': 'Please provide a brief title for your complaint.',
      'collecting_description': 'Can you describe the issue in detail?',
      'collecting_location': 'Where did this issue occur? Please share location.',
      'collecting_media': 'Feel free to add photos or videos, or type "done" to continue.'
    };
    return fallbacks[step] || 'How can I assist you?';
  }
}

module.exports = EnhancedConversationHandler;
