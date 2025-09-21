const { sendEmail } = require('../utils/email');
const Issue = require('../models/Issue');
const User = require('../models/User');
const { log, error } = require('../utils/logger');

class MailController {
    // Send issue resolution email to all active reporters
    async sendIssueResolutionEmail(issueId, resolvedBy) {
        try {
            log('[MailController][sendIssueResolutionEmail] Starting for issue:', issueId);

            // Fetch the issue with populated data
            const issue = await Issue.findById(issueId).populate([
                { path: 'reporters.user', select: 'name email' },
                { path: 'resolutionDetails.resolvedBy', select: 'name email department' }
            ]);

            if (!issue) {
                error('[MailController][sendIssueResolutionEmail] Issue not found:', issueId);
                return { success: false, error: 'Issue not found' };
            }

            // Filter active reporters who have emails
            const activeReporters = issue.reporters.filter(reporter => 
                reporter.isActive && 
                reporter.user && 
                reporter.user.email
            );

            if (activeReporters.length === 0) {
                log('[MailController][sendIssueResolutionEmail] No active reporters with emails found');
                return { success: true, message: 'No active reporters to notify' };
            }

            log('[MailController][sendIssueResolutionEmail] Found active reporters:', activeReporters.length);

            // Prepare email data
            const emailData = {
                issue: {
                    id: issue._id.toString(),
                    title: issue.title,
                    description: issue.description,
                    category: issue.category,
                    location: issue.location.coordinates[0] + ', ' + issue.location.coordinates[1],
                    createdAt: issue.createdAt,
                    resolutionDate: issue.resolutionDetails.resolutionDate,
                    resolutionDescription: issue.resolutionDetails.resolutionDescription,
                    resolutionImages: issue.resolutionDetails.resolutionImages || [],
                    actualResolutionTime: issue.actualResolutionTime
                },
                resolvedBy: issue.resolutionDetails.resolvedBy
            };

            // Send emails to all active reporters
            const emailPromises = activeReporters.map(async (reporter) => {
                try {
                    const emailHTML = this.generateResolutionEmailHTML(emailData, reporter.user.name);
                    
                    await sendEmail({
                        to: reporter.user.email,
                        subject: `✅ Your Issue Has Been Resolved - ${issue.title}`,
                        html: emailHTML,
                        text: this.generateResolutionEmailText(emailData, reporter.user.name)
                    });

                    log('[MailController][sendIssueResolutionEmail] Email sent to:', reporter.user.email);
                    return { success: true, email: reporter.user.email };
                } catch (emailError) {
                    error('[MailController][sendIssueResolutionEmail] Failed to send email to:', reporter.user.email, emailError);
                    return { success: false, email: reporter.user.email, error: emailError.message };
                }
            });

            const results = await Promise.allSettled(emailPromises);
            const successCount = results.filter(result => result.status === 'fulfilled' && result.value.success).length;
            const failureCount = results.length - successCount;

            log('[MailController][sendIssueResolutionEmail] Completed. Success:', successCount, 'Failed:', failureCount);

            return {
                success: true,
                totalReporters: activeReporters.length,
                successCount,
                failureCount,
                results: results.map(result => result.status === 'fulfilled' ? result.value : { success: false, error: result.reason })
            };

        } catch (err) {
            error('[MailController][sendIssueResolutionEmail] Error:', err);
            return { success: false, error: err.message };
        }
    }

