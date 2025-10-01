const axios = require('axios');
const logger = require('../utils/logger');

class ClassificationService {
  constructor() {
    this.ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:5000';
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  async classifyComplaint(complaintData) {
    const { title, description, location } = complaintData;
    
    try {
      logger.info('Starting complaint classification', { title: title.substring(0, 50) });

      // First try RAG classification service
      const ragResult = await this.callRagService({
        title,
        description,
        location
      });

      if (ragResult.success && ragResult.confidence > 0.7) {
        logger.info('RAG classification successful', { 
          category: ragResult.category,
          confidence: ragResult.confidence 
        });
        return {
          category: ragResult.category,
          severity: ragResult.severity,
          confidence: ragResult.confidence,
          extractedInfo: ragResult.extractedInfo,
          processedBy: 'rag',
          processedAt: new Date()
        };
      }

      // Fallback to OpenAI if RAG service fails or confidence is low
      if (this.openaiApiKey) {
        logger.info('Falling back to OpenAI classification');
        const openaiResult = await this.callOpenAI({
          title,
          description,
          location
        });

        return {
          category: openaiResult.category,
          severity: openaiResult.severity,
          confidence: openaiResult.confidence,
          extractedInfo: openaiResult.extractedInfo,
          processedBy: 'openai',
          processedAt: new Date()
        };
      }

      // Final fallback to keyword-based classification
      logger.warn('Using keyword-based classification fallback');
      return this.keywordBasedClassification({ title, description });

    } catch (error) {
      logger.error('Classification failed, using keyword fallback', { error: error.message });
      return this.keywordBasedClassification({ title, description });
    }
  }

  async callRagService(data) {
    try {
      const response = await axios.post(`${this.ragServiceUrl}/classify`, data, {
        timeout: 10000, // 10 seconds timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('RAG service call failed', { 
        error: error.message,
        url: this.ragServiceUrl 
      });
      throw error;
    }
  }

  async callOpenAI(data) {
    const { title, description, location } = data;

    const prompt = `
Analyze the following grievance and extract key information:

Title: ${title}
Description: ${description}
Location: ${location}

Please provide the following information in JSON format:
1. category: One of [Infrastructure, Healthcare, Education, Transportation, Environment, Public Safety, Utilities, Governance, Social Services, Economic Issues, Other]
2. severity: One of [Low, Medium, High, Critical]
3. confidence: A number between 0 and 1 indicating confidence in classification
4. extractedInfo: An object containing any additional relevant information extracted from the text

Consider the following for severity classification:
- Critical: Public safety risks, emergencies, life-threatening situations
- High: Significant impact on daily life, widespread issues
- Medium: Moderate inconvenience, localized problems
- Low: Minor issues, suggestions for improvement

Respond only with valid JSON.`;

    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in analyzing citizen grievances and complaints. Provide accurate categorization and severity assessment.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15 seconds timeout
      });

      const content = response.data.choices[0].message.content;
      const result = JSON.parse(content);

      // Validate the response
      if (!result.category || !result.severity) {
        throw new Error('Invalid OpenAI response format');
      }

      logger.info('OpenAI classification successful', { 
        category: result.category,
        severity: result.severity,
        confidence: result.confidence 
      });

      return result;

    } catch (error) {
      logger.error('OpenAI API call failed', { error: error.message });
      throw error;
    }
  }

  keywordBasedClassification({ title, description }) {
    const text = `${title} ${description}`.toLowerCase();

    // Category keywords mapping
    const categoryKeywords = {
      'Infrastructure': ['road', 'bridge', 'building', 'construction', 'infrastructure', 'maintenance', 'repair', 'pothole', 'street', 'sidewalk'],
      'Healthcare': ['hospital', 'doctor', 'medicine', 'health', 'medical', 'clinic', 'patient', 'treatment', 'emergency'],
      'Education': ['school', 'college', 'university', 'education', 'teacher', 'student', 'learning', 'classroom'],
      'Transportation': ['bus', 'train', 'transport', 'traffic', 'vehicle', 'metro', 'auto', 'taxi', 'parking'],
      'Environment': ['pollution', 'garbage', 'waste', 'tree', 'park', 'clean', 'environment', 'air', 'water', 'noise'],
      'Public Safety': ['police', 'crime', 'safety', 'security', 'theft', 'violence', 'emergency', 'fire', 'accident'],
      'Utilities': ['electricity', 'power', 'water', 'gas', 'internet', 'phone', 'utility', 'supply', 'connection'],
      'Governance': ['government', 'office', 'official', 'service', 'department', 'document', 'certificate', 'license']
    };

    // Severity keywords mapping
    const severityKeywords = {
      'Critical': ['emergency', 'urgent', 'critical', 'dangerous', 'life', 'death', 'serious', 'immediate'],
      'High': ['important', 'major', 'significant', 'problem', 'issue', 'concern', 'affecting'],
      'Medium': ['moderate', 'normal', 'regular', 'standard'],
      'Low': ['minor', 'small', 'suggestion', 'improvement', 'request']
    };

    // Find category based on keyword matches
    let bestCategory = 'Other';
    let maxCategoryMatches = 0;

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const matches = keywords.filter(keyword => text.includes(keyword)).length;
      if (matches > maxCategoryMatches) {
        maxCategoryMatches = matches;
        bestCategory = category;
      }
    }

    // Find severity based on keyword matches
    let bestSeverity = 'Medium';
    let maxSeverityMatches = 0;

    for (const [severity, keywords] of Object.entries(severityKeywords)) {
      const matches = keywords.filter(keyword => text.includes(keyword)).length;
      if (matches > maxSeverityMatches) {
        maxSeverityMatches = matches;
        bestSeverity = severity;
      }
    }

    const confidence = Math.min((maxCategoryMatches + maxSeverityMatches) / 10, 0.8);

    logger.info('Keyword-based classification completed', { 
      category: bestCategory,
      severity: bestSeverity,
      confidence 
    });

    return {
      category: bestCategory,
      severity: bestSeverity,
      confidence,
      extractedInfo: {
        categoryMatches: maxCategoryMatches,
        severityMatches: maxSeverityMatches
      },
      processedBy: 'keyword',
      processedAt: new Date()
    };
  }

  async retryOperation(operation, attempts = this.retryAttempts) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === attempts - 1) throw error;
        
        logger.warn(`Operation failed, retrying in ${this.retryDelay}ms`, { 
          attempt: i + 1,
          error: error.message 
        });
        
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }
  }
}

module.exports = new ClassificationService();
