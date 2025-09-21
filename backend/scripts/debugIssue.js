require('dotenv').config();
const mongoose = require('mongoose');
const Issue = require('../models/Issue');
const User = require('../models/User');
const { log, error } = require('../utils/logger');

async function debugIssue() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Check the specific issue mentioned
        const issueId = '68cfd75bc3cdc10c91a4c235';
        console.log('\n=== DEBUGGING ISSUE ===');
        console.log('Issue ID:', issueId);

        const issue = await Issue.findById(issueId).populate('reportedBy', 'name email').exec();
        
        if (!issue) {
            console.log('❌ Issue not found');
            return;
        }

        console.log('\n--- Issue Details ---');
        console.log('Title:', issue.title);
        console.log('ReportedBy ID:', issue.reportedBy._id.toString());
        console.log('ReportedBy Email:', issue.reportedBy.email);
        console.log('ReportedBy Name:', issue.reportedBy.name);
        
        console.log('\n--- Location Details ---');
        console.log('Location Object:', JSON.stringify(issue.location, null, 2));
        
        console.log('\n--- Reporters Array ---');
        console.log('Reporters Length:', issue.reporters.length);
        issue.reporters.forEach((reporter, index) => {
            console.log(`Reporter ${index + 1}:`, {
                user: reporter.user.toString(),
                consent: reporter.consent,
                isActive: reporter.isActive,
                joinedAt: reporter.joinedAt
            });
        });

        // Check if reportedBy user is in reporters array
        const reportedByInReporters = issue.reporters.find(r => 
            r.user.toString() === issue.reportedBy._id.toString()
        );
        
        console.log('\n--- Analysis ---');
        console.log('ReportedBy in reporters array:', !!reportedByInReporters);
        if (reportedByInReporters) {
            console.log('ReportedBy isActive:', reportedByInReporters.isActive);
            console.log('ReportedBy consent:', reportedByInReporters.consent);
        }

        // Check if user has email
        const reportedByUser = await User.findById(issue.reportedBy._id);
        console.log('ReportedBy user has email:', !!reportedByUser.email);
        console.log('ReportedBy user email:', reportedByUser.email);

        // Fix the issue if needed
        let needsUpdate = false;
        
        if (!reportedByInReporters) {
            console.log('\n🔧 FIXING: Adding reportedBy to reporters array');
            issue.reporters.push({
                user: issue.reportedBy._id,
                consent: true,
                isActive: true,
                joinedAt: new Date()
            });
            needsUpdate = true;
        } else if (!reportedByInReporters.isActive) {
            console.log('\n🔧 FIXING: Setting reportedBy as active');
            reportedByInReporters.isActive = true;
            needsUpdate = true;
        }

        if (needsUpdate) {
            await issue.save();
            console.log('✅ Issue updated successfully');
        } else {
            console.log('✅ Issue is already correctly configured');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

debugIssue();