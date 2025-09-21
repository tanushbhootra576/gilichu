require('dotenv').config();
const mongoose = require('mongoose');
const mailController = require('../controllers/mail.controller');

async function testSingleIssueEmail() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Test with one of the created issues
        const issueId = '68cfe0c09603dcdb8323f2be'; // First issue from the test
        
        console.log('🧪 Testing email for issue:', issueId);
        console.log('📧 Using updated email utility with Gmail detection...');
        
        const result = await mailController.sendIssueResolutionEmail(issueId, 'test-government-user');
        
        console.log('\n📊 Email Result:', {
            success: result.success,
            totalReporters: result.totalReporters,
            successCount: result.successCount,
            failureCount: result.failureCount
        });
        
        if (result.results) {
            console.log('\n📋 Detailed Results:');
            result.results.forEach((emailResult, index) => {
                if (emailResult.success) {
                    console.log(`✅ Email ${index + 1}: Successfully sent to ${emailResult.email}`);
                } else {
                    console.log(`❌ Email ${index + 1}: Failed to send to ${emailResult.email}`);
                    console.log(`   Error: ${emailResult.error}`);
                }
            });
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

testSingleIssueEmail();