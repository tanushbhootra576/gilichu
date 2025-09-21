require('dotenv').config();
const mongoose = require('mongoose');
const mailController = require('../controllers/mail.controller');

async function testMultiReporterEmail() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Test with a multi-reporter issue
        const issueId = '68cfe0c09603dcdb8323f2c3'; // Second issue (Pothole) with 2 reporters
        
        console.log('🧪 Testing multi-reporter email for issue:', issueId);
        console.log('📧 Should send to both rakshithganjimut@gmail.com and tanush.bhootra2024@vitstudent.ac.in');
        
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

        console.log('\n🎯 Both email addresses should now have received beautiful resolution notifications!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

testMultiReporterEmail();