class CommunityFeatures {
  constructor(backendUrl) {
    this.backendUrl = backendUrl;
  }

  async handleCommunityCommands(jid, userId, message, whatsappService) {
    const text = message.toLowerCase().trim();
    
    if (text.includes('trending') || text.includes('popular')) {
      return await this.showTrendingComplaints(jid, whatsappService);
    }
    
    if (text.includes('upvote') || text.includes('support')) {
      return await this.handleUpvoteFlow(jid, userId, message, whatsappService);
    }
    
    if (text.includes('similar') || text.includes('duplicate')) {
      return await this.findSimilarComplaints(jid, message, whatsappService);
    }
    
    if (text.includes('community') || text.includes('stats')) {
      return await this.showCommunityStats(jid, whatsappService);
    }
  }

  async showTrendingComplaints(jid, whatsappService) {
    try {
      const response = await fetch(`${this.backendUrl}/api/complaints/enhanced?sortBy=upvoteCount&limit=5&minUpvotes=3`);
      const data = await response.json();
      
      if (!data.success || data.data.complaints.length === 0) {
        await whatsappService.sendMessage(jid, '📊 No trending complaints at the moment.\n\nBe the first to report issues and get community support!');
        return;
      }
      
      let message = '🔥 Trending Community Complaints:\n\n';
      
      data.data.complaints.forEach((complaint, index) => {
        const priority = complaint.priority === 'high' ? '🔴' : complaint.priority === 'medium' ? '🟡' : '🟢';
        message += `${index + 1}. ${priority} ${complaint.title.substring(0, 50)}${complaint.title.length > 50 ? '...' : ''}
👍 ${complaint.upvoteCount} upvotes | 🏛️ ${complaint.department || 'Pending'}
🆔 ${complaint.trackingNumber || complaint._id.slice(-6)}
📅 ${new Date(complaint.createdAt).toLocaleDateString('en-IN')}

`;
      });
      
      message += `💡 Type "upvote [complaint_id]" to support a complaint
🔍 Type "details [complaint_id]" for more information`;
      
      await whatsappService.sendMessage(jid, message);
      
    } catch (error) {
      console.error('Trending complaints error:', error);
      await whatsappService.sendMessage(jid, '❌ Error getting trending complaints.');
    }
  }

