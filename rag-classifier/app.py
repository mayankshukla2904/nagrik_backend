import json
import re
import os
import logging
from typing import Dict, List, Tuple, Optional
from flask import Flask, request, jsonify
from dotenv import load_dotenv
import openai
from textblob import TextBlob
import nltk
from collections import Counter
import pandas as pd
import numpy as np

# Download required NLTK data
try:
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
    nltk.download('vader_lexicon', quiet=True)
except:
    pass

# Load environment variables
load_dotenv(dotenv_path='../.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('rag_classifier.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class RAGClassifier:
    def __init__(self):
        self.app = Flask(__name__)
        self.categories = self.load_categories()
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        
        if self.openai_api_key:
            openai.api_key = self.openai_api_key
            logger.info("OpenAI API key configured")
        else:
            logger.warning("OpenAI API key not found, will use keyword-only classification")
        
        self.setup_routes()
        logger.info("RAG Classifier initialized successfully")

    def load_categories(self) -> List[Dict]:
        """Load categories and keywords from JSON file"""
        try:
            with open('categories.json', 'r', encoding='utf-8') as f:
                categories = json.load(f)
            logger.info(f"Loaded {len(categories)} categories")
            return categories
        except FileNotFoundError:
            logger.error("categories.json not found")
            return []
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing categories.json: {e}")
            return []

    def preprocess_text(self, text: str) -> str:
        """Clean and preprocess text for analysis"""
        if not text:
            return ""
        
        # Convert to lowercase
        text = text.lower()
        
        # Remove special characters but keep spaces
        text = re.sub(r'[^\w\s]', ' ', text)
        
        # Remove extra whitespace
        text = ' '.join(text.split())
        
        return text

    def keyword_classification(self, title: str, description: str) -> Dict:
        """Classify complaint using keyword matching"""
        text = f"{title} {description}"
        processed_text = self.preprocess_text(text)
        
        category_scores = {}
        severity_scores = {'low': 0, 'medium': 0, 'high': 0, 'critical': 0}
        
        for category in self.categories:
            score = 0
            matched_keywords = []
            
            # Check category keywords
            for keyword in category['keywords']:
                if keyword.lower() in processed_text:
                    score += 1
                    matched_keywords.append(keyword)
            
            # Check severity indicators
            for severity, indicators in category['severity_indicators'].items():
                for indicator in indicators:
                    if indicator.lower() in processed_text:
                        severity_scores[severity] += 1
            
            if score > 0:
                category_scores[category['name']] = {
                    'score': score,
                    'matched_keywords': matched_keywords
                }
        
        # Determine best category
        best_category = 'Other'
        best_score = 0
        matched_keywords = []
        
        if category_scores:
            best_category_data = max(category_scores.items(), key=lambda x: x[1]['score'])
            best_category = best_category_data[0]
            best_score = best_category_data[1]['score']
            matched_keywords = best_category_data[1]['matched_keywords']
        
        # Determine severity
        best_severity = max(severity_scores.items(), key=lambda x: x[1])
        severity = best_severity[0].capitalize() if best_severity[1] > 0 else 'Medium'
        
        # Calculate confidence based on keyword matches
        total_words = len(processed_text.split())
        confidence = min(best_score / max(total_words * 0.1, 1), 1.0) if total_words > 0 else 0
        
        return {
            'category': best_category,
            'severity': severity,
            'confidence': confidence,
            'method': 'keyword',
            'matched_keywords': matched_keywords,
            'category_scores': category_scores,
            'severity_scores': severity_scores
        }

    def openai_classification(self, title: str, description: str, location: str = "") -> Dict:
        """Classify complaint using OpenAI API"""
        if not self.openai_api_key:
            raise Exception("OpenAI API key not configured")
        
        # Create category list for prompt
        category_names = [cat['name'] for cat in self.categories]
        
        prompt = f"""
Analyze the following citizen grievance and classify it accurately:

Title: {title}
Description: {description}
Location: {location}

Available Categories: {', '.join(category_names)}

Severity Levels:
- Critical: Immediate safety risks, emergencies, life-threatening situations
- High: Significant impact on daily life, widespread community issues
- Medium: Moderate inconvenience, localized problems needing attention
- Low: Minor issues, suggestions for improvement

Please provide classification in the following JSON format:
{{
    "category": "category_name",
    "severity": "severity_level",
    "confidence": confidence_score_0_to_1,
    "reasoning": "brief_explanation",
    "extracted_info": {{
        "urgency_keywords": ["list", "of", "urgency", "indicators"],
        "location_specifics": "location_details_if_mentioned",
        "affected_people": "number_or_description_if_mentioned",
        "timeline": "when_issue_started_if_mentioned"
    }}
}}

Respond only with valid JSON.
"""

        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert in analyzing citizen grievances. Provide accurate classification based on the complaint details."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=500,
                temperature=0.3
            )
            
            content = response.choices[0].message.content.strip()
            result = json.loads(content)
            
            # Validate response
            if 'category' not in result or 'severity' not in result:
                raise ValueError("Invalid response format from OpenAI")
            
            # Ensure category is valid
            if result['category'] not in category_names:
                logger.warning(f"OpenAI returned invalid category: {result['category']}")
                result['category'] = 'Other'
            
            # Ensure severity is valid
            valid_severities = ['Low', 'Medium', 'High', 'Critical']
            if result['severity'] not in valid_severities:
                logger.warning(f"OpenAI returned invalid severity: {result['severity']}")
                result['severity'] = 'Medium'
            
            result['method'] = 'openai'
            logger.info(f"OpenAI classification: {result['category']} - {result['severity']}")
            
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OpenAI response: {e}")
            raise Exception("Invalid response format from OpenAI")
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise

    def hybrid_classification(self, title: str, description: str, location: str = "") -> Dict:
        """Combine keyword and OpenAI classification for better accuracy"""
        
        # First, try keyword classification
        keyword_result = self.keyword_classification(title, description)
        
        # If keyword classification has high confidence, use it
        if keyword_result['confidence'] >= 0.7:
            logger.info("Using keyword classification (high confidence)")
            return {
                'success': True,
                'category': keyword_result['category'],
                'severity': keyword_result['severity'],
                'confidence': keyword_result['confidence'],
                'extractedInfo': {
                    'method': 'keyword',
                    'matched_keywords': keyword_result['matched_keywords'],
                    'category_scores': keyword_result['category_scores']
                }
            }
        
        # Try OpenAI classification if available
        if self.openai_api_key:
            try:
                openai_result = self.openai_classification(title, description, location)
                
                # Combine results for better accuracy
                final_category = openai_result['category']
                final_severity = openai_result['severity']
                final_confidence = openai_result.get('confidence', 0.8)
                
                # If keyword and OpenAI agree, increase confidence
                if keyword_result['category'] == openai_result['category']:
                    final_confidence = min(final_confidence + 0.2, 1.0)
                
                logger.info("Using OpenAI classification")
                return {
                    'success': True,
                    'category': final_category,
                    'severity': final_severity,
                    'confidence': final_confidence,
                    'extractedInfo': {
                        'method': 'hybrid',
                        'openai_result': openai_result,
                        'keyword_result': keyword_result
                    }
                }
                
            except Exception as e:
                logger.error(f"OpenAI classification failed: {e}")
                # Fallback to keyword classification
                pass
        
        # Fallback to keyword classification with adjusted confidence
        logger.info("Using keyword classification (fallback)")
        return {
            'success': True,
            'category': keyword_result['category'],
            'severity': keyword_result['severity'],
            'confidence': max(keyword_result['confidence'], 0.3),  # Minimum confidence
            'extractedInfo': {
                'method': 'keyword_fallback',
                'matched_keywords': keyword_result['matched_keywords'],
                'note': 'OpenAI classification failed, using keyword-based classification'
            }
        }

    def setup_routes(self):
        """Setup Flask routes"""
        
        @self.app.route('/health', methods=['GET'])
        def health_check():
            return jsonify({
                'status': 'healthy',
                'service': 'RAG Classifier',
                'version': '1.0.0',
                'categories_loaded': len(self.categories),
                'openai_configured': bool(self.openai_api_key)
            })
        
        @self.app.route('/classify', methods=['POST'])
        def classify_complaint():
            try:
                data = request.get_json()
                
                if not data:
                    return jsonify({'success': False, 'error': 'No data provided'}), 400
                
                title = data.get('title', '')
                description = data.get('description', '')
                location = data.get('location', '')
                
                if not title and not description:
                    return jsonify({'success': False, 'error': 'Title or description required'}), 400
                
                logger.info(f"Classifying complaint: {title[:50]}...")
                
                result = self.hybrid_classification(title, description, location)
                
                return jsonify(result)
                
            except Exception as e:
                logger.error(f"Classification error: {e}")
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500
        
        @self.app.route('/categories', methods=['GET'])
        def get_categories():
            """Return available categories"""
            category_list = []
            for cat in self.categories:
                category_list.append({
                    'name': cat['name'],
                    'subcategories': cat.get('subcategories', []),
                    'keyword_count': len(cat['keywords'])
                })
            
            return jsonify({
                'success': True,
                'categories': category_list,
                'total': len(category_list)
            })
        
        @self.app.route('/test', methods=['POST'])
        def test_classification():
            """Test endpoint for debugging"""
            try:
                data = request.get_json()
                title = data.get('title', 'Test complaint')
                description = data.get('description', 'This is a test complaint for debugging purposes')
                
                keyword_result = self.keyword_classification(title, description)
                
                if self.openai_api_key:
                    try:
                        openai_result = self.openai_classification(title, description)
                    except Exception as e:
                        openai_result = {'error': str(e)}
                else:
                    openai_result = {'error': 'OpenAI API key not configured'}
                
                return jsonify({
                    'success': True,
                    'keyword_result': keyword_result,
                    'openai_result': openai_result,
                    'input': {'title': title, 'description': description}
                })
                
            except Exception as e:
                return jsonify({'success': False, 'error': str(e)}), 500

    def run(self, host='0.0.0.0', port=5000, debug=False):
        """Run the Flask application"""
        logger.info(f"Starting RAG Classifier service on {host}:{port}")
        self.app.run(host=host, port=port, debug=debug)

if __name__ == '__main__':
    classifier = RAGClassifier()
    # Use port 5000 for RAG classifier, regardless of PORT env var
    port = 5000
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    classifier.run(port=port, debug=debug)
