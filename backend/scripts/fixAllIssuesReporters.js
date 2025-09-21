require('dotenv').config();
const mongoose = require('mongoose');
const Issue = require('../models/Issue');
const User = require('../models/User');
const { log } = require('../utils/logger');

async function fixAllIssuesReporters() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        console.log('\n=== FIXING ALL ISSUES REPORTERS ===');

        // Find all issues where reportedBy is not in reporters array or not active
        const issues = await Issue.find({}).populate('reportedBy', 'name email').exec();
        
        console.log(`Found ${issues.length} total issues to check`);
        
        let fixedCount = 0;
        let alreadyCorrectCount = 0;

        for (const issue of issues) {
            const reportedByInReporters = issue.reporters.find(r => 
                r.user.toString() === issue.reportedBy._id.toString()
            );
            
            let needsUpdate = false;
            
            if (!reportedByInReporters) {
                console.log(`🔧 FIXING Issue ${issue._id}: Adding reportedBy to reporters array`);
                issue.reporters.push({
                    user: issue.reportedBy._id,
                    consent: true,
                    isActive: true,
                    joinedAt: issue.createdAt || new Date()
                });
                needsUpdate = true;
            } else if (!reportedByInReporters.isActive) {
                console.log(`🔧 FIXING Issue ${issue._id}: Setting reportedBy as active`);
                reportedByInReporters.isActive = true;
                needsUpdate = true;
            }

            if (needsUpdate) {
                await issue.save();
                fixedCount++;
            } else {
                alreadyCorrectCount++;
            }
        }

        console.log('\n=== SUMMARY ===');
        console.log(`✅ Fixed: ${fixedCount} issues`);
        console.log(`✅ Already correct: ${alreadyCorrectCount} issues`);
        console.log(`📊 Total processed: ${issues.length} issues`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

fixAllIssuesReporters();