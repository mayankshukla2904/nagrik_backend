const classificationService = require('../../backend/src/services/classificationService');

// Mock axios for external API calls
jest.mock('axios');
const axios = require('axios');

describe('Classification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('keywordBasedClassification', () => {
    test('should classify infrastructure complaint correctly', async () => {
      const result = await classificationService.keywordBasedClassification({
        title: 'Broken road near my house',
        description: 'There is a big pothole on the main road that is causing traffic problems and accidents'
      });

      expect(result.category).toBe('Infrastructure');
      expect(result.severity).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.processedBy).toBe('keyword');
    });

    test('should classify healthcare complaint correctly', async () => {
      const result = await classificationService.keywordBasedClassification({
        title: 'Hospital emergency services not working',
        description: 'The emergency ward at the local hospital is not functioning properly and patients are being turned away'
      });

      expect(result.category).toBe('Healthcare');
      expect(result.severity).toBe('Critical'); // Should detect emergency keywords
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should handle unknown category complaints', async () => {
      const result = await classificationService.keywordBasedClassification({
        title: 'Random complaint about something',
        description: 'This is a complaint that does not fit into any specific category'
      });

      expect(result.category).toBe('Other');
      expect(result.severity).toBeDefined();
      expect(result.confidence).toBeDefined();
    });

    test('should detect critical severity for emergency keywords', async () => {
      const result = await classificationService.keywordBasedClassification({
        title: 'Emergency situation needs immediate attention',
        description: 'This is a critical emergency that requires urgent response from authorities'
      });

      expect(result.severity).toBe('Critical');
    });
  });

  describe('callOpenAI', () => {
    test('should classify complaint using OpenAI API', async () => {
      // Mock successful OpenAI response
      const mockResponse = {
        data: {
          choices: [{
            message: {
              content: JSON.stringify({
                category: 'Transportation',
                severity: 'High',
                confidence: 0.9,
                reasoning: 'Traffic safety issue requiring immediate attention',
                extractedInfo: {
                  urgency_keywords: ['traffic', 'accident', 'dangerous'],
                  location_specifics: 'highway intersection',
                  affected_people: 'daily commuters',
                  timeline: 'last week'
                }
              })
            }
          }]
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await classificationService.callOpenAI({
        title: 'Dangerous traffic situation at highway intersection',
        description: 'There have been multiple accidents at this intersection last week affecting daily commuters',
        location: 'Highway 1 intersection'
      });

      expect(result.category).toBe('Transportation');
      expect(result.severity).toBe('High');
      expect(result.confidence).toBe(0.9);
      expect(result.extractedInfo).toBeDefined();
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.any(Object),
        expect.any(Object)
      );
    });

    test('should handle OpenAI API errors gracefully', async () => {
      axios.post.mockRejectedValue(new Error('API Error'));

      await expect(classificationService.callOpenAI({
        title: 'Test complaint',
        description: 'Test description'
      })).rejects.toThrow('API Error');
    });

    test('should handle invalid OpenAI response format', async () => {
      const mockResponse = {
        data: {
          choices: [{
            message: {
              content: 'Invalid JSON response'
            }
          }]
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      await expect(classificationService.callOpenAI({
        title: 'Test complaint',
        description: 'Test description'
      })).rejects.toThrow();
    });
  });

  describe('classifyComplaint', () => {
    test('should use keyword classification for high confidence results', async () => {
      const result = await classificationService.classifyComplaint({
        title: 'Road construction blocking traffic for infrastructure maintenance',
        description: 'Major road infrastructure work is blocking traffic and causing problems for street access and bridge maintenance'
      });

      expect(result.category).toBe('Infrastructure');
      expect(result.processedBy).toBe('keyword');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should fallback to keyword classification when OpenAI fails', async () => {
      // Mock OpenAI failure
      axios.post.mockRejectedValue(new Error('OpenAI API Error'));

      const result = await classificationService.classifyComplaint({
        title: 'Healthcare emergency at hospital',
        description: 'Medical emergency situation at the local hospital requiring immediate attention'
      });

      expect(result.category).toBe('Healthcare');
      expect(result.processedBy).toBe('keyword');
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should use OpenAI for low confidence keyword results', async () => {
      // Mock successful OpenAI response
      const mockResponse = {
        data: {
          choices: [{
            message: {
              content: JSON.stringify({
                category: 'Governance',
                severity: 'Medium',
                confidence: 0.85,
                reasoning: 'Administrative service complaint',
                extractedInfo: {}
              })
            }
          }]
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      // Use a complaint that would have low keyword confidence
      const result = await classificationService.classifyComplaint({
        title: 'Service issue at government office',
        description: 'Had some problems with the administrative process at the local government office'
      });

      expect(result.processedBy).toBe('openai');
      expect(axios.post).toHaveBeenCalled();
    });
  });

  describe('RAG service integration', () => {
    test('should call RAG service successfully', async () => {
      const mockRagResponse = {
        data: {
          success: true,
          category: 'Environment',
          severity: 'High',
          confidence: 0.85,
          extractedInfo: {
            method: 'rag',
            keywords: ['pollution', 'waste']
          }
        }
      };

      axios.post.mockResolvedValue(mockRagResponse);

      const result = await classificationService.callRagService({
        title: 'Pollution problem in the area',
        description: 'There is severe air pollution and waste management issues in our locality'
      });

      expect(result.success).toBe(true);
      expect(result.category).toBe('Environment');
      expect(result.severity).toBe('High');
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/classify'),
        expect.any(Object),
        expect.any(Object)
      );
    });

    test('should handle RAG service unavailability', async () => {
      axios.post.mockRejectedValue(new Error('Connection refused'));

      await expect(classificationService.callRagService({
        title: 'Test',
        description: 'Test'
      })).rejects.toThrow('Connection refused');
    });
  });
});
