class SmartCategoryDetector {
  constructor() {
    this.jharkhandCategories = {
      'Infrastructure': {
        keywords: ['road', 'bridge', 'street', 'drainage', 'footpath', 'pothole', 'traffic', 'signal'],
        subcategories: ['Roads & Bridges', 'Traffic Management', 'Street Lighting', 'Drainage']
      },
      'Water & Sanitation': {
        keywords: ['water', 'tap', 'pipeline', 'sewage', 'drainage', 'toilet', 'sanitation', 'waste'],
        subcategories: ['Water Supply', 'Sewage Management', 'Waste Collection', 'Public Toilets']
      },
      'Electricity': {
        keywords: ['electricity', 'power', 'transformer', 'cable', 'outage', 'billing', 'meter'],
        subcategories: ['Power Outage', 'Billing Issues', 'New Connection', 'Transformer Problems']
      },
      'Healthcare': {
        keywords: ['hospital', 'doctor', 'medicine', 'clinic', 'health', 'medical', 'ambulance'],
        subcategories: ['Government Hospital', 'Primary Health Center', 'Medicine Shortage', 'Ambulance Service']
      },
      'Education': {
        keywords: ['school', 'teacher', 'education', 'student', 'books', 'uniform', 'scholarship'],
        subcategories: ['Government School', 'Teacher Absence', 'Infrastructure', 'Scholarship Issues']
      },
      'Mining & Environment': {
        keywords: ['mining', 'coal', 'environment', 'pollution', 'forest', 'tribal', 'displacement'],
        subcategories: ['Illegal Mining', 'Environmental Pollution', 'Forest Conservation', 'Tribal Rights']
      },
      'Corruption': {
        keywords: ['bribe', 'corruption', 'illegal', 'fraud', 'money', 'officer', 'demand'],
        subcategories: ['Bribery', 'Document Fraud', 'Illegal Demands', 'Service Delays']
      },
      'Social Welfare': {
        keywords: ['pension', 'ration', 'benefit', 'welfare', 'scheme', 'subsidy', 'allowance'],
        subcategories: ['Pension Issues', 'Ration Card', 'Welfare Schemes', 'Subsidy Problems']
      }
    };
  }

  async detectCategory(title, description) {
    const text = `${title} ${description}`.toLowerCase();
    const scores = {};

    // Calculate relevance scores for each category
    for (const [category, data] of Object.entries(this.jharkhandCategories)) {
      scores[category] = this.calculateRelevanceScore(text, data.keywords);
    }

    // Get top 3 suggestions
    const suggestions = Object.entries(scores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([category, score]) => ({
        category,
        confidence: score,
        subcategories: this.jharkhandCategories[category].subcategories
      }));

    return {
      topSuggestion: suggestions[0],
      allSuggestions: suggestions,
      confidence: suggestions[0]?.confidence || 0
    };
  }

  calculateRelevanceScore(text, keywords) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score += 1;
      }
      // Partial matches
      const regex = new RegExp(keyword.slice(0, -1), 'i');
      if (regex.test(text)) {
        score += 0.5;
      }
    }
    return score / keywords.length;
  }

  generateCategoryMessage(suggestions) {
    const top = suggestions.topSuggestion;
    
    if (top.confidence > 0.3) {
      return `🎯 I detected this might be related to **${top.category}**.

Possible subcategories:
${top.subcategories.map((sub, i) => `${i + 1}. ${sub}`).join('\n')}

Reply with the number (1-${top.subcategories.length}) or type "other" for different category.`;
    } else {
      return `🤔 I need help categorizing your complaint. Which category best fits?

1. Infrastructure (Roads, Bridges, Traffic)
2. Water & Sanitation
3. Electricity
4. Healthcare
5. Education
6. Mining & Environment
7. Corruption
8. Social Welfare

Reply with the number (1-8).`;
    }
  }
}

module.exports = SmartCategoryDetector;
