const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const User = require('../models/User');

const sampleComplaints = [
  {
    complaintId: 'NGR001',
    title: 'Potholes on Main Road causing accidents',
    description: 'Multiple deep potholes on Main Road near market area are causing vehicle damage and accidents. Urgent repair needed.',
    category: 'infrastructure',
    subcategory: 'roads',
    location: {
      type: 'Point',
      coordinates: [85.3096, 23.3441],
      address: 'Main Road, Ranchi, Jharkhand'
    },
    status: 'under_review',
    priority: 'high',
    userId: '670123456789',
    channel: 'WhatsApp',
    department: 'Public Works Department',
    upvotes: 23,
    downvotes: 2,
    trending: true,
    tags: ['urgent', 'safety', 'infrastructure'],
    timeline: [
      {
        status: 'submitted',
        date: new Date('2025-01-05'),
        note: 'Complaint submitted via WhatsApp'
      },
      {
        status: 'acknowledged',
        date: new Date('2025-01-06'),
        note: 'Complaint acknowledged by PWD'
      },
      {
        status: 'under_review',
        date: new Date('2025-01-08'),
        note: 'Site inspection scheduled'
      }
    ]
  },
  {
    complaintId: 'NGR002',
    title: 'Irregular water supply in Sector 5',
    description: 'Water supply has been irregular for the past 2 weeks. Residents are facing severe water shortage.',
    category: 'utilities',
    subcategory: 'water_supply',
    location: {
      type: 'Point',
      coordinates: [85.3206, 23.3551],
      address: 'Sector 5, Ranchi, Jharkhand'
    },
    status: 'in_progress',
    priority: 'high',
    userId: '670123456790',
    channel: 'WhatsApp',
    department: 'Water and Sanitation Department',
    upvotes: 18,
    downvotes: 1,
    trending: true,
    tags: ['water', 'utilities', 'urgent'],
    timeline: [
      {
        status: 'submitted',
        date: new Date('2025-01-04'),
        note: 'Complaint submitted via WhatsApp'
      },
      {
        status: 'in_progress',
        date: new Date('2025-01-07'),
        note: 'Pipeline repair work started'
      }
    ]
  },
  {
    complaintId: 'NGR003',
    title: 'Street lights not working in residential area',
    description: 'Multiple street lights are not working in the residential area making it unsafe during night hours.',
    category: 'infrastructure',
    subcategory: 'electricity',
    location: {
      type: 'Point',
      coordinates: [85.2906, 23.3341],
      address: 'Residential Area, Kanke, Ranchi'
    },
    status: 'resolved',
    priority: 'medium',
    userId: '670123456791',
    channel: 'WhatsApp',
    department: 'Electricity Department',
    upvotes: 12,
    downvotes: 0,
    trending: false,
    tags: ['electricity', 'safety', 'infrastructure'],
    timeline: [
      {
        status: 'submitted',
        date: new Date('2025-01-02'),
        note: 'Complaint submitted via WhatsApp'
      },
      {
        status: 'in_progress',
        date: new Date('2025-01-04'),
        note: 'Electrical team dispatched'
      },
      {
        status: 'resolved',
        date: new Date('2025-01-06'),
        note: 'All street lights repaired and working'
      }
    ]
  },
  {
    complaintId: 'NGR004',
    title: 'Garbage not collected for a week',
    description: 'Municipal garbage collection has not happened in our area for over a week. Waste is accumulating.',
    category: 'sanitation',
    subcategory: 'waste_management',
    location: {
      type: 'Point',
      coordinates: [85.3306, 23.3641],
      address: 'Housing Colony, Bariatu, Ranchi'
    },
    status: 'acknowledged',
    priority: 'high',
    userId: '670123456792',
    channel: 'WhatsApp',
    department: 'Municipal Corporation',
    upvotes: 15,
    downvotes: 0,
    trending: true,
    tags: ['sanitation', 'health', 'urgent'],
    timeline: [
      {
        status: 'submitted',
        date: new Date('2025-01-07'),
        note: 'Complaint submitted via WhatsApp'
      },
      {
        status: 'acknowledged',
        date: new Date('2025-01-08'),
        note: 'Complaint acknowledged by Municipal Corporation'
      }
    ]
  },
  {
    complaintId: 'NGR005',
    title: 'Traffic signal malfunction at busy intersection',
    description: 'Traffic signal at the main intersection is not working properly causing traffic jams and safety issues.',
    category: 'infrastructure',
    subcategory: 'traffic',
    location: {
      type: 'Point',
      coordinates: [85.3196, 23.3491],
      address: 'Main Intersection, Albert Ekka Chowk, Ranchi'
    },
    status: 'under_review',
    priority: 'high',
    userId: '670123456793',
    channel: 'WhatsApp',
    department: 'Traffic Police',
    upvotes: 8,
    downvotes: 1,
    trending: false,
    tags: ['traffic', 'safety', 'infrastructure'],
    timeline: [
      {
        status: 'submitted',
        date: new Date('2025-01-08'),
        note: 'Complaint submitted via WhatsApp'
      },
      {
        status: 'under_review',
        date: new Date('2025-01-09'),
        note: 'Traffic police notified for inspection'
      }
    ]
  }
];

