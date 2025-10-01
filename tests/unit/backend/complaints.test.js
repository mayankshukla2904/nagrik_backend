const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../backend/src/app');
const Complaint = require('../../backend/src/models/Complaint');
const User = require('../../backend/src/models/User');

describe('Complaint API', () => {
  let mongoServer;

  beforeAll(async () => {
    // Setup in-memory MongoDB for testing
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear database before each test
    await Complaint.deleteMany({});
    await User.deleteMany({});
  });

  describe('POST /api/complaints/report', () => {
    const validComplaintData = {
      userId: '+919876543210',
      channel: 'WhatsApp',
      title: 'Broken streetlight on Main Street',
      description: 'The streetlight at the corner of Main Street and Oak Avenue has been broken for the past week. This is causing safety issues for pedestrians walking at night.',
      category: 'Infrastructure',
      severity: 'Medium',
      location: {
        type: 'Point',
        coordinates: [77.2090, 28.6139],
        address: 'Main Street, New Delhi'
      }
    };

    test('should create a new complaint with valid data', async () => {
      const response = await request(app)
        .post('/api/complaints/report')
        .send(validComplaintData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.complaintId).toMatch(/^NAGRIK\d{6}$/);
      expect(response.body.data.status).toBe('submitted');

      // Verify complaint was saved to database
      const complaint = await Complaint.findOne({ complaintId: response.body.data.complaintId });
      expect(complaint).toBeTruthy();
      expect(complaint.title).toBe(validComplaintData.title);
    });

    test('should create user if not exists', async () => {
      await request(app)
        .post('/api/complaints/report')
        .send(validComplaintData)
        .expect(201);

      const user = await User.findOne({ userId: validComplaintData.userId });
      expect(user).toBeTruthy();
      expect(user.phoneNumber).toBe(validComplaintData.userId);
      expect(user.totalComplaints).toBe(1);
    });

    test('should fail with missing required fields', async () => {
      const invalidData = { ...validComplaintData };
      delete invalidData.title;

      const response = await request(app)
        .post('/api/complaints/report')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    test('should fail with invalid location coordinates', async () => {
      const invalidData = {
        ...validComplaintData,
        location: {
          ...validComplaintData.location,
          coordinates: [200, 100] // Invalid longitude/latitude
        }
      };

      const response = await request(app)
        .post('/api/complaints/report')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle title length validation', async () => {
      const shortTitle = { ...validComplaintData, title: 'Short' };
      
      await request(app)
        .post('/api/complaints/report')
        .send(shortTitle)
        .expect(400);

      const longTitle = { 
        ...validComplaintData, 
        title: 'A'.repeat(201) 
      };
      
      await request(app)
        .post('/api/complaints/report')
        .send(longTitle)
        .expect(400);
    });
  });

  describe('GET /api/complaints/:complaintId', () => {
    test('should retrieve complaint by ID', async () => {
      // Create a complaint first
      const complaint = new Complaint({
        userId: '+919876543210',
        channel: 'WhatsApp',
        title: 'Test complaint',
        description: 'This is a test complaint for retrieval',
        category: 'Infrastructure',
        severity: 'Medium',
        location: {
          type: 'Point',
          coordinates: [77.2090, 28.6139],
          address: 'Test Address'
        }
      });
      await complaint.save();

      const response = await request(app)
        .get(`/api/complaints/${complaint.complaintId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.complaintId).toBe(complaint.complaintId);
      expect(response.body.data.title).toBe(complaint.title);
    });

    test('should return 404 for non-existent complaint', async () => {
      const response = await request(app)
        .get('/api/complaints/NAGRIK999999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Complaint not found');
    });
  });

  describe('GET /api/complaints', () => {
    beforeEach(async () => {
      // Create test complaints
      const complaints = [
        {
          userId: '+919876543210',
          title: 'Infrastructure issue 1',
          description: 'Road problem causing traffic issues',
          category: 'Infrastructure',
          severity: 'High',
          location: { type: 'Point', coordinates: [77.2090, 28.6139] }
        },
        {
          userId: '+919876543211',
          title: 'Healthcare issue 1',
          description: 'Hospital equipment not working properly',
          category: 'Healthcare',
          severity: 'Critical',
          location: { type: 'Point', coordinates: [77.2100, 28.6140] }
        },
        {
          userId: '+919876543212',
          title: 'Infrastructure issue 2',
          description: 'Streetlight maintenance required urgently',
          category: 'Infrastructure',
          severity: 'Medium',
          location: { type: 'Point', coordinates: [77.2080, 28.6138] }
        }
      ];

      for (const complaintData of complaints) {
        const complaint = new Complaint(complaintData);
        await complaint.save();
      }
    });

    test('should retrieve all complaints with pagination', async () => {
      const response = await request(app)
        .get('/api/complaints')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.complaints).toHaveLength(3);
      expect(response.body.data.pagination.totalItems).toBe(3);
    });

    test('should filter by category', async () => {
      const response = await request(app)
        .get('/api/complaints?category=Infrastructure')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.complaints).toHaveLength(2);
      response.body.data.complaints.forEach(complaint => {
        expect(complaint.category).toBe('Infrastructure');
      });
    });

    test('should filter by severity', async () => {
      const response = await request(app)
        .get('/api/complaints?severity=Critical')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.complaints).toHaveLength(1);
      expect(response.body.data.complaints[0].severity).toBe('Critical');
    });

    test('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/complaints?page=1&limit=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.complaints).toHaveLength(2);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.totalPages).toBe(2);
    });
  });

  describe('PUT /api/complaints/:complaintId/status', () => {
    let complaint;

    beforeEach(async () => {
      complaint = new Complaint({
        userId: '+919876543210',
        title: 'Test complaint for status update',
        description: 'This complaint will be used to test status updates',
        category: 'Infrastructure',
        severity: 'Medium',
        location: { type: 'Point', coordinates: [77.2090, 28.6139] }
      });
      await complaint.save();
    });

    test('should update complaint status', async () => {
      const updateData = {
        status: 'In Progress',
        comment: 'Work has started on this issue',
        updatedBy: 'admin@example.com'
      };

      const response = await request(app)
        .put(`/api/complaints/${complaint.complaintId}/status`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('In Progress');

      // Verify database update
      const updatedComplaint = await Complaint.findOne({ complaintId: complaint.complaintId });
      expect(updatedComplaint.status).toBe('In Progress');
      expect(updatedComplaint.timeline).toHaveLength(2); // Initial + update
    });

    test('should fail with invalid status', async () => {
      const invalidData = {
        status: 'Invalid Status',
        updatedBy: 'admin@example.com'
      };

      const response = await request(app)
        .put(`/api/complaints/${complaint.complaintId}/status`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/complaints/:complaintId/feedback', () => {
    let resolvedComplaint;

    beforeEach(async () => {
      resolvedComplaint = new Complaint({
        userId: '+919876543210',
        title: 'Resolved complaint',
        description: 'This complaint has been resolved',
        category: 'Infrastructure',
        severity: 'Medium',
        status: 'Resolved',
        location: { type: 'Point', coordinates: [77.2090, 28.6139] }
      });
      await resolvedComplaint.save();
    });

    test('should add feedback to resolved complaint', async () => {
      const feedbackData = {
        rating: 4,
        comment: 'Issue was resolved quickly and efficiently'
      };

      const response = await request(app)
        .post(`/api/complaints/${resolvedComplaint.complaintId}/feedback`)
        .send(feedbackData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.feedback.rating).toBe(4);

      // Verify database update
      const updatedComplaint = await Complaint.findOne({ complaintId: resolvedComplaint.complaintId });
      expect(updatedComplaint.feedback.rating).toBe(4);
      expect(updatedComplaint.feedback.comment).toBe(feedbackData.comment);
    });

    test('should fail feedback on non-resolved complaint', async () => {
      const pendingComplaint = new Complaint({
        userId: '+919876543210',
        title: 'Pending complaint',
        description: 'This complaint is still pending',
        category: 'Infrastructure',
        severity: 'Medium',
        status: 'Submitted',
        location: { type: 'Point', coordinates: [77.2090, 28.6139] }
      });
      await pendingComplaint.save();

      const feedbackData = {
        rating: 4,
        comment: 'Good service'
      };

      const response = await request(app)
        .post(`/api/complaints/${pendingComplaint.complaintId}/feedback`)
        .send(feedbackData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('resolved complaints');
    });
  });
});
