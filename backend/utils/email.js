const nodemailer = require('nodemailer');

// Create a testing transporter for development
const createTestTransporter = () => {
    return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.TEST_EMAIL_USER || 'test@example.com',
            pass: process.env.TEST_EMAIL_PASS || 'testpassword'
        }
    });
};

// Create a production transporter
const createProductionTransporter = () => {
    return nodemailer.createTransport({
         host: 'smtp.gmail.com',
            port: 465,
            secure: true, // true for 465
            auth: {
                    user: process.env.SMTP_USER, // your email
                   pass: process.env.SMTP_PASS  // your app password
             }
        });
};

// Get the appropriate transporter based on environment and available credentials
const getTransporter = () => {
    // If we have Gmail credentials configured, use Gmail regardless of environment
    if (process.env.SMTP_USER && process.env.SMTP_PASS && 
        process.env.SMTP_USER.includes('gmail.com')) {
        console.log('Using Gmail transporter with configured credentials');
        return createProductionTransporter();
    }
    
    // Fallback to environment-based selection
    return process.env.NODE_ENV === 'production'
        ? createProductionTransporter()
        : createTestTransporter();
};

// Send an email
const sendEmail = async (options) => {
    try {
        const transporter = getTransporter();

        const mailOptions = {
            from: `"Civic Pulse" <${process.env.EMAIL_FROM || 'noreply@civicpulse.org'}>`,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html
        };

        const info = await transporter.sendMail(mailOptions);

        // Log the test URL for ethereal email when in development
        if (process.env.NODE_ENV !== 'production') {
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }

        return info;
    } catch (error) {
        console.error('Email sending failed:', error);
        throw error;
    }
};

// Send test email
const sendTestEmail = async (recipient = 'test@example.com') => {
    try {
        // Create test account with Ethereal
        const testAccount = await nodemailer.createTestAccount();

        // Create a testing transporter with the test account
        const transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });

        // Prepare email content
        const mailOptions = {
            from: '"Civic Pulse Test" <test@civicpulse.org>',
            to: recipient,
            subject: 'Test Email from Civic Pulse',
            text: 'This is a test email from Civic Pulse platform. If you received this, the email functionality is working correctly.',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #4a7bff;">Civic Pulse Test Email</h2>
                    <p>Hello,</p>
                    <p>This is a test email from the Civic Pulse platform.</p>
                    <p>If you received this email, it means the email functionality is working correctly.</p>
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                        <p style="font-size: 12px; color: #666;">
                            This is an automated message, please do not reply to this email.
                        </p>
                    </div>
                </div>
            `
        };

        // Send the test email
        const info = await transporter.sendMail(mailOptions);

        // Return the result including the preview URL
        return {
            success: true,
            messageId: info.messageId,
            previewUrl: nodemailer.getTestMessageUrl(info)
        };
    } catch (error) {
        console.error('Test email sending failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    sendEmail,
    sendTestEmail
};
