import os
import logging
import json
import re
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import openai
from dotenv import load_dotenv
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import nltk
from textblob import TextBlob

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EnhancedRAGClassifier:
    def __init__(self):
        """Initialize the Enhanced RAG Classifier with Jharkhand-specific intelligence"""
        self.app = Flask(__name__)
        CORS(self.app)
        
        # Load categories and keywords
        self.categories = self.load_categories()
        self.jharkhand_data = self.load_jharkhand_data()
        self.urgency_keywords = self.load_urgency_keywords()
        self.department_mapping = self.load_department_mapping()
        
        # Initialize vectorizer for similarity detection
        self.vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
        
        # Initialize OpenAI
        openai.api_key = os.getenv('OPENAI_API_KEY')
        if openai.api_key:
            logger.info("OpenAI API key configured")
        else:
            logger.warning("OpenAI API key not found")
        
        # Setup routes
        self.setup_routes()
        logger.info(f"Enhanced RAG Classifier initialized with {len(self.categories)} categories")
    
    def load_categories(self):
        """Load enhanced complaint categories with Jharkhand-specific focus"""
        return {
            'Infrastructure': {
                'keywords': ['road', 'bridge', 'building', 'construction', 'repair', 'maintenance', 'pothole', 'street', 'sidewalk'],
                'subcategories': ['Roads', 'Bridges', 'Public Buildings', 'Street Lighting'],
                'priority_base': 3
            },
            'Transportation': {
                'keywords': ['bus', 'transport', 'traffic', 'vehicle', 'auto', 'rickshaw', 'railway', 'station'],
                'subcategories': ['Public Transport', 'Traffic Management', 'Railway Issues'],
                'priority_base': 2
            },
            'Water Supply': {
                'keywords': ['water', 'tap', 'pipeline', 'shortage', 'quality', 'contamination', 'leak', 'pressure'],
                'subcategories': ['Water Shortage', 'Water Quality', 'Pipeline Issues'],
                'priority_base': 4
            },
            'Electricity': {
                'keywords': ['power', 'electricity', 'outage', 'blackout', 'transformer', 'wire', 'meter', 'bill'],
                'subcategories': ['Power Outage', 'Billing Issues', 'Infrastructure'],
                'priority_base': 3
            },
            'Sanitation': {
                'keywords': ['garbage', 'waste', 'cleaning', 'toilet', 'drainage', 'sewage', 'hygiene'],
                'subcategories': ['Waste Management', 'Public Toilets', 'Drainage'],
                'priority_base': 3
            },
            'Healthcare': {
                'keywords': ['hospital', 'doctor', 'medicine', 'health', 'medical', 'treatment', 'emergency'],
                'subcategories': ['Hospital Services', 'Medicine Availability', 'Emergency Care'],
                'priority_base': 5
            },
            'Education': {
                'keywords': ['school', 'teacher', 'education', 'student', 'class', 'book', 'uniform', 'mid-day meal'],
                'subcategories': ['School Infrastructure', 'Teacher Issues', 'Educational Materials'],
                'priority_base': 2
            },
            'Public Safety': {
                'keywords': ['police', 'crime', 'safety', 'security', 'theft', 'violence', 'harassment'],
                'subcategories': ['Crime', 'Police Response', 'Public Security'],
                'priority_base': 4
            },
            'Environment': {
                'keywords': ['pollution', 'air', 'noise', 'tree', 'forest', 'mining', 'dust', 'smoke'],
                'subcategories': ['Air Pollution', 'Noise Pollution', 'Forest Issues', 'Mining Pollution'],
                'priority_base': 3
            },
            'Governance': {
                'keywords': ['corruption', 'bribe', 'service', 'officer', 'department', 'certificate', 'license'],
                'subcategories': ['Service Delivery', 'Corruption', 'Administrative Issues'],
                'priority_base': 2
            },
            'Rural Development': {
                'keywords': ['village', 'rural', 'farming', 'agriculture', 'irrigation', 'panchayat', 'employment'],
                'subcategories': ['Agriculture', 'Rural Infrastructure', 'Employment Schemes'],
                'priority_base': 2
            },
            'Mining Issues': {
                'keywords': ['mine', 'coal', 'extraction', 'blast', 'dust', 'land acquisition', 'compensation'],
                'subcategories': ['Coal Mining', 'Land Issues', 'Environmental Impact'],
                'priority_base': 4
            },
            'Tribal Affairs': {
                'keywords': ['tribal', 'adivasi', 'forest rights', 'displacement', 'culture', 'reservation'],
                'subcategories': ['Land Rights', 'Cultural Issues', 'Displacement'],
                'priority_base': 3
            },
            'Forest Conservation': {
                'keywords': ['forest', 'tree cutting', 'wildlife', 'conservation', 'encroachment', 'deforestation'],
                'subcategories': ['Deforestation', 'Wildlife Protection', 'Encroachment'],
                'priority_base': 3
            }
        }
    
    def load_jharkhand_data(self):
        """Load Jharkhand-specific geographical and administrative data"""
        return {
            'districts': [
                'Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum', 
                'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara', 
                'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu', 
                'Ramgarh', 'Ranchi', 'Sahibganj', 'Seraikela Kharsawan', 
                'Simdega', 'West Singhbhum'
            ],
            'district_coordinates': {
                'Ranchi': {'lat': 23.3441, 'lon': 85.3096},
                'Jamshedpur': {'lat': 22.8046, 'lon': 86.2029},
                'Dhanbad': {'lat': 23.7957, 'lon': 86.4304},
                'Bokaro': {'lat': 23.6693, 'lon': 85.9590}
            },
            'common_locations': {
                'Ranchi': ['Main Road', 'Station Road', 'Circular Road', 'Kanke Road', 'Ratu Road'],
                'Jamshedpur': ['Bistupur', 'Sakchi', 'Kadma', 'Jugsalai', 'Mango'],
                'Dhanbad': ['Jharia', 'Bank More', 'Saraidhela', 'Katras'],
                'Bokaro': ['Steel City', 'Sector 1', 'Sector 4', 'City Centre']
            },
            'tribal_districts': ['Khunti', 'Gumla', 'Simdega', 'Latehar', 'Pakur', 'Dumka', 'Sahibganj', 'Godda'],
            'mining_districts': ['Dhanbad', 'Bokaro', 'Ramgarh', 'East Singhbhum', 'West Singhbhum'],
            'urban_districts': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar']
        }
    
    def load_urgency_keywords(self):
        """Load keywords that indicate urgency levels"""
        return {
            'urgent': [
                'emergency', 'urgent', 'immediate', 'critical', 'dangerous', 'life threatening',
                'accident', 'fire', 'flood', 'medical', 'death', 'serious injury',
                'breakdown', 'major leak', 'explosion', 'collapse', 'ambulance needed'
            ],
            'high': [
                'severe', 'major', 'significant', 'widespread', 'affecting many',
                'road blocked', 'power outage', 'water shortage', 'health hazard',
                'safety concern', 'public health', 'broken', 'damaged'
            ],
            'medium': [
                'problem', 'issue', 'concern', 'complaint', 'needs attention',
                'maintenance required', 'repair needed', 'improvement needed'
            ]
        }
    
    def load_department_mapping(self):
        """Load department mapping for automatic assignment"""
        return {
            'Infrastructure': 'Public Works Department',
            'Transportation': 'Transport Department',
            'Water Supply': 'Water Resources',
            'Electricity': 'Power Department',
            'Sanitation': 'Urban Development',
            'Healthcare': 'Health Department',
            'Education': 'Education Department',
            'Public Safety': 'Police Department',
            'Environment': 'Environment Department',
            'Governance': 'Administrative Department',
            'Rural Development': 'Rural Development',
            'Mining Issues': 'Mining Department',
            'Tribal Affairs': 'Tribal Welfare',
            'Forest Conservation': 'Forest Department'
        }
    
    def setup_routes(self):
        """Setup Flask routes"""
        @self.app.route('/', methods=['GET'])
        def home():
            return jsonify({
                "message": "🚀 NAGRIK Enhanced RAG Classifier",
                "version": "2.0.0",
                "status": "Running",
                "timestamp": datetime.now().isoformat(),
                "environment": os.getenv('FLASK_ENV', 'development'),
                "features": {
                    "jharkhand_specific": True,
                    "upvoting_system": True,
                    "ai_enhancement": True,
                    "openai": "configured" if openai.api_key else "not_configured",
                    "categories": len(self.categories),
                    "districts": len(self.jharkhand_data['districts'])
                }
            })
        
        @self.app.route('/health', methods=['GET'])
        def health():
            return jsonify({
                "status": "healthy",
                "timestamp": datetime.now().isoformat()
            })
        
        @self.app.route('/classify', methods=['POST'])
        def classify_complaint():
            try:
                data = request.get_json()
                
                if not data or 'text' not in data:
                    return jsonify({
                        "success": False,
                        "error": "Missing 'text' field in request"
                    }), 400
                
                text = data['text'].strip()
                location = data.get('location', '')
                user_phone = data.get('user_phone', '')
                
                if len(text) < 10:
                    return jsonify({
                        "success": False,
                        "error": "Text must be at least 10 characters long"
                    }), 400
                
                # Classify the complaint
                result = self.classify_text(text, location, user_phone)
                
                return jsonify({
                    "success": True,
                    "data": result
                })
                
            except Exception as e:
                logger.error(f"Classification error: {str(e)}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/enhance', methods=['POST'])
        def enhance_complaint():
            """Enhance complaint with AI suggestions and validation"""
            try:
                data = request.get_json()
                complaint = data.get('complaint', {})
                
                enhanced = self.enhance_with_ai(complaint)
                
                return jsonify({
                    "success": True,
                    "data": enhanced
                })
                
            except Exception as e:
                logger.error(f"Enhancement error: {str(e)}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/find-similar', methods=['POST'])
        def find_similar():
            """Find similar complaints for upvoting"""
            try:
                data = request.get_json()
                text = data.get('text', '')
                location = data.get('location', {})
                
                similar = self.find_similar_complaints(text, location)
                
                return jsonify({
                    "success": True,
                    "data": similar
                })
                
            except Exception as e:
                logger.error(f"Similar search error: {str(e)}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        
        @self.app.route('/validate-location', methods=['POST'])
        def validate_location():
            """Validate and enhance location information"""
            try:
                data = request.get_json()
                location_text = data.get('location', '')
                
                validated = self.validate_jharkhand_location(location_text)
                
                return jsonify({
                    "success": True,
                    "data": validated
                })
                
            except Exception as e:
                logger.error(f"Location validation error: {str(e)}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
    
    def classify_text(self, text, location='', user_phone=''):
        """Enhanced text classification with Jharkhand context"""
        text_lower = text.lower()
        
        # Calculate urgency level
        urgency_level = self.calculate_urgency(text_lower)
        
        # Detect sentiment
        sentiment = self.analyze_sentiment(text)
        
        # Keyword-based classification
        category_scores = {}
        
        for category, data in self.categories.items():
            score = 0
            matched_keywords = []
            
            for keyword in data['keywords']:
                if keyword in text_lower:
                    score += 1
                    matched_keywords.append(keyword)
            
            # Boost score based on priority and urgency
            if score > 0:
                score = score * data['priority_base'] * urgency_level
                category_scores[category] = {
                    'score': score,
                    'keywords': matched_keywords
                }
        
        # Determine best category
        if category_scores:
            best_category = max(category_scores.keys(), key=lambda k: category_scores[k]['score'])
            confidence = min(category_scores[best_category]['score'] / 10, 1.0)
        else:
            # Fallback to OpenAI if no keywords match
            ai_result = self.classify_with_openai(text)
            best_category = ai_result.get('category', 'Infrastructure')
            confidence = ai_result.get('confidence', 0.5)
            category_scores = {best_category: {'score': confidence * 10, 'keywords': []}}
        
        # Extract missing information
        missing_info = self.detect_missing_info(text, location)
        
        # Generate suggested questions
        suggested_questions = self.generate_questions(text, best_category, missing_info)
        
        # Validate location
        location_data = self.validate_jharkhand_location(location) if location else {}
        
        return {
            'category': best_category,
            'confidence': confidence,
            'urgency_level': urgency_level,
            'sentiment': sentiment,
            'priority': self.determine_priority(urgency_level, best_category),
            'department': self.department_mapping.get(best_category, 'General Administration'),
            'keywords': category_scores.get(best_category, {}).get('keywords', []),
            'missing_info': missing_info,
            'suggested_questions': suggested_questions,
            'location_validation': location_data,
            'subcategory': self.suggest_subcategory(text, best_category),
            'estimated_resolution_time': self.estimate_resolution_time(best_category, urgency_level)
        }
    
    def calculate_urgency(self, text):
        """Calculate urgency level (1-10)"""
        urgency_score = 1
        
        for level, keywords in self.urgency_keywords.items():
            for keyword in keywords:
                if keyword in text:
                    if level == 'urgent':
                        urgency_score = max(urgency_score, 8)
                    elif level == 'high':
                        urgency_score = max(urgency_score, 6)
                    elif level == 'medium':
                        urgency_score = max(urgency_score, 4)
        
        # Boost urgency for health and safety issues
        if any(word in text for word in ['health', 'medical', 'safety', 'danger', 'emergency']):
            urgency_score = min(urgency_score + 2, 10)
        
        return urgency_score
    
    def analyze_sentiment(self, text):
        """Analyze sentiment of the complaint"""
        try:
            blob = TextBlob(text)
            polarity = blob.sentiment.polarity
            
            if polarity < -0.5:
                return 'angry'
            elif polarity < -0.1:
                return 'negative'
            elif polarity < 0.1:
                return 'neutral'
            else:
                return 'positive'
        except:
            return 'neutral'
    
    def detect_missing_info(self, text, location):
        """Detect what information might be missing"""
        missing = []
        text_lower = text.lower()
        
        # Check for location details
        if not location or len(location.strip()) < 5:
            missing.append('specific_location')
        
        # Check for time information
        if not any(word in text_lower for word in ['today', 'yesterday', 'morning', 'evening', 'night', 'afternoon', 'when', 'time']):
            missing.append('time_of_incident')
        
        # Check for contact information
        if not re.search(r'\d{10}', text):
            missing.append('contact_number')
        
        # Check for severity details
        if not any(word in text_lower for word in ['how many', 'extent', 'severity', 'impact', 'affected']):
            missing.append('impact_details')
        
        return missing
    
    def generate_questions(self, text, category, missing_info):
        """Generate relevant questions to gather more information"""
        questions = []
        
        if 'specific_location' in missing_info:
            questions.append("Could you provide the exact location or nearest landmark?")
        
        if 'time_of_incident' in missing_info:
            questions.append("When did you first notice this issue?")
        
        if 'impact_details' in missing_info:
            if category == 'Water Supply':
                questions.append("How many households are affected by this water issue?")
            elif category == 'Infrastructure':
                questions.append("Is this affecting vehicle movement or pedestrian safety?")
            elif category == 'Electricity':
                questions.append("How long has the power been out?")
        
        # Category-specific questions
        category_questions = {
            'Healthcare': ["Is this an emergency requiring immediate medical attention?"],
            'Public Safety': ["Have you reported this to the local police?"],
            'Environment': ["Do you have any photos showing the environmental impact?"],
            'Mining Issues': ["Are there any safety concerns for nearby residents?"]
        }
        
        if category in category_questions:
            questions.extend(category_questions[category])
        
        return questions[:3]  # Limit to 3 questions
    
    def validate_jharkhand_location(self, location_text):
        """Validate and enhance location information for Jharkhand"""
        if not location_text:
            return {'valid': False, 'suggestions': []}
        
        location_lower = location_text.lower()
        result = {
            'valid': False,
            'district': None,
            'suggestions': [],
            'coordinates': None,
            'type': None
        }
        
        # Check for district mentions
        for district in self.jharkhand_data['districts']:
            if district.lower() in location_lower:
                result['valid'] = True
                result['district'] = district
                result['coordinates'] = self.jharkhand_data['district_coordinates'].get(district)
                break
        
        # Check for specific area types
        if any(word in location_lower for word in ['mine', 'mining', 'coal']):
            result['type'] = 'mining'
            if not result['district']:
                result['suggestions'].extend(self.jharkhand_data['mining_districts'])
        
        elif any(word in location_lower for word in ['tribal', 'village', 'gram']):
            result['type'] = 'rural/tribal'
            if not result['district']:
                result['suggestions'].extend(self.jharkhand_data['tribal_districts'])
        
        elif any(word in location_lower for word in ['city', 'urban', 'municipality']):
            result['type'] = 'urban'
            if not result['district']:
                result['suggestions'].extend(self.jharkhand_data['urban_districts'])
        
        # If no district found, suggest based on common patterns
        if not result['valid']:
            # Look for partial matches
            for district in self.jharkhand_data['districts']:
                if any(part in location_lower for part in district.lower().split()):
                    result['suggestions'].append(district)
        
        return result
    
    def suggest_subcategory(self, text, category):
        """Suggest subcategory based on text analysis"""
        if category not in self.categories:
            return None
        
        subcategories = self.categories[category].get('subcategories', [])
        text_lower = text.lower()
        
        # Simple keyword matching for subcategories
        subcategory_keywords = {
            'Roads': ['road', 'street', 'pothole'],
            'Water Shortage': ['shortage', 'no water', 'dry'],
            'Power Outage': ['outage', 'blackout', 'no power'],
            'Hospital Services': ['hospital', 'doctor', 'treatment'],
            'Crime': ['theft', 'robbery', 'crime']
        }
        
        for subcat in subcategories:
            if subcat in subcategory_keywords:
                if any(keyword in text_lower for keyword in subcategory_keywords[subcat]):
                    return subcat
        
        return subcategories[0] if subcategories else None
    
    def determine_priority(self, urgency_level, category):
        """Determine priority based on urgency and category"""
        if urgency_level >= 8:
            return 'urgent'
        elif urgency_level >= 6:
            return 'high'
        elif urgency_level >= 4:
            return 'medium'
        else:
            return 'low'
    
    def estimate_resolution_time(self, category, urgency_level):
        """Estimate resolution time in hours"""
        base_times = {
            'Healthcare': 2,
            'Public Safety': 4,
            'Water Supply': 24,
            'Electricity': 12,
            'Infrastructure': 72,
            'Transportation': 48,
            'Sanitation': 24,
            'Environment': 48,
            'Education': 168,
            'Governance': 72
        }
        
        base_time = base_times.get(category, 48)
        
        # Adjust based on urgency
        if urgency_level >= 8:
            return base_time // 4
        elif urgency_level >= 6:
            return base_time // 2
        else:
            return base_time
    
    def find_similar_complaints(self, text, location):
        """Find similar complaints for potential upvoting"""
        # This would typically query a database
        # For now, return a mock structure
        return {
            'found_similar': False,
            'similar_complaints': [],
            'suggestion': 'No similar active complaints found. This will be registered as a new complaint.'
        }
    
    def enhance_with_ai(self, complaint):
        """Use AI to enhance complaint with additional insights"""
        if not openai.api_key:
            return complaint
        
        try:
            prompt = f"""
            Analyze this complaint and provide enhancements:
            
            Title: {complaint.get('title', '')}
            Description: {complaint.get('description', '')}
            Location: {complaint.get('location', '')}
            
            Provide suggestions for:
            1. Missing critical information
            2. Possible root causes
            3. Recommended immediate actions
            4. Stakeholders who should be involved
            
            Format as JSON with keys: missing_info, root_causes, immediate_actions, stakeholders
            """
            
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert in analyzing civic complaints for Jharkhand state, India."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=500,
                temperature=0.3
            )
            
            ai_enhancement = response.choices[0].message.content
            
            # Try to parse as JSON, fallback to text
            try:
                enhancement_data = json.loads(ai_enhancement)
            except:
                enhancement_data = {"ai_suggestions": ai_enhancement}
            
            return {**complaint, "ai_enhancement": enhancement_data}
            
        except Exception as e:
            logger.error(f"AI enhancement error: {str(e)}")
            return complaint
    
    def classify_with_openai(self, text):
        """Fallback classification using OpenAI"""
        if not openai.api_key:
            return {'category': 'Infrastructure', 'confidence': 0.5}
        
        try:
            categories_list = list(self.categories.keys())
            prompt = f"""
            Classify this complaint into one of these categories: {', '.join(categories_list)}
            
            Complaint: "{text}"
            
            Return only the category name.
            """
            
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a complaint classification system for Jharkhand state, India."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=50,
                temperature=0.1
            )
            
            predicted_category = response.choices[0].message.content.strip()
            
            if predicted_category in self.categories:
                return {'category': predicted_category, 'confidence': 0.8}
            else:
                return {'category': 'Infrastructure', 'confidence': 0.5}
                
        except Exception as e:
            logger.error(f"OpenAI classification error: {str(e)}")
            return {'category': 'Infrastructure', 'confidence': 0.5}
    
    def run(self, host='0.0.0.0', port=5000, debug=False):
        """Run the Flask application"""
        logger.info(f"Starting Enhanced RAG Classifier service on {host}:{port}")
        self.app.run(host=host, port=port, debug=debug)

if __name__ == '__main__':
    classifier = EnhancedRAGClassifier()
    # Use port 5000 for RAG classifier, regardless of PORT env var
    port = 5000
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    classifier.run(port=port, debug=debug)
