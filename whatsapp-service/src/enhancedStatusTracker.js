class EnhancedStatusTracker {
  constructor(backendUrl) {
    this.backendUrl = backendUrl;
    this.statusSubscriptions = new Map(); // userId -> [complaintIds]
  }

  async handleStatusInquiry(jid, userId, message, session, whatsappService) {
    const text = message.toLowerCase().trim();
    
    // Handle complaint ID input
    if (text.match(/^nagrik\d{6}$/)) {
      return await this.getComplaintStatus(jid, text, whatsappService);
    }
    
    // Handle "latest" request
    if (text === 'latest' || text === 'recent') {
      return await this.getLatestComplaints(jid, userId, whatsappService);
    }
    
    // Handle "all" or "my complaints"
    if (text === 'all' || text.includes('my complaints')) {
      return await this.getAllUserComplaints(jid, userId, whatsappService);
    }
    
    // Default status inquiry help
    await whatsappService.sendMessage(jid, `🔍 Check Complaint Status:

Options:
1. Type your Complaint ID (e.g., NAGRIK123456)
2. Type "latest" for your recent complaint
3. Type "all" for all your complaints
4. Type "subscribe" to get automatic updates

Example: NAGRIK123456`);
  }

  async getComplaintStatus(jid, complaintId, whatsappService) {
    try {
      const response = await fetch(`${this.backendUrl}/api/complaints/${complaintId}`);
      const data = await response.json();
      
      if (!data.success) {
        await whatsappService.sendMessage(jid, `❌ Complaint not found: ${complaintId}\n\nPlease check the ID and try again.`);
        return;
      }
      
      const complaint = data.data;
      const statusMessage = this.formatStatusMessage(complaint);
      await whatsappService.sendMessage(jid, statusMessage);
      
      // Offer to subscribe to updates
      await whatsappService.sendMessage(jid, `🔔 Would you like to receive automatic updates for this complaint?\n\nReply "yes" to subscribe or "no" to skip.`);
      
    } catch (error) {
      console.error('Status inquiry error:', error);
      await whatsappService.sendMessage(jid, '❌ Error checking status. Please try again later.');
    }
  }

  async getLatestComplaints(jid, userId, whatsappService) {
    try {
      const response = await fetch(`${this.backendUrl}/api/complaints?userId=${userId}&limit=3&sortBy=createdAt&sortOrder=desc`);
      const data = await response.json();
      
      if (!data.success || data.data.complaints.length === 0) {
        await whatsappService.sendMessage(jid, '📋 No complaints found for your number.\n\nTo file a new complaint, type "complaint".');
        return;
      }
      
      let message = '📋 Your Recent Complaints:\n\n';
      
      data.data.complaints.forEach((complaint, index) => {
        message += `${index + 1}. ${this.formatShortStatus(complaint)}\n\n`;
      });
      
      message += '💡 Type complaint ID for detailed status or "complaint" for new report.';
      
      await whatsappService.sendMessage(jid, message);
      
    } catch (error) {
      console.error('Latest complaints error:', error);
      await whatsappService.sendMessage(jid, '❌ Error retrieving complaints. Please try again later.');
    }
  }

  formatStatusMessage(complaint) {
    const statusEmojis = {
      'open': '🆕',
      'in_progress': '⏳', 
      'under_review': '👀',
      'resolved': '✅',
      'closed': '🔒',
      'rejected': '❌'
    };
    
    const priorityEmojis = {
      'low': '🟢',
      'medium': '🟡', 
      'high': '🔴',
      'urgent': '🚨'
    };
    
    return `📋 Complaint Status Report

🆔 ID: ${complaint.trackingNumber || complaint._id}
${statusEmojis[complaint.status] || '📄'} Status: ${complaint.status.replace('_', ' ').toUpperCase()}
${priorityEmojis[complaint.priority] || '⚪'} Priority: ${complaint.priority.toUpperCase()}

📝 Title: ${complaint.title}
🏛️ Department: ${complaint.department || 'Pending Assignment'}
📅 Filed: ${new Date(complaint.createdAt).toLocaleDateString('en-IN')}
📅 Updated: ${new Date(complaint.updatedAt).toLocaleDateString('en-IN')}

${complaint.upvoteCount ? `👍 Community Support: ${complaint.upvoteCount} upvotes\n` : ''}
${complaint.classification?.estimatedResolutionTime ? `⏱️ Estimated Resolution: ${complaint.classification.estimatedResolutionTime} days\n` : ''}

${this.getStatusDescription(complaint.status)}

${complaint.statusHistory?.length > 0 ? this.formatStatusHistory(complaint.statusHistory) : ''}`;
  }

  formatShortStatus(complaint) {
    const statusEmojis = {
      'open': '🆕',
      'in_progress': '⏳',
      'resolved': '✅',
      'closed': '🔒'
    };
    
    return `${statusEmojis[complaint.status] || '📄'} ${complaint.trackingNumber || complaint._id.slice(-6)}
${complaint.title.substring(0, 40)}${complaint.title.length > 40 ? '...' : ''}
Status: ${complaint.status.replace('_', ' ')}`;
  }

  getStatusDescription(status) {
    const descriptions = {
      'open': '📬 Your complaint has been received and is pending review.',
      'under_review': '👀 Your complaint is being reviewed by the relevant department.',
      'in_progress': '⚙️ Action is being taken to resolve your complaint.',
      'resolved': '✅ Your complaint has been resolved. Thank you for your patience.',
      'closed': '🔒 This complaint has been closed.',
      'rejected': '❌ Your complaint could not be processed. Contact support for details.'
    };
    
    return descriptions[status] || '📄 Status updated.';
  }

  formatStatusHistory(history) {
    if (!history || history.length === 0) return '';
    
    let historyText = '\n📈 Recent Updates:\n';
    
    history.slice(-3).forEach(update => {
      historyText += `• ${new Date(update.timestamp).toLocaleDateString('en-IN')}: ${update.status}\n`;
      if (update.comment) {
        historyText += `  💬 ${update.comment}\n`;
      }
    });
    
    return historyText;
  }

  async subscribeToUpdates(userId, complaintId) {
    if (!this.statusSubscriptions.has(userId)) {
      this.statusSubscriptions.set(userId, []);
    }
    
    const userSubscriptions = this.statusSubscriptions.get(userId);
    if (!userSubscriptions.includes(complaintId)) {
      userSubscriptions.push(complaintId);
      return true;
    }
    return false;
  }

  async sendStatusUpdate(userId, complaint, whatsappService) {
    if (!this.statusSubscriptions.has(userId)) return;
    
    const userSubscriptions = this.statusSubscriptions.get(userId);
    if (!userSubscriptions.includes(complaint._id)) return;
    
    const jid = `${userId}@s.whatsapp.net`;
    const updateMessage = `🔔 Status Update - ${complaint.trackingNumber}

${this.formatStatusMessage(complaint)}

Reply "unsubscribe ${complaint.trackingNumber}" to stop notifications.`;
    
    await whatsappService.sendMessage(jid, updateMessage);
  }

  async getComplaintAnalytics(jid, userId, whatsappService) {
    try {
      const response = await fetch(`${this.backendUrl}/api/complaints/analytics?userId=${userId}`);
      const data = await response.json();
      
      if (!data.success) {
        await whatsappService.sendMessage(jid, '❌ Error getting analytics.');
        return;
      }
      
      const analytics = data.data;
      
      const analyticsMessage = `📊 Your Complaint Analytics

📋 Total Complaints: ${analytics.total}
✅ Resolved: ${analytics.resolved}
⏳ In Progress: ${analytics.inProgress}
🆕 Open: ${analytics.open}

📈 Resolution Rate: ${analytics.resolutionRate}%
⏱️ Avg Resolution Time: ${analytics.avgResolutionTime} days

🏆 Most Active Category: ${analytics.topCategory}
📅 First Complaint: ${new Date(analytics.firstComplaint).toLocaleDateString('en-IN')}

Keep using NAGRIK to build a better community! 🏛️`;
      
      await whatsappService.sendMessage(jid, analyticsMessage);
      
    } catch (error) {
      console.error('Analytics error:', error);
      await whatsappService.sendMessage(jid, '❌ Error getting analytics. Please try again later.');
    }
  }
}

module.exports = EnhancedStatusTracker;
