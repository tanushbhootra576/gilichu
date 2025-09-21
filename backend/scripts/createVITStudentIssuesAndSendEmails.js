require('dotenv').config();
const mongoose = require('mongoose');
const Issue = require('../models/Issue');
const User = require('../models/User');
const mailController = require('../controllers/mail.controller');
const { log } = require('../utils/logger');

async function createVITStudentIssuesAndSendEmails() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // VIT Student users data
        const vitStudentUsersData = [
            {
                name: 'Soumya Gupta',
                email: 'soumya.gupta2024@vitstudent.ac.in',
                phone: '+919876543215',
                role: 'citizen'
            },
            {
                name: 'Tanush Bhootra',
                email: 'tanush.bhootra2024@vitstudent.ac.in',
                phone: '+919876543216',
                role: 'citizen'
            },
            {
                name: 'Rakshith Ganjimut',
                email: 'rakshith.ganjimut2024@vitstudent.ac.in',
                phone: '+919876543217',
                role: 'citizen'
            }
        ];

        console.log('\n=== SETTING UP VIT STUDENT USERS ===');
        const vitStudentUsers = [];

        for (const userData of vitStudentUsersData) {
            let user = await User.findOne({ email: userData.email });
            if (!user) {
                user = new User({
                    ...userData,
                    password: 'hashedpassword123' // In real app, this would be properly hashed
                });
                await user.save();
                console.log(`✅ Created VIT student: ${userData.name} (${userData.email})`);
            } else {
                console.log(`✅ Found VIT student: ${userData.name} (${userData.email})`);
            }
            vitStudentUsers.push(user);
        }

        // More diverse issue templates for VIT students
        const vitIssueTemplates = [
            {
                title: 'Campus Road Maintenance Required at {location}',
                description: 'Road surface is damaged with multiple potholes affecting student commute and vehicle safety.',
                category: 'Roads & Infrastructure'
            },
            {
                title: 'Hostel Waste Collection Issue at {location}',
                description: 'Irregular garbage collection around hostel blocks causing hygiene issues and unpleasant odors.',
                category: 'Waste Management'
            },
            {
                title: 'Street Light Not Working Near {location}',
                description: 'Multiple street lights are non-functional creating safety concerns for students during evening hours.',
                category: 'Street Lighting'
            },
            {
                title: 'Water Shortage Problem in {location}',
                description: 'Inconsistent water supply affecting daily activities and causing inconvenience to residents.',
                category: 'Water Supply'
            },
            {
                title: 'Electrical Issues in {location}',
                description: 'Frequent power fluctuations and outages disrupting academic work and daily life.',
                category: 'Electricity'
            },
            {
                title: 'Drainage Blockage at {location}',
                description: 'Clogged drainage system causing water logging during rain and creating mosquito breeding.',
                category: 'Sewage & Drainage'
            },
            {
                title: 'Traffic Congestion at {location}',
                description: 'Heavy traffic during peak hours causing delays and safety concerns for pedestrians.',
                category: 'Traffic & Transportation'
            },
            {
                title: 'Park Maintenance Needed at {location}',
                description: 'Public park area requires cleaning and equipment repair for community recreational activities.',
                category: 'Parks & Recreation'
            },
            {
                title: 'Construction Noise Pollution from {location}',
                description: 'Excessive noise from construction activities disturbing study environment and sleep.',
                category: 'Noise Pollution'
            },
            {
                title: 'Security Concern Reported at {location}',
                description: 'Safety issues in the area requiring immediate attention and enhanced security measures.',
                category: 'Public Safety'
            }
        ];

        // More diverse locations around Vellore and surrounding areas
        const velloreLocations = [
            { name: 'VIT University Main Gate', coords: [79.1589, 12.9698], address: 'VIT University Main Gate, Vellore', city: 'Vellore', state: 'Tamil Nadu', pincode: '632014' },
            { name: 'Katpadi Railway Station', coords: [79.1378, 12.9698], address: 'Katpadi Railway Station, Vellore', city: 'Vellore', state: 'Tamil Nadu', pincode: '632007' },
            { name: 'Gandhi Nagar Main Road', coords: [79.1450, 12.9750], address: 'Gandhi Nagar Main Road, Vellore', city: 'Vellore', state: 'Tamil Nadu', pincode: '632006' },
            { name: 'Bagayam Circle', coords: [79.1420, 12.9820], address: 'Bagayam Circle, Vellore', city: 'Vellore', state: 'Tamil Nadu', pincode: '632004' },
            { name: 'CMC Hospital Junction', coords: [79.1567, 12.9789], address: 'CMC Hospital Junction, Vellore', city: 'Vellore', state: 'Tamil Nadu', pincode: '632004' },
            { name: 'Sathuvachari Bus Stand', coords: [79.1234, 12.9567], address: 'Sathuvachari Bus Stand, Vellore', city: 'Vellore', state: 'Tamil Nadu', pincode: '632009' },
            { name: 'Thiru Vi Ka Industrial Estate', coords: [79.1678, 12.9456], address: 'Thiru Vi Ka Industrial Estate, Vellore', city: 'Vellore', state: 'Tamil Nadu', pincode: '632115' },
            { name: 'Vellore Fort Area', coords: [79.1325, 12.9167], address: 'Vellore Fort Area, Vellore', city: 'Vellore', state: 'Tamil Nadu', pincode: '632001' },
            { name: 'Arcot Road Junction', coords: [79.0987, 12.9234], address: 'Arcot Road Junction, Vellore', city: 'Vellore', state: 'Tamil Nadu', pincode: '632503' },
            { name: 'Officer Line Area', coords: [79.1445, 12.9889], address: 'Officer Line Area, Vellore', city: 'Vellore', state: 'Tamil Nadu', pincode: '632001' }
        ];

        console.log('\n=== CREATING 10 VIT STUDENT ISSUES ===');
        const createdVITIssues = [];

        for (let i = 0; i < 10; i++) {
            // Randomly select template, location, and reporters
            const template = vitIssueTemplates[Math.floor(Math.random() * vitIssueTemplates.length)];
            const location = velloreLocations[Math.floor(Math.random() * velloreLocations.length)];
            
            // Randomly decide number of reporters (1, 2, or 3)
            const numReporters = Math.floor(Math.random() * 3) + 1;
            
            // Shuffle users and take the first numReporters
            const shuffledUsers = [...vitStudentUsers].sort(() => 0.5 - Math.random());
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
                images: [`https://example.com/vit_issue${i + 1}_img1.jpg`, `https://example.com/vit_issue${i + 1}_img2.jpg`],
                reportedBy: primaryReporter._id,
                reporters: reporters,
                status: 'pending',
                priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
                estimatedResolutionTime: Math.floor(Math.random() * 72) + 24, // 24-96 hours
                statusHistory: [{
                    status: 'pending',
                    comment: 'Issue reported by VIT student',
                    timestamp: new Date()
                }],
                notifications: [{
                    message: 'Your civic issue has been successfully reported and is under review by authorities',
                    type: 'status_change',
                    timestamp: new Date()
                }]
            };

            const issue = new Issue(issueData);
            await issue.save();
            createdVITIssues.push(issue);
            
            console.log(`✅ Created VIT Issue ${i + 1}: ${issue.title}`);
            console.log(`   📍 Location: ${location.name}, Vellore`);
            console.log(`   👥 VIT Reporters: ${numReporters} (${selectedUsers.map(u => u.name).join(', ')})`);
            console.log(`   📧 VIT Emails: ${selectedUsers.map(u => u.email).join(', ')}`);
            console.log(`   🆔 Issue ID: ${issue._id}`);
        }

        console.log('\n=== RESOLVING ALL VIT ISSUES AND SENDING EMAILS ===');
        
        let totalVITEmailsSent = 0;
        let totalVITEmailsFailed = 0;
        
        for (let i = 0; i < createdVITIssues.length; i++) {
            const issue = createdVITIssues[i];
            
            console.log(`\n🔄 Resolving VIT Issue ${i + 1}: ${issue.title}`);
            console.log(`   👥 VIT Reporters: ${issue.reporters.length}`);
            
            // Update issue to resolved status
            issue.status = 'resolved';
            issue.resolutionDetails = {
                resolutionDate: new Date(),
                resolutionDescription: `Issue has been successfully resolved by the Vellore Municipal Corporation and concerned departments. The problem has been addressed and the area is now in proper condition. Thank you for being an active citizen and reporting this civic issue.`,
                resolutionImages: [`https://example.com/vit_resolved_issue${i + 1}.jpg`]
            };
            
            issue.statusHistory.push({
                status: 'resolved',
                comment: 'Issue resolved by municipal authorities - reported by VIT student',
                timestamp: new Date()
            });

            await issue.save();
            
            // Send email notifications
            try {
                console.log(`   📧 Sending VIT resolution emails...`);
                const emailResult = await mailController.sendIssueResolutionEmail(issue._id, 'vellore-municipal-officer');
                
                console.log(`   ✅ VIT Email Result: Success=${emailResult.successCount}, Failed=${emailResult.failureCount}`);
                
                totalVITEmailsSent += emailResult.successCount;
                totalVITEmailsFailed += emailResult.failureCount;
                
                if (emailResult.results) {
                    emailResult.results.forEach((result) => {
                        if (result.success) {
                            console.log(`     ✅ VIT Email sent to: ${result.email}`);
                        } else {
                            console.log(`     ❌ VIT Email failed to: ${result.email} - ${result.error}`);
                        }
                    });
                }
                
            } catch (emailError) {
                console.log(`   ❌ VIT Email error: ${emailError.message}`);
                totalVITEmailsFailed += issue.reporters.length;
            }
            
            // Small delay between issues
            if (i < createdVITIssues.length - 1) {
                console.log(`   ⏳ Waiting 2 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.log('\n' + '='.repeat(70));
        console.log('🎓 VIT STUDENT EMAIL NOTIFICATION TEST COMPLETED! 🎓');
        console.log('='.repeat(70));
        console.log(`✅ Created: ${createdVITIssues.length} VIT student issues`);
        console.log(`✅ Resolved: ${createdVITIssues.length} VIT student issues`);
        console.log(`📧 Total VIT emails sent: ${totalVITEmailsSent}`);
        console.log(`❌ Total VIT emails failed: ${totalVITEmailsFailed}`);
        
        console.log('\n📋 VIT Student Email Distribution:');
        console.log('   🎓 soumya.gupta2024@vitstudent.ac.in - VIT Student civic issue notifications');
        console.log('   🎓 tanush.bhootra2024@vitstudent.ac.in - VIT Student civic issue notifications');
        console.log('   🎓 rakshith.ganjimut2024@vitstudent.ac.in - VIT Student civic issue notifications');
        
        console.log('\n🏛️ All issues were created in Vellore area (VIT campus vicinity)');
        console.log('🎯 Check all three VIT student email inboxes for beautiful resolution notifications!');
        console.log('💼 Each email contains complete Vellore civic issue details with professional government styling.');
        console.log('🌟 VIT students are now actively participating in civic engagement!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

createVITStudentIssuesAndSendEmails();