const express = require('express');
const router = express.Router();
const mailController = require('../controllers/mail.controller');
const { authenticate, authorizeGovernment } = require('../middlewares/auth.middleware');

// Test email functionality - Government only
router.post('/test-resolution-email', authenticate, authorizeGovernment, async (req, res) => {
    try {
        await mailController.sendTestResolutionEmail(req, res);
    } catch (error) {
        console.error('Error in test resolution email route:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send test email'
        });
    }
});

// Alternative manual test route
router.post('/test-manual-email', authenticate, authorizeGovernment, async (req, res) => {
    try {
        await mailController.sendTestResolutionEmail(req, res);
    } catch (error) {
        console.error('Error in manual test email route:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send test email'
        });
    }
});

// Send resolution email for a specific issue - Government only
// 🔹 removed authMiddleware, using the same auth as above
router.post('/send-resolution-email/:issueId', authenticate, authorizeGovernment, async (req, res) => {
    try {
        const { issueId } = req.params;
        const result = await mailController.sendIssueResolutionEmail(issueId, req.user.id);

        res.json({
            success: true,
            message: 'Resolution email process completed',
            data: result
        });
    } catch (error) {
        console.error('Error sending resolution email:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send resolution email',
            message: error.message
        });
    }
});

module.exports = router;
