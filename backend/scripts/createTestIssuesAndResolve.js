require('dotenv').config();
const mongoose = require('mongoose');
const Issue = require('../models/Issue');
const User = require('../models/User');
const { log } = require('../utils/logger');

async function createTestIssuesAndResolve() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find or create test users
        console.log('\n=== SETTING UP TEST USERS ===');
        
        let user1 = await User.findOne({ email: 'rakshithganjimut@gmail.com' });
        if (!user1) {
            user1 = new User({
                name: 'Rakshith Ganjimut',
                email: 'rakshithganjimut@gmail.com',
                phone: '+919876543210',
                role: 'citizen',
                password: 'hashedpassword123' // In real app, this would be properly hashed
            });
            await user1.save();
            console.log('✅ Created user: Rakshith Ganjimut');
        } else {
            console.log('✅ Found user: Rakshith Ganjimut');
        }

        let user2 = await User.findOne({ email: 'tanush.bhootra2024@vitstudent.ac.in' });
        if (!user2) {
            user2 = new User({
                name: 'Tanush Bhootra',
                email: 'tanush.bhootra2024@vitstudent.ac.in',
                phone: '+919876543211',
                role: 'citizen',
                password: 'hashedpassword123'
            });
            await user2.save();
            console.log('✅ Created user: Tanush Bhootra');
        } else {
            console.log('✅ Found user: Tanush Bhootra');
        }

        // Test issues data
        const testIssues = [
            {
                title: 'Broken Street Light on MG Road',
                description: 'The street light near bus stop 15 on MG Road has been non-functional for 3 days, causing safety concerns for pedestrians.',
                category: 'Street Lighting',
                location: {
                    type: 'Point',
                    coordinates: [77.5946, 12.9716], // Bangalore coordinates
                    address: 'MG Road, Bus Stop 15, Bangalore',
                    city: 'Bangalore',
                    state: 'Karnataka',
                    pincode: '560001'
                },
                images: ['https://example.com/streetlight1.jpg'],
                reportedBy: user1._id,
                reporters: [{
                    user: user1._id,
                    consent: true,
                    isActive: true,
                    joinedAt: new Date()
                }] // Single reporter
            },
            {
                title: 'Pothole on Whitefield Main Road',
                description: 'Large pothole causing vehicle damage and traffic slowdown near ITPL gate.',
                category: 'Roads & Infrastructure',
                location: {
                    type: 'Point',
                    coordinates: [77.7500, 12.9698],
                    address: 'Whitefield Main Road, near ITPL, Bangalore',
                    city: 'Bangalore',
                    state: 'Karnataka',
                    pincode: '560066'
                },
                images: ['https://example.com/pothole1.jpg', 'https://example.com/pothole2.jpg'],
                reportedBy: user2._id,
                reporters: [
                    {
                        user: user2._id,
                        consent: true,
                        isActive: true,
                        joinedAt: new Date()
                    },
                    {
                        user: user1._id,
                        consent: true,
                        isActive: true,
                        joinedAt: new Date(Date.now() + 60000) // 1 minute later
                    }
                ] // Two reporters
            },
            {
                title: 'Garbage Collection Issue in HSR Layout',
                description: 'Garbage has not been collected for 5 days in Sector 2, Block A. Causing health hazards and bad smell.',
                category: 'Waste Management',
                location: {
                    type: 'Point',
                    coordinates: [77.6413, 12.9082],
                    address: 'HSR Layout Sector 2, Block A, Bangalore',
                    city: 'Bangalore',
                    state: 'Karnataka',
                    pincode: '560102'
                },
                images: ['https://example.com/garbage1.jpg'],
                reportedBy: user1._id,
                reporters: [{
                    user: user1._id,
                    consent: true,
                    isActive: true,
                    joinedAt: new Date()
                }] // Single reporter
            },
            {
                title: 'Water Supply Disruption in Koramangala',
                description: 'No water supply for the past 2 days in Koramangala 4th Block. Residents facing severe inconvenience.',
                category: 'Water Supply',
                location: {
                    type: 'Point',
                    coordinates: [77.6269, 12.9279],
                    address: 'Koramangala 4th Block, Bangalore',
                    city: 'Bangalore',
                    state: 'Karnataka',
                    pincode: '560034'
                },
                images: ['https://example.com/water1.jpg'],
                reportedBy: user2._id,
                reporters: [
                    {
                        user: user2._id,
                        consent: true,
                        isActive: true,
                        joinedAt: new Date()
                    },
                    {
                        user: user1._id,
                        consent: true,
                        isActive: true,
                        joinedAt: new Date(Date.now() + 120000) // 2 minutes later
                    }
                ] // Two reporters
            },
            {
                title: 'Sewage Overflow in Indiranagar',
                description: 'Sewage overflowing on 100 Feet Road causing health hazards and traffic disruption.',
                category: 'Sewage & Drainage',
                location: {
                    type: 'Point',
                    coordinates: [77.6413, 12.9784],
                    address: '100 Feet Road, Indiranagar, Bangalore',
                    city: 'Bangalore',
                    state: 'Karnataka',
                    pincode: '560038'
                },
                images: ['https://example.com/sewage1.jpg'],
                reportedBy: user1._id,
                reporters: [{
                    user: user1._id,
                    consent: true,
                    isActive: true,
                    joinedAt: new Date()
                }] // Single reporter
            },
            {
                title: 'Traffic Signal Malfunction at Silk Board',
                description: 'Traffic signal not working properly causing massive traffic jams during peak hours.',
                category: 'Traffic & Transportation',
                location: {
                    type: 'Point',
                    coordinates: [77.6212, 12.9166],
                    address: 'Silk Board Junction, Bangalore',
                    city: 'Bangalore',
                    state: 'Karnataka',
                    pincode: '560076'
                },
                images: ['https://example.com/traffic1.jpg'],
                reportedBy: user2._id,
                reporters: [
                    {
                        user: user2._id,
                        consent: true,
                        isActive: true,
                        joinedAt: new Date()
                    },
                    {
                        user: user1._id,
                        consent: true,
                        isActive: true,
                        joinedAt: new Date(Date.now() + 180000) // 3 minutes later
                    }
                ] // Two reporters
            }
        ];

        console.log('\n=== CREATING TEST ISSUES ===');
        const createdIssues = [];

        for (let i = 0; i < testIssues.length; i++) {
            const issueData = testIssues[i];
            const issue = new Issue({
                ...issueData,
                status: 'pending',
                priority: 'medium',
                estimatedResolutionTime: 48,
                statusHistory: [{
                    status: 'pending',
                    comment: 'Issue reported by citizen',
                    timestamp: new Date()
                }],
                notifications: [{
                    message: 'Your issue has been successfully reported and is under review',
                    type: 'status_change',
                    timestamp: new Date()
                }]
            });

            await issue.save();
            createdIssues.push(issue);
            
            console.log(`✅ Created Issue ${i + 1}: ${issue.title}`);
            console.log(`   - Reporters: ${issue.reporters.length}`);
            console.log(`   - Issue ID: ${issue._id}`);
        }

        console.log('\n=== RESOLVING ISSUES AND TESTING EMAILS ===');
        
        // Import mail controller for testing
        const mailController = require('../controllers/mail.controller');
        
        for (let i = 0; i < createdIssues.length; i++) {
            const issue = createdIssues[i];
            
            console.log(`\n🔄 Resolving Issue ${i + 1}: ${issue.title}`);
            console.log(`   - Reporters count: ${issue.reporters.length}`);
            
            // Update issue status to resolved
            issue.status = 'resolved';
            issue.resolutionDetails = {
                resolutionDate: new Date(),
                resolutionDescription: `Issue has been successfully resolved by the concerned department. Thank you for reporting.`,
                resolutionImages: ['https://example.com/resolved1.jpg']
            };
            
            // Add status history
            issue.statusHistory.push({
                status: 'resolved',
                comment: 'Issue resolved by government official',
                timestamp: new Date()
            });

            await issue.save();
            
            // Send email notification
            try {
                console.log(`   📧 Sending email notifications...`);
                const emailResult = await mailController.sendIssueResolutionEmail(issue._id, 'test-government-user');
                
                console.log(`   ✅ Email Result:`, {
                    success: emailResult.success,
                    totalReporters: emailResult.totalReporters,
                    successCount: emailResult.successCount,
                    failureCount: emailResult.failureCount
                });
                
                if (emailResult.results) {
                    emailResult.results.forEach((result, idx) => {
                        if (result.success) {
                            console.log(`     ✅ Email sent to: ${result.email}`);
                        } else {
                            console.log(`     ❌ Failed to send to: ${result.email} - ${result.error}`);
                        }
                    });
                }
                
            } catch (emailError) {
                console.log(`   ❌ Email sending failed:`, emailError.message);
            }
            
            // Add a small delay between issues
            if (i < createdIssues.length - 1) {
                console.log(`   ⏳ Waiting 2 seconds before next issue...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.log('\n=== TEST SUMMARY ===');
        console.log(`✅ Created ${createdIssues.length} test issues`);
        console.log(`✅ Resolved all ${createdIssues.length} issues`);
        console.log(`📧 Email notifications sent to:`);
        console.log(`   - rakshithganjimut@gmail.com (3 single-reporter issues + 3 multi-reporter issues)`);
        console.log(`   - tanush.bhootra2024@vitstudent.ac.in (3 multi-reporter issues)`);
        console.log(`\n📋 Issue Breakdown:`);
        console.log(`   - 3 issues with single reporter (rakshithganjimut@gmail.com)`);
        console.log(`   - 3 issues with two reporters (both emails)`);
        
        console.log('\n🎯 Check your email inboxes for resolution notifications!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

createTestIssuesAndResolve();