require('dotenv').config();
const mongoose = require('mongoose');
const Issue = require('../models/Issue');
const mailController = require('../controllers/mail.controller');
const { log } = require('../utils/logger');

async function testEmailForIssue() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const issueId = '68cfd75bc3cdc10c91a4c235';
        console.log('Testing email for issue:', issueId);

        // Call the mail controller directly
        const result = await mailController.sendIssueResolutionEmail(issueId, 'test-government-user');
        
        console.log('Email result:', result);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

testEmailForIssue();