    // Generate HTML email template for issue resolution
    generateResolutionEmailHTML(emailData, reporterName) {
        const { issue, resolvedBy } = emailData;
        const resolutionTimeText = issue.actualResolutionTime 
            ? `${issue.actualResolutionTime} hours` 
            : 'N/A';

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Issue Resolved - Civic Pulse</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">✅ Issue Resolved!</h1>
                    <p style="color: #e8f2ff; margin: 10px 0 0 0; font-size: 16px;">Your reported issue has been successfully resolved</p>
                </div>

                <!-- Main Content -->
                <div style="padding: 30px 20px;">
                    <div style="margin-bottom: 25px;">
                        <h2 style="color: #333333; margin: 0 0 10px 0; font-size: 20px;">Hello ${reporterName},</h2>
                        <p style="color: #555555; line-height: 1.6; margin: 0; font-size: 16px;">
                            Great news! The issue you reported to Civic Pulse has been successfully resolved by our team.
                        </p>
                    </div>

                    <!-- Issue Details Card -->
                    <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                        <h3 style="color: #495057; margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #667eea; padding-bottom: 8px;">📋 Issue Details</h3>
                        
                        <div style="margin-bottom: 12px;">
                            <strong style="color: #495057;">Title:</strong>
                            <span style="color: #6c757d; margin-left: 8px;">${issue.title}</span>
                        </div>
                        
                        <div style="margin-bottom: 12px;">
                            <strong style="color: #495057;">Category:</strong>
                            <span style="background-color: #667eea; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 8px;">${issue.category}</span>
                        </div>
                        
                        <div style="margin-bottom: 12px;">
                            <strong style="color: #495057;">Location:</strong>
                            <span style="color: #6c757d; margin-left: 8px;">${issue.location}</span>
                        </div>
                        
                        <div style="margin-bottom: 12px;">
                            <strong style="color: #495057;">Reported On:</strong>
                            <span style="color: #6c757d; margin-left: 8px;">${new Date(issue.createdAt).toLocaleDateString('en-IN', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}</span>
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #495057;">Description:</strong>
                            <div style="margin-top: 8px; padding: 12px; background-color: #ffffff; border-left: 4px solid #667eea; border-radius: 4px;">
                                <p style="margin: 0; color: #6c757d; line-height: 1.5;">${issue.description}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Resolution Details Card -->
                    <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                        <h3 style="color: #155724; margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #28a745; padding-bottom: 8px;">🎉 Resolution Details</h3>
                        
                        <div style="margin-bottom: 12px;">
                            <strong style="color: #155724;">Resolved On:</strong>
                            <span style="color: #155724; margin-left: 8px;">${new Date(issue.resolutionDate).toLocaleDateString('en-IN', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}</span>
                        </div>
                        
                        <div style="margin-bottom: 12px;">
                            <strong style="color: #155724;">Resolution Time:</strong>
                            <span style="color: #155724; margin-left: 8px;">${resolutionTimeText}</span>
                        </div>
                        
                        ${resolvedBy ? `
                        <div style="margin-bottom: 12px;">
                            <strong style="color: #155724;">Resolved By:</strong>
                            <span style="color: #155724; margin-left: 8px;">${resolvedBy.name}${resolvedBy.department ? ` (${resolvedBy.department})` : ''}</span>
                        </div>
                        ` : ''}
                        
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #155724;">Resolution Description:</strong>
                            <div style="margin-top: 8px; padding: 12px; background-color: #ffffff; border-left: 4px solid #28a745; border-radius: 4px;">
                                <p style="margin: 0; color: #155724; line-height: 1.5;">${issue.resolutionDescription}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Call to Action -->
                    <div style="text-align: center; margin-bottom: 25px;">
                        <p style="color: #555555; margin-bottom: 20px; font-size: 16px;">
                            Thank you for being an active citizen and helping improve our community!
                        </p>
                        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #17a2b8;">
                            <p style="margin: 0; color: #0c5460; font-style: italic;">
                                "Every report makes our community better. Your civic participation matters!"
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background-color: #343a40; padding: 20px; text-align: center;">
                    <p style="color: #adb5bd; margin: 0 0 10px 0; font-size: 14px;">
                        This is an automated message from Civic Pulse
                    </p>
                    <p style="color: #6c757d; margin: 0; font-size: 12px;">
                        Issue ID: ${issue.id} | If you have questions, please contact our support team
                    </p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    // Generate plain text version of the email
    generateResolutionEmailText(emailData, reporterName) {
        const { issue, resolvedBy } = emailData;
        const resolutionTimeText = issue.actualResolutionTime 
            ? `${issue.actualResolutionTime} hours` 
            : 'N/A';

        return `
✅ ISSUE RESOLVED - CIVIC PULSE

Hello ${reporterName},

Great news! The issue you reported to Civic Pulse has been successfully resolved by our team.

ISSUE DETAILS:
- Title: ${issue.title}
- Category: ${issue.category}
- Location: ${issue.location}
- Reported On: ${new Date(issue.createdAt).toLocaleDateString('en-IN')}
- Description: ${issue.description}

RESOLUTION DETAILS:
- Resolved On: ${new Date(issue.resolutionDate).toLocaleDateString('en-IN')}
- Resolution Time: ${resolutionTimeText}
${resolvedBy ? `- Resolved By: ${resolvedBy.name}${resolvedBy.department ? ` (${resolvedBy.department})` : ''}\n` : ''}
- Resolution Description: ${issue.resolutionDescription}

Thank you for being an active citizen and helping improve our community!

---
This is an automated message from Civic Pulse
Issue ID: ${issue.id}
If you have questions, please contact our support team.
        `.trim();
    }

    // Test email functionality
    async sendTestResolutionEmail(req, res) {
        try {
            const { email, issueId } = req.body;

            if (!email || !issueId) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and issueId are required'
                });
            }

            const result = await this.sendIssueResolutionEmail(issueId);

            res.json({
                success: true,
                message: 'Test email functionality completed',
                data: result
            });
        } catch (error) {
            console.error('Error in test email:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send test email',
                message: error.message
            });
        }
    }
}

module.exports = new MailController();
