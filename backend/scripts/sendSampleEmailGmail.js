require('dotenv').config();
const nodemailer = require('nodemailer');

async function sendSampleEmailWithGmail() {
    try {
        console.log('🚀 Setting up Gmail transporter...');
        console.log('Email service:', process.env.EMAIL_SERVICE);
        console.log('SMTP User:', process.env.SMTP_USER);
        console.log('Environment:', process.env.NODE_ENV);
        
        // Create Gmail transporter directly
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // true for 465, false for other ports like 587
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        // Verify transporter configuration
        console.log('🔐 Verifying transporter...');
        await transporter.verify();
        console.log('✅ Transporter verified successfully!');

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Sample Email - Gilichu Platform</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    line-height: 1.6; 
                    color: #333; 
                    margin: 0; 
                    padding: 0; 
                    background-color: #f5f5f5;
                }
                .container { 
                    max-width: 600px; 
                    margin: 20px auto; 
                    background: white; 
                    border-radius: 8px; 
                    overflow: hidden;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .header { 
                    background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); 
                    color: white; 
                    padding: 30px; 
                    text-align: center; 
                }
                .header h1 { 
                    margin: 0; 
                    font-size: 28px; 
                    font-weight: bold; 
                }
                .content { 
                    padding: 30px; 
                }
                .highlight { 
                    background-color: #f8f9fa; 
                    border-left: 4px solid #FF6B35; 
                    padding: 15px; 
                    margin: 20px 0; 
                    border-radius: 4px;
                }
                .footer { 
                    background-color: #2c3e50; 
                    color: white; 
                    padding: 20px; 
                    text-align: center; 
                    font-size: 14px;
                }
                .btn {
                    display: inline-block;
                    background-color: #FF6B35;
                    color: white;
                    padding: 12px 24px;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 10px 0;
                    font-weight: bold;
                }
                .status {
                    background-color: #d4edda;
                    border: 1px solid #c3e6cb;
                    color: #155724;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 20px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎉 Gilichu Email System</h1>
                    <p>Issue Resolution Notification System</p>
                </div>
                
                <div class="content">
                    <div class="status">
                        <h3>✅ EMAIL SYSTEM SUCCESSFULLY TESTED!</h3>
                        <p>This email confirms that the Gilichu platform's email notification system is working perfectly.</p>
                    </div>
                    
                    <h2>Hello Rakshith! 👋</h2>
                    
                    <p>This sample email demonstrates the email notification system that has been implemented for the Gilichu civic issue reporting platform.</p>
                    
                    <div class="highlight">
                        <h3>🚀 System Features:</h3>
                        <ul>
                            <li><strong>Automatic Notifications</strong> - When issues are resolved, all active reporters get notified</li>
                            <li><strong>Smart Reporter Management</strong> - Only active reporters (isActive: true) receive emails</li>
                            <li><strong>Beautiful HTML Templates</strong> - Professional government-style email design</li>
                            <li><strong>Secure Authentication</strong> - Gmail SMTP with app-specific passwords</li>
                            <li><strong>Issue Details</strong> - Complete issue information including images and resolution details</li>
                        </ul>
                    </div>
                    
                    <p><strong>Technical Details:</strong></p>
                    <ul>
                        <li>📧 <strong>Service:</strong> Gmail SMTP</li>
                        <li>👤 <strong>From:</strong> ${process.env.SMTP_USER}</li>
                        <li>🕒 <strong>Sent:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</li>
                        <li>🌟 <strong>Status:</strong> Fully Operational!</li>
                    </ul>
                    
                    <p>The system will now automatically send beautiful email notifications to citizens when their reported civic issues are resolved by government officials.</p>
                    
                    <center>
                        <a href="#" class="btn">Ready for Production! 🚀</a>
                    </center>
                </div>
                
                <div class="footer">
                    <p><strong>Gilichu - Civic Issue Reporting Platform</strong></p>
                    <p>🏛️ Government of India Initiative</p>
                    <p>Making communities better, one resolved issue at a time.</p>
                    <p><em>This is a test email from the Gilichu notification system.</em></p>
                </div>
            </div>
        </body>
        </html>`;

        const textContent = `
        🎉 GILICHU EMAIL SYSTEM - SUCCESSFULLY TESTED!

        Hello Rakshith!

        This sample email demonstrates the email notification system that has been 
        implemented for the Gilichu civic issue reporting platform.

        🚀 System Features:
        - Automatic Notifications when issues are resolved
        - Smart Reporter Management (only active reporters get emails)  
        - Beautiful HTML Templates with government styling
        - Secure Gmail SMTP Authentication
        - Complete Issue Details including images and resolution info

        Technical Details:
        - Service: Gmail SMTP
        - From: ${process.env.SMTP_USER}
        - Sent: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
        - Status: Fully Operational!

        The system will now automatically send beautiful email notifications to 
        citizens when their reported civic issues are resolved by government officials.

        ---
        Gilichu - Civic Issue Reporting Platform
        🏛️ Government of India Initiative
        Making communities better, one resolved issue at a time.
        `;

        const mailOptions = {
            from: `"Gilichu Platform" <${process.env.SMTP_USER}>`,
            to: 'rakshith.ganjimut@gmail.com',
            subject: '🎉 Gilichu Email System Test - Issue Resolution Notifications Ready!',
            html: htmlContent,
            text: textContent
        };

        console.log('📧 Sending email...');
        const info = await transporter.sendMail(mailOptions);

        console.log('✅ Sample email sent successfully!');
        console.log('📧 Message ID:', info.messageId);
        console.log('🎯 Email delivered to: rakshith.ganjimut@gmail.com');
        console.log('📨 Response:', info.response);

    } catch (error) {
        console.error('❌ Error details:', error.message);
        
        if (error.code === 'EAUTH') {
            console.log('\n🔍 Authentication failed. Please check:');
            console.log('1. Gmail account has 2-Factor Authentication enabled');
            console.log('2. Use App Password instead of regular password');
            console.log('3. Generate App Password: Google Account → Security → App passwords');
            console.log('4. Update SMTP_PASS in .env with the 16-character app password');
        }
    }
}

sendSampleEmailWithGmail();