const mongoose = require('mongoose');
const Issue = require('../models/Issue');
const User = require('../models/User');
require('dotenv').config();

async function fixReportersActive() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        console.log('Finding issues that need reporter fixes...');
        
        // Find all issues
        const issues = await Issue.find({}).populate('reportedBy', 'email name');
        
        console.log(`Found ${issues.length} issues to check`);
        
        let updatedCount = 0;
        
        for (const issue of issues) {
            let needsUpdate = false;
            
            // Ensure reporters array exists
            if (!Array.isArray(issue.reporters)) {
                issue.reporters = [];
                needsUpdate = true;
            }
            
            // Check if reportedBy user is in reporters array
            const reporterExists = issue.reporters.some(r => 
                r.user && r.user.toString() === issue.reportedBy._id.toString()
            );
            
            if (!reporterExists && issue.reportedBy) {
                console.log(`Adding original reporter to issue ${issue._id}: ${issue.reportedBy.name} (${issue.reportedBy.email})`);
                issue.reporters.push({
                    user: issue.reportedBy._id,
                    consent: true,
                    joinedAt: issue.createdAt || new Date(),
                    isActive: true // Set original reporter as active
                });
                needsUpdate = true;
            } else {
                // If reporter exists, make sure they're active
                const reporterIndex = issue.reporters.findIndex(r => 
                    r.user && r.user.toString() === issue.reportedBy._id.toString()
                );
                
                if (reporterIndex >= 0 && !issue.reporters[reporterIndex].isActive) {
                    console.log(`Setting original reporter as active for issue ${issue._id}: ${issue.reportedBy.name}`);
                    issue.reporters[reporterIndex].isActive = true;
                    needsUpdate = true;
                }
            }
            
            if (needsUpdate) {
                await issue.save();
                updatedCount++;
            }
        }
        
        console.log(`\n✅ Successfully updated ${updatedCount} issues`);
        console.log('All original reporters are now in the reporters array with isActive: true');
        
        // Show sample of updated issues
        const sampleIssue = await Issue.findOne({ 'reporters.isActive': true })
            .populate('reportedBy', 'email name')
            .populate('reporters.user', 'email name');
            
        if (sampleIssue) {
            console.log('\n📧 Sample issue with active reporters:');
            console.log('Issue ID:', sampleIssue._id);
            console.log('Title:', sampleIssue.title);
            console.log('Original Reporter:', sampleIssue.reportedBy?.name, '(' + sampleIssue.reportedBy?.email + ')');
            console.log('Reporters Array:');
            sampleIssue.reporters.forEach((reporter, index) => {
                console.log(`  ${index + 1}. ${reporter.user?.name} (${reporter.user?.email}) - Active: ${reporter.isActive}`);
            });
        }
        
    } catch (error) {
        console.error('Error fixing reporters:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the script
if (require.main === module) {
    fixReportersActive().then(() => {
        console.log('Script completed');
        process.exit(0);
    }).catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

module.exports = { fixReportersActive };