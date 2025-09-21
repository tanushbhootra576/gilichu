const mongoose = require('mongoose');
const Issue = require('../models/Issue');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/civic-pulse');
        console.log('✅ Connected to MongoDB for testing');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

// Test script to set reporters as active and test email functionality
const testEmailFunctionality = async () => {
    try {
        await connectDB();

        console.log('🔍 Finding issues with reporters...');

        // Find issues that have reporters
        const issuesWithReporters = await Issue.find({
            'reporters.0': { $exists: true }
        }).populate('reporters.user', 'name email').limit(5);

        console.log(`📋 Found ${issuesWithReporters.length} issues with reporters`);

        if (issuesWithReporters.length === 0) {
            console.log('❌ No issues with reporters found. Creating test data might be needed.');
            return;
        }

        // Update reporters to be active for testing
        for (const issue of issuesWithReporters) {
            console.log(`\n📝 Issue: ${issue.title}`);
            console.log(`🔄 Updating ${issue.reporters.length} reporters to active status...`);

            // Update each reporter to be active
            const updateResult = await Issue.updateOne(
                { _id: issue._id },
                {
                    $set: {
                        'reporters.$[].isActive': true
                    }
                }
            );

            console.log(`✅ Updated reporters for issue ${issue._id}: ${updateResult.modifiedCount} modified`);

            // Display reporter information
            issue.reporters.forEach((reporter, index) => {
                console.log(`   Reporter ${index + 1}: ${reporter.user?.name || 'Unknown'} (${reporter.user?.email || 'No email'})`);
            });
        }

        console.log('\n🎯 Email functionality test completed!');
        console.log('\n📧 To test email sending:');
        console.log('1. Start your backend server');
        console.log('2. Use a government user to update an issue status to "resolved"');
        console.log('3. Check the console logs for email sending results');
        console.log('4. Or use the test endpoint: POST /api/mail/send-resolution-email/:issueId');

        // Display first issue for testing
        if (issuesWithReporters.length > 0) {
            const firstIssue = issuesWithReporters[0];
            console.log(`\n🧪 Test with issue ID: ${firstIssue._id}`);
            console.log(`   Title: ${firstIssue.title}`);
            console.log(`   Reporters count: ${firstIssue.reporters.length}`);
        }

    } catch (error) {
        console.error('❌ Error in test script:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
};

// Additional utility function to check reporter status
const checkReporterStatus = async () => {
    try {
        await connectDB();

        const issuesWithActiveReporters = await Issue.aggregate([
            { $match: { 'reporters.0': { $exists: true } } },
            { $unwind: '$reporters' },
            { $match: { 'reporters.isActive': true } },
            { $group: {
                _id: '$_id',
                title: { $first: '$title' },
                activeReporters: { $push: '$reporters' },
                activeCount: { $sum: 1 }
            }},
            { $limit: 10 }
        ]);

        console.log(`📊 Found ${issuesWithActiveReporters.length} issues with active reporters:`);
        
        issuesWithActiveReporters.forEach((issue, index) => {
            console.log(`${index + 1}. ${issue.title} - ${issue.activeCount} active reporters`);
        });

    } catch (error) {
        console.error('❌ Error checking reporter status:', error);
    } finally {
        await mongoose.disconnect();
    }
};

// Run the test
if (require.main === module) {
    const action = process.argv[2];
    
    if (action === 'check') {
        console.log('🔍 Checking active reporter status...\n');
        checkReporterStatus();
    } else {
        console.log('🚀 Starting email functionality test...\n');
        testEmailFunctionality();
    }
}

module.exports = {
    testEmailFunctionality,
    checkReporterStatus
};