  async handleUpvoteFlow(jid, userId, message, whatsappService) {
    const text = message.trim();
    const upvoteMatch = text.match(/upvote\s+([A-Z0-9]+)/i);
    
    if (!upvoteMatch) {
      await whatsappService.sendMessage(jid, `👍 Upvote a Community Complaint:

Format: "upvote [complaint_id]"
Example: "upvote NAGRIK123456"

💡 Upvoting helps prioritize important issues and shows community support.

Type "trending" to see popular complaints you can support.`);
      return;
    }
    
    const complaintId = upvoteMatch[1];
    
    try {
      const response = await fetch(`${this.backendUrl}/api/complaints/${complaintId}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPhone: userId })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        if (data.error.includes('already upvoted')) {
          await whatsappService.sendMessage(jid, `✋ You've already supported this complaint: ${complaintId}

👍 Your previous upvote is helping prioritize this issue!

Type "trending" to see other complaints you can support.`);
        } else {
          await whatsappService.sendMessage(jid, `❌ ${data.error}\n\nPlease check the complaint ID and try again.`);
        }
        return;
      }
      
      const upvoteMessage = `✅ Successfully upvoted complaint ${complaintId}!

👍 New upvote count: ${data.data.upvoteCount}
🏷️ Title: ${data.data.title}
${data.data.priority === 'high' ? '🔴 Priority upgraded to HIGH!' : ''}

🙏 Thank you for supporting community issues!

Type "trending" to upvote more complaints.`;
      
      await whatsappService.sendMessage(jid, upvoteMessage);
      
      // If this upvote pushed the complaint to high priority, send notification
      if (data.data.priority === 'high' && data.data.upvoteCount >= 10) {
        await this.notifyPriorityEscalation(complaintId, data.data, whatsappService);
      }
      
    } catch (error) {
      console.error('Upvote error:', error);
      await whatsappService.sendMessage(jid, '❌ Error processing upvote. Please try again.');
    }
  }

  async findSimilarComplaints(jid, message, whatsappService) {
    // Extract complaint description or ID from message
    const searchText = message.replace(/similar|duplicate/gi, '').trim();
    
    if (searchText.length < 10) {
      await whatsappService.sendMessage(jid, `🔍 Find Similar Complaints:

Type: "similar [describe your issue]"
Example: "similar broken streetlight main road"

💡 This helps you:
• Find existing reports to upvote
• Avoid duplicate submissions
• Join community efforts`);
      return;
    }
    
    try {
      const response = await fetch(`${this.backendUrl}/api/complaints/find-similar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: searchText })
      });
      
      const data = await response.json();
      
      if (!data.success || !data.data.found) {
        await whatsappService.sendMessage(jid, `🔍 No similar complaints found for: "${searchText}"

✨ This seems like a new issue! Type "complaint" to be the first to report it.`);
        return;
      }
      
      let message = `🔍 Found ${data.data.count} similar complaint(s):\n\n`;
      
      data.data.complaints.forEach((complaint, index) => {
        message += `${index + 1}. ${complaint.title}
🆔 ${complaint.id}
👍 ${complaint.upvoteCount} upvotes
📊 Status: ${complaint.status}
🎯 Similarity: ${Math.round(complaint.similarity * 100)}%

`;
      });
      
      message += `💡 Actions:
• "upvote [id]" to support existing complaint
• "details [id]" for more information  
• "complaint" to file a new report anyway`;
      
      await whatsappService.sendMessage(jid, message);
      
    } catch (error) {
      console.error('Similar complaints error:', error);
      await whatsappService.sendMessage(jid, '❌ Error searching for similar complaints.');
    }
  }

  async showCommunityStats(jid, whatsappService) {
    try {
      const response = await fetch(`${this.backendUrl}/api/complaints/stats/enhanced`);
      const data = await response.json();
      
      if (!data.success) {
        await whatsappService.sendMessage(jid, '❌ Error getting community statistics.');
        return;
      }
      
      const stats = data.data;
      
      const statsMessage = `📊 NAGRIK Community Statistics

👥 Community Impact:
• 📋 Total Complaints: ${stats.overview.totalComplaints}
• 👍 Total Community Upvotes: ${stats.overview.totalUpvotes}
• 🔥 Popular Complaints: ${stats.overview.popularComplaints}
• ⚡ Trending (24h): ${stats.overview.trendingComplaints}

📈 Engagement:
• 🎯 Avg Upvotes per Complaint: ${stats.overview.avgUpvotesPerComplaint.toFixed(1)}
• 📊 Community Engagement Rate: ${(stats.engagement.upvotingRate * 100).toFixed(1)}%

🏆 Top Categories:
${stats.categories.slice(0, 3).map((cat, i) => 
  `${i + 1}. ${cat._id}: ${cat.count} complaints, ${cat.upvotes} upvotes`
).join('\n')}

🎯 Together we build a better Jharkhand! 

Type "trending" to see popular complaints or "complaint" to report new issues.`;
      
      await whatsappService.sendMessage(jid, statsMessage);
      
    } catch (error) {
      console.error('Community stats error:', error);
      await whatsappService.sendMessage(jid, '❌ Error getting community statistics.');
    }
  }

  async notifyPriorityEscalation(complaintId, complaint, whatsappService) {
    // This would notify the complaint creator about priority escalation
    // In a full implementation, you'd track the original submitter
    console.log(`Priority escalated for complaint ${complaintId} to HIGH due to ${complaint.upvoteCount} upvotes`);
  }

  async suggestSimilarDuringSubmission(complaintData, userId, whatsappService) {
    try {
      const response = await fetch(`${this.backendUrl}/api/complaints/find-similar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: `${complaintData.title} ${complaintData.description}`,
          location: complaintData.location
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.data.found && data.data.complaints.length > 0) {
        const jid = `${userId}@s.whatsapp.net`;
        
        let message = `🔍 Found similar complaint(s) before submitting:\n\n`;
        
        data.data.complaints.slice(0, 2).forEach((complaint, index) => {
          message += `${index + 1}. ${complaint.title}
🆔 ${complaint.id}
👍 ${complaint.upvoteCount} upvotes
📊 Status: ${complaint.status}

`;
        });
        
        message += `💡 Options:
1. "upvote [complaint_id]" - Support existing complaint
2. "proceed" - Submit new complaint anyway
3. "cancel" - Cancel submission

Choose wisely to avoid duplicates and strengthen community voice! 🏛️`;
        
        await whatsappService.sendMessage(jid, message);
        return true; // Indicates similar complaints were found
      }
      
      return false; // No similar complaints found
      
    } catch (error) {
      console.error('Error checking for similar complaints:', error);
      return false;
    }
  }
}

module.exports = CommunityFeatures;