const sampleUsers = [
  {
    userId: '670123456789',
    name: 'Ravi Kumar',
    phone: '+91-9876543210',
    location: 'Ranchi, Jharkhand',
    complaintsSubmitted: 1,
    isVerified: true
  },
  {
    userId: '670123456790',
    name: 'Priya Singh',
    phone: '+91-9876543211',
    location: 'Ranchi, Jharkhand',
    complaintsSubmitted: 1,
    isVerified: true
  },
  {
    userId: '670123456791',
    name: 'Amit Sharma',
    phone: '+91-9876543212',
    location: 'Ranchi, Jharkhand',
    complaintsSubmitted: 1,
    isVerified: true
  },
  {
    userId: '670123456792',
    name: 'Sunita Devi',
    phone: '+91-9876543213',
    location: 'Ranchi, Jharkhand',
    complaintsSubmitted: 1,
    isVerified: true
  },
  {
    userId: '670123456793',
    name: 'Rohit Gupta',
    phone: '+91-9876543214',
    location: 'Ranchi, Jharkhand',
    complaintsSubmitted: 1,
    isVerified: true
  }
];

async function createSampleData() {
  try {
    console.log('🔄 Creating sample data...');
    
    // Clear existing data
    await Complaint.deleteMany({});
    await User.deleteMany({});
    
    // Create users
    await User.insertMany(sampleUsers);
    console.log('✅ Sample users created');
    
    // Create complaints
    await Complaint.insertMany(sampleComplaints);
    console.log('✅ Sample complaints created');
    
    console.log('🎉 Sample data creation completed successfully!');
    console.log(`📊 Created ${sampleUsers.length} users and ${sampleComplaints.length} complaints`);
    
    // Log statistics
    const totalComplaints = await Complaint.countDocuments();
    const resolvedComplaints = await Complaint.countDocuments({ status: 'resolved' });
    const trendingComplaints = await Complaint.countDocuments({ trending: true });
    
    console.log(`\n📈 Statistics:`);
    console.log(`Total Complaints: ${totalComplaints}`);
    console.log(`Resolved Complaints: ${resolvedComplaints}`);
    console.log(`Trending Complaints: ${trendingComplaints}`);
    
  } catch (error) {
    console.error('❌ Error creating sample data:', error);
    throw error;
  }
}

module.exports = createSampleData;

// If called directly
if (require.main === module) {
  const connectDB = require('../config/database');
  
  connectDB().then(() => {
    return createSampleData();
  }).then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('Failed to create sample data:', error);
    process.exit(1);
  });
}
