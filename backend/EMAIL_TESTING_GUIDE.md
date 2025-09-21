# Email Functionality Testing Guide

This guide explains how to test the email functionality for issue resolution notifications.

## Setup

1. **Environment Variables**
   Add these to your `.env` file:
   ```
   # For development (using Ethereal Email for testing)
   NODE_ENV=development
   EMAIL_FROM=noreply@civicpulse.org
   
   # For production (example with Gmail)
   NODE_ENV=production
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   EMAIL_FROM=noreply@civicpulse.org
   ```

2. **Test Script**
   Run the test script to set up test data:
   ```bash
   node backend/scripts/testEmailFunctionality.js
   ```

   To check active reporters:
   ```bash
   node backend/scripts/testEmailFunctionality.js check
   ```

## Testing Email Functionality

### Method 1: Through Issue Resolution
1. Start your backend server
2. Login as a government user
3. Update an issue status to "resolved" via the API:
   ```
   PUT /api/issues/:issueId/status
   {
     "status": "resolved",
     "resolutionDetails": {
       "description": "Issue has been successfully resolved"
     }
   }
   ```

### Method 2: Direct Email Test
Use the test endpoint (government users only):
```
POST /api/mail/send-resolution-email/:issueId
```

### Method 3: Test Email Endpoint
```
POST /api/mail/test-resolution-email
{
  "email": "test@example.com",
  "issueId": "your-issue-id"
}
```

## Expected Behavior

1. **Active Reporters Only**: Only reporters with `isActive: true` will receive emails
2. **Email Content**: Rich HTML email with:
   - Issue details (title, description, category, location)
   - Resolution details (date, time, description)
   - Professional styling with government theme
3. **Logging**: Check console for email sending logs
4. **Error Handling**: Email failures won't prevent issue status updates

## Email Preview

In development mode (using Ethereal Email), check the console for preview URLs to see how emails look.

## Boolean Logic

The system uses the `isActive` boolean field for each reporter:
- `true`: Reporter will receive email notifications
- `false`: Reporter will not receive email notifications
- Default: `false` (as requested)

To activate a reporter, update the issue:
```javascript
await Issue.updateOne(
  { _id: issueId, 'reporters.user': userId },
  { $set: { 'reporters.$.isActive': true } }
);
```

## Troubleshooting

1. **No emails sent**: Check if reporters have `isActive: true`
2. **Email service errors**: Verify environment variables
3. **Permission errors**: Ensure user has government role
4. **Missing issue**: Verify issue exists and has resolution details