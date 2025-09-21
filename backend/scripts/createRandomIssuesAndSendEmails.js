require('dotenv').config();
const mongoose = require('mongoose');
const Issue = require('../models/Issue');
const User = require('../models/User');
const mailController = require('../controllers/mail.controller');
const { log } = require('../utils/logger');

async function createRandomIssuesAndSendEmails() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Test users data
        const testUsersData = [
            {
                name: 'Soumya Gupta',
                email: 'soumya.gupta2024@gmail.com',
                phone: '+919876543212',
                role: 'citizen'
            },
            {
                name: 'Tanush Bhootra',
                email: 'tanush.bhootra2024@gmail.com',
                phone: '+919876543213',
                role: 'citizen'
            },
            {
                name: 'Rakshith Ganjimut',
                email: 'rakshith.ganjimut2024@gmail.com',
                phone: '+919876543214',
                role: 'citizen'
            }
        ];

        console.log('\n=== SETTING UP TEST USERS ===');
        const testUsers = [];

        for (const userData of testUsersData) {
            let user = await User.findOne({ email: userData.email });
            if (!user) {
                user = new User({
                    ...userData,
                    password: 'hashedpassword123' // In real app, this would be properly hashed
                });
                await user.save();
                console.log(`✅ Created user: ${userData.name} (${userData.email})`);
            } else {
                console.log(`✅ Found user: ${userData.name} (${userData.email})`);
            }
            testUsers.push(user);
        }

        // Issue categories and sample data
        const categories = [
            'Roads & Infrastructure',
            'Waste Management', 
            'Electricity',
            'Water Supply',
            'Sewage & Drainage',
            'Traffic & Transportation',
            'Public Safety',
            'Parks & Recreation',
            'Street Lighting',
            'Noise Pollution'
        ];

        const issueTemplates = [
            {
                title: 'Broken Street Light on {location}',
                description: 'Street light has been non-functional for several days, causing safety concerns for pedestrians and vehicles.',
                category: 'Street Lighting'
            },
            {
                title: 'Large Pothole on {location}',
                description: 'Deep pothole causing vehicle damage and creating traffic bottlenecks during peak hours.',
                category: 'Roads & Infrastructure'
            },
            {
                title: 'Garbage Collection Issue in {location}',
                description: 'Garbage has not been collected for multiple days, causing health hazards and foul smell in the area.',
                category: 'Waste Management'
            },
            {
                title: 'Water Supply Disruption in {location}',
                description: 'No water supply for the past few days. Residents are facing severe inconvenience.',
                category: 'Water Supply'
            },
            {
                title: 'Power Outage in {location}',
                description: 'Frequent power cuts and voltage fluctuations affecting daily life and work.',
                category: 'Electricity'
            },
            {
                title: 'Sewage Overflow on {location}',
                description: 'Sewage overflowing on the road causing health hazards and traffic disruption.',
                category: 'Sewage & Drainage'
            },
            {
                title: 'Traffic Signal Malfunction at {location}',
                description: 'Traffic signal not working properly causing massive traffic jams during peak hours.',
                category: 'Traffic & Transportation'
            },
            {
                title: 'Public Park Maintenance Issue in {location}',
                description: 'Park equipment is damaged and area needs cleaning and maintenance for public safety.',
                category: 'Parks & Recreation'
            },
            {
                title: 'Noise Pollution from {location}',
                description: 'Excessive noise from construction/commercial activities disturbing residents.',
                category: 'Noise Pollution'
            },
            {
                title: 'Public Safety Concern in {location}',
                description: 'Safety hazards in the area requiring immediate attention from authorities.',
                category: 'Public Safety'
            }
        ];

        const locations = [
            { name: 'MG Road', coords: [77.5946, 12.9716], address: 'MG Road, Bangalore', city: 'Bangalore', state: 'Karnataka', pincode: '560001' },
            { name: 'Whitefield Main Road', coords: [77.7500, 12.9698], address: 'Whitefield Main Road, Bangalore', city: 'Bangalore', state: 'Karnataka', pincode: '560066' },
            { name: 'HSR Layout Sector 2', coords: [77.6413, 12.9082], address: 'HSR Layout Sector 2, Bangalore', city: 'Bangalore', state: 'Karnataka', pincode: '560102' },
            { name: 'Koramangala 4th Block', coords: [77.6269, 12.9279], address: 'Koramangala 4th Block, Bangalore', city: 'Bangalore', state: 'Karnataka', pincode: '560034' },
            { name: 'Indiranagar 100 Feet Road', coords: [77.6413, 12.9784], address: '100 Feet Road, Indiranagar, Bangalore', city: 'Bangalore', state: 'Karnataka', pincode: '560038' },
            { name: 'Silk Board Junction', coords: [77.6212, 12.9166], address: 'Silk Board Junction, Bangalore', city: 'Bangalore', state: 'Karnataka', pincode: '560076' },
            { name: 'Electronic City Phase 1', coords: [77.6648, 12.8456], address: 'Electronic City Phase 1, Bangalore', city: 'Bangalore', state: 'Karnataka', pincode: '560100' },
            { name: 'Marathahalli Bridge', coords: [77.6973, 12.9592], address: 'Marathahalli Bridge, Bangalore', city: 'Bangalore', state: 'Karnataka', pincode: '560037' },
            { name: 'JP Nagar 7th Phase', coords: [77.5683, 12.8996], address: 'JP Nagar 7th Phase, Bangalore', city: 'Bangalore', state: 'Karnataka', pincode: '560078' },
            { name: 'Rajajinagar 2nd Block', coords: [77.5558, 12.9991], address: 'Rajajinagar 2nd Block, Bangalore', city: 'Bangalore', state: 'Karnataka', pincode: '560010' }
        ];

        console.log('\n=== CREATING 10 RANDOM ISSUES ===');
        const createdIssues = [];

        for (let i = 0; i < 10; i++) {
            // Randomly select template, location, and reporters
            const template = issueTemplates[Math.floor(Math.random() * issueTemplates.length)];
            const location = locations[Math.floor(Math.random() * locations.length)];
            
            // Randomly decide number of reporters (1, 2, or 3)
            const numReporters = Math.floor(Math.random() * 3) + 1;
            
            // Shuffle users and take the first numReporters
            const shuffledUsers = [...testUsers].sort(() => 0.5 - Math.random());
            const selectedUsers = shuffledUsers.slice(0, numReporters);
            
            // Pick primary reporter (first selected user)
            const primaryReporter = selectedUsers[0];
            
            // Create reporters array with all selected users
            const reporters = selectedUsers.map((user, index) => ({
                user: user._id,
                consent: true,
                isActive: true,
                joinedAt: new Date(Date.now() + (index * 60000)) // Stagger join times
            }));

            const issueData = {
                title: template.title.replace('{location}', location.name),
                description: template.description,
                category: template.category,
                location: {
                    type: 'Point',
                    coordinates: location.coords,
                    address: location.address,
                    city: location.city,
                    state: location.state,
                    pincode: location.pincode
                },
                images: [`https://example.com/issue${i + 1}_img1.jpg`],
                reportedBy: primaryReporter._id,
                reporters: reporters,
                status: 'pending',
                priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
                estimatedResolutionTime: Math.floor(Math.random() * 72) + 24, // 24-96 hours
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
            };

            const issue = new Issue(issueData);
            await issue.save();
            createdIssues.push(issue);
            
            console.log(`✅ Created Issue ${i + 1}: ${issue.title}`);
            console.log(`   📍 Location: ${location.name}`);
            console.log(`   👥 Reporters: ${numReporters} (${selectedUsers.map(u => u.name).join(', ')})`);
            console.log(`   📧 Emails: ${selectedUsers.map(u => u.email).join(', ')}`);
            console.log(`   🆔 Issue ID: ${issue._id}`);
        }

        console.log('\n=== RESOLVING ALL ISSUES AND SENDING EMAILS ===');
        
        let totalEmailsSent = 0;
        let totalEmailsFailed = 0;
        
        for (let i = 0; i < createdIssues.length; i++) {
            const issue = createdIssues[i];
            
            console.log(`\n🔄 Resolving Issue ${i + 1}: ${issue.title}`);
            console.log(`   👥 Reporters: ${issue.reporters.length}`);
            
            // Update issue to resolved status
            issue.status = 'resolved';
            issue.resolutionDetails = {
                resolutionDate: new Date(),
                resolutionDescription: `Issue has been successfully resolved by the concerned department. The problem has been fixed and the area is now in proper condition. Thank you for reporting this civic issue.`,
                resolutionImages: [`https://example.com/resolved_issue${i + 1}.jpg`]
            };
            
            issue.statusHistory.push({
                status: 'resolved',
                comment: 'Issue resolved by government department',
                timestamp: new Date()
            });

            await issue.save();
            
            // Send email notifications
            try {
                console.log(`   📧 Sending resolution emails...`);
                const emailResult = await mailController.sendIssueResolutionEmail(issue._id, 'government-official');
                
                console.log(`   ✅ Email Result: Success=${emailResult.successCount}, Failed=${emailResult.failureCount}`);
                
                totalEmailsSent += emailResult.successCount;
                totalEmailsFailed += emailResult.failureCount;
                
                if (emailResult.results) {
                    emailResult.results.forEach((result) => {
                        if (result.success) {
                            console.log(`     ✅ Sent to: ${result.email}`);
                        } else {
                            console.log(`     ❌ Failed to: ${result.email} - ${result.error}`);
                        }
                    });
                }
                
            } catch (emailError) {
                console.log(`   ❌ Email error: ${emailError.message}`);
                totalEmailsFailed += issue.reporters.length;
            }
            
            // Small delay between issues
            if (i < createdIssues.length - 1) {
                console.log(`   ⏳ Waiting 2 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('🎉 COMPREHENSIVE EMAIL TEST COMPLETED!');
        console.log('='.repeat(60));
        console.log(`✅ Created: ${createdIssues.length} issues`);
        console.log(`✅ Resolved: ${createdIssues.length} issues`);
        console.log(`📧 Total emails sent: ${totalEmailsSent}`);
        console.log(`❌ Total emails failed: ${totalEmailsFailed}`);
        
        console.log('\n📋 Email Distribution:');
        console.log('   📧 soumya.gupta2024@gmail.com - Should receive emails for issues where she was a reporter');
        console.log('   📧 tanush.bhootra2024@gmail.com - Should receive emails for issues where he was a reporter');
        console.log('   📧 rakshith.ganjimut2024@gmail.com - Should receive emails for issues where he was a reporter');
        
        console.log('\n🎯 Check all three email inboxes for beautiful resolution notifications!');
        console.log('💼 Each email contains complete issue details, resolution information, and professional government styling.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

createRandomIssuesAndSendEmails();