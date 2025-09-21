require('dotenv').config();
const { sendEmail } = require('../utils/email');

async function sendSampleEmail() {
    try {
        console.log('🚀 Sending sample email...');
        console.log('From:', process.env.SMTP_USER);
        console.log('To: rakshith.ganjimut@gmail.com');
        
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
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎉 Gilichu Email System Test</h1>
                    <p>Email functionality is working perfectly!</p>
                </div>
                
                <div class="content">
                    <h2>Hello from Gilichu! 👋</h2>
                    
                    <p>This is a sample email sent from the Gilichu civic issue reporting platform. The email notification system has been successfully implemented with the following features:</p>
                    
                    <div class="highlight">
                        <h3>✅ Features Implemented:</h3>
                        <ul>
                            <li><strong>Issue Resolution Notifications</strong> - Automatic emails when issues are resolved</li>
                            <li><strong>Reporter Management</strong> - Active reporter tracking with isActive boolean field</li>
                            <li><strong>Styled Email Templates</strong> - Beautiful HTML emails with government branding</li>
                            <li><strong>Authentication Integration</strong> - Secure email sending with proper authentication</li>
                        </ul>
                    </div>
                    
                    <p><strong>Test Details:</strong></p>
                    <ul>
                        <li>📧 <strong>Email Service:</strong> ${process.env.EMAIL_SERVICE}</li>
                        <li>👤 <strong>Sender:</strong> ${process.env.SMTP_USER}</li>
                        <li>🕒 <strong>Sent At:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</li>
                        <li>🌟 <strong>Status:</strong> Email system fully operational!</li>
                    </ul>
                    
                    <p>The system is now ready to send notifications to all active reporters when their reported issues get resolved by government officials.</p>
                    
                    <center>
                        <a href="#" class="btn">System Ready! 🚀</a>
                    </center>
                </div>
                
                <div class="footer">
                    <p><strong>Gilichu - Civic Issue Reporting Platform</strong></p>
                    <p>Making communities better, one issue at a time.</p>
                    <p><em>This is an automated test email from the Gilichu platform.</em></p>
                </div>
            </div>
        </body>
        </html>`;

        const textContent = `
        🎉 GILICHU EMAIL SYSTEM TEST

        Hello from Gilichu!

        This is a sample email sent from the Gilichu civic issue reporting platform. 
        The email notification system has been successfully implemented.

        ✅ Features Implemented:
        - Issue Resolution Notifications - Automatic emails when issues are resolved
        - Reporter Management - Active reporter tracking with isActive boolean field  
        - Styled Email Templates - Beautiful HTML emails with government branding
        - Authentication Integration - Secure email sending with proper authentication

        Test Details:
        - Email Service: ${process.env.EMAIL_SERVICE}
        - Sender: ${process.env.SMTP_USER}
        - Sent At: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
        - Status: Email system fully operational!

        The system is now ready to send notifications to all active reporters when 
        their reported issues get resolved by government officials.

        ---
        Gilichu - Civic Issue Reporting Platform
        Making communities better, one issue at a time.
        This is an automated test email from the Gilichu platform.
        `;

        const result = await sendEmail({
            to: 'rakshith.ganjimut@gmail.com',
            subject: '🎉 Gilichu Email System Test - Successfully Implemented!',
            html: htmlContent,
            text: textContent
        });

        if (result.success) {
            console.log('✅ Sample email sent successfully!');
            console.log('📧 Message ID:', result.messageId);
            console.log('🎯 Email delivered to: rakshith.ganjimut@gmail.com');
        } else {
            console.log('❌ Failed to send email:', result.error);
        }

    } catch (error) {
        console.error('❌ Error sending sample email:', error.message);
    }
}

sendSampleEmail();