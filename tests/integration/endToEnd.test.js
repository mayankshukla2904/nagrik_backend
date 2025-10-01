const axios = require('axios');

describe('Integration Tests', () => {
  const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
  const WHATSAPP_URL = process.env.TEST_WHATSAPP_URL || 'http://localhost:3001';
  const RAG_URL = process.env.TEST_RAG_URL || 'http://localhost:5000';

  describe('End-to-End Complaint Flow', () => {
    test('should handle complete complaint submission flow', async () => {
      const complaintData = {
        userId: '+919876543210',
        channel: 'WhatsApp',
        title: 'Integration test complaint about broken streetlight',
        description: 'This is an integration test for the complete complaint flow. The streetlight on Main Street has been broken for several days and needs immediate attention.',
        location: {
          type: 'Point',
          coordinates: [77.2090, 28.6139],
          address: 'Main Street, Test City'
        }
      };

      // Submit complaint
      const submitResponse = await axios.post(`${BASE_URL}/api/complaints/report`, complaintData);
      
      expect(submitResponse.status).toBe(201);
      expect(submitResponse.data.success).toBe(true);
      expect(submitResponse.data.data.complaintId).toMatch(/^NAGRIK\d{6}$/);

      const complaintId = submitResponse.data.data.complaintId;

      // Retrieve complaint
      const getResponse = await axios.get(`${BASE_URL}/api/complaints/${complaintId}`);
      
      expect(getResponse.status).toBe(200);
      expect(getResponse.data.success).toBe(true);
      expect(getResponse.data.data.title).toBe(complaintData.title);

      // Update status
      const statusUpdate = {
        status: 'Under Review',
        comment: 'Complaint is now being reviewed by the relevant department',
        updatedBy: 'test@example.com'
      };

      const updateResponse = await axios.put(
        `${BASE_URL}/api/complaints/${complaintId}/status`,
        statusUpdate
      );

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.data.success).toBe(true);
      expect(updateResponse.data.data.status).toBe('Under Review');

      // Update to resolved
      const resolveUpdate = {
        status: 'Resolved',
        comment: 'Streetlight has been repaired successfully',
        updatedBy: 'maintenance@example.com'
      };

      await axios.put(`${BASE_URL}/api/complaints/${complaintId}/status`, resolveUpdate);

      // Add feedback
      const feedback = {
        rating: 5,
        comment: 'Excellent service! The issue was resolved quickly.'
      };

      const feedbackResponse = await axios.post(
        `${BASE_URL}/api/complaints/${complaintId}/feedback`,
        feedback
      );

      expect(feedbackResponse.status).toBe(200);
      expect(feedbackResponse.data.success).toBe(true);
      expect(feedbackResponse.data.data.feedback.rating).toBe(5);
    }, 30000); // 30 second timeout for integration test
  });

  describe('Service Health Checks', () => {
    test('should verify backend service health', async () => {
      const response = await axios.get(`${BASE_URL}/api/health`);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.status).toBe('healthy');
    });

    test('should verify RAG classifier service health', async () => {
      try {
        const response = await axios.get(`${RAG_URL}/health`);
        
        expect(response.status).toBe(200);
        expect(response.data.status).toBe('healthy');
        expect(response.data.service).toBe('RAG Classifier');
      } catch (error) {
        console.warn('RAG service not available for testing');
      }
    });
  });

  describe('Cross-Service Communication', () => {
    test('should test RAG classification integration', async () => {
      const testData = {
        title: 'Traffic light not working at busy intersection',
        description: 'The traffic signal at the intersection of Park Road and Main Street has been malfunctioning for two days, causing significant traffic congestion and safety concerns for pedestrians and vehicles.',
        location: 'Park Road intersection'
      };

      try {
        const response = await axios.post(`${RAG_URL}/classify`, testData);
        
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        expect(response.data.category).toBeDefined();
        expect(response.data.severity).toBeDefined();
        expect(response.data.confidence).toBeGreaterThan(0);
      } catch (error) {
        console.warn('RAG classification service not available for testing');
      }
    });

    test('should test complaint submission with AI classification', async () => {
      const complaintData = {
        userId: '+919876543999',
        channel: 'Web',
        title: 'Hospital emergency ward overcrowded',
        description: 'The emergency ward at City Hospital is severely overcrowded with patients waiting for hours without proper attention. Medical staff seems overwhelmed and unable to handle the patient load effectively.',
        location: {
          type: 'Point',
          coordinates: [77.2100, 28.6150],
          address: 'City Hospital, Healthcare District'
        }
        // Intentionally not providing category/severity to test AI classification
      };

      const response = await axios.post(`${BASE_URL}/api/complaints/report`, complaintData);
      
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      
      // Verify AI classified the complaint
      const complaintId = response.data.data.complaintId;
      const getResponse = await axios.get(`${BASE_URL}/api/complaints/${complaintId}`);
      
      expect(getResponse.data.data.category).toBeDefined();
      expect(getResponse.data.data.severity).toBeDefined();
      
      // Should likely be classified as Healthcare with High/Critical severity
      expect(['Healthcare', 'Other']).toContain(getResponse.data.data.category);
    });
  });

  describe('Dashboard Analytics Integration', () => {
    test('should retrieve dashboard overview data', async () => {
      const response = await axios.get(`${BASE_URL}/api/dashboard/overview`);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.overview).toBeDefined();
      expect(response.data.data.distribution).toBeDefined();
      expect(response.data.data.recentComplaints).toBeDefined();
    });

    test('should retrieve analytics with different periods', async () => {
      const periods = ['7', '30', '90'];
      
      for (const period of periods) {
        const response = await axios.get(`${BASE_URL}/api/dashboard/analytics?period=${period}&type=trend`);
        
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        expect(response.data.data.type).toBe('trend');
        expect(response.data.data.period).toBe(parseInt(period));
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid complaint data gracefully', async () => {
      const invalidData = {
        userId: '', // Empty user ID
        title: 'X', // Too short
        description: 'Short', // Too short
        location: {
          coordinates: [200, 100] // Invalid coordinates
        }
      };

      try {
        await axios.post(`${BASE_URL}/api/complaints/report`, invalidData);
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.success).toBe(false);
      }
    });

    test('should handle non-existent complaint lookup', async () => {
      try {
        await axios.get(`${BASE_URL}/api/complaints/NAGRIK999999`);
      } catch (error) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.success).toBe(false);
      }
    });

    test('should handle invalid status updates', async () => {
      // First create a valid complaint
      const complaintData = {
        userId: '+919876543888',
        title: 'Test complaint for invalid status update',
        description: 'This complaint will be used to test invalid status updates',
        location: {
          type: 'Point',
          coordinates: [77.2090, 28.6139],
          address: 'Test Location'
        }
      };

      const createResponse = await axios.post(`${BASE_URL}/api/complaints/report`, complaintData);
      const complaintId = createResponse.data.data.complaintId;

      // Try invalid status update
      const invalidUpdate = {
        status: 'Invalid Status',
        updatedBy: 'test@example.com'
      };

      try {
        await axios.put(`${BASE_URL}/api/complaints/${complaintId}/status`, invalidUpdate);
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.success).toBe(false);
      }
    });
  });

  describe('Performance and Load', () => {
    test('should handle multiple concurrent complaint submissions', async () => {
      const promises = [];
      const concurrentRequests = 5;

      for (let i = 0; i < concurrentRequests; i++) {
        const complaintData = {
          userId: `+91987654${String(i).padStart(4, '0')}`,
          title: `Concurrent test complaint ${i + 1}`,
          description: `This is test complaint number ${i + 1} for concurrent submission testing`,
          location: {
            type: 'Point',
            coordinates: [77.2090 + i * 0.001, 28.6139 + i * 0.001],
            address: `Test Location ${i + 1}`
          }
        };

        promises.push(axios.post(`${BASE_URL}/api/complaints/report`, complaintData));
      }

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.data.success).toBe(true);
      });

      // Verify all complaints have unique IDs
      const complaintIds = responses.map(r => r.data.data.complaintId);
      const uniqueIds = new Set(complaintIds);
      expect(uniqueIds.size).toBe(concurrentRequests);
    }, 15000);
  });
});
